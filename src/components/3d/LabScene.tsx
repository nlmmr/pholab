import React, { useMemo } from 'react';
import * as THREE from 'three';
import { LabEnvironment } from './LabEnvironment';
import { ExamClock } from './ExamClock';
import { KitBox } from './KitBox';
import { OpticalRail } from './OpticalRail';
import { CarrierMount } from './CarrierMount';
import { LaserSource } from './LaserSource';
import { DiffractionApertures } from './DiffractionApertures';
import { PolarizerHolder } from './PolarizerHolder';
import { ProjectionScreen } from './ProjectionScreen';
import { MicrometerPhotodetector } from './MicrometerPhotodetector';
import { PhysicalBenchtopMeter } from './PhysicalBenchtopMeter';
import { FlexibleCable } from './FlexibleCable';
import { PhysicalTaskSheet } from './PhysicalTaskSheet';
import { OrbitControlsComponent } from './OrbitControlsComponent';

import { CarrierState, LaserConfig, OpticalElementType, ExamChallenge } from '../../physics/types';
import { OpticalTrainResult } from '../../physics/OpticalBenchSystem';

export type CameraPreset = 'overview' | 'kitbox' | 'rail_center' | 'beam_level' | 'micrometer' | 'screen' | 'laser';

interface LabSceneProps {
  cameraPreset: CameraPreset;
  secondsRemaining: number;
  isClockRunning: boolean;
  isBoxOpen: boolean;
  isBoxOnFloor: boolean;
  onToggleBoxOpen: () => void;
  onToggleBoxFloor: () => void;
  unpackedElements: Set<string>;
  onUnpackElement: (type: OpticalElementType, id: string) => void;
  laser: LaserConfig;
  isLaserOn: boolean;
  onToggleLaserPower: () => void;
  carriers: CarrierState[];
  selectedCarrierId: string | null;
  onSelectCarrier: (id: string | null) => void;
  onCarrierPositionChange: (id: string, newPosMm: number) => void;
  onCarrierToggleLock: (id: string) => void;
  onPolarizerAngleChange: (id: string, newAngle: number) => void;
  transverseMicrometerMm: number;
  onTransverseMicrometerChange: (newMm: number) => void;
  trainResult: OpticalTrainResult;
  // Physical in-world meter
  isMeterOn: boolean;
  onToggleMeterPower: () => void;
  onTareMeter: () => void;
  meterUnitMode: 'uW' | 'mW' | 'Lux';
  onCycleMeterUnit: () => void;
  // Task/challenge info for physical task sheet
  challenge: ExamChallenge;
}

