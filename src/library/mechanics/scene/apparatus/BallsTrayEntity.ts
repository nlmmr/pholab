import * as THREE from 'three';
import { BallSpec } from '../../domain/types/entities';

export class BallsTrayEntity {
  public group = new THREE.Group();

  constructor(
    balls: BallSpec[],
    selectedBallId: string,
    initialPos: [number, number, number] = [0.42, 0.035, 0.24]
  ) {
    this.group.position.set(...initialPos);
    this.group.name = 'component_balls_tray';

    const trayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.015, 0.08),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 })
    );
    trayMesh.castShadow = true;
    this.group.add(trayMesh);

    balls.forEach((b, idx) => {
      const bMesh = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.003, b.diameterMm / 1000), 16, 16),
        new THREE.MeshStandardMaterial({
          color: b.id === selectedBallId ? '#f59e0b' : '#94a3b8',
          metalness: 0.9,
          roughness: 0.15,
        })
      );
      bMesh.position.set(-0.06 + idx * 0.04, 0.015 + b.diameterMm / 2000, 0);
      bMesh.castShadow = true;
      bMesh.name = `ball_selector_${b.id}`;
      this.group.add(bMesh);
    });
  }
}
