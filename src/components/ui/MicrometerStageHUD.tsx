import React from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Crosshair } from 'lucide-react';

interface MicrometerStageHUDProps {
  transversePosMm: number;
  onStepMicrometer: (deltaMm: number) => void;
  onResetCenter: () => void;
  isDetectorPresent: boolean;
}

export const MicrometerStageHUD: React.FC<MicrometerStageHUDProps> = ({
  transversePosMm,
  onStepMicrometer,
  onResetCenter,
  isDetectorPresent
}) => {
  if (!isDetectorPresent) return null;

  return (
    <div className="micrometer-hud hud-interactive">
      <div className="micrometer-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Crosshair size={14} color="#f59e0b" />
          ESTÁGIO MICROMÉTRICO (X)
        </span>
        <button
          onClick={onResetCenter}
          style={{
            fontSize: 10,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Centralizar (x = 0)
        </button>
      </div>

      <div className="micrometer-stepper">
        <button
          className="btn-micro-step"
          onClick={() => onStepMicrometer(-1.0)}
          title="Mover -1.00 mm (Giro Rápido)"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          className="btn-micro-step"
          onClick={() => onStepMicrometer(-0.1)}
          title="Mover -0.10 mm"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn-micro-step"
          style={{ fontSize: 11, width: 44, color: '#38bdf8' }}
          onClick={() => onStepMicrometer(-0.01)}
          title="Mover -0.01 mm (Vernier Fino)"
        >
          -0.01
        </button>

        <div className="micrometer-readout-pill">
          {`${transversePosMm >= 0 ? '+' : ''}${transversePosMm.toFixed(2)} mm`}
        </div>

        <button
          className="btn-micro-step"
          style={{ fontSize: 11, width: 44, color: '#38bdf8' }}
          onClick={() => onStepMicrometer(0.01)}
          title="Mover +0.01 mm (Vernier Fino)"
        >
          +0.01
        </button>
        <button
          className="btn-micro-step"
          onClick={() => onStepMicrometer(0.1)}
          title="Mover +0.10 mm"
        >
          <ChevronRight size={16} />
        </button>
        <button
          className="btn-micro-step"
          onClick={() => onStepMicrometer(1.0)}
          title="Mover +1.00 mm (Giro Rápido)"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};
