import * as THREE from 'three';

export class KitBoxEntity {
  public group = new THREE.Group();

  constructor(position: [number, number, number] = [0.48, 0.02, 0.28]) {
    this.group.position.set(...position);
    this.group.name = 'component_kit_box';
    this.buildBoxGeometry();
  }

  private buildBoxGeometry() {
    const boxOuterMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.5 });
    const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.32), boxOuterMat);
    boxBottom.castShadow = true;
    boxBottom.receiveShadow = true;
    this.group.add(boxBottom);

    const wallMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4 });
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.01), wallMat);
    wallN.position.set(0, 0.03, -0.155);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.01), wallMat);
    wallS.position.set(0, 0.03, 0.155);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.30), wallMat);
    wallW.position.set(-0.185, 0.03, 0);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.30), wallMat);
    wallE.position.set(0.185, 0.03, 0);
    this.group.add(wallN, wallS, wallW, wallE);

    // Internal dividers
    const divMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6 });
    const div1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.04, 0.30), divMat);
    div1.position.set(-0.06, 0.02, 0);
    const div2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.006), divMat);
    div2.position.set(0.06, 0.02, 0);
    this.group.add(div1, div2);
  }
}
