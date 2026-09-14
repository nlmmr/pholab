import * as THREE from 'three';
import { SimpleOrbitControls } from '../../../components/3d/controls/SimpleOrbitControls';
import { IPhO2024E2State, isLaserEmitting, patternVisibility } from '../state';
import { visualPhase, resolvePhaseParameters } from '../physics';
import { PhaseStepPattern } from './PhaseStepPattern';
import {
  FastenerEntity,
  DigitalDisplayMesh,
  SocketPort,
  FluidMediumContainer,
} from '../../../core/primitives';
import { AudioManager } from '../../../core/audio/AudioManager';
import { LabEnvironment } from '../../../core/engine/LabEnvironment';
import { CameraCalibration } from '../../../components/HUDOverlayRuler';

export type { CameraCalibration };

export type InteractionId =
  | 'kit-lid'
  | 'platform'
  | 's1-holder'
  | 's2-holder'
  | 'cuvette'
  | 'pink-bottle'
  | 'screen'
  | 'electronics'
  | 'power-bank'
  | 'laser-switch'
  | 'current-knob'
  | 'laser-height-knob'
  | 'lens-height-knob'
  | 'rotation-knob'
  | 'protractor'
  | 'red-orings'
  | 'paper'
  | `fastening-${number}`;

export type FocusTarget =
  | 'overview'
  | 'kit'
  | 'apparatus'
  | 'electronics'
  | 'screen'
  | 'angle'
  | 'laser'
  | 'lens'
  | 'paper';

export interface EngineCallbacks {
  onSelect: (id: InteractionId | null) => void;
  onLoosenRod: (index: number) => void;
  onToggleLaserSwitch: () => void;
  onSetAngle: (angleDeg: number) => void;
  onSetLaserHeight: (height: number) => void;
  onSetLensHeight: (height: number) => void;
  onSetLaserCurrent?: (currentMa: number) => void;
  onRemoveOrings?: () => void;
  onPeelCuvette?: () => void;
  onPourLiquid?: () => void;
  onSetItemPosition?: (id: string, x: number, z: number) => void;
  onFocusChange?: (target: FocusTarget) => void;
  onInstallS1?: () => void;
  onInstallS2?: () => void;
  onPlaceCuvette?: () => void;
  onExtractItem?: (item: 'platform' | 's1' | 's2' | 'cuvette' | 'bottle' | 'screen' | 'electronics' | 'power-bank') => void;
  onStoreItem?: (item: 'platform' | 's1' | 's2' | 'cuvette' | 'bottle' | 'screen' | 'electronics' | 'power-bank') => void;
  onCalibrationChange?: (calibration: CameraCalibration) => void;
}

const CAMERA_VIEWS: Record<FocusTarget, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: { position: new THREE.Vector3(2.6, 2.1, 3.2), target: new THREE.Vector3(0.0, 0.15, 0) },
  kit: { position: new THREE.Vector3(-2.2, 1.45, 1.7), target: new THREE.Vector3(-1.85, 0.17, 0.15) },
  apparatus: { position: new THREE.Vector3(1.4, 1.15, 1.6), target: new THREE.Vector3(0.05, 0.28, 0) },
  electronics: { position: new THREE.Vector3(0.15, 1.05, 1.8), target: new THREE.Vector3(0, 0.1, 0.78) },
  screen: { position: new THREE.Vector3(2.08, 0.58, 0.16), target: new THREE.Vector3(1.37, 0.43, 0) },
  angle: { position: new THREE.Vector3(0.02, 1.55, 0.44), target: new THREE.Vector3(0.02, 0.08, 0) },
  laser: { position: new THREE.Vector3(-0.76, 0.94, 1.28), target: new THREE.Vector3(-0.59, 0.46, 0) },
  lens: { position: new THREE.Vector3(0.8, 0.94, 1.28), target: new THREE.Vector3(0.62, 0.46, 0) },
  paper: { position: new THREE.Vector3(1.45, 1.35, 1.4), target: new THREE.Vector3(1.4, 0.05, 0.78) },
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

