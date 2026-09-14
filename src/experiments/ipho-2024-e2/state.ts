import { IPHO_2024_E2_CONFIG } from './config';
import { alignmentQuality } from './physics';

export interface Measurement {
  id: string;
  fringeIndex: number;
  angleDeg: number;
  part?: 'A' | 'B' | 'C' | 'D';
}

export interface ItemPositions {
  kit: [number, number];
  platform: [number, number];
  screen: [number, number];
  electronics: [number, number];
  powerBank: [number, number];
  bottle: [number, number];
  paper: [number, number];
  s1?: [number, number];
  s2?: [number, number];
  cuvette?: [number, number];
}

export type AssemblyMode = 'guided' | 'realistic' | 'skip';

export interface IPhO2024E2State {
  assemblyMode: AssemblyMode;
  kit: {
    location: 'bench' | 'floor';
    lidOpen: boolean;
    fasteningRodsLoose: boolean[];
    redOringsRemoved: boolean;
    platformPlaced: boolean;
    s1Removed: boolean;
    s2Removed: boolean;
    cuvetteRemoved: boolean;
    bottleRemoved: boolean;
    screenRemoved: boolean;
    electronicsRemoved: boolean;
    powerBankRemoved: boolean;
  };
  positions: ItemPositions;
  apparatus: {
    installedHolder: 'none' | 's1' | 's2';
    s1Installed: boolean; // Mantido para retrocompatibilidade
    s2Installed: boolean;
    cuvettePeeled: boolean;
    cuvettePlaced: boolean;
    liquidPoured: boolean;
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
    laserCurrentMa: number; // Padrão 15.0 mA, ajustável via knob de corrente
  };
  activePart: 'A' | 'B' | 'C' | 'D';
  measurements: Measurement[];
}

export type ExperimentAction =
  | { type: 'TOGGLE_KIT_LID' }
  | { type: 'TOGGLE_KIT_LOCATION' }
  | { type: 'SET_KIT_LOCATION'; location: 'bench' | 'floor' }
  | { type: 'SET_ITEM_POSITION'; id: keyof ItemPositions; x: number; z: number }
  | { type: 'LOOSEN_ROD'; index: number }
  | { type: 'REMOVE_ORINGS' }
  | { type: 'PLACE_PLATFORM' }
  | { type: 'REMOVE_S1' }
  | { type: 'INSTALL_S1' }
  | { type: 'REMOVE_S2' }
  | { type: 'INSTALL_S2' }
  | { type: 'UNINSTALL_HOLDER' }
  | { type: 'PEEL_CUVETTE' }
  | { type: 'PLACE_CUVETTE' }
  | { type: 'REMOVE_CUVETTE' }
  | { type: 'POUR_LIQUID' }
  | { type: 'PLACE_SCREEN' }
  | { type: 'REMOVE_SCREEN' }
  | { type: 'REMOVE_ELECTRONICS' }
  | { type: 'REMOVE_POWER_BANK' }
  | { type: 'REMOVE_BOTTLE' }
  | { type: 'EXTRACT_ITEM'; item: 'platform' | 's1' | 's2' | 'cuvette' | 'bottle' | 'screen' | 'electronics' | 'power-bank' }
  | { type: 'STORE_ITEM'; item: 'platform' | 's1' | 's2' | 'cuvette' | 'bottle' | 'screen' | 'electronics' | 'power-bank' }
  | { type: 'TOGGLE_LASER_CABLE' }
  | { type: 'TOGGLE_POWER_CABLE' }
  | { type: 'TOGGLE_LASER_SWITCH' }
  | { type: 'SET_LASER_CURRENT'; value: number }
  | { type: 'SET_LASER_HEIGHT'; value: number }
  | { type: 'SET_LENS_HEIGHT'; value: number }
  | { type: 'SET_SCREEN_DISTANCE'; value: number }
  | { type: 'SET_ANGLE'; value: number }
  | { type: 'SET_ASSEMBLY_MODE'; mode: AssemblyMode }
  | { type: 'SKIP_ASSEMBLY'; part?: 'A' | 'B' | 'C' | 'D' }
  | { type: 'SET_ACTIVE_PART'; part: 'A' | 'B' | 'C' | 'D' }
  | { type: 'ADD_MEASUREMENT'; measurement: Measurement }
  | { type: 'UPDATE_MEASUREMENT'; measurement: Measurement }
  | { type: 'DELETE_MEASUREMENT'; id: string }
  | { type: 'RESET' };

