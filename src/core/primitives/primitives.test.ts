import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  FastenerEntity,
  HingeEntity,
  SocketPort,
  Plug,
  LinearSliderEntity,
  RotaryDialEntity,
  CableConnection,
  FluidMediumContainer,
  createMeniscusGeometry,
} from './index';
import { IPHO_2024_E2_DEFINITION } from '../../experiments/ipho-2024-e2/definition';

describe('Universal Primitives - FluidMediumContainer', () => {
  it('instantiates an optical fluid container with default and custom configurations', () => {
    const cuvette = new FluidMediumContainer({
      id: 'cuvette-test',
      name: 'Test Optical Cuvette',
      width: 0.22,
      height: 0.26,
      depth: 0.22,
      wallThickness: 0.06,
      wallMaterialType: 'optical_acrylic',
      hasFeet: true,
      hasPeelFilm: true,
      hasLiquid: true,
      liquidColor: '#f43f5e',
      liquidIor: 1.332,
      hasMeniscus: true,
    });

    expect(cuvette.id).toBe('cuvette-test');
    expect(cuvette.name).toBe('Test Optical Cuvette');
    expect(cuvette.wallsMesh).toBeDefined();
    expect(cuvette.feetMeshes.length).toBe(4);
    expect(cuvette.peelFilmMesh).toBeDefined();
    expect(cuvette.liquidMesh).toBeDefined();
    expect(cuvette.meniscusMesh).toBeDefined();

    // Initial state: not peeled, not poured
    expect(cuvette.getIsPeeled()).toBe(false);
    expect(cuvette.getIsPoured()).toBe(false);
    expect(cuvette.peelFilmMesh?.visible).toBe(true);
    expect(cuvette.liquidMesh?.visible).toBe(false);
    expect(cuvette.meniscusMesh?.visible).toBe(false);
  });

  it('handles peeling of the protective film', () => {
    const container = new FluidMediumContainer({
      id: 'cuvette-peel',
      name: 'Peelable Cuvette',
      hasPeelFilm: true,
    });

    expect(container.getIsPeeled()).toBe(false);
    container.peel(true);
    expect(container.getIsPeeled()).toBe(true);
    expect(container.peelFilmMesh?.visible).toBe(false);

    // Toggle back
    container.setFilmPeeled(false, true);
    expect(container.getIsPeeled()).toBe(false);
    expect(container.peelFilmMesh?.visible).toBe(true);
  });

  it('handles liquid pouring and curved meniscus visibility', () => {
    const container = new FluidMediumContainer({
      id: 'cuvette-pour',
      name: 'Pourable Cuvette',
      hasLiquid: true,
      hasMeniscus: true,
    });

    expect(container.getIsPoured()).toBe(false);
    container.pour(0.75, true);
    expect(container.getIsPoured()).toBe(true);
    expect(container.getFillLevel()).toBe(0.75);
    expect(container.liquidMesh?.visible).toBe(true);
    expect(container.meniscusMesh?.visible).toBe(true);

    container.empty(true);
    expect(container.getIsPoured()).toBe(false);
    expect(container.getFillLevel()).toBe(0);
    expect(container.liquidMesh?.visible).toBe(false);
    expect(container.meniscusMesh?.visible).toBe(false);

    container.setLiquidPoured(true, true);
    expect(container.getIsPoured()).toBe(true);
    expect(container.liquidMesh?.visible).toBe(true);
  });

  it('generates 3D meniscus surface geometry with capillary action', () => {
    const geom = createMeniscusGeometry(0.19, 0.19, 16, 0.024, 0.011);
    expect(geom).toBeDefined();
    const pos = geom.attributes.position;
    expect(pos.count).toBeGreaterThan(0);

    // Vertex normals should be computed
    expect(geom.attributes.normal).toBeDefined();
    geom.dispose();
  });

  it('disposes of all resources cleanly', () => {
    const container = new FluidMediumContainer({
      id: 'cuvette-disp',
      name: 'Disposable Cuvette',
      hasPeelFilm: true,
      hasLiquid: true,
      hasMeniscus: true,
    });
    // Should not throw
    container.dispose();
  });
});

