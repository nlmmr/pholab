import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const PHASE_STATES = 64;
const PROFILE_SAMPLES = 256;

function fresnelCS(value: number): [number, number] {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const steps = 96;
  const h = x / steps;
  let c = 0;
  let s = 0;
  for (let i = 0; i <= steps; i += 1) {
    const t = i * h;
    const weight = i === 0 || i === steps ? 1 : i % 2 === 0 ? 2 : 4;
    const angle = (Math.PI * t * t) / 2;
    c += weight * Math.cos(angle);
    s += weight * Math.sin(angle);
  }
  return [sign * (c * h) / 3, sign * (s * h) / 3];
}

function buildLookup(): Float32Array {
  const lookup = new Float32Array(PHASE_STATES * PROFILE_SAMPLES);
  for (let sample = 0; sample < PROFILE_SAMPLES; sample += 1) {
    const u = ((sample / (PROFILE_SAMPLES - 1)) * 2 - 1) * 4.1;
    const [C, S] = fresnelCS(u);
    const leftReal = 0.5 + C;
    const leftImag = 0.5 + S;
    const rightReal = 1 - leftReal;
    const rightImag = 1 - leftImag;

    for (let phaseIndex = 0; phaseIndex < PHASE_STATES; phaseIndex += 1) {
      const phi = (phaseIndex / PHASE_STATES) * TWO_PI;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      const real = leftReal + rightReal * cos - rightImag * sin;
      const imag = leftImag + rightReal * sin + rightImag * cos;
      lookup[phaseIndex * PROFILE_SAMPLES + sample] = Math.min(1.5, (real * real + imag * imag) / 2);
    }
  }
  return lookup;
}

const LOOKUP = buildLookup();

export class PhaseStepPattern {
  public readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 144;
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.context = context;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.encoding = THREE.sRGBEncoding;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.update(0, 0);
  }

  update(phase: number, visibility: number): void {
    const wrapped = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
    const phasePosition = (wrapped / TWO_PI) * PHASE_STATES;
    const first = Math.floor(phasePosition) % PHASE_STATES;
    const second = (first + 1) % PHASE_STATES;
    const mix = phasePosition - Math.floor(phasePosition);
    const image = this.context.createImageData(this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.canvas.height; y += 1) {
      const normalizedY = (y / (this.canvas.height - 1)) * 2 - 1;
      const profilePosition = ((normalizedY + 1) / 2) * (PROFILE_SAMPLES - 1);
      const p0 = Math.floor(profilePosition);
      const p1 = Math.min(PROFILE_SAMPLES - 1, p0 + 1);
      const verticalMix = profilePosition - p0;

      const a0 = LOOKUP[first * PROFILE_SAMPLES + p0];
      const a1 = LOOKUP[first * PROFILE_SAMPLES + p1];
      const b0 = LOOKUP[second * PROFILE_SAMPLES + p0];
      const b1 = LOOKUP[second * PROFILE_SAMPLES + p1];
      const stateA = a0 + (a1 - a0) * verticalMix;
      const stateB = b0 + (b1 - b0) * verticalMix;
      const profile = stateA + (stateB - stateA) * mix;

      for (let x = 0; x < this.canvas.width; x += 1) {
        const normalizedX = (x / (this.canvas.width - 1)) * 2 - 1;
        const envelope = Math.exp(-2.1 * (normalizedX * normalizedX + normalizedY * normalizedY * 0.34));
        const subtleSpeckle = 0.96 + 0.04 * Math.sin(x * 0.71 + y * 1.37);
        const intensity = visibility * Math.max(0, profile) * envelope * subtleSpeckle;
        const red = Math.min(255, 7 + intensity * 255);
        const green = Math.min(96, 4 + intensity * intensity * 72);
        const blue = Math.min(76, 5 + intensity * 32);
        const index = (y * this.canvas.width + x) * 4;
        image.data[index] = red;
        image.data[index + 1] = green;
        image.data[index + 2] = blue;
        image.data[index + 3] = 255;
      }
    }

    this.context.putImageData(image, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
