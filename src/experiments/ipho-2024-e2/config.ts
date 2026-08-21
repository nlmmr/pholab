export const IPHO_2024_E2_CONFIG = {
  id: 'ipho-2024-e2',
  title: 'Diffraction from Phase Steps',
  shortTitle: 'IPhO 2024 E2',
  olympiad: 'IPhO 2024',
  durationMinutes: 300,
  part: 'A',
  wavelengthNm: 650,
  glassIndex: 1.51,
  ambientIndex: 1,
  // The official task treats the specimen thickness as the unknown. This is a
  // representative thin microscope slide hidden from the participant.
  hiddenSlideThicknessMm: 0.16,
  maxAngleDeg: 70,
  minimumMeasurements: 25,
  officialProblemUrl: 'https://ipho.olimpicos.net/pdf/IPhO_2024_Q5.pdf',
} as const;

export type ExperimentDefinition = typeof IPHO_2024_E2_CONFIG;
