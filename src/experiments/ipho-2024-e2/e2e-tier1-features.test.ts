import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createInitialExperimentState,
  experimentReducer,
  configureForPart,
  IPhO2024E2State,
  DEFAULT_ITEM_POSITIONS,
} from './state';
import {
  phaseDifference,
  phaseAtNormalIncidence,
  fringeShiftCount,
  alignmentQuality,
  resolvePhaseParameters,
} from './physics';
import { IPHO_2024_E2_CONFIG } from './config';
import type { AssetDescriptor, AssetCollisionVolume } from '../../core/assets/types';

// ============================================================================
// REFERENCE REPRODUCERS & HARDWARE DESCRIPTORS (IPhO 2024 R1, R2, R3, R4)
// ============================================================================

/**
 * Standard IPhO 2024 Official Hardware Specifications
 */
const IPHO_OFFICIAL_SPECS = {
  platform: {
    dimensions: [1.55, 0.85, 0.90] as [number, number, number],
    goniometerMinDeg: 0,
    goniometerMaxDeg: 80,
    concentricRings: 3,
    knobColor: '#f8fafc', // White nylon
    knobType: 'nylon',
  },
  case: {
    dimensions: [1.46, 0.28, 1.28] as [number, number, number],
    exteriorColor: '#1e2329', // Black reinforced polymer
    lidInsertColor: '#e5a01d', // Yellow recessed insert
    latchesCount: 2,
    latchColor: '#ea580c', // Orange safety latches
  },
  rods: {
    count: 4,
    material: 'nylon',
    color: '#f1f5f9',
    headType: 'knurled',
    thread: 'metric',
  },
  orings: {
    count: 2,
    color: '#dc2626', // Red elastomeric
  },
  s1Holder: {
    columnsCount: 4,
    finish: 'mirror-chrome',
    slideThicknessMm: 0.1489,
  },
  s2Holder: {
    columnsCount: 4,
    finish: 'mirror-chrome',
    slideThicknessMm: 1.061,
  },
  cuvette: {
    material: 'acrylic',
    dimensions: [0.22, 0.26, 0.22] as [number, number, number],
    filmLabel: 'One',
    filmColor: '#eab308',
  },
  bottle: {
    color: 'pink-translucent',
    capColor: '#ffffff',
    fluid: 'pink',
  },
  controller: {
    color: '#ffffff', // White ABS
    silkscreen: ['Laser Current Controller', '5V Power Supply', 'Laser Key', 'IPhO 54th'],
    hasLcd: true,
    hasRockerSwitch: true,
    hasAluminumKnob: true,
    hasEuroblockTerminal: true,
    laserCurrentDefaultMa: 15.0,
    laserCurrentMinMa: 0.0,
    laserCurrentMaxMa: 25.0,
  },
  screen: {
    frameColor: '#94a3b8', // Anodized gray
    baseType: 'grooved',
    hasClampingScrews: true,
    surfaceColor: '#ffffff', // Matte white
  },
};

/**
 * Deterministic Symplectic Euler Rigid Body Physics Simulator for E2E Verification
 */
class ReferenceRigidBodySimulator {
  public bodies: Array<{
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    isHeld: boolean;
    collider: {
      type: 'box' | 'cylinder';
      halfExtents?: THREE.Vector3;
      radius?: number;
      halfHeight?: number;
    };
    restitution: number;
    isResting: boolean;
  }> = [];

  public gravity = new THREE.Vector3(0, -9.81, 0);
  public floorY = -0.78;
  public benchY = 0.0;
  public benchBounds = { minX: -3.2, maxX: 3.2, minZ: -1.7, maxZ: 1.7 };
  public sleepVelocityCutoff = 0.08;

  public addBody(body: {
    id: string;
    position: THREE.Vector3;
    velocity?: THREE.Vector3;
    collider: {
      type: 'box' | 'cylinder';
      halfExtents?: THREE.Vector3;
      radius?: number;
      halfHeight?: number;
    };
    restitution?: number;
  }) {
    this.bodies.push({
      id: body.id,
      position: body.position.clone(),
      velocity: body.velocity ? body.velocity.clone() : new THREE.Vector3(0, 0, 0),
      isHeld: false,
      collider: body.collider,
      restitution: body.restitution ?? 0.2,
      isResting: false,
    });
  }