export const LabScene: React.FC<LabSceneProps> = ({
  cameraPreset,
  secondsRemaining,
  isClockRunning,
  isBoxOpen,
  isBoxOnFloor,
  onToggleBoxOpen,
  onToggleBoxFloor,
  unpackedElements,
  onUnpackElement,
  laser,
  isLaserOn,
  onToggleLaserPower,
  carriers,
  selectedCarrierId,
  onSelectCarrier,
  onCarrierPositionChange,
  onCarrierToggleLock,
  onPolarizerAngleChange,
  transverseMicrometerMm,
  onTransverseMicrometerChange,
  trainResult,
  isMeterOn,
  onToggleMeterPower,
  onTareMeter,
  meterUnitMode,
  onCycleMeterUnit,
  challenge,
}) => {
  const { presetTarget, presetPos } = useMemo<{
    presetTarget: [number, number, number];
    presetPos: [number, number, number];
  }>(() => {
    switch (cameraPreset) {
      case 'overview':
        return { presetTarget: [0, 0.1, 0], presetPos: [0, 0.7, 0.95] };
      case 'beam_level':
        // Crouched position aligned directly with the optical axis height
        return { presetTarget: [0, 0.17, -0.05], presetPos: [0, 0.18, 0.45] };
      case 'kitbox':
        return isBoxOnFloor
          ? { presetTarget: [-0.65, -0.65, 0.45], presetPos: [-0.65, -0.2, 0.9] }
          : { presetTarget: [-0.6, 0.15, 0.25], presetPos: [-0.6, 0.55, 0.65] };
      case 'rail_center':
        return { presetTarget: [0, 0.12, -0.05], presetPos: [0, 0.35, 0.45] };
      case 'micrometer': {
        const detCarrier = carriers.find((c) => c.type === 'photodetector_stage');
        const xPos = detCarrier ? (detCarrier.positionMm / 1000) - 0.5 : 0.3;
        return { presetTarget: [xPos, 0.17, -0.05], presetPos: [xPos, 0.28, 0.16] };
      }
      case 'screen': {
        const scrCarrier = carriers.find((c) => c.type === 'projection_screen');
        const xPos = scrCarrier ? (scrCarrier.positionMm / 1000) - 0.5 : 0.3;
        return { presetTarget: [xPos, 0.17, -0.05], presetPos: [xPos, 0.22, 0.15] };
      }
      case 'laser': {
        const lCarrier = carriers.find((c) => c.type === 'laser_source');
        const xPos = lCarrier ? (lCarrier.positionMm / 1000) - 0.5 : -0.45;
        return { presetTarget: [xPos, 0.17, -0.05], presetPos: [xPos - 0.1, 0.25, 0.15] };
      }
      default:
        return { presetTarget: [0, 0.1, 0], presetPos: [0, 0.7, 0.95] };
    }
  }, [cameraPreset, isBoxOnFloor, carriers]);

  const sortedCarriers = [...carriers].sort((a, b) => a.positionMm - b.positionMm);
  const laserCarrier = carriers.find((c) => c.type === 'laser_source');
  const laserPosMm = laserCarrier ? laserCarrier.positionMm : 50;
  const detectorCarrier = carriers.find((c) => c.type === 'photodetector_stage');

  const downstream = sortedCarriers.filter((c) => c.positionMm > laserPosMm);
  const nextTarget = downstream[0];
  const nextTargetPosMm = nextTarget ? nextTarget.positionMm : 950;
  const beamLengthM = Math.max(0, (nextTargetPosMm - laserPosMm) / 1000);

  // World positions for BNC cable endpoints
  const detectorBNCPort = useMemo(() => {
    if (!detectorCarrier) return new THREE.Vector3(0, 0.18, -0.05);
    const x = (detectorCarrier.positionMm / 1000) - 0.5;
    return new THREE.Vector3(x + 0.018, 0.168, -0.05);
  }, [detectorCarrier]);

  const meterBNCPort = useMemo(() => new THREE.Vector3(0.55 - 0.06, 0.032, 0.22 - 0.079), []);

  const isDetectorIlluminated = isLaserOn && !!detectorCarrier;

  // Task sheet text lines
  const taskLines = useMemo(() => [
    challenge.title.toUpperCase(),
    '',
    'OLYMPIAD SOURCE:',
    `  ${challenge.olympiadSource}`,
    '',
    'TASK DESCRIPTION:',
    ...challenge.taskSummary.split('. ').map(s => s.trim()).filter(Boolean),
    '',
    'EXPERIMENTAL OBJECTIVE:',
    '  Determine as grandezas físicas solicitadas usando os instrumentos',
    '  fornecidos no kit. Registre suas medições com incertezas realistas.',
    '',
    'AVAILABLE EQUIPMENT:',
    ...challenge.kitItems.map(k => `  • ${k.name} — ${k.description}`),
    '',
    'PROCEDURE:',
    '  1. Monte o aparato óptico sobre o trilho de 1000 mm.',
    '  2. Ligue o laser e alinhe o feixe.',
    '  3. Posicione o detector e meça a intensidade em função da posição transversal.',
    '  4. Repita para diferentes configurações de abertura.',
    '  5. Analise os dados e determine as incógnitas do problema.',
    '',
    'DURATION:',
    `  ${challenge.examDurationMinutes} minutos`,
  ], [challenge]);

  const schemeLines = useMemo(() => [
    'MARKING SCHEME',
    '',
    challenge.title.toUpperCase(),
    `Source: ${challenge.olympiadSource}`,
    '',
    'GRADING CRITERIA:',
    '  [5 pts] Correto alinhamento óptico e calibração do zero.',
    '  [10 pts] Medição de pelo menos 10 pontos do padrão de difração.',
    '  [10 pts] Ajuste de curva e identificação dos mínimos/máximos.',
    '  [15 pts] Determinação da grandeza física com incerteza correcta.',
    '  [10 pts] Análise de erros sistemáticos e aleatórios.',
    '',
    'EXPECTED RESULTS:',
    `  λ nominal = ${laser.wavelengthNm.toFixed(1)} nm`,
    `  Incerteza esperada: ±0.5 nm`,
    '',
    'NOTES FOR GRADERS:',
    '  Aceitar resultados dentro de 2σ da verdade escondida.',
    '  Penalizar falta de unidades ou incertezas não mencionadas.',
  ], [challenge, laser]);

  return (
    <>
      {/* Orbit Controls with fluid camera interpolation between presets */}
      <OrbitControlsComponent
        presetTarget={presetTarget}
        presetPos={presetPos}
      />

      {/* Ambient & Studio Lights */}
      <ambientLight intensity={0.45} color="#e8e4d8" />
      <directionalLight
        position={[1.5, 2.5, 1.0]}
        intensity={0.95}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={8}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
        color="#fff8e8"
      />
      <pointLight position={[-1.0, 1.8, 0.5]} intensity={0.3} color="#c8d8ff" />

      {/* Laboratory Room */}
      <LabEnvironment onFloorClick={() => onSelectCarrier(null)} />

      {/* Exam Clock */}
      <ExamClock secondsRemaining={secondsRemaining} isRunning={isClockRunning} />

      {/* Kit Box */}
      <KitBox
        isOpen={isBoxOpen}
        isOnFloor={isBoxOnFloor}
        onToggleOpen={onToggleBoxOpen}
        onToggleFloor={onToggleBoxFloor}
        unpackedElements={unpackedElements}
        onUnpackElement={onUnpackElement}
      />

      {/* Physical A4 Task Sheet on desk */}
      <PhysicalTaskSheet
        taskLines={taskLines}
        markingSchemeLines={schemeLines}
      />

      {/* Physical Benchtop Power Meter */}
      <PhysicalBenchtopMeter
        measuredPowerMw={isMeterOn ? trainResult.measuredPowerWithNoiseMw : 0}
        isOn={isMeterOn}
        unitMode={meterUnitMode}
        onTogglePower={onToggleMeterPower}
        onTare={onTareMeter}
        onCycleUnit={onCycleMeterUnit}
      />

      {/* BNC Cable connecting detector to meter */}
      {detectorCarrier && (
        <FlexibleCable
          detectorPort={detectorBNCPort}
          meterPort={meterBNCPort}
          isConnected={isDetectorIlluminated || !!detectorCarrier}
        />
      )}

      {/* 1000 mm Optical Rail */}
      <OpticalRail />

      {/* Mounted Carriers */}
      {carriers.map((carrier) => {
        const isLaserIlluminated =
          isLaserOn &&
          carrier.positionMm > laserPosMm &&
          carrier.positionMm <= nextTargetPosMm;

        return (
          <CarrierMount
            key={carrier.id}
            carrierId={carrier.id}
            positionMm={carrier.positionMm}
            isLocked={carrier.isLocked}
            isSelected={carrier.id === selectedCarrierId}
            onPositionChange={(newPos) => onCarrierPositionChange(carrier.id, newPos)}
            onToggleLock={() => onCarrierToggleLock(carrier.id)}
            onSelect={() => onSelectCarrier(carrier.id)}
          >
            {carrier.type === 'laser_source' && (
              <LaserSource
                laser={laser}
                isOn={isLaserOn}
                onTogglePower={onToggleLaserPower}
                beamLengthM={beamLengthM}
              />
            )}

            {(carrier.type === 'single_slit' ||
              carrier.type === 'double_slit' ||
              carrier.type === 'diffraction_grating' ||
              carrier.type === 'circular_aperture') && (
              <DiffractionApertures
                type={carrier.type}
                params={carrier.customParams as any}
                isLaserIlluminated={isLaserIlluminated}
              />
            )}

            {carrier.type === 'polarizer' && (
              <PolarizerHolder
                params={carrier.customParams as any}
                onAngleChange={(newA) => onPolarizerAngleChange(carrier.id, newA)}
                isLaserIlluminated={isLaserIlluminated}
              />
            )}

            {carrier.type === 'projection_screen' && (
              <ProjectionScreen
                trainResult={trainResult}
                isLaserOn={isLaserOn}
              />
            )}

            {carrier.type === 'photodetector_stage' && (
              <MicrometerPhotodetector
                transversePosMm={transverseMicrometerMm}
                onTransverseChange={onTransverseMicrometerChange}
                isLaserIlluminated={isLaserIlluminated}
                alignmentEfficiency={trainResult.alignmentEfficiency}
              />
            )}
          </CarrierMount>
        );
      })}
    </>
  );
};
