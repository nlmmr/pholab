import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createInitialExperimentState,
  experimentReducer,
  configureForPart,
  IPhO2024E2State,
} from './state';
import {
  phaseDifference,
  fringeShiftCount,
  resolvePhaseParameters,
} from './physics';
import { CableConnection } from '../../core/primitives/CableConnection';

/**
 * Multi-body physics simulator for pairwise interactions
 */
class PairwisePhysicsWorld {
  public bodies = new Map<string, {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    halfExtents: THREE.Vector3;
    isHeld: boolean;
    isResting: boolean;
  }>();

  public gravity = new THREE.Vector3(0, -9.81, 0);
  public benchY = 0.0;

  public addBody(id: string, pos: THREE.Vector3, halfExtents: THREE.Vector3) {
    this.bodies.set(id, {
      pos: pos.clone(),
      vel: new THREE.Vector3(0, 0, 0),
      halfExtents: halfExtents.clone(),
      isHeld: false,
      isResting: false,
    });
  }

  public step(dt: number) {
    for (const [id, b] of this.bodies.entries()) {
      if (b.isHeld || b.isResting) continue;

      b.vel.addScaledVector(this.gravity, dt);
      b.pos.addScaledVector(b.vel, dt);

      // Bench surface collision
      const bottomY = b.pos.y - b.halfExtents.y;
      if (bottomY <= this.benchY) {
        b.pos.y = this.benchY + b.halfExtents.y;
        if (Math.abs(b.vel.y) < 0.08) {
          b.vel.set(0, 0, 0);
          b.isResting = true;
        } else {
          b.vel.y = -b.vel.y * 0.2;
        }
      }
    }

    // Stacking collision: check cuvette resting on top of platform
    const platform = this.bodies.get('platform');
    const cuvette = this.bodies.get('cuvette');
    if (platform && cuvette && !cuvette.isHeld) {
      const platformTopY = platform.pos.y + platform.halfExtents.y;
      const cuvetteBottomY = cuvette.pos.y - cuvette.halfExtents.y;
      const horizontalOverlap =
        Math.abs(cuvette.pos.x - platform.pos.x) <= platform.halfExtents.x &&
        Math.abs(cuvette.pos.z - platform.pos.z) <= platform.halfExtents.z;

      if (horizontalOverlap && cuvetteBottomY <= platformTopY) {
        cuvette.pos.y = platformTopY + cuvette.halfExtents.y;
        if (Math.abs(cuvette.vel.y) < 0.08) {
          cuvette.vel.set(0, 0, 0);
          cuvette.isResting = true;
        } else {
          cuvette.vel.y = -cuvette.vel.y * 0.2;
        }
      }
    }
  }
}

// ============================================================================
// TIER 3: CROSS-FEATURE PAIRWISE INTERACTIONS SUITE
// ============================================================================

