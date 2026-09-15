/**
 * PhOLab 2.0 - High-Fidelity Procedural Mesh Factory
 * 
 * Implements IMeshFactory to generate authentic 3D procedural Three.js models
 * with exact visual and mechanical fidelity to official IPhO 2024 competition
 * photographs (Figures 1-4, 8) and R1 specifications.
 */

import * as THREE from 'three';
import { AssetDescriptor, IMeshFactory, MeshCreationParams } from './types';
import {
  createGoniometerTexture,
  createSilkscreenTexture,
  createThreadBumpTexture,
  createKnurlBumpTexture,
  createBrushedMetalTexture,
  createCuvettePeelTexture,
} from './textures';

// Helper for standard PBR material
function pbrMaterial(
  color: string | number,
  roughness = 0.5,
  metalness = 0.1,
  extra?: Partial<THREE.MeshStandardMaterialParameters>
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
}

// Helper for textured standard material omitting undefined textures
function texturedMaterial(
  baseParams: THREE.MeshStandardMaterialParameters,
  map?: THREE.Texture,
  bumpMap?: THREE.Texture,
  bumpScale?: number
): THREE.MeshStandardMaterial {
  const params: THREE.MeshStandardMaterialParameters = { ...baseParams };
  if (map) params.map = map;
  if (bumpMap) {
    params.bumpMap = bumpMap;
    if (bumpScale !== undefined) params.bumpScale = bumpScale;
  }
  return new THREE.MeshStandardMaterial(params);
}

// Helper for basic mesh construction
function createSubMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos?: [number, number, number],
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  return m;
}

// Helper to create countersunk Allen socket head cap screw
function createAllenScrew(headRadius = 0.009, headHeight = 0.008, hexRadius = 0.005): THREE.Group {
  const screwGroup = new THREE.Group();
  // Cylindrical head
  const headGeom = new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 16);
  const headMat = pbrMaterial('#1e293b', 0.4, 0.7);
  const head = createSubMesh(headGeom, headMat, [0, headHeight / 2, 0]);

  // Recessed 6-sided hexagonal Allen socket pocket
  const hexGeom = new THREE.CylinderGeometry(hexRadius, hexRadius, headHeight * 0.55, 6);
  const hexMat = pbrMaterial('#090d12', 0.8, 0.2);
  const hex = createSubMesh(hexGeom, hexMat, [0, headHeight * 0.75, 0], false, false);

  screwGroup.add(head, hex);
  return screwGroup;
}

export class MeshFactory implements IMeshFactory {
  // Cached shared textures
  private goniometerTexture?: THREE.CanvasTexture;
  private silkscreenTexture?: THREE.CanvasTexture;
  private threadBumpTexture?: THREE.CanvasTexture;
  private knurlBumpTexture?: THREE.CanvasTexture;
  private brushedMetalTexture?: THREE.CanvasTexture;
  private cuvettePeelTexture?: THREE.CanvasTexture;

  constructor() {
    this.initTextures();
  }

  private initTextures(): void {
    if (typeof document !== 'undefined') {
      this.goniometerTexture = createGoniometerTexture();
      this.silkscreenTexture = createSilkscreenTexture();
      this.threadBumpTexture = createThreadBumpTexture();
      this.knurlBumpTexture = createKnurlBumpTexture();
      this.brushedMetalTexture = createBrushedMetalTexture();
      this.cuvettePeelTexture = createCuvettePeelTexture();
    }
  }

  /**
   * Main dispatch method conforming to IMeshFactory.
   */
  public createMesh(descriptor: AssetDescriptor, params?: MeshCreationParams): THREE.Object3D {
    let root: THREE.Object3D;

    switch (descriptor.id) {
      case 'kit_case':
      case 'kit':
        root = this.createKitCase(params);
        break;

      case 'fastening_rod':
      case 'fastener_rod':
        root = this.createFastenerRod(params);
        break;

      case 'red_oring':
      case 'retention_oring':
        root = this.createRedOring(params);
        break;

      case 'optical_platform':
      case 'platform':
        root = this.createOpticalPlatform(params);
        break;

      case 'holder_s1':
      case 's1_holder':
        root = this.createS1Holder(params);
        break;

      case 'holder_s2':
      case 's2_holder':
        root = this.createS2Holder(params);
        break;

      case 'optical_cuvette':
      case 'cuvette':
        root = this.createOpticalCuvette(params);
        break;

      case 'dropper_bottle':
      case 'bottle':
        root = this.createDropperBottle(params);
        break;

      case 'electronic_controller':
      case 'electronics':
        root = this.createElectronicController(params);
        break;

      case 'power_bank':
        root = this.createPowerBank(params);
        break;

      case 'observation_screen':
      case 'screen':
        root = this.createObservationScreen(params);
        break;

      default:
        // Generic fallback bounding box representation
        root = this.createFallbackMesh(descriptor, params);
        break;
    }

    root.name = descriptor.id;
    if (params?.interactiveId) {
      root.userData.interactionId = params.interactiveId;
    }
    if (params?.userData) {
      Object.assign(root.userData, params.userData);
    }
    if (params?.scale) {
      root.scale.setScalar(params.scale);
    }

    return root;
  }