export const DEFAULT_ITEM_POSITIONS: ItemPositions = {
  kit: [-1.85, 0.15],
  platform: [0.05, -0.08],
  screen: [1.34, 0.0],
  electronics: [-0.08, 0.82],
  powerBank: [0.55, 0.82],
  bottle: [-1.05, 0.82],
  paper: [1.4, 0.78],
  s1: [0.90, 0.35],
  s2: [0.90, 0.65],
  cuvette: [0.50, 0.35],
};

export function configureForPart(state: IPhO2024E2State, part: 'A' | 'B' | 'C' | 'D'): IPhO2024E2State {
  const isS1Part = part === 'A' || part === 'D';
  const isS2Part = part === 'B' || part === 'C';
  const hasCuvette = part === 'C' || part === 'D';

  return {
    ...state,
    kit: {
      ...state.kit,
      location: 'bench',
      lidOpen: true,
      fasteningRodsLoose: [true, true, true, true],
      redOringsRemoved: true,
      platformPlaced: true,
      s1Removed: isS1Part,
      s2Removed: isS2Part,
      cuvetteRemoved: hasCuvette,
      bottleRemoved: hasCuvette,
      screenRemoved: true,
      electronicsRemoved: true,
      powerBankRemoved: true,
    },
    positions: {
      ...state.positions,
      kit: DEFAULT_ITEM_POSITIONS.kit,
      platform: DEFAULT_ITEM_POSITIONS.platform,
      screen: DEFAULT_ITEM_POSITIONS.screen,
      electronics: DEFAULT_ITEM_POSITIONS.electronics,
      powerBank: DEFAULT_ITEM_POSITIONS.powerBank,
      bottle: DEFAULT_ITEM_POSITIONS.bottle,
      paper: DEFAULT_ITEM_POSITIONS.paper,
      s1: DEFAULT_ITEM_POSITIONS.s1,
      s2: DEFAULT_ITEM_POSITIONS.s2,
      cuvette: DEFAULT_ITEM_POSITIONS.cuvette,
    },
    apparatus: {
      ...state.apparatus,
      installedHolder: isS1Part ? 's1' : 's2',
      s1Installed: isS1Part,
      s2Installed: isS2Part,
      cuvettePeeled: hasCuvette,
      cuvettePlaced: hasCuvette,
      liquidPoured: hasCuvette,
      screenPlaced: true,
      laserHeight: 0.35,
      lensHeight: 0.35,
      angleDeg: 0,
    },
    electronics: {
      ...state.electronics,
      laserToBoard: true,
      boardToPower: true,
      switchOn: true,
      laserCurrentMa: 15.0,
    },
  };
}

