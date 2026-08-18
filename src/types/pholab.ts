/**
 * PhOLab Standard Format (.pholab) & Core Types
 */

export type PhysicsDomain = 
  | 'granular_mechanics_and_craters'
  | 'wave_optics_and_diffraction'
  | 'polarimetry_and_biot'
  | 'electromagnetism_and_circuits'
  | 'coupled_mechanics';

export type AppMode = 'hub' | 'studio' | 'lab';

export interface BallSpec {
  id: string;
  name: string;
  diameterMm: number;
  massG: number;
  color: string;
}

export interface SandCraterExperimentState {
  selectedBallId: string;
  dropHeightCm: number;
  sandStirredAndLeveled: boolean;
  craterFormed: boolean;
  lastImpactDiameterMm: number;
  lastImpactEnergyJ: number;
  
  // Part B: Inclined Rail & Track
  railAngleDeg: number;
  railReleaseDistanceCm: number;
  ballRolling: boolean;
  ballTravelTimeS: number;
  ballStoppingDistanceCm: number;
  isChronometerRunning: boolean;
  chronometerTimeS: number;
}

export interface PhOLabComponentManifest {
  id: string;
  name: string;
  category: 'granular' | 'optics' | 'measuring' | 'supports' | 'sensors';
  icon: string;
  description: string;
  inKitBox: boolean;
  properties: Record<string, number | string | boolean>;
}

export interface PhOLabPackage {
  formatVersion: '1.0.0';
  id: string;
  title: string;
  olympiad: string;
  year: number;
  country: string;
  durationMinutes: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Olimpíada Nacional' | 'IPhO / Internacional';
  physicsDomain: PhysicsDomain;
  summary: string;
  author: string;
  createdAt: string;
  
  // Equipment list
  components: PhOLabComponentManifest[];
  
  // Theoretical constants & hidden truths
  nominalParameters: Record<string, number | string>;
  hiddenTruths: Record<string, number>;
  stochasticNoise: {
    measurementSigmaPercent: number;
    environmentalJitter: number;
  };
  
  // Official Task & Marking Scheme Documents
  taskDocument: {
    title: string;
    totalPages: number;
    pages: {
      pageNumber: number;
      title: string;
      contentMarkdown: string;
      solutionMarkdown?: string;
      points: number;
    }[];
    pdfBase64?: string;
  };
}
