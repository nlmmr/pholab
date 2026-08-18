/**
 * DiffractionSolver: High-precision wave optics and interference engine
 */

export class DiffractionSolver {
  /**
   * Sinc function sin(x)/x with limit safe evaluation at x = 0
   */
  public static sinc(x: number): number {
    if (Math.abs(x) < 1e-7) {
      return 1.0 - (x * x) / 6.0 + (x * x * x * x) / 120.0;
    }
    return Math.sin(x) / x;
  }

  /**
   * Approximate First-order Bessel Function of the First Kind J_1(x)
   */
  public static besselJ1(x: number): number {
    const ax = Math.abs(x);
    if (ax < 3.75) {
      const y = (x / 3.75) * (x / 3.75);
      return (
        x *
        (0.5 +
          y *
            (-0.56249985 +
              y *
                (0.21093573 +
                  y * (-0.03954289 + y * (0.00443319 - y * 0.00031761)))))
      );
    } else {
      const y = 3.75 / ax;
      const f0 =
        0.79788456 +
        y *
          (-0.00000077 +
            y *
              (-0.0055274 +
                y * (0.00009512 + y * (0.00137237 - y * 0.00072805))));
      const theta0 =
        ax -
        2.35619449 +
        y *
          (0.044177 +
            y *
              (-0.00009512 +
                y * (-0.00137237 + y * (0.00072805 - y * 0.00013493))));
      return (Math.sign(x) * (1.0 / Math.sqrt(ax)) * f0 * Math.cos(theta0));
    }
  }

  /**
   * Gaussian beam radius w(z) at distance z
   */
  public static gaussianBeamRadius(
    zDistanceMm: number,
    wavelengthNm: number,
    waistRadiusMm = 0.4
  ): number {
    const lambdaMm = wavelengthNm * 1e-6;
    const rayleighRangeMm = (Math.PI * waistRadiusMm * waistRadiusMm) / lambdaMm;
    return waistRadiusMm * Math.sqrt(1 + Math.pow(zDistanceMm / rayleighRangeMm, 2));
  }

  /**
   * Unobstructed Gaussian Beam Intensity at transverse distance r
   */
  public static computeDirectBeamIntensity(
    rMm: number,
    zDistanceMm: number,
    wavelengthNm: number,
    peakPowerMw: number,
    waistRadiusMm = 0.4
  ): number {
    const w = this.gaussianBeamRadius(zDistanceMm, wavelengthNm, waistRadiusMm);
    const intensity = (peakPowerMw * Math.pow(waistRadiusMm / w, 2)) * Math.exp((-2 * rMm * rMm) / (w * w));
    return intensity;
  }

  /**
   * Single Slit Fraunhofer Diffraction Intensity
   * @param xMm Transverse coordinate on screen/detector (mm)
   * @param distanceL_mm Distance from slit to screen (mm)
   * @param slitWidthUm Slit width 'a' (micrometers)
   * @param wavelengthNm Laser wavelength (nm)
   * @param incidentPowerMw Total incident power
   */
  public static computeSingleSlitIntensity(
    xMm: number,
    distanceL_mm: number,
    slitWidthUm: number,
    wavelengthNm: number,
    incidentPowerMw: number
  ): number {
    if (distanceL_mm <= 1) return incidentPowerMw;

    const lambdaMm = wavelengthNm * 1e-6;
    const aMm = slitWidthUm * 1e-3;

    // Angle theta from optical axis
    const sinTheta = xMm / Math.sqrt(xMm * xMm + distanceL_mm * distanceL_mm);
    const beta = (Math.PI * aMm * sinTheta) / lambdaMm;

    const diffFactor = Math.pow(this.sinc(beta), 2);
    // Envelope normalization factor accounting for beam collection
    return incidentPowerMw * diffFactor * (aMm / 0.1);
  }

