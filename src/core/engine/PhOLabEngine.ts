import * as THREE from 'three';
import { SimpleOrbitControls } from '../../components/3d/controls/SimpleOrbitControls';
import { KspGizmoController, KspGizmoMode } from '../../components/3d/controls/KspGizmoController';
import { KitBoxEntity } from '../../scene/kitbox/KitBoxEntity';
import { DeformableSandBowl } from '../../scene/apparatus/DeformableSandBowl';
import { StandApparatus } from '../../scene/apparatus/StandApparatus';
import { InclinedRailTrack } from '../../scene/apparatus/InclinedRailTrack';
import { BallsTrayEntity } from '../../scene/apparatus/BallsTrayEntity';
import { ChronometerEntity } from '../../scene/instruments/ChronometerEntity';
import { AcrylicRulerEntity, StirringSpoonEntity } from '../../scene/instruments/AcrylicRulerEntity';
import { BallSpec } from '../../domain/types/entities';

export interface PhOLabEngineCallbacks {
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  onRollRailBall: () => void;
  onToggleChronometer: () => void;
  onResetChronometer: () => void;
  onSelectComponent: (componentName: string | null) => void;
}

export class PhOLabEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: SimpleOrbitControls;
  public gizmo: KspGizmoController;

  // Scene Entities
  public kitBox: KitBoxEntity;
  public sandBowl: DeformableSandBowl;
  public stand: StandApparatus;
  public railTrack: InclinedRailTrack;
  public ballsTray: BallsTrayEntity;
  public chronometer: ChronometerEntity;
  public ruler: AcrylicRulerEntity;
  public spoon: StirringSpoonEntity;

  // Physics animation state
  public isFalling = false;
  public ballPos = new THREE.Vector3();
  public ballVel = new THREE.Vector3();
  public isRolling = false;
  public rollDistance = 0;
  public rollVel = 0;

  private domElement: HTMLElement;
  private animationFrameId = 0;
  private callbacks: PhOLabEngineCallbacks;
  private ballsList: BallSpec[];
  private targetCamPos = new THREE.Vector3(0, 0.75, 1.2);
  private targetCamLook = new THREE.Vector3(0, 0.05, 0);

  constructor(
    container: HTMLElement,
    ballsList: BallSpec[],
    selectedBall: BallSpec,
    callbacks: PhOLabEngineCallbacks
  ) {
    this.domElement = container;
    this.callbacks = callbacks;
    this.ballsList = ballsList;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1120');

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.02, 50);
    this.camera.position.copy(this.targetCamPos);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 3. Camera Controls (CAD Pan & Zoom)
    this.controls = new SimpleOrbitControls(this.camera, this.renderer.domElement);

    // 4. KSP Gizmo Controller
    this.gizmo = new KspGizmoController(this.camera, this.renderer.domElement);
    this.gizmo.onDragStart = () => {
      this.controls.isLocked = true;
    };
    this.gizmo.onDragEnd = () => {
      this.controls.isLocked = false;
    };
    this.scene.add(this.gizmo.group);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.7);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight('#fffbeb', 1.4);
    mainLight.position.set(2.5, 4, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    fillLight.position.set(-3, 2, -2);
    this.scene.add(fillLight);

    // 6. Workbench Table
    const tableGeom = new THREE.BoxGeometry(2.4, 0.06, 1.4);
    const tableMat = new THREE.MeshStandardMaterial({ color: '#2d1810', roughness: 0.35, metalness: 0.05 });
    const tableMesh = new THREE.Mesh(tableGeom, tableMat);
    tableMesh.position.set(0, -0.03, 0);
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);

    const gridHelper = new THREE.GridHelper(2.2, 22, '#f59e0b', '#334155');
    gridHelper.position.set(0, 0.001, 0);
    this.scene.add(gridHelper);

    // 7. Instantiate Entities in Kit Box
    this.kitBox = new KitBoxEntity();
    this.sandBowl = new DeformableSandBowl();
    this.stand = new StandApparatus();
    this.railTrack = new InclinedRailTrack();
    this.ballsTray = new BallsTrayEntity(ballsList, selectedBall.id);
    this.chronometer = new ChronometerEntity();
    this.ruler = new AcrylicRulerEntity();
    this.spoon = new StirringSpoonEntity();

    this.scene.add(
      this.kitBox.group,
      this.sandBowl.group,
      this.stand.baseGroup,
      this.stand.rodGroup,
      this.stand.collarGroup,
      this.railTrack.railGroup,
      this.railTrack.trackGroup,
      this.ballsTray.group,
      this.chronometer.group,
      this.ruler.group,
      this.spoon.group
    );

    this.bindEvents();
    this.startLoop();
  }

  public setCameraTarget(pos: [number, number, number], target: [number, number, number]) {
    this.targetCamPos.set(...pos);
    this.targetCamLook.set(...target);
  }

  public triggerDropBall() {
    if (this.isFalling) return;
    const collarPos = new THREE.Vector3();
    this.stand.collarGroup.getWorldPosition(collarPos);
    this.ballPos.set(collarPos.x - 0.13, collarPos.y, collarPos.z + 0.07);
    this.ballVel.set(0, 0, 0);
    this.isFalling = true;
    this.callbacks.onDropBall();
  }

  public triggerRollBall() {
    if (this.isRolling) return;
    this.isRolling = true;
    this.rollDistance = 0;
    this.rollVel = 0;
    this.callbacks.onRollRailBall();
  }

  private onPointerClick = (e: MouseEvent) => {
    if (this.gizmo.isDragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      let hitObj: THREE.Object3D | null = intersects[0].object;

      if (hitObj.name === 'button_chrono_start') {
        this.callbacks.onToggleChronometer();
        return;
      }
      if (hitObj.name === 'button_chrono_reset') {
        this.callbacks.onResetChronometer();
        return;
      }
      if (hitObj.name === 'trigger_drop_ball') {
        this.triggerDropBall();
        return;
      }
      if (hitObj.name === 'trigger_roll_ball') {
        this.triggerRollBall();
        return;
      }

      if (hitObj.name && hitObj.name.startsWith('ball_selector_')) {
        const ballId = hitObj.name.replace('ball_selector_', '');
        const ball = this.ballsList.find((b) => b.id === ballId);
        if (ball) {
          this.callbacks.onSelectBall(ball);
          this.stand.updateBallSpec(ball);
          return;
        }
      }

      while (hitObj && hitObj.parent && hitObj.parent !== this.scene && !hitObj.name.startsWith('component_')) {
        hitObj = hitObj.parent;
      }

      if (hitObj && hitObj.name.startsWith('component_') && hitObj.name !== 'component_kit_box') {
        // If piece is inside the kit box (x > 0.35, z > 0.15), pull it to the table center
        if (hitObj.position.x > 0.35 && hitObj.position.z > 0.15) {
          hitObj.position.set(0, 0.05, 0);
        }
        this.callbacks.onSelectComponent(hitObj.name);
        this.gizmo.attach(hitObj);
      } else {
        this.callbacks.onSelectComponent(null);
        this.gizmo.attach(null);
      }
    }
  };

  private bindEvents() {
    this.renderer.domElement.addEventListener('click', this.onPointerClick);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.domElement) return;
    const w = this.domElement.clientWidth || window.innerWidth;
    const h = this.domElement.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private startLoop() {
    let lastTime = performance.now();

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;

      this.camera.position.lerp(this.targetCamPos, 0.07);
      this.controls.target.lerp(this.targetCamLook, 0.07);
      this.controls.update();

      this.gizmo.updateScale();

      // Ball Free-fall Physics Loop
      if (this.isFalling) {
        this.ballVel.y -= 9.81 * dt;
        this.ballPos.y += this.ballVel.y * dt;
        this.stand.dropBallMesh.position.copy(this.ballPos);

        const sandSurfaceY = this.sandBowl.group.position.y + 0.024;
        if (this.ballPos.y <= sandSurfaceY) {
          this.ballPos.y = sandSurfaceY;
          this.isFalling = false;
          this.sandBowl.carveCrater(23.8);
        }
      }

      // Ball Rolling Physics Loop
      if (this.isRolling) {
        const sin5 = Math.sin((5.0 * Math.PI) / 180);
        const aRoll = (5 / 7) * 9.81 * sin5;

        if (this.rollDistance < 0.85) {
          this.rollVel += aRoll * dt;
          this.rollDistance += this.rollVel * dt;

          const progress = this.rollDistance / 0.85;
          this.railTrack.railBallMesh.position.z = -0.37 + progress * 0.85;
          this.railTrack.railBallMesh.position.y = 0.04 - progress * (0.04 - 0.015);
          this.railTrack.railBallMesh.rotation.x += (this.rollVel / 0.006) * dt;
        } else {
          const aBrake = -0.8 * 9.81;
          this.rollVel = Math.max(0, this.rollVel + aBrake * dt);
          this.rollDistance += this.rollVel * dt;

          const sandProgress = this.rollDistance - 0.85;
          this.railTrack.railBallMesh.position.z = 0.48 + sandProgress;
          this.railTrack.railBallMesh.position.y = 0.015;
          this.railTrack.railBallMesh.rotation.x += (this.rollVel / 0.006) * dt;

          if (this.rollVel <= 0) {
            this.isRolling = false;
          }
        }
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  public dispose() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('click', this.onPointerClick);
    this.gizmo.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.domElement.contains(this.renderer.domElement)) {
      this.domElement.removeChild(this.renderer.domElement);
    }
  }
}
