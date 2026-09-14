import * as THREE from 'three';

export class InclinedRailTrack {
  public railGroup = new THREE.Group();
  public trackGroup = new THREE.Group();
  public railBallMesh: THREE.Mesh;

  constructor(
    railPos: [number, number, number] = [0.62, 0.035, 0.28],
    trackPos: [number, number, number] = [0.36, 0.028, 0.26]
  ) {
    // 1. Aluminum Rail (h)
    this.railGroup.position.set(...railPos);
    this.railGroup.name = 'component_inclined_rail';

    const railMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.015, 0.95),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.2 })
    );
    railMesh.castShadow = true;
    this.railGroup.add(railMesh);

    const railTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 0.015),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 })
    );
    railTrigger.position.set(0, 0.05, -0.40);
    railTrigger.name = 'trigger_roll_ball';
    this.railGroup.add(railTrigger);

    this.railBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 20, 20),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.95, roughness: 0.1 })
    );
    this.railBallMesh.position.set(0, 0.04, -0.37);
    this.railBallMesh.castShadow = true;
    this.railGroup.add(this.railBallMesh);

    // 2. Wooden Braking Track (j)
    this.trackGroup.position.set(...trackPos);
    this.trackGroup.name = 'component_braking_track';

    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.55),
      new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    );
    trackMesh.castShadow = true;
    this.trackGroup.add(trackMesh);

    const sandTrackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.015, 0.53),
      new THREE.MeshStandardMaterial({ color: '#c89658', roughness: 0.95 })
    );
    sandTrackMesh.position.set(0, 0.02, 0);
    sandTrackMesh.receiveShadow = true;
    this.trackGroup.add(sandTrackMesh);
  }
}
