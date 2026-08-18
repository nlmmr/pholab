import * as THREE from 'three';

export class DeformableSandBowl {
  public group = new THREE.Group();
  public sandMesh: THREE.Mesh;
  public sandGeom: THREE.PlaneGeometry;
  private basePositions: Float32Array;

  constructor(initialPos: [number, number, number] = [0.38, 0.035, 0.36]) {
    this.group.position.set(...initialPos);
    this.group.name = 'component_sand_bowl';

    // Plastic / Ceramic Bowl
    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.095, 0.05, 36),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 })
    );
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    this.group.add(bowlMesh);

    // Deformable Sand Plane (64x64 vertices)
    this.sandGeom = new THREE.PlaneGeometry(0.21, 0.21, 64, 64);
    this.sandGeom.rotateX(-Math.PI / 2);
    this.basePositions = new Float32Array(this.sandGeom.attributes.position.array);

    const sandMat = new THREE.MeshStandardMaterial({
      color: '#c89658',
      roughness: 0.96,
      metalness: 0.02,
      bumpScale: 0.03,
    });
    this.sandMesh = new THREE.Mesh(this.sandGeom, sandMat);
    this.sandMesh.position.y = 0.024;
    this.sandMesh.receiveShadow = true;
    this.sandMesh.castShadow = true;
    this.group.add(this.sandMesh);
  }

  public carveCrater(diameterMm: number) {
    const posAttr = this.sandGeom.attributes.position;
    const array = posAttr.array as Float32Array;
    const craterRadiusM = (diameterMm / 2) / 1000;
    const depthM = Math.max(0.003, craterRadiusM * 0.4);
    const rimRadiusM = craterRadiusM * 1.25;
    const rimHeightM = depthM * 0.35;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = this.basePositions[i * 3];
      const vz = this.basePositions[i * 3 + 1];
      const r = Math.sqrt(vx * vx + vz * vz);

      if (r <= craterRadiusM) {
        const frac = r / craterRadiusM;
        array[i * 3 + 2] = -depthM * (1 - frac * frac);
      } else if (r <= rimRadiusM) {
        const frac = (r - craterRadiusM) / (rimRadiusM - craterRadiusM);
        array[i * 3 + 2] = rimHeightM * Math.sin(frac * Math.PI);
      } else {
        array[i * 3 + 2] = 0;
      }
    }

    posAttr.needsUpdate = true;
    this.sandGeom.computeVertexNormals();
  }

  public resetLevel() {
    const posAttr = this.sandGeom.attributes.position;
    const array = posAttr.array as Float32Array;
    for (let i = 0; i < posAttr.count; i++) {
      array[i * 3 + 2] = this.basePositions[i * 3 + 2];
    }
    posAttr.needsUpdate = true;
    this.sandGeom.computeVertexNormals();
  }
}
