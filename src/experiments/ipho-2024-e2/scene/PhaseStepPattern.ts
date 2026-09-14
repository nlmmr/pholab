import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 288;
const PROFILE_SAMPLES = 512;
const U_MAX = 4.6;

/**
 * Accurate numerical computation of Fresnel integrals C(x) and S(x)
 * using high-order composite Simpson's rule.
 */
function fresnelCS(value: number): [number, number] {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  if (x < 1e-7) return [0, 0];
  const steps = 180;
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

/**
 * Precompute analytical Fresnel phase-step terms M(u) and D(u):
 *   M(u) = C(u)^2 + S(u)^2
 *   D(u) = S(u) - C(u)
 *
 * The physical intensity for arbitrary phase shift phi is:
 *   I(u, phi) = cos^2(phi/2) + 2*sin^2(phi/2)*M(u) + sin(phi)*D(u)
 *
 * Conforming strictly to IPhO 2024 Figure 7:
 * - When phi = 0: I(u, 0) = 1.0 (unperturbed laser beam)
 * - When phi = pi: I(0, pi) = 0.0 (central dark destructive fringe, flanked by symmetric fringes)
 * - Intermediate phi: continuous asymmetric fringe translation across the boundary
 */
interface FresnelLookup {
  M: Float32Array;
  D: Float32Array;
}

function buildFresnelLookup(): FresnelLookup {
  const M = new Float32Array(PROFILE_SAMPLES);
  const D = new Float32Array(PROFILE_SAMPLES);
  for (let i = 0; i < PROFILE_SAMPLES; i += 1) {
    const u = ((i / (PROFILE_SAMPLES - 1)) * 2 - 1) * U_MAX;
    const [c, s] = fresnelCS(u);
    M[i] = c * c + s * s;
    D[i] = s - c;
  }
  return { M, D };
}

const FRESNEL_LOOKUP = buildFresnelLookup();

/**
 * Precompute static 2D high-frequency coherent laser speckle noise.
 * Simulates Rayleigh-distributed spatial interference from surface roughness
 * of the matte projection screen under 650nm coherent laser illumination.
 */
function buildSpeckleNoise(width: number, height: number): Float32Array {
  const noise = new Float32Array(width * height);
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      // High-frequency speckle with subtle grain correlation
      const r1 = pseudoRandom();
      const r2 = pseudoRandom();
      const rayleigh = Math.sqrt(-2 * Math.log(Math.max(1e-4, r1))) * 0.15;
      const grain = (r2 - 0.5) * 0.12;
      noise[idx] = Math.max(0.65, Math.min(1.4, 0.95 + rayleigh + grain));
    }
  }
  return noise;
}

const SPECKLE = buildSpeckleNoise(CANVAS_WIDTH, CANVAS_HEIGHT);

/**
 * PhaseStepPattern generates the photorealistic 650nm laser diffraction pattern
 * produced by an optical phase step (microscope slide edge).
 */
export class PhaseStepPattern {
  public readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly pixelBuffer: Uint32Array;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.context = context;
    this.imageData = this.context.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.pixelBuffer = new Uint32Array(this.imageData.data.buffer);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.encoding = THREE.sRGBEncoding;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.update(0, 0);
  }

  /**
   * Updates the diffraction pattern texture based on the current optical phase
   * difference and alignment visibility factor.
   *
   * @param phase Optical phase difference (radians) across the phase step
   * @param visibility Alignment quality factor in [0, 1]
   */
  update(phase: number, visibility: number): void {
    const wrapped = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
    const halfPhi = wrapped * 0.5;

    // Physical phase terms
    const cosHalf = Math.cos(halfPhi);
    const sinHalf = Math.sin(halfPhi);
    const c1 = cosHalf * cosHalf;
    const c2 = 2 * sinHalf * sinHalf;
    const c3 = Math.sin(wrapped);

    // Evaluate 1D diffraction profile along vertical axis Y
    const rowProfile = new Float32Array(CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 1) {
      const sampleIdx = Math.round((y / (CANVAS_HEIGHT - 1)) * (PROFILE_SAMPLES - 1));
      const m = FRESNEL_LOOKUP.M[sampleIdx];
      const d = FRESNEL_LOOKUP.D[sampleIdx];
      rowProfile[y] = Math.max(0, c1 + c2 * m + c3 * d);
    }

    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;
    const buf = this.pixelBuffer;
    const speckle = SPECKLE;

    let pixelIdx = 0;
    for (let y = 0; y < height; y += 1) {
      const ny = (y / (height - 1)) * 2 - 1;
      const profileVal = rowProfile[y];
      const yEnvelope = Math.exp(-1.45 * ny * ny);

      for (let x = 0; x < width; x += 1) {
        const nx = (x / (width - 1)) * 2 - 1;
        const envelope = Math.exp(-2.6 * nx * nx) * yEnvelope;
        const spk = speckle[pixelIdx];

        // Overall laser intensity at this point
        const intensity = visibility * profileVal * envelope * spk;

        let r = 11;
        let g = 11;
        let b = 13;

        // Subtle reticle / millimeter grid on screen
        const isReticleX = Math.abs(x - width / 2) < 1 && Math.abs(ny) < 0.85;
        const isReticleY = Math.abs(y - height / 2) < 1 && Math.abs(nx) < 0.85;
        const isMmTick = (x % 32 === 0 || y % 32 === 0) && (Math.abs(nx) < 0.9 && Math.abs(ny) < 0.9);

        if (isReticleX || isReticleY) {
          r = Math.max(r, 48);
          g = Math.max(g, 54);
          b = Math.max(b, 62);
        } else if (isMmTick) {
          r = Math.max(r, 22);
          g = Math.max(g, 25);
          b = Math.max(b, 30);
        }

        if (intensity > 0.001) {
          // 650nm Monochromatic laser color mapping with core saturation bloom
          const laserR = Math.min(255, 14 + intensity * 240);
          // Core transitions to vivid warm orange-white when saturated (high beam power)
          const laserG = intensity > 0.65 ? Math.min(220, (intensity - 0.65) * 160) : Math.min(60, intensity * intensity * 50);
          const laserB = intensity > 1.0 ? Math.min(180, (intensity - 1.0) * 150) : Math.min(45, intensity * intensity * 30);

          r = Math.min(255, Math.max(r, Math.round(laserR)));
          g = Math.min(255, Math.max(g, Math.round(laserG)));
          b = Math.min(255, Math.max(b, Math.round(laserB)));
        }

        // Little-endian 32-bit packing: (A << 24) | (B << 16) | (G << 8) | R
        buf[pixelIdx] = (255 << 24) | (b << 16) | (g << 8) | r;
        pixelIdx += 1;
      }
    }

    this.context.putImageData(this.imageData, 0, 0);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
