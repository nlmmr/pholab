import * as THREE from 'three';

export class AcrylicRulerEntity {
  public group = new THREE.Group();

  constructor(initialPos: [number, number, number] = [0.55, 0.032, 0.20]) {
    this.group.position.set(...initialPos);
    this.group.name = 'component_ruler';

    const rulerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.003, 0.03),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.1,
      })
    );
    rulerMesh.castShadow = true;
    this.group.add(rulerMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';

    for (let mm = 0; mm <= 200; mm++) {
      const x = (mm / 200) * 1000 + 12;
      const h = mm % 10 === 0 ? 54 : mm % 5 === 0 ? 36 : 20;
      ctx.fillRect(x, 0, 2, h);
      if (mm % 10 === 0 && mm > 0) {
        ctx.fillText(`${mm / 10}`, x - 6, 80);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    const scaleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.235, 0.028),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    scaleMesh.rotation.x = -Math.PI / 2;
    scaleMesh.position.y = 0.0018;
    this.group.add(scaleMesh);
  }
}

export class StirringSpoonEntity {
  public group = new THREE.Group();

  constructor(initialPos: [number, number, number] = [0.50, 0.032, 0.16]) {
    this.group.position.set(...initialPos);
    this.group.name = 'component_spoon';

    const spoonHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.2 })
    );
    spoonHandle.rotation.x = Math.PI / 2;
    this.group.add(spoonHandle);

    const spoonHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 16, 16),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 })
    );
    spoonHead.scale.set(1, 0.3, 1.4);
    spoonHead.position.set(0, 0, 0.08);
    this.group.add(spoonHead);
  }
}