describe('Universal Primitives - SocketPort & Plug', () => {
  it('instantiates SocketPort with pin count and tolerance radius', () => {
    const socket = new SocketPort({
      id: 'stage-socket',
      name: 'Stage Mounting Socket',
      accepts: ['s1', 's2', 'cuvette'],
      position: [0, 0.16, 0],
      toleranceRadius: 0.04,
      pinCount: 4,
    });

    expect(socket.id).toBe('stage-socket');
    expect(socket.pinCount).toBe(4);
    expect(socket.isOccupied()).toBe(false);
    expect(socket.canAccept('s1')).toBe(true);
    expect(socket.canAccept('s2')).toBe(true);
    expect(socket.canAccept('cuvette')).toBe(true);
    expect(socket.canAccept('unknown')).toBe(false);
  });

  it('instantiates Plug and plugs into compatible SocketPort', () => {
    const socket = new SocketPort({
      id: 'test-port',
      name: 'Test Port',
      accepts: ['s1'],
      position: [0, 0, 0],
    });

    const plug = new Plug({
      id: 's1-holder',
      name: 'S1 Holder',
      type: 's1',
      pinCount: 4,
    });

    expect(plug.isPlugged()).toBe(false);
    expect(socket.acceptsPlug(plug)).toBe(true);

    const success = plug.plugInto(socket, true);
    expect(success).toBe(true);
    expect(plug.isPlugged()).toBe(true);
    expect(socket.isOccupied()).toBe(true);
    expect(socket.getOccupant()).toBe('s1-holder');
    expect(socket.getMountedPlug()).toBe(plug);

    // Unplug
    plug.unplug(true);
    expect(plug.isPlugged()).toBe(false);
    expect(socket.isOccupied()).toBe(false);
  });

  it('rejects plugs with incompatible types', () => {
    const socket = new SocketPort({
      id: 'test-port-2',
      name: 'Test Port 2',
      accepts: ['s1'],
      position: [0, 0, 0],
    });

    const wrongPlug = new Plug({
      id: 's2-holder',
      name: 'S2 Holder',
      type: 's2',
    });

    expect(socket.acceptsPlug(wrongPlug)).toBe(false);
    const success = wrongPlug.plugInto(socket, true);
    expect(success).toBe(false);
    expect(wrongPlug.isPlugged()).toBe(false);
  });

  it('performs snap distance calculation within tolerance', () => {
    const socket = new SocketPort({
      id: 'stage-snap',
      name: 'Snap Stage',
      accepts: ['s1'],
      position: [0, 0.5, 0],
      toleranceRadius: 0.1,
    });

    const nearPos = new THREE.Vector3(0.02, 0.52, 0.01);
    const farPos = new THREE.Vector3(1.0, 0.5, 0.0);

    const nearResult = socket.testSnap('s1', nearPos);
    expect(nearResult.canSnap).toBe(true);

    const farResult = socket.testSnap('s1', farPos);
    expect(farResult.canSnap).toBe(false);
  });
});

