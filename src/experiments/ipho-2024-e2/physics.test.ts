import { describe, expect, it } from 'vitest';
import { IPHO_2024_E2_CONFIG } from './config';
import {
  DEFAULT_PHASE_PARAMETERS,
  findAngleForFringe,
  fringeShiftCount,
  phaseAtNormalIncidence,
  phaseDifference,
  visualPhase,
} from './physics';

describe('IPhO 2024 E2 phase model', () => {
  it('matches the official normal-incidence expression', () => {
    const { thicknessMm: h, wavelengthNm, glassIndex: n, ambientIndex: N } = DEFAULT_PHASE_PARAMETERS;
    const expected = (2 * Math.PI * h * (n - N)) / (wavelengthNm * 1e-6);
    expect(phaseDifference(0)).toBeCloseTo(expected, 10);
    expect(phaseAtNormalIncidence()).toBeCloseTo(expected, 10);
  });

  it('wraps the visual state with 2π periodicity', () => {
    const phase = phaseDifference(37.2);
    const wrapped = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect(visualPhase(37.2)).toBeCloseTo(wrapped, 10);
    expect(wrapped).toBeGreaterThanOrEqual(0);
    expect(wrapped).toBeLessThan(2 * Math.PI);
  });

  it('increases fringe count throughout the Part A angular range', () => {
    let previous = fringeShiftCount(0);
    for (let angle = 1; angle <= IPHO_2024_E2_CONFIG.maxAngleDeg; angle += 1) {
      const current = fringeShiftCount(angle);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('covers substantially more than the required 25 observations', () => {
    expect(fringeShiftCount(IPHO_2024_E2_CONFIG.maxAngleDeg)).toBeGreaterThan(25);
  });

  it('recovers monotonically ordered angles for complete fringe shifts', () => {
    const angles = Array.from({ length: 26 }, (_, index) => findAngleForFringe(index));
    expect(angles.every((angle) => angle !== null)).toBe(true);
    for (let index = 1; index < angles.length; index += 1) {
      expect(angles[index]!).toBeGreaterThan(angles[index - 1]!);
      expect(fringeShiftCount(angles[index]!)).toBeCloseTo(index, 6);
    }
  });
});
