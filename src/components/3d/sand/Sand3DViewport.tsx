import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SimpleOrbitControls } from '../controls/SimpleOrbitControls';
import { KspGizmoController, KspGizmoMode } from '../controls/KspGizmoController';
import { BallSpec, PhOLabComponent3DState, SandCraterExperimentState } from '../../../types/pholab';

export type SandCameraPreset =
  | 'overview'
  | 'kit_box'
  | 'craters_bowl'
  | 'stand_height'
  | 'inclined_rail'
  | 'chronometer';

const PRESET_CONFIGS: Record<SandCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0, 0.75, 1.2], target: [0, 0.05, 0] },
  kit_box: { pos: [0.48, 0.45, 0.55], target: [0.48, 0.04, 0.28] },
  craters_bowl: { pos: [-0.25, 0.38, 0.26], target: [-0.25, 0.04, 0.02] },
  stand_height: { pos: [-0.25, 0.75, 0.55], target: [-0.25, 0.5, 0] },
  inclined_rail: { pos: [0.36, 0.52, 0.45], target: [0.36, 0.12, -0.05] },
  chronometer: { pos: [0.06, 0.28, 0.36], target: [0.06, 0.02, 0.22] },
};

// Initial default positions strictly inside the Kit Box
const INITIAL_BOX_POSITIONS: Record<string, { pos: [number, number, number]; rot: [number, number, number] }> = {
  component_stand_base: { pos: [0.46, 0.025, 0.34], rot: [0, 0, 0] },
  component_stand_rod: { pos: [0.60, 0.035, 0.28], rot: [Math.PI / 2, 0, 0] }, // Lying horizontally in long compartment
  component_stand_collar: { pos: [0.55, 0.035, 0.38], rot: [0, 0, 0] },
  component_sand_bowl: { pos: [0.38, 0.035, 0.36], rot: [0, 0, 0] },
  component_balls_tray: { pos: [0.42, 0.035, 0.24], rot: [0, 0, 0] },
  component_ruler: { pos: [0.55, 0.032, 0.20], rot: [0, 0, 0] },
  component_spoon: { pos: [0.50, 0.032, 0.16], rot: [0, 0, 0] },
  component_inclined_rail: { pos: [0.62, 0.035, 0.28], rot: [0, 0, 0] },
  component_braking_track: { pos: [0.36, 0.028, 0.26], rot: [0, 0, 0] },
  component_chronometer: { pos: [0.58, 0.032, 0.40], rot: [0, 0, 0] },
};

interface Sand3DViewportProps {
  cameraPreset: SandCameraPreset;
  state: SandCraterExperimentState;
  ballsList: BallSpec[];
  selectedBall: BallSpec;
  elapsedSeconds: number;
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  onStirAndLevel: () => void;
  onRollRailBall: () => void;
  onToggleChronometer: () => void;
  onResetChronometer: () => void;
  onComponentsChanged?: (components: PhOLabComponent3DState[]) => void;
}

