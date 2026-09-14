import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface SocketMountConfig {
  id: string;
  name: string;
  accepts: string[];
  position: [number, number, number];
  rotation?: [number, number, number];
  toleranceRadius?: number; // Raio de snap sutil (ex: 0.035m = 3.5 cm)
}

export class SocketMountEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly accepts: string[];
  public readonly group = new THREE.Group();

  private toleranceRadius: number;
  private occupiedBy: string | null = null;
  private targetPosition: THREE.Vector3;
  private targetRotation: THREE.Euler;

  constructor(config: SocketMountConfig) {
    this.id = config.id;
    this.name = config.name;
    this.accepts = config.accepts;
    this.toleranceRadius = config.toleranceRadius ?? 0.04;

    this.group.position.set(...config.position);
    if (config.rotation) {
      this.group.rotation.set(...config.rotation);
    }
    this.targetPosition = this.group.position.clone();
    this.targetRotation = this.group.rotation.clone();
  }

  public isOccupied(): boolean {
    return this.occupiedBy !== null;
  }

  public getOccupant(): string | null {
    return this.occupiedBy;
  }

  public canAccept(componentType: string): boolean {
    return !this.isOccupied() && this.accepts.includes(componentType);
  }

  public getWorldTargetPosition(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    return worldPos;
  }

  public setToleranceRadius(radius: number): void {
    this.toleranceRadius = radius;
  }

  public getToleranceRadius(): number {
    return this.toleranceRadius;
  }

  /**
   * Testa se um objeto solto está próximo o suficiente para sofrer o snap mecânico
   */
  public testSnap(
    componentType: string,
    currentWorldPos: THREE.Vector3
  ): { canSnap: boolean; snappedPosition: THREE.Vector3; snappedRotation: THREE.Euler } {
    if (!this.canAccept(componentType)) {
      return { canSnap: false, snappedPosition: currentWorldPos, snappedRotation: new THREE.Euler() };
    }

    const targetPos = this.getWorldTargetPosition();
    const dist = currentWorldPos.distanceTo(targetPos);
    if (dist <= this.toleranceRadius) {
      const worldRot = new THREE.Euler();
      const worldQuat = new THREE.Quaternion();
      this.group.getWorldQuaternion(worldQuat);
      worldRot.setFromQuaternion(worldQuat);
      return {
        canSnap: true,
        snappedPosition: targetPos,
        snappedRotation: worldRot,
      };
    }

    return { canSnap: false, snappedPosition: currentWorldPos, snappedRotation: new THREE.Euler() };
  }

  public mount(componentId: string, silent = false): void {
    this.occupiedBy = componentId;
    if (!silent) {
      AudioManager.playSnap();
    }
  }

  public unmount(silent = false): void {
    this.occupiedBy = null;
    if (!silent) {
      AudioManager.playSnap();
    }
  }
}

