import { CarrierState, LaserConfig, SlitParameters, PolarizerParameters } from './types';
import { DiffractionSolver } from './DiffractionSolver';
import { PolarizationSolver, JonesVector } from './PolarizationSolver';
import { NoiseEngine } from './NoiseEngine';

export interface OpticalTrainResult {
  intensityAtDetectorMw: number;
  measuredPowerWithNoiseMw: number;
  measuredLux: number;
  alignmentEfficiency: number; // 0.0 (completely misaligned) to 1.0 (perfect)
  patternType: 'direct_beam' | 'single_slit' | 'double_slit' | 'grating' | 'airy_disk' | 'dark';
  patternParams: {
    distanceL_mm: number;
    wavelengthNm: number;
    slitWidthUm?: number;
    slitSepUm?: number;
    linesPerMm?: number;
    diameterUm?: number;
    effectivePowerMw: number;
  };
}

export class OpticalBenchSystem {
  private noiseEngine: NoiseEngine;

  constructor(examSeed: string) {
    this.noiseEngine = new NoiseEngine(examSeed);
  }

  public updateSeed(examSeed: string) {
    this.noiseEngine = new NoiseEngine(examSeed);
  }

  /**
   * Evaluate the complete optical train along the rail
   * @param laser Laser configuration and on/off status
   * @param isLaserOn Boolean state
   * @param carriers List of carriers mounted on rail with their positions
   * @param detectorTransversePosMm Position of photodetector on transverse stage (-25 to +25 mm)
   * @param tareOffset User zero-tare offset in mW
   */
  /**
   * Compute geometric coupling efficiency from mechanical misalignment.
   * Uses a Gaussian coupling model: η = exp(-θ²/σ²)
   * where θ is total angular deviation and σ ≈ 1 degree full-width half-max.
   */
  private computeAlignmentEfficiency(carriers: CarrierState[]): number {
    const SIGMA_DEG = 1.8; // tolerance half-width at 1/e²
    let efficiency = 1.0;

    for (const c of carriers) {
      // Loose thumbscrew: carrier can drift, reducing coupling
      const screwFactor = Math.max(0, c.screwTightness ?? 1.0);
      const screwLoss = 0.4 + 0.6 * screwFactor; // fully loose → 40% coupling

      // Tilt misalignment loss
      const tiltX = c.tiltXDeg ?? 0;
      const tiltY = c.tiltYDeg ?? 0;
      const totalTilt = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
      const tiltLoss = Math.exp(-(totalTilt * totalTilt) / (SIGMA_DEG * SIGMA_DEG));

      efficiency *= screwLoss * tiltLoss;
    }
    return Math.max(0, Math.min(1, efficiency));
  }

