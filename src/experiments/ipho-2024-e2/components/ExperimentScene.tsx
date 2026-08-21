import React, { useEffect, useRef } from 'react';
import { ExperimentAction, IPhO2024E2State } from '../state';
import { FocusTarget, InteractionId, IPhO2024E2Engine } from '../scene/IPhO2024E2Engine';

interface ExperimentSceneProps {
  state: IPhO2024E2State;
  selected: InteractionId | null;
  onSelect: (id: InteractionId | null) => void;
  dispatch: React.Dispatch<ExperimentAction>;
  focusRequest: FocusTarget;
}

export const ExperimentScene: React.FC<ExperimentSceneProps> = ({ state, onSelect, dispatch, focusRequest }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<IPhO2024E2Engine | null>(null);
  const stateRef = useRef(state);
  const selectRef = useRef(onSelect);
  const dispatchRef = useRef(dispatch);
  stateRef.current = state;
  selectRef.current = onSelect;
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new IPhO2024E2Engine(hostRef.current, {
      onSelect: (id) => selectRef.current(id),
      onLoosenRod: (index) => dispatchRef.current({ type: 'LOOSEN_ROD', index }),
      onToggleLaserSwitch: () => dispatchRef.current({ type: 'TOGGLE_LASER_SWITCH' }),
      onSetAngle: (value) => dispatchRef.current({ type: 'SET_ANGLE', value }),
      onSetLaserHeight: (value) => dispatchRef.current({ type: 'SET_LASER_HEIGHT', value }),
      onSetLensHeight: (value) => dispatchRef.current({ type: 'SET_LENS_HEIGHT', value }),
    });
    engine.sync(stateRef.current);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.sync(state), [state]);
  useEffect(() => engineRef.current?.focus(focusRequest), [focusRequest]);

  return <div className="experiment-canvas" ref={hostRef} />;
};
