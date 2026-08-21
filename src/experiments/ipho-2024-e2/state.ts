import { IPHO_2024_E2_CONFIG } from './config';
import { alignmentQuality } from './physics';

export interface Measurement {
  id: string;
  fringeIndex: number;
  angleDeg: number;
}

export interface IPhO2024E2State {
  kit: {
    lidOpen: boolean;
    fasteningRodsLoose: boolean[];
    platformPlaced: boolean;
    s1Removed: boolean;
  };
  apparatus: {
    s1Installed: boolean;
    screenPlaced: boolean;
    laserHeight: number;
    lensHeight: number;
    screenDistance: number;
    angleDeg: number;
  };
  electronics: {
    laserToBoard: boolean;
    boardToPower: boolean;
    switchOn: boolean;
  };
  measurements: Measurement[];
}

export type ExperimentAction =
  | { type: 'TOGGLE_KIT_LID' }
  | { type: 'LOOSEN_ROD'; index: number }
  | { type: 'PLACE_PLATFORM' }
  | { type: 'REMOVE_S1' }
  | { type: 'INSTALL_S1' }
  | { type: 'PLACE_SCREEN' }
  | { type: 'TOGGLE_LASER_CABLE' }
  | { type: 'TOGGLE_POWER_CABLE' }
  | { type: 'TOGGLE_LASER_SWITCH' }
  | { type: 'SET_LASER_HEIGHT'; value: number }
  | { type: 'SET_LENS_HEIGHT'; value: number }
  | { type: 'SET_SCREEN_DISTANCE'; value: number }
  | { type: 'SET_ANGLE'; value: number }
  | { type: 'ADD_MEASUREMENT'; measurement: Measurement }
  | { type: 'UPDATE_MEASUREMENT'; measurement: Measurement }
  | { type: 'DELETE_MEASUREMENT'; id: string }
  | { type: 'RESET' };

export function createInitialExperimentState(): IPhO2024E2State {
  return {
    kit: {
      lidOpen: false,
      fasteningRodsLoose: [false, false, false, false],
      platformPlaced: false,
      s1Removed: false,
    },
    apparatus: {
      s1Installed: false,
      screenPlaced: false,
      laserHeight: 0.31,
      lensHeight: 0.73,
      screenDistance: 0.84,
      angleDeg: 0,
    },
    electronics: {
      laserToBoard: false,
      boardToPower: false,
      switchOn: false,
    },
    measurements: [],
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function experimentReducer(
  state: IPhO2024E2State,
  action: ExperimentAction,
): IPhO2024E2State {
  switch (action.type) {
    case 'TOGGLE_KIT_LID':
      return { ...state, kit: { ...state.kit, lidOpen: !state.kit.lidOpen } };
    case 'LOOSEN_ROD': {
      if (!state.kit.lidOpen || state.kit.platformPlaced) return state;
      const rods = [...state.kit.fasteningRodsLoose];
      if (action.index < 0 || action.index >= rods.length) return state;
      rods[action.index] = true;
      return { ...state, kit: { ...state.kit, fasteningRodsLoose: rods } };
    }
    case 'PLACE_PLATFORM':
      if (!state.kit.fasteningRodsLoose.every(Boolean)) return state;
      return { ...state, kit: { ...state.kit, platformPlaced: true, lidOpen: true } };
    case 'REMOVE_S1':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, s1Removed: true } };
    case 'INSTALL_S1':
      if (!state.kit.platformPlaced || !state.kit.s1Removed) return state;
      return { ...state, apparatus: { ...state.apparatus, s1Installed: true } };
    case 'PLACE_SCREEN':
      if (!state.kit.lidOpen) return state;
      return { ...state, apparatus: { ...state.apparatus, screenPlaced: true } };
    case 'TOGGLE_LASER_CABLE':
      return {
        ...state,
        electronics: { ...state.electronics, laserToBoard: !state.electronics.laserToBoard },
      };
    case 'TOGGLE_POWER_CABLE':
      return {
        ...state,
        electronics: { ...state.electronics, boardToPower: !state.electronics.boardToPower },
      };
    case 'TOGGLE_LASER_SWITCH':
      return {
        ...state,
        electronics: { ...state.electronics, switchOn: !state.electronics.switchOn },
      };
    case 'SET_LASER_HEIGHT':
      return {
        ...state,
        apparatus: { ...state.apparatus, laserHeight: clamp(action.value, 0.18, 0.82) },
      };
    case 'SET_LENS_HEIGHT':
      return {
        ...state,
        apparatus: { ...state.apparatus, lensHeight: clamp(action.value, 0.18, 0.82) },
      };
    case 'SET_SCREEN_DISTANCE':
      return {
        ...state,
        apparatus: { ...state.apparatus, screenDistance: clamp(action.value, 0.55, 1.15) },
      };
    case 'SET_ANGLE':
      return {
        ...state,
        apparatus: {
          ...state.apparatus,
          angleDeg: clamp(action.value, 0, IPHO_2024_E2_CONFIG.maxAngleDeg),
        },
      };
    case 'ADD_MEASUREMENT':
      return { ...state, measurements: [...state.measurements, action.measurement] };
    case 'UPDATE_MEASUREMENT':
      return {
        ...state,
        measurements: state.measurements.map((row) =>
          row.id === action.measurement.id ? action.measurement : row,
        ),
      };
    case 'DELETE_MEASUREMENT':
      return { ...state, measurements: state.measurements.filter((row) => row.id !== action.id) };
    case 'RESET':
      return createInitialExperimentState();
    default:
      return state;
  }
}

export function isCircuitComplete(state: IPhO2024E2State): boolean {
  return state.electronics.laserToBoard && state.electronics.boardToPower;
}

export function isLaserEmitting(state: IPhO2024E2State): boolean {
  return isCircuitComplete(state) && state.electronics.switchOn;
}

export function canObservePattern(state: IPhO2024E2State): boolean {
  return (
    state.kit.platformPlaced &&
    state.apparatus.s1Installed &&
    state.apparatus.screenPlaced &&
    isLaserEmitting(state)
  );
}

export function patternVisibility(state: IPhO2024E2State): number {
  if (!canObservePattern(state)) return 0;
  return alignmentQuality(state.apparatus);
}
