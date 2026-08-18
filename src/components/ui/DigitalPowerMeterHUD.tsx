import React, { useState } from 'react';
import { Activity, RotateCcw, Power } from 'lucide-react';
import { OpticalTrainResult } from '../../physics/OpticalBenchSystem';

interface DigitalPowerMeterHUDProps {
  trainResult: OpticalTrainResult;
  isDetectorPresent: boolean;
  tareOffsetMw: number;
  onSetTareOffset: (offset: number) => void;
}

export const DigitalPowerMeterHUD: React.FC<DigitalPowerMeterHUDProps> = ({
  trainResult,
  isDetectorPresent,
  tareOffsetMw,
  onSetTareOffset
}) => {
  const [unitMode, setUnitMode] = useState<'mW' | 'uW' | 'Lux'>('uW');

  if (!isDetectorPresent) return null;

  const rawMw = trainResult.measuredPowerWithNoiseMw;

  let displayVal = '0.000';
  let displayUnit = 'µW';

  if (unitMode === 'uW') {
    const val = rawMw * 1000.0;
    displayVal = val >= 0 ? val.toFixed(1) : (0.0).toFixed(1);
    displayUnit = 'µW';
  } else if (unitMode === 'mW') {
    displayVal = rawMw.toFixed(4);
    displayUnit = 'mW';
  } else {
    displayVal = trainResult.measuredLux.toFixed(1);
    displayUnit = 'Lux';
  }

  const handleTare = () => {
    // Zero tare current reading
    onSetTareOffset(tareOffsetMw + rawMw);
  };

  const handleResetTare = () => {
    onSetTareOffset(0);
  };

  return (
    <div className="digital-meter-hud hud-interactive">
      <div className="meter-header">
        <div className="meter-title">
          <Activity size={13} color="#34d399" />
          <span>FOTÔMETRO DIGITAL PM100</span>
        </div>
        <div className="meter-status-dot" title="Sensor Operacional" />
      </div>

      <div className="meter-lcd-screen">
        <div className="lcd-readout-row">
          <span className="lcd-value">{displayVal}</span>
          <span className="lcd-unit">{displayUnit}</span>
        </div>
        <div className="lcd-subinfo">
          <span>ADC: 16-BIT LOW NOISE</span>
          <span>TARE: {tareOffsetMw !== 0 ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      <div className="meter-controls">
        <button
          className="btn-meter-action"
          onClick={() => {
            const next = unitMode === 'uW' ? 'mW' : unitMode === 'mW' ? 'Lux' : 'uW';
            setUnitMode(next);
          }}
        >
          UNIDADE: {unitMode}
        </button>

        <button className="btn-meter-action" onClick={handleTare} title="Zerar leitura no escuro">
          ZERO / TARA
        </button>
      </div>
    </div>
  );
};