describe('Universal Primitives - Fastener, Hinge, Slider & Dial', () => {
  it('handles FastenerEntity threaded turning and tightening', () => {
    const fastener = new FastenerEntity({
      id: 'rod-1',
      name: 'Fastening Rod #1',
      type: 'threaded',
      position: [0, 0, 0],
      totalTurns: 3.0,
      pitchMm: 1.5,
    });

    expect(fastener.isTight()).toBe(true);
    expect(fastener.getTightness()).toBe(1.0);

    fastener.loosen(3.0);
    expect(fastener.isFree()).toBe(true);
    expect(fastener.getTightness()).toBe(0.0);

    fastener.reset();
    expect(fastener.isTight()).toBe(true);
  });

  it('handles HingeEntity angular limits and toggling', () => {
    const hinge = new HingeEntity({
      id: 'kit-lid',
      name: 'Kit Lid Hinge',
      axis: 'x',
      minAngleRad: 0,
      maxAngleRad: Math.PI * 0.62,
    });

    expect(hinge.isOpen()).toBe(false);
    expect(hinge.getAngleRad()).toBe(0);

    hinge.toggle();
    expect(hinge.isOpen()).toBe(true);
    expect(hinge.getAngleRad()).toBeCloseTo(Math.PI * 0.62, 2);
  });

  it('handles LinearSliderEntity translation and locking', () => {
    const slider = new LinearSliderEntity({
      id: 'laser-slider',
      name: 'Laser Height Slider',
      axis: 'y',
      minVal: 0.18,
      maxVal: 0.52,
      initialVal: 0.35,
    });

    expect(slider.getValue()).toBe(0.35);
    slider.setValue(0.42);
    expect(slider.getValue()).toBe(0.42);

    slider.setLocked(true);
    slider.setValue(0.50);
    expect(slider.getValue()).toBe(0.42); // Should not change when locked
  });

  it('handles RotaryDialEntity continuous rotation with gear ratio', () => {
    const dial = new RotaryDialEntity({
      id: 'goniometer',
      name: 'Goniometer Rotary Dial',
      minDeg: -80,
      maxDeg: 80,
      initialDeg: 0,
      gearRatio: 0.15,
    });

    expect(dial.getAngleDeg()).toBe(0);
    dial.rotateByDelta(100);
    expect(dial.getAngleDeg()).toBe(15);

    dial.setAngleDeg(45);
    expect(dial.getAngleDeg()).toBe(45);
  });

  it('handles CableConnection connectivity state', () => {
    const cable = new CableConnection({
      id: 'laser-cable',
      points: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
      initiallyConnected: false,
    });

    expect(cable.getConnected()).toBe(false);
    expect(cable.group.visible).toBe(false);

    cable.setConnected(true);
    expect(cable.getConnected()).toBe(true);
    expect(cable.group.visible).toBe(true);

    cable.dispose();
  });

  it('enforces travel limits and micrometric gear reduction on RotaryDialEntity', () => {
    const dial = new RotaryDialEntity({
      id: 'fine-dial',
      name: 'Fine Goniometer Knob',
      minDeg: -30,
      maxDeg: 30,
      initialDeg: 0,
      gearRatio: 0.1,
    });

    // Standard rotation: 100 px * 0.1 = 10 deg
    dial.rotateByDelta(100, false);
    expect(dial.getAngleDeg()).toBeCloseTo(10, 2);

    // Micrometric mode (Shift held): 5x finer (multiplier = 0.2)
    // 100 px * 0.1 * 0.2 = 2 deg -> total = 12 deg
    dial.rotateByDelta(100, true);
    expect(dial.getAngleDeg()).toBeCloseTo(12, 2);

    // Clamping to maxDeg
    dial.rotateByDelta(500, false);
    expect(dial.getAngleDeg()).toBe(30);

    // Clamping to minDeg
    dial.setAngleDeg(-50);
    expect(dial.getAngleDeg()).toBe(-30);
  });

  it('enforces FastenerEntity removal constraints based on tightness and type', () => {
    const rod = new FastenerEntity({
      id: 'tight-rod',
      name: 'Threaded Tight Rod',
      type: 'threaded',
      position: [0, 0, 0],
    });
    // Cannot remove while tight
    expect(rod.isTight()).toBe(true);
    expect(rod.remove()).toBe(false);
    expect(rod.group.visible).toBe(true);

    // Loosen fully -> can remove
    rod.loosen(3.0);
    expect(rod.isFree()).toBe(true);
    expect(rod.remove()).toBe(true);
    expect(rod.group.visible).toBe(false);

    // Elastic O-ring can be removed directly without turning
    const oring = new FastenerEntity({
      id: 'red-oring',
      name: 'Red O-Ring',
      type: 'elastic_oring',
      position: [0, 0, 0],
    });
    expect(oring.remove()).toBe(true);
    expect(oring.group.visible).toBe(false);
  });
});

