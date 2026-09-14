import { ExamSeedPRNG } from './ExamSeedPRNG';

/**
 * NoiseEngine: Real-time and deterministic measurement noise modeling
 */
export class NoiseEngine {
  private prng: ExamSeedPRNG;
  private zeroOffsetPowerMw: number;
  private darkCurrentNoiseMw: number;
  private micrometerBacklashOffsetMm: number;

  constructor(examSeed: string) {
    this.prng = new ExamSeedPRNG(examSeed);
    // Seed-dependent systematic calibration offsets
    this.zeroOffsetPowerMw = this.prng.range(-0.008, 0.012); // Small zero-drift on power meter
    this.darkCurrentNoiseMw = this.prng.range(0.002, 0.005);
    this.micrometerBacklashOffsetMm = this.prng.range(-0.005, 0.005);
  }

  /**
   * Apply instantaneous stochastic noise to optical power readings
   * @param theoreticalPowerMw Exact analytical intensity in mW
   * @param laserRinPercent Relative intensity noise percentage
   * @param tareOffset User zero-tare compensation
   */
  public sampleOpticalPower(
    theoreticalPowerMw: number,
    laserRinPercent = 1.2,
    tareOffset = 0
  ): { measuredPowerMw: number; isDark: boolean } {
    // 1. Thermal & dark current background
    const darkNoise = this.gaussianSample(0, this.darkCurrentNoiseMw);
    
    // 2. Relative Intensity Noise (scales with laser power)
    const rinStdDev = theoreticalPowerMw * (laserRinPercent / 100);
    const laserNoise = theoreticalPowerMw > 0 ? this.gaussianSample(0, rinStdDev) : 0;

    // 3. Total raw reading with systematic zero offset
    let raw = theoreticalPowerMw + this.zeroOffsetPowerMw + darkNoise + laserNoise - tareOffset;

    // Physical constraint: optical power meter cannot read deep negative (clamped with small negative noise floor)
    if (raw < -0.002) {
      raw = -0.001 + Math.random() * 0.001;
    }

    return {
      measuredPowerMw: raw,
      isDark: theoreticalPowerMw < 1e-5
    };
  }

  /**
   * Quantize a numeric reading to simulate digital display resolution & least-significant-digit flicker
   */
  public quantizeDisplay(value: number, decimalPlaces = 3): string {
    // Add micro-jitter (1 LSB flitting between consecutive values)
    const jitter = (Math.random() - 0.5) * Math.pow(10, -(decimalPlaces + 1));
    const finalVal = value + jitter;
    return finalVal.toFixed(decimalPlaces);
  }

  /**
   * Mechanical micrometer stage noise
   */
  public getMicrometerPosition(commandedPosMm: number): number {
    return commandedPosMm + this.micrometerBacklashOffsetMm;
  }

  private gaussianSample(mean = 0, sigma = 1): number {
    const u1 = Math.random();
    const u2 = Math.random();
    if (u1 <= 1e-15) return mean;
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * sigma;
  }
}