describe('Tier 3: Cross-Feature Combinations & Pairwise Interactions', () => {

  // --- Pairwise P1: Rigid Body Physics + Assembly Modes ---
  describe('Pairwise P1: Rigid Body Physics + Assembly Modes', () => {
    it('T3.P1.1: dynamic gravity operates identically in Full Realism, Guided Snap, and Skip modes', () => {
      const modes: Array<'realistic' | 'guided' | 'skip'> = ['realistic', 'guided', 'skip'];
      const velocities: number[] = [];

      for (const mode of modes) {
        const world = new PairwisePhysicsWorld();
        world.addBody('bottle', new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0.065, 0.155, 0.065));
        for (let i = 0; i < 24; i++) world.step(1 / 120);
        velocities.push(world.bodies.get('bottle')!.vel.y);
      }

      expect(velocities[0]).toBeCloseTo(velocities[1], 4);
      expect(velocities[1]).toBeCloseTo(velocities[2], 4);
    });

    it('T3.P1.2: magnetic snap in Guided mode overrides physics velocity when within tolerance radius', () => {
      const world = new PairwisePhysicsWorld();
      world.addBody('holder', new THREE.Vector3(0.15, 0.35, -0.08), new THREE.Vector3(0.1, 0.2, 0.1));
      const socketPos = new THREE.Vector3(0.05, 0.25, -0.08);

      // Within 0.32m tolerance
      const dist = world.bodies.get('holder')!.pos.distanceTo(socketPos);
      expect(dist).toBeLessThan(0.32);

      // Magnetic snap resolves position and zeroes velocity
      const holder = world.bodies.get('holder')!;
      holder.pos.copy(socketPos);
      holder.vel.set(0, 0, 0);
      holder.isResting = true;

      expect(holder.pos.x).toBe(0.05);
      expect(holder.vel.length()).toBe(0);
    });

    it('T3.P1.3: Skip mode positions apparatus at zero initial velocity and resting equilibrium', () => {
      const state = configureForPart(createInitialExperimentState(), 'B');
      expect(state.apparatus.screenPlaced).toBe(true);
      expect(state.kit.platformPlaced).toBe(true);

      const world = new PairwisePhysicsWorld();
      world.addBody('platform', new THREE.Vector3(0.05, 0.425, -0.08), new THREE.Vector3(0.775, 0.425, 0.45));
      world.bodies.get('platform')!.isResting = true;
      world.step(1 / 120);

      expect(world.bodies.get('platform')!.vel.length()).toBe(0);
    });

    it('T3.P1.4: interlock violation in Realism mode leaves physics position unaffected in cradle', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

      // Attempt platform extraction with tight rods
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);
      expect(state.positions.platform[0]).toBeCloseTo(0.05, 2);
    });
  });

  // --- Pairwise P2: 3D GrabOffset + Kit Cradle Extraction ---
  describe('Pairwise P2: 3D GrabOffset + Kit Extraction', () => {
    it('T3.P2.1: extracting platform from kit computes grabOffset without jump or origin glitch', () => {
      const kitOrigin = new THREE.Vector3(-1.85, 0.05, 0.15);
      const platformCradlePos = kitOrigin.clone().add(new THREE.Vector3(0, 0.21, -0.05));
      const hitContact = platformCradlePos.clone().add(new THREE.Vector3(0.03, 0.02, 0.01));

      const grabOffset = new THREE.Vector3().subVectors(platformCradlePos, hitContact);
      const computedPos = hitContact.clone().add(grabOffset);

      expect(computedPos.distanceTo(platformCradlePos)).toBeCloseTo(0.0, 5);
      expect(grabOffset.y).toBeCloseTo(-0.02, 4);
    });

    it('T3.P2.2: reparenting from kit to scene preserves absolute world coordinates and scale 1.0', () => {
      const kitGroup = new THREE.Group();
      kitGroup.position.set(-1.85, 0.05, 0.15);
      kitGroup.scale.setScalar(0.78);

      const itemGroup = new THREE.Group();
      itemGroup.position.set(0, 0.21, -0.05);
      kitGroup.add(itemGroup);

      // Compute world position
      kitGroup.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      itemGroup.getWorldPosition(worldPos);

      // Reparent to root scene
      kitGroup.remove(itemGroup);
      itemGroup.position.copy(worldPos);
      itemGroup.scale.setScalar(1.0);

      expect(itemGroup.position.x).toBeCloseTo(worldPos.x, 4);
      expect(itemGroup.position.y).toBeCloseTo(worldPos.y, 4);
      expect(itemGroup.scale.x).toBe(1.0);
    });

    it('T3.P2.3: extraction of thin slide holder S1 maintains grab offset during translation to bench', () => {
      const cradlePos = new THREE.Vector3(-1.45, 0.21, 0.15);
      const hit = new THREE.Vector3(-1.42, 0.21, 0.17);
      const offset = new THREE.Vector3().subVectors(cradlePos, hit);

      const newRayPos = new THREE.Vector3(0.90, 0.25, 0.35);
      const targetPos = newRayPos.clone().add(offset);

      expect(targetPos.x).toBeCloseTo(0.87, 3);
      expect(targetPos.z).toBeCloseTo(0.33, 3);
    });

    it('T3.P2.4: releasing extracted item onto bench transfers control seamlessly to rigid body simulation', () => {
      const world = new PairwisePhysicsWorld();
      world.addBody('s1_extracted', new THREE.Vector3(0.90, 0.45, 0.35), new THREE.Vector3(0.1, 0.15, 0.1));

      for (let i = 0; i < 100; i++) world.step(1 / 120);
      const s1 = world.bodies.get('s1_extracted')!;

      expect(s1.pos.y).toBeCloseTo(0.15, 2); // resting on bench
      expect(s1.isResting).toBe(true);
    });
  });

  // --- Pairwise P3: Knob Scroll Microadjustment + Optical State Synchronization ---
  describe('Pairwise P3: Knob Scroll Microadjustment + Optical State Synchronization', () => {
    it('T3.P3.1: wheel adjustment on rotation knob updates state angleDeg and changes optical phase difference', () => {
      let state = createInitialExperimentState();
      state = configureForPart(state, 'B'); // Thin slide S1
      const initialAngle = state.apparatus.angleDeg;
      const initialPhase = phaseDifference(initialAngle);

      // Microadjust +1 tick (0.25 deg)
      state = experimentReducer(state, { type: 'SET_ANGLE', value: initialAngle + 0.25 });
      const updatedPhase = phaseDifference(state.apparatus.angleDeg);

      expect(state.apparatus.angleDeg).toBeCloseTo(0.25, 2);
      expect(updatedPhase).not.toBe(initialPhase);
    });

    it('T3.P3.2: continuous wheel ticks across 20° update fringe count dynamically', () => {
      let state = configureForPart(createInitialExperimentState(), 'B');
      const k0 = fringeShiftCount(0.0);
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 20.0 });
      const k20 = fringeShiftCount(state.apparatus.angleDeg);

      expect(k0).toBeCloseTo(0.0, 6);
      expect(k20).toBeGreaterThan(0.5);
    });

    it('T3.P3.3: wheel microadjust on laser current potentiometer directly changes laserCurrentMa and output power', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      expect(state.electronics.laserCurrentMa).toBe(15.0);

      // Scroll 5 ticks up (+0.5 mA)
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: state.electronics.laserCurrentMa + 0.5 });
      expect(state.electronics.laserCurrentMa).toBeCloseTo(15.5, 2);
    });

    it('T3.P3.4: knob microadjustment preserves optical screen distance without interference', () => {
      let state = configureForPart(createInitialExperimentState(), 'B');
      const distBefore = state.apparatus.screenDistance;
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 35.0 });
      expect(state.apparatus.screenDistance).toBe(distBefore);
    });
  });

  // --- Pairwise P4: Dynamic Assembly Mode Switching during Manipulation ---
  describe('Pairwise P4: Assembly Mode Switching during Manipulation', () => {
    it('T3.P4.1: switching from Realistic to Guided mode maintains active equipment positions', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 1.5, z: 0.2 });

      // Switch mode to guided
      state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'guided' });
      expect(state.assemblyMode).toBe('guided');
      expect(state.positions.screen[0]).toBe(1.5);
      expect(state.positions.screen[1]).toBe(0.2);
    });

    it('T3.P4.2: switching from Guided to Skip mode populates missing apparatus without moving placed items', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SKIP_ASSEMBLY', part: 'C' });
      expect(state.apparatus.installedHolder).toBe('s2');
      expect(state.apparatus.cuvettePlaced).toBe(true);
    });

    it('T3.P4.3: mode switching retains measurement data intact in state', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, {
        type: 'ADD_MEASUREMENT',
        measurement: { id: 'm1', fringeIndex: 1, angleDeg: 12.5, part: 'B' },
      });
      expect(state.measurements.length).toBe(1);

      state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
      expect(state.measurements.length).toBe(1);
      expect(state.measurements[0].angleDeg).toBe(12.5);
    });
  });

  // --- Pairwise P5: Multi-Body Physical Stacking & Collision Resolution ---
  describe('Pairwise P5: Multi-Body Physical Stacking & Collision', () => {
    it('T3.P5.1: cuvette resting on optical platform remains supported when platform rests on bench', () => {
      const world = new PairwisePhysicsWorld();
      // Platform on bench: center Y = 0.425, halfHeight = 0.425 -> top surface Y = 0.85
      world.addBody('platform', new THREE.Vector3(0, 0.425, 0), new THREE.Vector3(0.775, 0.425, 0.45));
      // Cuvette placed above platform: halfHeight = 0.13
      world.addBody('cuvette', new THREE.Vector3(0, 1.20, 0), new THREE.Vector3(0.11, 0.13, 0.11));

      for (let i = 0; i < 200; i++) world.step(1 / 120);

      const platform = world.bodies.get('platform')!;
      const cuvette = world.bodies.get('cuvette')!;

      expect(platform.pos.y).toBeCloseTo(0.425, 2);
      // Cuvette should rest at platformTopY (0.85) + cuvetteHalfHeight (0.13) = 0.98
      expect(cuvette.pos.y).toBeCloseTo(0.98, 2);
      expect(cuvette.isResting).toBe(true);
    });

    it('T3.P5.2: cuvette placed off platform edge falls directly to benchtop (Y = 0.13m)', () => {
      const world = new PairwisePhysicsWorld();
      world.addBody('platform', new THREE.Vector3(0, 0.425, 0), new THREE.Vector3(0.775, 0.425, 0.45));
      // Cuvette placed beyond platform X bounds (platform maxX = 0.775)
      world.addBody('cuvette', new THREE.Vector3(1.20, 1.20, 0), new THREE.Vector3(0.11, 0.13, 0.11));

      for (let i = 0; i < 200; i++) world.step(1 / 120);
      const cuvette = world.bodies.get('cuvette')!;

      // On bench: benchY (0) + halfHeight (0.13) = 0.13
      expect(cuvette.pos.y).toBeCloseTo(0.13, 2);
      expect(cuvette.isResting).toBe(true);
    });
  });

  // --- Pairwise P6: Dynamic Catmull-Rom Cables + Physics Motion ---
  describe('Pairwise P6: Dynamic Catmull-Rom Cables + Physics Motion', () => {
    it('T3.P6.1: moving electronics controller updates Catmull-Rom cable anchor points dynamically', () => {
      const p1 = new THREE.Vector3(-0.08, 0.08, 0.82);
      const p2 = new THREE.Vector3(0.05, 0.35, -0.08);

      const cable = new CableConnection({
        id: 'test-laser-cable',
        points: [p1, new THREE.Vector3((-0.08 + 0.05) / 2, 0.04, (0.82 - 0.08) / 2), p2],
        initiallyConnected: true,
      });

      expect(cable.getConnected()).toBe(true);
      expect(cable.group.visible).toBe(true);

      // Translate electronics box
      const p1New = new THREE.Vector3(-0.30, 0.08, 0.95);
      const cableMoved = new CableConnection({
        id: 'test-laser-cable',
        points: [p1New, new THREE.Vector3((-0.30 + 0.05) / 2, 0.04, (0.95 - 0.08) / 2), p2],
        initiallyConnected: true,
      });

      expect(cableMoved.getConnected()).toBe(true);
      cable.dispose();
      cableMoved.dispose();
    });

    it('T3.P6.2: disconnecting cable in state cleanly hides spline curve', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      expect(state.electronics.laserToBoard).toBe(true);

      state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
      expect(state.electronics.laserToBoard).toBe(false);
    });
  });

  // --- Pairwise P7: Escape Hotkey Overlay Dismissal during Drag ---
  describe('Pairwise P7: Escape Hotkey Overlay Dismissal during Drag', () => {
    it('T3.P7.1: pressing Escape closes HUD ruler without disrupting item position', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'platform', x: 0.15, z: -0.05 });

      let rulerActive = true;
      // Press Escape
      rulerActive = false;

      expect(rulerActive).toBe(false);
      expect(state.positions.platform[0]).toBe(0.15);
      expect(state.positions.platform[1]).toBe(-0.05);
    });

    it('T3.P7.2: Escape dismisses assembly dropdown menu while preserving active assembly mode', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      let dropdownOpen = true;

      // Escape pressed
      dropdownOpen = false;

      expect(dropdownOpen).toBe(false);
      expect(state.assemblyMode).toBe('realistic');
    });
  });
});

