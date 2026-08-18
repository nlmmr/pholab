import * as THREE from 'three';

export class ChronometerEntity {
  public group = new THREE.Group();
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;

  constructor(initialPos: [number, number, number] = [0.58, 0.032, 0.40]) {
    this.group.position.set(...initialPos);
    this.group.name = 'component_chronometer';

    const chronoBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.016, 24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 })
    );
    this.group.add(chronoBody);

    const btnStart = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.3 })
    );
    btnStart.position.set(0.018, 0.01, -0.03);
    btnStart.name = 'button_chrono_start';
    this.group.add(btnStart);

    const btnReset = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
    );
    btnReset.position.set(-0.018, 0.01, -0.03);
    btnReset.name = 'button_chrono_reset';
    this.group.add(btnReset);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);

    const lcdMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.022),
      new THREE.MeshBasicMaterial({ map: this.texture })
    );
    lcdMesh.rotation.x = -Math.PI / 2;
    lcdMesh.position.set(0, 0.0085, 0.005);
    this.group.add(lcdMesh);

    this.updateTime(0);
  }

  public updateTime(timeSeconds: number) {
    this.ctx.fillStyle = '#047857';
    this.ctx.fillRect(0, 0, 256, 128);
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = 'bold 56px monospace';
    const s = Math.floor(timeSeconds);
    const cs = Math.floor((timeSeconds % 1) * 100);
    const text = `${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
    this.ctx.fillText(text, 36, 85);
    this.texture.needsUpdate = true;
  }
}
