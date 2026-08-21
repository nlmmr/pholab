import * as THREE from 'three';
import { SimpleOrbitControls } from '../../../components/3d/controls/SimpleOrbitControls';
import { IPhO2024E2State, isLaserEmitting, patternVisibility } from '../state';
import { visualPhase } from '../physics';
import { PhaseStepPattern } from './PhaseStepPattern';

export type InteractionId =
  | 'kit-lid'
  | 'platform'
  | 's1-holder'
  | 'screen'
  | 'electronics'
  | 'power-bank'
  | 'laser-switch'
  | 'laser-height-knob'
  | 'lens-height-knob'
  | 'rotation-knob'
  | 'protractor'
  | `fastening-${number}`;

export type FocusTarget = 'overview' | 'kit' | 'apparatus' | 'electronics' | 'screen' | 'angle' | 'laser' | 'lens';

export interface EngineCallbacks {
  onSelect: (id: InteractionId | null) => void;
  onLoosenRod: (index: number) => void;
  onToggleLaserSwitch: () => void;
  onSetAngle: (angleDeg: number) => void;
  onSetLaserHeight: (height: number) => void;
  onSetLensHeight: (height: number) => void;
}

const CAMERA_VIEWS: Record<FocusTarget, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: { position: new THREE.Vector3(2.35, 1.85, 2.75), target: new THREE.Vector3(0.05, 0.18, 0) },
  kit: { position: new THREE.Vector3(-1.72, 1.35, 1.45), target: new THREE.Vector3(-1.1, 0.17, 0.1) },
  apparatus: { position: new THREE.Vector3(1.4, 1.15, 1.6), target: new THREE.Vector3(0.05, 0.28, 0) },
  electronics: { position: new THREE.Vector3(0.15, 1.05, 1.8), target: new THREE.Vector3(0, 0.1, 0.78) },
  screen: { position: new THREE.Vector3(2.08, 0.58, 0.16), target: new THREE.Vector3(1.37, 0.43, 0) },
  angle: { position: new THREE.Vector3(0.02, 1.55, 0.44), target: new THREE.Vector3(0.02, 0.08, 0) },
  laser: { position: new THREE.Vector3(-0.76, 0.94, 1.28), target: new THREE.Vector3(-0.59, 0.46, 0) },
  lens: { position: new THREE.Vector3(0.8, 0.94, 1.28), target: new THREE.Vector3(0.62, 0.46, 0) },
};