  public evaluate(
    laser: LaserConfig,
    isLaserOn: boolean,
    carriers: CarrierState[],
    detectorTransversePosMm: number,
    tareOffset = 0
  ): OpticalTrainResult {
    if (!isLaserOn) {
      const sampled = this.noiseEngine.sampleOpticalPower(0, 0, tareOffset);
      return {
        intensityAtDetectorMw: 0,
        measuredPowerWithNoiseMw: sampled.measuredPowerMw,
        measuredLux: Math.max(0, sampled.measuredPowerMw * 683.0),
        alignmentEfficiency: 1.0,
        patternType: 'dark',
        patternParams: {
          distanceL_mm: 0,
          wavelengthNm: laser.wavelengthNm,
          effectivePowerMw: 0
        }
      };
    }

    // Sort carriers by Z position along the rail
    const sortedCarriers = [...carriers].sort((a, b) => a.positionMm - b.positionMm);

    // Initial beam state leaving laser at z = 0
    let currentPowerMw = laser.nominalPowerMw;
    let currentWavelengthNm = laser.wavelengthNm;
    let jonesState: JonesVector = { exReal: 1.0, exImag: 0, eyReal: 0, eyImag: 0 }; // Linearly polarized X

    let activeAperture: CarrierState | null = null;
    let detectorCarrier: CarrierState | null = null;

    for (const carrier of sortedCarriers) {
      if (carrier.type === 'polarizer') {
        const params = carrier.customParams as PolarizerParameters | undefined;
        const angle = params ? params.angleDegrees : 0;
        const extinction = params ? params.extinctionRatio : 1e-4;
        const result = PolarizationSolver.applyLinearPolarizer(jonesState, angle, extinction);
        jonesState = result.output;
        currentPowerMw *= result.transmittedIntensityFraction;
      } else if (
        carrier.type === 'single_slit' ||
        carrier.type === 'double_slit' ||
        carrier.type === 'diffraction_grating' ||
        carrier.type === 'circular_aperture'
      ) {
        activeAperture = carrier;
      } else if (carrier.type === 'photodetector_stage' || carrier.type === 'projection_screen') {
        detectorCarrier = carrier;
        break; // Beam stops at detector/screen
      }
    }

    // Determine distance L from active aperture to detector
    const detectorPosMm = detectorCarrier ? detectorCarrier.positionMm : 800;
    const aperturePosMm = activeAperture ? activeAperture.positionMm : 100;
    const distanceL_mm = Math.max(10, detectorPosMm - aperturePosMm);

    // Actual micrometer position with physical stage noise
    const actualMicroX = this.noiseEngine.getMicrometerPosition(detectorTransversePosMm);

    let theoreticalIntensityMw = 0;
    let patternType: OpticalTrainResult['patternType'] = 'direct_beam';
    const patternParams: OpticalTrainResult['patternParams'] = {
      distanceL_mm,
      wavelengthNm: currentWavelengthNm,
      effectivePowerMw: currentPowerMw
    };

    if (!activeAperture) {
      // Direct Unobstructed Gaussian Beam
      patternType = 'direct_beam';
      theoreticalIntensityMw = DiffractionSolver.computeDirectBeamIntensity(
        actualMicroX,
        distanceL_mm,
        currentWavelengthNm,
        currentPowerMw,
        laser.beamWaistMm
      );
    } else {
      const slitParams = activeAperture.customParams as SlitParameters;

      if (activeAperture.type === 'single_slit') {
        patternType = 'single_slit';
        const slitWidthUm = slitParams?.slitWidthUm || 80;
        patternParams.slitWidthUm = slitWidthUm;
        theoreticalIntensityMw = DiffractionSolver.computeSingleSlitIntensity(
          actualMicroX,
          distanceL_mm,
          slitWidthUm,
          currentWavelengthNm,
          currentPowerMw
        );
      } else if (activeAperture.type === 'double_slit') {
        patternType = 'double_slit';
        const slitWidthUm = slitParams?.slitWidthUm || 50;
        const slitSepUm = slitParams?.slitSeparationUm || 250;
        patternParams.slitWidthUm = slitWidthUm;
        patternParams.slitSepUm = slitSepUm;
        theoreticalIntensityMw = DiffractionSolver.computeDoubleSlitIntensity(
          actualMicroX,
          distanceL_mm,
          slitWidthUm,
          slitSepUm,
          currentWavelengthNm,
          currentPowerMw
        );
      } else if (activeAperture.type === 'diffraction_grating') {
        patternType = 'grating';
        const linesPerMm = slitParams?.linesPerMm || 300;
        patternParams.linesPerMm = linesPerMm;
        theoreticalIntensityMw = DiffractionSolver.computeGratingIntensity(
          actualMicroX,
          distanceL_mm,
          linesPerMm,
          currentWavelengthNm,
          currentPowerMw,
          laser.beamWaistMm
        );
      } else if (activeAperture.type === 'circular_aperture') {
        patternType = 'airy_disk';
        const diameterUm = slitParams?.circularDiameterUm || 150;
        patternParams.diameterUm = diameterUm;
        theoreticalIntensityMw = DiffractionSolver.computeAiryDiskIntensity(
          actualMicroX,
          distanceL_mm,
          diameterUm,
          currentWavelengthNm,
          currentPowerMw
        );
      }
    }

    // Compute mechanical alignment efficiency
    const relevantCarriers = [...sortedCarriers].filter(c =>
      c.type !== 'laser_source'
    );
    const alignmentEfficiency = this.computeAlignmentEfficiency(relevantCarriers);

    // Apply alignment loss to theoretical intensity
    const alignedIntensityMw = theoreticalIntensityMw * alignmentEfficiency;

    // Apply instantaneous measurement noise (RIN + Dark Noise + Tare Offset)
    const sampled = this.noiseEngine.sampleOpticalPower(
      alignedIntensityMw,
      laser.rinNoisePercent,
      tareOffset
    );

    return {
      intensityAtDetectorMw: alignedIntensityMw,
      measuredPowerWithNoiseMw: sampled.measuredPowerMw,
      measuredLux: Math.max(0, sampled.measuredPowerMw * 683.0),
      alignmentEfficiency,
      patternType,
      patternParams
    };
  }
}
