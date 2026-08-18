import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimpleOrbitControls } from '../controls/SimpleOrbitControls';
import { BallSpec, SandCraterExperimentState } from '../../../types/pholab';

export type SandCameraPreset =
  | 'overview'
  | 'craters_bowl'
  | 'stand_height'
  | 'inclined_rail'
  | 'chronometer'
  | 'task_sheet';

const PRESET_CONFIGS: Record<SandCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0, 0.75, 1.15], target: [0, 0.05, 0] },
  craters_bowl: { pos: [-0.22, 0.42, 0.28], target: [-0.22, 0.04, 0] },
  stand_height: { pos: [-0.22, 0.72, 0.55], target: [-0.22, 0.5, 0] },
  inclined_rail: { pos: [0.38, 0.55, 0.45], target: [0.38, 0.15, -0.05] },
  chronometer: { pos: [0.08, 0.32, 0.38], target: [0.08, 0.02, 0.22] },
  task_sheet: { pos: [-0.48, 0.45, 0.25], target: [-0.48, 0.02, 0.05] },
};

interface Sand3DViewportProps {
  cameraPreset: SandCameraPreset;
  state: SandCraterExperimentState;
  ballsList: BallSpec[];
  selectedBall: BallSpec;
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  onStirAndLevel: () => void;
  onRollRailBall: () => void;
  taskLines: string[];
  schemeLines: string[];
}

