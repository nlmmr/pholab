import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface RotaryDialConfig {
  id: string;
  name: string;
  minDeg?: number;
  maxDeg?: number;
  initialDeg?: number;
  gearRatio?: number;
  stepSoundIntervalDeg?: number;
  axis?: 'x' | 'y' | 'z';
}

export class RotaryDialEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly group = new THREE.Group();

  private minDeg: number;
  private maxDeg: number;
  private currentDeg: number;
  private gearRatio: number;
  private stepSoundIntervalDeg: number;
  private lastSoundDeg: number;
  private axis: 'x' | 'y' | 'z';

  constructor(config: RotaryDialConfig) {
    this.id = config.id;
    this.name = config.name;
    this.minDeg = config.minDeg ?? -80;
    this.maxDeg = config.maxDeg ?? 80;
    this.currentDeg = config.initialDeg ?? 0;
    this.gearRatio = config.gearRatio ?? 0.15;
    this.stepSoundIntervalDeg = config.stepSoundIntervalDeg ?? 1.0;
    this.lastSoundDeg = this.currentDeg;
    this.axis = config.axis ?? 'y';

    this.updateMeshRotation();
  }

  public getAngleDeg(): number {
    return this.currentDeg;
  }

  public setAngleDeg(angleDeg: number): void {
    const clamped = Math.max(this.minDeg, Math.min(this.maxDeg, angleDeg));
    this.currentDeg = clamped;
    this.updateMeshRotation();
  }

  /**
   * Rotaciona o dial proporcionalmente ao deslocamento do cursor
   * @param deltaPixels Deslocamento de pixel do mouse
   * @param isShiftPressed Se true, ativa o Modo Micrométrico (5x mais preciso)
   */
  public rotateByDelta(deltaPixels: number, isShiftPressed = false): number {
    const precisionMultiplier = isShiftPressed ? 0.2 : 1.0;
    const deltaDeg = deltaPixels * this.gearRatio * precisionMultiplier;
    const nextAngle = Math.max(this.minDeg, Math.min(this.maxDeg, this.currentDeg + deltaDeg));

    if (Math.abs(nextAngle - this.lastSoundDeg) >= this.stepSoundIntervalDeg) {
      AudioManager.playKnobTick();
      this.lastSoundDeg = nextAngle;
    }

    this.currentDeg = nextAngle;
    this.updateMeshRotation();
    return this.currentDeg;
  }

  private updateMeshRotation(): void {
    const rad = (this.currentDeg * Math.PI) / 180;
    if (this.axis === 'x') this.group.rotation.x = rad;
    else if (this.axis === 'y') this.group.rotation.y = rad;
    else this.group.rotation.z = rad;
  }

  public reset(): void {
    this.currentDeg = 0;
    this.lastSoundDeg = 0;
    this.updateMeshRotation();
  }
}
