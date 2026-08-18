import React, { useState } from 'react';
import {
  Compass,
  Eye,
  Package,
  Layers,
  CircleDot,
  Power,
  RotateCcw,
  Download,
  Upload,
  BookOpen,
  Hash,
  Sparkles
} from '../icons/Icons';
import { CameraPreset } from '../3d/LabScene';
import { LaserConfig } from '../../physics/types';

interface LabHUDProps {
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  examSeed: string;
  onChangeSeed: (newSeed: string) => void;
  laser: LaserConfig;
  isLaserOn: boolean;
  onToggleLaserPower: () => void;
  onResetRailPositions: () => void;
  onOpenTaskDrawer: () => void;
  onExportState: () => void;
  onImportState: (jsonData: string) => void;
}

export const LabHUD: React.FC<LabHUDProps> = ({
  cameraPreset,
  onSelectCameraPreset,
  examSeed,
  onChangeSeed,
  laser,
  isLaserOn,
  onToggleLaserPower,
  onResetRailPositions,
  onOpenTaskDrawer,
  onExportState,
  onImportState
}) => {
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedInput, setSeedInput] = useState(examSeed);

  const handleSeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (seedInput.trim()) {
      onChangeSeed(seedInput.trim().toUpperCase());
      setShowSeedModal(false);
    }
  };

  return (
    <>
      {/* Floating Camera Presets Toolbar */}
      <div className="camera-toolbar hud-interactive">
        <span className="toolbar-label">CÂMERAS FOCAIS</span>
        <button
          className={`btn-cam-preset ${cameraPreset === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('overview')}
          title="Visão Geral da Bancada de Laboratório"
        >
          <Compass size={14} />
          <span>Bancada Geral</span>
        </button>
        <button
          className={`btn-cam-preset ${cameraPreset === 'beam_level' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('beam_level')}
          title="Agachar na altura do feixe óptico (alinhamento)"
        >
          <Eye size={14} />
          <span>Nível do Feixe (Agachar)</span>
        </button>
        <button
          className={`btn-cam-preset ${cameraPreset === 'kitbox' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('kitbox')}
          title="Caixa do Kit Experimental (Unboxing)"
        >
          <Package size={14} />
          <span>Caixa do Kit</span>
        </button>
        <button
          className={`btn-cam-preset ${cameraPreset === 'rail_center' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('rail_center')}
          title="Centro do Trilho Óptico e Escala Métrica"
        >
          <Layers size={14} />
          <span>Trilho Óptico</span>
        </button>
        <button
          className={`btn-cam-preset ${cameraPreset === 'micrometer' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('micrometer')}
          title="Zoom de Alta Resolução no Micrômetro Transversal"
        >
          <CircleDot size={14} />
          <span>Micrômetro</span>
        </button>
        <button
          className={`btn-cam-preset ${cameraPreset === 'screen' ? 'active' : ''}`}
          onClick={() => onSelectCameraPreset('screen')}
          title="Zoom no Anteparo Milimetrado e Franjas"
        >
          <Layers size={14} />
          <span>Anteparo</span>
        </button>
      </div>

      {/* Bottom Quick Actions Dock */}
      <div className="bottom-dock hud-interactive">
        <button
          className={`btn-dock ${isLaserOn ? 'primary' : ''}`}
          onClick={onToggleLaserPower}
          title="Ligar ou Desligar Emissor Laser"
        >
          <Power size={14} color={isLaserOn ? '#ffffff' : '#ef4444'} />
          <span>{isLaserOn ? 'Laser: LIGADO (532nm)' : 'Laser: DESLIGADO'}</span>
        </button>

        <button
          className="btn-dock"
          onClick={onResetRailPositions}
          title="Recolocar peças em alinhamento padrão"
        >
          <RotateCcw size={14} />
          <span>Realinhar Trilho</span>
        </button>

        <button
          className="btn-dock"
          onClick={onOpenTaskDrawer}
          title="Abrir Caderno de Prova IPhO e Instruções"
          style={{ borderColor: 'rgba(59, 130, 246, 0.5)' }}
        >
          <BookOpen size={14} color="#60a5fa" />
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>Caderno de Questões</span>
        </button>

        <button
          className="btn-dock"
          onClick={onExportState}
          title="Exportar arquivo de progresso do laboratório (.phostate)"
        >
          <Download size={14} />
          <span>Salvar (.phostate)</span>
        </button>
      </div>

      {/* Seed Modal */}
      {showSeedModal && (
        <div className="modal-backdrop hud-interactive" onClick={() => setShowSeedModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Semente de Exame Determinística</h3>
            </div>
            <form onSubmit={handleSeedSubmit}>
              <div className="modal-body">
                <p>
                  A semente (Exam Seed) define deterministicamente as grandezas ocultas da sua prova (como o passo exato da rede de difração e o comprimento de onda do laser) bem como os pequenos ruídos de calibração.
                </p>
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    CÓDIGO DA SEMENTE:
                  </label>
                  <input
                    type="text"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      color: '#fbbf24',
                      fontFamily: 'monospace',
                      fontSize: 15,
                      fontWeight: 'bold',
                      marginTop: 6
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-meter-action"
                  onClick={() => setShowSeedModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dock primary"
                  style={{ padding: '6px 14px', borderRadius: 6 }}
                >
                  Aplicar Semente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
