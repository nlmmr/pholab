import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export interface CableConfig {
  id: string;
  points: THREE.Vector3[];
  color?: string;
  radius?: number;
  initiallyConnected?: boolean;
}

/**
 * Generates dynamic hanging catenary spline points between two 3D positions.
 * Produces (segments + 1) points with gravitational sag toward bench level.
 */
export function generateCatenaryPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments = 16,
  sag = 0.08,
  benchY = 0.04
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const minY = Math.min(start.y, end.y);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = new THREE.Vector3().lerpVectors(start, end, t);
    if (i > 0 && i < segments) {
      // Parabolic catenary sag factor (peaks at 1.0 at t = 0.5)
      const parabolic = 4 * t * (1 - t);
      const sagTowardBench = (pt.y - benchY) * 0.75 * parabolic + sag * parabolic;
      pt.y -= sagTowardBench;
      if (t >= 0.4 && t <= 0.6 && pt.y >= minY) {
        pt.y = minY - 0.02;
      }
    }
    points.push(pt);
  }
  return points;
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
