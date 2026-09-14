import React, { useEffect, useRef, useState } from 'react';
import { PhOLabEngine } from '../../core/engine/PhOLabEngine';
import { KspGizmoMode } from '../../components/3d/controls/KspGizmoController';
import { BallSpec, SandCraterExperimentState } from '../../domain/types';

export type LabCameraPreset =
  | 'overview'
  | 'kit_box'
  | 'craters_bowl'
  | 'stand_height'
  | 'inclined_rail'
  | 'chronometer';

const CAMERA_PRESETS: Record<LabCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0, 0.75, 1.2], target: [0, 0.05, 0] },
  kit_box: { pos: [0.48, 0.45, 0.55], target: [0.48, 0.04, 0.28] },
  craters_bowl: { pos: [-0.25, 0.38, 0.26], target: [-0.25, 0.04, 0.02] },
  stand_height: { pos: [-0.25, 0.75, 0.55], target: [-0.25, 0.5, 0] },
  inclined_rail: { pos: [0.36, 0.52, 0.45], target: [0.36, 0.12, -0.05] },
  chronometer: { pos: [0.06, 0.28, 0.36], target: [0.06, 0.02, 0.22] },
};

interface LabViewportProps {
  cameraPreset: LabCameraPreset;
  state: SandCraterExperimentState;
  ballsList: BallSpec[];
  selectedBall: BallSpec;
  elapsedSeconds: number;
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  onStirAndLevel: () => void;
  onRollRailBall: () => void;
  onToggleChronometer: () => void;
  onResetChronometer: () => void;
}

export const LabViewport: React.FC<LabViewportProps> = ({
  cameraPreset,
  state,
  ballsList,
  selectedBall,
  onSelectBall,
  onDropBall,
  onRollRailBall,
  onToggleChronometer,
  onResetChronometer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PhOLabEngine | null>(null);

  const [activeGizmoMode, setActiveGizmoMode] = useState<KspGizmoMode>('offset');
  const [isSnapActive, setIsSnapActive] = useState<boolean>(true);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);
  const [isAssembled, setIsAssembled] = useState<boolean>(false);

  // Initialize Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new PhOLabEngine(containerRef.current, ballsList, selectedBall, {
      onSelectBall,
      onDropBall,
      onRollRailBall,
      onToggleChronometer,
      onResetChronometer,
      onSelectComponent: setSelectedComponentName,
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [ballsList]);

  // Update Camera Target on Preset Change
  useEffect(() => {
    if (!engineRef.current) return;
    const config = CAMERA_PRESETS[cameraPreset] || CAMERA_PRESETS.overview;
    engineRef.current.setCameraTarget(config.pos, config.target);
  }, [cameraPreset]);

  // Update Chronometer Display
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.chronometer.updateTime(state.chronometerTimeS);
  }, [state.chronometerTimeS]);

  const handleSetGizmoMode = (mode: KspGizmoMode) => {
    setActiveGizmoMode(mode);
    if (engineRef.current) engineRef.current.gizmo.setMode(mode);
  };

  const handleToggleSnap = () => {
    const next = !isSnapActive;
    setIsSnapActive(next);
    if (engineRef.current) engineRef.current.gizmo.snapEnabled = next;
  };

  const handleToggleAssembly = () => {
    if (!engineRef.current) return;
    if (isAssembled) {
      engineRef.current.packInBox();
      setIsAssembled(false);
    } else {
      engineRef.current.autoAssemble();
      setIsAssembled(true);
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* KSP Style Construction Mode Toolbar (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(6px)',
          zIndex: 10,
        }}
      >
        <button
          className={`btn-ksp-action ${activeGizmoMode === 'offset' ? 'primary' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={() => handleSetGizmoMode('offset')}
          title="Mover peça pelos eixos X, Y, Z (Atalho: 2 ou W)"
        >
          [2] Mover (Offset)
        </button>
        <button
          className={`btn-ksp-action ${activeGizmoMode === 'rotate' ? 'primary' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={() => handleSetGizmoMode('rotate')}
          title="Girar peça pelos anéis ortogonais (Atalho: 3 ou E)"
        >
          [3] Girar (Rotate)
        </button>
        <button
          className={`btn-ksp-action ${isSnapActive ? 'success' : ''}`}
          style={{ fontSize: 11, padding: '6px 10px' }}
          onClick={handleToggleSnap}
          title="Alternar Snap de 5° e 5mm (Atalho: C)"
        >
          [C] Snap: {isSnapActive ? '5° / 5mm' : 'Livre'}
        </button>
      </div>

      {/* Assembly Toggle Button (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <button
          className={`btn-ksp-action ${isAssembled ? 'primary' : 'success'}`}
          style={{ padding: '8px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
          onClick={handleToggleAssembly}
        >
          {isAssembled ? '📦 Guardar Tudo na Caixa' : '⚙️ Montar Experimento Automaticamente'}
        </button>
      </div>

      {/* Selected Piece Floating Indicator */}
      {selectedComponentName && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 16,
            background: 'rgba(30, 41, 59, 0.85)',
            color: '#f59e0b',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontFamily: 'monospace',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            zIndex: 10,
          }}
        >
          Selecionado: {selectedComponentName.replace('component_', '').toUpperCase()}
        </div>
      )}

      {/* Camera & Navigation Floating Hints (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          color: '#cbd5e1',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'monospace',
          display: 'flex',
          gap: 14,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <span><strong style={{ color: '#f59e0b' }}>Scroll (Click + Arrastar)</strong>: Pan / Mover Câmera</span>
        <span><strong style={{ color: '#f59e0b' }}>Rolar Scroll</strong>: Zoom Milimétrico</span>
        <span><strong style={{ color: '#f59e0b' }}>Botão Esquerdo</strong>: Órbita / Giro da Câmera</span>
        <span><strong style={{ color: '#f59e0b' }}>W / E / C / Esc</strong>: Modos do Gizmo</span>
      </div>
    </div>
  );
};
