import * as THREE from 'three';
import { SimpleOrbitControls } from '../../components/3d/controls/SimpleOrbitControls';

export type CameraPreset =
  | 'overview'
  | 'apparatus'
  | 'kit'
  | 'screen'
  | 'angle'
  | 'laser'
  | 'lens'
  | 'paper';

export interface CameraPresetConfig {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const DEFAULT_CAMERA_PRESETS: Record<CameraPreset, CameraPresetConfig> = {
  overview: {
    position: new THREE.Vector3(2.35, 1.85, 2.75),
    target: new THREE.Vector3(0.05, 0.18, 0),
  },
  apparatus: {
    position: new THREE.Vector3(1.4, 1.15, 1.6),
    target: new THREE.Vector3(0.05, 0.28, 0),
  },
  kit: {
    position: new THREE.Vector3(-1.72, 1.35, 1.45),
    target: new THREE.Vector3(-1.1, 0.17, 0.1),
  },
  screen: {
    position: new THREE.Vector3(2.08, 0.58, 0.16),
    target: new THREE.Vector3(1.37, 0.43, 0),
  },
  angle: {
    position: new THREE.Vector3(0.02, 1.55, 0.44),
    target: new THREE.Vector3(0.02, 0.08, 0),
  },
  laser: {
    position: new THREE.Vector3(-0.76, 0.94, 1.28),
    target: new THREE.Vector3(-0.59, 0.46, 0),
  },
  lens: {
    position: new THREE.Vector3(0.8, 0.94, 1.28),
    target: new THREE.Vector3(0.62, 0.46, 0),
  },
  paper: {
    position: new THREE.Vector3(-0.15, 1.4, 1.5),
    target: new THREE.Vector3(-0.15, 0.05, 1.05),
  },
};

export class InspectionCamera {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: SimpleOrbitControls;

  private targetPosition = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private isTransitioning = false;
  private transitionProgress = 1.0;
  private startPosition = new THREE.Vector3();
  private startLookAt = new THREE.Vector3();

  constructor(width: number, height: number, domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.025, 25);
    this.controls = new SimpleOrbitControls(this.camera, domElement);
    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 5.0;

    this.setPresetInstant('overview');
  }

  public setPresetInstant(preset: CameraPreset): void {
    const config = DEFAULT_CAMERA_PRESETS[preset];
    if (!config) return;
    this.camera.position.copy(config.position);
    this.controls.target.copy(config.target);
    this.targetPosition.copy(config.position);
    this.targetLookAt.copy(config.target);
    this.controls.setView(config.position, config.target);
  }

  public transitionToPreset(preset: CameraPreset, durationSeconds = 0.45): void {
    const config = DEFAULT_CAMERA_PRESETS[preset];
    if (!config) return;

    this.startPosition.copy(this.camera.position);
    this.startLookAt.copy(this.controls.target);
    this.targetPosition.copy(config.position);
    this.targetLookAt.copy(config.target);

    this.transitionProgress = 0;
    this.isTransitioning = true;
  }

  public update(deltaSeconds: number): void {
    if (this.isTransitioning) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + deltaSeconds * 2.5);
      // Suavização cúbica (smoothstep)
      const t = this.transitionProgress * this.transitionProgress * (3 - 2 * this.transitionProgress);

      this.camera.position.lerpVectors(this.startPosition, this.targetPosition, t);
      this.controls.target.lerpVectors(this.startLookAt, this.targetLookAt, t);

      if (this.transitionProgress >= 1.0) {
        this.isTransitioning = false;
        this.controls.setView(this.targetPosition, this.targetLookAt);
      }
    }

    this.controls.update();
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.controls.dispose();
  }
}
