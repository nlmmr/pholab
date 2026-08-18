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
  Hash,
  Clock
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

  // Exam Elapsed Timer (Tempo de Prova Decorrido)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

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
    gimbalMode: 'translate',
  });

  // Elapsed exam timer tick
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Stopwatch timer tick
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

  // Format Elapsed Time: HH:MM:SS
  const formattedElapsedTime = useMemo(() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [elapsedSeconds]);

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

        {/* Right Actions: Elapsed Exam Timer & Seed */}
        <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Exam Elapsed Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.45)',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#fde047'
          }}>
            <Clock size={14} color="#f59e0b" />
            <span>DECORRIDO: {formattedElapsedTime}</span>
            <span style={{ color: '#94a3b8' }}>/ {activePackage.durationMinutes} min</span>
          </div>

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

        {/* MODE 3: LABORATORY (Hands-on 3D Simulation) */}
        {currentMode === 'lab' && (
          <div className="lab-viewport-wrapper">
            <Sand3DViewport
              cameraPreset={cameraPreset}
              state={experimentState}
              ballsList={OFFICIAL_IPHO_BALLS}
              selectedBall={selectedBall}
              elapsedSeconds={elapsedSeconds}
              onSelectBall={setSelectedBall}
              onDropBall={handleDropBall}
              onStirAndLevel={handleStirAndLevel}
              onRollRailBall={handleRollComplete}
              onToggleChronometer={handleToggleChronometer}
              onResetChronometer={handleResetChronometer}
            />

            {/* Minimalist Floating HUD Panel (Camera Presets & Fine Tuning) */}
            <div className="lab-tactile-hud">
              {/* Focal Cameras */}
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
                    className={`btn-ksp-action ${cameraPreset === 'kit_box' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('kit_box')}
                  >
                    Caixa do Kit
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'craters_bowl' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('craters_bowl')}
                  >
                    Tigela / Areia
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'stand_height' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('stand_height')}
                  >
                    Suporte Vertical
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'inclined_rail' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('inclined_rail')}
                  >
                    Trilho 5° & Pista
                  </button>
                  <button
                    className={`btn-ksp-action ${cameraPreset === 'chronometer' ? 'primary' : ''}`}
                    onClick={() => setCameraPreset('chronometer')}
                  >
                    Cronômetro
                  </button>
                </div>
              </div>

              {/* Part A: Crater Fine Adjust */}
              <div className="hud-pill-group">
                <div className="hud-pill-title">
                  <CircleDot size={13} />
                  <span>Parte A: Altura de Queda (h)</span>
                </div>

                <div className="hud-row-item">
                  <span className="label">Esfera Equipada:</span>
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
                    <span className="label">Altura do Colar (h):</span>
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
                    title="Misturar areia com a colher e nivelar"
                  >
                    Nivelar Areia
                  </button>
                </div>
              </div>

              {/* Part B: Inclined Rail */}
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
                  {experimentState.ballRolling ? 'Esfera Rolando...' : 'Soltar no Trilho'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