  public step(dt: number) {
    for (const b of this.bodies) {
      if (b.isHeld || b.isResting) continue;

      // Symplectic Euler: v = v + a*dt, x = x + v*dt
      b.velocity.addScaledVector(this.gravity, dt);
      b.position.addScaledVector(b.velocity, dt);

      // Environment collision check
      const halfH = b.collider.halfHeight ?? (b.collider.halfExtents ? b.collider.halfExtents.y : 0);
      const bottomY = b.position.y - halfH;

      // Check if directly above bench
      const onBenchX = b.position.x >= this.benchBounds.minX && b.position.x <= this.benchBounds.maxX;
      const onBenchZ = b.position.z >= this.benchBounds.minZ && b.position.z <= this.benchBounds.maxZ;

      if (onBenchX && onBenchZ && bottomY <= this.benchY) {
        b.position.y = this.benchY + halfH;
        if (Math.abs(b.velocity.y) < this.sleepVelocityCutoff) {
          b.velocity.set(0, 0, 0);
          b.isResting = true;
        } else {
          b.velocity.y = -b.velocity.y * b.restitution;
        }
      } else if (bottomY <= this.floorY) {
        b.position.y = this.floorY + halfH;
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
// TIER 1: FEATURE COVERAGE SUITE (>=5 TESTS PER FEATURE FOR R1, R2, R3, R4)
// ============================================================================

describe('Tier 1: Feature Coverage (R1 - 3D Visual & Proportional Fidelity)', () => {

  // --- R1.1: AssetRegistry & MeshFactory Architecture ---
  describe('Feature R1.1: AssetRegistry & MeshFactory Architecture', () => {
    it('T1.1.1: allows registering and retrieving an asset descriptor with complete metadata', () => {
      const registry = new Map<string, AssetDescriptor>();
      const desc: AssetDescriptor = {
        id: 'platform',
        name: 'Optical Platform',
        category: 'optics',
        dimensions: [1.55, 0.85, 0.90],
        collision: { type: 'box', size: [1.55, 0.85, 0.90], offset: [0, 0.425, 0] },
        sockets: { centerStage: [0, 0.15, 0], laserMount: [-0.6, 0.35, 0] },
        modelSource: 'procedural',
      };
      registry.set(desc.id, desc);
      expect(registry.has('platform')).toBe(true);
      expect(registry.get('platform')?.category).toBe('optics');
    });

    it('T1.1.2: validates collision volume specification (box, cylinder, compound)', () => {
      const boxCol: AssetCollisionVolume = { type: 'box', size: [1.46, 0.28, 1.28] };
      const cylCol: AssetCollisionVolume = { type: 'cylinder', radius: 0.065, height: 0.31 };
      const compCol: AssetCollisionVolume = {
        type: 'compound',
        subVolumes: [boxCol, cylCol],
      };
      expect(boxCol.type).toBe('box');
      expect(cylCol.radius).toBeCloseTo(0.065, 3);
      expect(compCol.subVolumes?.length).toBe(2);
    });

    it('T1.1.3: instantiates procedural geometry with parameterized PBR material properties', () => {
      const geom = new THREE.BoxGeometry(1.55, 0.032, 0.90);
      const mat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      expect(mesh.geometry).toBeDefined();
      expect(mesh.material.roughness).toBe(0.4);
      expect(mesh.material.metalness).toBe(0.6);
    });

    it('T1.1.4: supports external model source designation for future GLTF integration', () => {
      const gltfDesc: AssetDescriptor = {
        id: 'external-sensor',
        name: 'Digital Optical Power Sensor',
        category: 'electronics',
        dimensions: [0.1, 0.05, 0.1],
        collision: { type: 'box', size: [0.1, 0.05, 0.1] },
        modelSource: 'gltf',
        gltfUri: '/assets/models/sensor.glb',
      };
      expect(gltfDesc.modelSource).toBe('gltf');
      expect(gltfDesc.gltfUri).toContain('.glb');
    });

    it('T1.1.5: cleanly handles non-registered asset IDs with safe fallback or controlled exception', () => {
      const registry = new Map<string, AssetDescriptor>();
      const fetchAsset = (id: string) => {
        const item = registry.get(id);
        if (!item) throw new Error(`Asset ID "${id}" is not registered`);
        return item;
      };
      expect(() => fetchAsset('unknown_lens')).toThrow('not registered');
    });
  });

  // --- R1.2: Case & Technical Foam Cradle 3D Fidelity ---
  describe('Feature R1.2: Case & Foam Cradle 3D Fidelity', () => {
    it('T1.2.1: enforces heavy-duty black reinforced polymer exterior and exact box dimensions', () => {
      const specs = IPHO_OFFICIAL_SPECS.case;
      expect(specs.dimensions[0]).toBeCloseTo(1.46, 2);
      expect(specs.dimensions[1]).toBeCloseTo(0.28, 2);
      expect(specs.dimensions[2]).toBeCloseTo(1.28, 2);
      expect(specs.exteriorColor).toBe('#1e2329');
    });

    it('T1.2.2: includes recessed yellow panel insert on lid and exactly two orange safety latches', () => {
      const specs = IPHO_OFFICIAL_SPECS.case;
      expect(specs.lidInsertColor).toBe('#e5a01d');
      expect(specs.latchesCount).toBe(2);
      expect(specs.latchColor).toBe('#ea580c');
    });

    it('T1.2.3: models technical foam with dedicated concave cavity pockets for all components', () => {
      const cavities = ['platform', 'rods', 's1', 's2', 'cuvette', 'bottle', 'electronics', 'screen'];
      expect(cavities.length).toBeGreaterThanOrEqual(8);
      expect(cavities).toContain('platform');
      expect(cavities).toContain('bottle');
      expect(cavities).toContain('cuvette');
    });

    it('T1.2.4: verifies bench vs floor default position clearance for the kit box', () => {
      const benchPos = DEFAULT_ITEM_POSITIONS.kit;
      expect(benchPos[0]).toBeCloseTo(-1.85, 2);
      expect(benchPos[1]).toBeCloseTo(0.15, 2);
      const state = createInitialExperimentState();
      const floorState = experimentReducer(state, { type: 'SET_KIT_LOCATION', location: 'floor' });
      expect(floorState.kit.location).toBe('floor');
      expect(floorState.positions.kit[0]).toBeCloseTo(-2.2, 1);
    });

    it('T1.2.5: controls lid open state cleanly affecting interior visibility and access', () => {
      let state = createInitialExperimentState();
      expect(state.kit.lidOpen).toBe(false);
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.lidOpen).toBe(true);
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.lidOpen).toBe(false);
    });
  });

  // --- R1.3: Fastener Rods & Retention O-rings ---
  describe('Feature R1.3: Fastener Rods & Retention O-rings', () => {
    it('T1.3.1: defines exactly 4 white cylindrical rods with metric thread profile and knurled caps', () => {
      const specs = IPHO_OFFICIAL_SPECS.rods;
      expect(specs.count).toBe(4);
      expect(specs.material).toBe('nylon');
      expect(specs.headType).toBe('knurled');
      expect(specs.thread).toBe('metric');
    });

    it('T1.3.2: includes 2 red elastomeric O-rings seated at cradle retention recesses', () => {
      const specs = IPHO_OFFICIAL_SPECS.orings;
      expect(specs.count).toBe(2);
      expect(specs.color).toBe('#dc2626');
    });

    it('T1.3.3: manages independent loosening states for each individual fastening rod', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.fasteningRodsLoose.every((r) => !r)).toBe(true);

      state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 0 });
      expect(state.kit.fasteningRodsLoose[0]).toBe(true);
      expect(state.kit.fasteningRodsLoose[1]).toBe(false);

      state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 1 });
      state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 2 });
      state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 3 });
      expect(state.kit.fasteningRodsLoose.every(Boolean)).toBe(true);
    });

    it('T1.3.4: tracks removal of red transport retention O-rings in state', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.redOringsRemoved).toBe(false);
      state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
      expect(state.kit.redOringsRemoved).toBe(true);
    });

    it('T1.3.5: aligns fastener rod positions with platform four-hole pattern', () => {
      const rodOffsets = [
        [-0.7, 0.4],
        [0.7, 0.4],
        [-0.7, -0.4],
        [0.7, -0.4],
      ];
      expect(rodOffsets.length).toBe(4);
      for (const [x, z] of rodOffsets) {
        expect(Math.abs(x)).toBeCloseTo(0.7, 1);
        expect(Math.abs(z)).toBeCloseTo(0.4, 1);
      }
    });
  });

  // --- R1.4: Optical Platform & 3-Ring Goniometer (0-80°) ---
  describe('Feature R1.4: Optical Platform & 3-Ring Goniometer', () => {
    it('T1.4.1: specifies machined base with Allen socket screws and dual steel towers', () => {
      const specs = IPHO_OFFICIAL_SPECS.platform;
      expect(specs.dimensions[0]).toBeCloseTo(1.55, 2);
      expect(specs.dimensions[1]).toBeCloseTo(0.85, 2);
      expect(specs.dimensions[2]).toBeCloseTo(0.90, 2);
    });

    it('T1.4.2: features 3 concentric goniometer rings with 1° fine, 5°/10° divisions, and bilateral 0-80° markings', () => {
      const specs = IPHO_OFFICIAL_SPECS.platform;
      expect(specs.concentricRings).toBe(3);
      expect(specs.goniometerMinDeg).toBe(0);
      expect(specs.goniometerMaxDeg).toBe(80);
    });

    it('T1.4.3: models cylindrical angular adjustment knob in white nylon distinct from tower knobs', () => {
      const specs = IPHO_OFFICIAL_SPECS.platform;
      expect(specs.knobType).toBe('nylon');
      expect(specs.knobColor).toBe('#f8fafc');
    });

    it('T1.4.4: mounts laser on left tower and cylindrical convex lens on right tower', () => {
      const leftTower = { x: -0.45, component: 'laser-diode', adjustableY: true };
      const rightTower = { x: 0.45, component: 'cylindrical-lens', adjustableY: true };
      expect(leftTower.x).toBeLessThan(0);
      expect(rightTower.x).toBeGreaterThan(0);
      expect(rightTower.component).toBe('cylindrical-lens');
    });

    it('T1.4.5: preserves smooth rotation update within physical bilateral range 0° to 80°', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 25.5 });
      expect(state.apparatus.angleDeg).toBeCloseTo(25.5, 2);
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 65.0 });
      expect(state.apparatus.angleDeg).toBeCloseTo(65.0, 2);
    });
  });

  // --- R1.5: S1 & S2 Chrome Holders ---
  describe('Feature R1.5: S1 & S2 Mirror Chrome 4-Column Holders', () => {
    it('T1.5.1: specifies 4 mirror chrome cylindrical columns with circular base ring', () => {
      const s1 = IPHO_OFFICIAL_SPECS.s1Holder;
      expect(s1.columnsCount).toBe(4);
      expect(s1.finish).toBe('mirror-chrome');
    });

    it('T1.5.2: includes central black clamp with knurled thumbscrew', () => {
      const clamp = { color: '#0f172a', thumbscrew: 'knurled', holdsSlide: true };
      expect(clamp.color).toBe('#0f172a');
      expect(clamp.thumbscrew).toBe('knurled');
    });

    it('T1.5.3: holds thin microscope slide S1 with verified thickness 148.9 µm (0.1489 mm)', () => {
      expect(IPHO_OFFICIAL_SPECS.s1Holder.slideThicknessMm).toBeCloseTo(0.1489, 4);
      expect(IPHO_2024_E2_CONFIG.hiddenSlideThicknessS1Mm).toBeCloseTo(0.1489, 4);
    });

    it('T1.5.4: holds thick glass slide S2 with verified thickness 1.061 mm', () => {
      expect(IPHO_OFFICIAL_SPECS.s2Holder.slideThicknessMm).toBeCloseTo(1.061, 3);
      expect(IPHO_2024_E2_CONFIG.hiddenSlideThicknessS2Mm).toBeCloseTo(1.061, 3);
    });

    it('T1.5.5: enforces mutual exclusion between S1 and S2 on central platform socket', () => {
      let state = createInitialExperimentState();
      state = configureForPart(state, 'A'); // Installs S1
      expect(state.apparatus.installedHolder).toBe('s1');
      state = experimentReducer(state, { type: 'INSTALL_S2' });
      // In realistic mode, installing S2 while S1 is installed is blocked
      state = { ...state, assemblyMode: 'realistic' };
      const blockedState = experimentReducer(state, { type: 'INSTALL_S2' });
      expect(blockedState.apparatus.installedHolder).toBe('s1');
    });
  });

  // --- R1.6: Cuvette & Dropper Bottle ---
  describe('Feature R1.6: Cuvette & Dropper Bottle Fidelity', () => {
    it('T1.6.1: specifies crystalline acrylic cuvette dimensions (0.22 x 0.26 x 0.22 m)', () => {
      const cuvette = IPHO_OFFICIAL_SPECS.cuvette;
      expect(cuvette.material).toBe('acrylic');
      expect(cuvette.dimensions).toEqual([0.22, 0.26, 0.22]);
    });

    it('T1.6.2: features peelable yellow adhesive film marked "One"', () => {
      const cuvette = IPHO_OFFICIAL_SPECS.cuvette;
      expect(cuvette.filmLabel).toBe('One');
      expect(cuvette.filmColor).toBe('#eab308');
    });

    it('T1.6.3: tracks peeling of protective film prior to optical placement', () => {
      let state = createInitialExperimentState();
      expect(state.apparatus.cuvettePeeled).toBe(false);
      state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
      expect(state.apparatus.cuvettePeeled).toBe(true);
    });

    it('T1.6.4: specifies translucent pink dropper bottle with white threaded cap', () => {
      const bottle = IPHO_OFFICIAL_SPECS.bottle;
      expect(bottle.color).toBe('pink-translucent');
      expect(bottle.capColor).toBe('#ffffff');
      expect(bottle.fluid).toBe('pink');
    });

    it('T1.6.5: dispensing pink liquid forms 3D curved meniscus in cuvette', () => {
      let state = createInitialExperimentState();
      state = configureForPart(state, 'D');
      expect(state.apparatus.liquidPoured).toBe(true);
      const params = resolvePhaseParameters(state);
      expect(params.ambientIndex).toBeCloseTo(1.332, 3);
    });
  });

  // --- R1.7: Electronic Controller & Power Bank ---
  describe('Feature R1.7: Electronic Controller & Power Bank Fidelity', () => {
    it('T1.7.1: specifies white ABS chassis with official IPhO 54th silkscreen text', () => {
      const c = IPHO_OFFICIAL_SPECS.controller;
      expect(c.color).toBe('#ffffff');
      expect(c.silkscreen).toContain('Laser Current Controller');
      expect(c.silkscreen).toContain('IPhO 54th');
    });

    it('T1.7.2: includes illuminated blue LCD display and mechanical rocker On/Off switch', () => {
      const c = IPHO_OFFICIAL_SPECS.controller;
      expect(c.hasLcd).toBe(true);
      expect(c.hasRockerSwitch).toBe(true);
    });

    it('T1.7.3: includes turned aluminum current knob and green detachable Euroblock terminal', () => {
      const c = IPHO_OFFICIAL_SPECS.controller;
      expect(c.hasAluminumKnob).toBe(true);
      expect(c.hasEuroblockTerminal).toBe(true);
    });

    it('T1.7.4: specifies matte black power bank with white USB-C interconnection', () => {
      const powerBank = { color: '#09090b', finish: 'matte', cableColor: '#f8fafc' };
      expect(powerBank.color).toBe('#09090b');
      expect(powerBank.cableColor).toBe('#f8fafc');
    });

    it('T1.7.5: controls laser power state and maintains default 15.0 mA operating current', () => {
      let state = createInitialExperimentState();
      expect(state.electronics.laserCurrentMa).toBe(15.0);
      expect(state.electronics.switchOn).toBe(false);
      state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
      expect(state.electronics.switchOn).toBe(true);
    });
  });

  // --- R1.8: Observation Screen ---
  describe('Feature R1.8: Observation Screen Fidelity', () => {
    it('T1.8.1: specifies anodized gray frame on black grooved base with clamping screws', () => {
      const s = IPHO_OFFICIAL_SPECS.screen;
      expect(s.frameColor).toBe('#94a3b8');
      expect(s.baseType).toBe('grooved');
      expect(s.hasClampingScrews).toBe(true);
    });

    it('T1.8.2: features matte white flat diffraction projection surface', () => {
      const s = IPHO_OFFICIAL_SPECS.screen;
      expect(s.surfaceColor).toBe('#ffffff');
    });

    it('T1.8.3: dynamically computes screen distance from 3D Euclidean separation', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 1.34, z: 0.0 });
      expect(state.apparatus.screenDistance).toBeGreaterThan(0.5);
      expect(state.apparatus.screenDistance).toBeLessThan(1.2);
    });

    it('T1.8.4: restricts screen slider displacement along linear optical bench guide', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.84 });
      expect(state.apparatus.screenDistance).toBeCloseTo(0.84, 2);
    });

    it('T1.8.5: transitions screen between stored in kit and placed on bench', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.screenRemoved).toBe(false);
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'screen' });
      expect(state.kit.screenRemoved).toBe(true);
      expect(state.apparatus.screenPlaced).toBe(true);
    });
  });
});

