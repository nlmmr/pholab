import { IPHO_2024_E2_CONFIG } from './config';

export interface PhaseParameters {
  thicknessMm: number;
  wavelengthNm: number;
  glassIndex: number;
  ambientIndex: number;
}

export const DEFAULT_PHASE_PARAMETERS: PhaseParameters = {
  thicknessMm: IPHO_2024_E2_CONFIG.hiddenSlideThicknessMm,
  wavelengthNm: IPHO_2024_E2_CONFIG.wavelengthNm,
  glassIndex: IPHO_2024_E2_CONFIG.glassIndex,
  ambientIndex: IPHO_2024_E2_CONFIG.ambientIndex,
};

export function phaseDifference(
  angleDeg: number,
  parameters: PhaseParameters = DEFAULT_PHASE_PARAMETERS,
): number {
  const theta = (angleDeg * Math.PI) / 180;
  const wavelengthMm = parameters.wavelengthNm * 1e-6;
  const { thicknessMm: h, glassIndex: n, ambientIndex: N } = parameters;
  const opticalPath = Math.sqrt(n * n - N * N * Math.sin(theta) ** 2) - N * Math.cos(theta);
  return ((2 * Math.PI * h) / wavelengthMm) * opticalPath;
}

export function phaseAtNormalIncidence(
  parameters: PhaseParameters = DEFAULT_PHASE_PARAMETERS,
): number {
  const wavelengthMm = parameters.wavelengthNm * 1e-6;
  return (
    (2 * Math.PI * parameters.thicknessMm * (parameters.glassIndex - parameters.ambientIndex)) /
    wavelengthMm
  );
}

export function visualPhase(
  angleDeg: number,
  parameters: PhaseParameters = DEFAULT_PHASE_PARAMETERS,
): number {
  const twoPi = 2 * Math.PI;
  return ((phaseDifference(angleDeg, parameters) % twoPi) + twoPi) % twoPi;
}

export function fringeShiftCount(
  angleDeg: number,
  parameters: PhaseParameters = DEFAULT_PHASE_PARAMETERS,
): number {
  return (phaseDifference(angleDeg, parameters) - phaseAtNormalIncidence(parameters)) / (2 * Math.PI);
}

export function findAngleForFringe(
  fringeIndex: number,
  parameters: PhaseParameters = DEFAULT_PHASE_PARAMETERS,
): number | null {
  if (fringeIndex < 0) return null;
  let low = 0;
  let high: number = IPHO_2024_E2_CONFIG.maxAngleDeg;
  if (fringeShiftCount(high, parameters) < fringeIndex) return null;

  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    if (fringeShiftCount(mid, parameters) < fringeIndex) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export interface AlignmentInput {
  laserHeight: number;
  lensHeight: number;
  screenDistance: number;
}

export function alignmentQuality({
  laserHeight,
  lensHeight,
  screenDistance,
}: AlignmentInput): number {
  const edgeTarget = 0.56;
  const laserLoss = Math.exp(-Math.pow((laserHeight - edgeTarget) / 0.115, 2));
  const lensLoss = Math.exp(-Math.pow((lensHeight - laserHeight) / 0.13, 2));
  const distanceLoss = Math.exp(-Math.pow((screenDistance - 0.84) / 0.42, 2));
  return Math.max(0, Math.min(1, laserLoss * lensLoss * distanceLoss));
}