  /**
   * Double Slit Interference and Diffraction
   * @param xMm Transverse coordinate on screen (mm)
   * @param distanceL_mm Distance from slit to screen (mm)
   * @param slitWidthUm Slit width 'a' (um)
   * @param slitSepUm Slit separation 'd' (um)
   * @param wavelengthNm Laser wavelength (nm)
   * @param incidentPowerMw Incident power
   */
  public static computeDoubleSlitIntensity(
    xMm: number,
    distanceL_mm: number,
    slitWidthUm: number,
    slitSepUm: number,
    wavelengthNm: number,
    incidentPowerMw: number
  ): number {
    if (distanceL_mm <= 1) return incidentPowerMw;

    const lambdaMm = wavelengthNm * 1e-6;
    const aMm = slitWidthUm * 1e-3;
    const dMm = slitSepUm * 1e-3;

    const sinTheta = xMm / Math.sqrt(xMm * xMm + distanceL_mm * distanceL_mm);
    const beta = (Math.PI * aMm * sinTheta) / lambdaMm;
    const alpha = (Math.PI * dMm * sinTheta) / lambdaMm;

    const singleSlit = Math.pow(this.sinc(beta), 2);
    const interference = Math.pow(Math.cos(alpha), 2);

    return incidentPowerMw * singleSlit * interference * 2.0 * (aMm / 0.1);
  }

  /**
   * Diffraction Grating with Multi-Order Peaks & Angular Dispersion
   * d * sin(theta_m) = m * lambda
   */
  public static computeGratingIntensity(
    xMm: number,
    distanceL_mm: number,
    linesPerMm: number,
    wavelengthNm: number,
    incidentPowerMw: number,
    beamWaistMm = 0.5
  ): number {
    if (distanceL_mm <= 1) return incidentPowerMw;

    const dMm = 1.0 / linesPerMm;
    const lambdaMm = wavelengthNm * 1e-6;
    const maxOrder = Math.floor(dMm / lambdaMm);

    let totalIntensity = 0.0001; // Base diffuse scatter floor

    // Sum Gaussian-spread diffraction orders m = -maxOrder ... +maxOrder
    for (let m = -maxOrder; m <= maxOrder; m++) {
      const sinThetaM = (m * lambdaMm) / dMm;
      if (Math.abs(sinThetaM) >= 0.99) continue;

      const tanThetaM = sinThetaM / Math.sqrt(1 - sinThetaM * sinThetaM);
      const xPeakMm = distanceL_mm * tanThetaM;

      // Peak width is determined by beam size and angular spread
      const spotSigmaMm = Math.max(0.2, (beamWaistMm * distanceL_mm) / 500);

      // Relative order efficiency (blaze/envelope factor)
      const slitEnvelope = Math.pow(this.sinc(Math.PI * 0.4 * m), 2);
      const orderFraction = (m === 0 ? 0.35 : 0.25 * slitEnvelope) * incidentPowerMw;

      const dx = xMm - xPeakMm;
      const peakIntensity = orderFraction * Math.exp((-dx * dx) / (2 * spotSigmaMm * spotSigmaMm));
      totalIntensity += peakIntensity;
    }

    return totalIntensity;
  }

  /**
   * Circular Aperture (Airy Disk) Intensity
   */
  public static computeAiryDiskIntensity(
    rMm: number,
    distanceL_mm: number,
    diameterUm: number,
    wavelengthNm: number,
    incidentPowerMw: number
  ): number {
    if (distanceL_mm <= 1) return incidentPowerMw;

    const lambdaMm = wavelengthNm * 1e-6;
    const radiusA_mm = (diameterUm * 1e-3) / 2.0;

    const sinTheta = rMm / Math.sqrt(rMm * rMm + distanceL_mm * distanceL_mm);
    const k = (2.0 * Math.PI) / lambdaMm;
    const v = k * radiusA_mm * sinTheta;

    let airyFactor = 1.0;
    if (Math.abs(v) > 1e-5) {
      const j1 = this.besselJ1(v);
      airyFactor = Math.pow((2.0 * j1) / v, 2);
    }

    return incidentPowerMw * airyFactor;
  }
}