export function resolveFocusTarget(id: InteractionId | null, platformPlaced: boolean = true): FocusTarget {
  if (!id) return 'overview';
  if (id === 'kit-lid') return 'kit';
  if (id === 'screen') return 'screen';
  if (id === 'rotation-knob' || id === 'protractor') return 'angle';
  if (id === 'laser-height-knob' || (id as string) === 'laser') return 'laser';
  if (id === 'lens-height-knob' || (id as string) === 'lens') return 'lens';
  if (id === 'electronics' || id === 'power-bank' || id === 'current-knob' || id === 'laser-switch') return 'electronics';
  if (id === 'paper') return 'paper';
  if (
    id === 'platform' ||
    id === 's1-holder' ||
    id === 's2-holder' ||
    id === 'cuvette' ||
    id === 'pink-bottle' ||
    id === 'red-orings' ||
    id.startsWith('fastening-')
  ) {
    return platformPlaced ? 'apparatus' : 'kit';
  }
  return 'overview';
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

/**
 * Generates procedural diamond crosshatch knurling textures
 * (bump map and matching roughness map) for optical adjustment knobs.
 */
function createKnurlTextures(): { bump: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(256, 128);
  const data = imgData.data;

  for (let y = 0; y < 128; y += 1) {
    const v = (y / 128) * 8; // 8 vertical repetitions
    for (let x = 0; x < 256; x += 1) {
      const u = (x / 256) * 24; // 24 circumferential repetitions
      const d1 = ((u + v) % 1 + 1) % 1;
      const d2 = ((u - v) % 1 + 1) % 1;
      const h1 = Math.sin(Math.PI * d1);
      const h2 = Math.sin(Math.PI * d2);
      const pyramid = Math.max(0, h1 * h2);
      const bumpVal = Math.round(55 + pyramid * 200);
      const idx = (y * 256 + x) * 4;
      data[idx] = bumpVal;
      data[idx + 1] = bumpVal;
      data[idx + 2] = bumpVal;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 1);

  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 128;
  const rCtx = rCanvas.getContext('2d')!;
  const rData = rCtx.createImageData(256, 128);
  for (let i = 0; i < data.length; i += 4) {
    const bNorm = data[i] / 255;
    const roughVal = Math.round((0.55 - bNorm * 0.32) * 255);
    rData.data[i] = roughVal;
    rData.data[i + 1] = roughVal;
    rData.data[i + 2] = roughVal;
    rData.data[i + 3] = 255;
  }
  rCtx.putImageData(rData, 0, 0);

  const roughness = new THREE.CanvasTexture(rCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(1, 1);

  return { bump, roughness };
}

/**
 * Generates procedural longitudinal brushed metal streaks
 * for stainless steel vertical posts.
 */
function createBrushedSteelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b4bcc4';
  ctx.fillRect(0, 0, 256, 512);

  let seed = 24680;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 350; i += 1) {
    const x = rand() * 256;
    const length = 40 + rand() * 220;
    const y = rand() * 512;
    const alpha = 0.04 + rand() * 0.12;
    const isBright = rand() > 0.48;
    ctx.strokeStyle = isBright ? `rgba(248, 252, 255, ${alpha})` : `rgba(75, 82, 90, ${alpha})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
    if (y + length > 512) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, y + length - 512);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
}

/**
 * 2048x2048 Ultra-High-Resolution CanvasTexture for the precision goniometer
 * protractor scale with crisp 1°, 5°, 10° marks, degree numbers, and serigraphy.
 */
function makeProtractorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  const center = 1024;

  ctx.clearRect(0, 0, 2048, 2048);

  // Annular dial disc
  ctx.beginPath();
  ctx.arc(center, center, 950, 0, Math.PI * 2);
  ctx.arc(center, center, 670, 0, Math.PI * 2, true);
  const grad = ctx.createRadialGradient(center, center, 670, center, center, 950);
  grad.addColorStop(0, '#edf2f7');
  grad.addColorStop(0.65, '#f8fafc');
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fill('evenodd');

  // Concentric border rings
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(center, center, 950, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 920, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(center, center, 670, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle circular serigraphy
  ctx.save();
  ctx.font = '600 28px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRECISION ROTARY GONIOMETER • 1 DIV = 1.0°', center, center - 710);
  ctx.fillText('IPhO 2024 EXPERIMENTAL APPARATUS', center, center + 710);
  ctx.restore();

  // Graduations: -90 deg to +90 deg
  for (let angle = -90; angle <= 90; angle += 1) {
    const radians = (angle * Math.PI) / 180;
    const major = angle % 10 === 0;
    const medium = angle % 5 === 0;
    const outer = 920;
    const inner = major ? 830 : medium ? 865 : 888;

    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const x1 = center + cos * inner;
    const y1 = center + sin * inner;
    const x2 = center + cos * outer;
    const y2 = center + sin * outer;

    ctx.strokeStyle = major ? '#090d16' : medium ? '#1e293b' : '#64748b';
    ctx.lineWidth = major ? 7 : medium ? 4.5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (major && Math.abs(angle) <= 80) {
      ctx.save();
      const textRadius = 770;
      ctx.translate(center + cos * textRadius, center + sin * textRadius);
      ctx.rotate(radians + Math.PI / 2);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 48px "Inter", -apple-system, BlinkMacSystemFont, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.abs(angle)), 0, 0);
      ctx.restore();
    }
  }

  // Zero-degree fiducial red indicator line at center top (angle 0)
  const x0 = center;
  const y0 = center - 920;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 15);
  ctx.lineTo(x0, y0 + 100);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/**
 * Official serigraphy CanvasTexture for the laser current controller enclosure.
 */
function createElectronicsSerigraphyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 640);
  bgGrad.addColorStop(0, '#e2e8f0');
  bgGrad.addColorStop(0.5, '#cbd5e1');
  bgGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 640);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 1000, 616);

  // 4 Corner screws
  const screwPositions = [
    [40, 40], [984, 40], [40, 600], [984, 600],
  ];
  screwPositions.forEach(([sx, sy]) => {
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    for (let a = 0; a < 6; a += 1) {
      const ang = (a * Math.PI) / 3;
      const hx = sx + Math.cos(ang) * 9;
      const hy = sy + Math.sin(ang) * 9;
      if (a === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
  });

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 44px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LASER CURRENT CONTROLLER', 512, 75);

  ctx.fillStyle = '#334155';
  ctx.font = '600 20px "Inter", Arial, sans-serif';
  ctx.fillText('PRECISION CONSTANT CURRENT SOURCE • IPhO 2024', 512, 110);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(140, 125);
  ctx.lineTo(884, 125);
  ctx.stroke();

  // Left Section: Power & Toggle Switch
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 26px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POWER', 200, 190);

  ctx.font = '700 22px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#15803d';
  ctx.fillText('ON  ▲', 200, 235);
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('OFF ▼', 200, 425);

  // 5V IN Label & Icon
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 24px "Inter", Arial, sans-serif';
  ctx.fillText('5V DC IN', 200, 520);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.strokeRect(140, 535, 120, 45);
  ctx.font = '600 16px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText('USB-C', 200, 562);

  // Center Section: LCD Display Border Label
  ctx.fillStyle = '#0369a1';
  ctx.font = '700 22px "Inter", Arial, sans-serif';
  ctx.fillText('DIGITAL CURRENT MONITOR [mA]', 512, 185);

  // Right Section: Rotary Current Knob dial arc
  const knobX = 824;
  const knobY = 320;
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 24px "Inter", Arial, sans-serif';
  ctx.fillText('CURRENT ADJUST', knobX, 190);

  const arcR = 85;
  for (let val = 0; val <= 30; val += 2) {
    const frac = val / 30;
    const ang = (135 + frac * 270) * (Math.PI / 180);
    const major = val % 10 === 0;
    const r1 = arcR;
    const r2 = major ? arcR + 22 : arcR + 12;
    const x1 = knobX + Math.cos(ang) * r1;
    const y1 = knobY + Math.sin(ang) * r1;
    const x2 = knobX + Math.cos(ang) * r2;
    const y2 = knobY + Math.sin(ang) * r2;

    ctx.strokeStyle = major ? '#0f172a' : '#475569';
    ctx.lineWidth = major ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (major) {
      const tx = knobX + Math.cos(ang) * (arcR + 38);
      const ty = knobY + Math.sin(ang) * (arcR + 38);
      ctx.fillStyle = '#1e293b';
      ctx.font = '700 20px "Inter", Arial, sans-serif';
      ctx.fillText(String(val), tx, ty);
    }
  }

  // LASER OUT section & warning
  ctx.fillStyle = '#b91c1c';
  ctx.font = '800 26px "Inter", Arial, sans-serif';
  ctx.fillText('LASER OUT', knobX, 520);

  const wx = knobX;
  const wy = 560;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(wx, wy - 22);
  ctx.lineTo(wx + 25, wy + 18);
  ctx.lineTo(wx - 25, wy + 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.font = '800 24px Arial';
  ctx.fillText('▲', wx, wy + 14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
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
  private drag: {
    type: 'angle' | 'laser' | 'lens' | 'current' | 'item';
    id?: string;
    targetGroup?: THREE.Object3D;
    startX: number;
    startY: number;
    startValue: number;
    planeY?: number;
    grabOffsetX?: number;
    grabOffsetZ?: number;
    startPosX?: number;
    startPosZ?: number;
    wasInsideKit?: boolean;
    moved: boolean;
  } | null = null;

  private lastRightClickTime = 0;
  private lastRightClickPos = { x: 0, y: 0 };

  private targetPosition = CAMERA_VIEWS.overview.position.clone();
  private targetLook = CAMERA_VIEWS.overview.target.clone();
  private currentFocus: FocusTarget = 'overview';
  private lastCalibrationKey = '';

  private readonly environment: LabEnvironment;
  private readonly kitGroup = new THREE.Group();
  private readonly lidGroup = new THREE.Group();
  private readonly platformGroup = new THREE.Group();
  private readonly protractorGroup = new THREE.Group();
  private readonly s1Group = new THREE.Group();
  private readonly s2Group = new THREE.Group();
  private readonly cuvetteGroup = new THREE.Group();
  private cuvetteContainer!: FluidMediumContainer;
  private readonly bottleGroup = new THREE.Group();
  private readonly screenGroup = new THREE.Group();
  private readonly electronicsGroup = new THREE.Group();
  private readonly powerBankGroup = new THREE.Group();
  private readonly laserAssembly = new THREE.Group();
  private readonly lensAssembly = new THREE.Group();
  private readonly stageSlideSocket: SocketPort;
  private readonly stageCuvetteSocket: SocketPort;
  private readonly ghostGroup = new THREE.Group();
  private readonly ghostS1Group = new THREE.Group();
  private readonly ghostS2Group = new THREE.Group();
  private readonly ghostCuvetteGroup = new THREE.Group();
  private readonly ghostMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly fasteningEntities: FastenerEntity[] = [];
  private readonly redOringEntities: FastenerEntity[] = [];
  private readonly laserCable: THREE.Mesh;
  private readonly powerCable: THREE.Mesh;
  private readonly laserBeam: THREE.Mesh;
  private readonly pattern: PhaseStepPattern;
  private readonly screenPattern: THREE.Mesh;
  private readonly laserIndicator: THREE.Mesh;
  private readonly displayMesh: DigitalDisplayMesh;
  private toggleLever: THREE.Mesh | null = null;
  private currentKnobMesh: THREE.Mesh | null = null;

  private readonly knurlTextures: { bump: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  private readonly brushedSteelTexture: THREE.CanvasTexture;
  private readonly protractorTexture: THREE.CanvasTexture;
  private readonly electronicsTexture: THREE.CanvasTexture;

  constructor(host: HTMLElement, callbacks: EngineCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    // 0. Inicializar texturas e mapas procedurais PBR
    this.knurlTextures = createKnurlTextures();
    this.brushedSteelTexture = createBrushedSteelTexture();
    this.protractorTexture = makeProtractorTexture();
    this.electronicsTexture = createElectronicsSerigraphyTexture();

    this.stageSlideSocket = new SocketPort({
      id: 'stage-slide-socket',
      name: 'Rotating Stage Slide Socket',
      accepts: ['s1', 's2'],
      position: [0, 0.16, 0],
      toleranceRadius: 0.32,
      pinCount: 4,
    });
    this.stageCuvetteSocket = new SocketPort({
      id: 'stage-cuvette-socket',
      name: 'Rotating Stage Cuvette Socket',
      accepts: ['cuvette'],
      position: [0, 0.10, 0],
      toleranceRadius: 0.32,
      pinCount: 4,
    });

    this.scene.background = new THREE.Color('#dce2e2');
    this.scene.fog = new THREE.Fog('#dce2e2', 5.5, 9.5);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.025, 25);
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
    this.controls.minDistance = 0.28;
    this.controls.maxDistance = 4.8;

    // 1. Adicionar Cenário Físico do Laboratório (Mesa fórmica, relógio 3D e papel de prova)
    this.environment = new LabEnvironment();
    this.scene.add(this.environment.group);

    // 2. Adicionar componentes do Kit
    this.addKit();
    this.addPlatform();
    this.addAccessories();
    this.addScreen();

    const electrical = this.addElectronics();
    this.laserCable = electrical.laserCable;
    this.powerCable = electrical.powerCable;
    this.laserIndicator = electrical.indicator;
    this.displayMesh = electrical.display;

    this.laserBeam = this.addBeam();
    this.pattern = new PhaseStepPattern();
    this.screenPattern = this.addPatternPlane(this.pattern.texture);

    this.buildGhostMeshes();
    this.bindEvents();
    this.animate();
  }

  private addKit(): void {
    this.kitGroup.position.set(-1.85, 0.05, 0.15);

    // Caixa Externa (Estojo rígido preto com cantos arredondados)
    const lower = mesh(new THREE.BoxGeometry(1.46, 0.28, 1.28), material('#1e2329', 0.75), [0, 0.14, 0]);
    markInteractive(lower, 'kit-lid');
    this.kitGroup.add(lower);

    // Espuma Técnica Interna sob medida (preto-carvão de alta densidade)
    const foam = mesh(new THREE.BoxGeometry(1.40, 0.23, 1.22), material('#13161a', 0.96), [0, 0.125, 0]);
    this.kitGroup.add(foam);

    // Cavidades e Recortes na Espuma para cada equipamento
    const cavityMat = material('#090b0d', 0.98);
    // 1. Cavidade central para a plataforma
    const platCavity = mesh(new THREE.BoxGeometry(1.18, 0.08, 0.74), cavityMat, [0, 0.21, -0.05], false);
    // 2. Cavidade para o suporte S1
    const s1Cavity = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24), cavityMat, [-0.44, 0.21, 0.42], false);
    // 3. Cavidade para o suporte S2
    const s2Cavity = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24), cavityMat, [-0.15, 0.21, 0.42], false);
    // 4. Cavidade para a cubeta
    const cuvetteCavity = mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), cavityMat, [0.14, 0.21, 0.42], false);
    // 5. Cavidade para o frasco conta-gotas rosa
    const bottleCavity = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 20), cavityMat, [0.44, 0.21, 0.42], false);
    // 6. Cavidade para o anteparo de observação
    const screenCavity = mesh(new THREE.BoxGeometry(0.52, 0.06, 0.22), cavityMat, [0.38, 0.21, -0.42], false);
    // 7. Cavidade para a placa controladora com LCD
    const elecCavity = mesh(new THREE.BoxGeometry(0.48, 0.06, 0.22), cavityMat, [-0.38, 0.21, -0.42], false);
    // 8. Cavidade para o power bank (fonte 5V)
    const powerBankCavity = mesh(new THREE.BoxGeometry(0.36, 0.06, 0.22), cavityMat, [0.0, 0.21, -0.42], false);

    this.kitGroup.add(platCavity, s1Cavity, s2Cavity, cuvetteCavity, bottleCavity, screenCavity, elecCavity, powerBankCavity);

    // Tampa articulada (Hinge)
    this.lidGroup.position.set(0, 0.29, -0.58);
    const lid = mesh(new THREE.BoxGeometry(1.46, 0.12, 1.20), material('#e5a01d', 0.6), [0, 0.03, 0.55]);
    markInteractive(lid, 'kit-lid');
    this.lidGroup.add(lid);

    const label = makeTextSprite('OPTICS SET', '#111827', 52);
    label.position.set(0, 0.101, 0.55);
    label.rotation.x = -Math.PI / 2;
    this.lidGroup.add(label);
    this.kitGroup.add(this.lidGroup);

    // 4 Hastes Brancas Roscadas (FastenerEntity) com setas indicando OPEN
    const rodPositions: [number, number, number][] = [
      [-0.44, 0.37, -0.35],
      [0.44, 0.37, -0.35],
      [-0.44, 0.37, 0.35],
      [0.44, 0.37, 0.35],
    ];
    rodPositions.forEach((pos, index) => {
      const fastener = new FastenerEntity({
        id: `fastening-${index}`,
        name: `Fastening Rod ${index + 1}`,
        type: 'threaded',
        position: pos,
        pitchMm: 2.0,
        totalTurns: 3.0,
      });
      markInteractive(fastener.group, `fastening-${index}` as InteractionId);
      this.fasteningEntities.push(fastener);
      this.kitGroup.add(fastener.group);
    });

    // 2 O-Rings Vermelhos de retenção na espuma
    const oringPositions: [number, number, number][] = [
      [-0.35, 0.29, 0.15],
      [0.35, 0.29, 0.15],
    ];
    oringPositions.forEach((pos, index) => {
      const oring = new FastenerEntity({
        id: `red-oring-${index}`,
        name: `Red O-ring ${index + 1}`,
        type: 'elastic_oring',
        position: pos,
        color: '#dc2626',
      });
      markInteractive(oring.group, 'red-orings');
      this.redOringEntities.push(oring);
      this.kitGroup.add(oring.group);
    });

    this.scene.add(this.kitGroup);
  }

  private addPlatform(): void {
    markInteractive(this.platformGroup, 'platform');

    // 4 Pés amortecedores antivibração de borracha nas extremidades
    const footGeom = new THREE.CylinderGeometry(0.035, 0.04, 0.018, 20);
    const footMat = material('#111827', 0.92, 0.08);
    const feetCoords = [
      [-0.72, -0.4], [0.72, -0.4],
      [-0.72, 0.4], [0.72, 0.4],
    ];
    feetCoords.forEach(([fx, fz]) => {
      this.platformGroup.add(mesh(footGeom, footMat, [fx, 0.009, fz], false));
    });

    // Base chanfrada multicamada em alumínio anodizado de precisão
    const lowerBase = mesh(new THREE.BoxGeometry(1.55, 0.032, 0.9), material('#1e252b', 0.65, 0.35), [0, 0.024, 0]);
    const bevelTier = mesh(new THREE.BoxGeometry(1.52, 0.014, 0.87), material('#263038', 0.55, 0.45), [0, 0.047, 0]);
    const breadboard = mesh(new THREE.BoxGeometry(1.48, 0.014, 0.83), material('#14191f', 0.48, 0.52), [0, 0.061, 0]);
    this.platformGroup.add(lowerBase, bevelTier, breadboard);

    // Transferidor Analógico 2048x2048 com escala de precisão
    const scale = mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshStandardMaterial({
        map: this.protractorTexture,
        transparent: true,
        roughness: 0.45,
        metalness: 0.15,
        side: THREE.DoubleSide,
      }),
      [0, 0.075, 0],
      false,
    );
    scale.rotation.x = -Math.PI / 2;
    markInteractive(scale, 'protractor');
    this.protractorGroup.add(scale);

    // Colar rotativo e Placa Central com acabamento usinado
    const stageCollar = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 64), material('#475569', 0.4, 0.7), [0, 0.072, 0]);
    const centralPlate = mesh(new THREE.CylinderGeometry(0.285, 0.292, 0.028, 64), material('#94a3b8', 0.35, 0.8), [0, 0.086, 0]);
    this.protractorGroup.add(stageCollar, centralPlate);

    // 4 Pinos-guia de aço inox para encaixe dos suportes S1/S2
    const pinGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 16);
    const pinMat = material('#e2e8f0', 0.18, 0.92);
    const pinCoords: [number, number, number][] = [
      [0.25, 0.106, 0],
      [-0.25, 0.106, 0],
      [0, 0.106, 0.25],
      [0, 0.106, -0.25],
    ];
    pinCoords.forEach((pPos) => {
      const pin = mesh(pinGeom, pinMat, pPos, false);
      this.protractorGroup.add(pin);
    });

    // 4 Furos quadrados oficiais com borda usinada para a cubeta
    const holePositions: [number, number, number][] = [
      [-0.09, 0.098, -0.09], [0.09, 0.098, -0.09],
      [-0.09, 0.098, 0.09], [0.09, 0.098, 0.09],
    ];
    holePositions.forEach((hPos) => {
      const holeRim = mesh(new THREE.BoxGeometry(0.028, 0.004, 0.028), material('#334155', 0.5, 0.6), [hPos[0], hPos[1] + 0.002, hPos[2]], false);
      const hole = mesh(new THREE.BoxGeometry(0.022, 0.016, 0.022), material('#090d12'), hPos, false);
      this.protractorGroup.add(holeRim, hole);
    });

    // Ponteiro Vermelho Fixo Elevado de Referência com ponta de agulha e linha fiducial
    const pointerGroup = new THREE.Group();
    const bracket = mesh(new THREE.BoxGeometry(0.038, 0.028, 0.065), material('#1e242b', 0.6, 0.4), [0.485, 0.084, 0], false);
    const bracketScrew = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 12), material('#cbd5e1', 0.2, 0.9), [0.485, 0.099, 0], false);
    const blade = mesh(new THREE.BoxGeometry(0.05, 0.006, 0.022), material('#e2e8f0', 0.2, 0.92), [0.465, 0.095, 0], false);

    const pointerShape = new THREE.Shape();
    pointerShape.moveTo(0, -0.01);
    pointerShape.lineTo(0.035, 0);
    pointerShape.lineTo(0, 0.01);
    pointerShape.closePath();
    const pointerGeom = new THREE.ExtrudeGeometry(pointerShape, { depth: 0.006, bevelEnabled: false });
    pointerGeom.rotateZ(Math.PI);
    pointerGeom.rotateX(Math.PI / 2);
    const needle = mesh(pointerGeom, material('#dc2626', 0.28, 0.2), [0.47, 0.098, 0], true);

    const fiducialLine = mesh(new THREE.PlaneGeometry(0.03, 0.0018), material('#ffffff', 0.2, 0.0), [0.455, 0.102, 0], false);
    fiducialLine.rotation.x = -Math.PI / 2;

    pointerGroup.add(bracket, bracketScrew, blade, needle, fiducialLine);
    this.platformGroup.add(pointerGroup);

    // Sockets físicos de acoplamento do estágio rotativo (SocketMountEntity)
    this.protractorGroup.add(this.stageSlideSocket.group);
    this.protractorGroup.add(this.stageCuvetteSocket.group);

    // 1. Suporte S1 (Lâmina Fina h = 148.9 µm)
    this.buildS1Holder();
    this.protractorGroup.add(this.s1Group);

    // 2. Suporte S2 (Lâmina Grossa H = 1.061 mm)
    this.buildS2Holder();
    this.protractorGroup.add(this.s2Group);

    // 3. Cubeta de Acrílico para Líquido
    this.buildCuvette();
    this.protractorGroup.add(this.cuvetteGroup);

    // Colunas Verticais: Laser e Lente
    this.addVerticalAssembly(this.laserAssembly, -0.64, 'laser');
    this.addVerticalAssembly(this.lensAssembly, 0.64, 'lens');
    this.platformGroup.add(this.protractorGroup, this.laserAssembly, this.lensAssembly);

    // Knob de Rotação Fina Recartilhado do Transferidor
    const rotationKnob = mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.1, 32),
      new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.85,
        roughness: 0.28,
        bumpMap: this.knurlTextures.bump,
        bumpScale: 0.0035,
        roughnessMap: this.knurlTextures.roughness,
      }),
      [0.47, 0.12, 0.37],
    );
    rotationKnob.rotation.x = Math.PI / 2;

    const knobRimL = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.008, 32), material('#94a3b8', 0.3, 0.8), [0.47, 0.12, 0.32], false);
    knobRimL.rotation.x = Math.PI / 2;
    const knobRimR = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.008, 32), material('#94a3b8', 0.3, 0.8), [0.47, 0.12, 0.42], false);
    knobRimR.rotation.x = Math.PI / 2;

    markInteractive(rotationKnob, 'rotation-knob');
    this.platformGroup.add(rotationKnob, knobRimL, knobRimR);

    this.scene.add(this.platformGroup);
  }

  private buildS1Holder(): void {
    // Anel de montagem inferior cromado acetinado
    const holderRing = mesh(new THREE.TorusGeometry(0.25, 0.016, 12, 64), material('#cbd5e1', 0.25, 0.82), [0, 0.16, 0]);
    holderRing.rotation.x = Math.PI / 2;
    this.s1Group.add(holderRing);

    // 4 Entalhes de encaixe no anel para acoplar nos pinos da base
    const notchGeom = new THREE.BoxGeometry(0.016, 0.018, 0.024);
    const notchMat = material('#94a3b8', 0.3, 0.8);
    const notchCoords: [number, number, number][] = [
      [0.25, 0.16, 0], [-0.25, 0.16, 0],
      [0, 0.16, 0.25], [0, 0.16, -0.25],
    ];
    notchCoords.forEach((nPos) => {
      this.s1Group.add(mesh(notchGeom, notchMat, nPos, false));
    });

    // Hastes verticais de aço escovado
    const posts = [-0.22, 0.22].map((z) => {
      const post = mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.44, 16),
        new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          metalness: 0.85,
          roughness: 0.28,
          map: this.brushedSteelTexture,
        }),
        [0, 0.37, z],
      );
      const collar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), material('#94a3b8', 0.28, 0.82), [0, 0.17, z], false);
      this.s1Group.add(collar);
      return post;
    });
    this.s1Group.add(...posts);

    // Bloco de fixação usinado com ranhura central
    const clamp = mesh(new THREE.BoxGeometry(0.075, 0.075, 0.5), material('#1e293b', 0.35, 0.72), [0, 0.55, 0]);
    this.s1Group.add(clamp);

    // Parafusos borboleta recartilhados de aperto da lâmina
    const screwZCoords = [-0.16, 0.16];
    screwZCoords.forEach((sz) => {
      const screwHead = mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.016, 20),
        new THREE.MeshStandardMaterial({
          color: '#475569',
          metalness: 0.85,
          roughness: 0.28,
          bumpMap: this.knurlTextures.bump,
          bumpScale: 0.003,
          roughnessMap: this.knurlTextures.roughness,
        }),
        [0.048, 0.55, sz],
        false,
      );
      screwHead.rotation.z = Math.PI / 2;
      const screwShaft = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 12), material('#cbd5e1', 0.2, 0.9), [0.038, 0.55, sz], false);
      screwShaft.rotation.z = Math.PI / 2;
      this.s1Group.add(screwHead, screwShaft);
    });

    // Lâmina Fina Oficial S1 (h = 148.9 µm nominal) com vidro óptico MeshPhysicalMaterial
    const slide = mesh(
      new THREE.BoxGeometry(0.008, 0.34, 0.28),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 1.0,
        roughness: 0.04,
        metalness: 0.0,
        ior: 1.51,
        thickness: 0.08,
        transmission: 0.96,
        attenuationColor: new THREE.Color('#99eedd'),
        attenuationDistance: 0.35,
      }),
      [0, 0.35, 0],
      false,
    );
    this.s1Group.add(slide);

    // Bordas facetadas com brilho esmeralda típico de lâminas ópticas de laboratório
    const edgeBevel = mesh(
      new THREE.BoxGeometry(0.0084, 0.342, 0.004),
      new THREE.MeshPhysicalMaterial({
        color: '#2dd4bf',
        transparent: true,
        opacity: 0.85,
        roughness: 0.06,
        metalness: 0.0,
        ior: 1.51,
        transmission: 0.7,
      }),
      [0, 0.35, 0.14],
      false,
    );
    this.s1Group.add(edgeBevel);

    markInteractive(this.s1Group, 's1-holder');
  }

  private buildS2Holder(): void {
    // Anel de montagem inferior em latão dourado usinado (diferenciação visual de S1)
    const holderRing = mesh(new THREE.TorusGeometry(0.25, 0.018, 12, 64), material('#d4af37', 0.22, 0.88), [0, 0.16, 0]);
    holderRing.rotation.x = Math.PI / 2;
    this.s2Group.add(holderRing);

    // 4 Entalhes no anel para encaixe
    const notchGeom = new THREE.BoxGeometry(0.018, 0.02, 0.026);
    const notchMat = material('#b48c28', 0.28, 0.85);
    const notchCoords: [number, number, number][] = [
      [0.25, 0.16, 0], [-0.25, 0.16, 0],
      [0, 0.16, 0.25], [0, 0.16, -0.25],
    ];
    notchCoords.forEach((nPos) => {
      this.s2Group.add(mesh(notchGeom, notchMat, nPos, false));
    });

    // Hastes verticais em latão maciço
    const posts = [-0.22, 0.22].map((z) => {
      const post = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 16), material('#d4af37', 0.22, 0.86), [0, 0.37, z]);
      const collar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), material('#b48c28', 0.25, 0.88), [0, 0.17, z], false);
      this.s2Group.add(collar);
      return post;
    });
    this.s2Group.add(...posts);

    // Bloco de fixação usinado em latão e parafusos recartilhados
    const clamp = mesh(new THREE.BoxGeometry(0.085, 0.085, 0.5), material('#232a32', 0.45, 0.68), [0, 0.55, 0]);
    this.s2Group.add(clamp);

    const screwZCoords = [-0.16, 0.16];
    screwZCoords.forEach((sz) => {
      const screwHead = mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.016, 20),
        new THREE.MeshStandardMaterial({
          color: '#d4af37',
          metalness: 0.88,
          roughness: 0.25,
          bumpMap: this.knurlTextures.bump,
          bumpScale: 0.003,
          roughnessMap: this.knurlTextures.roughness,
        }),
        [0.052, 0.55, sz],
        false,
      );
      screwHead.rotation.z = Math.PI / 2;
      const screwShaft = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 12), material('#b48c28', 0.2, 0.9), [0.042, 0.55, sz], false);
      screwShaft.rotation.z = Math.PI / 2;
      this.s2Group.add(screwHead, screwShaft);
    });

    // Lâmina Grossa Oficial S2 (H = 1.061 mm nominal) com espessura visual destacada
    const thickSlide = mesh(
      new THREE.BoxGeometry(0.024, 0.34, 0.28),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 1.0,
        roughness: 0.05,
        metalness: 0.0,
        ior: 1.51,
        thickness: 0.24,
        transmission: 0.92,
        attenuationColor: new THREE.Color('#77ddcc'),
        attenuationDistance: 0.22,
      }),
      [0, 0.35, 0],
      false,
    );
    this.s2Group.add(thickSlide);

    const edgeBevel = mesh(
      new THREE.BoxGeometry(0.0246, 0.342, 0.005),
      new THREE.MeshPhysicalMaterial({
        color: '#14b8a6',
        transparent: true,
        opacity: 0.85,
        roughness: 0.06,
        metalness: 0.0,
        ior: 1.51,
        transmission: 0.65,
      }),
      [0, 0.35, 0.14],
      false,
    );
    this.s2Group.add(edgeBevel);

    this.s2Group.visible = false;
    markInteractive(this.s2Group, 's2-holder');
  }

  private buildCuvette(): void {
    // Cubeta óptica modelada através da primitiva universal FluidMediumContainer
    this.cuvetteContainer = new FluidMediumContainer({
      id: 'cuvette',
      name: 'Precision Optical Acrylic Cuvette',
      width: 0.22,
      height: 0.26,
      depth: 0.22,
      wallThickness: 0.06,
      wallMaterialType: 'optical_acrylic',
      hasFeet: true,
      footPositions: [
        [-0.09, 0.071, -0.09],
        [0.09, 0.071, -0.09],
        [-0.09, 0.071, 0.09],
        [0.09, 0.071, 0.09],
      ],
      hasPeelFilm: true,
      hasLiquid: true,
      liquidColor: '#f43f5e',
      liquidIor: 1.332,
      liquidTransmission: 0.72,
      attenuationColor: '#e11d48',
      attenuationDistance: 0.14,
      hasMeniscus: true,
    });

    this.cuvetteGroup.add(this.cuvetteContainer.group);
    this.cuvetteGroup.visible = false;
    markInteractive(this.cuvetteGroup, 'cuvette');
  }

  private buildGhostMeshes(): void {
    const createGhostMaterial = (color: string, emissive: string) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.45,
        roughness: 0.2,
        metalness: 0.1,
        depthWrite: false,
      });
      this.ghostMaterials.push(mat);
      return mat;
    };

    // Ghost S1:
    const s1GhostMat = createGhostMaterial('#38bdf8', '#0284c7');
    const s1Ring = mesh(new THREE.TorusGeometry(0.25, 0.016, 12, 48), s1GhostMat, [0, 0.16, 0], false);
    s1Ring.rotation.x = Math.PI / 2;
    const s1Post1 = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.44, 16), s1GhostMat, [0, 0.37, -0.22], false);
    const s1Post2 = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.44, 16), s1GhostMat, [0, 0.37, 0.22], false);
    const s1Clamp = mesh(new THREE.BoxGeometry(0.075, 0.075, 0.5), s1GhostMat, [0, 0.55, 0], false);
    const s1Slide = mesh(new THREE.BoxGeometry(0.008, 0.34, 0.28), s1GhostMat, [0, 0.35, 0], false);
    this.ghostS1Group.add(s1Ring, s1Post1, s1Post2, s1Clamp, s1Slide);

    // Ghost S2:
    const s2GhostMat = createGhostMaterial('#fbbf24', '#d97706');
    const s2Ring = mesh(new THREE.TorusGeometry(0.25, 0.018, 12, 48), s2GhostMat, [0, 0.16, 0], false);
    s2Ring.rotation.x = Math.PI / 2;
    const s2Post1 = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 16), s2GhostMat, [0, 0.37, -0.22], false);
    const s2Post2 = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 16), s2GhostMat, [0, 0.37, 0.22], false);
    const s2Clamp = mesh(new THREE.BoxGeometry(0.085, 0.085, 0.5), s2GhostMat, [0, 0.55, 0], false);
    const s2Slide = mesh(new THREE.BoxGeometry(0.024, 0.34, 0.28), s2GhostMat, [0, 0.35, 0], false);
    this.ghostS2Group.add(s2Ring, s2Post1, s2Post2, s2Clamp, s2Slide);

    // Ghost Cuvette:
    const cuvetteGhostMat = createGhostMaterial('#c084fc', '#9333ea');
    const cuvetteBox = mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), cuvetteGhostMat, [0, 0.21, 0], false);
    this.ghostCuvetteGroup.add(cuvetteBox);

    // Halo ring guide on stage:
    const haloMat = createGhostMaterial('#38bdf8', '#0284c7');
    const halo = mesh(new THREE.RingGeometry(0.23, 0.27, 48), haloMat, [0, 0.09, 0], false);
    halo.rotation.x = -Math.PI / 2;

    this.ghostGroup.add(this.ghostS1Group, this.ghostS2Group, this.ghostCuvetteGroup, halo);
    this.ghostGroup.visible = false;
    this.scene.add(this.ghostGroup);
  }

  private addAccessories(): void {
    // Frasco do Líquido Rosa Desconhecido (N = 1.332)
    this.bottleGroup.position.set(-1.1, 0.14, 0.75);

    const bottleBody = mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.24, 28),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 1.0,
        roughness: 0.12,
        ior: 1.5,
        transmission: 0.88,
      }),
      [0, 0.12, 0],
    );

    const bottleCap = mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 20), material('#e11d48', 0.35, 0.1), [0, 0.26, 0]);
    const dropperTip = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.035, 16), material('#ffffff', 0.3, 0.1), [0, 0.295, 0]);

    const liquidInside = mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.18, 24),
      new THREE.MeshPhysicalMaterial({
        color: '#f43f5e',
        transparent: true,
        opacity: 1.0,
        roughness: 0.08,
        ior: 1.332,
        transmission: 0.68,
        attenuationColor: new THREE.Color('#e11d48'),
        attenuationDistance: 0.15,
      }),
      [0, 0.09, 0],
      false,
    );

    const bottleLabel = makeTextSprite('UNKNOWN LIQUID\nN = 1.332', '#1e293b', 34);
    bottleLabel.position.set(0, 0.12, 0.07);

    this.bottleGroup.add(bottleBody, bottleCap, dropperTip, liquidInside, bottleLabel);
    markInteractive(this.bottleGroup, 'pink-bottle');
    this.scene.add(this.bottleGroup);
  }

  private addVerticalAssembly(group: THREE.Group, x: number, kind: 'laser' | 'lens'): void {
    group.position.x = x;
    const foot = mesh(new THREE.BoxGeometry(0.18, 0.05, 0.32), material('#1e252b', 0.65, 0.35), [0, 0.025, 0]);

    // Hastes verticais de aço escovado com escala milimétrica
    const posts = [-0.11, 0.11].map((z) =>
      mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.68, 20),
        new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          metalness: 0.85,
          roughness: 0.28,
          map: this.brushedSteelTexture,
        }),
        [0, 0.35, z],
      ),
    );
    group.add(foot, ...posts);

    const carriage = new THREE.Group();
    carriage.name = `${kind}-carriage`;
    const body = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), material('#1a2027', 0.55, 0.55), [0, 0, 0]);
    carriage.add(body);

    if (kind === 'laser') {
      const emitterBarrel = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.18, 24), material('#b92525', 0.28, 0.68), [0.12, 0, 0]);
      emitterBarrel.rotation.z = Math.PI / 2;
      const apertureRing = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 24), material('#d4af37', 0.22, 0.88), [0.21, 0, 0], false);
      apertureRing.rotation.z = Math.PI / 2;
      carriage.add(emitterBarrel, apertureRing);
    } else {
      const lensMount = mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.024, 32), material('#1e242b', 0.45, 0.7), [0, 0, 0]);
      lensMount.rotation.z = Math.PI / 2;
      const lens = mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.018, 32),
        new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 1.0,
          roughness: 0.04,
          metalness: 0.0,
          ior: 1.51,
          thickness: 0.05,
          transmission: 0.95,
        }),
        [0, 0, 0],
        false,
      );
      lens.rotation.z = Math.PI / 2;
      carriage.add(lensMount, lens);
    }
    markInteractive(carriage, kind === 'laser' ? 'laser-height-knob' : 'lens-height-knob');
    group.add(carriage);

    // Knob recartilhado com tampa usinada e parafuso central
    const knob = mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.055, 32),
      new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.85,
        roughness: 0.28,
        bumpMap: this.knurlTextures.bump,
        bumpScale: 0.0035,
        roughnessMap: this.knurlTextures.roughness,
      }),
      [0, 0.78, 0.2],
    );
    knob.rotation.x = Math.PI / 2;

    const knobCap = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 24), material('#94a3b8', 0.3, 0.8), [0, 0.78, 0.23], false);
    knobCap.rotation.x = Math.PI / 2;
    const knobScrew = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), material('#1e293b', 0.5, 0.7), [0, 0.78, 0.234], false);
    knobScrew.rotation.x = Math.PI / 2;

    markInteractive(knob, kind === 'laser' ? 'laser-height-knob' : 'lens-height-knob');
    group.add(knob, knobCap, knobScrew);
  }

  private addScreen(): void {
    markInteractive(this.screenGroup, 'screen');
    const foot = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.18), material('#1e252b', 0.65, 0.35), [0, 0.03, 0]);
    const frame = mesh(new THREE.BoxGeometry(0.05, 0.62, 0.72), material('#333a40', 0.5, 0.6), [0, 0.39, 0]);
    const face = mesh(new THREE.PlaneGeometry(0.62, 0.48), material('#e8ebe8', 0.92, 0.02), [0.028, 0.42, 0], false);
    face.rotation.y = Math.PI / 2;
    this.screenGroup.add(foot, frame, face);
    this.scene.add(this.screenGroup);
  }

  private addElectronics(): {
    laserCable: THREE.Mesh;
    powerCable: THREE.Mesh;
    indicator: THREE.Mesh;
    display: DigitalDisplayMesh;
  } {
    this.electronicsGroup.position.set(-0.08, 0.04, 0.75);
    markInteractive(this.electronicsGroup, 'electronics');

    // Chassi em alumínio anodizado escovado
    const board = mesh(new THREE.BoxGeometry(0.64, 0.08, 0.42), material('#1e293b', 0.45, 0.65), [0, 0.04, 0]);

    // Faceplate serigrafada em alta resolução
    const faceplate = mesh(
      new THREE.PlaneGeometry(0.64, 0.42),
      new THREE.MeshStandardMaterial({
        map: this.electronicsTexture,
        roughness: 0.38,
        metalness: 0.55,
      }),
      [0, 0.081, 0],
      false,
    );
    faceplate.rotation.x = -Math.PI / 2;

    // Display LCD Digital com moldura embutida
    const displayBezel = mesh(new THREE.BoxGeometry(0.28, 0.008, 0.12), material('#0f172a', 0.6, 0.2), [0.04, 0.082, -0.06], false);
    const display = new DigitalDisplayMesh({
      id: 'laser-lcd',
      widthM: 0.26,
      heightM: 0.1,
      defaultText: 'I(Laser)=15.0 mA',
    });
    display.mesh.position.set(0.04, 0.086, -0.06);
    display.mesh.rotation.x = -Math.PI / 2;

    // LED Indicador de Emissão Laser com bisel metálico
    const ledBezel = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), material('#94a3b8', 0.25, 0.85), [-0.22, 0.085, 0.08], false);
    const indicator = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16), material('#3e474b', 0.3, 0.2), [-0.22, 0.094, 0.08], false);

    // Chave Toggle Switch On/Off com porca sextavada de fixação e alavanca articulada
    const toggleNut = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 6), material('#e2e8f0', 0.18, 0.95), [-0.22, 0.086, 0.02], false);
    this.toggleLever = mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.045, 16), material('#e2e8f0', 0.12, 0.96), [-0.22, 0.105, 0.02]);
    this.toggleLever.rotation.x = -0.42;

    const toggleGroup = new THREE.Group();
    toggleGroup.add(toggleNut, this.toggleLever);
    markInteractive(toggleGroup, 'laser-switch');

    // Knob Rotativo Recartilhado de Ajuste de Corrente com traço indicador
    this.currentKnobMesh = mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.036, 32),
      new THREE.MeshStandardMaterial({
        color: '#334155',
        metalness: 0.85,
        roughness: 0.28,
        bumpMap: this.knurlTextures.bump,
        bumpScale: 0.0035,
        roughnessMap: this.knurlTextures.roughness,
      }),
      [0.22, 0.1, 0.08],
    );
    const knobDot = mesh(new THREE.BoxGeometry(0.004, 0.003, 0.018), material('#ffffff', 0.2, 0.0), [0.22, 0.119, 0.09], false);
    this.currentKnobMesh.add(knobDot);
    markInteractive(this.currentKnobMesh, 'current-knob');

    this.electronicsGroup.add(board, faceplate, displayBezel, display.mesh, ledBezel, indicator, toggleGroup, this.currentKnobMesh);
    this.scene.add(this.electronicsGroup);

    // Power Bank com conector USB e acabamento fosco
    this.powerBankGroup.position.set(0.55, 0.045, 0.82);
    const bankBody = mesh(new THREE.BoxGeometry(0.46, 0.07, 0.25), material('#1e242b', 0.55, 0.45), [0, 0.035, 0]);
    const bankRim = mesh(new THREE.BoxGeometry(0.465, 0.01, 0.255), material('#334155', 0.4, 0.6), [0, 0.068, 0], false);
    const bankUsb = mesh(new THREE.BoxGeometry(0.04, 0.015, 0.01), material('#0f172a'), [-0.15, 0.045, -0.126], false);
    this.powerBankGroup.add(bankBody, bankRim, bankUsb);
    markInteractive(this.powerBankGroup, 'power-bank');
    this.scene.add(this.powerBankGroup);

    const laserCable = cableCurve([
      new THREE.Vector3(-0.31, 0.09, 0.72),
      new THREE.Vector3(-0.48, 0.04, 0.54),
      new THREE.Vector3(-0.65, 0.12, 0.2),
      new THREE.Vector3(-0.65, 0.35, 0.05),
    ], '#1e2329');

    const powerCable = cableCurve([
      new THREE.Vector3(0.25, 0.09, 0.78),
      new THREE.Vector3(0.44, 0.04, 0.9),
      new THREE.Vector3(0.62, 0.08, 0.8),
    ], '#e2e8f0');

    this.scene.add(laserCable, powerCable);
    return { laserCable, powerCable, indicator, display };
  }

  private addBeam(): THREE.Mesh {
    const beam = mesh(
      new THREE.CylinderGeometry(0.006, 0.013, 1.0, 16, 1, true),
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

  public updateCables(): void {
    if (!this.state) return;

    const laserCableVisible =
      this.state.electronics.laserToBoard &&
      this.state.kit.electronicsRemoved &&
      this.state.kit.platformPlaced;
    const powerCableVisible =
      this.state.electronics.boardToPower &&
      this.state.kit.electronicsRemoved &&
      this.state.kit.powerBankRemoved;

    this.laserCable.visible = laserCableVisible;
    this.powerCable.visible = powerCableVisible;

    // 1. Electronics box ports
    const elecPos = new THREE.Vector3();
    this.electronicsGroup.getWorldPosition(elecPos);
    // Laser output port (left side of electronics box)
    const elecLaserPort = new THREE.Vector3(elecPos.x - 0.22, 0.085, elecPos.z - 0.02);
    // 5V DC IN port (right side of electronics box)
    const elec5VPort = new THREE.Vector3(elecPos.x + 0.22, 0.085, elecPos.z - 0.02);

    // 2. Laser carriage port on the platform vertical assembly
    const platPos = new THREE.Vector3();
    this.platformGroup.getWorldPosition(platPos);
    const laserHeight = this.state.apparatus.laserHeight;
    const laserCarriagePort = new THREE.Vector3(platPos.x - 0.64 - 0.08, laserHeight, platPos.z + 0.08);

    // 3. Power bank output port
    const pbPos = new THREE.Vector3();
    this.powerBankGroup.getWorldPosition(pbPos);
    const powerBankPort = new THREE.Vector3(pbPos.x - 0.15, 0.045, pbPos.z - 0.126);

    if (laserCableVisible) {
      const p0 = laserCarriagePort;
      const p5 = elecLaserPort;

      // Drop from vertical carriage down towards table
      const p1 = new THREE.Vector3(p0.x - 0.04, Math.max(0.045, p0.y * 0.45), p0.z + 0.06);
      const p2 = new THREE.Vector3(
        p0.x + (p5.x - p0.x) * 0.22,
        0.042,
        p0.z + (p5.z - p0.z) * 0.22 + 0.06,
      );
      // Sagging belly resting on table at Y ≈ 0.04m
      const p3 = new THREE.Vector3(
        p0.x + (p5.x - p0.x) * 0.55,
        0.040,
        p0.z + (p5.z - p0.z) * 0.55 + 0.08,
      );
      // Rising toward electronics box
      const p4 = new THREE.Vector3(
        p0.x + (p5.x - p0.x) * 0.88,
        0.046,
        p0.z + (p5.z - p0.z) * 0.88 + 0.03,
      );

      const laserCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4, p5]);
      laserCurve.curveType = 'centripetal';
      const newLaserGeom = new THREE.TubeGeometry(laserCurve, 32, 0.010, 8, false);
      this.laserCable.geometry.dispose();
      this.laserCable.geometry = newLaserGeom;
    }

    if (powerCableVisible) {
      const p0 = elec5VPort;
      const p4 = powerBankPort;

      const p1 = new THREE.Vector3(p0.x + (p4.x - p0.x) * 0.25, 0.045, p0.z + (p4.z - p0.z) * 0.25 + 0.06);
      const p2 = new THREE.Vector3(p0.x + (p4.x - p0.x) * 0.50, 0.038, (p0.z + p4.z) * 0.50 + 0.09);
      const p3 = new THREE.Vector3(p0.x + (p4.x - p0.x) * 0.78, 0.042, p0.z + (p4.z - p0.z) * 0.78 + 0.05);

      const powerCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
      powerCurve.curveType = 'centripetal';
      const newPowerGeom = new THREE.TubeGeometry(powerCurve, 24, 0.009, 8, false);
      this.powerCable.geometry.dispose();
      this.powerCable.geometry = newPowerGeom;
    }
  }

  public updateLaserBeam(): void {
    if (!this.state) return;
    const emitting = isLaserEmitting(this.state);
    this.laserBeam.visible = emitting && this.state.kit.platformPlaced;
    if (!this.laserBeam.visible) return;

    const platPos = this.platformGroup.position;
    const laserHeight = this.state.apparatus.laserHeight;
    const startX = platPos.x - 0.42;
    const startY = platPos.y + laserHeight;
    const startZ = platPos.z;

    const scrPos = this.screenGroup.position;
    const screenFaceX = scrPos.x + 0.031;

    const length = Math.max(0.01, screenFaceX - startX);
    const midX = (startX + screenFaceX) / 2;

    this.laserBeam.position.set(midX, startY, startZ);
    this.laserBeam.scale.set(1, length, 1);
  }

  sync(state: IPhO2024E2State): void {
    this.state = state;
    const pos = state.positions || {
      kit: [-1.85, 0.15],
      platform: [0.05, -0.08],
      screen: [1.34, 0.0],
      electronics: [-0.08, 0.82],
      powerBank: [0.55, 0.82],
      bottle: [-1.05, 0.82],
      paper: [1.4, 0.78],
    };
    const isKitOnFloor = state.kit.location === 'floor';

    // 1. Kit Group Position (Floor vs Bench) & Lid Open
    if (isKitOnFloor) {
      this.kitGroup.position.set(pos.kit?.[0] ?? -2.2, -1.38, pos.kit?.[1] ?? 0.95);
    } else {
      this.kitGroup.position.set(pos.kit?.[0] ?? -1.85, 0.05, pos.kit?.[1] ?? 0.15);
    }
    this.lidGroup.rotation.x = state.kit.lidOpen ? -Math.PI * 0.62 : 0;
    const lidMesh = this.lidGroup.children[0];
    if (lidMesh) lidMesh.userData.interactionId = 'kit-lid';

    // Hastes roscadas e O-rings de retenção
    this.fasteningEntities.forEach((fastener, index) => {
      fastener.group.visible = !state.kit.platformPlaced;
      if (state.kit.fasteningRodsLoose[index]) {
        fastener.loosen(3.0);
      }
    });
    this.redOringEntities.forEach((oring) => {
      oring.group.visible = !state.kit.redOringsRemoved;
    });

    // 2. Plataforma Principal com Goniômetro
    const isDraggingPlatform = this.drag?.type === 'item' && this.drag?.id === 'platform';
    const isDraggingScreen = this.drag?.type === 'item' && this.drag?.id === 'screen';
    const isDraggingElectronics = this.drag?.type === 'item' && this.drag?.id === 'electronics';
    const isDraggingPowerBank = this.drag?.type === 'item' && this.drag?.id === 'powerBank';
    const isDraggingBottle = this.drag?.type === 'item' && this.drag?.id === 'bottle';
    const isDraggingS1 = this.drag?.type === 'item' && this.drag?.id === 's1';
    const isDraggingS2 = this.drag?.type === 'item' && this.drag?.id === 's2';
    const isDraggingCuvette = this.drag?.type === 'item' && this.drag?.id === 'cuvette';

    if (state.kit.platformPlaced) {
      if (this.platformGroup.parent !== this.scene) this.scene.add(this.platformGroup);
      this.platformGroup.scale.setScalar(1);
      if (!isDraggingPlatform) {
        this.platformGroup.position.set(pos.platform[0], 0, pos.platform[1]);
      }
      this.platformGroup.visible = true;
    } else {
      if (this.platformGroup.parent !== this.kitGroup) this.kitGroup.add(this.platformGroup);
      this.platformGroup.scale.setScalar(0.78);
      if (!isDraggingPlatform) {
        this.platformGroup.position.set(0, 0.21, -0.05);
      }
      this.platformGroup.visible = state.kit.lidOpen;
    }

    // 3. Suportes S1 e S2
    const isS1Installed = state.apparatus.s1Installed || state.apparatus.installedHolder === 's1';
    const isS2Installed = state.apparatus.s2Installed || state.apparatus.installedHolder === 's2';

    if (isS1Installed) {
      if (this.s1Group.parent !== this.protractorGroup) this.protractorGroup.add(this.s1Group);
      this.s1Group.scale.setScalar(1);
      this.s1Group.position.set(0, 0, 0);
      this.s1Group.rotation.set(0, 0, 0);
      this.s1Group.visible = true;
      if (this.stageSlideSocket.getOccupant() !== 's1') {
        this.stageSlideSocket.mount('s1', true);
      }
    } else if (state.kit.s1Removed) {
      if (this.s1Group.parent !== this.scene) this.scene.add(this.s1Group);
      this.s1Group.scale.setScalar(1);
      if (!isDraggingS1) {
        const s1Pos = pos.s1 ?? [pos.platform[0] + 0.85, pos.platform[1] + 0.45];
        this.s1Group.position.set(s1Pos[0], 0, s1Pos[1]);
        this.s1Group.rotation.set(0, 0, 0);
      }
      this.s1Group.visible = true;
      if (this.stageSlideSocket.getOccupant() === 's1') {
        this.stageSlideSocket.unmount(true);
      }
    } else {
      if (this.s1Group.parent !== this.kitGroup) this.kitGroup.add(this.s1Group);
      this.s1Group.scale.setScalar(0.85);
      if (!isDraggingS1) {
        this.s1Group.position.set(-0.44, 0.21, 0.42);
        this.s1Group.rotation.set(0, 0, 0);
      }
      this.s1Group.visible = state.kit.lidOpen;
      if (this.stageSlideSocket.getOccupant() === 's1') {
        this.stageSlideSocket.unmount(true);
      }
    }

    if (isS2Installed) {
      if (this.s2Group.parent !== this.protractorGroup) this.protractorGroup.add(this.s2Group);
      this.s2Group.scale.setScalar(1);
      this.s2Group.position.set(0, 0, 0);
      this.s2Group.rotation.set(0, 0, 0);
      this.s2Group.visible = true;
      if (this.stageSlideSocket.getOccupant() !== 's2') {
        this.stageSlideSocket.mount('s2', true);
      }
    } else if (state.kit.s2Removed) {
      if (this.s2Group.parent !== this.scene) this.scene.add(this.s2Group);
      this.s2Group.scale.setScalar(1);
      if (!isDraggingS2) {
        const s2Pos = pos.s2 ?? [pos.platform[0] + 0.65, pos.platform[1] + 0.45];
        this.s2Group.position.set(s2Pos[0], 0, s2Pos[1]);
        this.s2Group.rotation.set(0, 0, 0);
      }
      this.s2Group.visible = true;
      if (this.stageSlideSocket.getOccupant() === 's2') {
        this.stageSlideSocket.unmount(true);
      }
    } else {
      if (this.s2Group.parent !== this.kitGroup) this.kitGroup.add(this.s2Group);
      this.s2Group.scale.setScalar(0.85);
      if (!isDraggingS2) {
        this.s2Group.position.set(-0.15, 0.21, 0.42);
        this.s2Group.rotation.set(0, 0, 0);
      }
      this.s2Group.visible = state.kit.lidOpen;
      if (this.stageSlideSocket.getOccupant() === 's2') {
        this.stageSlideSocket.unmount(true);
      }
    }

    // 4. Cubeta de Acrílico e Película
    if (state.apparatus.cuvettePlaced) {
      if (this.cuvetteGroup.parent !== this.protractorGroup) this.protractorGroup.add(this.cuvetteGroup);
      this.cuvetteGroup.scale.setScalar(1);
      this.cuvetteGroup.position.set(0, 0, 0);
      this.cuvetteGroup.rotation.set(0, 0, 0);
      this.cuvetteGroup.visible = true;
      if (!this.stageCuvetteSocket.isOccupied()) {
        this.stageCuvetteSocket.mount('cuvette', true);
      }
    } else if (state.kit.cuvetteRemoved) {
      if (this.cuvetteGroup.parent !== this.scene) this.scene.add(this.cuvetteGroup);
      this.cuvetteGroup.scale.setScalar(1);
      if (!isDraggingCuvette) {
        const cuvPos = pos.cuvette ?? [pos.platform[0] + 0.45, pos.platform[1] + 0.45];
        this.cuvetteGroup.position.set(cuvPos[0], 0, cuvPos[1]);
        this.cuvetteGroup.rotation.set(0, 0, 0);
      }
      this.cuvetteGroup.visible = true;
      if (this.stageCuvetteSocket.isOccupied()) {
        this.stageCuvetteSocket.unmount(true);
      }
    } else {
      if (this.cuvetteGroup.parent !== this.kitGroup) this.kitGroup.add(this.cuvetteGroup);
      this.cuvetteGroup.scale.setScalar(0.85);
      if (!isDraggingCuvette) {
        this.cuvetteGroup.position.set(0.14, 0.21, 0.42);
        this.cuvetteGroup.rotation.set(0, 0, 0);
      }
      this.cuvetteGroup.visible = state.kit.lidOpen;
      if (this.stageCuvetteSocket.isOccupied()) {
        this.stageCuvetteSocket.unmount(true);
      }
    }

    if (this.cuvetteContainer) {
      this.cuvetteContainer.setFilmPeeled(state.apparatus.cuvettePeeled);
      this.cuvetteContainer.setLiquidPoured(state.apparatus.liquidPoured);
    }

    // 5. Frasco do Líquido Rosa
    if (state.kit.bottleRemoved) {
      if (this.bottleGroup.parent !== this.scene) this.scene.add(this.bottleGroup);
      this.bottleGroup.scale.setScalar(1);
      if (!isDraggingBottle) {
        this.bottleGroup.position.set(pos.bottle[0], 0, pos.bottle[1]);
      }
      this.bottleGroup.visible = true;
    } else {
      if (this.bottleGroup.parent !== this.kitGroup) this.kitGroup.add(this.bottleGroup);
      this.bottleGroup.scale.setScalar(0.75);
      if (!isDraggingBottle) {
        this.bottleGroup.position.set(0.44, 0.21, 0.42);
      }
      this.bottleGroup.visible = state.kit.lidOpen;
    }

    // 6. Rotação do Transferidor
    this.protractorGroup.rotation.y = (state.apparatus.angleDeg * Math.PI) / 180;

    // 7. Alturas de Laser e Lente
    const laserCarriage = this.laserAssembly.getObjectByName('laser-carriage');
    const lensCarriage = this.lensAssembly.getObjectByName('lens-carriage');
    if (laserCarriage) laserCarriage.position.y = state.apparatus.laserHeight;
    if (lensCarriage) lensCarriage.position.y = state.apparatus.lensHeight;

    // 8. Anteparo e Eletrônica
    if (state.apparatus.screenPlaced || state.kit.screenRemoved) {
      if (this.screenGroup.parent !== this.scene) this.scene.add(this.screenGroup);
      this.screenGroup.scale.setScalar(1);
      if (!isDraggingScreen) {
        this.screenGroup.position.set(pos.screen[0], 0, pos.screen[1]);
      }
      this.screenGroup.visible = true;
    } else {
      if (this.screenGroup.parent !== this.kitGroup) this.kitGroup.add(this.screenGroup);
      this.screenGroup.scale.setScalar(0.65);
      if (!isDraggingScreen) {
        this.screenGroup.position.set(0.38, 0.21, -0.42);
      }
      this.screenGroup.visible = state.kit.lidOpen;
    }

    if (state.kit.electronicsRemoved) {
      if (this.electronicsGroup.parent !== this.scene) this.scene.add(this.electronicsGroup);
      this.electronicsGroup.scale.setScalar(1);
      if (!isDraggingElectronics) {
        this.electronicsGroup.position.set(pos.electronics[0], 0, pos.electronics[1]);
      }
      this.electronicsGroup.visible = true;
    } else {
      if (this.electronicsGroup.parent !== this.kitGroup) this.kitGroup.add(this.electronicsGroup);
      this.electronicsGroup.scale.setScalar(0.72);
      if (!isDraggingElectronics) {
        this.electronicsGroup.position.set(-0.38, 0.21, -0.42);
      }
      this.electronicsGroup.visible = state.kit.lidOpen;
    }

    if (state.kit.powerBankRemoved) {
      if (this.powerBankGroup.parent !== this.scene) this.scene.add(this.powerBankGroup);
      this.powerBankGroup.scale.setScalar(1);
      if (!isDraggingPowerBank) {
        this.powerBankGroup.position.set(pos.powerBank[0], 0, pos.powerBank[1]);
      }
      this.powerBankGroup.visible = true;
    } else {
      if (this.powerBankGroup.parent !== this.kitGroup) this.kitGroup.add(this.powerBankGroup);
      this.powerBankGroup.scale.setScalar(0.75);
      if (!isDraggingPowerBank) {
        this.powerBankGroup.position.set(0.0, 0.21, -0.42);
      }
      this.powerBankGroup.visible = state.kit.lidOpen;
    }

    // Papel de enunciado físico na bancada
    if (this.environment.paperMesh) {
      this.environment.paperMesh.position.set(pos.paper[0], 0.015, pos.paper[1]);
    }

    this.updateCables();
    this.updateLaserBeam();

    // 9. Eletrônica, Display LCD e Emissão do Laser
    const emitting = isLaserEmitting(state);

    const indicatorMat = this.laserIndicator.material as THREE.MeshStandardMaterial;
    indicatorMat.color.set(emitting ? '#ff3b30' : '#3e474b');
    indicatorMat.emissive.set(emitting ? '#ff2211' : '#000000');
    indicatorMat.emissiveIntensity = emitting ? 0.8 : 0;

    // Sincronizar alavanca física da chave toggle On/Off
    if (this.toggleLever) {
      this.toggleLever.rotation.x = state.electronics.switchOn ? -0.42 : 0.42;
    }

    // Sincronizar rotação angular do knob de corrente (0 a 30 mA)
    if (this.currentKnobMesh) {
      const currentFrac = Math.max(0, Math.min(1, state.electronics.laserCurrentMa / 30));
      this.currentKnobMesh.rotation.y = (-135 + currentFrac * 270) * (Math.PI / 180);
    }

    const circuitReady = state.electronics.laserToBoard && state.electronics.boardToPower;
    this.displayMesh.setPower(circuitReady);
    const currentVal = state.electronics.laserCurrentMa;
    this.displayMesh.setText(`I(Laser)=${currentVal.toFixed(1)} mA`);
    this.displayMesh.renderDisplay(emitting);

    // 10. Atualização do Padrão Físico com Constantes Oficiais Dinâmicas
    const visibility = patternVisibility(state);
    const phaseParams = resolvePhaseParameters(state);
    const phaseVal = visualPhase(state.apparatus.angleDeg, phaseParams);
    this.pattern.update(phaseVal, visibility);

    this.screenPattern.visible = (state.apparatus.screenPlaced || state.kit.screenRemoved) && emitting;
    this.screenPattern.position.set(pos.screen[0] + 0.031, 0.43, pos.screen[1]);
  }

  public getCameraCalibration(targetOverride?: THREE.Vector3): CameraCalibration {
    const width = this.renderer.domElement.clientWidth || this.host.clientWidth || window.innerWidth;
    const height = this.renderer.domElement.clientHeight || this.host.clientHeight || window.innerHeight;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const fovRad = (this.camera.fov * Math.PI) / 180;

    // Screen plane point: face is at X ≈ 1.371m, Y = 0.43m, Z = screen[1]
    const scrX = (this.state?.positions?.screen?.[0] ?? 1.34) + 0.031;
    const scrZ = this.state?.positions?.screen?.[1] ?? 0.0;
    const screenPoint = new THREE.Vector3(scrX, 0.43, scrZ);

    const toScreen = new THREE.Vector3().subVectors(screenPoint, this.camera.position);
    const screenDepth = Math.max(0.01, toScreen.dot(forward));
    const screenVisibleH = 2 * screenDepth * Math.tan(fovRad / 2);
    const screenMmPerPixel = (screenVisibleH * 1000) / Math.max(1, height);
    const screenPixelsPerMm = 1 / screenMmPerPixel;

    let target: THREE.Vector3;
    let targetName = 'Active Focal Plane';

    if (targetOverride) {
      target = targetOverride;
      targetName = 'Custom Focus Plane';
    } else if (this.currentFocus === 'screen') {
      target = screenPoint;
      targetName = 'Observation Screen (X ≈ 1.37m)';
    } else {
      target = this.controls.target;
      switch (this.currentFocus) {
        case 'apparatus':
          targetName = 'Rotary Stage Apparatus';
          break;
        case 'angle':
          targetName = 'Goniometer Protractor Scale';
          break;
        case 'laser':
          targetName = 'Laser Module Aperture';
          break;
        case 'lens':
          targetName = 'Cylindrical Lens Stage';
          break;
        case 'electronics':
          targetName = 'Controller Board Faceplate';
          break;
        case 'kit':
          targetName = 'Optics Storage Case';
          break;
        case 'paper':
          targetName = 'Official Task Sheet';
          break;
        default:
          targetName = 'Overview Focus Center';
          break;
      }
    }

    const toTarget = new THREE.Vector3().subVectors(target, this.camera.position);
    const depthMeters = Math.max(0.01, toTarget.dot(forward));
    const visibleHeightM = 2 * depthMeters * Math.tan(fovRad / 2);
    const mmPerPixel = (visibleHeightM * 1000) / Math.max(1, height);
    const pixelsPerMm = 1 / mmPerPixel;

    return {
      mmPerPixel,
      pixelsPerMm,
      depthMeters,
      fov: this.camera.fov,
      viewportWidth: width,
      viewportHeight: height,
      targetFocus: this.currentFocus,
      targetName,
      screenCalibration: {
        mmPerPixel: screenMmPerPixel,
        pixelsPerMm: screenPixelsPerMm,
        depthMeters: screenDepth,
      },
    };
  }

  public emitCalibration(): void {
    if (!this.callbacks.onCalibrationChange) return;
    const calib = this.getCameraCalibration();
    const key = `${calib.mmPerPixel.toFixed(5)}_${calib.depthMeters.toFixed(4)}_${calib.viewportWidth}x${calib.viewportHeight}_${this.currentFocus}`;
    if (key !== this.lastCalibrationKey) {
      this.lastCalibrationKey = key;
      this.callbacks.onCalibrationChange(calib);
    }
  }

  public updateClock(timeStr: string, isRunning: boolean): void {
    this.environment.updateClockDisplay(timeStr, isRunning);
  }

  focus(target: FocusTarget): void {
    this.currentFocus = target;
    const pos = this.state?.positions || {
      kit: [-1.85, 0.15],
      platform: [0.05, -0.08],
      screen: [1.34, 0.0],
      electronics: [-0.08, 0.82],
      powerBank: [0.55, 0.82],
      bottle: [-1.05, 0.82],
      paper: [1.4, 0.78],
    };

    if (target === 'kit') {
      const isFloor = this.state?.kit.location === 'floor';
      const kitX = this.kitGroup.position.x;
      const kitZ = this.kitGroup.position.z;
      if (isFloor) {
        this.targetPosition.set(kitX, -0.4, kitZ + 1.6);
        this.targetLook.set(kitX, -1.3, kitZ);
      } else {
        this.targetPosition.set(kitX - 0.35, 1.45, kitZ + 1.55);
        this.targetLook.set(kitX, 0.17, kitZ);
      }
    } else if (target === 'paper') {
      const p = pos.paper || [1.4, 0.78];
      this.targetPosition.set(p[0] + 0.05, 1.05, p[1] + 0.65);
      this.targetLook.set(p[0], 0.02, p[1]);
    } else if (target === 'apparatus') {
      const plat = pos.platform || [0.05, -0.08];
      this.targetPosition.set(plat[0] + 1.35, 1.15, plat[1] + 1.6);
      this.targetLook.set(plat[0], 0.28, plat[1]);
    } else if (target === 'angle') {
      const plat = pos.platform || [0.05, -0.08];
      this.targetPosition.set(plat[0], 1.55, plat[1] + 0.44);
      this.targetLook.set(plat[0], 0.08, plat[1]);
    } else if (target === 'laser') {
      const plat = pos.platform || [0.05, -0.08];
      this.targetPosition.set(plat[0] - 0.76, 0.94, plat[1] + 1.28);
      this.targetLook.set(plat[0] - 0.59, 0.46, plat[1]);
    } else if (target === 'lens') {
      const plat = pos.platform || [0.05, -0.08];
      this.targetPosition.set(plat[0] + 0.8, 0.94, plat[1] + 1.28);
      this.targetLook.set(plat[0] + 0.62, 0.46, plat[1]);
    } else if (target === 'screen') {
      const scr = pos.screen || [1.34, 0.0];
      this.targetPosition.set(scr[0] + 0.71, 0.58, scr[1] + 0.16);
      this.targetLook.set(scr[0] + 0.03, 0.43, scr[1]);
    } else if (target === 'electronics') {
      const el = pos.electronics || [-0.08, 0.82];
      this.targetPosition.set(el[0] + 0.23, 1.05, el[1] + 1.02);
      this.targetLook.set(el[0], 0.1, el[1]);
    } else {
      // Padrão: Visão geral
      this.targetPosition.set(2.6, 2.1, 3.2);
      this.targetLook.set(0.0, 0.15, 0);
    }
    this.controls.setView(this.targetPosition, this.targetLook);
    this.emitCalibration();
  }


  public resolveFocusTarget(id: InteractionId | null): FocusTarget {
    return resolveFocusTarget(id, this.state?.kit.platformPlaced ?? false);
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
    // 1. Detecção de Duplo Clique com Botão Direito do Mouse para Foco Automático
    if (event.button === 2) {
      const now = performance.now();
      const dt = now - this.lastRightClickTime;
      const dist = Math.hypot(event.clientX - this.lastRightClickPos.x, event.clientY - this.lastRightClickPos.y);

      if (dt < 450 && dist < 25) {
        this.lastRightClickTime = 0;
        this.controls.resetInteractions();
        this.controls.isLocked = true;

        const hit = this.interactionFromEvent(event);
        if (hit) {
          const focusTarget = this.resolveFocusTarget(hit.id);
          this.focus(focusTarget);
          this.callbacks.onFocusChange?.(focusTarget);
        }

        setTimeout(() => {
          this.controls.isLocked = false;
        }, 100);
        return;
      } else {
        this.lastRightClickTime = now;
        this.lastRightClickPos = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    if (event.button !== 0) return;

    const hit = this.interactionFromEvent(event);
    if (!hit || !this.state) return;
    const { id } = hit;

    const isFloor = this.state.kit.location === 'floor';
    const isPlatformInsideKit = !this.state.kit.platformPlaced;
    const isScreenInsideKit = !this.state.kit.screenRemoved && !this.state.apparatus.screenPlaced;
    const isElectronicsInsideKit = !this.state.kit.electronicsRemoved;
    const isPowerBankInsideKit = !this.state.kit.powerBankRemoved;
    const isBottleInsideKit = !this.state.kit.bottleRemoved;
    const isS1InsideKit = !this.state.kit.s1Removed && this.state.apparatus.installedHolder !== 's1';
    const isS2InsideKit = !this.state.kit.s2Removed && this.state.apparatus.installedHolder !== 's2';
    const isCuvetteInsideKit = !this.state.kit.cuvetteRemoved && !this.state.apparatus.cuvettePlaced;

    const movableGroups: Partial<Record<InteractionId, { group: THREE.Object3D; key: string; planeY: number; isInsideKit: boolean }>> = {
      'kit-lid': { group: this.kitGroup, key: 'kit', planeY: isFloor ? -1.38 : 0.05, isInsideKit: false },
      'platform': { group: this.platformGroup, key: 'platform', planeY: 0, isInsideKit: isPlatformInsideKit },
      'screen': { group: this.screenGroup, key: 'screen', planeY: 0, isInsideKit: isScreenInsideKit },
      'electronics': { group: this.electronicsGroup, key: 'electronics', planeY: 0, isInsideKit: isElectronicsInsideKit },
      'power-bank': { group: this.powerBankGroup, key: 'powerBank', planeY: 0, isInsideKit: isPowerBankInsideKit },
      'pink-bottle': { group: this.bottleGroup, key: 'bottle', planeY: 0, isInsideKit: isBottleInsideKit },
      'paper': { group: this.environment.paperMesh, key: 'paper', planeY: 0.015, isInsideKit: false },
    };

    if (this.state.apparatus.installedHolder !== 's1') {
      movableGroups['s1-holder'] = { group: this.s1Group, key: 's1', planeY: 0, isInsideKit: isS1InsideKit };
    }
    if (this.state.apparatus.installedHolder !== 's2') {
      movableGroups['s2-holder'] = { group: this.s2Group, key: 's2', planeY: 0, isInsideKit: isS2InsideKit };
    }
    if (!this.state.apparatus.cuvettePlaced) {
      movableGroups['cuvette'] = { group: this.cuvetteGroup, key: 'cuvette', planeY: 0, isInsideKit: isCuvetteInsideKit };
    }

    // 2. Manipulação de Instrumentos com Tecla Alt Pressionada ou Arraste Direto de Itens Soltos/da Caixa
    const target = movableGroups[id];
    if (target) {
      if (target.isInsideKit && !this.state.kit.lidOpen) {
        // Tampa fechada impede retirar itens da caixa
      } else {
        if (id === 'platform' && target.isInsideKit) {
          if (!this.state.kit.fasteningRodsLoose.every(Boolean)) return;
          if (this.state.assemblyMode === 'realistic' && !this.state.kit.redOringsRemoved) return;
        }

        const isLooseItem = id === 's1-holder' || id === 's2-holder' || id === 'cuvette' || id === 'pink-bottle';
        // Permite arraste com Alt ou arraste direto para itens soltos/extração da caixa
        if (event.altKey || target.isInsideKit || isLooseItem) {
          // Se o item estiver dentro do kitGroup, converte para coordenadas de mundo e repassa para a cena
          if (target.group.parent === this.kitGroup) {
            const worldPos = new THREE.Vector3();
            target.group.getWorldPosition(worldPos);
            this.scene.add(target.group);
            target.group.position.copy(worldPos);
            target.group.scale.setScalar(1.0);
          }

          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.planeY);
          const hitPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(plane, hitPoint)) {
            const grabOffsetX = target.group.position.x - hitPoint.x;
            const grabOffsetZ = target.group.position.z - hitPoint.z;

            this.callbacks.onSelect(id);
            this.drag = {
              type: 'item',
              id: target.key,
              targetGroup: target.group,
              startX: event.clientX,
              startY: event.clientY,
              startValue: 0,
              planeY: target.planeY,
              grabOffsetX,
              grabOffsetZ,
              startPosX: target.group.position.x,
              startPosZ: target.group.position.z,
              wasInsideKit: target.isInsideKit,
              moved: false,
            };
            this.controls.isLocked = true;
            this.renderer.domElement.style.cursor = 'grabbing';
            this.renderer.domElement.setPointerCapture(event.pointerId);
            return;
          }
        }
      }
    }

    // 3. Ajuste de Knobs e Goniômetro
    if (id === 'rotation-knob' || id === 'protractor') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'angle', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.angleDeg, moved: false };
      this.controls.isLocked = true;
    } else if (id === 'laser-height-knob') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'laser', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.laserHeight, moved: false };
      this.controls.isLocked = true;
    } else if (id === 'lens-height-knob') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'lens', startX: event.clientX, startY: event.clientY, startValue: this.state.apparatus.lensHeight, moved: false };
      this.controls.isLocked = true;
    } else if (id === 'current-knob') {
      this.callbacks.onSelect(id);
      this.drag = { type: 'current', startX: event.clientX, startY: event.clientY, startValue: this.state.electronics.laserCurrentMa, moved: false };
      this.controls.isLocked = true;
    }
    if (this.drag) this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    // CRITICAL: Atualiza ponteiro e raycaster em cada movimento para desobstruir o arraste livre
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.drag) {
      const dx = event.clientX - this.drag.startX;
      const dy = event.clientY - this.drag.startY;
      this.drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;

      if (this.drag.type === 'item' && this.drag.targetGroup) {
        const planeY = this.drag.planeY ?? 0;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        const currentHit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, currentHit)) {
          let targetX = currentHit.x + (this.drag.grabOffsetX ?? 0);
          let targetZ = currentHit.z + (this.drag.grabOffsetZ ?? 0);

          // Segurar Shift junto com Alt ativa modo micrométrico (5x mais preciso)
          if (event.shiftKey && this.drag.startPosX !== undefined && this.drag.startPosZ !== undefined) {
            targetX = this.drag.startPosX + (targetX - this.drag.startPosX) * 0.2;
            targetZ = this.drag.startPosZ + (targetZ - this.drag.startPosZ) * 0.2;
          }

          const isFloorKit = this.drag.id === 'kit' && this.state?.kit.location === 'floor';
          const clampedX = isFloorKit
            ? Math.max(-2.9, Math.min(-1.5, targetX))
            : Math.max(-2.85, Math.min(2.85, targetX));
          const clampedZ = isFloorKit
            ? Math.max(0.4, Math.min(1.4, targetZ))
            : Math.max(-1.45, Math.min(1.45, targetZ));

          this.drag.targetGroup.position.x = clampedX;
          this.drag.targetGroup.position.z = clampedZ;

          // Sincroniza feixe do laser, anteparo e cabos flexíveis em tempo real
          if (this.drag.id === 'platform') {
            this.updateLaserBeam();
            this.updateCables();
          } else if (this.drag.id === 'screen') {
            this.screenPattern.position.x = clampedX + 0.031;
            this.screenPattern.position.z = clampedZ;
            if (this.state) {
              const platX = this.platformGroup.position.x;
              this.state.apparatus.screenDistance = Math.max(0.55, Math.min(1.15, clampedX - (platX + 0.50)));
            }
            this.updateLaserBeam();
          } else if (this.drag.id === 'electronics' || this.drag.id === 'powerBank') {
            this.updateCables();
          }

          if (this.callbacks.onSetItemPosition && this.drag.id) {
            this.callbacks.onSetItemPosition(this.drag.id, clampedX, clampedZ);
          }

          // Orientação Ghost Mesh no modo Guided
          const isMountable = this.drag.id === 's1' || this.drag.id === 's2' || this.drag.id === 'cuvette';
          if (isMountable && this.state?.kit.platformPlaced) {
            const stageWorldPos = new THREE.Vector3();
            this.protractorGroup.getWorldPosition(stageWorldPos);
            const dist = Math.hypot(clampedX - stageWorldPos.x, clampedZ - stageWorldPos.z);
            const mode = this.state.assemblyMode ?? 'guided';

            if (mode === 'guided') {
              const snapRadius = 0.48;
              if (dist <= snapRadius) {
                this.ghostGroup.position.set(stageWorldPos.x, stageWorldPos.y, stageWorldPos.z);
                this.ghostGroup.rotation.y = this.protractorGroup.rotation.y;
                this.ghostS1Group.visible = this.drag.id === 's1';
                this.ghostS2Group.visible = this.drag.id === 's2';
                this.ghostCuvetteGroup.visible = this.drag.id === 'cuvette';
                this.ghostGroup.visible = true;
              } else {
                this.ghostGroup.visible = false;
              }
            } else {
              this.ghostGroup.visible = false;
            }
          }
        }
        return;
      }

      if (this.drag.type === 'angle') {
        const precisionMultiplier = event.shiftKey ? 0.024 : 0.12;
        this.callbacks.onSetAngle(this.drag.startValue + dx * precisionMultiplier);
      } else if (this.drag.type === 'laser') {
        const nextHeight = Math.max(0.18, Math.min(0.82, this.drag.startValue - dy * 0.0032));
        this.callbacks.onSetLaserHeight(nextHeight);
        const laserCarriage = this.laserAssembly.getObjectByName('laser-carriage');
        if (laserCarriage) {
          laserCarriage.position.y = nextHeight;
        }
        if (this.state) {
          this.state.apparatus.laserHeight = nextHeight;
        }
        this.updateLaserBeam();
        this.updateCables();
      } else if (this.drag.type === 'lens') {
        this.callbacks.onSetLensHeight(this.drag.startValue - dy * 0.0032);
      } else if (this.drag.type === 'current' && this.callbacks.onSetLaserCurrent) {
        this.callbacks.onSetLaserCurrent(this.drag.startValue + dx * 0.05);
      }
      return;
    }

    const hit = this.interactionFromEvent(event);
    const object = hit?.object ?? null;
    if (object !== this.hovered) {
      this.setHighlight(this.hovered, false);
      this.hovered = object;
      this.setHighlight(this.hovered, true);
    }
    if (this.hovered && hit) {
      if (event.altKey) {
        this.renderer.domElement.style.cursor = 'grab';
      } else {
        this.renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag) {
      const wasItemDrag = this.drag.type === 'item';
      const hadMoved = this.drag.moved;
      const draggedId = this.drag.id;
      const targetGroup = this.drag.targetGroup;
      const wasInsideKit = this.drag.wasInsideKit;

      this.ghostGroup.visible = false;
      this.controls.isLocked = false;
      this.drag = null;
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
        this.renderer.domElement.releasePointerCapture(event.pointerId);
      }
      this.renderer.domElement.style.cursor = 'default';

      if (hadMoved) {
        if (wasItemDrag && this.state && targetGroup && draggedId) {
          const kitX = this.kitGroup.position.x;
          const kitZ = this.kitGroup.position.z;
          const isFloor = this.state.kit.location === 'floor';
          const kitFloorMatch = isFloor ? targetGroup.position.y < -0.5 : targetGroup.position.y > -0.5;
          const isOverKit = kitFloorMatch && Math.abs(targetGroup.position.x - kitX) < 0.73 && Math.abs(targetGroup.position.z - kitZ) < 0.64;

          const itemNameToExtractItem: Record<string, 'platform' | 's1' | 's2' | 'cuvette' | 'bottle' | 'screen' | 'electronics' | 'power-bank'> = {
            platform: 'platform',
            s1: 's1',
            s2: 's2',
            cuvette: 'cuvette',
            bottle: 'bottle',
            screen: 'screen',
            electronics: 'electronics',
            powerBank: 'power-bank',
          };

          const extractItemName = itemNameToExtractItem[draggedId];

          if (isOverKit && this.state.kit.lidOpen && extractItemName) {
            // Solto sobre o estojo aberto -> Armazenar na caixa
            this.callbacks.onStoreItem?.(extractItemName);
            AudioManager.playSnap();
          } else if (extractItemName && wasInsideKit) {
            // Retirado da caixa para a bancada -> Extrair item
            this.callbacks.onExtractItem?.(extractItemName);
            this.callbacks.onSetItemPosition?.(draggedId, targetGroup.position.x, targetGroup.position.z);
            AudioManager.playSnap();
          } else if (draggedId === 's1' || draggedId === 's2' || draggedId === 'cuvette') {
            const stageWorldPos = new THREE.Vector3();
            this.protractorGroup.getWorldPosition(stageWorldPos);
            const dist = Math.hypot(targetGroup.position.x - stageWorldPos.x, targetGroup.position.z - stageWorldPos.z);
            const mode = this.state.assemblyMode ?? 'guided';
            const snapTolerance = mode === 'realistic' ? 0.08 : mode === 'skip' ? 0.50 : 0.32;

            if (dist <= snapTolerance && this.state.kit.platformPlaced) {
              let canSnap = true;
              if (mode === 'realistic') {
                if (!this.state.kit.redOringsRemoved) canSnap = false;
                if (draggedId === 's1' && (this.state.apparatus.installedHolder !== 'none' || !this.state.kit.s1Removed)) canSnap = false;
                if (draggedId === 's2' && (this.state.apparatus.installedHolder !== 'none' || !this.state.kit.s2Removed)) canSnap = false;
                if (draggedId === 'cuvette' && (!this.state.apparatus.cuvettePeeled || !this.state.kit.cuvetteRemoved)) canSnap = false;
              }

              if (canSnap) {
                AudioManager.playSnap();
                if (draggedId === 's1') {
                  this.callbacks.onInstallS1?.();
                } else if (draggedId === 's2') {
                  this.callbacks.onInstallS2?.();
                } else if (draggedId === 'cuvette') {
                  this.callbacks.onPlaceCuvette?.();
                }
              } else {
                this.callbacks.onSetItemPosition?.(draggedId, targetGroup.position.x, targetGroup.position.z);
              }
            } else {
              this.callbacks.onSetItemPosition?.(draggedId, targetGroup.position.x, targetGroup.position.z);
            }
          } else {
            this.callbacks.onSetItemPosition?.(draggedId, targetGroup.position.x, targetGroup.position.z);
          }
        }
        return;
      }
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

    if (id.startsWith('fastening-')) {
      const idx = Number(id.split('-')[1]);
      this.callbacks.onLoosenRod(idx);
    } else if (id === 'red-orings' && this.callbacks.onRemoveOrings) {
      this.callbacks.onRemoveOrings();
      AudioManager.playSnap();
    } else if (id === 'laser-switch') {
      this.callbacks.onToggleLaserSwitch();
      AudioManager.playSwitchClick(!this.state?.electronics.switchOn);
    } else if (id === 'kit-lid') {
      AudioManager.playSwitchClick(true);
    }
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
    this.emitCalibration();
  };

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    if (this.ghostGroup.visible) {
      const t = performance.now() * 0.005;
      const pulse = 0.38 + 0.18 * Math.sin(t);
      for (const mat of this.ghostMaterials) {
        mat.opacity = pulse;
      }
    }
    this.controls.update();
    this.emitCalibration();
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
    this.environment.dispose();
    this.displayMesh.dispose();
    this.knurlTextures.bump.dispose();
    this.knurlTextures.roughness.dispose();
    this.brushedSteelTexture.dispose();
    this.protractorTexture.dispose();
    this.electronicsTexture.dispose();
    this.cuvetteContainer?.dispose();
    for (const mat of this.ghostMaterials) {
      mat.dispose();
    }
    this.ghostGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
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