export const Sand3DViewport: React.FC<Sand3DViewportProps> = ({
  cameraPreset,
  state,
  ballsList,
  selectedBall,
  elapsedSeconds,
  onSelectBall,
  onDropBall,
  onStirAndLevel,
  onRollRailBall,
  onToggleChronometer,
  onResetChronometer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetCamPos = useRef(new THREE.Vector3(...PRESET_CONFIGS.overview.pos));
  const targetCamLook = useRef(new THREE.Vector3(...PRESET_CONFIGS.overview.target));

  // Gizmo & Camera Controllers
  const gizmoRef = useRef<KspGizmoController | null>(null);
  const controlsRef = useRef<SimpleOrbitControls | null>(null);
  const [activeGizmoMode, setActiveGizmoMode] = useState<KspGizmoMode>('offset');
  const [isSnapActive, setIsSnapActive] = useState<boolean>(true);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

  // Component Mesh References
  const componentsRef = useRef<{ [key: string]: THREE.Object3D }>({});

  // Physics animation variables
  const isFallingRef = useRef(false);
  const ballPosRef = useRef(new THREE.Vector3(0, 0, 0));
  const ballVelRef = useRef(new THREE.Vector3(0, 0, 0));
  const dropBallMeshRef = useRef<THREE.Mesh | null>(null);

  const isRollingRef = useRef(false);
  const rollDistanceRef = useRef(0);
  const rollVelocityRef = useRef(0);
  const railBallMeshRef = useRef<THREE.Mesh | null>(null);

  // Sand Deformable Mesh
  const sandGeomRef = useRef<THREE.PlaneGeometry | null>(null);
  const baseSandPositions = useRef<Float32Array | null>(null);

  // Chronometer & Clock Textures
  const chronoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chronoTexRef = useRef<THREE.CanvasTexture | null>(null);
  const clockCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clockTexRef = useRef<THREE.CanvasTexture | null>(null);

  // Update target camera position on preset change
  useEffect(() => {
    const config = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.overview;
    targetCamPos.current.set(...config.pos);
    targetCamLook.current.set(...config.target);
  }, [cameraPreset]);

  // Set Gizmo Mode & Snap State
  const handleSetMode = (mode: KspGizmoMode) => {
    setActiveGizmoMode(mode);
    if (gizmoRef.current) gizmoRef.current.setMode(mode);
  };

  const handleToggleSnap = () => {
    const next = !isSnapActive;
    setIsSnapActive(next);
    if (gizmoRef.current) gizmoRef.current.snapEnabled = next;
  };

  // Trigger Ball Free-Fall Simulation
  const triggerPhysicsDrop = useCallback(() => {
    const collar = componentsRef.current['component_stand_collar'];
    if (!collar || isFallingRef.current) return;
    const collarWorldPos = new THREE.Vector3();
    collar.getWorldPosition(collarWorldPos);

    ballPosRef.current.set(collarWorldPos.x - 0.13, collarWorldPos.y, collarWorldPos.z + 0.07);
    ballVelRef.current.set(0, 0, 0);
    isFallingRef.current = true;

    onDropBall();
  }, [onDropBall]);

  // Trigger Ball Rail Rolling Simulation
  const triggerPhysicsRoll = useCallback(() => {
    if (isRollingRef.current) return;
    isRollingRef.current = true;
    rollDistanceRef.current = 0;
    rollVelocityRef.current = 0;

    onRollRailBall();
  }, [onRollRailBall]);

  // Deform Sand Mesh on Impact
  const deformSandAtImpact = useCallback((impactDiameterMm: number) => {
    if (!sandGeomRef.current || !baseSandPositions.current) return;
    const posAttr = sandGeomRef.current.attributes.position;
    const array = posAttr.array as Float32Array;
    const base = baseSandPositions.current;

    const craterRadiusM = (impactDiameterMm / 2) / 1000;
    const depthM = Math.max(0.003, craterRadiusM * 0.4);
    const rimRadiusM = craterRadiusM * 1.25;
    const rimHeightM = depthM * 0.35;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = base[i * 3];
      const vz = base[i * 3 + 1];
      const r = Math.sqrt(vx * vx + vz * vz);

      if (r <= craterRadiusM) {
        const frac = r / craterRadiusM;
        const dip = -depthM * (1 - frac * frac);
        array[i * 3 + 2] = dip;
      } else if (r <= rimRadiusM) {
        const frac = (r - craterRadiusM) / (rimRadiusM - craterRadiusM);
        const bump = rimHeightM * Math.sin(frac * Math.PI);
        array[i * 3 + 2] = bump;
      } else {
        array[i * 3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;
    sandGeomRef.current.computeVertexNormals();
  }, []);

  // Level Sand (Smooth back to original flat plane)
  const levelSandMesh = useCallback(() => {
    if (!sandGeomRef.current || !baseSandPositions.current) return;
    const posAttr = sandGeomRef.current.attributes.position;
    const array = posAttr.array as Float32Array;
    const base = baseSandPositions.current;

    for (let i = 0; i < posAttr.count; i++) {
      array[i * 3 + 2] = base[i * 3 + 2];
    }
    posAttr.needsUpdate = true;
    sandGeomRef.current.computeVertexNormals();
    onStirAndLevel();
  }, [onStirAndLevel]);

  // Main Three.js Scene Setup & Physics Animation Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Perspective Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.02, 50);
    camera.position.set(...PRESET_CONFIGS.overview.pos);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls (CAD Middle-Click Pan and Wheel Zoom)
    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // 4. KSP Gizmo Controller (Offset, Rotate, Snap)
    const gizmo = new KspGizmoController(camera, renderer.domElement);
    gizmo.onDragStart = () => {
      controls.isLocked = true; // Rigid lock during gizmo drag
    };
    gizmo.onDragEnd = () => {
      controls.isLocked = false;
    };
    scene.add(gizmo.group);
    gizmoRef.current = gizmo;

    // 5. Studio Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight('#fffbeb', 1.4);
    mainLight.position.set(2.5, 4, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // 6. Solid Wooden Laboratory Workbench (Empty center)
    const tableGeom = new THREE.BoxGeometry(2.4, 0.06, 1.4);
    const tableMat = new THREE.MeshStandardMaterial({ color: '#2d1810', roughness: 0.35, metalness: 0.05 });
    const tableMesh = new THREE.Mesh(tableGeom, tableMat);
    tableMesh.position.set(0, -0.03, 0);
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // Grid lines on desk
    const gridHelper = new THREE.GridHelper(2.2, 22, '#f59e0b', '#334155');
    gridHelper.position.set(0, 0.001, 0);
    scene.add(gridHelper);

    // -------------------------------------------------------------
    // 📦 7. EXPERIMENTAL KIT BOX (Opened container holding all items)
    // -------------------------------------------------------------
    const kitBoxGroup = new THREE.Group();
    kitBoxGroup.position.set(0.48, 0.02, 0.28);
    kitBoxGroup.name = 'component_kit_box';

    const boxOuterMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.5 });
    const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.32), boxOuterMat);
    boxBottom.castShadow = true;
    boxBottom.receiveShadow = true;
    kitBoxGroup.add(boxBottom);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.01), wallMat);
    wallN.position.set(0, 0.03, -0.155);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.01), wallMat);
    wallS.position.set(0, 0.03, 0.155);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.30), wallMat);
    wallW.position.set(-0.185, 0.03, 0);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.30), wallMat);
    wallE.position.set(0.185, 0.03, 0);
    kitBoxGroup.add(wallN, wallS, wallW, wallE);

    // Internal dividers
    const divMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6 });
    const div1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.04, 0.30), divMat);
    div1.position.set(-0.06, 0.02, 0);
    const div2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.006), divMat);
    div2.position.set(0.06, 0.02, 0);
    kitBoxGroup.add(div1, div2);
    scene.add(kitBoxGroup);

    // -------------------------------------------------------------
    // 8. STAND BASE (f1)
    // -------------------------------------------------------------
    const standBaseGroup = new THREE.Group();
    standBaseGroup.position.set(...INITIAL_BOX_POSITIONS.component_stand_base.pos);
    standBaseGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_stand_base.rot);
    standBaseGroup.name = 'component_stand_base';

    const standBaseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.025, 0.26),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    standBaseMesh.castShadow = true;
    standBaseGroup.add(standBaseMesh);

    const holeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.026, 16),
      new THREE.MeshStandardMaterial({ color: '#1e293b' })
    );
    holeMesh.position.set(0.11, 0, -0.07);
    standBaseGroup.add(holeMesh);

    scene.add(standBaseGroup);
    componentsRef.current['component_stand_base'] = standBaseGroup;

    // -------------------------------------------------------------
    // 9. VERTICAL STEEL ROD (f4) (1.15m)
    // -------------------------------------------------------------
    const standRodGroup = new THREE.Group();
    standRodGroup.position.set(...INITIAL_BOX_POSITIONS.component_stand_rod.pos);
    standRodGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_stand_rod.rot);
    standRodGroup.name = 'component_stand_rod';

    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.15, 20),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
    );
    rodMesh.castShadow = true;
    standRodGroup.add(rodMesh);

    for (let h = 0.1; h <= 1.0; h += 0.1) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 16),
        new THREE.MeshStandardMaterial({ color: h % 0.5 === 0 ? '#ef4444' : '#1e293b' })
      );
      ring.position.set(0, h - 0.58, 0);
      standRodGroup.add(ring);
    }

    scene.add(standRodGroup);
    componentsRef.current['component_stand_rod'] = standRodGroup;

    // -------------------------------------------------------------
    // 10. HEIGHT COLLAR & RELEASE ARM (f2, f3)
    // -------------------------------------------------------------
    const collarGroup = new THREE.Group();
    collarGroup.position.set(...INITIAL_BOX_POSITIONS.component_stand_collar.pos);
    collarGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_stand_collar.rot);
    collarGroup.name = 'component_stand_collar';

    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.6, roughness: 0.3 })
    );
    collarGroup.add(collarMesh);

    const armMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.13, 16),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 })
    );
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(-0.065, 0, 0.07);
    collarGroup.add(armMesh);

    // Mechanical Release Trigger Button
    const triggerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.016, 0.014),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
    );
    triggerMesh.position.set(-0.13, 0.012, 0.07);
    triggerMesh.name = 'trigger_drop_ball';
    collarGroup.add(triggerMesh);

    // Active Drop Ball
    const dropBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.003, selectedBall.diameterMm / 1000), 24, 24),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    dropBallMesh.position.set(-0.13, 0, 0.07);
    dropBallMesh.castShadow = true;
    collarGroup.add(dropBallMesh);
    dropBallMeshRef.current = dropBallMesh;

    scene.add(collarGroup);
    componentsRef.current['component_stand_collar'] = collarGroup;

    // -------------------------------------------------------------
    // 11. SAND BOWL (b) & REALISTIC HIGH-DENSITY DEFORMABLE SAND
    // -------------------------------------------------------------
    const bowlGroup = new THREE.Group();
    bowlGroup.position.set(...INITIAL_BOX_POSITIONS.component_sand_bowl.pos);
    bowlGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_sand_bowl.rot);
    bowlGroup.name = 'component_sand_bowl';

    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.095, 0.05, 36),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 })
    );
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    bowlGroup.add(bowlMesh);

    const sandGeom = new THREE.PlaneGeometry(0.21, 0.21, 64, 64);
    sandGeom.rotateX(-Math.PI / 2);
    sandGeomRef.current = sandGeom;
    baseSandPositions.current = new Float32Array(sandGeom.attributes.position.array);

    const sandMat = new THREE.MeshStandardMaterial({
      color: '#c89658',
      roughness: 0.96,
      metalness: 0.02,
      bumpScale: 0.03,
    });
    const sandMesh = new THREE.Mesh(sandGeom, sandMat);
    sandMesh.position.y = 0.024;
    sandMesh.receiveShadow = true;
    sandMesh.castShadow = true;
    bowlGroup.add(sandMesh);

    scene.add(bowlGroup);
    componentsRef.current['component_sand_bowl'] = bowlGroup;

    // -------------------------------------------------------------
    // 12. STEEL BALLS TRAY WITH 4 BALLS (#1 to #4)
    // -------------------------------------------------------------
    const trayGroup = new THREE.Group();
    trayGroup.position.set(...INITIAL_BOX_POSITIONS.component_balls_tray.pos);
    trayGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_balls_tray.rot);
    trayGroup.name = 'component_balls_tray';

    const trayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.015, 0.08),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 })
    );
    trayMesh.castShadow = true;
    trayGroup.add(trayMesh);

    ballsList.forEach((b, idx) => {
      const bMesh = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.003, b.diameterMm / 1000), 16, 16),
        new THREE.MeshStandardMaterial({
          color: b.id === selectedBall.id ? '#f59e0b' : '#94a3b8',
          metalness: 0.9,
          roughness: 0.15,
        })
      );
      bMesh.position.set(-0.06 + idx * 0.04, 0.015 + b.diameterMm / 2000, 0);
      bMesh.castShadow = true;
      bMesh.name = `ball_selector_${b.id}`;
      trayGroup.add(bMesh);
    });

    scene.add(trayGroup);
    componentsRef.current['component_balls_tray'] = trayGroup;

    // -------------------------------------------------------------
    // 13. TRANSPARENT ACRYLIC RULER (o)
    // -------------------------------------------------------------
    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(...INITIAL_BOX_POSITIONS.component_ruler.pos);
    rulerGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_ruler.rot);
    rulerGroup.name = 'component_ruler';

    const rulerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.003, 0.03),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.1,
      })
    );
    rulerMesh.castShadow = true;
    rulerGroup.add(rulerMesh);

    const rulerCanvas = document.createElement('canvas');
    rulerCanvas.width = 1024;
    rulerCanvas.height = 128;
    const rCtx = rulerCanvas.getContext('2d')!;
    rCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    rCtx.fillRect(0, 0, 1024, 128);
    rCtx.fillStyle = '#0f172a';
    rCtx.font = 'bold 20px monospace';
    for (let mm = 0; mm <= 200; mm++) {
      const x = (mm / 200) * 1000 + 12;
      const h = mm % 10 === 0 ? 54 : mm % 5 === 0 ? 36 : 20;
      rCtx.fillRect(x, 0, 2, h);
      if (mm % 10 === 0 && mm > 0) {
        rCtx.fillText(`${mm / 10}`, x - 6, 80);
      }
    }
    const rulerTex = new THREE.CanvasTexture(rulerCanvas);
    const rulerScaleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.235, 0.028),
      new THREE.MeshBasicMaterial({ map: rulerTex, transparent: true })
    );
    rulerScaleMesh.rotation.x = -Math.PI / 2;
    rulerScaleMesh.position.y = 0.0018;
    rulerGroup.add(rulerScaleMesh);

    scene.add(rulerGroup);
    componentsRef.current['component_ruler'] = rulerGroup;

    // -------------------------------------------------------------
    // 14. STIRRING SPOON (n)
    // -------------------------------------------------------------
    const spoonGroup = new THREE.Group();
    spoonGroup.position.set(...INITIAL_BOX_POSITIONS.component_spoon.pos);
    spoonGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_spoon.rot);
    spoonGroup.name = 'component_spoon';

    const spoonHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.2 })
    );
    spoonHandle.rotation.x = Math.PI / 2;
    spoonGroup.add(spoonHandle);

    const spoonHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 16, 16),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
    );
    spoonHead.scale.set(1, 0.3, 1.4);
    spoonHead.position.set(0, 0, 0.08);
    spoonGroup.add(spoonHead);

    scene.add(spoonGroup);
    componentsRef.current['component_spoon'] = spoonGroup;

    // -------------------------------------------------------------
    // 15. PART B: INCLINED RAIL (h) & BRAKING TRACK (j)
    // -------------------------------------------------------------
    const railGroup = new THREE.Group();
    railGroup.position.set(...INITIAL_BOX_POSITIONS.component_inclined_rail.pos);
    railGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_inclined_rail.rot);
    railGroup.name = 'component_inclined_rail';

    const railMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.015, 0.95),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.2 })
    );
    railMesh.castShadow = true;
    railGroup.add(railMesh);

    const railTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 0.015),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 })
    );
    railTrigger.position.set(0, 0.05, -0.40);
    railTrigger.name = 'trigger_roll_ball';
    railGroup.add(railTrigger);

    const railBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 20, 20),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    railBallMesh.position.set(0, 0.04, -0.37);
    railBallMesh.castShadow = true;
    railGroup.add(railBallMesh);
    railBallMeshRef.current = railBallMesh;

    scene.add(railGroup);
    componentsRef.current['component_inclined_rail'] = railGroup;

    const trackGroup = new THREE.Group();
    trackGroup.position.set(...INITIAL_BOX_POSITIONS.component_braking_track.pos);
    trackGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_braking_track.rot);
    trackGroup.name = 'component_braking_track';

    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.55),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    trackMesh.castShadow = true;
    trackGroup.add(trackMesh);

    const sandTrackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.015, 0.53),
      new THREE.MeshStandardMaterial({ color: '#c89658', roughness: 0.95 })
    );
    sandTrackMesh.position.set(0, 0.02, 0);
    sandTrackMesh.receiveShadow = true;
    trackGroup.add(sandTrackMesh);

    scene.add(trackGroup);
    componentsRef.current['component_braking_track'] = trackGroup;

    // -------------------------------------------------------------
    // 16. DIGITAL CHRONOMETER (k) WITH 3D CLICKABLE BUTTONS
    // -------------------------------------------------------------
    const chronoGroup = new THREE.Group();
    chronoGroup.position.set(...INITIAL_BOX_POSITIONS.component_chronometer.pos);
    chronoGroup.rotation.set(...INITIAL_BOX_POSITIONS.component_chronometer.rot);
    chronoGroup.name = 'component_chronometer';

    const chronoBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.016, 24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 })
    );
    chronoGroup.add(chronoBody);

    const btnStart = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.3 })
    );
    btnStart.position.set(0.018, 0.01, -0.03);
    btnStart.name = 'button_chrono_start';
    chronoGroup.add(btnStart);

    const btnReset = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
    );
    btnReset.position.set(-0.018, 0.01, -0.03);
    btnReset.name = 'button_chrono_reset';
    chronoGroup.add(btnReset);

    const cCanvas = document.createElement('canvas');
    cCanvas.width = 256;
    cCanvas.height = 128;
    chronoCanvasRef.current = cCanvas;
    const cTex = new THREE.CanvasTexture(cCanvas);
    chronoTexRef.current = cTex;

    const lcdMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.022),
      new THREE.MeshBasicMaterial({ map: cTex })
    );
    lcdMesh.rotation.x = -Math.PI / 2;
    lcdMesh.position.set(0, 0.0085, 0.005);
    chronoGroup.add(lcdMesh);

    scene.add(chronoGroup);
    componentsRef.current['component_chronometer'] = chronoGroup;

    // -------------------------------------------------------------
    // 17. DIGITAL EXAM CLOCK
    // -------------------------------------------------------------
    const clockCanvas = document.createElement('canvas');
    clockCanvas.width = 512;
    clockCanvas.height = 128;
    clockCanvasRef.current = clockCanvas;
    const clockTex = new THREE.CanvasTexture(clockCanvas);
    clockTexRef.current = clockTex;

    const clockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 })
    );
    clockMesh.position.set(0, 0.04, -0.58);
    const clockScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.065),
      new THREE.MeshBasicMaterial({ map: clockTex })
    );
    clockScreen.position.set(0, 0, 0.011);
    clockMesh.add(clockScreen);
    scene.add(clockMesh);

    // -------------------------------------------------------------
    // 18. RAYCASTING SELECTION & CLICK INTERACTIONS
    // -------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerClick = (e: MouseEvent) => {
      if (gizmo.isDragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;

        if (hitObj.name === 'button_chrono_start') {
          onToggleChronometer();
          return;
        }
        if (hitObj.name === 'button_chrono_reset') {
          onResetChronometer();
          return;
        }
        if (hitObj.name === 'trigger_drop_ball') {
          triggerPhysicsDrop();
          return;
        }
        if (hitObj.name === 'trigger_roll_ball') {
          triggerPhysicsRoll();
          return;
        }

        if (hitObj.name && hitObj.name.startsWith('ball_selector_')) {
          const ballId = hitObj.name.replace('ball_selector_', '');
          const ball = ballsList.find((b) => b.id === ballId);
          if (ball) {
            onSelectBall(ball);
            return;
          }
        }

        while (hitObj && hitObj.parent && hitObj.parent !== scene && !hitObj.name.startsWith('component_')) {
          hitObj = hitObj.parent;
        }

        if (hitObj && hitObj.name.startsWith('component_') && hitObj.name !== 'component_kit_box') {
          // If piece is inside the kit box, pull it out slightly onto the desk
          const initBox = INITIAL_BOX_POSITIONS[hitObj.name];
          if (initBox && hitObj.position.distanceTo(new THREE.Vector3(...initBox.pos)) < 0.05) {
            hitObj.position.set(0, 0.05, 0); // Place on workbench center
          }

          setSelectedComponentName(hitObj.name);
          gizmo.attach(hitObj);
        } else {
          setSelectedComponentName(null);
          gizmo.attach(null);
        }
      }
    };

    renderer.domElement.addEventListener('click', onPointerClick);

    // -------------------------------------------------------------
    // 19. 60 FPS PHYSICS ENGINE & ANIMATION LOOP
    // -------------------------------------------------------------
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;

      camera.position.lerp(targetCamPos.current, 0.07);
      controls.target.lerp(targetCamLook.current, 0.07);
      controls.update();

      gizmo.updateScale();

      // Ball Free-fall Dynamics
      if (isFallingRef.current && dropBallMeshRef.current) {
        ballVelRef.current.y -= 9.81 * dt;
        ballPosRef.current.y += ballVelRef.current.y * dt;

        dropBallMeshRef.current.position.copy(ballPosRef.current);

        const sandBowl = componentsRef.current['component_sand_bowl'];
        const sandSurfaceY = sandBowl ? sandBowl.position.y + 0.024 : 0.055;

        if (ballPosRef.current.y <= sandSurfaceY) {
          ballPosRef.current.y = sandSurfaceY;
          isFallingRef.current = false;
          deformSandAtImpact(state.lastImpactDiameterMm || 23.8);
        }
      } else if (!state.craterFormed && dropBallMeshRef.current) {
        dropBallMeshRef.current.position.set(-0.13, 0, 0.07);
      }

      // Ball Rolling Dynamics
      if (isRollingRef.current && railBallMeshRef.current) {
        const sin5 = Math.sin((5.0 * Math.PI) / 180);
        const aRoll = (5 / 7) * 9.81 * sin5;

        if (rollDistanceRef.current < 0.85) {
          rollVelocityRef.current += aRoll * dt;
          rollDistanceRef.current += rollVelocityRef.current * dt;

          const progress = rollDistanceRef.current / 0.85;
          railBallMeshRef.current.position.z = -0.37 + progress * 0.85;
          railBallMeshRef.current.position.y = 0.04 - progress * (0.04 - 0.015);
          railBallMeshRef.current.rotation.x += (rollVelocityRef.current / 0.006) * dt;
        } else {
          const aBrake = -0.8 * 9.81;
          rollVelocityRef.current = Math.max(0, rollVelocityRef.current + aBrake * dt);
          rollDistanceRef.current += rollVelocityRef.current * dt;

          const sandProgress = (rollDistanceRef.current - 0.85);
          railBallMeshRef.current.position.z = 0.48 + sandProgress;
          railBallMeshRef.current.position.y = 0.015;
          railBallMeshRef.current.rotation.x += (rollVelocityRef.current / 0.006) * dt;

          if (rollVelocityRef.current <= 0) {
            isRollingRef.current = false;
          }
        }
      }

      // Update LCD Chronometer Texture
      if (chronoCanvasRef.current && chronoTexRef.current) {
        const ctx = chronoCanvasRef.current.getContext('2d')!;
        ctx.fillStyle = '#047857';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 56px monospace';
        const s = Math.floor(state.chronometerTimeS);
        const cs = Math.floor((state.chronometerTimeS % 1) * 100);
        const text = `${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
        ctx.fillText(text, 36, 85);
        chronoTexRef.current.needsUpdate = true;
      }

      // Update Exam Clock Texture
      if (clockCanvasRef.current && clockTexRef.current) {
        const ctx = clockCanvasRef.current.getContext('2d')!;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 52px monospace';
        const h = Math.floor(elapsedSeconds / 3600);
        const m = Math.floor((elapsedSeconds % 3600) / 60);
        const s = elapsedSeconds % 60;
        const text = `PROVA: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        ctx.fillText(text, 30, 80);
        clockTexRef.current.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', onPointerClick);
      gizmo.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [ballsList, selectedBall]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* KSP Style Construction Mode Toolbar (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(6px)',
          zIndex: 10,
        }}
      >
        <button
          className={`btn-ksp-action ${activeGizmoMode === 'offset' ? 'primary' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={() => handleSetMode('offset')}
          title="Mover peça pelos eixos X, Y, Z (Atalho: 2 ou W)"
        >
          [2] Mover (Offset)
        </button>
        <button
          className={`btn-ksp-action ${activeGizmoMode === 'rotate' ? 'primary' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={() => handleSetMode('rotate')}
          title="Girar peça pelos anéis ortogonais (Atalho: 3 ou E)"
        >
          [3] Girar (Rotate)
        </button>
        <button
          className={`btn-ksp-action ${isSnapActive ? 'success' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={handleToggleSnap}
          title="Alternar Snap de 5° e 5mm (Atalho: C)"
        >
          [C] Snap: {isSnapActive ? '5° / 5mm' : 'Livre'}
        </button>
      </div>

      {/* Selected Piece Floating Indicator */}
      {selectedComponentName && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 16,
            background: 'rgba(30, 41, 59, 0.85)',
            color: '#f59e0b',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'monospace',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            zIndex: 10,
          }}
        >
          Selecionado: {selectedComponentName.replace('component_', '').toUpperCase()}
        </div>
      )}

      {/* Camera & Navigation Floating Hints (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          color: '#cbd5e1',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'monospace',
          display: 'flex',
          gap: 14,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <span><strong style={{ color: '#f59e0b' }}>Scroll (Click + Arrastar)</strong>: Pan / Mover Câmera</span>
        <span><strong style={{ color: '#f59e0b' }}>Rolar Scroll</strong>: Zoom Milimétrico</span>
        <span><strong style={{ color: '#f59e0b' }}>Botão Esquerdo</strong>: Órbita / Giro da Câmera</span>
        <span><strong style={{ color: '#f59e0b' }}>W / E / C / Esc</strong>: Modos do Gizmo</span>
      </div>
    </div>
  );
};