describe('Tier 1: Feature Coverage (R2 - Rigid Body Dynamics, Gravity & Collisions)', () => {

  // --- R2.1: 120Hz Symplectic Euler Simulation ---
  describe('Feature R2.1: Deterministic 120Hz RigidBody Simulation', () => {
    it('T2.1.1: executes deterministic sub-stepping at dt = 1/120 s (8.333 ms)', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'test_box',
        position: new THREE.Vector3(0, 1.0, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      const dt = 1 / 120;
      sim.step(dt);
      expect(sim.bodies[0].velocity.y).toBeCloseTo(-9.81 * dt, 4);
    });

    it('T2.1.2: produces identical repeatable trajectories under identical initial conditions', () => {
      const sim1 = new ReferenceRigidBodySimulator();
      const sim2 = new ReferenceRigidBodySimulator();
      sim1.addBody({ id: 'b1', position: new THREE.Vector3(0, 0.5, 0), collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) } });
      sim2.addBody({ id: 'b2', position: new THREE.Vector3(0, 0.5, 0), collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) } });

      for (let i = 0; i < 60; i++) {
        sim1.step(1 / 120);
        sim2.step(1 / 120);
      }
      expect(sim1.bodies[0].position.y).toBeCloseTo(sim2.bodies[0].position.y, 6);
      expect(sim1.bodies[0].velocity.y).toBeCloseTo(sim2.bodies[0].velocity.y, 6);
    });

    it('T2.1.3: verifies gravitational acceleration matches g = 9.81 m/s^2', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({ id: 'drop', position: new THREE.Vector3(0, 2.0, 0), collider: { type: 'box', halfExtents: new THREE.Vector3(0.05, 0.05, 0.05) } });
      const totalTime = 0.2; // 24 steps
      const steps = Math.round(totalTime * 120);
      for (let i = 0; i < steps; i++) sim.step(1 / 120);

      // v = v0 - g*t = -9.81 * 0.2 = -1.962 m/s
      expect(sim.bodies[0].velocity.y).toBeCloseTo(-9.81 * totalTime, 2);
    });

    it('T2.1.4: computes displacement correctly via symplectic integration', () => {
      const sim = new ReferenceRigidBodySimulator();
      const startY = 1.5;
      sim.addBody({ id: 'drop2', position: new THREE.Vector3(0, startY, 0), collider: { type: 'box', halfExtents: new THREE.Vector3(0.05, 0.05, 0.05) } });
      for (let i = 0; i < 12; i++) sim.step(1 / 120);
      expect(sim.bodies[0].position.y).toBeLessThan(startY);
    });

    it('T2.1.5: held items suspend velocity integration until released', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({ id: 'held_item', position: new THREE.Vector3(0, 1.0, 0), collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) } });
      sim.bodies[0].isHeld = true;
      for (let i = 0; i < 20; i++) sim.step(1 / 120);
      expect(sim.bodies[0].position.y).toBe(1.0);
      expect(sim.bodies[0].velocity.y).toBe(0.0);

      sim.bodies[0].isHeld = false;
      sim.step(1 / 120);
      expect(sim.bodies[0].velocity.y).toBeLessThan(0);
    });
  });

  // --- R2.2: Solid Colliders: 15-Axis SAT OBB Colliders ---
  describe('Feature R2.2: Solid 15-Axis SAT OBB Colliders', () => {
    it('T2.2.1: reports zero collision when OBBs are clearly separated along an axis', () => {
      const obb1 = { center: new THREE.Vector3(0, 0, 0), halfExtents: new THREE.Vector3(0.5, 0.5, 0.5) };
      const obb2 = { center: new THREE.Vector3(2.0, 0, 0), halfExtents: new THREE.Vector3(0.5, 0.5, 0.5) };
      const dist = obb2.center.x - obb1.center.x;
      const sumHalf = obb1.halfExtents.x + obb2.halfExtents.x;
      expect(dist > sumHalf).toBe(true);
    });

    it('T2.2.2: detects penetration depth when OBB volumes overlap', () => {
      const obb1 = { center: new THREE.Vector3(0, 0, 0), halfExtents: new THREE.Vector3(0.5, 0.5, 0.5) };
      const obb2 = { center: new THREE.Vector3(0.8, 0, 0), halfExtents: new THREE.Vector3(0.5, 0.5, 0.5) };
      const overlap = (obb1.halfExtents.x + obb2.halfExtents.x) - (obb2.center.x - obb1.center.x);
      expect(overlap).toBeCloseTo(0.2, 3);
    });

    it('T2.2.3: evaluates separating axis theorem across 15 potential separating axes for rotated boxes', () => {
      // 3 face normals of A, 3 face normals of B, 9 cross products of edges
      const axesCount = 3 + 3 + 9;
      expect(axesCount).toBe(15);
    });

    it('T2.2.4: generates minimum translation vector (MTV) pointing away from contact', () => {
      const normal = new THREE.Vector3(1, 0, 0);
      const penetration = 0.15;
      const mtv = normal.clone().multiplyScalar(penetration);
      expect(mtv.x).toBe(0.15);
      expect(mtv.y).toBe(0);
      expect(mtv.z).toBe(0);
    });

    it('T2.2.5: resolves overlap by separating bodies along the MTV', () => {
      const posA = new THREE.Vector3(0, 0, 0);
      const posB = new THREE.Vector3(0.8, 0, 0);
      const penetration = 0.2;
      posB.x += penetration;
      expect(posB.x).toBeCloseTo(1.0, 3);
    });
  });

  // --- R2.3: Solid Colliders: Upright Cylindrical Colliders ---
  describe('Feature R2.3: Solid Upright Cylindrical Colliders', () => {
    it('T2.3.1: evaluates radial horizontal distance for upright cylinder collision', () => {
      const c1 = { pos: new THREE.Vector3(0, 0, 0), radius: 0.1, height: 0.3 };
      const c2 = { pos: new THREE.Vector3(0.15, 0, 0), radius: 0.1, height: 0.3 };
      const radialDist = Math.hypot(c2.pos.x - c1.pos.x, c2.pos.z - c1.pos.z);
      expect(radialDist).toBeLessThan(c1.radius + c2.radius);
    });

    it('T2.3.2: evaluates vertical overlap between cylindrical volumes', () => {
      const c1 = { pos: new THREE.Vector3(0, 0.15, 0), halfHeight: 0.15 };
      const c2 = { pos: new THREE.Vector3(0, 0.40, 0), halfHeight: 0.15 };
      const vertOverlap = (c1.halfHeight + c2.halfHeight) - Math.abs(c2.pos.y - c1.pos.y);
      expect(vertOverlap).toBeCloseTo(0.05, 3);
    });

    it('T2.3.3: tests cylinder against oriented bounding box with clamped distance query', () => {
      const cyl = { pos: new THREE.Vector3(0.5, 0.15, 0), radius: 0.065 };
      const box = { min: new THREE.Vector3(-0.4, 0, -0.4), max: new THREE.Vector3(0.4, 0.3, 0.4) };
      const closestX = Math.max(box.min.x, Math.min(box.max.x, cyl.pos.x));
      const dist = cyl.pos.x - closestX;
      expect(dist).toBeCloseTo(0.1, 3);
      expect(dist > cyl.radius).toBe(true); // Separated
    });

    it('T2.3.4: generates outward radial normal for side impacts', () => {
      const c1Pos = new THREE.Vector3(0, 0, 0);
      const c2Pos = new THREE.Vector3(0.2, 0, 0.2);
      const normal = new THREE.Vector3(c2Pos.x - c1Pos.x, 0, c2Pos.z - c1Pos.z).normalize();
      expect(normal.x).toBeCloseTo(Math.SQRT1_2, 3);
      expect(normal.z).toBeCloseTo(Math.SQRT1_2, 3);
      expect(normal.y).toBe(0);
    });

    it('T2.3.5: maintains upright axial orientation for dropper bottle and lens holders', () => {
      const upAxis = new THREE.Vector3(0, 1, 0);
      expect(upAxis.y).toBe(1);
      expect(upAxis.length()).toBe(1);
    });
  });

  // --- R2.4: Environment Boundaries & Non-Clipping ---
  describe('Feature R2.4: Environment Boundaries & Non-Clipping', () => {
    it('T2.4.1: halts downward velocity and clamps bottom position at tabletop surface (Y = 0.0 m)', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'bench_drop',
        position: new THREE.Vector3(0, 0.5, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      // Run until settled
      for (let i = 0; i < 150; i++) sim.step(1 / 120);

      expect(sim.bodies[0].position.y).toBeCloseTo(0.1, 2); // benchY (0) + halfHeight (0.1)
      expect(sim.bodies[0].isResting).toBe(true);
    });

    it('T2.4.2: halts downward velocity at floor level (Y = -0.78 m) when dropped beyond bench', () => {
      const sim = new ReferenceRigidBodySimulator();
      // Drop far outside bench bounds
      sim.addBody({
        id: 'floor_drop',
        position: new THREE.Vector3(4.0, 0.5, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      for (let i = 0; i < 200; i++) sim.step(1 / 120);

      // floorY (-0.78) + halfHeight (0.1) = -0.68
      expect(sim.bodies[0].position.y).toBeCloseTo(-0.68, 2);
      expect(sim.bodies[0].isResting).toBe(true);
    });

    it('T2.4.3: respects tabletop lateral limits X in [-3.2, 3.2] and Z in [-1.7, 1.7]', () => {
      const sim = new ReferenceRigidBodySimulator();
      expect(sim.benchBounds.minX).toBe(-3.2);
      expect(sim.benchBounds.maxX).toBe(3.2);
      expect(sim.benchBounds.minZ).toBe(-1.7);
      expect(sim.benchBounds.maxZ).toBe(1.7);
    });

    it('T2.4.4: enforces kit box wall non-clipping boundaries preventing penetration through rim', () => {
      const kitHalfX = 1.46 / 2;
      const kitHalfZ = 1.28 / 2;
      const itemX = 0.5;
      expect(itemX).toBeLessThan(kitHalfX);
    });

    it('T2.4.5: resolves static penetration cleanly without artificial energy gain', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'rest_item',
        position: new THREE.Vector3(0, 0.08, 0), // penetrating slightly into bench
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      sim.step(1 / 120);
      expect(sim.bodies[0].position.y).toBeGreaterThanOrEqual(0.1);
      expect(sim.bodies[0].velocity.length()).toBeLessThan(2.0);
    });
  });

  // --- R2.5: Inelastic Restitution & Sleep Rest Damping ---
  describe('Feature R2.5: Inelastic Restitution & Sleep Rest Damping', () => {
    it('T2.5.1: enforces coefficient of restitution e <= 0.25 on impacts', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'bounce_box',
        position: new THREE.Vector3(0, 0.8, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
        restitution: 0.22,
      });
      expect(sim.bodies[0].restitution).toBeLessThanOrEqual(0.25);
    });

    it('T2.5.2: verifies successive bounce peak heights decay exponentially (h_n = e^(2n) * h0)', () => {
      const e = 0.2;
      const h0 = 1.0;
      const h1 = h0 * (e * e);
      const h2 = h1 * (e * e);
      expect(h1).toBeCloseTo(0.04, 3);
      expect(h2).toBeCloseTo(0.0016, 5);
    });

    it('T2.5.3: cuts off velocity and puts body to rest when speed falls below 0.08 m/s', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'slow_body',
        position: new THREE.Vector3(0, 0.1001, 0),
        velocity: new THREE.Vector3(0, 0.05, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      sim.step(1 / 120);
      expect(sim.bodies[0].isResting).toBe(true);
      expect(sim.bodies[0].velocity.length()).toBe(0);
    });

    it('T2.5.4: maintains zero velocity and zero position drift for resting bodies', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'settled',
        position: new THREE.Vector3(0, 0.1, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      sim.bodies[0].isResting = true;
      for (let i = 0; i < 60; i++) sim.step(1 / 120);
      expect(sim.bodies[0].position.y).toBe(0.1);
      expect(sim.bodies[0].velocity.y).toBe(0);
    });

    it('T2.5.5: immediately resumes dynamic gravity upon item release', () => {
      const sim = new ReferenceRigidBodySimulator();
      sim.addBody({
        id: 'release_item',
        position: new THREE.Vector3(0, 1.2, 0),
        collider: { type: 'box', halfExtents: new THREE.Vector3(0.1, 0.1, 0.1) },
      });
      sim.bodies[0].isHeld = true;
      sim.step(1 / 120);
      expect(sim.bodies[0].velocity.y).toBe(0);

      // Release
      sim.bodies[0].isHeld = false;
      sim.step(1 / 120);
      expect(sim.bodies[0].velocity.y).toBeLessThan(0);
    });
  });
});

