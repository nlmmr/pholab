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
    const measurement = { id: 'row-1', fringeIndex: 7, angleDeg: 23.4, part: 'A' as const };
    const state = experimentReducer(initial, { type: 'ADD_MEASUREMENT', measurement });
    expect(state.measurements).toEqual([measurement]);
  });

  it('handles S2 holder removal, installation and uninstallation', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });

    state = experimentReducer(state, { type: 'REMOVE_S2' });
    expect(state.kit.s2Removed).toBe(true);

    state = experimentReducer(state, { type: 'INSTALL_S2' });
    expect(state.apparatus.installedHolder).toBe('s2');
    expect(state.apparatus.s2Installed).toBe(true);

    state = experimentReducer(state, { type: 'UNINSTALL_HOLDER' });
    expect(state.apparatus.installedHolder).toBe('none');
    expect(state.apparatus.s2Installed).toBe(false);
  });

  it('handles cuvette peeling, placement and liquid pouring', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });

    expect(state.apparatus.cuvettePeeled).toBe(false);
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    expect(state.apparatus.cuvettePeeled).toBe(true);

    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);

    expect(state.apparatus.liquidPoured).toBe(false);
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);
  });

  it('modulates laser emission based on current threshold and circuit completeness', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
    expect(isLaserEmitting(state)).toBe(true);

    // Current reduced below emission threshold (1.0 mA)
    state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 0.5 });
    expect(isLaserEmitting(state)).toBe(false);

    // Current set to nominal 15.0 mA
    state = experimentReducer(state, { type: 'SET_LASER_CURRENT', value: 15.0 });
    expect(isLaserEmitting(state)).toBe(true);
  });

  it('removes transport red O-rings', () => {
    let state = createInitialExperimentState();
    expect(state.kit.redOringsRemoved).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    expect(state.kit.redOringsRemoved).toBe(true);
  });

  it('toggles kit location between bench and floor', () => {
    let state = createInitialExperimentState();
    expect(state.kit.location).toBe('bench');
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LOCATION' });
    expect(state.kit.location).toBe('floor');
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LOCATION' });
    expect(state.kit.location).toBe('bench');
    state = experimentReducer(state, { type: 'SET_KIT_LOCATION', location: 'floor' });
    expect(state.kit.location).toBe('floor');
  });

  it('updates item positions freely on the horizontal plane', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'platform', x: 0.8, z: -0.2 });
    expect(state.positions.platform[0]).toBeCloseTo(0.8, 2);
    expect(state.positions.platform[1]).toBeCloseTo(-0.2, 2);
  });

  it('extracts and stores items from technical foam inside the kit', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

    // S1 extraction & storing
    expect(state.kit.s1Removed).toBe(false);
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 's1' });
    expect(state.kit.s1Removed).toBe(true);
    state = experimentReducer(state, { type: 'STORE_ITEM', item: 's1' });
    expect(state.kit.s1Removed).toBe(false);

    // Cuvette & bottle extraction & storing
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
    expect(state.kit.cuvetteRemoved).toBe(true);
    expect(state.kit.bottleRemoved).toBe(true);
    state = experimentReducer(state, { type: 'STORE_ITEM', item: 'bottle' });
    expect(state.kit.bottleRemoved).toBe(false);

    // Electronics & power bank extraction & storing
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'electronics' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'power-bank' });
    expect(state.kit.electronicsRemoved).toBe(true);
    expect(state.kit.powerBankRemoved).toBe(true);
    state = experimentReducer(state, { type: 'STORE_ITEM', item: 'power-bank' });
    expect(state.kit.powerBankRemoved).toBe(false);
  });

  it('supports three-tier assembly mode: guided, realistic, and skip', () => {
    let state = createInitialExperimentState();
    expect(state.assemblyMode).toBe('guided');

    // Switch to realistic
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
    expect(state.assemblyMode).toBe('realistic');

    // Realistic mode: cannot place platform if rods are loosened but O-rings not removed
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    expect(experimentReducer(state, { type: 'PLACE_PLATFORM' }).kit.platformPlaced).toBe(false);

    // Remove O-rings -> now platform can be placed
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    expect(state.kit.platformPlaced).toBe(true);

    // Realistic mode: cannot turn on switch without completing circuit
    expect(experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' }).electronics.switchOn).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    expect(state.electronics.switchOn).toBe(true);

    // Realistic mode: cannot place cuvette without peeling first
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    expect(experimentReducer(state, { type: 'PLACE_CUVETTE' }).apparatus.cuvettePlaced).toBe(false);
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);

    // Switch to skip mode -> auto configures for active Part (Part A)
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'skip' });
    expect(state.assemblyMode).toBe('skip');
    expect(state.apparatus.installedHolder).toBe('s1');
    expect(state.apparatus.s1Installed).toBe(true);
    expect(state.apparatus.s2Installed).toBe(false);
    expect(state.apparatus.cuvettePlaced).toBe(false);
    expect(state.apparatus.laserHeight).toBeCloseTo(0.35, 2);
    expect(state.apparatus.lensHeight).toBeCloseTo(0.35, 2);
    expect(state.electronics.switchOn).toBe(true);
    expect(state.electronics.laserCurrentMa).toBe(15.0);

    // In skip mode, changing active part auto-configures:
    // Part B: S2 installed, S1 uninstalled, cuvette unplaced
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'B' });
    expect(state.activePart).toBe('B');
    expect(state.apparatus.installedHolder).toBe('s2');
    expect(state.apparatus.s2Installed).toBe(true);
    expect(state.apparatus.s1Installed).toBe(false);
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Part C: S2 installed, cuvette placed, peeled, liquid poured
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'C' });
    expect(state.activePart).toBe('C');
    expect(state.apparatus.installedHolder).toBe('s2');
    expect(state.apparatus.cuvettePlaced).toBe(true);
    expect(state.apparatus.cuvettePeeled).toBe(true);
    expect(state.apparatus.liquidPoured).toBe(true);

    // Part D: S1 installed inside cuvette on stage, S2 uninstalled
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'D' });
    expect(state.activePart).toBe('D');
    expect(state.apparatus.installedHolder).toBe('s1');
    expect(state.apparatus.s1Installed).toBe(true);
    expect(state.apparatus.s2Installed).toBe(false);
    expect(state.apparatus.cuvettePlaced).toBe(true);
    expect(state.apparatus.liquidPoured).toBe(true);

    // SKIP_ASSEMBLY action
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'guided' });
    state = experimentReducer(state, { type: 'SKIP_ASSEMBLY', part: 'B' });
    expect(state.activePart).toBe('B');
    expect(state.apparatus.installedHolder).toBe('s2');
  });

  it('handles UPDATE_MEASUREMENT and DELETE_MEASUREMENT operations', () => {
    let state = createInitialExperimentState();
    const row1 = { id: 'm-1', fringeIndex: 1, angleDeg: 5.2, part: 'A' as const };
    const row2 = { id: 'm-2', fringeIndex: 2, angleDeg: 10.4, part: 'A' as const };

    state = experimentReducer(state, { type: 'ADD_MEASUREMENT', measurement: row1 });
    state = experimentReducer(state, { type: 'ADD_MEASUREMENT', measurement: row2 });
    expect(state.measurements.length).toBe(2);

    const updatedRow1 = { id: 'm-1', fringeIndex: 1, angleDeg: 5.4, part: 'A' as const };
    state = experimentReducer(state, { type: 'UPDATE_MEASUREMENT', measurement: updatedRow1 });
    expect(state.measurements[0].angleDeg).toBe(5.4);

    state = experimentReducer(state, { type: 'DELETE_MEASUREMENT', id: 'm-1' });
    expect(state.measurements.length).toBe(1);
    expect(state.measurements[0].id).toBe('m-2');
  });

  it('adjusts laser height, lens height, screen distance and goniometer angle', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_LASER_HEIGHT', value: 0.42 });
    state = experimentReducer(state, { type: 'SET_LENS_HEIGHT', value: 0.45 });
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.95 });
    state = experimentReducer(state, { type: 'SET_ANGLE', value: 33.5 });

    expect(state.apparatus.laserHeight).toBeCloseTo(0.42, 2);
    expect(state.apparatus.lensHeight).toBeCloseTo(0.45, 2);
    expect(state.apparatus.screenDistance).toBeCloseTo(0.95, 2);
    expect(state.apparatus.angleDeg).toBeCloseTo(33.5, 1);
  });

  it('resets experiment to initial state via RESET action', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'C' });
    state = experimentReducer(state, {
      type: 'ADD_MEASUREMENT',
      measurement: { id: 'test-reset', fringeIndex: 3, angleDeg: 12.0, part: 'C' },
    });
    expect(state.measurements.length).toBe(1);

    state = experimentReducer(state, { type: 'RESET' });
    const fresh = createInitialExperimentState();
    expect(state.measurements).toEqual([]);
    expect(state.kit.lidOpen).toBe(fresh.kit.lidOpen);
    expect(state.apparatus.installedHolder).toBe('none');
  });

  it('enforces realistic mode constraints on cuvette placement and liquid pouring', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });

    // Cannot pour liquid before cuvette is placed
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(false);

    // Cannot place cuvette before platform is placed
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Place platform properly
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    expect(state.kit.platformPlaced).toBe(true);

    // Now cuvette can be placed
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);

    // In realistic mode, cannot pour liquid without extracting the bottle first
    expect(experimentReducer(state, { type: 'POUR_LIQUID' }).apparatus.liquidPoured).toBe(false);

    // Extract bottle from technical foam
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
    expect(state.kit.bottleRemoved).toBe(true);

    // Now liquid can be poured
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);
  });

  it('R2: synchronizes screen distance bidirectionally between physical separation and state', () => {
    let state = createInitialExperimentState();
    const platformX = state.positions.platform[0]; // 0.05

    // Dispath SET_SCREEN_DISTANCE: updates state.apparatus.screenDistance AND state.positions.screen[0]
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.92 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.92, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platformX + 0.50 + 0.92, 2);

    // Clamping boundaries for SET_SCREEN_DISTANCE [0.55, 1.15]
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.20 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.55, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platformX + 0.50 + 0.55, 2);

    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 2.00 });
    expect(state.apparatus.screenDistance).toBeCloseTo(1.15, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platformX + 0.50 + 1.15, 2);

    // Dispatch SET_ITEM_POSITION for 'screen': updates state.positions.screen AND recomputes screenDistance
    const targetX = platformX + 0.50 + 0.88;
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: targetX, z: 0.12 });
    expect(state.positions.screen).toEqual([targetX, 0.12]);
    expect(state.apparatus.screenDistance).toBeCloseTo(0.88, 2);

    // Clamping on SET_ITEM_POSITION for 'screen'
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: platformX + 0.50 + 0.40, z: 0.0 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.55, 2);

    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: platformX + 0.50 + 1.40, z: 0.0 });
    expect(state.apparatus.screenDistance).toBeCloseTo(1.15, 2);
  });

  it('R4: enforces strict realistic mode interlocks across all assembly steps', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

    // Platform cannot be extracted if rods are not loose
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    // Loosen all 4 rods, but do not remove O-rings
    for (const index of [0, 1, 2, 3]) state = experimentReducer(state, { type: 'LOOSEN_ROD', index });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    // Remove O-rings: now platform can be placed
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(true);

    // Cuvette cannot be placed if unextracted
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Extract cuvette, but leave unpeeled
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    expect(state.kit.cuvetteRemoved).toBe(true);
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Peel cuvette: now it can be placed
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    expect(state.apparatus.cuvettePeeled).toBe(true);
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);

    // Cannot pour liquid if bottle is not extracted
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(false);

    // Extract bottle: now liquid can be poured
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
    expect(state.kit.bottleRemoved).toBe(true);
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);
  });
});

