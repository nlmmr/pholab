import { describe, expect, it } from 'vitest';
import { IPHO_2024_E2_CONFIG } from './config';
import {
  DEFAULT_PHASE_PARAMETERS,
  alignmentQuality,
  findAngleForFringe,
  fringeShiftCount,
  phaseAtNormalIncidence,
  phaseDifference,
  resolvePhaseParameters,
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

  it('correctly resolves phase parameters for Parts B, C, and D', () => {
    // Default / Part A
    const partAParams = resolvePhaseParameters({ apparatus: { installedHolder: 's1' } });
    expect(partAParams.thicknessMm).toBeCloseTo(0.1489, 4);
    expect(partAParams.ambientIndex).toBe(1.0);

    // Part B (Thick slide S2 in air)
    const partBParams = resolvePhaseParameters({ apparatus: { installedHolder: 's2' } });
    expect(partBParams.thicknessMm).toBeCloseTo(1.061, 3);
    expect(partBParams.ambientIndex).toBe(1.0);

    // Part C (Thick slide S2 in pink liquid)
    const partCParams = resolvePhaseParameters({
      apparatus: { installedHolder: 's2', cuvettePlaced: true, liquidPoured: true },
    });
    expect(partCParams.thicknessMm).toBeCloseTo(1.061, 3);
    expect(partCParams.ambientIndex).toBeCloseTo(1.332, 3);

    // Part D (Thin slide S1 in pink liquid)
    const partDParams = resolvePhaseParameters({
      apparatus: { installedHolder: 's1', cuvettePlaced: true, liquidPoured: true },
    });
    expect(partDParams.thicknessMm).toBeCloseTo(0.1489, 4);
    expect(partDParams.ambientIndex).toBeCloseTo(1.332, 3);
  });

  it('verifies thick slide S2 fringe density matches Part B expectations within 20 degrees', () => {
    const s2Params = resolvePhaseParameters({ apparatus: { installedHolder: 's2' } });
    const count20 = fringeShiftCount(20, s2Params);
    // For H = 1.061 mm at 20 deg, fringes pass very quickly
    expect(count20).toBeGreaterThan(20);
  });

  it('proves theoretical thickness scaling between S2 and S1 across all angles (Parts A vs B, C vs D)', () => {
    const partA = resolvePhaseParameters({ apparatus: { installedHolder: 's1' } });
    const partB = resolvePhaseParameters({ apparatus: { installedHolder: 's2' } });
    const partC = resolvePhaseParameters({
      apparatus: { installedHolder: 's2', cuvettePlaced: true, liquidPoured: true },
    });
    const partD = resolvePhaseParameters({
      apparatus: { installedHolder: 's1', cuvettePlaced: true, liquidPoured: true },
    });

    const expectedRatio = 1.061 / 0.1489; // h_S2 / h_S1

    for (const testAngle of [5, 10, 15, 20]) {
      // In Air: Part B / Part A
      const mA = fringeShiftCount(testAngle, partA);
      const mB = fringeShiftCount(testAngle, partB);
      expect(mB / mA).toBeCloseTo(expectedRatio, 5);

      // In Liquid: Part C / Part D
      const mC = fringeShiftCount(testAngle, partC);
      const mD = fringeShiftCount(testAngle, partD);
      expect(mC / mD).toBeCloseTo(expectedRatio, 5);
    }
  });

  it('verifies optical attenuation of fringe shifts in liquid compared to air (Part C vs Part B)', () => {
    const partB = resolvePhaseParameters({ apparatus: { installedHolder: 's2' } });
    const partC = resolvePhaseParameters({
      apparatus: { installedHolder: 's2', cuvettePlaced: true, liquidPoured: true },
    });

    // Because (n - N_liquid) = 0.178 < (n - N_air) = 0.51, fringe rate in liquid is lower
    const countAir20 = fringeShiftCount(20, partB);
    const countLiquid20 = fringeShiftCount(20, partC);
    expect(countLiquid20).toBeLessThan(countAir20);
    expect(countLiquid20).toBeCloseTo(16.27, 1);
    expect(countAir20).toBeCloseTo(34.38, 1);
  });

  it('guarantees monotonic fringe shift growth for all 4 experimental parts', () => {
    const partA = resolvePhaseParameters({ apparatus: { installedHolder: 's1' } });
    const partB = resolvePhaseParameters({ apparatus: { installedHolder: 's2' } });
    const partC = resolvePhaseParameters({
      apparatus: { installedHolder: 's2', cuvettePlaced: true, liquidPoured: true },
    });
    const partD = resolvePhaseParameters({
      apparatus: { installedHolder: 's1', cuvettePlaced: true, liquidPoured: true },
    });

    for (const { name, params, maxAngle } of [
      { name: 'Part A', params: partA, maxAngle: 70 },
      { name: 'Part B', params: partB, maxAngle: 20 },
      { name: 'Part C', params: partC, maxAngle: 20 },
      { name: 'Part D', params: partD, maxAngle: 70 },
    ]) {
      let prev = fringeShiftCount(0, params);
      expect(prev).toBeCloseTo(0, 8);
      for (let angle = 1; angle <= maxAngle; angle += 1) {
        const curr = fringeShiftCount(angle, params);
        expect(curr).toBeGreaterThan(prev);
        prev = curr;
      }
    }
  });

  it('correctly inverts fringe count to angle in liquid medium (Part C)', () => {
    const partC = resolvePhaseParameters({
      apparatus: { installedHolder: 's2', cuvettePlaced: true, liquidPoured: true },
    });
    const angleFringe10 = findAngleForFringe(10, partC);
    expect(angleFringe10).toBeDefined();
    expect(angleFringe10!).toBeGreaterThan(15);
    expect(angleFringe10!).toBeLessThan(16);
    expect(fringeShiftCount(angleFringe10!, partC)).toBeCloseTo(10, 6);
  });

  it('enforces boundary condition behavior in findAngleForFringe', () => {
    expect(findAngleForFringe(-1)).toBeNull();
    expect(findAngleForFringe(999999)).toBeNull();
  });

  it('evaluates alignment quality across nominal and misaligned beam configurations', () => {
    // Nominal optimal alignment
    const perfect = alignmentQuality({ laserHeight: 0.56, lensHeight: 0.56, screenDistance: 0.84 });
    expect(perfect).toBeCloseTo(1.0, 4);

    // Laser height misalignment
    const misalignedLaser = alignmentQuality({ laserHeight: 0.20, lensHeight: 0.56, screenDistance: 0.84 });
    expect(misalignedLaser).toBeLessThan(0.001);

    // Lens height misalignment
    const misalignedLens = alignmentQuality({ laserHeight: 0.56, lensHeight: 0.85, screenDistance: 0.84 });
    expect(misalignedLens).toBeLessThan(0.01);

    // Screen distance variation
    const farScreen = alignmentQuality({ laserHeight: 0.56, lensHeight: 0.56, screenDistance: 2.2 });
    expect(farScreen).toBeLessThan(0.01);

    // Clamping guarantees
    expect(perfect).toBeGreaterThanOrEqual(0);
    expect(perfect).toBeLessThanOrEqual(1.0);
    expect(misalignedLaser).toBeGreaterThanOrEqual(0);
    expect(misalignedLaser).toBeLessThanOrEqual(1.0);
  });
});
