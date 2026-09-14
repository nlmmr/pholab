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
  gimbalMode: 'place' | 'offset' | 'rotate';
}