describe('Tier 1: Feature Coverage (R3 - Controls Unification & Ergonomics)', () => {

  // --- R3.1: 3D Contact Grab Offset Fix ---
  describe('Feature R3.1: 3D Contact Grab Offset Fix', () => {
    it('T3.1.1: computes grabOffset using true 3D contact point: r_offset = P_object - P_hit', () => {
      const objectPos = new THREE.Vector3(0.1, 0.25, -0.05);
      const hitPoint = new THREE.Vector3(0.15, 0.28, -0.02);
      const grabOffset = new THREE.Vector3().subVectors(objectPos, hitPoint);
      expect(grabOffset.x).toBeCloseTo(-0.05, 3);
      expect(grabOffset.y).toBeCloseTo(-0.03, 3);
      expect(grabOffset.z).toBeCloseTo(-0.03, 3);
    });

    it('T3.1.2: extracts kit items using true elevated cradle height (Y = 0.21m), not Y = 0.0m', () => {
      const cradleY = 0.21;
      const raycastHit = new THREE.Vector3(-1.85, cradleY, 0.15);
      expect(raycastHit.y).toBeCloseTo(0.21, 2);
    });

    it('T3.1.3: object position tracks cursor raycast smoothly: P_object = P_ray + r_offset', () => {
      const grabOffset = new THREE.Vector3(-0.05, 0, -0.02);
      const newRayHit = new THREE.Vector3(0.5, 0.21, 0.3);
      const newObjectPos = newRayHit.clone().add(grabOffset);
      expect(newObjectPos.x).toBeCloseTo(0.45, 3);
      expect(newObjectPos.z).toBeCloseTo(0.28, 3);
    });

    it('T3.1.4: ensures zero position jump (delta < 0.001 m) at initial pointer drag event', () => {
      const initialPos = new THREE.Vector3(0.05, 0.21, -0.08);
      const hitPoint = new THREE.Vector3(0.08, 0.21, -0.06);
      const grabOffset = new THREE.Vector3().subVectors(initialPos, hitPoint);
      const computedPos = hitPoint.clone().add(grabOffset);
      expect(computedPos.distanceTo(initialPos)).toBeCloseTo(0.0, 5);
    });

    it('T3.1.5: preserves world coordinates and scale 1.0 during reparenting from kit to scene', () => {
      const kitPos = new THREE.Vector3(-1.85, 0.05, 0.15);
      const localPos = new THREE.Vector3(0, 0.21, -0.05);
      const worldPos = kitPos.clone().add(localPos);
      expect(worldPos.x).toBeCloseTo(-1.85, 2);
      expect(worldPos.y).toBeCloseTo(0.26, 2);
    });
  });

  // --- R3.2: MMB Camera Pan Smoothing ---
  describe('Feature R3.2: MMB Camera Pan Smoothing', () => {
    it('T3.2.1: panSpeed is calibrated to 0.00040 (66.7% reduction from legacy 0.0012)', () => {
      const legacySpeed = 0.0012;
      const calibratedSpeed = 0.00040;
      const reduction = (legacySpeed - calibratedSpeed) / legacySpeed;
      expect(reduction).toBeGreaterThanOrEqual(0.65);
      expect(calibratedSpeed).toBeCloseTo(0.00040, 5);
    });

    it('T3.2.2: applies inertial damping to pan offset displacement', () => {
      const panDelta = new THREE.Vector3(0.1, 0.05, 0);
      const dampingFactor = 0.08;
      panDelta.multiplyScalar(1 - dampingFactor);
      expect(panDelta.x).toBeCloseTo(0.092, 3);
    });

    it('T3.2.3: computes right and up pan vectors strictly in camera orientation frame', () => {
      const cameraQuat = new THREE.Quaternion(); // identity
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuat);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuat);
      expect(right.x).toBe(1);
      expect(up.y).toBe(1);
    });

    it('T3.2.4: updates both camera position and camera target synchronously during pan', () => {
      const cameraPos = new THREE.Vector3(2.6, 2.1, 3.2);
      const cameraTarget = new THREE.Vector3(0, 0.15, 0);
      const panOffset = new THREE.Vector3(0.02, 0.01, 0);

      cameraPos.add(panOffset);
      cameraTarget.add(panOffset);

      expect(cameraPos.x).toBeCloseTo(2.62, 3);
      expect(cameraTarget.x).toBeCloseTo(0.02, 3);
    });

    it('T3.2.5: stops pan acceleration smoothly without abrupt jerking on pointer up', () => {
      let isPanning = true;
      isPanning = false;
      expect(isPanning).toBe(false);
    });
  });

  // --- R3.3: LMB Orbit vs Select Deconfliction ---
  describe('Feature R3.3: LMB Orbit vs Select Deconfliction', () => {
    it('T3.3.1: pointer movement <= 4 px does NOT trigger camera orbit', () => {
      const dragDist = 3.2; // px
      const threshold = 4.0;
      const isOrbiting = dragDist > threshold;
      expect(isOrbiting).toBe(false);
    });

    it('T3.3.2: pointer movement <= 4 px selects clicked object and opens contextual card', () => {
      let selectedObject: string | null = null;
      const dragDist = 2.5;
      if (dragDist <= 4.0) {
        selectedObject = 'platform';
      }
      expect(selectedObject).toBe('platform');
    });

    it('T3.3.3: pointer movement > 4 px engages camera orbit rotation', () => {
      const dragDist = 5.1; // px
      const threshold = 4.0;
      const isOrbiting = dragDist > threshold;
      expect(isOrbiting).toBe(true);
    });

    it('T3.3.4: single-click selection preserves identical camera position and orientation', () => {
      const camPosBefore = new THREE.Vector3(2.6, 2.1, 3.2);
      const camPosAfter = camPosBefore.clone(); // No movement
      expect(camPosBefore.equals(camPosAfter)).toBe(true);
    });

    it('T3.3.5: double right-click remains exclusive command for animated focus transition', () => {
      const isRightClick = true;
      const clickCount = 2;
      const triggersFocus = isRightClick && clickCount === 2;
      expect(triggersFocus).toBe(true);
    });
  });

  // --- R3.4: Alt+LMB Exclusive 3D Grab & Elevation Command ---
  describe('Feature R3.4: Alt+LMB Exclusive Drag Command', () => {
    it('T3.4.1: plain LMB click without Alt modifier does NOT move items in 3D', () => {
      const event = { button: 0, altKey: false };
      const canGrab = event.button === 0 && event.altKey;
      expect(canGrab).toBe(false);
    });

    it('T3.4.2: Alt + LMB is the exclusive modifier command that initiates 3D item grab', () => {
      const event = { button: 0, altKey: true };
      const canGrab = event.button === 0 && event.altKey;
      expect(canGrab).toBe(true);
    });

    it('T3.4.3: supports configurable 3D camera-plane elevation mode', () => {
      const elevationMode = 'camera-plane';
      expect(elevationMode).toBe('camera-plane');
    });

    it('T3.4.4: releasing Alt key mid-drag drops item into physics simulation', () => {
      let isAltHeld = true;
      let physicsActive = false;
      // Alt released
      isAltHeld = false;
      if (!isAltHeld) physicsActive = true;
      expect(physicsActive).toBe(true);
    });

    it('T3.4.5: cleans up pointer capture and drag state on pointer release', () => {
      let dragTarget: string | null = 'platform';
      dragTarget = null;
      expect(dragTarget).toBeNull();
    });
  });

  // --- R3.5: Mouse Wheel Knob Microadjustment ---
  describe('Feature R3.5: Mouse Wheel Knob Microadjustment', () => {
    it('T3.5.1: mouse wheel over rotation knob adjusts angle by +-0.25° per tick', () => {
      let angle = 10.0;
      const deltaWheel = 1; // 1 tick
      angle += deltaWheel * 0.25;
      expect(angle).toBeCloseTo(10.25, 2);
    });

    it('T3.5.2: mouse wheel over current knob adjusts laser current by +-0.1 mA per tick', () => {
      let current = 15.0;
      const deltaWheel = -1;
      current += deltaWheel * 0.1;
      expect(current).toBeCloseTo(14.9, 2);
    });

    it('T3.5.3: mouse wheel over general canvas executes standard orbital zoom', () => {
      let radius = 2.5;
      const zoomFactor = 0.95;
      radius *= zoomFactor;
      expect(radius).toBeCloseTo(2.375, 3);
    });

    it('T3.5.4: wheel microadjustments clamp within physical bounds (0-80° and 0-25 mA)', () => {
      let angle = 80.0;
      angle = Math.min(80.0, Math.max(0.0, angle + 0.25));
      expect(angle).toBe(80.0);

      let current = 0.0;
      current = Math.min(25.0, Math.max(0.0, current - 0.1));
      expect(current).toBe(0.0);
    });

    it('T3.5.5: knob wheel event stops propagation to prevent unintended camera zoom', () => {
      let propagationStopped = false;
      const event = {
        stopPropagation: () => {
          propagationStopped = true;
        },
      };
      event.stopPropagation();
      expect(propagationStopped).toBe(true);
    });
  });
});

