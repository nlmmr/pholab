import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface CableConfig {
  id: string;
  points: THREE.Vector3[];
  color?: string;
  radius?: number;
  initiallyConnected?: boolean;
}

export class CableConnection {
  public readonly id: string;
  public readonly group = new THREE.Group();
  private isConnected: boolean;
  private mesh: THREE.Mesh;

  constructor(config: CableConfig) {
    this.id = config.id;
    this.isConnected = config.initiallyConnected ?? false;

    const curve = new THREE.CatmullRomCurve3(config.points);
    const geom = new THREE.TubeGeometry(curve, 28, config.radius ?? 0.012, 8, false);
    const mat = new THREE.MeshStandardMaterial({
      color: config.color ?? '#1e293b',
      roughness: 0.8,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.group.visible = this.isConnected;
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public setConnected(connected: boolean): void {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.group.visible = this.isConnected;
      AudioManager.playSnap();
    }
  }

  public toggle(): boolean {
    this.setConnected(!this.isConnected);
    return this.isConnected;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
  }
}
