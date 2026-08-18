import { PhOLabComponentManifest, PhOLabComponent3DState } from './entities';

export type AppMode = 'hub' | 'studio' | 'lab';

export type PhysicsDomain =
  | 'granular_mechanics_and_craters'
  | 'wave_optics_and_diffraction'
  | 'polarization_and_birefringence'
  | 'thermodynamics_and_fluids'
  | 'electromagnetism';

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
  componentStates?: PhOLabComponent3DState[];

  nominalParameters: Record<string, number>;
  hiddenTruths: Record<string, number>;
  stochasticNoise: {
    measurementSigmaPercent: number;
    environmentalJitter: number;
  };

  taskDocument: TaskDocument;
}