  // =========================================================================
  // 1. Case & Technical Foam Cradle (Caixa de Transporte & Berço Técnico)
  // =========================================================================
  public createKitCase(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'kit_case';

    const caseW = 1.46;
    const caseH = 0.28;
    const caseD = 1.28;

    // Outer shell: Black reinforced polymer (#18181b)
    const shellMat = pbrMaterial('#18181b', 0.58, 0.22);
    const bottomShell = createSubMesh(new THREE.BoxGeometry(caseW, caseH, caseD), shellMat, [0, caseH / 2, 0]);
    group.add(bottomShell);

    // Exterior molded stiffening ribs & corner bumpers
    const ribMat = pbrMaterial('#0f172a', 0.65, 0.3);
    // Lateral ribs
    [-caseW / 2 + 0.02, caseW / 2 - 0.02].forEach((rx) => {
      const rib = createSubMesh(new THREE.BoxGeometry(0.03, caseH * 0.85, caseD * 0.94), ribMat, [rx, caseH / 2, 0]);
      group.add(rib);
    });
    // Front/rear ribs
    [-caseD / 2 + 0.02, caseD / 2 - 0.02].forEach((rz) => {
      const rib = createSubMesh(new THREE.BoxGeometry(caseW * 0.94, caseH * 0.85, 0.03), ribMat, [0, caseH / 2, rz]);
      group.add(rib);
    });

    // Ergonomic heavy-duty carry handle on front
    const handleGroup = new THREE.Group();
    const handleMat = pbrMaterial('#090d12', 0.45, 0.4);
    const handleBar = createSubMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 16), handleMat, [0, caseH * 0.5, caseD / 2 + 0.07]);
    handleBar.rotation.z = Math.PI / 2;
    const handleStems = [-0.16, 0.16].map((hx) =>
      createSubMesh(new THREE.BoxGeometry(0.025, 0.035, 0.07), handleMat, [hx, caseH * 0.5, caseD / 2 + 0.035])
    );
    handleGroup.add(handleBar, ...handleStems);
    group.add(handleGroup);

    // Two Safety Orange Front Draw Latches (#ea580c) strictly per R1 & Fig. 1
    const latchColor = '#ea580c';
    const latchMat = pbrMaterial(latchColor, 0.38, 0.15);
    const latchPinMat = pbrMaterial('#cbd5e1', 0.25, 0.88);

    [-0.38, 0.38].forEach((lx) => {
      const latchGroup = new THREE.Group();
      latchGroup.name = 'orange_front_latch';

      // Base bracket mounted to lower case
      const baseBracket = createSubMesh(new THREE.BoxGeometry(0.065, 0.08, 0.02), latchMat, [lx, caseH * 0.65, caseD / 2 + 0.01]);
      // Pivoting clamp lever
      const lever = createSubMesh(new THREE.BoxGeometry(0.055, 0.09, 0.018), latchMat, [lx, caseH * 0.72, caseD / 2 + 0.022]);
      // Metal wire clasp
      const wireLoop = createSubMesh(new THREE.TorusGeometry(0.025, 0.004, 8, 24), latchPinMat, [lx, caseH * 0.85, caseD / 2 + 0.015]);
      wireLoop.rotation.x = Math.PI / 2;

      latchGroup.add(baseBracket, lever, wireLoop);
      group.add(latchGroup);
    });

    // Technical Foam Cradle (High-density black EVA foam #121518)
    const foamW = 1.40;
    const foamH = 0.23;
    const foamD = 1.22;
    const foamMat = pbrMaterial('#121518', 0.95, 0.05);
    const foamBody = createSubMesh(new THREE.BoxGeometry(foamW, foamH, foamD), foamMat, [0, foamH / 2 + 0.025, 0]);
    group.add(foamBody);

    // True Concave 1:1 Cavities with dark recessed floors and lead-in rims
    const cavityFloorMat = pbrMaterial('#06080a', 0.98, 0.02);
    const cavityRimMat = pbrMaterial('#1e242b', 0.9, 0.08);

    const cavities: {
      name: string;
      geom: THREE.BufferGeometry;
      rimGeom: THREE.BufferGeometry;
      pos: [number, number, number];
    }[] = [
      // 1. Central Optical Platform cavity (1:1 scale: 1.18m x 0.08m x 0.74m)
      {
        name: 'platform_cavity',
        geom: new THREE.BoxGeometry(1.18, 0.08, 0.74),
        rimGeom: new THREE.BoxGeometry(1.20, 0.01, 0.76),
        pos: [0, 0.21, -0.05],
      },
      // 2. S1 Holder cylindrical cavity (1:1 scale)
      {
        name: 's1_cavity',
        geom: new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24),
        rimGeom: new THREE.CylinderGeometry(0.15, 0.15, 0.01, 24),
        pos: [-0.44, 0.21, 0.42],
      },
      // 3. S2 Holder cylindrical cavity (1:1 scale)
      {
        name: 's2_cavity',
        geom: new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24),
        rimGeom: new THREE.CylinderGeometry(0.15, 0.15, 0.01, 24),
        pos: [-0.15, 0.21, 0.42],
      },
      // 4. Optical Cuvette square cavity (1:1 scale)
      {
        name: 'cuvette_cavity',
        geom: new THREE.BoxGeometry(0.18, 0.08, 0.18),
        rimGeom: new THREE.BoxGeometry(0.20, 0.01, 0.20),
        pos: [0.14, 0.21, 0.42],
      },
      // 5. Dropper Bottle cylindrical cavity (1:1 scale)
      {
        name: 'bottle_cavity',
        geom: new THREE.CylinderGeometry(0.08, 0.08, 0.08, 20),
        rimGeom: new THREE.CylinderGeometry(0.09, 0.09, 0.01, 20),
        pos: [0.44, 0.21, 0.42],
      },
      // 6. Observation Screen cavity
      {
        name: 'screen_cavity',
        geom: new THREE.BoxGeometry(0.52, 0.06, 0.22),
        rimGeom: new THREE.BoxGeometry(0.54, 0.01, 0.24),
        pos: [0.38, 0.21, -0.42],
      },
      // 7. Electronic Controller cavity
      {
        name: 'controller_cavity',
        geom: new THREE.BoxGeometry(0.48, 0.06, 0.22),
        rimGeom: new THREE.BoxGeometry(0.50, 0.01, 0.24),
        pos: [-0.38, 0.21, -0.42],
      },
      // 8. Power Bank cavity
      {
        name: 'power_bank_cavity',
        geom: new THREE.BoxGeometry(0.36, 0.06, 0.22),
        rimGeom: new THREE.BoxGeometry(0.38, 0.01, 0.24),
        pos: [0.0, 0.21, -0.42],
      },
    ];

    cavities.forEach((cav) => {
      const pocket = createSubMesh(cav.geom, cavityFloorMat, cav.pos, false, true);
      pocket.name = cav.name;
      const rim = createSubMesh(cav.rimGeom, cavityRimMat, [cav.pos[0], cav.pos[1] + 0.04, cav.pos[2]], false, false);
      group.add(pocket, rim);
    });

    // 4 Retention O-Ring upper foam collars around fastener rod sockets
    const rodSockets: [number, number, number][] = [
      [-0.44, 0.25, -0.35],
      [0.44, 0.25, -0.35],
      [-0.44, 0.25, 0.35],
      [0.44, 0.25, 0.35],
    ];
    rodSockets.forEach(([sx, sy, sz]) => {
      const collarGeom = new THREE.TorusGeometry(0.042, 0.009, 12, 32);
      collarGeom.rotateX(Math.PI / 2);
      const collarMesh = createSubMesh(collarGeom, cavityRimMat, [sx, sy, sz], false, false);
      group.add(collarMesh);
    });

    // Hinged Lid with Recessed Yellow Insert Panel (#eab308) strictly per R1 & Fig. 1
    const lidGroup = new THREE.Group();
    lidGroup.name = 'kit_lid';
    lidGroup.position.set(0, caseH + 0.01, -caseD / 2);

    // Black reinforced polymer perimeter frame
    const lidFrame = createSubMesh(new THREE.BoxGeometry(caseW, 0.10, caseD), shellMat, [0, 0.05, caseD / 2]);
    // Recessed Yellow Insert Panel
    const yellowPanelMat = pbrMaterial('#eab308', 0.42, 0.1);
    const yellowInsert = createSubMesh(new THREE.BoxGeometry(caseW * 0.88, 0.012, caseD * 0.86), yellowPanelMat, [0, 0.105, caseD / 2]);

    lidGroup.add(lidFrame, yellowInsert);
    group.add(lidGroup);

    return group;
  }

  // =========================================================================
  // 2. Fastener Rods (Tirantes Plásticos com Rosca Métrica e Cabeça Recartilhada)
  // =========================================================================
  public createFastenerRod(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'fastening_rod';

    const rodLength = 0.22;
    const rodRadius = 0.024;
    const capRadius = 0.038;
    const capHeight = 0.04;

    // White POM / Nylon shaft with procedural metric thread bump map (pitch = 2.0 mm)
    const shaftMat = texturedMaterial(
      {
        color: params?.color || '#f8fafc',
        roughness: 0.35,
        metalness: 0.05,
      },
      undefined,
      this.threadBumpTexture,
      0.003
    );
    const shaft = createSubMesh(new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 32), shaftMat, [0, rodLength / 2, 0]);

    // Knurled Cap on top with diamond knurl bump map
    const capMat = texturedMaterial(
      {
        color: '#f1f5f9',
        roughness: 0.45,
        metalness: 0.12,
      },
      undefined,
      this.knurlBumpTexture,
      0.0035
    );
    const cap = createSubMesh(new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 32), capMat, [0, rodLength + capHeight / 2, 0]);

    // Bottom lead-in chamfer
    const chamferMat = pbrMaterial('#e2e8f0', 0.5, 0.1);
    const chamfer = createSubMesh(new THREE.CylinderGeometry(rodRadius, rodRadius * 0.7, 0.012, 32), chamferMat, [0, 0.006, 0]);

    group.add(shaft, cap, chamfer);
    return group;
  }

  // =========================================================================
  // Retention O-Rings (Anéis de Retenção Vermelhos)
  // =========================================================================
  public createRedOring(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'red_oring';

    const ringMat = pbrMaterial(params?.color || '#dc2626', 0.72, 0.0);
    const oringGeom = new THREE.TorusGeometry(0.04, 0.007, 16, 48);
    oringGeom.rotateX(Math.PI / 2);
    const ringMesh = createSubMesh(oringGeom, ringMat, [0, 0, 0]);

    group.add(ringMesh);
    return group;
  }

  // =========================================================================
  // 3. Optical Platform (Plataforma Óptica Principal - Fig. 4-1)
  // =========================================================================
  public createOpticalPlatform(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'optical_platform';

    // 4 Anti-vibration rubber feet
    const footMat = pbrMaterial('#111827', 0.92, 0.08);
    const footGeom = new THREE.CylinderGeometry(0.035, 0.04, 0.018, 20);
    const feetCoords = [
      [-0.72, -0.4], [0.72, -0.4],
      [-0.72, 0.4], [0.72, 0.4],
    ];
    feetCoords.forEach(([fx, fz]) => {
      group.add(createSubMesh(footGeom, footMat, [fx, 0.009, fz], false));
    });

    // Multi-tier precision black anodized aluminum breadboard (#14191f)
    const lowerBase = createSubMesh(new THREE.BoxGeometry(1.55, 0.032, 0.9), pbrMaterial('#1e252b', 0.65, 0.35), [0, 0.024, 0]);
    const bevelTier = createSubMesh(new THREE.BoxGeometry(1.52, 0.014, 0.87), pbrMaterial('#263038', 0.55, 0.45), [0, 0.047, 0]);
    const breadboard = createSubMesh(new THREE.BoxGeometry(1.48, 0.014, 0.83), pbrMaterial('#14191f', 0.48, 0.52), [0, 0.061, 0]);
    group.add(lowerBase, bevelTier, breadboard);

    // Countersunk Metric Hexagonal Allen Socket Head Cap Screws at perimeter
    const allenScrewCoords = [
      [-0.70, -0.38], [-0.70, 0.38], [0.70, -0.38], [0.70, 0.38],
      [0.0, -0.38], [0.0, 0.38], [-0.35, 0.0], [0.35, 0.0],
    ];
    allenScrewCoords.forEach(([ax, az]) => {
      const screw = createAllenScrew(0.009, 0.006, 0.0048);
      screw.position.set(ax, 0.068, az);
      group.add(screw);
    });

    // Rotary Stage Subgroup
    const rotaryStage = new THREE.Group();
    rotaryStage.name = 'rotary_stage';

    // 3 Concentric Goniometer Rings (2048x2048 precision texture) strictly per R1
    const goniometerMat = texturedMaterial(
      {
        transparent: true,
        roughness: 0.42,
        metalness: 0.18,
        side: THREE.DoubleSide,
      },
      this.goniometerTexture
    );
    const goniometerScale = createSubMesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      goniometerMat,
      [0, 0.075, 0],
      false
    );
    goniometerScale.rotation.x = -Math.PI / 2;
    rotaryStage.add(goniometerScale);

    // Machined aluminum stage collar and central plate
    const stageCollar = createSubMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 64), pbrMaterial('#475569', 0.38, 0.72), [0, 0.072, 0]);
    const centralPlate = createSubMesh(new THREE.CylinderGeometry(0.285, 0.292, 0.028, 64), pbrMaterial('#94a3b8', 0.32, 0.82), [0, 0.086, 0]);
    rotaryStage.add(stageCollar, centralPlate);

    // 4 Stainless steel locating pins for S1/S2 holder mounting
    const pinGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 16);
    const pinMat = pbrMaterial('#e2e8f0', 0.18, 0.92);
    const pinCoords: [number, number, number][] = [
      [0.25, 0.106, 0],
      [-0.25, 0.106, 0],
      [0, 0.106, 0.25],
      [0, 0.106, -0.25],
    ];
    pinCoords.forEach((pPos) => {
      rotaryStage.add(createSubMesh(pinGeom, pinMat, pPos, false));
    });

    // 4 Square cuvette locking sockets with chamfered rim
    const holeCoords: [number, number, number][] = [
      [-0.09, 0.098, -0.09], [0.09, 0.098, -0.09],
      [-0.09, 0.098, 0.09], [0.09, 0.098, 0.09],
    ];
    holeCoords.forEach(([hx, hy, hz]) => {
      const rim = createSubMesh(new THREE.BoxGeometry(0.028, 0.004, 0.028), pbrMaterial('#334155', 0.5, 0.6), [hx, hy + 0.002, hz], false);
      const hole = createSubMesh(new THREE.BoxGeometry(0.022, 0.016, 0.022), pbrMaterial('#090d12', 0.95, 0.05), [hx, hy, hz], false);
      rotaryStage.add(rim, hole);
    });

    group.add(rotaryStage);

    // Fixed Red Reference Pointer with needle and fiducial line
    const pointerGroup = new THREE.Group();
    pointerGroup.name = 'reference_pointer';
    const bracket = createSubMesh(new THREE.BoxGeometry(0.038, 0.028, 0.065), pbrMaterial('#1e242b', 0.6, 0.4), [0.485, 0.084, 0], false);
    const bracketScrew = createSubMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 12), pbrMaterial('#cbd5e1', 0.2, 0.9), [0.485, 0.099, 0], false);
    const blade = createSubMesh(new THREE.BoxGeometry(0.05, 0.006, 0.022), pbrMaterial('#e2e8f0', 0.2, 0.92), [0.465, 0.095, 0], false);

    const pointerShape = new THREE.Shape();
    pointerShape.moveTo(0, -0.01);
    pointerShape.lineTo(0.035, 0);
    pointerShape.lineTo(0, 0.01);
    pointerShape.closePath();
    const pointerGeom = new THREE.ExtrudeGeometry(pointerShape, { depth: 0.006, bevelEnabled: false });
    pointerGeom.rotateZ(Math.PI);
    pointerGeom.rotateX(Math.PI / 2);
    const needle = createSubMesh(pointerGeom, pbrMaterial('#dc2626', 0.28, 0.2), [0.47, 0.098, 0], true);

    const fiducialLine = createSubMesh(new THREE.PlaneGeometry(0.03, 0.0018), pbrMaterial('#ffffff', 0.2, 0.0), [0.455, 0.102, 0], false);
    fiducialLine.rotation.x = -Math.PI / 2;

    pointerGroup.add(bracket, bracketScrew, blade, needle, fiducialLine);
    group.add(pointerGroup);

    // Angular Adjustment Knob in White Nylon (#f8fafc) strictly per R1
    const knobMat = texturedMaterial(
      {
        color: '#f8fafc',
        roughness: 0.38,
        metalness: 0.04,
      },
      undefined,
      this.knurlBumpTexture,
      0.003
    );
    const rotationKnob = createSubMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 32), knobMat, [0.47, 0.12, 0.37]);
    rotationKnob.rotation.x = Math.PI / 2;
    rotationKnob.name = 'rotation_knob';

    const knobRimL = createSubMesh(new THREE.CylinderGeometry(0.056, 0.056, 0.008, 32), pbrMaterial('#cbd5e1', 0.3, 0.8), [0.47, 0.12, 0.32], false);
    knobRimL.rotation.x = Math.PI / 2;
    const knobRimR = createSubMesh(new THREE.CylinderGeometry(0.056, 0.056, 0.008, 32), pbrMaterial('#cbd5e1', 0.3, 0.8), [0.47, 0.12, 0.42], false);
    knobRimR.rotation.x = Math.PI / 2;
    group.add(rotationKnob, knobRimL, knobRimR);

    // Vertical Guide Towers: Left (Laser) & Right (Lens)
    const laserTower = this.createGuideTower('laser');
    laserTower.position.x = -0.64;
    const lensTower = this.createGuideTower('lens');
    lensTower.position.x = 0.64;
    group.add(laserTower, lensTower);

    return group;
  }

  /**
   * Helper creating stainless steel guide tower with black knurled knob
   * and optical carrier (laser diode or plano-convex cylindrical lens).
   */
  private createGuideTower(kind: 'laser' | 'lens'): THREE.Group {
    const tower = new THREE.Group();
    tower.name = `${kind}_tower`;

    const foot = createSubMesh(new THREE.BoxGeometry(0.18, 0.05, 0.32), pbrMaterial('#1e252b', 0.65, 0.35), [0, 0.025, 0]);

    // Dual stainless steel posts with brushed finish
    const postMat = texturedMaterial(
      {
        color: '#e2e8f0',
        metalness: 0.88,
        roughness: 0.22,
      },
      this.brushedMetalTexture
    );
    const posts = [-0.11, 0.11].map((pz) =>
      createSubMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.68, 24), postMat, [0, 0.35, pz])
    );
    tower.add(foot, ...posts);

    // Optical carriage
    const carriage = new THREE.Group();
    carriage.name = `${kind}_carriage`;
    const carriageBody = createSubMesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), pbrMaterial('#1a2027', 0.55, 0.55), [0, 0.38, 0]);
    carriage.add(carriageBody);

    if (kind === 'laser') {
      const emitterBarrel = createSubMesh(new THREE.CylinderGeometry(0.034, 0.034, 0.18, 24), pbrMaterial('#b92525', 0.28, 0.68), [0.12, 0.38, 0]);
      emitterBarrel.rotation.z = Math.PI / 2;
      const apertureRing = createSubMesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 24), pbrMaterial('#d4af37', 0.22, 0.88), [0.21, 0.38, 0], false);
      apertureRing.rotation.z = Math.PI / 2;
      carriage.add(emitterBarrel, apertureRing);
    } else {
      // Plano-Convex Cylindrical Lens strictly per R1 & IPhO 2024 E2
      const lensMount = createSubMesh(new THREE.CylinderGeometry(0.082, 0.082, 0.024, 32), pbrMaterial('#1e242b', 0.45, 0.7), [0, 0.38, 0]);
      lensMount.rotation.z = Math.PI / 2;

      // Authentic Plano-Convex Cylindrical surface geometry
      // Extruded cross section: flat back, convex circular arc front
      const lensShape = new THREE.Shape();
      const lensHalfW = 0.06;
      const lensThickness = 0.018;
      const curvr = (lensHalfW * lensHalfW + lensThickness * lensThickness) / (2 * lensThickness);
      const arcAngle = Math.asin(lensHalfW / curvr);

      lensShape.moveTo(-lensThickness / 2, -lensHalfW);
      lensShape.lineTo(-lensThickness / 2, lensHalfW);
      lensShape.absarc(curvr - lensThickness / 2, 0, curvr, Math.PI - arcAngle, Math.PI + arcAngle, false);
      lensShape.closePath();

      const cylindricalLensGeom = new THREE.ExtrudeGeometry(lensShape, {
        depth: 0.12,
        bevelEnabled: false,
      });
      // Center and orient vertically
      cylindricalLensGeom.center();
      cylindricalLensGeom.rotateY(Math.PI / 2);

      const cylindricalLens = createSubMesh(
        cylindricalLensGeom,
        new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 1.0,
          roughness: 0.03,
          metalness: 0.0,
          ior: 1.51,
          thickness: 0.05,
          transmission: 0.96,
        }),
        [0, 0.38, 0],
        false
      );
      carriage.add(lensMount, cylindricalLens);
    }
    tower.add(carriage);

    // Turned Black Anodized Knurled Top Knob (#18181b) strictly per R1
    const topKnobMat = texturedMaterial(
      {
        color: '#18181b',
        metalness: 0.82,
        roughness: 0.28,
      },
      undefined,
      this.knurlBumpTexture,
      0.0035
    );
    const topKnob = createSubMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 32), topKnobMat, [0, 0.78, 0.2]);
    topKnob.rotation.x = Math.PI / 2;

    const knobCap = createSubMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 24), pbrMaterial('#cbd5e1', 0.25, 0.85), [0, 0.78, 0.23], false);
    knobCap.rotation.x = Math.PI / 2;
    const knobScrew = createSubMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), pbrMaterial('#090d12', 0.6, 0.5), [0, 0.78, 0.234], false);
    knobScrew.rotation.x = Math.PI / 2;

    tower.add(topKnob, knobCap, knobScrew);
    return tower;
  }

  // =========================================================================
  // 4. Holders S1 & S2 (Suportes S1 e S2 - 4 Mirror Chrome Columns)
  // =========================================================================
  public createS1Holder(params?: MeshCreationParams): THREE.Group {
    return this.createSpecimenHolder('S1', 0.0001489, '#99eedd', params);
  }

  public createS2Holder(params?: MeshCreationParams): THREE.Group {
    // S2 strictly built with identical 4 mirror chrome columns (#f8fafc, metalness: 0.98) - NO BRASS!
    return this.createSpecimenHolder('S2', 0.001061, '#ffffff', params);
  }

  private createSpecimenHolder(
    label: 'S1' | 'S2',
    thicknessMeters: number,
    attenuationColor: string,
    params?: MeshCreationParams
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `holder_${label.toLowerCase()}`;

    // Mirror finish chrome material strictly per R1: metalness 0.98, roughness 0.04
    const mirrorChromeMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      metalness: 0.98,
      roughness: 0.04,
    });

    // Circular base mounting ring
    const baseRingGeom = new THREE.TorusGeometry(0.25, 0.016, 16, 64);
    baseRingGeom.rotateX(Math.PI / 2);
    const baseRing = createSubMesh(baseRingGeom, mirrorChromeMat, [0, 0.16, 0]);
    group.add(baseRing);

    // 4 Locating notches in circular ring matching stage pins
    const notchMat = pbrMaterial('#94a3b8', 0.3, 0.8);
    const notchCoords: [number, number, number][] = [
      [0.25, 0.16, 0], [-0.25, 0.16, 0],
      [0, 0.16, 0.25], [0, 0.16, -0.25],
    ];
    notchCoords.forEach((nPos) => {
      group.add(createSubMesh(new THREE.BoxGeometry(0.016, 0.018, 0.024), notchMat, nPos, false));
    });

    // Exactly 4 Mirror Chrome Columns strictly per R1 & Fig. 4-2
    const columnGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.44, 24);
    const collarGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 20);

    const columnPositions: [number, number][] = [
      [-0.14, -0.16],
      [0.14, -0.16],
      [-0.14, 0.16],
      [0.14, 0.16],
    ];

    columnPositions.forEach(([cx, cz]) => {
      const col = createSubMesh(columnGeom, mirrorChromeMat, [cx, 0.37, cz]);
      const collar = createSubMesh(collarGeom, mirrorChromeMat, [cx, 0.17, cz], false);
      group.add(col, collar);
    });

    // Machined Black Clamp Block (#18181b) spanning the columns
    const clampMat = pbrMaterial('#18181b', 0.42, 0.6);
    const clampBlock = createSubMesh(new THREE.BoxGeometry(0.08, 0.075, 0.5), clampMat, [0, 0.55, 0]);
    group.add(clampBlock);

    // Knurled Thumbscrews holding glass slide
    const thumbscrewMat = texturedMaterial(
      {
        color: '#475569',
        metalness: 0.88,
        roughness: 0.25,
      },
      undefined,
      this.knurlBumpTexture,
      0.003
    );
    [-0.16, 0.16].forEach((sz) => {
      const screwHead = createSubMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 24), thumbscrewMat, [0.048, 0.55, sz], false);
      screwHead.rotation.z = Math.PI / 2;
      const screwShaft = createSubMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 16), pbrMaterial('#cbd5e1', 0.2, 0.9), [0.038, 0.55, sz], false);
      screwShaft.rotation.z = Math.PI / 2;
      group.add(screwHead, screwShaft);
    });

    // Optical Microscope Slide (S1: 148.9 µm, S2: 1.061 mm)
    // S2 is ~7x thicker than S1
    const visualSlideThickness = label === 'S1' ? 0.006 : 0.018;
    const slideGeom = new THREE.BoxGeometry(visualSlideThickness, 0.34, 0.28);
    const slideMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 1.0,
      roughness: 0.04,
      metalness: 0.0,
      ior: 1.51,
      thickness: label === 'S1' ? 0.04 : 0.12,
      transmission: 0.96,
      attenuationColor: new THREE.Color(attenuationColor),
      attenuationDistance: 0.35,
    });
    const slideMesh = createSubMesh(slideGeom, slideMat, [0, 0.35, 0], false);
    group.add(slideMesh);

    // Emerald Edge Bevel (characteristic of precision optical lab glass)
    const edgeBevel = createSubMesh(
      new THREE.BoxGeometry(visualSlideThickness + 0.001, 0.342, 0.004),
      new THREE.MeshPhysicalMaterial({
        color: '#2dd4bf',
        transparent: true,
        opacity: 0.85,
        roughness: 0.06,
        metalness: 0.0,
        ior: 1.51,
        transmission: 0.72,
      }),
      [0, 0.35, 0.14],
      false
    );
    group.add(edgeBevel);

    return group;
  }

  // =========================================================================
  // 5. Optical Cuvette & Dropper Bottle (Cubeta Óptica & Frasco Conta-Gotas)
  // =========================================================================
  public createOpticalCuvette(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'optical_cuvette';

    const w = 0.22;
    const h = 0.26;
    const d = 0.22;
    const wallThick = 0.025;

    // High-clarity crystalline PMMA acrylic body (n = 1.491)
    const acrylicMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 1.0,
      roughness: 0.02,
      metalness: 0.0,
      ior: 1.491,
      thickness: 0.08,
      transmission: 0.96,
    });

    // 4 Walls and Bottom
    const bottom = createSubMesh(new THREE.BoxGeometry(w, wallThick, d), acrylicMat, [0, wallThick / 2, 0]);
    const wallLeft = createSubMesh(new THREE.BoxGeometry(wallThick, h - wallThick, d), acrylicMat, [-w / 2 + wallThick / 2, h / 2 + wallThick / 2, 0]);
    const wallRight = createSubMesh(new THREE.BoxGeometry(wallThick, h - wallThick, d), acrylicMat, [w / 2 - wallThick / 2, h / 2 + wallThick / 2, 0]);
    const wallFront = createSubMesh(new THREE.BoxGeometry(w - 2 * wallThick, h - wallThick, wallThick), acrylicMat, [0, h / 2 + wallThick / 2, d / 2 - wallThick / 2]);
    const wallBack = createSubMesh(new THREE.BoxGeometry(w - 2 * wallThick, h - wallThick, wallThick), acrylicMat, [0, h / 2 + wallThick / 2, -d / 2 + wallThick / 2]);

    group.add(bottom, wallLeft, wallRight, wallFront, wallBack);

    // 4 Bottom locking lugs matching rotary stage holes
    const lugGeom = new THREE.BoxGeometry(0.018, 0.015, 0.018);
    const lugMat = pbrMaterial('#e2e8f0', 0.25, 0.65);
    [
      [-0.09, -0.09], [0.09, -0.09],
      [-0.09, 0.09], [0.09, 0.09],
    ].forEach(([lx, lz]) => {
      group.add(createSubMesh(lugGeom, lugMat, [lx, -0.0075, lz], false));
    });

    // Peelable Protective Yellow Film with Official "One" Serigraphy (Fig. 4-4)
    const peelMat = texturedMaterial(
      {
        roughness: 0.45,
        metalness: 0.05,
        side: THREE.DoubleSide,
      },
      this.cuvettePeelTexture
    );
    const peelMesh = createSubMesh(new THREE.PlaneGeometry(w - 0.01, h - 0.02), peelMat, [0, h / 2, d / 2 + 0.001], false);
    peelMesh.name = 'cuvette_peel_film';
    group.add(peelMesh);

    // 3D Curved Pink Liquid Meniscus Mesh
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 1.0,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.332,
      transmission: 0.72,
      attenuationColor: new THREE.Color('#e11d48'),
      attenuationDistance: 0.18,
    });
    const innerW = w - 2 * wallThick - 0.004;
    const innerD = d - 2 * wallThick - 0.004;
    const liquidH = h * 0.65;
    const liquidBody = createSubMesh(new THREE.BoxGeometry(innerW, liquidH, innerD), liquidMat, [0, wallThick + liquidH / 2, 0], false);
    liquidBody.name = 'liquid_body';

    // Meniscus curved surface
    const meniscusGeom = new THREE.PlaneGeometry(innerW, innerD, 16, 16);
    const posAttr = meniscusGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const mx = posAttr.getX(i);
      const my = posAttr.getY(i);
      const distFromCenter = Math.sqrt(mx * mx + my * my) / (innerW / 2);
      // Capillary rise meniscus curvature
      const rise = Math.pow(distFromCenter, 2.5) * 0.008;
      posAttr.setZ(i, rise);
    }
    meniscusGeom.computeVertexNormals();
    meniscusGeom.rotateX(-Math.PI / 2);
    const meniscusMesh = createSubMesh(meniscusGeom, liquidMat, [0, wallThick + liquidH, 0], false);
    meniscusMesh.name = 'liquid_meniscus';

    group.add(liquidBody, meniscusMesh);
    return group;
  }

  public createDropperBottle(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'dropper_bottle';

    const bodyRadius = 0.065;
    const bodyHeight = 0.24;

    // Translucent pink LDPE body (#fda4af / #fb7185, transmission 0.72) strictly per R1
    const bottleBodyMat = new THREE.MeshPhysicalMaterial({
      color: '#fda4af',
      transparent: true,
      opacity: 1.0,
      roughness: 0.22,
      metalness: 0.0,
      ior: 1.5,
      transmission: 0.72,
      attenuationColor: new THREE.Color('#f43f5e'),
      attenuationDistance: 0.2,
    });
    const bottleBody = createSubMesh(new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 32), bottleBodyMat, [0, bodyHeight / 2, 0]);

    // Pink Liquid inside (n = 1.332)
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 1.0,
      roughness: 0.08,
      ior: 1.332,
      transmission: 0.68,
      attenuationColor: new THREE.Color('#e11d48'),
      attenuationDistance: 0.15,
    });
    const liquid = createSubMesh(new THREE.CylinderGeometry(bodyRadius * 0.92, bodyRadius * 0.92, bodyHeight * 0.75, 24), liquidMat, [0, (bodyHeight * 0.75) / 2 + 0.01, 0], false);

    // White Ribbed Screw Cap strictly per R1 & Fig. 4-5 (NO RED CAP!)
    const capMat = pbrMaterial('#ffffff', 0.35, 0.08);
    const cap = createSubMesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 24), capMat, [0, bodyHeight + 0.025, 0]);

    // Vertical grip ribs around white cap
    const ribGeom = new THREE.BoxGeometry(0.002, 0.046, 0.004);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const rx = Math.cos(a) * 0.0385;
      const rz = Math.sin(a) * 0.0385;
      const rib = createSubMesh(ribGeom, capMat, [rx, bodyHeight + 0.025, rz], false, false);
      cap.add(rib);
    }

    // Dropper dispensing conical nozzle
    const nozzle = createSubMesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 20), pbrMaterial('#ffffff', 0.3, 0.1), [0, bodyHeight + 0.065, 0]);

    group.add(bottleBody, liquid, cap, nozzle);
    return group;
  }

  // =========================================================================
  // 6. Electronic Controller & Power Bank (Controlador Eletrônico & Bateria)
  // =========================================================================
  public createElectronicController(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'electronic_controller';

    const boxW = 0.64;
    const boxH = 0.08;
    const boxD = 0.42;

    // Molded White ABS Chassis (#f8fafc) strictly per R1
    const whiteAbsMat = pbrMaterial('#f8fafc', 0.32, 0.06);
    const chassis = createSubMesh(new THREE.BoxGeometry(boxW, boxH, boxD), whiteAbsMat, [0, boxH / 2, 0]);
    group.add(chassis);

    // Official Serigraphy Faceplate (1024x640) with IPhO 54th logo emblem
    const faceplateMat = texturedMaterial(
      {
        roughness: 0.36,
        metalness: 0.12,
      },
      this.silkscreenTexture
    );
    const faceplate = createSubMesh(new THREE.PlaneGeometry(boxW, boxD), faceplateMat, [0, boxH + 0.001, 0], false);
    faceplate.rotation.x = -Math.PI / 2;
    group.add(faceplate);

    // Blue Backlit LCD Display (#0284c7) with recessed bezel
    const bezelMat = pbrMaterial('#0f172a', 0.6, 0.2);
    const lcdBezel = createSubMesh(new THREE.BoxGeometry(0.28, 0.008, 0.12), bezelMat, [0.04, boxH + 0.004, -0.06], false);
    const lcdScreen = createSubMesh(
      new THREE.PlaneGeometry(0.26, 0.10),
      new THREE.MeshBasicMaterial({ color: '#0284c7' }),
      [0.04, boxH + 0.009, -0.06],
      false
    );
    lcdScreen.rotation.x = -Math.PI / 2;
    group.add(lcdBezel, lcdScreen);

    // Laser Emission LED with metallic bezel
    const ledBezel = createSubMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), pbrMaterial('#cbd5e1', 0.25, 0.85), [-0.22, boxH + 0.004, 0.08], false);
    const ledIndicator = createSubMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16), pbrMaterial('#dc2626', 0.3, 0.2), [-0.22, boxH + 0.012, 0.08], false);
    group.add(ledBezel, ledIndicator);

    // Black Rectangular Rocker Switch (Gangorra On/Off) strictly per R1 & Fig. 4-6
    const switchGroup = new THREE.Group();
    switchGroup.name = 'rocker_switch';
    const switchHousing = createSubMesh(new THREE.BoxGeometry(0.045, 0.012, 0.075), pbrMaterial('#0f172a', 0.5, 0.4), [-0.22, boxH + 0.006, -0.02], false);
    // Pivoted rocker paddle with white markings
    const rockerPaddle = createSubMesh(new THREE.BoxGeometry(0.038, 0.016, 0.065), pbrMaterial('#18181b', 0.35, 0.3), [-0.22, boxH + 0.014, -0.02]);
    rockerPaddle.rotation.x = -0.18; // Tilted toward ON state
    switchGroup.add(switchHousing, rockerPaddle);
    group.add(switchGroup);

    // Turned Aluminum Potentiometer Knob strictly per R1 & Fig. 4-6
    const potKnobMat = texturedMaterial(
      {
        color: '#e2e8f0',
        metalness: 0.88,
        roughness: 0.25,
      },
      undefined,
      this.knurlBumpTexture,
      0.003
    );
    const potKnob = createSubMesh(new THREE.CylinderGeometry(0.042, 0.042, 0.036, 32), potKnobMat, [0.22, boxH + 0.018, 0.08]);
    potKnob.name = 'current_knob';
    // Top brushed aluminum disc with engraved index notch
    const knobCap = createSubMesh(new THREE.CylinderGeometry(0.038, 0.038, 0.004, 32), pbrMaterial('#cbd5e1', 0.2, 0.92), [0.22, boxH + 0.037, 0.08], false);
    const indexLine = createSubMesh(new THREE.BoxGeometry(0.003, 0.005, 0.018), pbrMaterial('#090d12', 0.2, 0.0), [0.22, boxH + 0.039, 0.09], false);
    group.add(potKnob, knobCap, indexLine);

    // Industrial Green Detachable 2-Pin Euroblock / Phoenix Terminal strictly per R1
    const euroblockGroup = new THREE.Group();
    euroblockGroup.name = 'euroblock_terminal';
    const euroblockBody = createSubMesh(new THREE.BoxGeometry(0.065, 0.04, 0.035), pbrMaterial('#16a34a', 0.45, 0.1), [0.22, boxH + 0.02, -0.16]);
    // 2 Clamping screw heads on top
    [-0.015, 0.015].forEach((sx) => {
      const screw = createSubMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.005, 12), pbrMaterial('#94a3b8', 0.2, 0.85), [0.22 + sx, boxH + 0.041, -0.16], false);
      euroblockGroup.add(screw);
    });
    // Wire socket entries
    [-0.015, 0.015].forEach((sx) => {
      const socketHole = createSubMesh(new THREE.BoxGeometry(0.01, 0.012, 0.008), pbrMaterial('#090d12', 0.9, 0.1), [0.22 + sx, boxH + 0.02, -0.178], false);
      euroblockGroup.add(socketHole);
    });
    euroblockGroup.add(euroblockBody);
    group.add(euroblockGroup);

    // USB-C Power Input Receptacle
    const usbcPort = createSubMesh(new THREE.BoxGeometry(0.025, 0.012, 0.01), pbrMaterial('#64748b', 0.3, 0.8), [0, boxH * 0.5, boxD / 2 + 0.002], false);
    group.add(usbcPort);

    return group;
  }

  public createPowerBank(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'power_bank';

    // Matte Black Rectangular Chassis (#18181b / #1e242b)
    const bankMat = pbrMaterial('#18181b', 0.6, 0.2);
    const body = createSubMesh(new THREE.BoxGeometry(0.46, 0.07, 0.25), bankMat, [0, 0.035, 0]);

    // Outer perimeter bezel
    const rimMat = pbrMaterial('#334155', 0.45, 0.55);
    const rim = createSubMesh(new THREE.BoxGeometry(0.465, 0.01, 0.255), rimMat, [0, 0.068, 0], false);

    // USB-A port receptacle
    const usbMat = pbrMaterial('#090d12', 0.8, 0.3);
    const usbA = createSubMesh(new THREE.BoxGeometry(0.04, 0.015, 0.01), usbMat, [-0.15, 0.045, -0.126], false);

    // White USB Cable Lead connecting to controller
    const whiteCableMat = pbrMaterial('#f8fafc', 0.35, 0.05);
    const cableConnector = createSubMesh(new THREE.BoxGeometry(0.03, 0.018, 0.04), whiteCableMat, [-0.15, 0.045, -0.145]);

    group.add(body, rim, usbA, cableConnector);
    return group;
  }

  // =========================================================================
  // 7. Observation Screen (Anteparo de Observação - Fig. 4-3)
  // =========================================================================
  public createObservationScreen(params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    group.name = 'observation_screen';

    // Heavy Black Machined Base with Longitudinal Guide Grooves strictly per R1
    const baseMat = pbrMaterial('#18181b', 0.52, 0.58);
    const base = createSubMesh(new THREE.BoxGeometry(0.34, 0.06, 0.18), baseMat, [0, 0.03, 0]);
    base.name = 'screen_base';
    group.add(base);

    // Extruded longitudinal guide grooves on base foot
    const grooveMat = pbrMaterial('#090d12', 0.8, 0.3);
    [-0.04, 0.04].forEach((gz) => {
      const groove = createSubMesh(new THREE.BoxGeometry(0.342, 0.008, 0.015), grooveMat, [0, 0.058, gz], false);
      group.add(groove);
    });

    // Two Knurled Clamping Thumbscrews on side of base
    const thumbscrewMat = texturedMaterial(
      {
        color: '#475569',
        metalness: 0.85,
        roughness: 0.28,
      },
      undefined,
      this.knurlBumpTexture,
      0.003
    );
    [-0.08, 0.08].forEach((sx) => {
      const screwHead = createSubMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 20), thumbscrewMat, [sx, 0.03, 0.098], false);
      screwHead.rotation.x = Math.PI / 2;
      const screwShaft = createSubMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 16), pbrMaterial('#cbd5e1', 0.2, 0.9), [sx, 0.03, 0.089], false);
      screwShaft.rotation.x = Math.PI / 2;
      group.add(screwHead, screwShaft);
    });

    // Anodized Gray Metal Frame (#64748b)
    const frameMat = pbrMaterial('#64748b', 0.38, 0.65);
    const frame = createSubMesh(new THREE.BoxGeometry(0.05, 0.62, 0.72), frameMat, [0, 0.39, 0]);
    frame.name = 'screen_frame';

    // Flat Matte White Projection Surface (#f8fafc, roughness 0.96)
    const faceMat = pbrMaterial('#f8fafc', 0.96, 0.02);
    const face = createSubMesh(new THREE.PlaneGeometry(0.62, 0.48), faceMat, [0.028, 0.42, 0], false);
    face.rotation.y = Math.PI / 2;
    face.name = 'screen_face';

    group.add(frame, face);
    return group;
  }

  // =========================================================================
  // Fallback procedural box mesh
  // =========================================================================
  private createFallbackMesh(descriptor: AssetDescriptor, params?: MeshCreationParams): THREE.Group {
    const group = new THREE.Group();
    const dims = descriptor.dimensions;
    const geom = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
    const mat = pbrMaterial(params?.color || '#94a3b8', params?.roughness || 0.5, params?.metalness || 0.1);
    const m = createSubMesh(geom, mat, [0, dims[1] / 2, 0]);
    group.add(m);
    return group;
  }
}
