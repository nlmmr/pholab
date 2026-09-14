import * as THREE from 'three';

export interface DigitalDisplayConfig {
  id: string;
  widthM?: number;
  heightM?: number;
  bgColor?: string;
  textColor?: string;
  defaultText?: string;
}

export class DigitalDisplayMesh {
  public readonly mesh: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private isPowered = false;
  private currentText = '';

  constructor(config: DigitalDisplayConfig) {
    const width = config.widthM ?? 0.22;
    const height = config.heightM ?? 0.08;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 192;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable for display');
    this.ctx = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.encoding = THREE.sRGBEncoding;

    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.name = config.id;
    this.currentText = config.defaultText ?? 'READY';
    this.renderDisplay();
  }

  public setPower(powered: boolean): void {
    if (this.isPowered !== powered) {
      this.isPowered = powered;
      this.renderDisplay();
    }
  }

  public setText(text: string): void {
    if (this.currentText !== text) {
      this.currentText = text;
      this.renderDisplay();
    }
  }

  /**
   * Renderiza a tela LCD procedural
   */
  public renderDisplay(subtleJitter = false): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    if (!this.isPowered) {
      // LCD Desligado (cinza escuro reflexivo)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, width - 8, height - 8);
    } else {
      // LCD Ligado com Backlight Azul e matriz de caracteres
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, width, height);

      // Moldura interna
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, width - 10, height - 10);

      // Texto em alto contraste branco/amarelo suave
      ctx.font = '700 52px "Courier New", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let displayText = this.currentText;
      if (subtleJitter && Math.random() > 0.85) {
        // Jitter sutil de instrumento no último caractere numérico
        const match = displayText.match(/(\d)$/);
        if (match) {
          const num = Number(match[1]);
          const jitterNum = (num + (Math.random() > 0.5 ? 1 : 9)) % 10;
          displayText = displayText.replace(/\d$/, String(jitterNum));
        }
      }

      ctx.fillText(displayText, width / 2, height / 2);
    }

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
  }
}
