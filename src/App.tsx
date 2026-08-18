import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Atom, BookOpen, Hash } from 'lucide-react';

import { LabScene, CameraPreset } from './components/3d/LabScene';
import { LabHUD } from './components/ui/LabHUD';
import { TaskDrawer } from './components/ui/TaskDrawer';

import {
  CarrierState,
  LaserConfig,
  OpticalElementType,
  SlitParameters,
  PolarizerParameters
} from './physics/types';
import { OpticalBenchSystem } from './physics/OpticalBenchSystem';
import { createIPhOPilotChallenge } from './experiments/IPhOPilotChallenge';

const INITIAL_SEED = 'IPHO-7X9';

const DEFAULT_LASER: LaserConfig = {
  id: 'diode-laser-green',
  name: 'Diode Laser 532nm',
  wavelengthNm: 532.0,
  nominalPowerMw: 5.0,
  beamWaistMm: 0.5,
  divergenceMrad: 1.2,
  rinNoisePercent: 1.5,
  wavelengthJitterNm: 0.2
};

export const App: React.FC = () => {
  const [examSeed, setExamSeed] = useState<string>(INITIAL_SEED);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');

  const challenge = useMemo(() => createIPhOPilotChallenge(examSeed), [examSeed]);

  // Clock
  const [secondsRemaining, setSecondsRemaining] = useState<number>(challenge.examDurationMinutes * 60);
  const [isClockRunning, setIsClockRunning] = useState<boolean>(true);

  // Kit box
  const [isBoxOpen, setIsBoxOpen] = useState<boolean>(false);
  const [isBoxOnFloor, setIsBoxOnFloor] = useState<boolean>(false);
  const [unpackedElements, setUnpackedElements] = useState<Set<string>>(new Set());

  // Optical state
  const [laser, setLaser] = useState<LaserConfig>(DEFAULT_LASER);
  const [isLaserOn, setIsLaserOn] = useState<boolean>(false);
  const [carriers, setCarriers] = useState<CarrierState[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);

  // Micrometer & measurement
  const [transverseMicrometerMm, setTransverseMicrometerMm] = useState<number>(0.0);
  const [tareOffsetMw, setTareOffsetMw] = useState<number>(0.0);

  // Physical 3D meter state
  const [isMeterOn, setIsMeterOn] = useState<boolean>(true);
  const [meterUnitMode, setMeterUnitMode] = useState<'uW' | 'mW' | 'Lux'>('uW');

  // Task drawer
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState<boolean>(false);

  const benchSystem = useMemo(() => new OpticalBenchSystem(examSeed), [examSeed]);

  // Clock tick
  useEffect(() => {
    if (!isClockRunning) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockRunning]);

  // Hidden wavelength from seed
  useEffect(() => {
    if (challenge.hiddenTruth.exactWavelengthNm) {
      setLaser((prev) => ({ ...prev, wavelengthNm: challenge.hiddenTruth.exactWavelengthNm! }));
    }
  }, [challenge]);

  // Physics evaluation
  const trainResult = useMemo(() => {
    return benchSystem.evaluate(laser, isLaserOn, carriers, transverseMicrometerMm, tareOffsetMw);
  }, [benchSystem, laser, isLaserOn, carriers, transverseMicrometerMm, tareOffsetMw]);

  // Unpack element from kit
  const handleUnpackElement = useCallback(
    (type: OpticalElementType, id: string) => {
      setUnpackedElements((prev) => new Set(prev).add(type));

      let defaultPosMm = 500;
      let initialParams: SlitParameters | PolarizerParameters | undefined;

      if (type === 'laser_source') defaultPosMm = 50;
      else if (type === 'single_slit') { defaultPosMm = 250; initialParams = { slitWidthUm: 80 }; }
      else if (type === 'double_slit') { defaultPosMm = 250; initialParams = { slitWidthUm: 50, slitSeparationUm: 250 }; }
      else if (type === 'diffraction_grating') {
        defaultPosMm = 300;
        initialParams = { slitWidthUm: 40, linesPerMm: Math.round(challenge.hiddenTruth.gratingLinesPerMm || 600) };
      } else if (type === 'polarizer') { defaultPosMm = 180; initialParams = { angleDegrees: 0, extinctionRatio: 1.5e-4 }; }
      else if (type === 'projection_screen') defaultPosMm = 850;
      else if (type === 'photodetector_stage') defaultPosMm = 750;

      const newCarrier: CarrierState = {
        id: `carrier-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        elementId: id,
        type,
        positionMm: defaultPosMm,
        isLocked: false,
        screwTightness: 1.0,
        heightMm: 100,
        tiltXDeg: 0,
        tiltYDeg: 0,
        rotationDegrees: 0,
        customParams: initialParams
      };

      setCarriers((prev) => [...prev, newCarrier]);
      setSelectedCarrierId(newCarrier.id);
    },
    [challenge]
  );

  const handleCarrierPositionChange = useCallback((id: string, newPosMm: number) => {
    setCarriers((prev) => prev.map((c) => c.id === id ? { ...c, positionMm: newPosMm } : c));
  }, []);

  const handleCarrierToggleLock = useCallback((id: string) => {
    setCarriers((prev) => prev.map((c) => c.id === id ? { ...c, isLocked: !c.isLocked } : c));
  }, []);

  const handlePolarizerAngleChange = useCallback((id: string, newAngle: number) => {
    setCarriers((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, customParams: { ...(c.customParams as PolarizerParameters), angleDegrees: newAngle } }
          : c
      )
    );
  }, []);

  const handleTare = useCallback(() => {
    setTareOffsetMw(trainResult.measuredPowerWithNoiseMw);
  }, [trainResult.measuredPowerWithNoiseMw]);

  const handleResetRailPositions = useCallback(() => {
    setCarriers((prev) =>
      prev.map((c) => {
        let pos = 500;
        if (c.type === 'laser_source') pos = 50;
        else if (c.type === 'polarizer') pos = 180;
        else if (
          c.type === 'single_slit' ||
          c.type === 'double_slit' ||
          c.type === 'diffraction_grating'
        )
          pos = 300;
        else if (c.type === 'photodetector_stage') pos = 750;
        else if (c.type === 'projection_screen') pos = 850;
        return { ...c, positionMm: pos, isLocked: false };
      })
    );
  }, []);

  const handleChangeSeed = useCallback((newSeed: string) => {
    setExamSeed(newSeed);
    setCarriers([]);
    setUnpackedElements(new Set());
    setIsLaserOn(false);
    setIsBoxOpen(true);
    setTareOffsetMw(0);
    setTransverseMicrometerMm(0);
  }, []);

  const handleExportState = useCallback(() => {
    const stateObj = {
      examSeed,
      secondsRemaining,
      isBoxOpen,
      isBoxOnFloor,
      unpackedElements: Array.from(unpackedElements),
      carriers,
      laser,
      isLaserOn,
      transverseMicrometerMm,
      tareOffsetMw,
      savedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(stateObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pholab-session-${examSeed}.phostate`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    examSeed,
    secondsRemaining,
    isBoxOpen,
    isBoxOnFloor,
    unpackedElements,
    carriers,
    laser,
    isLaserOn,
    transverseMicrometerMm,
    tareOffsetMw
  ]);

  const handleImportState = useCallback((jsonData: string) => {
    try {
      const stateObj = JSON.parse(jsonData);
      if (stateObj.examSeed) setExamSeed(stateObj.examSeed);
      if (stateObj.secondsRemaining) setSecondsRemaining(stateObj.secondsRemaining);
      if (stateObj.isBoxOpen !== undefined) setIsBoxOpen(stateObj.isBoxOpen);
      if (stateObj.isBoxOnFloor !== undefined) setIsBoxOnFloor(stateObj.isBoxOnFloor);
      if (stateObj.unpackedElements) setUnpackedElements(new Set(stateObj.unpackedElements));
      if (stateObj.carriers) setCarriers(stateObj.carriers);
      if (stateObj.laser) setLaser(stateObj.laser);
      if (stateObj.isLaserOn !== undefined) setIsLaserOn(stateObj.isLaserOn);
      if (stateObj.transverseMicrometerMm !== undefined)
        setTransverseMicrometerMm(stateObj.transverseMicrometerMm);
      if (stateObj.tareOffsetMw !== undefined) setTareOffsetMw(stateObj.tareOffsetMw);
    } catch (err) {
      alert('Formato de arquivo .phostate inválido!');
    }
  }, []);

  return (
    <div className="lab-app-container">
      {/* Top Application Bar */}
      <header className="lab-topbar">
        <div className="lab-brand">
          <div className="lab-logo-icon"><Atom size={18} /></div>
          <div className="lab-title-group">
            <h1>PhOLab | Laboratório Virtual de Física Olímpica</h1>
            <span className="lab-subtitle">{challenge.title}</span>
          </div>
        </div>

        <div className="lab-topbar-center">
          <div className="exam-seed-pill" title="Semente de Exame Determinística">
            <Hash size={13} color="#f59e0b" />
            <span>SEED: <strong>{examSeed}</strong></span>
          </div>
        </div>

        <div className="lab-topbar-actions">
          <button
            className="btn-dock"
            style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={() => setIsTaskDrawerOpen(true)}
          >
            <BookOpen size={13} color="#60a5fa" />
            <span>Caderno IPhO</span>
          </button>
        </div>
      </header>

      {/* 3D Viewport */}
      <main className="viewport-container">
        <Canvas
          shadows
          camera={{ position: [0, 0.7, 0.95], fov: 42 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onPointerMissed={() => setSelectedCarrierId(null)}
        >
          <LabScene
            cameraPreset={cameraPreset}
            secondsRemaining={secondsRemaining}
            isClockRunning={isClockRunning}
            isBoxOpen={isBoxOpen}
            isBoxOnFloor={isBoxOnFloor}
            onToggleBoxOpen={() => setIsBoxOpen((prev) => !prev)}
            onToggleBoxFloor={() => setIsBoxOnFloor((prev) => !prev)}
            unpackedElements={unpackedElements}
            onUnpackElement={handleUnpackElement}
            laser={laser}
            isLaserOn={isLaserOn}
            onToggleLaserPower={() => setIsLaserOn((prev) => !prev)}
            carriers={carriers}
            selectedCarrierId={selectedCarrierId}
            onSelectCarrier={setSelectedCarrierId}
            onCarrierPositionChange={handleCarrierPositionChange}
            onCarrierToggleLock={handleCarrierToggleLock}
            onPolarizerAngleChange={handlePolarizerAngleChange}
            transverseMicrometerMm={transverseMicrometerMm}
            onTransverseMicrometerChange={setTransverseMicrometerMm}
            trainResult={trainResult}
            isMeterOn={isMeterOn}
            onToggleMeterPower={() => setIsMeterOn((p) => !p)}
            onTareMeter={handleTare}
            meterUnitMode={meterUnitMode}
            onCycleMeterUnit={() =>
              setMeterUnitMode((p) => (p === 'uW' ? 'mW' : p === 'mW' ? 'Lux' : 'uW'))
            }
            challenge={challenge}
          />
        </Canvas>

        {/* Floating HUD Layer (Camera Presets, Laser toggle, Reset, Save/Export) */}
        <div className="hud-overlay">
          <LabHUD
            cameraPreset={cameraPreset}
            onSelectCameraPreset={setCameraPreset}
            examSeed={examSeed}
            onChangeSeed={handleChangeSeed}
            laser={laser}
            isLaserOn={isLaserOn}
            onToggleLaserPower={() => setIsLaserOn((prev) => !prev)}
            onResetRailPositions={handleResetRailPositions}
            onOpenTaskDrawer={() => setIsTaskDrawerOpen(true)}
            onExportState={handleExportState}
            onImportState={handleImportState}
          />
        </div>
      </main>

      {/* Task & Marking Scheme Drawer */}
      <TaskDrawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
        challenge={challenge}
      />
    </div>
  );
};
