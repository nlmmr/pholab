import * as THREE from 'three';
import { BallSpec } from '../../domain/types/entities';

export class StandApparatus {
  public baseGroup = new THREE.Group();
  public rodGroup = new THREE.Group();
  public collarGroup = new THREE.Group();
  public dropBallMesh: THREE.Mesh;

  constructor(
    basePos: [number, number, number] = [0.46, 0.025, 0.34],
    rodPos: [number, number, number] = [0.60, 0.035, 0.28],
    collarPos: [number, number, number] = [0.55, 0.035, 0.38]
  ) {
    // 1. Base (f1)
    this.baseGroup.position.set(...basePos);
    this.baseGroup.name = 'component_stand_base';
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.025, 0.26),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    baseMesh.castShadow = true;
    this.baseGroup.add(baseMesh);

    const holeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.026, 16),
      new THREE.MeshStandardMaterial({ color: '#1e293b' })
    );
    holeMesh.position.set(0.11, 0, -0.07);
    this.baseGroup.add(holeMesh);

    // 2. Rod (f4) (1.15m)
    this.rodGroup.position.set(...rodPos);
    this.rodGroup.rotation.x = Math.PI / 2; // Initial state: in box
    this.rodGroup.name = 'component_stand_rod';
    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 1.15, 20),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
    );
    rodMesh.castShadow = true;
    this.rodGroup.add(rodMesh);

    for (let h = 0.1; h <= 1.0; h += 0.1) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, 0.002, 16),
        new THREE.MeshStandardMaterial({ color: h % 0.5 === 0 ? '#ef4444' : '#1e293b' })
      );
      ring.position.set(0, h - 0.58, 0);
      this.rodGroup.add(ring);
    }

    // 3. Collar & Arm (f2, f3)
    this.collarGroup.position.set(...collarPos);
    this.collarGroup.name = 'component_stand_collar';

    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.6, roughness: 0.3 })
    );
    this.collarGroup.add(collarMesh);

    const armMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.13, 16),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 })
    );
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(-0.065, 0, 0.07);
    this.collarGroup.add(armMesh);

    const triggerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.016, 0.014),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
    );
    triggerMesh.position.set(-0.13, 0.012, 0.07);
    triggerMesh.name = 'trigger_drop_ball';
    this.collarGroup.add(triggerMesh);

    this.dropBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.0045, 24, 24),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    this.dropBallMesh.position.set(-0.13, 0, 0.07);
    this.dropBallMesh.castShadow = true;
    this.collarGroup.add(this.dropBallMesh);
  }

  public updateBallSpec(ball: BallSpec) {
    const r = Math.max(0.003, ball.diameterMm / 2000);
    this.dropBallMesh.geometry.dispose();
    this.dropBallMesh.geometry = new THREE.SphereGeometry(r, 24, 24);
  }
}
