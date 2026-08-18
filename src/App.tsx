import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Compass,
  Layers,
  Wrench,
  Play,
  RotateCcw,
  BookOpen,
  Timer,
  Ruler,
  CircleDot,
  Activity,
  Eye,
  Settings,
  Award,
  Hash
} from './components/icons/Icons';

import { AppMode, BallSpec, PhOLabPackage, SandCraterExperimentState } from './types/pholab';
import { IPHO_2025_SAND_CRATERS_PACKAGE } from './experiments/IPhO2025SandCraters';
import { SandImpactPhysics, OFFICIAL_IPHO_BALLS } from './physics/SandImpactPhysics';
import { ExperimentHub } from './modes/hub/ExperimentHub';
import { CreatorStudio } from './modes/studio/CreatorStudio';
import { Sand3DViewport, SandCameraPreset } from './components/3d/sand/Sand3DViewport';

export const App: React.FC = () => {
  // Navigation Mode
  const [currentMode, setCurrentMode] = useState<AppMode>('hub');

  // Active Experiment Package
  const [activePackage, setActivePackage] = useState<PhOLabPackage>(IPHO_2025_SAND_CRATERS_PACKAGE);
  const [examSeed, setExamSeed] = useState<string>('IPHO-2025-MARS');

  // Exam Clock
  const [secondsRemaining, setSecondsRemaining] = useState<number>(activePackage.durationMinutes * 60);
  const [isClockRunning, setIsClockRunning] = useState<boolean>(true);

  // Physics Engine Instance
  const physics = useMemo(() => new SandImpactPhysics(examSeed), [examSeed]);

  // Camera Preset for 3D Lab
  const [cameraPreset, setCameraPreset] = useState<SandCameraPreset>('overview');

  // Sand Crater Experiment State
  const [selectedBall, setSelectedBall] = useState<BallSpec>(OFFICIAL_IPHO_BALLS[2]); // Ball #3 (9mm, 3.0g) by default
  const [experimentState, setExperimentState] = useState<SandCraterExperimentState>({
    selectedBallId: OFFICIAL_IPHO_BALLS[2].id,
    dropHeightCm: 50.0,
    sandStirredAndLeveled: true,
    craterFormed: false,
    lastImpactDiameterMm: 0,
    lastImpactEnergyJ: 0,
    railAngleDeg: 5.0,
    railReleaseDistanceCm: 50.0,
    ballRolling: false,
    ballTravelTimeS: 0,
    ballStoppingDistanceCm: 0,
    isChronometerRunning: false,
    chronometerTimeS: 0,
  });

  // Clock tick timer
  useEffect(() => {
    if (!isClockRunning) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockRunning]);

  // Stopwatch timer
  useEffect(() => {
    if (!experimentState.isChronometerRunning) return;
    const timer = setInterval(() => {
      setExperimentState((prev) => ({
        ...prev,
        chronometerTimeS: prev.chronometerTimeS + 0.01,
      }));
    }, 10);
    return () => clearInterval(timer);
  }, [experimentState.isChronometerRunning]);

  // --- Part A Actions: Crater Impact ---
  const handleDropBall = useCallback(() => {
    const impact = physics.computeImpact(
      selectedBall,
      experimentState.dropHeightCm,
      experimentState.sandStirredAndLeveled
    );

    setExperimentState((prev) => ({
      ...prev,
      craterFormed: true,
      sandStirredAndLeveled: false, // Sand becomes compacted until stirred again
      lastImpactDiameterMm: impact.craterDiameterMm,
      lastImpactEnergyJ: impact.impactEnergyJ,
    }));
  }, [physics, selectedBall, experimentState.dropHeightCm, experimentState.sandStirredAndLeveled]);

  const handleStirAndLevel = useCallback(() => {
    setExperimentState((prev) => ({
      ...prev,
      sandStirredAndLeveled: true,
      craterFormed: false,
      lastImpactDiameterMm: 0,
    }));
  }, []);

  // --- Part B Actions: Inclined Rail & Sand Track ---
  const handleRollBallOnRail = useCallback(() => {
    const rolling = physics.computeRolling(
      experimentState.railReleaseDistanceCm,
      experimentState.railAngleDeg,
      experimentState.sandStirredAndLeveled
    );

    setExperimentState((prev) => ({
      ...prev,
      ballRolling: true,
      ballTravelTimeS: rolling.travelTimeS,
      ballStoppingDistanceCm: rolling.stoppingDistanceCm,
    }));
  }, [physics, experimentState.railReleaseDistanceCm, experimentState.railAngleDeg, experimentState.sandStirredAndLeveled]);

  const handleRollComplete = useCallback(() => {
    setExperimentState((prev) => ({
      ...prev,
      ballRolling: false,
    }));
  }, []);

  const handleToggleChronometer = useCallback(() => {
    setExperimentState((prev) => ({
      ...prev,
      isChronometerRunning: !prev.isChronometerRunning,
    }));
  }, []);

  const handleResetChronometer = useCallback(() => {
    setExperimentState((prev) => ({
      ...prev,
      isChronometerRunning: false,
      chronometerTimeS: 0,
    }));
  }, []);

  // Task document text lines for physical paper on table
  const taskLines = useMemo(() => [
    activePackage.title.toUpperCase(),
    '',
    `OLYMPIAD: ${activePackage.olympiad}`,
    '',
    'PART A: CRATER FORMATION (Q2-4)',
    '  Drop ball #3 (d=9mm, m=3.0g) from h=50cm.',
    '  Measure diameter D with the ruler. Repeat 5 times.',
    '  Stir and level the sand after each impact!',
    '',
    'PART B: ROLLING ON RAIL & SAND (Q2-7)',
    '  Rail at theta = 5 deg. Measure travel time t50 for l=50cm.',
    '  Measure stopping distance L in sand track.',
  ], [activePackage]);

  const schemeLines = useMemo(() => [
    'MARKING SCHEME — IPhO 2025',
    '',
    'QUESTION A.1 (0.6 pt):',
    '  D = (23.8 +- 1.2) mm',
    '  2 measures of D between 22-26mm (0.2pt)',
    '  3 more measures (0.2pt)',
    '',
    'QUESTION B.2 (0.7 pt):',
    '  t50 = (1.33 +- 0.04) s',
    '',
    'QUESTION B.6 (0.8 pt):',
    '  L50 = (6.4 +- 0.5) cm',
    '',
    'QUESTION B.8 (0.2 pt):',
    '  mu_eff = 0.80 +- 0.15',
  ], []);

  return (
    <div className="app-container">
      {/* pho.rs Academic Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo">Ψ</div>
          <div className="brand-title-group">
            <span className="brand-title">PhOLab</span>
            <span className="brand-motto">May the pho.rs be with you!</span>
          </div>
        </div>

        {/* 3 Core Operating Mode Tabs */}
        <div className="mode-tabs">
          <button
            className={`mode-tab-btn ${currentMode === 'hub' ? 'active' : ''}`}
            onClick={() => setCurrentMode('hub')}
          >
            <Compass size={14} />
            <span>Painel de Experimentos (Hub)</span>
          </button>
          <button
            className={`mode-tab-btn ${currentMode === 'studio' ? 'active' : ''}`}
            onClick={() => setCurrentMode('studio')}
          >
            <Wrench size={14} />
            <span>Criador (Studio)</span>
          </button>
          <button
            className={`mode-tab-btn ${currentMode === 'lab' ? 'active' : ''}`}
            onClick={() => setCurrentMode('lab')}
          >
            <Play size={14} />
            <span>Laboratório (Lab 3D)</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="navbar-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#93c5fd', fontFamily: 'monospace' }}>
            <Hash size={12} color="#f59e0b" />
            <span>SEED: {examSeed}</span>
          </div>
        </div>
      </header>

      {/* Main Content Router */}
      <main className="main-content-view">
        {/* MODE 1: EXPERIMENT HUB */}
        {currentMode === 'hub' && (
          <ExperimentHub
            currentPackage={activePackage}
            onStartExperiment={() => setCurrentMode('lab')}
            onOpenStudioNew={() => setCurrentMode('studio')}
            onImportPackage={(pkg) => {
              setActivePackage(pkg);
              setCurrentMode('hub');
            }}
          />
        )}

        {/* MODE 2: CREATOR STUDIO */}
        {currentMode === 'studio' && (
          <CreatorStudio
            initialPackage={activePackage}
            onSavePackage={(pkg) => setActivePackage(pkg)}
            onTestInLab={(pkg) => {
              setActivePackage(pkg);
              setCurrentMode('lab');
            }}
          />
        )}

        {/* MODE 3: LABORATORY (3D Simulation) */}
        {currentMode === 'lab' && (
          <div className="lab-viewport-wrapper">
            <Sand3DViewport
              cameraPreset={cameraPreset}
              state={experimentState}
              ballsList={OFFICIAL_IPHO_BALLS}
              selectedBall={selectedBall}
              onSelectBall={setSelectedBall}
              onDropBall={handleDropBall}
              onStirAndLevel={handleStirAndLevel}
              onRollRailBall={handleRollComplete}
              taskLines={taskLines}
              schemeLines={schemeLines}
            />

            {/* KSP Industrial Floating Control Panel (HUD) */}
            <div className="lab-tactile-hud">
              {/* Focal Cameras Pill */}
              <div className="hud-pill-group">
                <div className="hud-pill-title">
                  <Eye size={13} />
                  <span>Câmeras Focais</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'overview' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('overview')}
                  >
                    Bancada Geral
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'craters_bowl' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('craters_bowl')}
                  >
                    Tigela / Crateras
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'stand_height' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('stand_height')}
                  >
                    Suporte de Queda
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'inclined_rail' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('inclined_rail')}
                  >
                    Trilho 5° & Areia
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'chronometer' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('chronometer')}
                  >
                    Cronômetro
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'task_sheet' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('task_sheet')}
                  >
                    Caderno Prova
                  </button>
                </div>
              </div>

              {/* Part A Controls: Crater Drop */}
              <div className="hud-pill-group">
                <div className="hud-pill-title">
                  <CircleDot size={13} />
                  <span>Parte A: Impacto de Crateras</span>
                </div>

                <div className="hud-row-item">
                  <span className="label">Esfera Ativa:</span>
                  <span className="value" style={{ color: '#f59e0b' }}>
                    {selectedBall.name} ({selectedBall.massG}g)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  {OFFICIAL_IPHO_BALLS.map((b) => (
                    <button
                      key={b.id}
                      className={`btn-ksp-action ${selectedBall.id === b.id ? 'primary' : ''}`}
                      style={{ flex: 1, padding: '4px 0', fontSize: 11 }}
                      onClick={() => setSelectedBall(b)}
                    >
                      #{b.id.split('-')[1]}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="hud-row-item">
                    <span className="label">Altura de Queda (h):</span>
                    <span className="value">{experimentState.dropHeightCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={experimentState.dropHeightCm}
                    onChange={(e) =>
                      setExperimentState({ ...experimentState, dropHeightCm: Number(e.target.value) })
                    }
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="btn-ksp-action primary" style={{ flex: 1 }} onClick={handleDropBall}>
                    Soltar Esfera
                  </button>
                  <button
                    className={`btn-ksp-action ${experimentState.sandStirredAndLeveled ? 'success' : ''}`}
                    onClick={handleStirAndLevel}
                    title="Misturar areia com colher e nivelar com régua"
                  >
                    Nivelar Areia
                  </button>
                </div>

                {experimentState.craterFormed && (
                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: 4, marginTop: 4 }}>
                    <div className="hud-row-item">
                      <span className="label">Diâmetro Medido (D):</span>
                      <span className="value" style={{ color: '#10b981' }}>
                        {experimentState.lastImpactDiameterMm.toFixed(1)} mm
                      </span>
                    </div>
                    <div className="hud-row-item">
                      <span className="label">Energia de Impacto (E):</span>
                      <span className="value">{experimentState.lastImpactEnergyJ.toExponential(2)} J</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Part B Controls: Inclined Rail & Sand */}
              <div className="hud-pill-group">
                <div className="hud-pill-title">
                  <Activity size={13} />
                  <span>Parte B: Trilho Inclinado 5°</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="hud-row-item">
                    <span className="label">Distância de Lançamento (l):</span>
                    <span className="value">{experimentState.railReleaseDistanceCm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={experimentState.railReleaseDistanceCm}
                    onChange={(e) =>
                      setExperimentState({ ...experimentState, railReleaseDistanceCm: Number(e.target.value) })
                    }
                  />
                </div>

                <button
                  className="btn-ksp-action primary"
                  disabled={experimentState.ballRolling}
                  onClick={handleRollBallOnRail}
                >
                  {experimentState.ballRolling ? 'Esfera Rolando...' : 'Soltar no Trilho (l)'}
                </button>

                {experimentState.ballStoppingDistanceCm > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: '6px 8px', borderRadius: 4, marginTop: 4 }}>
                    <div className="hud-row-item">
                      <span className="label">Tempo Teórico (t):</span>
                      <span className="value">{experimentState.ballTravelTimeS.toFixed(2)} s</span>
                    </div>
                    <div className="hud-row-item">
                      <span className="label">Distância Parada (L):</span>
                      <span className="value" style={{ color: '#10b981' }}>
                        {experimentState.ballStoppingDistanceCm.toFixed(1)} cm
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
