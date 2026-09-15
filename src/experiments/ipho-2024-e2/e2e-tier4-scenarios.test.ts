import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createInitialExperimentState,
  experimentReducer,
  configureForPart,
  IPhO2024E2State,
} from './state';
import {
  phaseDifference,
  phaseAtNormalIncidence,
  fringeShiftCount,
  alignmentQuality,
  resolvePhaseParameters,
} from './physics';
import { IPHO_2024_E2_CONFIG } from './config';

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (PARTS A, B, C, D)
// ============================================================================

describe('Tier 4: Real-World Application Scenarios (IPhO 2024 E2 Competition Protocols)', () => {

  // ==========================================================================
  // SCENARIO A: PART A - SINGLE SLIT DIFFRACTION SETUP & ALIGNMENT
  // ==========================================================================
  describe('Scenario A: Part A - Single Slit Diffraction Setup Walkthrough', () => {
    it('executes the full realistic unboxing, mounting, and laser alignment protocol for Part A', () => {
      let state = createInitialExperimentState();
      state = { ...state, assemblyMode: 'realistic' };

      // 1. Initial State: Kit closed on bench, nothing extracted
      expect(state.kit.lidOpen).toBe(false);
      expect(state.kit.platformPlaced).toBe(false);

      // 2. Open kit lid
      state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
      expect(state.kit.lidOpen).toBe(true);

      // 3. Attempting extraction before unscrewing rods fails
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);

      // 4. Unscrew all 4 fastener rods
      for (let i = 0; i < 4; i++) {
        state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      }
      expect(state.kit.fasteningRodsLoose.every(Boolean)).toBe(true);

      // 5. Attempting extraction before removing O-rings still fails
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);

      // 6. Remove both red transport O-rings
      state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
      expect(state.kit.redOringsRemoved).toBe(true);

      // 7. Extract optical platform onto bench
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(true);

      // 8. Extract electronics box and power bank
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'electronics' });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'power-bank' });
      expect(state.kit.electronicsRemoved).toBe(true);
      expect(state.kit.powerBankRemoved).toBe(true);

      // 9. Connect cables
      state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
      state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
      expect(state.electronics.laserToBoard).toBe(true);
      expect(state.electronics.boardToPower).toBe(true);

      // 10. Turn on rocker switch, current defaults to 15.0 mA
      state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
      expect(state.electronics.switchOn).toBe(true);
      expect(state.electronics.laserCurrentMa).toBe(15.0);

      // 11. Extract thin slide S1 holder and mount on platform center socket
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 's1' });
      expect(state.kit.s1Removed).toBe(true);
      state = experimentReducer(state, { type: 'INSTALL_S1' });
      expect(state.apparatus.installedHolder).toBe('s1');

      // 12. Extract and position observation screen at 0.84 m
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'screen' });
      state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.84 });
      expect(state.apparatus.screenPlaced).toBe(true);
      expect(state.apparatus.screenDistance).toBeCloseTo(0.84, 2);

      // 13. Align laser and lens carriages: 0.56m target height
      state = experimentReducer(state, { type: 'SET_LASER_HEIGHT', value: 0.56 });
      state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.56 });
      const quality = alignmentQuality({
        laserHeight: state.apparatus.laserHeight,
        lensHeight: state.apparatus.lensHeight,
        screenDistance: state.apparatus.screenDistance,
      });
      expect(quality).toBeCloseTo(1.0, 3);

      // 14. Record Part A baseline measurement at 0.0°
      state = experimentReducer(state, {
        type: 'ADD_MEASUREMENT',
        measurement: { id: 'partA_m0', fringeIndex: 0, angleDeg: 0.0, part: 'A' },
      });
      expect(state.measurements.length).toBe(1);
      expect(state.measurements[0].part).toBe('A');
    });
  });

  // ==========================================================================
  // SCENARIO B: PART B - THIN SLIDE S1 DIFFRACTION & ANGULAR SWEEP
  // ==========================================================================
  describe('Scenario B: Part B - Thin Slide S1 Diffraction & Angular Sweep', () => {
    it('executes calibrated angular sweep on thin slide S1 and verifies optical phase progression', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'B' });
      expect(state.apparatus.installedHolder).toBe('s1');
      expect(state.apparatus.screenDistance).toBeCloseTo(0.84, 2);

      const params = resolvePhaseParameters(state);
      expect(params.thicknessMm).toBeCloseTo(0.1489, 4);
      expect(params.wavelengthNm).toBe(650);
      expect(params.glassIndex).toBeCloseTo(1.51, 2);
      expect(params.ambientIndex).toBe(1.0);

      // Phase at normal incidence
      const phi0 = phaseAtNormalIncidence(params);
      expect(phi0).toBeGreaterThan(0);

      // Angular sweep angles across official Part B range (0° to 20°)
      const testAngles = [0.0, 5.0, 10.0, 15.0, 20.0];
      const fringeCounts: number[] = [];

      for (let i = 0; i < testAngles.length; i++) {
        const theta = testAngles[i];
        state = experimentReducer(state, { type: 'SET_ANGLE', value: theta });
        const k = fringeShiftCount(theta, params);
        fringeCounts.push(k);

        state = experimentReducer(state, {
          type: 'ADD_MEASUREMENT',
          measurement: {
            id: `partB_m${i}`,
            fringeIndex: Math.round(k),
            angleDeg: theta,
            part: 'B',
          },
        });
      }

      // Verification of mathematical invariants:
      // 1. k(0) == 0.0
      expect(fringeCounts[0]).toBeCloseTo(0.0, 6);

      // 2. Monotonic strictly increasing fringe count with rotation angle
      for (let i = 1; i < fringeCounts.length; i++) {
        expect(fringeCounts[i]).toBeGreaterThan(fringeCounts[i - 1]);
      }

      // 3. Check theoretical slope relation: delta_k = (h/lambda) * [sqrt(n^2 - sin^2(theta)) - cos(theta) - (n - 1)]
      // For S1: h/lambda = 0.1489e-3 / 650e-9 = 229.077
      const theta10Rad = (10.0 * Math.PI) / 180;
      const opticalPathTerm =
        Math.sqrt(params.glassIndex ** 2 - Math.sin(theta10Rad) ** 2) -
        Math.cos(theta10Rad) -
        (params.glassIndex - 1);
      const expectedK10 = ((params.thicknessMm * 1e-3) / (params.wavelengthNm * 1e-9)) * opticalPathTerm;
      expect(fringeCounts[2]).toBeCloseTo(expectedK10, 3);

      // 4. Verify 5 measurements recorded in state
      expect(state.measurements.length).toBe(5);
    });
  });

  // ==========================================================================
  // SCENARIO C: PART C - THICK SLIDE S2 WAVE OPTICS & INTERFERENCE
  // ==========================================================================
  describe('Scenario C: Part C - Thick Slide S2 Wave Optics & Interference', () => {
    it('executes slide swap to thick slide S2 and observes dense fringe shift frequency', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      expect(state.apparatus.installedHolder).toBe('s1');

      // 1. Transition to Part C: Unmount S1, mount S2
      state = experimentReducer(state, { type: 'UNINSTALL_HOLDER' });
      expect(state.apparatus.installedHolder).toBe('none');

      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 's2' });
      state = experimentReducer(state, { type: 'INSTALL_S2' });
      expect(state.apparatus.installedHolder).toBe('s2');

      // 2. Resolve phase parameters for S2 (h = 1.061 mm)
      const paramsS2 = resolvePhaseParameters(state);
      expect(paramsS2.thicknessMm).toBeCloseTo(1.061, 3);

      // 3. Compare fringe count sensitivity between S1 (0.1489mm) and S2 (1.061mm)
      const paramsS1 = resolvePhaseParameters({ apparatus: { installedHolder: 's1' } });
      const testAngle = 10.0;
      const kS1 = fringeShiftCount(testAngle, paramsS1);
      const kS2 = fringeShiftCount(testAngle, paramsS2);

      // S2 is ~7.12 times thicker than S1, so fringe count should scale in proportion
      const ratio = kS2 / kS1;
      expect(ratio).toBeCloseTo(1.061 / 0.1489, 0.5);

      // 4. Test optical alignment loss on vertical tower displacement
      state = experimentReducer(state, { type: 'SET_LASER_HEIGHT', value: 0.56 });
      state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.80 });
      const lossyQuality = alignmentQuality({
        laserHeight: state.apparatus.laserHeight,
        lensHeight: state.apparatus.lensHeight,
        screenDistance: state.apparatus.screenDistance,
      });
      expect(lossyQuality).toBeLessThan(0.8);

      // Re-align
      state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.56 });
      const recoveredQuality = alignmentQuality({
        laserHeight: state.apparatus.laserHeight,
        lensHeight: state.apparatus.lensHeight,
        screenDistance: state.apparatus.screenDistance,
      });
      expect(recoveredQuality).toBeCloseTo(1.0, 3);

      // 5. Record Part C measurement dataset
      state = experimentReducer(state, {
        type: 'ADD_MEASUREMENT',
        measurement: { id: 'partC_m1', fringeIndex: Math.round(kS2), angleDeg: 10.0, part: 'C' },
      });
      expect(state.measurements.length).toBe(1);
      expect(state.measurements[0].part).toBe('C');
    });
  });

  // ==========================================================================
  // SCENARIO D: PART D - LIQUID CUVETTE REFRACTIVE INDEX DETERMINATION
  // ==========================================================================
  describe('Scenario D: Part D - Liquid Cuvette Refractive Index Determination', () => {
    it('executes cuvette installation, liquid pouring, and derives pink liquid refractive index n ≈ 1.332', () => {
      let state = configureForPart(createInitialExperimentState(), 'A');
      state = { ...state, assemblyMode: 'realistic' };

      // 1. Initial conditions: S1 holder mounted, cuvette and bottle still in foam
      expect(state.apparatus.installedHolder).toBe('s1');
      expect(state.kit.cuvetteRemoved).toBe(false);
      expect(state.kit.bottleRemoved).toBe(false);

      // 2. Extract pink dropper bottle
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
      expect(state.kit.bottleRemoved).toBe(true);

      // 3. Extract cuvette from cradle
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
      expect(state.kit.cuvetteRemoved).toBe(true);

      // 4. Attempting to pour liquid before peeling film fails
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(false);

      // 5. Peel yellow protective film "One"
      state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
      expect(state.apparatus.cuvettePeeled).toBe(true);

      // 6. Place cuvette in central platform stage
      state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
      expect(state.apparatus.cuvettePlaced).toBe(true);

      // 7. Pour pink liquid into cuvette
      state = experimentReducer(state, { type: 'POUR_LIQUID' });
      expect(state.apparatus.liquidPoured).toBe(true);

      // 8. Resolve phase parameters: ambient index changes from 1.000 to 1.332
      const liquidParams = resolvePhaseParameters(state);
      expect(liquidParams.ambientIndex).toBeCloseTo(1.332, 3);
      expect(liquidParams.thicknessMm).toBeCloseTo(0.1489, 4);

      // 9. Measure fringe count at 15.0° in liquid medium vs dry air medium
      const dryParams = resolvePhaseParameters({ apparatus: { installedHolder: 's1', cuvettePlaced: false } });
      const theta = 15.0;
      const kDry = fringeShiftCount(theta, dryParams);
      const kLiquid = fringeShiftCount(theta, liquidParams);

      // Because N_liquid (1.332) > N_air (1.000), refractive index contrast (n_glass - N_ambient) is reduced,
      // resulting in lower fringe count in liquid
      expect(kLiquid).toBeLessThan(kDry);
      expect(kLiquid).toBeGreaterThan(0);

      // 10. Record Part D result and verify slope ratio:
      // B_liquid / B_air = 128.0 / 229.1 ≈ 0.5587
      const slopeRatio = kLiquid / kDry;
      expect(slopeRatio).toBeCloseTo(128.0 / 229.1, 0.1);

      state = experimentReducer(state, {
        type: 'ADD_MEASUREMENT',
        measurement: { id: 'partD_m1', fringeIndex: Math.round(kLiquid), angleDeg: 15.0, part: 'D' },
      });
      expect(state.measurements.length).toBe(1);
      expect(state.measurements[0].part).toBe('D');
    });
  });
});

