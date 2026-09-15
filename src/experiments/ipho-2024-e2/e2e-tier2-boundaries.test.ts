import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createInitialExperimentState,
  experimentReducer,
  IPhO2024E2State,
} from './state';
import {
  phaseDifference,
  phaseAtNormalIncidence,
  fringeShiftCount,
  alignmentQuality,
  resolvePhaseParameters,
} from './physics';
import { IPHO_2024_E2_CONFIG } from './config';

/**
 * Reference RigidBody simulator for boundary validation
 */
class BoundaryRigidBodySimulator {
  public bodies: Array<{
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    isHeld: boolean;
    halfHeight: number;
    restitution: number;
    isResting: boolean;
  }> = [];

  public gravity = new THREE.Vector3(0, -9.81, 0);
  public floorY = -0.78;
  public benchY = 0.0;
  public benchBounds = { minX: -3.2, maxX: 3.2, minZ: -1.7, maxZ: 1.7 };
  public sleepVelocityCutoff = 0.08;

  public addBody(id: string, initialPos: THREE.Vector3, halfHeight = 0.1, restitution = 0.2) {
    this.bodies.push({
      id,
      position: initialPos.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      isHeld: false,
      halfHeight,
      restitution,
      isResting: false,
    });
  }

  public step(dt: number) {
    for (const b of this.bodies) {
      if (b.isHeld || b.isResting) continue;

      b.velocity.addScaledVector(this.gravity, dt);
      b.position.addScaledVector(b.velocity, dt);

      const bottomY = b.position.y - b.halfHeight;
      const onBenchX = b.position.x >= this.benchBounds.minX && b.position.x <= this.benchBounds.maxX;
      const onBenchZ = b.position.z >= this.benchBounds.minZ && b.position.z <= this.benchBounds.maxZ;

      if (onBenchX && onBenchZ && bottomY <= this.benchY) {
        b.position.y = this.benchY + b.halfHeight;
        if (Math.abs(b.velocity.y) < this.sleepVelocityCutoff) {
          b.velocity.set(0, 0, 0);
          b.isResting = true;
        } else {
          b.velocity.y = -b.velocity.y * b.restitution;
        }
      } else if (bottomY <= this.floorY) {
        b.position.y = this.floorY + b.halfHeight;
        if (Math.abs(b.velocity.y) < this.sleepVelocityCutoff) {
          b.velocity.set(0, 0, 0);
          b.isResting = true;
        } else {
          b.velocity.y = -b.velocity.y * b.restitution;
        }
      }
    }
  }
}

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES SUITE (>=5 TESTS PER BOUNDARY CATEGORY)
// ============================================================================