const material = (color: THREE.ColorRepresentation, roughness = 0.52, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function mesh(
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  position: [number, number, number],
  castShadow = true,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.castShadow = castShadow;
  object.receiveShadow = true;
  return object;
}

function markInteractive(object: THREE.Object3D, id: InteractionId): void {
  object.userData.interactionId = id;
  object.traverse((child) => {
    child.userData.interactionId = id;
  });
}

function makeTextSprite(text: string, color = '#172033', fontSize = 42): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `700 ${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(0.44, 0.11, 1);
  return sprite;
}

function makeProtractorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const center = 512;
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.beginPath();
  ctx.arc(center, center, 470, 0, Math.PI * 2);
  ctx.arc(center, center, 330, 0, Math.PI * 2, true);
  ctx.fillStyle = '#f6f3e8';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#172033';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(center, center, 470, 0, Math.PI * 2);
  ctx.stroke();

  for (let angle = -90; angle <= 90; angle += 1) {
    const radians = (angle * Math.PI) / 180;
    const major = angle % 10 === 0;
    const medium = angle % 5 === 0;
    const outer = 458;
    const inner = major ? 396 : medium ? 416 : 430;
    const x1 = center + Math.cos(radians) * inner;
    const y1 = center + Math.sin(radians) * inner;
    const x2 = center + Math.cos(radians) * outer;
    const y2 = center + Math.sin(radians) * outer;
    ctx.strokeStyle = major ? '#111827' : '#465166';
    ctx.lineWidth = major ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (major && Math.abs(angle) <= 80) {
      ctx.save();
      ctx.translate(center + Math.cos(radians) * 365, center + Math.sin(radians) * 365);
      ctx.rotate(radians + Math.PI / 2);
      ctx.fillStyle = '#172033';
      ctx.font = '700 34px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.abs(angle)), 0, 0);
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function cableCurve(points: THREE.Vector3[], color: THREE.ColorRepresentation): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, 24, 0.012, 6, false);
  return mesh(tube, material(color, 0.75), [0, 0, 0], false);
}

export class IPhO2024E2Engine {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: SimpleOrbitControls;
  private readonly callbacks: EngineCallbacks;
  private readonly host: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private frame = 0;
  private state: IPhO2024E2State | null = null;
  private selected: THREE.Object3D | null = null;
  private hovered: THREE.Object3D | null = null;
  private drag: { type: 'angle' | 'laser' | 'lens'; startX: number; startY: number; startValue: number; moved: boolean } | null = null;
  private targetPosition = CAMERA_VIEWS.overview.position.clone();
  private targetLook = CAMERA_VIEWS.overview.target.clone();

  private readonly kitGroup = new THREE.Group();
  private readonly lidGroup = new THREE.Group();
  private readonly platformGroup = new THREE.Group();
  private readonly protractorGroup = new THREE.Group();
  private readonly s1Group = new THREE.Group();
  private readonly screenGroup = new THREE.Group();
  private readonly electronicsGroup = new THREE.Group();
  private readonly laserAssembly = new THREE.Group();
  private readonly lensAssembly = new THREE.Group();
  private readonly fasteningRods: THREE.Object3D[] = [];
  private readonly laserCable: THREE.Object3D;
  private readonly powerCable: THREE.Object3D;
  private readonly laserBeam: THREE.Mesh;
  private readonly pattern: PhaseStepPattern;
  private readonly screenPattern: THREE.Mesh;
  private readonly laserIndicator: THREE.Mesh;

  constructor(host: HTMLElement, callbacks: EngineCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    this.scene.background = new THREE.Color('#dfe5e5');
    this.scene.fog = new THREE.Fog('#dfe5e5', 4.8, 8.2);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.025, 20);
    this.camera.position.copy(this.targetPosition);
    this.renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio <= 1.5, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 760 ? 1.35 : 1.8));
    this.renderer.shadowMap.enabled = width >= 760;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive IPhO 2024 optical experiment');
    this.renderer.domElement.style.touchAction = 'none';
    host.appendChild(this.renderer.domElement);

    this.controls = new SimpleOrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.targetLook);
    this.controls.minDistance = 0.34;
    this.controls.maxDistance = 4.6;

    this.addEnvironment();
    this.addKit();
    this.addPlatform();
    this.addScreen();
    const electrical = this.addElectronics();
    this.laserCable = electrical.laserCable;
    this.powerCable = electrical.powerCable;
    this.laserIndicator = electrical.indicator;
    this.laserBeam = this.addBeam();
    this.pattern = new PhaseStepPattern();
    this.screenPattern = this.addPatternPlane(this.pattern.texture);

    this.bindEvents();
    this.animate();
  }

  private addEnvironment(): void {
    this.scene.add(new THREE.HemisphereLight('#f8fbfb', '#8e8478', 0.86));
    const key = new THREE.DirectionalLight('#fff8e9', 1.08);
    key.position.set(-2.4, 4, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    this.scene.add(key);

    const table = mesh(new THREE.BoxGeometry(4.6, 0.12, 2.4), material('#bcb4a7', 0.82), [0, -0.07, 0]);
    table.receiveShadow = true;
    this.scene.add(table);
    const backWall = mesh(new THREE.PlaneGeometry(5.8, 2.8), material('#e9ece8', 0.95), [0, 1.35, -1.25], false);
    this.scene.add(backWall);
  }

  private addKit(): void {
    this.kitGroup.position.set(-1.22, 0.05, 0.05);
    const lower = mesh(new THREE.BoxGeometry(1.38, 0.28, 1.26), material('#20252a', 0.75), [0, 0.14, 0]);
    lower.geometry.translate(0, 0, 0);
    markInteractive(lower, 'kit-lid');
    this.kitGroup.add(lower);

    this.lidGroup.position.set(0, 0.29, -0.58);
    const lid = mesh(new THREE.BoxGeometry(1.38, 0.12, 1.18), material('#e6a622', 0.6), [0, 0.03, 0.55]);
    markInteractive(lid, 'kit-lid');
    this.lidGroup.add(lid);
    const label = makeTextSprite('OPTICS SET', '#111827', 52);
    label.position.set(0, 0.101, 0.55);
    label.rotation.x = -Math.PI / 2;
    this.lidGroup.add(label);
    this.kitGroup.add(this.lidGroup);

    const rodPositions: [number, number, number][] = [
      [-0.44, 0.37, -0.35], [0.44, 0.37, -0.35], [-0.44, 0.37, 0.35], [0.44, 0.37, 0.35],
    ];
    rodPositions.forEach((position, index) => {
      const rod = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 16), material('#f5f4e9'), position);
      markInteractive(rod, `fastening-${index}`);
      this.fasteningRods.push(rod);
      this.kitGroup.add(rod);
    });
    this.scene.add(this.kitGroup);
  }

  private addPlatform(): void {
    markInteractive(this.platformGroup, 'platform');
    const base = mesh(new THREE.BoxGeometry(1.55, 0.06, 0.9), material('#293139', 0.58, 0.22), [0, 0.03, 0]);
    this.platformGroup.add(base);

    const protractorTexture = makeProtractorTexture();
    const scale = mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshStandardMaterial({ map: protractorTexture, transparent: true, roughness: 0.72, side: THREE.DoubleSide }),
      [0, 0.072, 0],
      false,
    );
    scale.rotation.x = -Math.PI / 2;
    markInteractive(scale, 'protractor');
    this.protractorGroup.add(scale);
    const centralPlate = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.035, 48), material('#aeb4b6', 0.42, 0.62), [0, 0.064, 0]);
    this.protractorGroup.add(centralPlate);

    const holderRing = mesh(new THREE.TorusGeometry(0.25, 0.018, 10, 48), material('#aeb4b6', 0.34, 0.72), [0, 0.16, 0]);
    holderRing.rotation.x = Math.PI / 2;
    this.s1Group.add(holderRing);
    const posts = [-0.22, 0.22].map((z) => mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 12), material('#c8ced0', 0.3, 0.78), [0, 0.37, z]));
    this.s1Group.add(...posts);
    const clamp = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), material('#171b20', 0.66), [0, 0.55, 0]);
    this.s1Group.add(clamp);
    const slide = mesh(
      new THREE.BoxGeometry(0.012, 0.34, 0.28),
      new THREE.MeshPhysicalMaterial({ color: '#cbe7e7', transparent: true, opacity: 0.42, roughness: 0.08, transmission: 0.35 }),
      [0, 0.35, 0],
      false,
    );
    this.s1Group.add(slide);
    markInteractive(this.s1Group, 's1-holder');
    this.protractorGroup.add(this.s1Group);

    const reference = mesh(new THREE.BoxGeometry(0.025, 0.025, 0.12), material('#d63d35', 0.48), [0.48, 0.092, 0], false);
    this.platformGroup.add(reference);

    this.addVerticalAssembly(this.laserAssembly, -0.64, 'laser');
    this.addVerticalAssembly(this.lensAssembly, 0.64, 'lens');
    this.platformGroup.add(this.protractorGroup, this.laserAssembly, this.lensAssembly);

    const rotationKnob = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 20), material('#e9e6dc', 0.52), [0.47, 0.12, 0.37]);
    rotationKnob.rotation.x = Math.PI / 2;
    markInteractive(rotationKnob, 'rotation-knob');
    this.platformGroup.add(rotationKnob);
    this.scene.add(this.platformGroup);
  }

  private addVerticalAssembly(group: THREE.Group, x: number, kind: 'laser' | 'lens'): void {
    group.position.x = x;
    const foot = mesh(new THREE.BoxGeometry(0.18, 0.05, 0.32), material('#171c22', 0.66), [0, 0.025, 0]);
    const posts = [-0.11, 0.11].map((z) => mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.68, 12), material('#bfc5c7', 0.3, 0.74), [0, 0.35, z]));
    group.add(foot, ...posts);
    const carriage = new THREE.Group();
    carriage.name = `${kind}-carriage`;
    const body = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), material('#151a1f', 0.62), [0, 0, 0]);
    carriage.add(body);
    if (kind === 'laser') {
      const emitter = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 20), material('#b92525', 0.35, 0.25), [0.12, 0, 0]);
      emitter.rotation.z = Math.PI / 2;
      carriage.add(emitter);
    } else {
      const lens = mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.018, 28),
        new THREE.MeshPhysicalMaterial({ color: '#a9d6db', transparent: true, opacity: 0.62, roughness: 0.08, transmission: 0.45 }),
        [0, 0, 0],
        false,
      );
      lens.rotation.z = Math.PI / 2;
      carriage.add(lens);
    }
    group.add(carriage);
    const knob = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 20), material('#161b20', 0.72), [0, 0.78, 0.2]);
    knob.rotation.x = Math.PI / 2;
    markInteractive(knob, kind === 'laser' ? 'laser-height-knob' : 'lens-height-knob');
    group.add(knob);
  }

  private addScreen(): void {
    markInteractive(this.screenGroup, 'screen');
    const foot = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.18), material('#20262b', 0.7), [0, 0.03, 0]);
    const frame = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.72), material('#333a40', 0.6), [0, 0.39, 0]);
    const face = mesh(new THREE.PlaneGeometry(0.62, 0.48), material('#e4e4df', 0.96), [0.028, 0.42, 0], false);
    face.rotation.y = Math.PI / 2;
    this.screenGroup.add(foot, frame, face);
    this.scene.add(this.screenGroup);
  }

  private addElectronics(): { laserCable: THREE.Object3D; powerCable: THREE.Object3D; indicator: THREE.Mesh } {
    this.electronicsGroup.position.set(-0.08, 0.04, 0.75);
    markInteractive(this.electronicsGroup, 'electronics');
    const board = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.38), material('#efede4', 0.72), [0, 0.04, 0]);
    const display = mesh(new THREE.BoxGeometry(0.23, 0.012, 0.08), material('#14384d', 0.36), [0.05, 0.09, -0.05], false);
    const indicator = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), material('#3e474b'), [-0.19, 0.094, 0.08], false);
    const label = makeTextSprite('LASER CURRENT', '#252a30', 34);
    label.position.set(0, 0.105, -0.14);
    label.rotation.x = -Math.PI / 2;
    label.scale.set(0.38, 0.095, 1);
    this.electronicsGroup.add(board, display, indicator, label);
    const toggle = mesh(new THREE.BoxGeometry(0.09, 0.05, 0.055), material('#a12222', 0.48), [-0.18, 0.11, 0.02]);
    markInteractive(toggle, 'laser-switch');
    this.electronicsGroup.add(toggle);
    this.scene.add(this.electronicsGroup);

    const bank = new THREE.Group();
    bank.position.set(0.74, 0.045, 0.78);
    const bankBody = mesh(new THREE.BoxGeometry(0.46, 0.07, 0.25), material('#20252b', 0.58), [0, 0.035, 0]);
    bank.add(bankBody);
    markInteractive(bank, 'power-bank');
    this.scene.add(bank);

    const laserCable = cableCurve([
      new THREE.Vector3(-0.31, 0.09, 0.72),
      new THREE.Vector3(-0.48, 0.04, 0.54),
      new THREE.Vector3(-0.65, 0.12, 0.2),
      new THREE.Vector3(-0.65, 0.35, 0.05),
    ], '#202328');
    const powerCable = cableCurve([
      new THREE.Vector3(0.25, 0.09, 0.78),
      new THREE.Vector3(0.44, 0.04, 0.9),
      new THREE.Vector3(0.62, 0.08, 0.8),
    ], '#ece8db');
    this.scene.add(laserCable, powerCable);
    return { laserCable, powerCable, indicator };
  }

  private addBeam(): THREE.Mesh {
    const beam = mesh(
      new THREE.CylinderGeometry(0.006, 0.013, 2.1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff2d23', transparent: true, opacity: 0.68, depthWrite: false }),
      [0.25, 0.45, 0],
      false,
    );
    beam.rotation.z = Math.PI / 2;
    this.scene.add(beam);
    return beam;
  }

  private addPatternPlane(texture: THREE.Texture): THREE.Mesh {
    const pattern = mesh(
      new THREE.PlaneGeometry(0.57, 0.42),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }),
      [1.371, 0.43, 0],
      false,
    );
    pattern.rotation.y = -Math.PI / 2;
    pattern.renderOrder = 4;
    this.scene.add(pattern);
    return pattern;
  }

  sync(state: IPhO2024E2State): void {
    this.state = state;
    this.lidGroup.rotation.x = state.kit.lidOpen ? -Math.PI * 0.62 : 0;
    const lidMesh = this.lidGroup.children[0];
    if (lidMesh) lidMesh.userData.interactionId = state.kit.lidOpen ? undefined : 'kit-lid';
    this.fasteningRods.forEach((rod, index) => {
      rod.visible = !state.kit.platformPlaced;
      rod.position.y = state.kit.fasteningRodsLoose[index] ? 0.56 : 0.37;
      rod.rotation.y = state.kit.fasteningRodsLoose[index] ? Math.PI / 4 : 0;
    });

    if (state.kit.platformPlaced) {
      this.platformGroup.position.set(0.05, 0, -0.08);
      this.platformGroup.scale.setScalar(1);
    } else {
      this.platformGroup.position.set(-1.22, 0.31, 0.05);
      this.platformGroup.scale.setScalar(0.78);
    }
    this.platformGroup.visible = state.kit.lidOpen || state.kit.platformPlaced;

    if (state.apparatus.s1Installed) {
      this.s1Group.position.set(0, 0, 0);
      this.s1Group.visible = true;
    } else if (state.kit.s1Removed) {
      this.s1Group.position.set(0.94, -0.07, 0.56);
      this.s1Group.visible = true;
    } else {
      this.s1Group.position.set(0.02, -0.06, 0.24);
      this.s1Group.visible = state.kit.lidOpen;
    }
    this.protractorGroup.rotation.y = (state.apparatus.angleDeg * Math.PI) / 180;

    const laserCarriage = this.laserAssembly.getObjectByName('laser-carriage');
    const lensCarriage = this.lensAssembly.getObjectByName('lens-carriage');
    if (laserCarriage) laserCarriage.position.y = state.apparatus.laserHeight;
    if (lensCarriage) lensCarriage.position.y = state.apparatus.lensHeight;

    this.screenGroup.visible = state.kit.lidOpen || state.apparatus.screenPlaced;
    this.screenGroup.position.set(state.apparatus.screenPlaced ? 1.34 : -1.7, 0, state.apparatus.screenPlaced ? 0 : 0.65);
    this.laserCable.visible = state.electronics.laserToBoard;
    this.powerCable.visible = state.electronics.boardToPower;
    const emitting = isLaserEmitting(state);
    this.laserBeam.visible = emitting && state.kit.platformPlaced;
    const beamHeight = 0.12 + state.apparatus.laserHeight;
    this.laserBeam.position.y = beamHeight;
    const indicatorMaterial = this.laserIndicator.material as THREE.MeshStandardMaterial;
    indicatorMaterial.color.set(emitting ? '#ff3b30' : '#3e474b');

    const visibility = patternVisibility(state);
    this.pattern.update(visualPhase(state.apparatus.angleDeg), visibility);
    this.screenPattern.visible = state.apparatus.screenPlaced;
    this.screenPattern.position.set(1.371, 0.43, 0);
  }

  focus(target: FocusTarget): void {
    this.targetPosition.copy(CAMERA_VIEWS[target].position);
    this.targetLook.copy(CAMERA_VIEWS[target].target);
    this.controls.setView(this.targetPosition, this.targetLook);
  }

  private interactionFromEvent(event: PointerEvent): { id: InteractionId; object: THREE.Object3D } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of intersections) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        const id = object.userData.interactionId as InteractionId | undefined;
        if (id) return { id, object };
        object = object.parent;
      }
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const hit = this.interactionFromEvent(event);
    if (!hit || !this.state) return;
    const { id } = hit;
    if (id === 'rotation-knob' || id === 'protractor') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'angle', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.angleDeg, moved: false };
      this.controls.isLocked = true;
      this.focus('angle');
    } else if (id === 'laser-height-knob') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'laser', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.laserHeight, moved: false };
      this.controls.isLocked = true;
      this.focus('laser');
    } else if (id === 'lens-height-knob') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'lens', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.lensHeight, moved: false };
      this.controls.isLocked = true;
      this.focus('lens');
    }
    if (this.drag) this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.drag) {
      const dx = event.clientX - this.drag.startX;
      const dy = event.clientY - this.drag.startY;
      this.drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
      if (this.drag.type === 'angle') this.callbacks.onSetAngle(this.drag.startValue + dx * 0.12);
      if (this.drag.type === 'laser') this.callbacks.onSetLaserHeight(this.drag.startValue - dy * 0.0032);
      if (this.drag.type === 'lens') this.callbacks.onSetLensHeight(this.drag.startValue - dy * 0.0032);
      return;
    }
    const hit = this.interactionFromEvent(event);
    const object = hit?.object ?? null;
    if (object !== this.hovered) {
      this.setHighlight(this.hovered, false);
      this.hovered = object;
      this.setHighlight(this.hovered, true);
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag) {
      this.controls.isLocked = false;
      this.drag = null;
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
      return;
    }
    const hit = this.interactionFromEvent(event);
    if (!hit) {
      this.callbacks.onSelect(null);
      return;
    }
    const { id, object } = hit;
    this.setHighlight(this.selected, false);
    this.selected = object;
    this.setHighlight(this.selected, true);
    this.callbacks.onSelect(id);
    if (id.startsWith('fastening-')) this.callbacks.onLoosenRod(Number(id.split('-')[1]));
    if (id === 'laser-switch') this.callbacks.onToggleLaserSwitch();
    if (id === 'kit-lid') this.focus('kit');
    else if (id === 'screen') this.focus('screen');
    else if (id === 'electronics' || id === 'power-bank' || id === 'laser-switch') this.focus('electronics');
    else if (id === 's1-holder' || id === 'platform') this.focus(this.state?.kit.platformPlaced ? 'apparatus' : 'kit');
  };

  private setHighlight(object: THREE.Object3D | null, highlighted: boolean): void {
    object?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material;
      const materials = Array.isArray(mat) ? mat : [mat];
      materials.forEach((item) => {
        const standard = item as THREE.MeshStandardMaterial;
        if (!('emissive' in standard)) return;
        if (highlighted) {
          if (standard.userData.previousEmissive === undefined) standard.userData.previousEmissive = standard.emissive.getHex();
          standard.emissive.set('#326f77');
          standard.emissiveIntensity = 0.22;
        } else if (standard.userData.previousEmissive !== undefined) {
          standard.emissive.setHex(standard.userData.previousEmissive);
          standard.emissiveIntensity = 0;
        }
      });
    });
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 760 ? 1.35 : 1.8));
    this.renderer.shadowMap.enabled = width >= 760;
  };

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.pattern.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((item) => {
        const map = (item as THREE.MeshStandardMaterial).map;
        map?.dispose();
        item.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
