/**
 * Physics Types and Data Structures for PhOLab
 */

export type WavelengthColor = 'green' | 'red' | 'violet';

export interface LaserConfig {
  id: string;
  name: string;
  wavelengthNm: number; // e.g. 532.0 nm (Green) or 632.8 nm (HeNe Red)
  nominalPowerMw: number; // e.g. 5.0 mW
  beamWaistMm: number; // e.g. 0.8 mm
  divergenceMrad: number; // e.g. 1.2 mrad
  rinNoisePercent: number; // Relative intensity noise (e.g. 1.5%)
  wavelengthJitterNm: number; // Jitter (e.g. 0.15 nm)
}

export type OpticalElementType = 
  | 'laser_source'
  | 'single_slit'
  | 'double_slit'
  | 'diffraction_grating'
  | 'circular_aperture'
  | 'polarizer'
  | 'projection_screen'
  | 'photodetector_stage';

export interface SlitParameters {
  slitWidthUm: number; // Slit width 'a' in micrometers
  slitSeparationUm?: number; // Slit separation 'd' in micrometers (for double slit)
  linesPerMm?: number; // Grating lines per mm (e.g. 300, 600, 1000)
  circularDiameterUm?: number; // Circular aperture diameter in micrometers
}

export interface PolarizerParameters {
  angleDegrees: number; // 0 to 360 degrees
  extinctionRatio: number; // e.g. 1e-4 (imperfect extinction leakage)
}

export interface CarrierState {
  id: string;
  elementId: string;
  type: OpticalElementType;
  positionMm: number;        // Position along the 0-1000 mm rail
  isLocked: boolean;         // Thumbscrew clamped
  screwTightness: number;    // 0.0 (completely loose) to 1.0 (fully tightened)
  heightMm: number;          // Post collar height above rail surface (default 100 mm)
  tiltXDeg: number;          // Horizontal tilt misalignment in degrees (ideal = 0)
  tiltYDeg: number;          // Vertical tilt misalignment in degrees (ideal = 0)
  rotationDegrees: number;   // Rotation around vertical post axis
  customParams?: SlitParameters | PolarizerParameters;
}

export interface PhotodetectorMeasurement {
  rawPowerMw: number;           // Exact analytical power (mW)
  measuredPowerMw: number;      // Power + noise + tare
  measuredLux: number;          // Lux conversion
  transversePositionMm: number; // Micrometer stage x position (mm)
  apertureDiameterMm: number;   // Pinhole aperture (mm)
  zeroTareOffsetMw: number;     // Zero tare calibration
  alignmentEfficiency: number;  // 0.0 to 1.0 — geometric coupling loss from height/tilt
  isOverloaded: boolean;
}

export interface ExamChallenge {
  id: string;
  title: string;
  olympiadSource: string; // e.g. "IPhO 2017 - Task 1 (Adapted)"
  examDurationMinutes: number; // e.g. 180 min
  seed: string;
  taskPdfUrl?: string;
  markingSchemePdfUrl?: string;
  taskSummary: string;
  kitItems: {
    id: string;
    name: string;
    type: OpticalElementType;
    initialInBox: boolean;
    description: string;
    defaultParams?: SlitParameters | PolarizerParameters;
  }[];
  hiddenTruth: {
    trackPitchNm?: number;
    exactWavelengthNm?: number;
    slitWidthUm?: number;
    gratingLinesPerMm?: number;
  };
}
