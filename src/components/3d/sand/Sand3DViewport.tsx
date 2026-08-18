import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SimpleOrbitControls } from '../controls/SimpleOrbitControls';
import { TransformGimbal, GimbalMode } from '../controls/TransformGimbal';
import { SnapFittingEngine, SnapTarget } from '../kit/SnapFittingEngine';
import { BallSpec, PhOLabComponent3DState, SandCraterExperimentState } from '../../../types/pholab';

export type SandCameraPreset =
  | 'overview'
  | 'craters_bowl'
  | 'stand_height'
  | 'inclined_rail'
  | 'chronometer'
  | 'task_sheet'
  | 'kit_box';

const PRESET_CONFIGS: Record<SandCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0, 0.75, 1.2], target: [0, 0.05, 0] },
  craters_bowl: { pos: [-0.22, 0.42, 0.28], target: [-0.22, 0.04, 0] },
  stand_height: { pos: [-0.22, 0.75, 0.55], target: [-0.22, 0.5, 0] },
  inclined_rail: { pos: [0.38, 0.55, 0.45], target: [0.38, 0.15, -0.05] },
  chronometer: { pos: [0.08, 0.32, 0.38], target: [0.08, 0.02, 0.22] },
  task_sheet: { pos: [-0.52, 0.45, 0.25], target: [-0.52, 0.02, 0.05] },
  kit_box: { pos: [0.45, 0.48, 0.5], target: [0.45, 0.05, 0.25] },
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
  const gimbalRef = useRef<TransformGimbal | null>(null);

  // Dynamic Scene Mesh References
  const sandMeshRef = useRef<THREE.Mesh | null>(null);
  const dropBallMeshRef = useRef<THREE.Mesh | null>(null);
  const railBallMeshRef = useRef<THREE.Mesh | null>(null);
  const chronoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chronoTexRef = useRef<THREE.CanvasTexture | null>(null);
  const clockCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clockTexRef = useRef<THREE.CanvasTexture | null>(null);

  // Ball falling state
  const isFallingRef = useRef(false);
  const fallProgressRef = useRef(0);
  const fallVelocityRef = useRef(0);

  // Update target camera position on preset change
  useEffect(() => {
    const config = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.overview;
    targetCamPos.current.set(...config.pos);
    targetCamLook.current.set(...config.target);
  }, [cameraPreset]);

  // Main Three.js Scene Setup & Physics Animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.02, 50);
    camera.position.set(...PRESET_CONFIGS.overview.pos);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls
    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 0.08; // Allows high-zoom inspection of ruler & craters
    controls.maxDistance = 3.5;
    controls.target.set(...PRESET_CONFIGS.overview.target);

    // 4. Transform Gimbal for Object Manipulation
    const gimbal = new TransformGimbal(camera, renderer.domElement);
    scene.add(gimbal.group);
    gimbalRef.current = gimbal;

    // 5. Lighting
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

    // 6. Physical Workbench Table
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

    const boxOuterMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.5 });
    const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.32), boxOuterMat);
    boxBottom.castShadow = true;
    boxBottom.receiveShadow = true;
    kitBoxGroup.add(boxBottom);

    // Box Walls
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

    // Internal Dividers in Box
    const divMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6 });
    const div1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.04, 0.30), divMat);
    div1.position.set(-0.06, 0.02, 0);
    const div2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.006), divMat);
    div2.position.set(0.06, 0.02, 0);
    kitBoxGroup.add(div1, div2);

    scene.add(kitBoxGroup);

    // -------------------------------------------------------------
    // 8. SAND BOWL (b) & CRATER DEFORMATION MESH
    // -------------------------------------------------------------
    const bowlGroup = new THREE.Group();
    bowlGroup.position.set(-0.22, 0.03, 0.04);
    bowlGroup.name = 'component_sand_bowl';

    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.095, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 })
    );
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    bowlGroup.add(bowlMesh);

    // Deformable Sand Plane / Cylinder Top
    const sandGeom = new THREE.CylinderGeometry(0.106, 0.106, 0.046, 48, 12);
    const sandMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.95, bumpScale: 0.02 });
    const sandMesh = new THREE.Mesh(sandGeom, sandMat);
    sandMesh.position.y = 0.003;
    sandMesh.receiveShadow = true;
    bowlGroup.add(sandMesh);
    sandMeshRef.current = sandMesh;

    scene.add(bowlGroup);

    // -------------------------------------------------------------
    // 9. STAND ASSEMBLY (f1 Base, f4 Rod, f2/f3 Height Collar)
    // -------------------------------------------------------------
    const standGroup = new THREE.Group();
    standGroup.position.set(-0.22, 0, 0);
    standGroup.name = 'component_stand';

    // Base (f1)
    const standBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.025, 0.26),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    standBase.position.set(0, 0.0125, 0);
    standBase.castShadow = true;
    standGroup.add(standBase);

    // Vertical Stainless Steel Rod (f4) (1.15m)
    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.15, 20),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
    );
    rodMesh.position.set(0.11, 0.585, -0.07);
    rodMesh.castShadow = true;
    standGroup.add(rodMesh);

    // Millimeter tick markings on rod
    for (let h = 0.1; h <= 1.0; h += 0.1) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 16),
        new THREE.MeshStandardMaterial({ color: h % 0.5 === 0 ? '#ef4444' : '#1e293b' })
      );
      ring.position.set(0.11, h, -0.07);
      standGroup.add(ring);
    }

    // Height Clamping Collar & Release Arm (f2, f3)
    const collarGroup = new THREE.Group();
    collarGroup.position.set(0.11, 0.5, -0.07);

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

    // Mechanical Release Button / Trigger on Arm (Clickable)
    const triggerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.015, 0.012),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
    );
    triggerMesh.position.set(-0.13, 0.01, 0.07);
    triggerMesh.name = 'trigger_drop_ball';
    collarGroup.add(triggerMesh);

    // Active Drop Ball resting on arm
    const dropBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.003, selectedBall.diameterMm / 1000), 24, 24),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    dropBallMesh.position.set(-0.13, 0, 0.07);
    dropBallMesh.castShadow = true;
    collarGroup.add(dropBallMesh);
    dropBallMeshRef.current = dropBallMesh;

    standGroup.add(collarGroup);
    scene.add(standGroup);

    // -------------------------------------------------------------
    // 10. STEEL BALLS TRAY WITH 4 BALLS (Click to select)
    // -------------------------------------------------------------
    const trayGroup = new THREE.Group();
    trayGroup.position.set(-0.18, 0.01, -0.16);

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

    // -------------------------------------------------------------
    // 11. TRANSPARENT ACRYLIC RULER (o) (Movable with Gimbal)
    // -------------------------------------------------------------
    const rulerGroup = new THREE.Group();
    rulerGroup.position.set(-0.22, 0.062, 0.04);
    rulerGroup.name = 'component_ruler';

    const rulerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.003, 0.03),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
        metalness: 0.1,
      })
    );
    rulerMesh.castShadow = true;
    rulerGroup.add(rulerMesh);

    // Millimeter marks texture on ruler
    const rulerCanvas = document.createElement('canvas');
    rulerCanvas.width = 1024;
    rulerCanvas.height = 128;
    const rCtx = rulerCanvas.getContext('2d')!;
    rCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    rCtx.fillRect(0, 0, 1024, 128);
    rCtx.fillStyle = '#0f172a';
    rCtx.font = 'bold 18px monospace';
    for (let mm = 0; mm <= 200; mm++) {
      const x = (mm / 200) * 1000 + 12;
      const h = mm % 10 === 0 ? 50 : mm % 5 === 0 ? 32 : 18;
      rCtx.fillRect(x, 0, 1.5, h);
      if (mm % 10 === 0 && mm > 0) {
        rCtx.fillText(`${mm / 10}`, x - 6, 75);
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

    // -------------------------------------------------------------
    // 12. STIRRING SPOON (n) (Movable with Gimbal to level sand)
    // -------------------------------------------------------------
    const spoonGroup = new THREE.Group();
    spoonGroup.position.set(-0.42, 0.015, -0.12);
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

    // -------------------------------------------------------------
    // 13. PART B: INCLINED RAIL (h) & SAND BRAKING TRACK (j)
    // -------------------------------------------------------------
    const partBGroup = new THREE.Group();
    partBGroup.position.set(0.38, 0, 0);

    const thetaRad = (5.0 * Math.PI) / 180;

    // 1m Aluminum V-rail at 5 deg
    const railMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.015, 0.95),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.2 })
    );
    railMesh.position.set(0, 0.082, -0.28);
    railMesh.rotation.x = thetaRad;
    railMesh.castShadow = true;
    partBGroup.add(railMesh);

    // Rail Release Trigger (Clickable)
    const railTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 0.015),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 })
    );
    railTrigger.position.set(0, 0.13, -0.68);
    railTrigger.name = 'trigger_roll_ball';
    partBGroup.add(railTrigger);

    // Rail Rolling Ball
    const railBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 20, 20),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    railBallMesh.position.set(0, 0.12, -0.65);
    railBallMesh.castShadow = true;
    partBGroup.add(railBallMesh);
    railBallMeshRef.current = railBallMesh;

    // Wooden Braking Sand Track
    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.55),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    trackMesh.position.set(0, 0.0125, 0.28);
    trackMesh.castShadow = true;
    partBGroup.add(trackMesh);

    const sandTrackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.015, 0.53),
      new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.95 })
    );
    sandTrackMesh.position.set(0, 0.02, 0.28);
    sandTrackMesh.receiveShadow = true;
    partBGroup.add(sandTrackMesh);

    scene.add(partBGroup);

    // -------------------------------------------------------------
    // 14. DIGITAL CHRONOMETER (k) WITH 3D CLICKABLE BUTTONS
    // -------------------------------------------------------------
    const chronoGroup = new THREE.Group();
    chronoGroup.position.set(0.08, 0.015, 0.22);
    chronoGroup.name = 'component_chronometer';

    const chronoBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.016, 24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 })
    );
    chronoGroup.add(chronoBody);

    // 3D Buttons: START/STOP (Right) & RESET (Left)
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

    // Dynamic LCD Canvas for Chronometer
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

    // -------------------------------------------------------------
    // 15. EXAM CLOCK / ELAPSED TIME DISPLAY ON DESK / WALL
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
    // 16. RAYCASTING SELECTION & CLICK INTERACTIONS
    // -------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;

        // Check if a 3D button was clicked
        if (hitObj.name === 'button_chrono_start') {
          onToggleChronometer();
          return;
        }
        if (hitObj.name === 'button_chrono_reset') {
          onResetChronometer();
          return;
        }
        if (hitObj.name === 'trigger_drop_ball') {
          onDropBall();
          return;
        }
        if (hitObj.name === 'trigger_roll_ball') {
          onRollRailBall();
          return;
        }

        // Check if a ball in the tray was clicked
        if (hitObj.name && hitObj.name.startsWith('ball_selector_')) {
          const ballId = hitObj.name.replace('ball_selector_', '');
          const ball = ballsList.find((b) => b.id === ballId);
          if (ball) {
            onSelectBall(ball);
            return;
          }
        }

        // Find highest named component root for Gimbal attach
        while (hitObj && hitObj.parent && hitObj.parent !== scene && !hitObj.name.startsWith('component_')) {
          hitObj = hitObj.parent;
        }

        if (hitObj && (hitObj.name.startsWith('component_') || hitObj.parent === scene)) {
          gimbal.attach(hitObj);
        } else {
          gimbal.attach(null);
        }
      }
    };

    renderer.domElement.addEventListener('click', onPointerClick);

    // -------------------------------------------------------------
    // 17. ANIMATION LOOP & PHYSICS UPDATES
    // -------------------------------------------------------------
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera interpolation
      camera.position.lerp(targetCamPos.current, 0.07);
      controls.target.lerp(targetCamLook.current, 0.07);
      controls.update();

      // Update Gimbal scale
      gimbal.updateScale();

      // Update Height Collar position according to state slider
      collarGroup.position.y = THREE.MathUtils.lerp(
        collarGroup.position.y,
        0.05 + (state.dropHeightCm / 100) * 0.9,
        0.1
      );

      // Animate Ball Falling on impact
      if (state.craterFormed && dropBallMeshRef.current) {
        dropBallMeshRef.current.position.y = 0.035; // At crater center
      } else if (dropBallMeshRef.current) {
        dropBallMeshRef.current.position.set(-0.13, 0, 0.07);
      }

      // Animate Rail Ball Rolling
      if (state.ballRolling && railBallMeshRef.current) {
        const t = (performance.now() * 0.001) % Math.max(1, state.ballTravelTimeS);
        const progress = t / Math.max(0.1, state.ballTravelTimeS);
        railBallMeshRef.current.position.z = -0.65 + progress * 0.85;
        railBallMeshRef.current.position.y = 0.12 - progress * (0.12 - 0.03);
      }

      // Update LCD Chronometer Canvas
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

      // Update Exam Elapsed Clock Canvas
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
      gimbal.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [ballsList, selectedBall]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Keyboard Shortcut Floating Hint (Minimalist) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(15, 23, 42, 0.75)',
          color: '#cbd5e1',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'monospace',
          display: 'flex',
          gap: 12,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <span><strong style={{ color: '#f59e0b' }}>W</strong>: Mover (Gimbal)</span>
        <span><strong style={{ color: '#f59e0b' }}>E</strong>: Girar (Gimbal)</span>
        <span><strong style={{ color: '#f59e0b' }}>Esc</strong>: Desmarcar</span>
        <span><strong style={{ color: '#f59e0b' }}>Scroll</strong>: Zoom Milimétrico</span>
      </div>
    </div>
  );
};
