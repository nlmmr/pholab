export type AppMode = 'hub' | 'studio' | 'lab';

export type PhysicsDomain =
  | 'granular_mechanics_and_craters'
  | 'wave_optics_and_diffraction'
  | 'polarization_and_birefringence'
  | 'thermodynamics_and_fluids'
  | 'electromagnetism';

export type ComponentCategory =
  | 'granular'
  | 'optics'
  | 'supports'
  | 'measuring'
  | 'sensors'
  | 'lasers'
  | 'mechanics';

export interface BallSpec {
  id: string;
  name: string;
  diameterMm: number;
  massG: number;
  color: string;
}

export interface PhOLabComponent3DState {
  id: string;
  name: string;
  category: ComponentCategory;
  inKitBox: boolean; // true = inside the box, false = placed on desk
  position: [number, number, number];
  rotation: [number, number, number];
  isAssembled?: boolean;
  parentComponentId?: string;
  customProps?: Record<string, any>;
}

export interface PhOLabComponentManifest {
  id: string;
  name: string;
  category: ComponentCategory;
  icon: string;
  description: string;
  inKitBox: boolean;
  defaultPosition?: [number, number, number];
  defaultRotation?: [number, number, number];
  properties?: Record<string, any>;
}

export interface TaskPage {
  pageNumber: number;
  title: string;
  contentMarkdown: string;
  solutionMarkdown?: string;
  points?: number;
}

export interface TaskDocument {
  title: string;
  totalPages: number;
  pages: TaskPage[];
  markingSchemeMarkdown?: string;
}

export interface PhOLabPackage {
  formatVersion: string;
  id: string;
  title: string;
  olympiad: string;
  year: number;
  country: string;
  durationMinutes: number;
  difficulty: string;
  physicsDomain: PhysicsDomain;
  summary: string;
  author: string;
  createdAt: string;

  components: PhOLabComponentManifest[];
  componentStates?: PhOLabComponent3DState[]; // Saved 3D layout on desk / in box

  nominalParameters: Record<string, number>;
  hiddenTruths: Record<string, number>;
  stochasticNoise: {
    measurementSigmaPercent: number;
    environmentalJitter: number;
  };

  taskDocument: TaskDocument;
}

export interface SandCraterExperimentState {
  selectedBallId: string;
  dropHeightCm: number;
  sandStirredAndLeveled: boolean;
  craterFormed: boolean;
  lastImpactDiameterMm: number;
  lastImpactEnergyJ: number;
  railAngleDeg: number;
  railReleaseDistanceCm: number;
  ballRolling: boolean;
  ballTravelTimeS: number;
  ballStoppingDistanceCm: number;
  isChronometerRunning: boolean;
  chronometerTimeS: number;
  selectedComponentId?: string;
  gimbalMode: 'translate' | 'rotate';
}
