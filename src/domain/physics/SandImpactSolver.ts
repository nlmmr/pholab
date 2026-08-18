import { BallSpec } from '../types/entities';

export interface ImpactResult {
  impactVelocityMps: number;
  impactEnergyJ: number;
  craterDiameterMm: number;
  craterDepthMm: number;
  rimHeightMm: number;
}

export class SandImpactSolver {
  private g = 9.81; // Earth / Lab acceleration of gravity (m/s^2)
  private noiseSigmaPercent: number;

  constructor(noiseSigmaPercent = 1.8) {
    this.noiseSigmaPercent = noiseSigmaPercent;
  }

  /**
   * Compute free-fall impact kinematics and crater morphology according to IPhO 2025 France scaling laws:
   * E = m * g * h
   * D(E) = C * E^(1/4)
   */
  public computeImpact(ball: BallSpec, dropHeightCm: number, isSandLeveled: boolean): ImpactResult {
    const hM = Math.max(0.01, dropHeightCm / 100);
    const massKg = ball.massG / 1000;
    const diameterM = ball.diameterMm / 1000;

    // Kinematic Velocity at Impact: v = sqrt(2 * g * h)
    const impactVelocityMps = Math.sqrt(2 * this.g * hM);

    // Impact Kinetic Energy: E = m * g * h (Joules)
    const impactEnergyJ = massKg * this.g * hM;

    // Scaling constant C_crater for fine dry silica sand (IPhO 2025 experimental nominal calibration)
    // D ~ 6.92 * (m_g * h_m)^(0.25) [mm]
    const compactionFactor = isSandLeveled ? 1.0 : 0.88; // Compacted sand forms slightly shallower craters
    const nominalDiameterMm = 6.92 * Math.pow(ball.massG * hM, 0.25) * compactionFactor;

    // Gaussian experimental noise
    const jitter = 1 + ((Math.random() - 0.5) * 2 * (this.noiseSigmaPercent / 100));
    const finalDiameterMm = Math.max(ball.diameterMm * 1.05, nominalDiameterMm * jitter);

    const craterDepthMm = finalDiameterMm * 0.22;
    const rimHeightMm = craterDepthMm * 0.32;

    return {
      impactVelocityMps: Number(impactVelocityMps.toFixed(3)),
      impactEnergyJ: Number(impactEnergyJ.toFixed(5)),
      craterDiameterMm: Number(finalDiameterMm.toFixed(1)),
      craterDepthMm: Number(craterDepthMm.toFixed(1)),
      rimHeightMm: Number(rimHeightMm.toFixed(1)),
    };
  }
}