describe('Declarative .pholab Manifest - IPhO 2024 E2', () => {
  it('complies with GUIDELINES.md manifest metadata and structure', () => {
    expect(IPHO_2024_E2_DEFINITION.formatVersion).toBe('2.0.0');
    expect(IPHO_2024_E2_DEFINITION.id).toBe('ipho-2024-e2');
    expect(IPHO_2024_E2_DEFINITION.olympiad).toBe('IPhO 2024');
    expect(IPHO_2024_E2_DEFINITION.area).toBe('Optics');
    expect(IPHO_2024_E2_DEFINITION.format).toBe('Experimental');
    expect(IPHO_2024_E2_DEFINITION.status).toBe('available');
    expect(IPHO_2024_E2_DEFINITION.durationMinutes).toBe(300);
  });

  it('defines topology for kit foam cutouts and workbench coordinates', () => {
    const { kitBox, foamCutouts, workbenchInitialCoordinates } = IPHO_2024_E2_DEFINITION.topology;
    expect(kitBox.dimensions).toEqual([1.46, 0.28, 1.28]);
    expect(kitBox.hingeAxis).toBe('x');

    expect(foamCutouts.platformCavity).toBeDefined();
    expect(foamCutouts.s1Cavity).toBeDefined();
    expect(foamCutouts.s2Cavity).toBeDefined();
    expect(foamCutouts.cuvetteCavity).toBeDefined();
    expect(foamCutouts.bottleCavity).toBeDefined();
    expect(foamCutouts.screenCavity).toBeDefined();
    expect(foamCutouts.electronicsCavity).toBeDefined();

    expect(workbenchInitialCoordinates.kit).toBeDefined();
    expect(workbenchInitialCoordinates.platform).toBeDefined();
    expect(workbenchInitialCoordinates.cuvette).toBeDefined();
  });

  it('defines universal equipment list including sockets, fasteners, knobs, displays, and containers', () => {
    const { sockets, fasteners, knobs, displays, containers, plugs } = IPHO_2024_E2_DEFINITION.equipment;

    expect(sockets.length).toBeGreaterThanOrEqual(2);
    expect(fasteners.length).toBeGreaterThanOrEqual(5);
    expect(knobs.length).toBeGreaterThanOrEqual(4);
    expect(displays.length).toBeGreaterThanOrEqual(1);
    expect(containers.length).toBeGreaterThanOrEqual(3);
    expect(plugs.length).toBeGreaterThanOrEqual(3);

    // Verify cuvette is properly declared as FluidMediumContainer
    const cuvette = containers.find((c) => c.id === 'cuvette');
    expect(cuvette?.primitive).toBe('FluidMediumContainer');
    expect(cuvette?.hasPeelFilm).toBe(true);
    expect(cuvette?.hasLiquid).toBe(true);

    // Verify stage sockets
    const slideSocket = sockets.find((s) => s.id === 'stage-slide-socket');
    expect(slideSocket?.primitive).toBe('SocketPort');
    expect(slideSocket?.accepts).toContain('s1');
    expect(slideSocket?.accepts).toContain('s2');
  });

  it('declares official nominal physics constants and hidden truth benchmarks', () => {
    const { nominalConstants, hiddenTruthBenchmarks } = IPHO_2024_E2_DEFINITION.physics;

    expect(nominalConstants.wavelengthNm).toBe(650);
    expect(nominalConstants.glassIndex).toBe(1.51);
    expect(nominalConstants.ambientIndex).toBe(1.00);

    // Hidden truth benchmarks from marking scheme
    expect(hiddenTruthBenchmarks.hiddenSlideThicknessS1Mm).toBe(0.1489);
    expect(hiddenTruthBenchmarks.hiddenSlideThicknessS2Mm).toBe(1.061);
    expect(hiddenTruthBenchmarks.hiddenLiquidIndexN).toBe(1.332);

    expect(hiddenTruthBenchmarks.markingSchemeSlopes.partA_B_S1).toBe(229.1);
    expect(hiddenTruthBenchmarks.markingSchemeSlopes.partB_B_S2).toBe(275.7);
    expect(hiddenTruthBenchmarks.markingSchemeSlopes.partC_B_Liquid).toBe(128.0);
  });

  it('supports three assembly modes: guided, realistic, skip', () => {
    expect(IPHO_2024_E2_DEFINITION.supportedAssemblyModes).toContain('guided');
    expect(IPHO_2024_E2_DEFINITION.supportedAssemblyModes).toContain('realistic');
    expect(IPHO_2024_E2_DEFINITION.supportedAssemblyModes).toContain('skip');

    const { assemblyModes } = IPHO_2024_E2_DEFINITION;
    expect(assemblyModes.guided.strictSequencing).toBe(false);
    expect(assemblyModes.realistic.strictSequencing).toBe(true);
    expect(assemblyModes.realistic.snapToleranceM).toBeLessThan(assemblyModes.guided.snapToleranceM);
  });
});
