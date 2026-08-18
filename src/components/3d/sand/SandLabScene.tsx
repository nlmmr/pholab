import React, { useMemo } from 'react';
import { LabEnvironment } from '../LabEnvironment';
import { ExamClock } from '../ExamClock';
import { SandBoxBowl } from './SandBoxBowl';
import { SteelBallsStand } from './SteelBallsStand';
import { InclinedRailSandTrack } from './InclinedRailSandTrack';
import { HandheldChronometer } from './HandheldChronometer';
import { PhysicalTaskSheet } from '../PhysicalTaskSheet';
import { OrbitControlsComponent } from '../OrbitControlsComponent';
import { BallSpec, SandCraterExperimentState } from '../../../types/pholab';

export type SandCameraPreset = 'overview' | 'craters_bowl' | 'stand_height' | 'inclined_rail' | 'chronometer' | 'task_sheet';

interface SandLabSceneProps {
  cameraPreset: SandCameraPreset;
  state: SandCraterExperimentState;
  ballsList: BallSpec[];
  selectedBall: BallSpec;
  secondsRemaining: number;
  isClockRunning: boolean;
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  onStirAndLevel: () => void;
  onToggleChronometer: () => void;
  onResetChronometer: () => void;
  onRollRailBall: () => void;
  taskLines: string[];
  schemeLines: string[];
}

export const SandLabScene: React.FC<SandLabSceneProps> = ({
  cameraPreset,
  state,
  ballsList,
  selectedBall,
  secondsRemaining,
  isClockRunning,
  onSelectBall,
  onDropBall,
  onStirAndLevel,
  onToggleChronometer,
  onResetChronometer,
  onRollRailBall,
  taskLines,
  schemeLines,
}) => {
  const { presetTarget, presetPos } = useMemo<{
    presetTarget: [number, number, number];
    presetPos: [number, number, number];
  }>(() => {
    switch (cameraPreset) {
      case 'overview':
        return { presetTarget: [0, 0.1, 0], presetPos: [0, 0.75, 1.05] };
      case 'craters_bowl':
        return { presetTarget: [-0.25, 0.08, 0], presetPos: [-0.25, 0.38, 0.28] };
      case 'stand_height':
        return { presetTarget: [-0.25, 0.45, -0.1], presetPos: [-0.25, 0.55, 0.55] };
      case 'inclined_rail':
        return { presetTarget: [0.35, 0.15, 0], presetPos: [0.35, 0.45, 0.55] };
      case 'chronometer':
        return { presetTarget: [0.15, 0.03, 0.28], presetPos: [0.15, 0.22, 0.38] };
      case 'task_sheet':
        return { presetTarget: [-0.65, 0.02, 0.2], presetPos: [-0.65, 0.35, 0.32] };
      default:
        return { presetTarget: [0, 0.1, 0], presetPos: [0, 0.75, 1.05] };
    }
  }, [cameraPreset]);

  return (
    <>
      <OrbitControlsComponent presetTarget={presetTarget} presetPos={presetPos} />

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#e8e4d8" />
      <directionalLight
        position={[1.5, 2.5, 1.0]}
        intensity={0.95}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        color="#fff8e8"
      />
      <pointLight position={[-1.0, 1.8, 0.5]} intensity={0.35} color="#c8d8ff" />

      {/* Lab Room & Wooden Table */}
      <LabEnvironment onFloorClick={() => {}} />

      {/* Exam Countdown Clock */}
      <ExamClock secondsRemaining={secondsRemaining} isRunning={isClockRunning} />

      {/* Part A: Sand Bowl & Container Box */}
      <SandBoxBowl
        position={[-0.25, 0.02, 0]}
        isSandLeveled={state.sandStirredAndLeveled}
        craterDiameterMm={state.lastImpactDiameterMm}
        craterDepthMm={state.lastImpactDiameterMm / 4.2}
        hasCrater={state.craterFormed}
        onStirAndLevel={onStirAndLevel}
      />

      {/* Part A: Steel Balls Stand & Dispenser */}
      <SteelBallsStand
        position={[-0.25, 0.02, -0.22]}
        dropHeightCm={state.dropHeightCm}
        selectedBall={selectedBall}
        ballsList={ballsList}
        onSelectBall={onSelectBall}
        onDropBall={onDropBall}
        isDropping={false}
      />

      {/* Part B: 1m Inclined Rail & Sand Track */}
      <InclinedRailSandTrack
        position={[0.40, 0.02, 0]}
        railAngleDeg={state.railAngleDeg}
        releaseDistanceCm={state.railReleaseDistanceCm}
        isRolling={state.ballRolling}
        ballStoppingDistanceCm={state.ballStoppingDistanceCm}
        onRollComplete={onRollRailBall}
      />

      {/* Part B: Handheld Stopwatch */}
      <HandheldChronometer
        position={[0.12, 0.025, 0.26]}
        timeSeconds={state.chronometerTimeS}
        isRunning={state.isChronometerRunning}
        onToggleStartStop={onToggleChronometer}
        onReset={onResetChronometer}
      />

      {/* Physical A4 Task Sheet & Marking Scheme on table */}
      <PhysicalTaskSheet
        position={[-0.65, 0.011, 0.2]}
        rotation={[0, 0.12, 0]}
        taskLines={taskLines}
        markingSchemeLines={schemeLines}
      />
    </>
  );
};
