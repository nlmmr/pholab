import * as THREE from 'three';

export class LabEnvironment {
  public readonly group = new THREE.Group();
  public readonly clockMesh: THREE.Mesh;
  public readonly paperMesh: THREE.Mesh;

  private clockCanvas: HTMLCanvasElement;
  private clockCtx: CanvasRenderingContext2D;
  private clockTexture: THREE.CanvasTexture;

  constructor() {
    // 1. Iluminação do Laboratório
    const hemi = new THREE.HemisphereLight('#f8fafc', '#94a3b8', 0.85);
    this.group.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 1.1);
    keyLight.position.set(-2.5, 4.2, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3.2;
    keyLight.shadow.camera.right = 3.2;
    keyLight.shadow.camera.top = 3.2;
    keyLight.shadow.camera.bottom = -3.2;
    keyLight.shadow.bias = -0.0005;
    this.group.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#e0f2fe', 0.4);
    fillLight.position.set(3, 2.5, 2);
    this.group.add(fillLight);

    // 2. Bancada de Laboratório (Fórmica ampliada de alta durabilidade)
    const tableTopGeom = new THREE.BoxGeometry(6.4, 0.12, 3.4);
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: '#b8aba0',
      roughness: 0.78,
      metalness: 0.08,
    });
    const tableTop = new THREE.Mesh(tableTopGeom, tableTopMat);
    tableTop.position.set(0, -0.06, 0);
    tableTop.receiveShadow = true;
    this.group.add(tableTop);

    // Pés de aço tubular da bancada
    const legGeom = new THREE.CylinderGeometry(0.048, 0.048, 1.4, 16);
    const legMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.5,
      metalness: 0.8,
    });
    const legPositions: [number, number, number][] = [
      [-2.85, -0.76, -1.45],
      [2.85, -0.76, -1.45],
      [-2.85, -0.76, 1.45],
      [2.85, -0.76, 1.45],
    ];
    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(...pos);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.group.add(leg);
    });

    // 3. Piso do Laboratório (Permite posicionar caixas e instrumentos no chão)
    const floorGeom = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.86,
      metalness: 0.06,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.46, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 4. Parede de Fundo do Laboratório Ampliada
    const wallGeom = new THREE.PlaneGeometry(10.0, 5.0);
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.95,
      metalness: 0.02,
    });
    const backWall = new THREE.Mesh(wallGeom, wallMat);
    backWall.position.set(0, 1.04, -1.72);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    // 5. Relógio Digital LED 3D Rebaixado na Parede (na linha de visão direta, y = 1.15)
    this.clockCanvas = document.createElement('canvas');
    this.clockCanvas.width = 512;
    this.clockCanvas.height = 128;
    this.clockCtx = this.clockCanvas.getContext('2d')!;
    this.clockTexture = new THREE.CanvasTexture(this.clockCanvas);

    const clockFrameGeom = new THREE.BoxGeometry(0.88, 0.28, 0.06);
    const clockFrameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
    const clockFrame = new THREE.Mesh(clockFrameGeom, clockFrameMat);
    clockFrame.position.set(0, 1.15, -1.68);

    const clockFaceGeom = new THREE.PlaneGeometry(0.82, 0.22);
    const clockFaceMat = new THREE.MeshBasicMaterial({ map: this.clockTexture, toneMapped: false });
    this.clockMesh = new THREE.Mesh(clockFaceGeom, clockFaceMat);
    this.clockMesh.position.set(0, 0, 0.032);
    clockFrame.add(this.clockMesh);
    this.group.add(clockFrame);

    this.updateClockDisplay('05:00:00', false);

    // 5. Caderno de Prova Físico em Cima da Bancada (Documento impresso)
    const paperGeom = new THREE.BoxGeometry(0.38, 0.004, 0.52);
    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = 512;
    paperCanvas.height = 700;
    const pCtx = paperCanvas.getContext('2d')!;
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, 512, 700);

    // Cabeçalho IPhO no papel impresso
    pCtx.fillStyle = '#0f172a';
    pCtx.font = '700 26px Arial';
    pCtx.fillText('IPhO 2024 · Experimental Competition', 36, 52);
    pCtx.font = '400 18px Arial';
    pCtx.fillStyle = '#475569';
    pCtx.fillText('Problem E2: Diffraction from Phase Steps', 36, 82);

    pCtx.strokeStyle = '#cbd5e1';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.moveTo(36, 100);
    pCtx.lineTo(476, 100);
    pCtx.stroke();

    pCtx.font = '400 14px Arial';
    pCtx.fillStyle = '#334155';
    pCtx.fillText('Time: 5.0 Hours · Points: 10.0', 36, 130);
    pCtx.fillText('Part A: Thickness of the thin slide (S1)', 36, 160);
    pCtx.fillText('Part B: Thickness of the thick slide (S2)', 36, 185);
    pCtx.fillText('Part C: Finding N using the thick slide', 36, 210);
    pCtx.fillText('Part D: Finding N using the thin slide', 36, 235);

    pCtx.fillStyle = '#0284c7';
    pCtx.font = '700 16px Arial';
    pCtx.fillText('Click to read full official PDF instructions ↗', 36, 640);

    const paperTexture = new THREE.CanvasTexture(paperCanvas);
    const paperMat = new THREE.MeshStandardMaterial({ map: paperTexture, roughness: 0.85 });
    this.paperMesh = new THREE.Mesh(paperGeom, paperMat);
    this.paperMesh.position.set(-0.15, 0.015, 1.05);
    this.paperMesh.rotation.y = -0.12; // Leve inclinação natural na mesa
    this.paperMesh.castShadow = true;
    this.paperMesh.receiveShadow = true;
    this.paperMesh.userData.interactionId = 'paper';
    this.group.add(this.paperMesh);
  }

  public updateClockDisplay(timeStr: string, isRunning: boolean): void {
    const { width, height } = this.clockCanvas;
    const ctx = this.clockCtx;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    ctx.font = '700 76px "Courier New", monospace';
    ctx.fillStyle = isRunning ? '#ef4444' : '#7f1d1d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, width / 2, height / 2);

    this.clockTexture.needsUpdate = true;
  }

  public dispose(): void {
    this.clockTexture.dispose();
  }
}