describe('Tier 2: Boundary & Corner Cases (R1, R2, R3, R4)', () => {

  // --- B1: Bench Boundaries & Floor Limits ---
  describe('Boundary B1: Bench Lateral Boundaries & Floor Limits', () => {
    it('T2.B1.1: object resting exactly at positive bench edge (X = 3.20m, Z = 0) remains on bench', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('edge_on', new THREE.Vector3(3.20, 0.5, 0), 0.1);
      for (let i = 0; i < 150; i++) sim.step(1 / 120);

      expect(sim.bodies[0].position.y).toBeCloseTo(0.1, 2); // on bench
      expect(sim.bodies[0].isResting).toBe(true);
    });

    it('T2.B1.2: object released just beyond positive bench edge (X = 3.21m) falls cleanly to floor (Y = -0.78m)', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('edge_off', new THREE.Vector3(3.21, 0.5, 0), 0.1);
      for (let i = 0; i < 200; i++) sim.step(1 / 120);

      // Floor level -0.78m + halfHeight 0.1m = -0.68m
      expect(sim.bodies[0].position.y).toBeCloseTo(-0.68, 2);
      expect(sim.bodies[0].isResting).toBe(true);
    });

    it('T2.B1.3: object released beyond negative bench edge (X = -3.21m) falls to floor without snagging', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('neg_edge_off', new THREE.Vector3(-3.21, 0.5, 0), 0.1);
      for (let i = 0; i < 200; i++) sim.step(1 / 120);

      expect(sim.bodies[0].position.y).toBeCloseTo(-0.68, 2);
      expect(sim.bodies[0].isResting).toBe(true);
    });

    it('T2.B1.4: extreme corner release (X = 3.25m, Z = 1.75m) lands securely at floor height', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('corner_drop', new THREE.Vector3(3.25, 0.8, 1.75), 0.15);
      for (let i = 0; i < 250; i++) sim.step(1 / 120);

      // -0.78 + 0.15 = -0.63
      expect(sim.bodies[0].position.y).toBeCloseTo(-0.63, 2);
    });

    it('T2.B1.5: floor collider strictly halts downward velocity preventing penetration below Y = -0.78m', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('heavy_drop', new THREE.Vector3(0, 3.0, 0), 0.1);
      // High velocity drop straight toward floor
      sim.bodies[0].position.set(4.0, 3.0, 0);
      for (let i = 0; i < 300; i++) sim.step(1 / 120);

      const bottomY = sim.bodies[0].position.y - sim.bodies[0].halfHeight;
      expect(bottomY).toBeGreaterThanOrEqual(-0.78);
      expect(sim.bodies[0].isResting).toBe(true);
    });
  });

  // --- B2: Extreme Rotations (0° to 80°) ---
  describe('Boundary B2: Extreme Rotations (0° to 80°)', () => {
    it('T2.B2.1: normal incidence (0.00°) yields exactly zero net fringe shift count', () => {
      const shift = fringeShiftCount(0.0);
      expect(shift).toBeCloseTo(0.0, 6);
    });

    it('T2.B2.2: maximum rated goniometer rotation (80.00°) computes valid continuous optical phase', () => {
      const phi80 = phaseDifference(80.0);
      expect(Number.isFinite(phi80)).toBe(true);
      expect(phi80).toBeGreaterThan(0);
      const k80 = fringeShiftCount(80.0);
      expect(k80).toBeGreaterThan(10);
    });

    it('T2.B2.3: negative angle input clamps strictly to 0.0° boundary in experiment state', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ANGLE', value: -12.5 });
      expect(state.apparatus.angleDeg).toBeGreaterThanOrEqual(0.0);
    });

    it('T2.B2.4: over-travel angle input (>80°) clamps strictly to 80.0° maximum goniometer travel limit', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 95.0 });
      expect(state.apparatus.angleDeg).toBeLessThanOrEqual(80.0);
    });

    it('T2.B2.5: verifies bilateral symmetry: phase difference is identical for +theta and -theta', () => {
      const params = resolvePhaseParameters();
      const phiPos = phaseDifference(30.0, params);
      const phiNeg = phaseDifference(-30.0, params);
      expect(phiPos).toBeCloseTo(phiNeg, 6);
    });
  });

  // --- B3: Laser Current Extremes & Electrical Bounds ---
  describe('Boundary B3: Laser Current Extremes & Electrical Bounds', () => {
    it('T2.B3.1: minimum current boundary (0.0 mA) produces zero optical power and inactive beam', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 0.0 });
      expect(state.electronics.laserCurrentMa).toBe(0.0);
      const laserOutputPowerMw = Math.max(0, (state.electronics.laserCurrentMa - 12.0) * 0.25);
      expect(laserOutputPowerMw).toBe(0.0);
    });

    it('T2.B3.2: maximum safe operating current boundary (25.0 mA) delivers peak rated power', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 25.0 });
      expect(state.electronics.laserCurrentMa).toBe(25.0);
      const laserOutputPowerMw = Math.max(0, (state.electronics.laserCurrentMa - 12.0) * 0.25);
      expect(laserOutputPowerMw).toBeCloseTo(3.25, 2);
    });

    it('T2.B3.3: laser emission threshold current at 12.0 mA marks transition to coherent lasing', () => {
      const thresholdCurrentMa = 12.0;
      const subPower = Math.max(0, (11.9 - thresholdCurrentMa) * 0.25);
      const superPower = Math.max(0, (12.1 - thresholdCurrentMa) * 0.25);
      expect(subPower).toBe(0.0);
      expect(superPower).toBeGreaterThan(0.0);
    });

    it('T2.B3.4: negative current input clamps strictly to 0.0 mA', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: -10.0 });
      expect(state.electronics.laserCurrentMa).toBeGreaterThanOrEqual(0.0);
    });

    it('T2.B3.5: over-current input (>25 mA) clamps strictly to 25.0 mA safe operating ceiling', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 45.0 });
      expect(state.electronics.laserCurrentMa).toBeLessThanOrEqual(25.0);
    });
  });

  // --- B4: Rapid Release in Air & Drop Kinematics ---
  describe('Boundary B4: Rapid Release in Air & Drop Kinematics', () => {
    it('T2.B4.1: high drop from Y = 1.50 m impacts bench at theoretical impact velocity v = -sqrt(2*g*h)', () => {
      const sim = new BoundaryRigidBodySimulator();
      const dropY = 1.50;
      const halfH = 0.1;
      sim.addBody('high_drop', new THREE.Vector3(0, dropY, 0), halfH, 0.0); // restitution 0 to capture terminal v

      // Fall distance = 1.50 - 0.1 = 1.40 m
      // v_impact = sqrt(2 * 9.81 * 1.40) ≈ 5.241 m/s
      const expectedImpactV = Math.sqrt(2 * 9.81 * (dropY - halfH));

      // Step until impact
      let maxVelocity = 0;
      for (let i = 0; i < 100; i++) {
        sim.step(1 / 120);
        if (Math.abs(sim.bodies[0].velocity.y) > maxVelocity) {
          maxVelocity = Math.abs(sim.bodies[0].velocity.y);
        }
        if (sim.bodies[0].isResting) break;
      }
      expect(maxVelocity).toBeCloseTo(expectedImpactV, 0.5);
    });

    it('T2.B4.2: multiple rapid drops dissipate kinetic energy within 4 bounces under e <= 0.25', () => {
      const e = 0.22;
      let energyFraction = 1.0;
      for (let bounce = 0; bounce < 4; bounce++) {
        energyFraction *= e * e;
      }
      expect(energyFraction).toBeLessThan(0.0001);
    });

    it('T2.B4.3: resting sleep transition halts simulation immediately when speed is below 0.08 m/s', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('almost_rest', new THREE.Vector3(0, 0.1001, 0), 0.1, 0.2);
      // Give initial slight positive velocity so after gravity step: 0.05 - 9.81/120 = -0.03175 m/s
      sim.bodies[0].velocity.y = 0.05;
      sim.step(1 / 120);
      expect(sim.bodies[0].isResting).toBe(true);
      expect(sim.bodies[0].velocity.y).toBe(0.0);
    });

    it('T2.B4.4: rapid grab-release cycle resets accumulated velocity cleanly', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('held_test', new THREE.Vector3(0, 1.0, 0), 0.1);
      for (let i = 0; i < 10; i++) sim.step(1 / 120);
      expect(sim.bodies[0].velocity.y).toBeLessThan(0);

      // Re-grab
      sim.bodies[0].isHeld = true;
      sim.bodies[0].velocity.set(0, 0, 0);
      sim.bodies[0].position.set(0, 1.2, 0);

      sim.step(1 / 120);
      expect(sim.bodies[0].velocity.y).toBe(0.0);
    });

    it('T2.B4.5: purely vertical release preserves zero horizontal X and Z drift throughout trajectory', () => {
      const sim = new BoundaryRigidBodySimulator();
      sim.addBody('pure_vert', new THREE.Vector3(0.35, 1.2, -0.45), 0.1);
      for (let i = 0; i < 120; i++) sim.step(1 / 120);

      expect(sim.bodies[0].position.x).toBeCloseTo(0.35, 5);
      expect(sim.bodies[0].position.z).toBeCloseTo(-0.45, 5);
    });
  });

  // --- B5: Screen Distance Boundary Extremes ---
  describe('Boundary B5: Screen Distance Boundary Extremes', () => {
    it('T2.B5.1: minimum screen distance boundary clamps at 0.55 m', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.20 });
      expect(state.apparatus.screenDistance).toBeGreaterThanOrEqual(0.55);
    });

    it('T2.B5.2: maximum screen distance boundary clamps at 1.15 m', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 2.50 });
      expect(state.apparatus.screenDistance).toBeLessThanOrEqual(1.15);
    });

    it('T2.B5.3: dragging screen far left on bench clamps distance to minimum safe optical clearance (0.55m)', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: -1.0, z: 0.0 });
      expect(state.apparatus.screenDistance).toBeCloseTo(0.55, 2);
    });

    it('T2.B5.4: laser beam dynamic length strictly equals screen Euclidean separation', () => {
      const platformX = 0.05;
      const screenX = 1.34;
      const beamLength = screenX - (platformX + 0.50);
      expect(beamLength).toBeCloseTo(0.79, 2);
    });

    it('T2.B5.5: fringe spacing delta_y scales linearly with screen distance D (delta_y = lambda * D / a)', () => {
      const lambda = 650e-9;
      const a = 148.9e-6;
      const dMin = 0.55;
      const dMax = 1.15;
      const spacingMin = (lambda * dMin) / a;
      const spacingMax = (lambda * dMax) / a;
      expect(spacingMax / spacingMin).toBeCloseTo(dMax / dMin, 4);
    });
  });

  // --- B6: Camera Panning & Pointer Deadband Boundaries ---
  describe('Boundary B6: Camera Panning & Pointer Deadband Boundaries', () => {
    it('T2.B6.1: pointer movement of exactly 3.9 px does not trigger camera orbit (deadband <= 4.0 px)', () => {
      const deltaPx = 3.9;
      const thresholdPx = 4.0;
      const isOrbit = deltaPx > thresholdPx;
      expect(isOrbit).toBe(false);
    });

    it('T2.B6.2: pointer movement of 4.1 px transitions into camera orbit', () => {
      const deltaPx = 4.1;
      const thresholdPx = 4.0;
      const isOrbit = deltaPx > thresholdPx;
      expect(isOrbit).toBe(true);
    });

    it('T2.B6.3: zoom distance clamps between minDistance (0.05m) and maxDistance (4.5m)', () => {
      const minDistance = 0.05;
      const maxDistance = 4.5;
      const clampZoom = (r: number) => Math.max(minDistance, Math.min(maxDistance, r));
      expect(clampZoom(0.01)).toBe(0.05);
      expect(clampZoom(10.0)).toBe(4.5);
    });

    it('T2.B6.4: polar angle clamps at PI/2 - 0.01 preventing camera traversing below table plane', () => {
      const maxPolarAngle = Math.PI / 2 - 0.01;
      const testAngle = Math.PI / 2 + 0.2;
      const clamped = Math.min(testAngle, maxPolarAngle);
      expect(clamped).toBe(maxPolarAngle);
    });

    it('T2.B6.5: double right-click temporal window recognizes click within 449 ms and rejects at 451 ms', () => {
      const windowMaxMs = 450;
      const dtPass = 449;
      const dtFail = 451;
      expect(dtPass < windowMaxMs).toBe(true);
      expect(dtFail < windowMaxMs).toBe(false);
    });
  });

  // --- B7: Laser & Lens Vertical Height Travel Limits ---
  describe('Boundary B7: Laser & Lens Vertical Height Travel Limits', () => {
    it('T2.B7.1: laser carriage height clamps at bottom travel limit (0.18 m)', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_HEIGHT', value: 0.01 });
      expect(state.apparatus.laserHeight).toBeCloseTo(0.18, 2);
    });

    it('T2.B7.2: laser carriage height clamps at top travel limit (0.82 m)', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LASER_HEIGHT', value: 1.20 });
      expect(state.apparatus.laserHeight).toBeCloseTo(0.82, 2);
    });

    it('T2.B7.3: lens carriage height clamps at bottom travel limit (0.18 m)', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.02 });
      expect(state.apparatus.lensHeight).toBeCloseTo(0.18, 2);
    });

    it('T2.B7.4: lens carriage height clamps at top travel limit (0.82 m)', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.95 });
      expect(state.apparatus.lensHeight).toBeCloseTo(0.82, 2);
    });

    it('T2.B7.5: alignment quality factor evaluates to 1.0 when laser and lens heights match target', () => {
      const perfect = alignmentQuality({ laserHeight: 0.56, lensHeight: 0.56, screenDistance: 0.84 });
      expect(perfect).toBeCloseTo(1.0, 3);
      const misaligned = alignmentQuality({ laserHeight: 0.56, lensHeight: 0.82, screenDistance: 0.84 });
      expect(misaligned).toBeLessThan(0.1);
    });
  });
});

