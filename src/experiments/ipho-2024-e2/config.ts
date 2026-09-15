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
  // Constantes oficiais do Marking Scheme da IPhO 2024
  hiddenSlideThicknessS1Mm: 0.1489, // Lâmina fina S1 (148.9 µm, Slope B = 229.1)
  hiddenSlideThicknessS2Mm: 1.061,  // Lâmina grossa S2 (1061 µm, Slope B = 275.7)
  hiddenLiquidIndexN: 1.332,        // Líquido rosa desconhecido (Slope B = 128.0)
  hiddenSlideThicknessMm: 0.1489,   // Compatibilidade reversa
  maxAngleDeg: 80,
  maxAnglePartBDeg: 20,
  minimumMeasurements: 25,
  officialProblemUrl: 'https://ipho.olimpicos.net/pdf/IPhO_2024_Q5.pdf',
} as const;

export type ExperimentDefinition = typeof IPHO_2024_E2_CONFIG;
