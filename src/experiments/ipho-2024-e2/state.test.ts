import { describe, expect, it } from 'vitest';
import {
  createInitialExperimentState,
  experimentReducer,
  isCircuitComplete,
  isLaserEmitting,
} from './state';

describe('IPhO 2024 E2 experiment state', () => {
  it('is deterministic and returns independent initial states', () => {
    const first = createInitialExperimentState();
    const second = createInitialExperimentState();
    expect(first).toEqual(second);
    first.kit.fasteningRodsLoose[0] = true;
    expect(second.kit.fasteningRodsLoose[0]).toBe(false);
  });

  it('does not emit laser light through an incomplete circuit', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    expect(isLaserEmitting(state)).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
    expect(isLaserEmitting(state)).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
    expect(isCircuitComplete(state)).toBe(true);
    expect(isLaserEmitting(state)).toBe(true);
  });

  it('requires all four fastening rods before moving the platform', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 0 });
    expect(experimentReducer(state, { type: 'PLACE_PLATFORM' }).kit.platformPlaced).toBe(false);
    for (const index of [1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    expect(experimentReducer(state, { type: 'PLACE_PLATFORM' }).kit.platformPlaced).toBe(true);
  });

  it('only snaps S1 into a valid prepared stage', () => {
    let state = createInitialExperimentState();
    expect(experimentReducer(state, { type: 'INSTALL_S1' }).apparatus.s1Installed).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'REMOVE_S1' });
    expect(experimentReducer(state, { type: 'INSTALL_S1' }).apparatus.s1Installed).toBe(false);
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    state = experimentReducer(state, { type: 'INSTALL_S1' });
    expect(state.apparatus.s1Installed).toBe(true);
  });

  it('stores participant-entered measurements without correcting them', () => {
    const initial = createInitialExperimentState();
    const measurement = { id: 'row-1', fringeIndex: 7, angleDeg: 23.4 };
    const state = experimentReducer(initial, { type: 'ADD_MEASUREMENT', measurement });
    expect(state.measurements).toEqual([measurement]);
  });
});
