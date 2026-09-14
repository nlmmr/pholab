import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface LinearSliderConfig {
  id: string;
  name: string;
  axis?: 'x' | 'y' | 'z';
  minVal: number;
  maxVal: number;
  initialVal: number;
  sensitivity?: number;
}

export class LinearSliderEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly group = new THREE.Group();

  private axis: 'x' | 'y' | 'z';
  private minVal: number;
  private maxVal: number;
  private currentVal: number;
  private sensitivity: number;
  private isLocked = false;

  constructor(config: LinearSliderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.axis = config.axis ?? 'y';
    this.minVal = config.minVal;
    this.maxVal = config.maxVal;
    this.currentVal = config.initialVal;
    this.sensitivity = config.sensitivity ?? 0.003;

    this.updateMeshPosition();
  }

  public getValue(): number {
    return this.currentVal;
  }

  public setValue(val: number): void {
    if (this.isLocked) return;
    this.currentVal = Math.max(this.minVal, Math.min(this.maxVal, val));
    this.updateMeshPosition();
  }

  public setLocked(locked: boolean): void {
    this.isLocked = locked;
    if (locked) {
      AudioManager.playSnap();
    }
  }

  public getLocked(): boolean {
    return this.isLocked;
  }

  public slideByDelta(deltaPixels: number, isShiftPressed = false): number {
    if (this.isLocked) return this.currentVal;

    const precisionMultiplier = isShiftPressed ? 0.2 : 1.0;
    const deltaVal = deltaPixels * this.sensitivity * precisionMultiplier;
    this.currentVal = Math.max(this.minVal, Math.min(this.maxVal, this.currentVal + deltaVal));
    this.updateMeshPosition();
    return this.currentVal;
  }

  private updateMeshPosition(): void {
    if (this.axis === 'x') this.group.position.x = this.currentVal;
    else if (this.axis === 'y') this.group.position.y = this.currentVal;
    else this.group.position.z = this.currentVal;
  }

  public reset(initialVal?: number): void {
    this.currentVal = initialVal ?? (this.minVal + this.maxVal) / 2;
    this.isLocked = false;
    this.updateMeshPosition();
  }
}