export const Sand3DViewport: React.FC<Sand3DViewportProps> = ({
  cameraPreset,
  state,
  ballsList,
  selectedBall,
  onDropBall,
  onStirAndLevel,
  onRollRailBall,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetCamPos = useRef(new THREE.Vector3(...PRESET_CONFIGS.overview.pos));
  const targetCamLook = useRef(new THREE.Vector3(...PRESET_CONFIGS.overview.target));
  const craterMeshRef = useRef<THREE.Mesh | null>(null);
  const dropBallMeshRef = useRef<THREE.Mesh | null>(null);
  const railBallMeshRef = useRef<THREE.Mesh | null>(null);

  // Update target camera position on preset change
  useEffect(() => {
    const config = PRESET_CONFIGS[cameraPreset] || PRESET_CONFIGS.overview;
    targetCamPos.current.set(...config.pos);
    targetCamLook.current.set(...config.target);
  }, [cameraPreset]);

  // Main Three.js Scene Setup & Animation Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120'); // Deep Slate Space Lab

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 50);
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
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going below desk
    controls.minDistance = 0.2;
    controls.maxDistance = 3.5;
    controls.target.set(...PRESET_CONFIGS.overview.target);

    // 4. Lighting (Clean Lab Studio)
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.65);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight('#fffbeb', 1.3);
    mainLight.position.set(2, 4, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight('#93c5fd', 0.4);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    // 5. Physical Desk (Polished Mahogany Wood)
    const tableGeom = new THREE.BoxGeometry(2.2, 0.06, 1.2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: '#3b2014',
      roughness: 0.35,
      metalness: 0.05,
    });
    const tableMesh = new THREE.Mesh(tableGeom, tableMat);
    tableMesh.position.set(0, -0.03, 0);
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    // Desk Grid Lines
    const gridHelper = new THREE.GridHelper(2.0, 20, '#f59e0b', '#334155');
    gridHelper.position.set(0, 0.001, 0);
    scene.add(gridHelper);

    // -------------------------------------------------------------
    // PART A: EXPERIMENTAL APPARATUS (Sand Bowl & Steel Balls Stand)
    // -------------------------------------------------------------
    const partAGroup = new THREE.Group();
    partAGroup.position.set(-0.22, 0, 0);

    // Wooden Base for Drop Stand (f1)
    const standBaseGeom = new THREE.BoxGeometry(0.35, 0.025, 0.28);
    const standBaseMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 });
    const standBaseMesh = new THREE.Mesh(standBaseGeom, standBaseMat);
    standBaseMesh.position.set(0, 0.0125, 0);
    standBaseMesh.castShadow = true;
    standBaseMesh.receiveShadow = true;
    partAGroup.add(standBaseMesh);

    // Vertical Stainless Steel Rod (f4) (1.2m tall)
    const rodGeom = new THREE.CylinderGeometry(0.008, 0.008, 1.15, 24);
    const rodMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 });
    const rodMesh = new THREE.Mesh(rodGeom, rodMat);
    rodMesh.position.set(0.12, 0.585, -0.08);
    rodMesh.castShadow = true;
    partAGroup.add(rodMesh);

    // Graduated Millimeter Markings on Rod
    for (let h = 0.1; h <= 1.0; h += 0.1) {
      const ringGeom = new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 16);
      const ringMat = new THREE.MeshStandardMaterial({ color: h % 0.5 === 0 ? '#ef4444' : '#1e293b' });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(0.12, h, -0.08);
      partAGroup.add(ringMesh);
    }

    // Height Clamping Collar & Release Arm (f2, f3)
    const collarGroup = new THREE.Group();
    collarGroup.position.set(0.12, 0.5, -0.08);

    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.6, roughness: 0.3 })
    );
    collarGroup.add(collarMesh);

    const armMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 })
    );
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(-0.07, 0, 0.08);
    collarGroup.add(armMesh);
    partAGroup.add(collarGroup);

    // Active Drop Ball in arm
    const dropBallGeom = new THREE.SphereGeometry(0.012, 24, 24);
    const dropBallMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.95, roughness: 0.1 });
    const dropBallMesh = new THREE.Mesh(dropBallGeom, dropBallMat);
    dropBallMesh.position.set(-0.14, 0, 0.08);
    dropBallMesh.castShadow = true;
    collarGroup.add(dropBallMesh);
    dropBallMeshRef.current = dropBallMesh;

    // Sand Box / Bowl (b)
    const bowlOuterGeom = new THREE.CylinderGeometry(0.11, 0.09, 0.05, 32);
    const bowlOuterMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 });
    const bowlOuterMesh = new THREE.Mesh(bowlOuterGeom, bowlOuterMat);
    bowlOuterMesh.position.set(-0.02, 0.035, 0.03);
    bowlOuterMesh.castShadow = true;
    bowlOuterMesh.receiveShadow = true;
    partAGroup.add(bowlOuterMesh);

    // Procedural Sand Surface (Deformable Mesh)
    const sandGeom = new THREE.CylinderGeometry(0.105, 0.105, 0.045, 48, 8);
    const sandMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.95,
      metalness: 0.0,
      bumpScale: 0.02,
    });
    const sandMesh = new THREE.Mesh(sandGeom, sandMat);
    sandMesh.position.set(-0.02, 0.038, 0.03);
    sandMesh.receiveShadow = true;
    partAGroup.add(sandMesh);
    craterMeshRef.current = sandMesh;

    // Steel Balls Stand Tray with 4 Balls
    const trayGeom = new THREE.BoxGeometry(0.18, 0.015, 0.08);
    const trayMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
    const trayMesh = new THREE.Mesh(trayGeom, trayMat);
    trayMesh.position.set(0.04, 0.01, -0.16);
    trayMesh.castShadow = true;
    partAGroup.add(trayMesh);

    ballsList.forEach((ball, idx) => {
      const bGeom = new THREE.SphereGeometry(Math.max(0.003, ball.diameterMm / 1000), 16, 16);
      const bMat = new THREE.MeshStandardMaterial({
        color: ball.id === selectedBall.id ? '#f59e0b' : '#94a3b8',
        metalness: 0.9,
        roughness: 0.15,
      });
      const bMesh = new THREE.Mesh(bGeom, bMat);
      bMesh.position.set(-0.06 + idx * 0.04, 0.02 + ball.diameterMm / 2000, -0.16);
      bMesh.castShadow = true;
      partAGroup.add(bMesh);
    });

    scene.add(partAGroup);

    // -------------------------------------------------------------
    // PART B: INCLINED ALUMINUM RAIL & SAND TRACK (1m Rail at 5°)
    // -------------------------------------------------------------
    const partBGroup = new THREE.Group();
    partBGroup.position.set(0.38, 0, 0);

    const thetaRad = (5.0 * Math.PI) / 180;

    // Aluminum V-profile Rail (1m)
    const railGeom = new THREE.BoxGeometry(0.025, 0.015, 0.95);
    const railMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.2 });
    const railMesh = new THREE.Mesh(railGeom, railMat);
    railMesh.position.set(0, 0.082, -0.28);
    railMesh.rotation.x = thetaRad;
    railMesh.castShadow = true;
    partBGroup.add(railMesh);

    // Rail Rolling Ball
    const railBallGeom = new THREE.SphereGeometry(0.006, 20, 20);
    const railBallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 });
    const railBallMesh = new THREE.Mesh(railBallGeom, railBallMat);
    railBallMesh.position.set(0, 0.12, -0.65);
    railBallMesh.castShadow = true;
    partBGroup.add(railBallMesh);
    railBallMeshRef.current = railBallMesh;

    // Wooden Braking Sand Track (60cm)
    const trackGeom = new THREE.BoxGeometry(0.08, 0.025, 0.55);
    const trackMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 });
    const trackMesh = new THREE.Mesh(trackGeom, trackMat);
    trackMesh.position.set(0, 0.0125, 0.28);
    trackMesh.castShadow = true;
    partBGroup.add(trackMesh);

    // Sand Layer in track
    const sandLayerGeom = new THREE.BoxGeometry(0.07, 0.015, 0.53);
    const sandLayerMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.95 });
    const sandLayerMesh = new THREE.Mesh(sandLayerGeom, sandLayerMat);
    sandLayerMesh.position.set(0, 0.02, 0.28);
    sandLayerMesh.receiveShadow = true;
    partBGroup.add(sandLayerMesh);

    scene.add(partBGroup);

    // -------------------------------------------------------------
    // DIGITAL CHRONOMETER (k) ON DESK
    // -------------------------------------------------------------
    const chronoGroup = new THREE.Group();
    chronoGroup.position.set(0.08, 0.015, 0.22);

    const chronoBodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.015, 24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 })
    );
    chronoGroup.add(chronoBodyMesh);

    const lcdMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.002, 0.02),
      new THREE.MeshBasicMaterial({ color: '#047857' }) // Retro Green LCD
    );
    lcdMesh.position.set(0, 0.008, 0);
    chronoGroup.add(lcdMesh);
    scene.add(chronoGroup);

    // -------------------------------------------------------------
    // ANIMATION & RESIZE HANDLERS
    // -------------------------------------------------------------
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera interpolation towards active preset
      camera.position.lerp(targetCamPos.current, 0.06);
      controls.target.lerp(targetCamLook.current, 0.06);
      controls.update();

      // Dynamic collar height update
      collarGroup.position.y = THREE.MathUtils.lerp(
        collarGroup.position.y,
        0.05 + (state.dropHeightCm / 100) * 0.9,
        0.1
      );

      // Animate Ball Rolling along rail if active
      if (state.ballRolling && railBallMeshRef.current) {
        const t = (performance.now() * 0.001) % Math.max(1, state.ballTravelTimeS);
        const progress = t / Math.max(0.1, state.ballTravelTimeS);
        railBallMeshRef.current.position.z = -0.65 + progress * 0.85;
        railBallMeshRef.current.position.y = 0.12 - progress * (0.12 - 0.03);
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
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [ballsList, selectedBall]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};