export function createInitialExperimentState(): IPhO2024E2State {
  return {
    assemblyMode: 'guided',
    kit: {
      location: 'bench',
      lidOpen: false,
      fasteningRodsLoose: [false, false, false, false],
      redOringsRemoved: false,
      platformPlaced: false,
      s1Removed: false,
      s2Removed: false,
      cuvetteRemoved: false,
      bottleRemoved: false,
      screenRemoved: false,
      electronicsRemoved: false,
      powerBankRemoved: false,
    },
    positions: { ...DEFAULT_ITEM_POSITIONS },
    apparatus: {
      installedHolder: 'none',
      s1Installed: false,
      s2Installed: false,
      cuvettePeeled: false,
      cuvettePlaced: false,
      liquidPoured: false,
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
      laserCurrentMa: 15.0,
    },
    activePart: 'A',
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
    case 'TOGGLE_KIT_LOCATION': {
      const nextLocation = state.kit.location === 'bench' ? 'floor' : 'bench';
      const defaultPos: [number, number] = nextLocation === 'floor' ? [-2.2, 0.95] : [-1.85, 0.15];
      return {
        ...state,
        kit: { ...state.kit, location: nextLocation },
        positions: { ...state.positions, kit: defaultPos },
      };
    }
    case 'SET_KIT_LOCATION': {
      const defaultPos: [number, number] = action.location === 'floor' ? [-2.2, 0.95] : [-1.85, 0.15];
      return {
        ...state,
        kit: { ...state.kit, location: action.location },
        positions: { ...state.positions, kit: defaultPos },
      };
    }
    case 'SET_ITEM_POSITION': {
      const x = clamp(action.x, -2.85, 2.85);
      const z = clamp(action.z, -1.45, 1.45);
      let apparatus = state.apparatus;
      if (action.id === 'screen') {
        const platformX = state.positions.platform[0];
        const screenDistance = clamp(x - (platformX + 0.50), 0.55, 1.15);
        apparatus = { ...apparatus, screenDistance };
      }
      return {
        ...state,
        positions: {
          ...state.positions,
          [action.id]: [x, z],
        },
        apparatus,
      };
    }
    case 'REMOVE_SCREEN':
      if (!state.kit.lidOpen) return state;
      return {
        ...state,
        kit: { ...state.kit, screenRemoved: true },
        apparatus: { ...state.apparatus, screenPlaced: true },
      };
    case 'REMOVE_ELECTRONICS':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, electronicsRemoved: true } };
    case 'REMOVE_POWER_BANK':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, powerBankRemoved: true } };
    case 'REMOVE_BOTTLE':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, bottleRemoved: true } };
    case 'EXTRACT_ITEM': {
      if (!state.kit.lidOpen) return state;
      switch (action.item) {
        case 'platform':
          if (!state.kit.fasteningRodsLoose.every(Boolean)) return state;
          if (state.assemblyMode === 'realistic' && !state.kit.redOringsRemoved) return state;
          return { ...state, kit: { ...state.kit, platformPlaced: true } };
        case 's1':
          return { ...state, kit: { ...state.kit, s1Removed: true } };
        case 's2':
          return { ...state, kit: { ...state.kit, s2Removed: true } };
        case 'cuvette':
          return { ...state, kit: { ...state.kit, cuvetteRemoved: true } };
        case 'bottle':
          return { ...state, kit: { ...state.kit, bottleRemoved: true } };
        case 'screen':
          return { ...state, kit: { ...state.kit, screenRemoved: true }, apparatus: { ...state.apparatus, screenPlaced: true } };
        case 'electronics':
          return { ...state, kit: { ...state.kit, electronicsRemoved: true } };
        case 'power-bank':
          return { ...state, kit: { ...state.kit, powerBankRemoved: true } };
        default:
          return state;
      }
    }
    case 'STORE_ITEM': {
      if (!state.kit.lidOpen) return state;
      switch (action.item) {
        case 's1':
          if (state.apparatus.installedHolder === 's1') return state;
          return { ...state, kit: { ...state.kit, s1Removed: false } };
        case 's2':
          if (state.apparatus.installedHolder === 's2') return state;
          return { ...state, kit: { ...state.kit, s2Removed: false } };
        case 'cuvette':
          if (state.apparatus.cuvettePlaced) return state;
          return { ...state, kit: { ...state.kit, cuvetteRemoved: false } };
        case 'bottle':
          return { ...state, kit: { ...state.kit, bottleRemoved: false } };
        case 'screen':
          return { ...state, kit: { ...state.kit, screenRemoved: false }, apparatus: { ...state.apparatus, screenPlaced: false } };
        case 'electronics':
          return { ...state, kit: { ...state.kit, electronicsRemoved: false } };
        case 'power-bank':
          return { ...state, kit: { ...state.kit, powerBankRemoved: false } };
        case 'platform':
          if (state.apparatus.installedHolder !== 'none' || state.apparatus.cuvettePlaced) return state;
          return { ...state, kit: { ...state.kit, platformPlaced: false } };
        default:
          return state;
      }
    }
    case 'LOOSEN_ROD': {
      if (!state.kit.lidOpen || state.kit.platformPlaced) return state;
      const rods = [...state.kit.fasteningRodsLoose];
      if (action.index < 0 || action.index >= rods.length) return state;
      rods[action.index] = true;
      return { ...state, kit: { ...state.kit, fasteningRodsLoose: rods } };
    }
    case 'REMOVE_ORINGS':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, redOringsRemoved: true } };
    case 'PLACE_PLATFORM':
      if (!state.kit.fasteningRodsLoose.every(Boolean)) return state;
      if (state.assemblyMode === 'realistic' && !state.kit.redOringsRemoved) return state;
      return { ...state, kit: { ...state.kit, platformPlaced: true, lidOpen: true } };
    case 'REMOVE_S1':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, s1Removed: true } };
    case 'INSTALL_S1':
      if (!state.kit.platformPlaced || !state.kit.s1Removed) return state;
      if (state.assemblyMode === 'realistic' && state.apparatus.installedHolder !== 'none') return state;
      if (state.assemblyMode === 'realistic' && !state.kit.redOringsRemoved) return state;
      return {
        ...state,
        apparatus: {
          ...state.apparatus,
          installedHolder: 's1',
          s1Installed: true,
          s2Installed: false,
        },
      };
    case 'REMOVE_S2':
      if (!state.kit.lidOpen) return state;
      return { ...state, kit: { ...state.kit, s2Removed: true } };
    case 'INSTALL_S2':
      if (!state.kit.platformPlaced || !state.kit.s2Removed) return state;
      if (state.assemblyMode === 'realistic' && state.apparatus.installedHolder !== 'none') return state;
      if (state.assemblyMode === 'realistic' && !state.kit.redOringsRemoved) return state;
      return {
        ...state,
        apparatus: {
          ...state.apparatus,
          installedHolder: 's2',
          s1Installed: false,
          s2Installed: true,
        },
      };
    case 'UNINSTALL_HOLDER':
      return {
        ...state,
        apparatus: {
          ...state.apparatus,
          installedHolder: 'none',
          s1Installed: false,
          s2Installed: false,
        },
      };
    case 'PEEL_CUVETTE':
      return { ...state, apparatus: { ...state.apparatus, cuvettePeeled: true } };
    case 'PLACE_CUVETTE':
      if (!state.kit.platformPlaced) return state;
      if (state.assemblyMode === 'realistic' && (!state.kit.cuvetteRemoved || !state.apparatus.cuvettePeeled)) {
        return state;
      }
      return { ...state, apparatus: { ...state.apparatus, cuvettePlaced: true, cuvettePeeled: true } };
    case 'REMOVE_CUVETTE':
      return { ...state, apparatus: { ...state.apparatus, cuvettePlaced: false } };
    case 'POUR_LIQUID':
      if (
        state.assemblyMode === 'realistic' &&
        (!state.kit.bottleRemoved || !state.apparatus.cuvettePlaced || !state.apparatus.cuvettePeeled)
      ) {
        return state;
      }
      return { ...state, apparatus: { ...state.apparatus, liquidPoured: true } };
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
      if (state.assemblyMode === 'realistic' && !state.electronics.switchOn && (!state.electronics.laserToBoard || !state.electronics.boardToPower)) {
        return state;
      }
      return {
        ...state,
        electronics: { ...state.electronics, switchOn: !state.electronics.switchOn },
      };
    case 'SET_LASER_CURRENT':
      return {
        ...state,
        electronics: { ...state.electronics, laserCurrentMa: clamp(action.value, 0, 25.0) },
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
    case 'SET_SCREEN_DISTANCE': {
      const screenDistance = clamp(action.value, 0.55, 1.15);
      const platformX = state.positions.platform[0];
      const screenX = clamp(platformX + 0.50 + screenDistance, -2.85, 2.85);
      return {
        ...state,
        apparatus: { ...state.apparatus, screenDistance },
        positions: {
          ...state.positions,
          screen: [screenX, state.positions.screen[1]],
        },
      };
    }
    case 'SET_ANGLE':
      return {
        ...state,
        apparatus: {
          ...state.apparatus,
          angleDeg: clamp(action.value, 0, IPHO_2024_E2_CONFIG.maxAngleDeg),
        },
      };
    case 'SET_ASSEMBLY_MODE': {
      if (action.mode === 'skip') {
        const configured = configureForPart(state, state.activePart);
        return { ...configured, assemblyMode: 'skip' };
      }
      return { ...state, assemblyMode: action.mode };
    }
    case 'SKIP_ASSEMBLY': {
      const targetPart = action.part ?? state.activePart;
      const configured = configureForPart(state, targetPart);
      return { ...configured, activePart: targetPart };
    }
    case 'SET_ACTIVE_PART': {
      if (state.assemblyMode === 'skip') {
        const configured = configureForPart(state, action.part);
        return { ...configured, activePart: action.part };
      }
      return { ...state, activePart: action.part };
    }
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
  return isCircuitComplete(state) && state.electronics.switchOn && state.electronics.laserCurrentMa > 1.0;
}

export function canObservePattern(state: IPhO2024E2State): boolean {
  const hasHolder = state.apparatus.s1Installed || state.apparatus.installedHolder !== 'none';
  return (
    state.kit.platformPlaced &&
    hasHolder &&
    state.apparatus.screenPlaced &&
    isLaserEmitting(state)
  );
}

export function patternVisibility(state: IPhO2024E2State): number {
  if (!canObservePattern(state)) return 0;
  const currentRatio = Math.max(0, Math.min(1.5, state.electronics.laserCurrentMa / 15.0));
  return alignmentQuality(state.apparatus) * currentRatio;
}
