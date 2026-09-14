import { BallSpec } from '../types/pholab';
import { ExamSeedPRNG } from './ExamSeedPRNG';

export const OFFICIAL_IPHO_BALLS: BallSpec[] = [
  { id: 'ball-1', name: 'Esfera #1 (d=2.0 mm)', diameterMm: 2.0, massG: 0.033, color: '#94a3b8' },
  { id: 'ball-2', name: 'Esfera #2 (d=5.0 mm)', diameterMm: 5.0, massG: 0.51, color: '#cbd5e1' },
  { id: 'ball-3', name: 'Esfera #3 (d=9.0 mm)', diameterMm: 9.0, massG: 3.0, color: '#e2e8f0' },
  { id: 'ball-4', name: 'Esfera #4 (d=16.0 mm)', diameterMm: 16.0, massG: 17.0, color: '#f8fafc' },
];

export interface ImpactResult {
  craterDiameterMm: number;
  craterDepthMm: number;
  impactEnergyJ: number;
  impactVelocityMs: number;
  airDragExceeded: boolean;
}

export interface RollingResult {
  travelTimeS: number;
  measuredTimeS: number; // Includes human reaction and timer quantization jitter
  finalVelocityMs: number;
  stoppingDistanceCm: number;
  effectiveFrictionMu: number;
}

export class SandImpactPhysics {
  private prng: ExamSeedPRNG;
  private g = 9.81; // m/s^2

  constructor(examSeed = 'IPHO-2025-MARS') {
    this.prng = new ExamSeedPRNG(examSeed);
  }

  public updateSeed(examSeed: string) {
    this.prng = new ExamSeedPRNG(examSeed);
  }

  /**
   * Part A: Compute Crater Diameter and Energy from Ball Drop
   * Model: D = 6.92 * (m_g * h_cm)^0.25 (mm)
   */
  public computeImpact(
    ball: BallSpec,
    dropHeightCm: number,
    isSandLeveled: boolean
  ): ImpactResult {
    const hM = dropHeightCm / 100;
    const mKg = ball.massG / 1000;
    const impactEnergyJ = mKg * this.g * hM;
    const impactVelocityMs = Math.sqrt(2 * this.g * hM);

    // Maximum height before air drag exceeds 10%
    const rhoAir = 1.2;
    const rhoSteel = 7800;
    const cx = 0.45;
    const hMaxM = 0.1 * (2 / 3) * (rhoSteel / rhoAir) * (1 / cx) * (ball.diameterMm / 1000);
    const airDragExceeded = hM > hMaxM;

    // Ideal theoretical pre-IPhO power law
    const rawDiameterMm = 6.92 * Math.pow(ball.massG * dropHeightCm, 0.25);

    // Compaction factor (if sand wasn't stirred and leveled)
    const compactionMultiplier = isSandLeveled ? 1.0 : 0.78;

    // Stochastic experimental variation (grain packing + ruler reading uncertainty)
    const noiseMm = this.prng.gaussian(0, 0.85);
    const measuredDiameterMm = Math.max(
      ball.diameterMm,
      rawDiameterMm * compactionMultiplier + noiseMm
    );

    const craterDepthMm = Math.max(1.0, (measuredDiameterMm / 4.2) * compactionMultiplier);

    return {
      craterDiameterMm: Math.round(measuredDiameterMm * 10) / 10,
      craterDepthMm: Math.round(craterDepthMm * 10) / 10,
      impactEnergyJ,
      impactVelocityMs,
      airDragExceeded,
    };
  }

  /**
   * Part B: Compute Rolling Time on Rail & Stopping Distance in Sand
   * Rail: x(t) = (5/7) * (1/2) * g * sin(theta) * t^2
   * Stopping in Sand: L = (5/7) * (sin(theta) / mu_eff) * l
   */
  public computeRolling(
    releaseDistanceCm: number,
    railAngleDeg = 5.0,
    isSandLeveled = true
  ): RollingResult {
    const lM = releaseDistanceCm / 100;
    const thetaRad = (railAngleDeg * Math.PI) / 180;
    const sinTheta = Math.sin(thetaRad);

    // Theoretical acceleration a = (5/7) * g * sin(theta)
    const a = (5 / 7) * this.g * sinTheta;
    const theoreticalTimeS = Math.sqrt((2 * lM) / Math.max(0.001, a));

    // Human stopwatch reaction jitter (normal distribution sigma ~ 0.04s)
    const reactionJitter = this.prng.gaussian(0, 0.038);
    const measuredTimeS = Math.max(0.1, theoreticalTimeS + reactionJitter);

    const finalVelocityMs = Math.sqrt(2 * a * lM);

    // Sand effective friction coefficient mu_eff ~ 0.80 +/- 0.10
    const baseMu = 0.80 + this.prng.gaussian(0, 0.04);
    const effectiveFrictionMu = isSandLeveled ? baseMu : baseMu * 1.35; // compacted sand gives higher resistance or smaller penetration

    const stoppingDistanceM = (5 / 7) * (sinTheta / effectiveFrictionMu) * lM;
    const noiseDistCm = this.prng.gaussian(0, 0.45);
    const stoppingDistanceCm = Math.max(
      0.5,
      stoppingDistanceM * 100 + noiseDistCm
    );

    return {
      travelTimeS: theoreticalTimeS,
      measuredTimeS: Math.round(measuredTimeS * 100) / 100,
      finalVelocityMs,
      stoppingDistanceCm: Math.round(stoppingDistanceCm * 10) / 10,
      effectiveFrictionMu: Math.round(effectiveFrictionMu * 100) / 100,
    };
  }
}
