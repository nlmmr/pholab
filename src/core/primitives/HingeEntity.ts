import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface HingeConfig {
  id: string;
  name: string;
  axis?: 'x' | 'y' | 'z';
  minAngleRad?: number;
  maxAngleRad?: number;
  initialOpen?: boolean;
}

export class HingeEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly group = new THREE.Group();

  private axis: 'x' | 'y' | 'z';
  private minAngleRad: number;
  private maxAngleRad: number;
  private currentAngleRad: number;
  private isFullyOpen = false;

  constructor(config: HingeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.axis = config.axis ?? 'x';
    this.minAngleRad = config.minAngleRad ?? 0;
    this.maxAngleRad = config.maxAngleRad ?? Math.PI * 0.62;
    this.currentAngleRad = config.initialOpen ? this.maxAngleRad : this.minAngleRad;
    this.isFullyOpen = !!config.initialOpen;

    this.updateMeshRotation();
  }

  public isOpen(): boolean {
    return this.isFullyOpen;
  }

  public getAngleRad(): number {
    return this.currentAngleRad;
  }

  public toggle(): boolean {
    this.isFullyOpen = !this.isFullyOpen;
    this.currentAngleRad = this.isFullyOpen ? this.maxAngleRad : this.minAngleRad;
    this.updateMeshRotation();
    AudioManager.playSwitchClick(this.isFullyOpen);
    return this.isFullyOpen;
  }

  public rotateByDelta(deltaRad: number): void {
    const next = Math.max(this.minAngleRad, Math.min(this.maxAngleRad, this.currentAngleRad + deltaRad));
    this.currentAngleRad = next;
    this.isFullyOpen = this.currentAngleRad >= this.maxAngleRad * 0.85;
    this.updateMeshRotation();
  }

  private updateMeshRotation(): void {
    if (this.axis === 'x') this.group.rotation.x = -this.currentAngleRad;
    else if (this.axis === 'y') this.group.rotation.y = this.currentAngleRad;
    else this.group.rotation.z = this.currentAngleRad;
  }
}
