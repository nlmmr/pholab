import React, { useEffect, useRef } from 'react';
import { ExperimentAction, IPhO2024E2State } from '../state';
import { FocusTarget, InteractionId, IPhO2024E2Engine, CameraCalibration } from '../scene/IPhO2024E2Engine';

interface ExperimentSceneProps {
  state: IPhO2024E2State;
  selected: InteractionId | null;
  onSelect: (id: InteractionId | null) => void;
  dispatch: React.Dispatch<ExperimentAction>;
  focusRequest: FocusTarget;
  onFocusChange?: (target: FocusTarget) => void;
  timeStr?: string;
  timerRunning?: boolean;
  onCalibrationChange?: (calibration: CameraCalibration) => void;
}

export const ExperimentScene: React.FC<ExperimentSceneProps> = ({
  state,
  onSelect,
  dispatch,
  focusRequest,
  onFocusChange,
  timeStr,
  timerRunning,
  onCalibrationChange,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<IPhO2024E2Engine | null>(null);
  const stateRef = useRef(state);
  const selectRef = useRef(onSelect);
  const dispatchRef = useRef(dispatch);
  const focusChangeRef = useRef(onFocusChange);
  const calibrationChangeRef = useRef(onCalibrationChange);
  stateRef.current = state;
  selectRef.current = onSelect;
  dispatchRef.current = dispatch;
  focusChangeRef.current = onFocusChange;
  calibrationChangeRef.current = onCalibrationChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new IPhO2024E2Engine(hostRef.current, {
      onSelect: (id) => selectRef.current(id),
      onLoosenRod: (index) => dispatchRef.current({ type: 'LOOSEN_ROD', index }),
      onToggleLaserSwitch: () => dispatchRef.current({ type: 'TOGGLE_LASER_SWITCH' }),
      onSetAngle: (value) => dispatchRef.current({ type: 'SET_ANGLE', value }),
      onSetLaserHeight: (value) => dispatchRef.current({ type: 'SET_LASER_HEIGHT', value }),
      onSetLensHeight: (value) => dispatchRef.current({ type: 'SET_LENS_HEIGHT', value }),
      onSetLaserCurrent: (value) => dispatchRef.current({ type: 'SET_LASER_CURRENT', value }),
      onRemoveOrings: () => dispatchRef.current({ type: 'REMOVE_ORINGS' }),
      onPeelCuvette: () => dispatchRef.current({ type: 'PEEL_CUVETTE' }),
      onPourLiquid: () => dispatchRef.current({ type: 'POUR_LIQUID' }),
      onSetItemPosition: (id, x, z) => dispatchRef.current({ type: 'SET_ITEM_POSITION', id: id as any, x, z }),
      onFocusChange: (target) => focusChangeRef.current?.(target),
      onInstallS1: () => dispatchRef.current({ type: 'INSTALL_S1' }),
      onInstallS2: () => dispatchRef.current({ type: 'INSTALL_S2' }),
      onPlaceCuvette: () => dispatchRef.current({ type: 'PLACE_CUVETTE' }),
      onExtractItem: (item) => dispatchRef.current({ type: 'EXTRACT_ITEM', item }),
      onStoreItem: (item) => dispatchRef.current({ type: 'STORE_ITEM', item }),
      onCalibrationChange: (calib) => calibrationChangeRef.current?.(calib),
    });
    engine.sync(stateRef.current);
    calibrationChangeRef.current?.(engine.getCameraCalibration());
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.sync(state), [state]);
  useEffect(() => engineRef.current?.focus(focusRequest), [focusRequest]);
  useEffect(() => {
    if (timeStr !== undefined && timerRunning !== undefined) {
      engineRef.current?.updateClock(timeStr, timerRunning);
    }
  }, [timeStr, timerRunning]);

  return <div className="experiment-canvas" ref={hostRef} />;
};
