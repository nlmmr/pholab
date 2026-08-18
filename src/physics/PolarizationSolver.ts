/**
 * PolarizationSolver: Jones calculus and polarization optics simulation
 */

export interface JonesVector {
  exReal: number;
  exImag: number;
  eyReal: number;
  eyImag: number;
}

export class PolarizationSolver {
  /**
   * Linear polarizer Jones Matrix applied to input Jones Vector
   * @param input Input Jones state
   * @param angleDegrees Angle theta of transmission axis
   * @param extinctionRatio Leakage factor through crossed polarizer (e.g. 1e-4)
   */
  public static applyLinearPolarizer(
    input: JonesVector,
    angleDegrees: number,
    extinctionRatio = 1e-4
  ): { output: JonesVector; transmittedIntensityFraction: number } {
    const rad = (angleDegrees * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    // Matrix M = [ [c^2, c*s], [c*s, s^2] ] + extinction leakage
    const m00 = c * c + extinctionRatio * s * s;
    const m01 = (1 - extinctionRatio) * c * s;
    const m10 = (1 - extinctionRatio) * c * s;
    const m11 = s * s + extinctionRatio * c * c;

    const outExReal = m00 * input.exReal + m01 * input.eyReal;
    const outExImag = m00 * input.exImag + m01 * input.eyImag;
    const outEyReal = m10 * input.exReal + m11 * input.eyReal;
    const outEyImag = m10 * input.exImag + m11 * input.eyImag;

    const inIntensity =
      input.exReal ** 2 +
      input.exImag ** 2 +
      input.eyReal ** 2 +
      input.eyImag ** 2;

    const outIntensity =
      outExReal ** 2 +
      outExImag ** 2 +
      outEyReal ** 2 +
      outEyImag ** 2;

    const fraction = inIntensity > 0 ? outIntensity / inIntensity : 0;

    return {
      output: {
        exReal: outExReal,
        exImag: outExImag,
        eyReal: outEyReal,
        eyImag: outEyImag
      },
      transmittedIntensityFraction: fraction
    };
  }

  /**
   * Evaluate Malus's Law with realistic extinction ratio:
   * I(theta) = I_0 * (cos^2(theta - theta_0) + extinctionRatio)
   */
  public static computeMalusIntensity(
    incidentPowerMw: number,
    polarizer1AngleDeg: number,
    polarizer2AngleDeg: number,
    extinctionRatio = 1e-4
  ): number {
    const deltaRad = ((polarizer2AngleDeg - polarizer1AngleDeg) * Math.PI) / 180;
    const cosVal = Math.cos(deltaRad);
    return incidentPowerMw * (cosVal * cosVal + extinctionRatio);
  }
}