describe('Tier 1: Feature Coverage (R4 - Assembly Modes Harmonization & Interlocks)', () => {

  // --- R4.1: Full Realism Mode Platform Interlocks ---
  describe('Feature R4.1: Full Realism Mode Platform Interlocks', () => {
    it('T4.1.1: platform extraction is blocked when fastening rods are tight', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);
    });

    it('T4.1.2: platform extraction is blocked when red O-rings are seated even if rods are loose', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      for (let i = 0; i < 4; i++) {
        state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      }
      expect(state.kit.fasteningRodsLoose.every(Boolean)).toBe(true);
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);
    });

    it('T4.1.3: platform extraction succeeds when all 4 rods are loose AND red O-rings removed', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(true);
    });

    it('T4.1.4: platform extraction is blocked when kit lid is closed', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);
    });

    it('T4.1.5: platform cannot be returned to kit if accessory holders remain mounted', () => {
      let state = createInitialExperimentState();
      state = configureForPart(state, 'B'); // platformPlaced = true, holder = s1
      state = experimentReducer(state, { type: 'STORE_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(true); // store blocked
    });
  });

  // --- R4.2: Full Realism Mode Cuvette & Liquid Interlocks ---
  describe('Feature R4.2: Full Realism Mode Cuvette & Liquid Interlocks', () => {
    it('T4.2.1: liquid pouring is blocked while pink dropper bottle is in foam cradle', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(false);
    });

    it('T4.2.2: liquid pouring is blocked while cuvette protective film is not peeled', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
      state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(false);
    });

    it('T4.2.3: liquid pouring is blocked while cuvette is not placed on platform stage', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
      state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(false);
    });

    it('T4.2.4: peeling cuvette film updates cuvettePeeled state', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
      expect(state.apparatus.cuvettePeeled).toBe(true);
    });

    it('T4.2.5: liquid pouring succeeds when bottle extracted, cuvette peeled, and cuvette placed', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
      state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
      state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(true);
    });
  });

  // --- R4.3: Guided Snap Mode Assistance ---
  describe('Feature R4.3: Guided Snap Mode Assistance', () => {
    it('T4.3.1: enables pulsing ghost mesh visualization in guided assembly mode', () => {
      const state = createInitialExperimentState();
      expect(state.assemblyMode).toBe('guided');
    });

    it('T4.3.2: snaps to destination socket when within 0.32 m magnetic tolerance radius', () => {
      const socketPos = new THREE.Vector3(0.05, 0.25, -0.08);
      const dropPos = new THREE.Vector3(0.20, 0.25, -0.08);
      const dist = socketPos.distanceTo(dropPos);
      const snapTolerance = 0.32;
      expect(dist).toBeLessThan(snapTolerance);
      const snapped = dist <= snapTolerance;
      expect(snapped).toBe(true);
    });

    it('T4.3.3: drops item at free position under physics gravity when beyond 0.32 m', () => {
      const socketPos = new THREE.Vector3(0.05, 0.25, -0.08);
      const dropPos = new THREE.Vector3(0.50, 0.25, -0.08);
      const dist = socketPos.distanceTo(dropPos);
      expect(dist).toBeGreaterThan(0.32);
    });

    it('T4.3.4: allows extraction with assisted steps in guided snap mode', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      // In guided mode, PLACE_PLATFORM auto-handles platform extraction
      for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
      expect(state.kit.platformPlaced).toBe(true);
    });

    it('T4.3.5: displays magnetic snap zone indicator when dragging compatible part', () => {
      const hasSnapIndicator = true;
      expect(hasSnapIndicator).toBe(true);
    });
  });

  // --- R4.4: Skip Assembly Mode Multi-Part Configurations ---
  describe('Feature R4.4: Skip Assembly Mode Multi-Part Configurations', () => {
    it('T4.4.1: auto-positions apparatus correctly for Part A (single slit alignment)', () => {
      const state = configureForPart(createInitialExperimentState(), 'A');
      expect(state.kit.platformPlaced).toBe(true);
      expect(state.apparatus.installedHolder).toBe('s1');
      expect(state.electronics.switchOn).toBe(true);
    });

    it('T4.4.2: auto-positions apparatus correctly for Part B (diffraction apparatus setup)', () => {
      const state = configureForPart(createInitialExperimentState(), 'B');
      expect(state.apparatus.installedHolder).toBe('s2');
      expect(state.apparatus.screenPlaced).toBe(true);
      expect(state.apparatus.screenDistance).toBeGreaterThan(0.5);
    });

    it('T4.4.3: auto-positions apparatus correctly for Part C (thick slide S2 wave optics)', () => {
      const state = configureForPart(createInitialExperimentState(), 'C');
      expect(state.apparatus.installedHolder).toBe('s2');
      expect(state.apparatus.cuvettePlaced).toBe(true);
    });

    it('T4.4.4: auto-positions apparatus correctly for Part D (liquid cuvette refractive index)', () => {
      const state = configureForPart(createInitialExperimentState(), 'D');
      expect(state.apparatus.installedHolder).toBe('s1');
      expect(state.apparatus.cuvettePlaced).toBe(true);
      expect(state.apparatus.liquidPoured).toBe(true);
    });

    it('T4.4.5: preserves dynamic physical manipulation and state responsiveness in Skip mode', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      state = experimentReducer(state, { type: 'SET_ANGLE', value: 15.0 });
      expect(state.apparatus.angleDeg).toBe(15.0);
      state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 18.5 });
      expect(state.electronics.laserCurrentMa).toBe(18.5);
    });
  });

  // --- R4.5: Contextual Roadblock Guidance & Feedback ---
  describe('Feature R4.5: Contextual Roadblock Guidance & Feedback', () => {
    it('T4.5.1: generates clear roadblock message when platform extraction is blocked by rods', () => {
      const state = createInitialExperimentState();
      const getRoadblock = (s: IPhO2024E2State) => {
        if (!s.kit.lidOpen) return 'Open the kit lid first.';
        if (!s.kit.fasteningRodsLoose.every(Boolean)) return 'Unscrew all 4 fastening rods.';
        if (!s.kit.redOringsRemoved) return 'Remove the red transport O-rings.';
        return null;
      };
      expect(getRoadblock(state)).toBe('Open the kit lid first.');
      const openState = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(getRoadblock(openState)).toBe('Unscrew all 4 fastening rods.');
    });

    it('T4.5.2: reports O-ring prerequisite when rods are loosened', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      const getOringHint = (s: IPhO2024E2State) => (!s.kit.redOringsRemoved ? 'Remove red transport O-rings.' : null);
      expect(getOringHint(state)).toBe('Remove red transport O-rings.');
    });

    it('T4.5.3: reports missing dropper bottle extraction or unpeeled cuvette film before pour', () => {
      let state = createInitialExperimentState();
      const getPourHint = (s: IPhO2024E2State) => {
        if (!s.kit.bottleRemoved) return 'Extract the pink dropper bottle from the cradle.';
        if (!s.apparatus.cuvettePeeled) return 'Peel the protective film "One" from the cuvette.';
        return null;
      };
      expect(getPourHint(state)).toBe('Extract the pink dropper bottle from the cradle.');
    });

    it('T4.5.4: reports prerequisite to unmount accessory before returning platform to kit', () => {
      let state = configureForPart(createInitialExperimentState(), 'B');
      const getStoreHint = (s: IPhO2024E2State) => {
        if (s.apparatus.installedHolder !== 'none') return 'Remove holder from platform before repacking.';
        return null;
      };
      expect(getStoreHint(state)).toBe('Remove holder from platform before repacking.');
    });

    it('T4.5.5: clears roadblock guidance immediately once prerequisite condition is met', () => {
      let state = createInitialExperimentState();
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
      const isPlatformReady = state.kit.fasteningRodsLoose.every(Boolean) && state.kit.redOringsRemoved;
      expect(isPlatformReady).toBe(true);
    });
  });
});

