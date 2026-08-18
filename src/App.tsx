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

import { AppMode, BallSpec, PhOLabPackage, SandCraterExperimentState } from './domain/types';
import { IPHO_2025_SAND_CRATERS_PACKAGE } from './experiments/IPhO2025SandCraters';
import { SandImpactSolver } from './domain/physics/SandImpactSolver';
import { RailRollingSolver } from './domain/physics/RailRollingSolver';
import { OFFICIAL_IPHO_BALLS } from './physics/SandImpactPhysics';
import { ExperimentHub } from './modes/hub/ExperimentHub';
import { CreatorStudio } from './modes/studio/CreatorStudio';
import { LabViewport, LabCameraPreset } from './modes/lab/LabViewport';

export const App: React.FC = () => {
  // Navigation Mode: Hub (Catalog), Studio (Creator), Lab (3D Simulation)
  const [currentMode, setCurrentMode] = useState<AppMode>('hub');

  // Active Experiment Package (.pholab)
  const [activePackage, setActivePackage] = useState<PhOLabPackage>(IPHO_2025_SAND_CRATERS_PACKAGE);
  const [examSeed, setExamSeed] = useState<string>('IPHO-2025-MARS');

  // Exam Elapsed Timer (Tempo de Prova Decorrido)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Physics Solvers
  const impactSolver = useMemo(() => new SandImpactSolver(1.8), []);
  const rollingSolver = useMemo(() => new RailRollingSolver(), []);

  // Camera Preset for 3D Lab
  const [cameraPreset, setCameraPreset] = useState<LabCameraPreset>('overview');

  // Sand Crater Experiment Runtime State
  const [selectedBall, setSelectedBall] = useState<BallSpec>(OFFICIAL_IPHO_BALLS[2]);
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
    gimbalMode: 'offset',
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
    const impact = impactSolver.computeImpact(
      selectedBall,
      experimentState.dropHeightCm,
      experimentState.sandStirredAndLeveled
    );

    setExperimentState((prev) => ({
      ...prev,
      craterFormed: true,
      sandStirredAndLeveled: false,
      lastImpactDiameterMm: impact.craterDiameterMm,
      lastImpactEnergyJ: impact.impactEnergyJ,
    }));
  }, [impactSolver, selectedBall, experimentState.dropHeightCm, experimentState.sandStirredAndLeveled]);

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
    const rolling = rollingSolver.computeRolling(
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
  }, [rollingSolver, experimentState.railReleaseDistanceCm, experimentState.railAngleDeg, experimentState.sandStirredAndLeveled]);

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
            <LabViewport
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

            {/* Minimalist Floating Camera Presets HUD */}
            <div className="lab-tactile-hud">
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
