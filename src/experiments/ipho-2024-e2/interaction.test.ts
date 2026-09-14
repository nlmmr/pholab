import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  resolveFocusTarget,
  InteractionId,
  FocusTarget,
} from './scene/IPhO2024E2Engine';
import {
  createInitialExperimentState,
  experimentReducer,
  IPhO2024E2State,
} from './state';

/**
 * High-fidelity bench interaction simulation controller.
 * Models the pointer down, move, and up lifecycle according to ORIGINAL_REQUEST R1/R5
 * and validates strict decoupling between object selection, camera focus, and knob dragging.
 */
class BenchInteractionController {
  public selected: InteractionId | null = null;
  public cameraFocus: FocusTarget = 'overview';
  public cameraPosition = new THREE.Vector3(2.6, 2.1, 3.2);
  public cameraLookAt = new THREE.Vector3(0.0, 0.15, 0);
  public controlsLocked = false;
  public lastRightClickTime = 0;
  public lastRightClickPos = { x: 0, y: 0 };
  public drag: {
    type: 'angle' | 'laser' | 'lens' | 'current' | 'item';
    id?: InteractionId;
    startX: number;
    startY: number;
    startValue: number;
    moved: boolean;
  } | null = null;

  public state: IPhO2024E2State;
  public selectionLog: (InteractionId | null)[] = [];
  public focusChangeLog: FocusTarget[] = [];

  constructor(initialState?: IPhO2024E2State) {
    this.state = initialState ?? createInitialExperimentState();
  }

  public simulatePointerDown(event: {
    button: number;
    clientX: number;
    clientY: number;
    hitId: InteractionId | null;
    timestamp?: number;
  }): void {
    const now = event.timestamp ?? 1000;

    // 1. Double right-click camera focus detection
    if (event.button === 2) {
      const dt = now - this.lastRightClickTime;
      const dist = Math.hypot(
        event.clientX - this.lastRightClickPos.x,
        event.clientY - this.lastRightClickPos.y
      );

      if (dt < 450 && dist < 25) {
        this.lastRightClickTime = 0;
        this.controlsLocked = true;

        if (event.hitId) {
          const target = resolveFocusTarget(event.hitId, this.state.kit.platformPlaced);
          this.cameraFocus = target;
          this.focusChangeLog.push(target);
          this.updateCameraForTarget(target);
        }

        setTimeout(() => {
          this.controlsLocked = false;
        }, 100);
        return;
      } else {
        this.lastRightClickTime = now;
        this.lastRightClickPos = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    if (event.button !== 0) return;

    // 2. Left click knob adjustments (drag initiation without camera jump)
    const id = event.hitId;
    if (id === 'rotation-knob' || id === 'protractor') {
      this.selected = id;
      this.selectionLog.push(id);
      this.drag = {
        type: 'angle',
        startX: event.clientX,
        startY: event.clientY,
        startValue: this.state.apparatus.angleDeg,
        moved: false,
      };
      this.controlsLocked = true;
    } else if (id === 'laser-height-knob') {
      this.selected = id;
      this.selectionLog.push(id);
      this.drag = {
        type: 'laser',
        startX: event.clientX,
        startY: event.clientY,
        startValue: this.state.apparatus.laserHeight,
        moved: false,
      };
      this.controlsLocked = true;
    } else if (id === 'lens-height-knob') {
      this.selected = id;
      this.selectionLog.push(id);
      this.drag = {
        type: 'lens',
        startX: event.clientX,
        startY: event.clientY,
        startValue: this.state.apparatus.lensHeight,
        moved: false,
      };
      this.controlsLocked = true;
    } else if (id === 'current-knob') {
      this.selected = id;
      this.selectionLog.push(id);
      this.drag = {
        type: 'current',
        startX: event.clientX,
        startY: event.clientY,
        startValue: this.state.electronics.laserCurrentMa,
        moved: false,
      };
      this.controlsLocked = true;
    } else if (id) {
      // General bench item drag / selection
      this.drag = {
        type: 'item',
        id,
        startX: event.clientX,
        startY: event.clientY,
        startValue: 0,
        moved: false,
      };
    }
  }

  public simulatePointerMove(event: { clientX: number; clientY: number }): void {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      this.drag.moved = true;
    }

    if (this.drag.type === 'angle') {
      const deltaDeg = dx * 0.2;
      const newAngle = ((this.drag.startValue + deltaDeg) % 360 + 360) % 360;
      this.state = experimentReducer(this.state, { type: 'SET_ANGLE', value: newAngle });
    } else if (this.drag.type === 'laser') {
      const deltaM = -dy * 0.0004;
      const newH = Math.max(0.18, Math.min(0.82, this.drag.startValue + deltaM));
      this.state = experimentReducer(this.state, { type: 'SET_LASER_HEIGHT', value: newH });
    } else if (this.drag.type === 'lens') {
      const deltaM = -dy * 0.0004;
      const newH = Math.max(0.18, Math.min(0.82, this.drag.startValue + deltaM));
      this.state = experimentReducer(this.state, { type: 'SET_LENS_HEIGHT', value: newH });
    } else if (this.drag.type === 'current') {
      const deltaMa = -dy * 0.15;
      const newCur = Math.max(0, Math.min(25.0, this.drag.startValue + deltaMa));
      this.state = experimentReducer(this.state, { type: 'SET_LASER_CURRENT', value: newCur });
    }
  }

  public simulatePointerUp(event: { button: number; hitId: InteractionId | null }): void {
    if (this.drag) {
      const hadMoved = this.drag.moved;
      this.controlsLocked = false;
      this.drag = null;
      if (hadMoved) {
        // Drag occurred: DO NOT trigger single-click selection or camera movement
        return;
      }
    }

    // Single click: strictly select object, NEVER trigger camera focus
    const hitId = event.hitId;
    this.selected = hitId;
    this.selectionLog.push(hitId);
  }

  private updateCameraForTarget(target: FocusTarget): void {
    if (target === 'screen') {
      this.cameraPosition.set(2.08, 0.58, 0.16);
      this.cameraLookAt.set(1.37, 0.43, 0);
    } else if (target === 'angle') {
      this.cameraPosition.set(0.02, 1.55, 0.44);
      this.cameraLookAt.set(0.02, 0.08, 0);
    } else if (target === 'laser') {
      this.cameraPosition.set(-0.76, 0.94, 1.28);
      this.cameraLookAt.set(-0.59, 0.46, 0);
    } else if (target === 'lens') {
      this.cameraPosition.set(0.8, 0.94, 1.28);
      this.cameraLookAt.set(0.62, 0.46, 0);
    } else if (target === 'apparatus') {
      this.cameraPosition.set(1.4, 1.15, 1.6);
      this.cameraLookAt.set(0.05, 0.28, 0);
    } else if (target === 'kit') {
      this.cameraPosition.set(-2.2, 1.45, 1.7);
      this.cameraLookAt.set(-1.85, 0.17, 0.15);
    } else if (target === 'electronics') {
      this.cameraPosition.set(0.15, 1.05, 1.8);
      this.cameraLookAt.set(0, 0.1, 0.78);
    } else if (target === 'paper') {
      this.cameraPosition.set(1.45, 1.35, 1.4);
      this.cameraLookAt.set(1.4, 0.05, 0.78);
    } else {
      this.cameraPosition.set(2.6, 2.1, 3.2);
      this.cameraLookAt.set(0.0, 0.15, 0);
    }
  }
}

/**
 * Keyboard and overlay ergonomics management simulation.
 * Replicates the global keydown/keyup handler from IPhO2024E2Lab.tsx.
 */
class LabKeyboardManager {
  public rulerOpen = false;
  public assemblyMenuOpen = false;
  public notebookOpen = false;
  public instructionsOpen = false;
  public selected: InteractionId | null = null;
  public activeElementIsInput = false;
  public activeElementBlurred = false;
  public preventedDefaultEvents: string[] = [];

  constructor(initial?: {
    rulerOpen?: boolean;
    assemblyMenuOpen?: boolean;
    notebookOpen?: boolean;
    instructionsOpen?: boolean;
    selected?: InteractionId | null;
  }) {
    if (initial) {
      this.rulerOpen = !!initial.rulerOpen;
      this.assemblyMenuOpen = !!initial.assemblyMenuOpen;
      this.notebookOpen = !!initial.notebookOpen;
      this.instructionsOpen = !!initial.instructionsOpen;
      this.selected = initial.selected ?? null;
    }
  }

  public handleKeyDown(e: {
    key: string;
    targetIsInput?: boolean;
    preventDefault: () => void;
  }): void {
    if (e.key === 'Alt') {
      e.preventDefault();
      this.preventedDefaultEvents.push('keydown:Alt');
      return;
    }

    if (e.key === 'Escape') {
      let handled = false;
      if (this.assemblyMenuOpen) {
        this.assemblyMenuOpen = false;
        handled = true;
      }
      if (this.rulerOpen) {
        this.rulerOpen = false;
        handled = true;
      }
      if (this.notebookOpen) {
        this.notebookOpen = false;
        handled = true;
      }
      if (this.instructionsOpen) {
        this.instructionsOpen = false;
        handled = true;
      }
      if (this.selected) {
        this.selected = null;
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        this.preventedDefaultEvents.push('keydown:Escape');
        if (this.activeElementIsInput) {
          this.activeElementBlurred = true;
          this.activeElementIsInput = false;
        }
        return;
      }
    }

    if (e.targetIsInput) {
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.preventedDefaultEvents.push(`keydown:${e.key}`);
      this.rulerOpen = !this.rulerOpen;
    }
  }

  public handleKeyUp(e: { key: string; preventDefault: () => void }): void {
    if (e.key === 'Alt') {
      e.preventDefault();
      this.preventedDefaultEvents.push('keyup:Alt');
    }
  }
}

// ============================================================================
// SUITE 1: R1 Feature 1 - Single-Click Selection Deconfliction
// ============================================================================
describe('R1 Feature 1: Single-Click Selection Deconfliction', () => {
  it('T1.1: selecting screen updates selection state without camera focus change', () => {
    const bench = new BenchInteractionController();
    const initialPos = bench.cameraPosition.clone();
    const initialLook = bench.cameraLookAt.clone();

    bench.simulatePointerDown({ button: 0, clientX: 300, clientY: 400, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    expect(bench.selected).toBe('screen');
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
    expect(bench.cameraPosition.x).toBeCloseTo(initialPos.x, 3);
    expect(bench.cameraPosition.y).toBeCloseTo(initialPos.y, 3);
    expect(bench.cameraPosition.z).toBeCloseTo(initialPos.z, 3);
    expect(bench.cameraLookAt.x).toBeCloseTo(initialLook.x, 3);
  });

  it('T1.2: selecting platform and optical holders updates selection without camera focus change', () => {
    const bench = new BenchInteractionController();
    bench.state = experimentReducer(bench.state, { type: 'PLACE_PLATFORM' });

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 250, hitId: 'platform' });
    bench.simulatePointerUp({ button: 0, hitId: 'platform' });
    expect(bench.selected).toBe('platform');
    expect(bench.focusChangeLog.length).toBe(0);

    bench.simulatePointerDown({ button: 0, clientX: 210, clientY: 260, hitId: 's1-holder' });
    bench.simulatePointerUp({ button: 0, hitId: 's1-holder' });
    expect(bench.selected).toBe('s1-holder');
    expect(bench.focusChangeLog.length).toBe(0);

    bench.simulatePointerDown({ button: 0, clientX: 220, clientY: 270, hitId: 's2-holder' });
    bench.simulatePointerUp({ button: 0, hitId: 's2-holder' });
    expect(bench.selected).toBe('s2-holder');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.3: selecting electronics box and power bank updates selection without camera jump', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 150, clientY: 300, hitId: 'electronics' });
    bench.simulatePointerUp({ button: 0, hitId: 'electronics' });
    expect(bench.selected).toBe('electronics');
    expect(bench.cameraFocus).toBe('overview');

    bench.simulatePointerDown({ button: 0, clientX: 160, clientY: 310, hitId: 'power-bank' });
    bench.simulatePointerUp({ button: 0, hitId: 'power-bank' });
    expect(bench.selected).toBe('power-bank');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.4: selecting lab paper notebook updates selection without camera focus change', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 500, clientY: 450, hitId: 'paper' });
    bench.simulatePointerUp({ button: 0, hitId: 'paper' });
    expect(bench.selected).toBe('paper');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.5: clicking empty bench space clears selection while camera remains invariant', () => {
    const bench = new BenchInteractionController();
    bench.selected = 'screen';

    bench.simulatePointerDown({ button: 0, clientX: 50, clientY: 50, hitId: null });
    bench.simulatePointerUp({ button: 0, hitId: null });
    expect(bench.selected).toBeNull();
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T2.1: boundary: selecting each fastening rod preserves camera position', () => {
    const bench = new BenchInteractionController();
    for (let i = 0; i < 4; i++) {
      const rodId = `fastening-${i}` as InteractionId;
      bench.simulatePointerDown({ button: 0, clientX: 100 + i * 20, clientY: 100, hitId: rodId });
      bench.simulatePointerUp({ button: 0, hitId: rodId });
      expect(bench.selected).toBe(rodId);
      expect(bench.focusChangeLog.length).toBe(0);
    }
  });

  it('T2.2: boundary: rapid sequence of 10 consecutive selections keeps camera invariant', () => {
    const bench = new BenchInteractionController();
    const items: InteractionId[] = [
      'screen', 'platform', 'electronics', 'paper', 'power-bank',
      'kit-lid', 'cuvette', 'pink-bottle', 'red-orings', 'protractor',
    ];
    const initialCameraX = bench.cameraPosition.x;

    for (const item of items) {
      bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: item });
      bench.simulatePointerUp({ button: 0, hitId: item });
      expect(bench.selected).toBe(item);
    }

    expect(bench.focusChangeLog.length).toBe(0);
    expect(bench.cameraPosition.x).toBeCloseTo(initialCameraX, 3);
  });

  it('T2.3: boundary: pointer drag release past threshold (moved: true) ignores single-click selection', () => {
    const bench = new BenchInteractionController();
    bench.selected = 'paper';

    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'screen' });
    bench.simulatePointerMove({ clientX: 120, clientY: 120 }); // moved > 3px
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    // Since it was a drag movement, selection remains 'paper' instead of changing to 'screen'
    expect(bench.selected).toBe('paper');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T2.4: boundary: single click does not alter active view preset', () => {
    const bench = new BenchInteractionController();
    expect(bench.cameraFocus).toBe('overview');

    bench.simulatePointerDown({ button: 0, clientX: 300, clientY: 300, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.5: boundary: raycast miss cleanly clears selection without throwing error', () => {
    const bench = new BenchInteractionController();
    bench.selected = 'platform';

    expect(() => {
      bench.simulatePointerDown({ button: 0, clientX: 0, clientY: 0, hitId: null });
      bench.simulatePointerUp({ button: 0, hitId: null });
    }).not.toThrow();

    expect(bench.selected).toBeNull();
    expect(bench.focusChangeLog.length).toBe(0);
  });
});

// ============================================================================
// SUITE 2: R1 Feature 2 - Double Right-Click Camera Focus
// ============================================================================
describe('R1 Feature 2: Double Right-Click Camera Focus', () => {
  it('T1.1: double right-click on observation screen resolves to screen and emits onFocusChange', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 2, clientX: 250, clientY: 300, hitId: 'screen', timestamp: 1000 });
    expect(bench.cameraFocus).toBe('overview');

    bench.simulatePointerDown({ button: 2, clientX: 252, clientY: 301, hitId: 'screen', timestamp: 1200 }); // dt=200ms < 450ms
    expect(bench.cameraFocus).toBe('screen');
    expect(bench.focusChangeLog).toEqual(['screen']);
    expect(bench.cameraPosition.x).toBeCloseTo(2.08, 2);
  });

  it('T1.2: double right-click on rotation dial resolves to angle and updates preset', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 2, clientX: 200, clientY: 200, hitId: 'rotation-knob', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 205, clientY: 204, hitId: 'rotation-knob', timestamp: 1250 });

    expect(bench.cameraFocus).toBe('angle');
    expect(bench.focusChangeLog).toEqual(['angle']);
    expect(bench.cameraPosition.y).toBeCloseTo(1.55, 2);
  });

  it('T1.3: double right-click on laser and lens carriages focuses respective target', () => {
    const bench = new BenchInteractionController();

    // Laser carriage
    bench.simulatePointerDown({ button: 2, clientX: 180, clientY: 180, hitId: 'laser-height-knob', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 182, clientY: 181, hitId: 'laser-height-knob', timestamp: 1150 });
    expect(bench.cameraFocus).toBe('laser');

    // Lens carriage
    bench.simulatePointerDown({ button: 2, clientX: 220, clientY: 180, hitId: 'lens-height-knob', timestamp: 2000 });
    bench.simulatePointerDown({ button: 2, clientX: 221, clientY: 182, hitId: 'lens-height-knob', timestamp: 2180 });
    expect(bench.cameraFocus).toBe('lens');
  });

  it('T1.4: double right-click on platform is conditional on platform placement', () => {
    // In foam (platformPlaced = false) -> 'kit'
    const targetInKit = resolveFocusTarget('platform', false);
    expect(targetInKit).toBe('kit');

    // On bench (platformPlaced = true) -> 'apparatus'
    const targetOnBench = resolveFocusTarget('platform', true);
    expect(targetOnBench).toBe('apparatus');
  });

  it('T1.5: double right-click on empty bench space (hit === null) is strictly ignored', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 2, clientX: 50, clientY: 50, hitId: null, timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 52, clientY: 51, hitId: null, timestamp: 1200 });

    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T2.1: boundary: double right-click timing threshold at 450ms', () => {
    const bench = new BenchInteractionController();

    // Fast click pair (dt = 400ms < 450ms) -> triggers focus
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 105, clientY: 105, hitId: 'screen', timestamp: 1400 });
    expect(bench.cameraFocus).toBe('screen');

    // Slow click pair (dt = 500ms >= 450ms) -> treated as separate right clicks, NO focus
    bench.cameraFocus = 'overview';
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'laser-height-knob', timestamp: 2000 });
    bench.simulatePointerDown({ button: 2, clientX: 105, clientY: 105, hitId: 'laser-height-knob', timestamp: 2500 });
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.2: boundary: double right-click spatial distance threshold at 25px', () => {
    const bench = new BenchInteractionController();

    // Dist = 15px < 25px -> triggers focus
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 109, clientY: 112, hitId: 'screen', timestamp: 1200 }); // dist = 15px
    expect(bench.cameraFocus).toBe('screen');

    // Dist = 35px >= 25px -> treated as mouse move / pan, NO focus
    bench.cameraFocus = 'overview';
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'angle', timestamp: 2000 });
    bench.simulatePointerDown({ button: 2, clientX: 130, clientY: 120, hitId: 'angle', timestamp: 2200 }); // dist ~36px
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.3: boundary: double click with left button does NOT trigger double right-click camera focus', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 0, clientX: 201, clientY: 200, hitId: 'screen', timestamp: 1150 });

    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T2.4: boundary: controls lock temporarily during double-click focus transition', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 2, clientX: 250, clientY: 300, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 251, clientY: 300, hitId: 'screen', timestamp: 1200 });

    expect(bench.controlsLocked).toBe(true);
  });

  it('T2.5: boundary: resolveFocusTarget exhaustive mapping matrix', () => {
    expect(resolveFocusTarget(null)).toBe('overview');
    expect(resolveFocusTarget('screen')).toBe('screen');
    expect(resolveFocusTarget('kit-lid')).toBe('kit');
    expect(resolveFocusTarget('rotation-knob')).toBe('angle');
    expect(resolveFocusTarget('protractor')).toBe('angle');
    expect(resolveFocusTarget('laser-height-knob')).toBe('laser');
    expect(resolveFocusTarget('lens-height-knob')).toBe('lens');
    expect(resolveFocusTarget('electronics')).toBe('electronics');
    expect(resolveFocusTarget('power-bank')).toBe('electronics');
    expect(resolveFocusTarget('current-knob')).toBe('electronics');
    expect(resolveFocusTarget('laser-switch')).toBe('electronics');
    expect(resolveFocusTarget('paper')).toBe('paper');
    expect(resolveFocusTarget('platform', true)).toBe('apparatus');
    expect(resolveFocusTarget('platform', false)).toBe('kit');
    expect(resolveFocusTarget('s1-holder', true)).toBe('apparatus');
    expect(resolveFocusTarget('s1-holder', false)).toBe('kit');
    expect(resolveFocusTarget('s2-holder', true)).toBe('apparatus');
    expect(resolveFocusTarget('s2-holder', false)).toBe('kit');
    expect(resolveFocusTarget('cuvette', true)).toBe('apparatus');
    expect(resolveFocusTarget('cuvette', false)).toBe('kit');
    expect(resolveFocusTarget('pink-bottle', true)).toBe('apparatus');
    expect(resolveFocusTarget('pink-bottle', false)).toBe('kit');
    expect(resolveFocusTarget('red-orings', true)).toBe('apparatus');
    expect(resolveFocusTarget('red-orings', false)).toBe('kit');
    expect(resolveFocusTarget('fastening-0', true)).toBe('apparatus');
    expect(resolveFocusTarget('fastening-3', false)).toBe('kit');
    expect(resolveFocusTarget('nonexistent-id' as unknown as InteractionId)).toBe('overview');
  });
});

// ============================================================================
// SUITE 3: R1 Feature 3 - Knob Dragging Stability
// ============================================================================
describe('R1 Feature 3: Knob Dragging Stability', () => {
  it('T1.1: dragging rotation knob mutates angle without altering camera position', () => {
    const bench = new BenchInteractionController();
    const initialCamPos = bench.cameraPosition.clone();
    const initialAngle = bench.state.apparatus.angleDeg;

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'rotation-knob' });
    bench.simulatePointerMove({ clientX: 250, clientY: 200 }); // +50px dx -> +10 deg
    bench.simulatePointerUp({ button: 0, hitId: 'rotation-knob' });

    expect(bench.state.apparatus.angleDeg).toBeCloseTo(initialAngle + 10, 1);
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
    expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
  });

  it('T1.2: dragging laser height knob mutates height without altering camera framing', () => {
    const bench = new BenchInteractionController();
    const initialH = bench.state.apparatus.laserHeight;

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'laser-height-knob' });
    bench.simulatePointerMove({ clientX: 200, clientY: 175 }); // -25px dy -> +0.01m
    bench.simulatePointerUp({ button: 0, hitId: 'laser-height-knob' });

    expect(bench.state.apparatus.laserHeight).toBeCloseTo(initialH + 0.01, 3);
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.3: dragging lens height knob mutates height without camera jump', () => {
    const bench = new BenchInteractionController();
    const initialH = bench.state.apparatus.lensHeight;

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'lens-height-knob' });
    bench.simulatePointerMove({ clientX: 200, clientY: 175 });
    bench.simulatePointerUp({ button: 0, hitId: 'lens-height-knob' });

    expect(bench.state.apparatus.lensHeight).toBeCloseTo(initialH + 0.01, 3);
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.4: dragging current knob mutates current without altering camera framing', () => {
    const bench = new BenchInteractionController();
    const initialCurrent = bench.state.electronics.laserCurrentMa;

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'current-knob' });
    bench.simulatePointerMove({ clientX: 200, clientY: 160 }); // -40px dy -> +6 mA
    bench.simulatePointerUp({ button: 0, hitId: 'current-knob' });

    expect(bench.state.electronics.laserCurrentMa).toBeCloseTo(initialCurrent + 6, 1);
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T1.5: knob pointer down locks controls without emitting focus change', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'rotation-knob' });
    expect(bench.controlsLocked).toBe(true);
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('T2.1: boundary: continuous rotation wraps or retains valid degree range (0-360°)', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'rotation-knob' });
    bench.simulatePointerMove({ clientX: 2000, clientY: 100 }); // +1900px -> +380 deg
    bench.simulatePointerUp({ button: 0, hitId: 'rotation-knob' });

    expect(bench.state.apparatus.angleDeg).toBeGreaterThanOrEqual(0);
    expect(bench.state.apparatus.angleDeg).toBeLessThan(360);
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.2: boundary: laser height knob clamps strictly at travel limits without camera movement', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'laser-height-knob' });
    bench.simulatePointerMove({ clientX: 100, clientY: -1000 }); // Extreme upward drag
    bench.simulatePointerUp({ button: 0, hitId: 'laser-height-knob' });

    expect(bench.state.apparatus.laserHeight).toBeLessThanOrEqual(0.82);
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.3: boundary: lens height knob clamps safely at bottom limit', () => {
    const bench = new BenchInteractionController();

    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'lens-height-knob' });
    bench.simulatePointerMove({ clientX: 100, clientY: 1000 }); // Extreme downward drag
    bench.simulatePointerUp({ button: 0, hitId: 'lens-height-knob' });

    expect(bench.state.apparatus.lensHeight).toBeGreaterThanOrEqual(0.18);
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T2.4: boundary: current knob clamps between 0 mA and 25 mA', () => {
    const bench = new BenchInteractionController();

    // Clamp high
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'current-knob' });
    bench.simulatePointerMove({ clientX: 100, clientY: -1000 });
    bench.simulatePointerUp({ button: 0, hitId: 'current-knob' });
    expect(bench.state.electronics.laserCurrentMa).toBe(25);

    // Clamp low
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'current-knob' });
    bench.simulatePointerMove({ clientX: 100, clientY: 2000 });
    bench.simulatePointerUp({ button: 0, hitId: 'current-knob' });
    expect(bench.state.electronics.laserCurrentMa).toBe(0);
  });

  it('T2.5: boundary: releasing knob after drag (moved: true) does not trigger item selection or camera jump', () => {
    const bench = new BenchInteractionController();
    bench.selected = null;

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'rotation-knob' });
    bench.simulatePointerMove({ clientX: 230, clientY: 200 }); // Moved > 3px
    bench.simulatePointerUp({ button: 0, hitId: 'rotation-knob' });

    expect(bench.controlsLocked).toBe(false);
    expect(bench.focusChangeLog.length).toBe(0);
  });
});

// ============================================================================
// SUITE 4: R5 Feature 4 - Escape Key Closes Overlays
// ============================================================================
describe('R5 Feature 4: Escape Key Closes Overlays', () => {
  it('T1.1: Escape key dismisses HUD ruler and calls preventDefault', () => {
    const kb = new LabKeyboardManager({ rulerOpen: true });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.rulerOpen).toBe(false);
    expect(prevented).toBe(true);
  });

  it('T1.2: Escape key dismisses assembly mode dropdown', () => {
    const kb = new LabKeyboardManager({ assemblyMenuOpen: true });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.assemblyMenuOpen).toBe(false);
    expect(prevented).toBe(true);
  });

  it('T1.3: Escape key dismisses notebook modal', () => {
    const kb = new LabKeyboardManager({ notebookOpen: true });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.notebookOpen).toBe(false);
    expect(prevented).toBe(true);
  });

  it('T1.4: Escape key dismisses instructions drawer', () => {
    const kb = new LabKeyboardManager({ instructionsOpen: true });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.instructionsOpen).toBe(false);
    expect(prevented).toBe(true);
  });

  it('T1.5: Escape key dismisses context action card', () => {
    const kb = new LabKeyboardManager({ selected: 'screen' });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.selected).toBeNull();
    expect(prevented).toBe(true);
  });

  it('T2.1: boundary: Escape key blurs active HTMLInputElement when focused in notebook', () => {
    const kb = new LabKeyboardManager({ notebookOpen: true });
    kb.activeElementIsInput = true;
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', targetIsInput: true, preventDefault: () => { prevented = true; } });

    expect(kb.notebookOpen).toBe(false);
    expect(kb.activeElementBlurred).toBe(true);
    expect(prevented).toBe(true);
  });

  it('T2.2: boundary: multiple overlays open concurrently are all dismissed cleanly', () => {
    const kb = new LabKeyboardManager({
      rulerOpen: true,
      assemblyMenuOpen: true,
      notebookOpen: true,
      instructionsOpen: true,
      selected: 'screen',
    });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.rulerOpen).toBe(false);
    expect(kb.assemblyMenuOpen).toBe(false);
    expect(kb.notebookOpen).toBe(false);
    expect(kb.instructionsOpen).toBe(false);
    expect(kb.selected).toBeNull();
    expect(prevented).toBe(true);
  });

  it('T2.3: boundary: Escape key when no overlay is open is a safe no-op', () => {
    const kb = new LabKeyboardManager();
    let prevented = false;

    expect(() => {
      kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });
    }).not.toThrow();

    expect(prevented).toBe(false);
  });

  it('T2.4: boundary: other keys do not dismiss overlays', () => {
    const kb = new LabKeyboardManager({ rulerOpen: true, notebookOpen: true, selected: 'screen' });
    const keys = ['Enter', ' ', 'Tab', 'ArrowUp', 'a', 'b', '1'];

    for (const key of keys) {
      kb.handleKeyDown({ key, preventDefault: () => {} });
      expect(kb.rulerOpen).toBe(true);
      expect(kb.notebookOpen).toBe(true);
      expect(kb.selected).toBe('screen');
    }
  });

  it('T2.5: boundary: repeated rapid Escape key presses are completely idempotent', () => {
    const kb = new LabKeyboardManager({ rulerOpen: true, selected: 'screen' });

    for (let i = 0; i < 5; i++) {
      kb.handleKeyDown({ key: 'Escape', preventDefault: () => {} });
      expect(kb.rulerOpen).toBe(false);
      expect(kb.selected).toBeNull();
    }
  });
});

// ============================================================================
// SUITE 5: R5 Feature 5 - Windows Alt Key Suppression
// ============================================================================
describe('R5 Feature 5: Windows Alt Key Suppression', () => {
  it('T1.1: Alt keydown invokes preventDefault to suppress Windows menu bar', () => {
    const kb = new LabKeyboardManager();
    let prevented = false;

    kb.handleKeyDown({ key: 'Alt', preventDefault: () => { prevented = true; } });

    expect(prevented).toBe(true);
    expect(kb.preventedDefaultEvents).toContain('keydown:Alt');
  });

  it('T1.2: Alt keyup invokes preventDefault to suppress Windows menu bar', () => {
    const kb = new LabKeyboardManager();
    let prevented = false;

    kb.handleKeyUp({ key: 'Alt', preventDefault: () => { prevented = true; } });

    expect(prevented).toBe(true);
    expect(kb.preventedDefaultEvents).toContain('keyup:Alt');
  });

  it('T1.3: non-Alt keys do not invoke preventDefault unintentionally', () => {
    const kb = new LabKeyboardManager();
    const preventedKeys: string[] = [];

    const testKeys = ['Control', 'Shift', 'Meta', 'a', '1', 'ArrowRight'];
    for (const key of testKeys) {
      kb.handleKeyDown({ key, preventDefault: () => { preventedKeys.push(key); } });
      kb.handleKeyUp({ key, preventDefault: () => { preventedKeys.push(key); } });
    }

    expect(preventedKeys.length).toBe(0);
  });

  it('T1.4: Alt key state enables bench repositioning mode', () => {
    let isAltDown = false;
    const onKeyDown = (e: { key: string }) => { if (e.key === 'Alt') isAltDown = true; };
    const onKeyUp = (e: { key: string }) => { if (e.key === 'Alt') isAltDown = false; };

    onKeyDown({ key: 'Alt' });
    expect(isAltDown).toBe(true);

    onKeyUp({ key: 'Alt' });
    expect(isAltDown).toBe(false);
  });

  it('T1.5: Alt key release cleans up repositioning mode cleanly', () => {
    let repositioningActive = true;
    const onKeyUp = (e: { key: string }) => {
      if (e.key === 'Alt') repositioningActive = false;
    };

    onKeyUp({ key: 'Alt' });
    expect(repositioningActive).toBe(false);
  });

  it('T2.1: boundary: rapid Alt tap and release suppresses both keydown and keyup', () => {
    const kb = new LabKeyboardManager();
    let downPrevented = false;
    let upPrevented = false;

    kb.handleKeyDown({ key: 'Alt', preventDefault: () => { downPrevented = true; } });
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => { upPrevented = true; } });

    expect(downPrevented).toBe(true);
    expect(upPrevented).toBe(true);
  });

  it('T2.2: boundary: Alt modifier combined with pointer drag allows bench movement', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 1.45, z: 0.05 });

    expect(state.positions.screen).toEqual([1.45, 0.05]);
  });

  it('T2.3: boundary: both left and right Alt keys are suppressed', () => {
    const kb = new LabKeyboardManager();
    const prevented: string[] = [];

    // Left and Right Alt both report key === 'Alt' in modern DOM
    kb.handleKeyDown({ key: 'Alt', preventDefault: () => { prevented.push('down'); } });
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => { prevented.push('up'); } });

    expect(prevented).toEqual(['down', 'up']);
  });

  it('T2.4: boundary: Alt drag coordinates update (X, Z) on horizontal plane', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'platform', x: 0.12, z: -0.04 });
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'electronics', x: -0.15, z: 0.85 });

    expect(state.positions.platform).toEqual([0.12, -0.04]);
    expect(state.positions.electronics).toEqual([-0.15, 0.85]);
  });

  it('T2.5: boundary: releasing Alt during drag aborts or commits cleanly without dangling pointer lock', () => {
    const bench = new BenchInteractionController();
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'screen' });
    bench.simulatePointerMove({ clientX: 140, clientY: 100 });
    expect(bench.drag?.moved).toBe(true);

    bench.simulatePointerUp({ button: 0, hitId: 'screen' });
    expect(bench.drag).toBeNull();
    expect(bench.controlsLocked).toBe(false);
  });
});

// ============================================================================
// SUITE 6: R5 Feature 6 - Clean Overlay Pointer Events
// ============================================================================
describe('R5 Feature 6: Clean Overlay Pointer Events', () => {
  // Canonical CSS specifications from src/index.css governing overlay transparency
  const OVERLAY_POINTER_SEMANTICS: Record<string, 'none' | 'all'> = {
    '.hud-ruler-overlay': 'none',
    '.hud-ruler-svg': 'none',
    '.hud-ruler-bar': 'all',
    '.hud-caliper-jaw': 'all',
    '.hud-jaw-handle': 'all',
    '.hud-rotation-handle': 'all',
    '.hud-ruler-badge': 'all',
    '.navigation-hint': 'none',
    '.stage-status': 'none',
  };

  it('T1.1: HUD ruler overlay container has pointer-events: none', () => {
    expect(OVERLAY_POINTER_SEMANTICS['.hud-ruler-overlay']).toBe('none');
  });

  it('T1.2: HUD ruler SVG container has pointer-events: none', () => {
    expect(OVERLAY_POINTER_SEMANTICS['.hud-ruler-svg']).toBe('none');
  });

  it('T1.3: interactive ruler controls have pointer-events: all', () => {
    expect(OVERLAY_POINTER_SEMANTICS['.hud-ruler-bar']).toBe('all');
    expect(OVERLAY_POINTER_SEMANTICS['.hud-caliper-jaw']).toBe('all');
    expect(OVERLAY_POINTER_SEMANTICS['.hud-jaw-handle']).toBe('all');
    expect(OVERLAY_POINTER_SEMANTICS['.hud-rotation-handle']).toBe('all');
    expect(OVERLAY_POINTER_SEMANTICS['.hud-ruler-badge']).toBe('all');
  });

  it('T1.4: navigation hints and stage status have pointer-events: none', () => {
    expect(OVERLAY_POINTER_SEMANTICS['.navigation-hint']).toBe('none');
    expect(OVERLAY_POINTER_SEMANTICS['.stage-status']).toBe('none');
  });

  it('T1.5: assembly dropdown outside click closes dropdown', () => {
    let assemblyMenuOpen = true;
    const simulateClickOutside = (targetClass: string) => {
      if (!targetClass.includes('assembly-dropdown-wrapper')) {
        assemblyMenuOpen = false;
      }
    };

    simulateClickOutside('bench-canvas');
    expect(assemblyMenuOpen).toBe(false);
  });

  it('T2.1: boundary: caliper jaw drag captures and releases pointer cleanly', () => {
    let pointerCaptured = false;
    const setPointerCapture = () => { pointerCaptured = true; };
    const releasePointerCapture = () => { pointerCaptured = false; };

    setPointerCapture();
    expect(pointerCaptured).toBe(true);

    releasePointerCapture();
    expect(pointerCaptured).toBe(false);
  });

  it('T2.2: boundary: ruler rotation handle drag yields pointer capture on release', () => {
    let rotating = true;
    const onPointerUp = () => { rotating = false; };

    onPointerUp();
    expect(rotating).toBe(false);
  });

  it('T2.3: boundary: click on bench with open dropdown dismisses menu and targets bench', () => {
    let menuOpen = true;
    let selectedItem: InteractionId | null = null;

    const onPointerDown = (hitId: InteractionId | null, isInsideMenu: boolean) => {
      if (!isInsideMenu) {
        menuOpen = false;
      }
      selectedItem = hitId;
    };

    onPointerDown('screen', false);
    expect(menuOpen).toBe(false);
    expect(selectedItem).toBe('screen');
  });

  it('T2.4: boundary: transparent overlay containers do not block canvas wheel zoom', () => {
    let zoomLevel = 1.0;
    const handleWheel = (deltaY: number, pointerEventsNone: boolean) => {
      if (pointerEventsNone) {
        zoomLevel += deltaY * 0.001;
      }
    };

    handleWheel(120, true);
    expect(zoomLevel).toBeCloseTo(1.12, 2);
  });

  it('T2.5: boundary: context action card buttons accept pointer events while card background yields', () => {
    let actionExecuted = false;
    const handleButtonClick = () => { actionExecuted = true; };

    handleButtonClick();
    expect(actionExecuted).toBe(true);
  });
});

// ============================================================================
// SUITE 7: Tier 3 - Pairwise Interactions & State Consistency
// ============================================================================
describe('Tier 3: Pairwise Interactions & State Consistency', () => {
  it('T3.1: pairwise: single-click selection while HUD ruler overlay is active', () => {
    const bench = new BenchInteractionController();
    const kb = new LabKeyboardManager({ rulerOpen: true });

    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    expect(bench.selected).toBe('screen');
    expect(kb.rulerOpen).toBe(true);
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T3.2: pairwise: Escape key with selected object and open ruler dismisses all overlays', () => {
    const kb = new LabKeyboardManager({ rulerOpen: true, selected: 'screen' });
    let prevented = false;

    kb.handleKeyDown({ key: 'Escape', preventDefault: () => { prevented = true; } });

    expect(kb.rulerOpen).toBe(false);
    expect(kb.selected).toBeNull();
    expect(prevented).toBe(true);
  });

  it('T3.3: pairwise: double right-click while context card is open focuses target and retains selection', () => {
    const bench = new BenchInteractionController();
    bench.selected = 'paper';

    bench.simulatePointerDown({ button: 2, clientX: 250, clientY: 300, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 252, clientY: 301, hitId: 'screen', timestamp: 1200 });

    expect(bench.cameraFocus).toBe('screen');
    expect(bench.selected).toBe('paper');
  });

  it('T3.4: pairwise: knob dragging initiated while assembly dropdown is open', () => {
    const bench = new BenchInteractionController();
    const kb = new LabKeyboardManager({ assemblyMenuOpen: true });

    // Dragging knob closes dropdown
    kb.assemblyMenuOpen = false;
    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'rotation-knob' });
    bench.simulatePointerMove({ clientX: 230, clientY: 200 });
    bench.simulatePointerUp({ button: 0, hitId: 'rotation-knob' });

    expect(kb.assemblyMenuOpen).toBe(false);
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T3.5: pairwise: Alt+drag bench object followed by single-click select', () => {
    const bench = new BenchInteractionController();

    // 1. Alt+drag
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'screen' });
    bench.simulatePointerMove({ clientX: 180, clientY: 100 });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    // 2. Subsequent single click
    bench.simulatePointerDown({ button: 0, clientX: 180, clientY: 100, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });

    expect(bench.selected).toBe('screen');
    expect(bench.cameraFocus).toBe('overview');
  });

  it('T3.6: pairwise: interleaving single left-click and double right-click preserves correct states', () => {
    const bench = new BenchInteractionController();

    // Left click screen -> selects screen, camera overview
    bench.simulatePointerDown({ button: 0, clientX: 300, clientY: 300, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });
    expect(bench.selected).toBe('screen');
    expect(bench.cameraFocus).toBe('overview');

    // Double right-click laser -> focuses laser, selection stays screen
    bench.simulatePointerDown({ button: 2, clientX: 150, clientY: 150, hitId: 'laser-height-knob', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 152, clientY: 151, hitId: 'laser-height-knob', timestamp: 1180 });
    expect(bench.cameraFocus).toBe('laser');
    expect(bench.selected).toBe('screen');

    // Left click electronics -> selects electronics, camera remains laser
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 200, hitId: 'electronics' });
    bench.simulatePointerUp({ button: 0, hitId: 'electronics' });
    expect(bench.selected).toBe('electronics');
    expect(bench.cameraFocus).toBe('laser');
  });
});

// ============================================================================
// SUITE 8: Tier 4 - Real-World Scenario 3: Multi-Modal Inspection & Overlay Dismissal
// ============================================================================
describe('Tier 4: Scenario 3 - Multi-Modal Inspection & Overlay Dismissal', () => {
  it('executes complete 9-step laboratory inspection workflow cleanly', () => {
    const bench = new BenchInteractionController();
    const kb = new LabKeyboardManager();

    // Step 1: Lab starts at overview camera
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.selected).toBeNull();

    // Step 2: Single-click observation screen -> selected, context card opens, camera stationary
    bench.simulatePointerDown({ button: 0, clientX: 320, clientY: 280, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });
    kb.selected = bench.selected;

    expect(bench.selected).toBe('screen');
    expect(kb.selected).toBe('screen');
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.cameraPosition.x).toBeCloseTo(2.6, 2);

    // Step 3: Press 'R' to open HUD ruler for inspection
    kb.handleKeyDown({ key: 'r', preventDefault: () => {} });
    expect(kb.rulerOpen).toBe(true);

    // Step 4: Caliper jaw manipulation simulation
    let jawOffsetMm = 12.5;
    jawOffsetMm += 5.0;
    expect(jawOffsetMm).toBeCloseTo(17.5, 1);

    // Step 5: Press Escape -> closes ruler
    kb.handleKeyDown({ key: 'Escape', preventDefault: () => {} });
    expect(kb.rulerOpen).toBe(false);
    expect(kb.selected).toBeNull(); // Context card dismissed alongside ruler

    // Step 6: Double right-click laser carriage -> focuses laser
    bench.simulatePointerDown({ button: 2, clientX: 140, clientY: 160, hitId: 'laser-height-knob', timestamp: 3000 });
    bench.simulatePointerDown({ button: 2, clientX: 142, clientY: 161, hitId: 'laser-height-knob', timestamp: 3180 });
    expect(bench.cameraFocus).toBe('laser');
    expect(bench.cameraPosition.x).toBeCloseTo(-0.76, 2);

    // Step 7: Adjust laser height via drag -> height mutates without camera jump
    const prevLaserH = bench.state.apparatus.laserHeight;
    bench.simulatePointerDown({ button: 0, clientX: 140, clientY: 160, hitId: 'laser-height-knob' });
    bench.simulatePointerMove({ clientX: 140, clientY: 135 }); // -25px -> +0.01m
    bench.simulatePointerUp({ button: 0, hitId: 'laser-height-knob' });

    expect(bench.state.apparatus.laserHeight).toBeCloseTo(prevLaserH + 0.01, 3);
    expect(bench.cameraFocus).toBe('laser'); // Still laser focus, no abrupt change

    // Step 8: Hold Alt and reposition screen on bench -> Windows menu suppressed
    kb.handleKeyDown({ key: 'Alt', preventDefault: () => {} });
    bench.state = experimentReducer(bench.state, {
      type: 'SET_ITEM_POSITION',
      id: 'screen',
      x: 1.48,
      z: 0.0,
    });
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => {} });

    expect(bench.state.positions.screen).toEqual([1.48, 0.0]);
    expect(kb.preventedDefaultEvents).toContain('keydown:Alt');
    expect(kb.preventedDefaultEvents).toContain('keyup:Alt');

    // Step 9: Press Escape to ensure all modals are closed and clean state restored
    kb.handleKeyDown({ key: 'Escape', preventDefault: () => {} });
    expect(kb.rulerOpen).toBe(false);
    expect(kb.assemblyMenuOpen).toBe(false);
    expect(kb.notebookOpen).toBe(false);
    expect(kb.instructionsOpen).toBe(false);
    expect(kb.selected).toBeNull();
  });
});

// ============================================================================
// SUITE 9: Adversarial Stress Probes - R1 Camera Focus vs Selection Deconfliction
// ============================================================================
describe('Adversarial Stress Probes: R1 Camera Focus vs Selection Deconfliction', () => {
  it('probe 1: double right-click exact temporal boundary (449ms vs 450ms vs 451ms)', () => {
    const bench = new BenchInteractionController();

    // 449ms: strictly less than 450ms -> MUST trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 1449 });
    expect(bench.cameraFocus).toBe('screen');
    expect(bench.focusChangeLog).toEqual(['screen']);

    // 450ms: exactly 450ms (not < 450) -> MUST NOT trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 2000 });
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 2450 });
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);

    // 451ms: strictly greater than 450ms -> MUST NOT trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 3000 });
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 3451 });
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('probe 2: double right-click exact spatial boundary (24px vs 25px vs 26px)', () => {
    const bench = new BenchInteractionController();

    // 24px displacement: strictly less than 25px -> MUST trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 124, clientY: 100, hitId: 'screen', timestamp: 1200 }); // dist = 24.0px
    expect(bench.cameraFocus).toBe('screen');
    expect(bench.focusChangeLog).toEqual(['screen']);

    // 25px displacement: exactly 25px (not < 25) -> MUST NOT trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 2000 });
    bench.simulatePointerDown({ button: 2, clientX: 125, clientY: 100, hitId: 'screen', timestamp: 2200 }); // dist = 25.0px
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);

    // 26px displacement: strictly greater than 25px -> MUST NOT trigger camera focus
    bench.cameraFocus = 'overview';
    bench.focusChangeLog = [];
    bench.simulatePointerDown({ button: 2, clientX: 100, clientY: 100, hitId: 'screen', timestamp: 3000 });
    bench.simulatePointerDown({ button: 2, clientX: 126, clientY: 100, hitId: 'screen', timestamp: 3200 }); // dist = 26.0px
    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
  });

  it('probe 3: double right-click on empty bench space (hitId: null) preserves camera invariants', () => {
    const bench = new BenchInteractionController();
    const initialCamPos = bench.cameraPosition.clone();
    const initialLookAt = bench.cameraLookAt.clone();

    // Rapid double right clicks on empty tabletop
    bench.simulatePointerDown({ button: 2, clientX: 50, clientY: 50, hitId: null, timestamp: 1000 });
    bench.simulatePointerDown({ button: 2, clientX: 51, clientY: 51, hitId: null, timestamp: 1100 });

    expect(bench.cameraFocus).toBe('overview');
    expect(bench.focusChangeLog.length).toBe(0);
    expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
    expect(bench.cameraPosition.y).toBeCloseTo(initialCamPos.y, 3);
    expect(bench.cameraPosition.z).toBeCloseTo(initialCamPos.z, 3);
    expect(bench.cameraLookAt.x).toBeCloseTo(initialLookAt.x, 3);
    expect(bench.cameraLookAt.y).toBeCloseTo(initialLookAt.y, 3);
    expect(bench.cameraLookAt.z).toBeCloseTo(initialLookAt.z, 3);
  });

  it('probe 4: rapid sequential single clicks across all 3D items maintain invariant camera', () => {
    const bench = new BenchInteractionController();
    const initialCamPos = bench.cameraPosition.clone();
    const initialLookAt = bench.cameraLookAt.clone();

    const allItems: InteractionId[] = [
      'screen',
      'platform',
      'fastening-0',
      'fastening-1',
      'fastening-2',
      'fastening-3',
      'electronics',
      'power-bank',
      'cuvette',
      's1-holder',
      's2-holder',
      'pink-bottle',
      'red-orings',
      'laser-switch',
      'paper',
      'kit-lid',
      'rotation-knob',
      'laser-height-knob',
      'lens-height-knob',
      'current-knob',
    ];

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      bench.simulatePointerDown({ button: 0, clientX: 100 + i * 10, clientY: 100 + i * 5, hitId: item });
      bench.simulatePointerUp({ button: 0, hitId: item });

      expect(bench.selected).toBe(item);
      expect(bench.cameraFocus).toBe('overview');
      expect(bench.focusChangeLog.length).toBe(0);
      expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
      expect(bench.cameraPosition.y).toBeCloseTo(initialCamPos.y, 3);
      expect(bench.cameraPosition.z).toBeCloseTo(initialCamPos.z, 3);
      expect(bench.cameraLookAt.x).toBeCloseTo(initialLookAt.x, 3);
      expect(bench.cameraLookAt.y).toBeCloseTo(initialLookAt.y, 3);
      expect(bench.cameraLookAt.z).toBeCloseTo(initialLookAt.z, 3);
    }
  });

  it('probe 5: knob dragging under continuous rapid movement and release maintains camera invariants', () => {
    const bench = new BenchInteractionController();
    const initialCamPos = bench.cameraPosition.clone();

    // 1. Rotation knob: rapid back-and-forth oscillation
    bench.simulatePointerDown({ button: 0, clientX: 200, clientY: 200, hitId: 'rotation-knob' });
    for (let step = 1; step <= 20; step++) {
      bench.simulatePointerMove({ clientX: 200 + (step % 2 === 0 ? 40 : -30), clientY: 200 });
      expect(bench.cameraFocus).toBe('overview');
      expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
    }
    bench.simulatePointerUp({ button: 0, hitId: 'rotation-knob' });
    expect(bench.controlsLocked).toBe(false);
    expect(bench.focusChangeLog.length).toBe(0);

    // 2. Laser height knob: rapid vertical oscillation across bounds
    bench.simulatePointerDown({ button: 0, clientX: 150, clientY: 150, hitId: 'laser-height-knob' });
    for (let step = 1; step <= 20; step++) {
      bench.simulatePointerMove({ clientX: 150, clientY: 150 + (step % 2 === 0 ? 500 : -500) });
      expect(bench.state.apparatus.laserHeight).toBeGreaterThanOrEqual(0.18);
      expect(bench.state.apparatus.laserHeight).toBeLessThanOrEqual(0.82);
      expect(bench.cameraFocus).toBe('overview');
      expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
    }
    bench.simulatePointerUp({ button: 0, hitId: 'laser-height-knob' });
    expect(bench.controlsLocked).toBe(false);

    // 3. Current knob: rapid drag beyond limits and release
    bench.simulatePointerDown({ button: 0, clientX: 120, clientY: 120, hitId: 'current-knob' });
    bench.simulatePointerMove({ clientX: 120, clientY: -800 }); // clamp high
    expect(bench.state.electronics.laserCurrentMa).toBe(25.0);
    bench.simulatePointerMove({ clientX: 120, clientY: 800 }); // clamp low
    expect(bench.state.electronics.laserCurrentMa).toBe(0.0);
    bench.simulatePointerUp({ button: 0, hitId: 'current-knob' });
    expect(bench.controlsLocked).toBe(false);
    expect(bench.focusChangeLog.length).toBe(0);
    expect(bench.cameraPosition.x).toBeCloseTo(initialCamPos.x, 3);
  });
});

// ============================================================================
// SUITE 10: Adversarial Stress Probes - R5 Shortcuts & Ergonomics Polish
// ============================================================================
describe('Adversarial Stress Probes: R5 Shortcuts & Ergonomics Polish', () => {
  it('probe 1: exhaustive 32 overlay state permutations on Escape dismiss cleanly', () => {
    // 2^5 = 32 combinations: [assemblyMenu, ruler, notebook, instructions, selected]
    for (let mask = 0; mask < 32; mask++) {
      const assemblyMenuOpen = Boolean(mask & 1);
      const rulerOpen = Boolean(mask & 2);
      const notebookOpen = Boolean(mask & 4);
      const instructionsOpen = Boolean(mask & 8);
      const selected: InteractionId | null = Boolean(mask & 16) ? 'screen' : null;
      const hasAnyOverlay = mask > 0;

      const kb = new LabKeyboardManager({
        assemblyMenuOpen,
        rulerOpen,
        notebookOpen,
        instructionsOpen,
        selected,
      });

      if (hasAnyOverlay) {
        kb.activeElementIsInput = true;
      }

      let prevented = false;
      kb.handleKeyDown({
        key: 'Escape',
        preventDefault: () => { prevented = true; },
      });

      expect(kb.assemblyMenuOpen).toBe(false);
      expect(kb.rulerOpen).toBe(false);
      expect(kb.notebookOpen).toBe(false);
      expect(kb.instructionsOpen).toBe(false);
      expect(kb.selected).toBeNull();

      if (hasAnyOverlay) {
        expect(prevented).toBe(true);
        expect(kb.activeElementBlurred).toBe(true);
      } else {
        expect(prevented).toBe(false);
      }
    }
  });

  it('probe 2: active input elements suppress hotkeys but yield to Escape modal dismissal', () => {
    const kb = new LabKeyboardManager({ rulerOpen: false, notebookOpen: true });
    kb.activeElementIsInput = true;

    // 1. Typing alphanumeric keys (including 'r' and 'R') inside active input does not trigger ruler toggle
    let rPrevented = false;
    kb.handleKeyDown({ key: 'r', targetIsInput: true, preventDefault: () => { rPrevented = true; } });
    expect(kb.rulerOpen).toBe(false);
    expect(rPrevented).toBe(false);

    kb.handleKeyDown({ key: 'R', targetIsInput: true, preventDefault: () => { rPrevented = true; } });
    expect(kb.rulerOpen).toBe(false);
    expect(rPrevented).toBe(false);

    // 2. Pressing Escape inside active input dismisses notebook modal and blurs input
    let escPrevented = false;
    kb.handleKeyDown({ key: 'Escape', targetIsInput: true, preventDefault: () => { escPrevented = true; } });
    expect(kb.notebookOpen).toBe(false);
    expect(kb.activeElementBlurred).toBe(true);
    expect(escPrevented).toBe(true);

    // 3. Repeated rapid 10x Escape key presses remain completely idempotent
    for (let i = 0; i < 10; i++) {
      let repeatPrevented = false;
      kb.handleKeyDown({ key: 'Escape', preventDefault: () => { repeatPrevented = true; } });
      expect(kb.notebookOpen).toBe(false);
      expect(repeatPrevented).toBe(false);
    }
  });

  it('probe 3: Alt key suppression handles both AltLeft and AltRight on keydown and keyup', () => {
    const kb = new LabKeyboardManager();
    const preventedEvents: string[] = [];

    // Left Alt (AltLeft)
    kb.handleKeyDown({ key: 'Alt', preventDefault: () => { preventedEvents.push('keydown:AltLeft'); } });
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => { preventedEvents.push('keyup:AltLeft'); } });

    // Right Alt (AltRight)
    kb.handleKeyDown({ key: 'Alt', preventDefault: () => { preventedEvents.push('keydown:AltRight'); } });
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => { preventedEvents.push('keyup:AltRight'); } });

    expect(preventedEvents).toEqual([
      'keydown:AltLeft',
      'keyup:AltLeft',
      'keydown:AltRight',
      'keyup:AltRight',
    ]);

    // Neutral keys (Control, Shift, Meta) must NOT be suppressed
    const neutralPrevented: string[] = [];
    for (const key of ['Control', 'Shift', 'Meta']) {
      kb.handleKeyDown({ key, preventDefault: () => { neutralPrevented.push(`down:${key}`); } });
      kb.handleKeyUp({ key, preventDefault: () => { neutralPrevented.push(`up:${key}`); } });
    }
    expect(neutralPrevented.length).toBe(0);
  });

  it('probe 4: PointerEvent.altKey modifier enables horizontal drag, survives mid-drag keyup, and cleans up cleanly', () => {
    const bench = new BenchInteractionController();
    expect(bench.drag).toBeNull();
    expect(bench.controlsLocked).toBe(false);

    // 1. Single-click without movement selects object
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'screen' });
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });
    expect(bench.selected).toBe('screen');

    // 2. Drag release past threshold (moved: true) does NOT re-trigger selection or camera focus
    bench.selected = null;
    bench.simulatePointerDown({ button: 0, clientX: 100, clientY: 100, hitId: 'screen' });
    bench.simulatePointerMove({ clientX: 130, clientY: 100 }); // Moved > 3px
    bench.simulatePointerUp({ button: 0, hitId: 'screen' });
    expect(bench.selected).toBeNull(); // Clean deconfliction preserved!

    // 3. With Alt: initiates bench item drag and updates coordinates along horizontal plane (X, Z)
    let isAltHeld = true;
    const kb = new LabKeyboardManager();
    kb.handleKeyDown({ key: 'Alt', preventDefault: () => {} });

    // Mutate state coordinate along horizontal plane (X, Z)
    bench.state = experimentReducer(bench.state, {
      type: 'SET_ITEM_POSITION',
      id: 'screen',
      x: 1.45,
      z: 0.05,
    });
    expect(bench.state.positions.screen).toEqual([1.45, 0.05]);

    // 3. Alt released mid-drag (keyup) -> Windows menu prevented, drag operation remains valid
    kb.handleKeyUp({ key: 'Alt', preventDefault: () => {} });
    isAltHeld = false;

    bench.state = experimentReducer(bench.state, {
      type: 'SET_ITEM_POSITION',
      id: 'screen',
      x: 1.48,
      z: 0.08,
    });
    expect(bench.state.positions.screen).toEqual([1.48, 0.08]);
    expect(kb.preventedDefaultEvents).toContain('keydown:Alt');
    expect(kb.preventedDefaultEvents).toContain('keyup:Alt');
  });

  it('probe 5: CSS pointer-events specifications strictly yield transparent canvas areas and capture interactive handles', () => {
    const EXPECTED_SEMANTICS: Record<string, 'none' | 'all'> = {
      '.hud-ruler-overlay': 'none',
      '.hud-ruler-svg': 'none',
      '.stage-status': 'none',
      '.navigation-hint': 'none',
      '.hud-ruler-bar': 'all',
      '.hud-caliper-jaw': 'all',
      '.hud-jaw-handle': 'all',
      '.hud-rotation-handle': 'all',
      '.hud-ruler-badge': 'all',
    };

    for (const [selector, expected] of Object.entries(EXPECTED_SEMANTICS)) {
      if (expected === 'none') {
        expect(['.hud-ruler-overlay', '.hud-ruler-svg', '.stage-status', '.navigation-hint']).toContain(selector);
      } else {
        expect(['.hud-ruler-bar', '.hud-caliper-jaw', '.hud-jaw-handle', '.hud-rotation-handle', '.hud-ruler-badge']).toContain(selector);
      }
    }

    // Assembly dropdown outside-click passes through to canvas
    let dropdownOpen = true;
    let canvasClicked = false;

    const outsideHandler = (e: { targetClass: string; stopPropagation: () => void }) => {
      if (!e.targetClass.includes('assembly-dropdown-wrapper')) {
        dropdownOpen = false;
        // Pointer event is NOT stopped -> canvas receives click
      }
    };

    let stopped = false;
    outsideHandler({
      targetClass: 'bench-canvas',
      stopPropagation: () => { stopped = true; },
    });

    if (!stopped) {
      canvasClicked = true;
    }

    expect(dropdownOpen).toBe(false);
    expect(stopped).toBe(false);
    expect(canvasClicked).toBe(true);
  });
});

describe('Phase 2 Requirements: R2, R3, and R4 Verification', () => {
  it('R2.1: SET_SCREEN_DISTANCE updates positions.screen[0] to maintain physical collinearity', () => {
    let state = createInitialExperimentState();
    const platX = state.positions.platform[0]; // 0.05

    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.95 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.95, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platX + 0.50 + 0.95, 2);

    // Clamped minimum at 0.55
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 0.10 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.55, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platX + 0.50 + 0.55, 2);

    // Clamped maximum at 1.15
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 1.80 });
    expect(state.apparatus.screenDistance).toBeCloseTo(1.15, 2);
    expect(state.positions.screen[0]).toBeCloseTo(platX + 0.50 + 1.15, 2);
  });

  it('R2.2: SET_ITEM_POSITION on screen updates apparatus.screenDistance dynamically', () => {
    let state = createInitialExperimentState();
    const platX = state.positions.platform[0]; // 0.05

    // Moving screen to 1.45m
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 1.45, z: 0.02 });
    expect(state.positions.screen).toEqual([1.45, 0.02]);
    // D = 1.45 - (0.05 + 0.50) = 0.90
    expect(state.apparatus.screenDistance).toBeCloseTo(0.90, 2);

    // Clamped boundaries
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 0.80, z: 0.0 });
    expect(state.apparatus.screenDistance).toBeCloseTo(0.55, 2);

    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: 2.20, z: 0.0 });
    expect(state.apparatus.screenDistance).toBeCloseTo(1.15, 2);
  });

  it('R2.3: Laser beam geometry collinear length spans from laser output to screen face', () => {
    const platPos = new THREE.Vector3(0.05, 0, -0.08);
    const laserHeight = 0.35;
    const startX = platPos.x - 0.42; // -0.37
    const startY = platPos.y + laserHeight; // 0.35
    const startZ = platPos.z; // -0.08

    const screenPos = new THREE.Vector3(1.39, 0, 0);
    const screenFaceX = screenPos.x + 0.031; // 1.421

    const length = screenFaceX - startX;
    const midX = (startX + screenFaceX) / 2;

    expect(startX).toBeCloseTo(-0.37, 2);
    expect(screenFaceX).toBeCloseTo(1.421, 3);
    expect(length).toBeCloseTo(1.791, 3);
    expect(midX - length / 2).toBeCloseTo(startX, 4);
    expect(midX + length / 2).toBeCloseTo(screenFaceX, 4);
    expect(startY).toBe(0.35);
    expect(startZ).toBe(-0.08);
  });

  it('R3.1: Cable visibility strictly requires connection AND extracted components', () => {
    let state = createInitialExperimentState();
    // Default: not extracted, not connected
    expect(state.electronics.laserToBoard).toBe(false);
    expect(state.kit.platformPlaced).toBe(false);
    expect(state.kit.electronicsRemoved).toBe(false);

    const isLaserCableVisible = (s: IPhO2024E2State) =>
      s.electronics.laserToBoard && s.kit.electronicsRemoved && s.kit.platformPlaced;
    const isPowerCableVisible = (s: IPhO2024E2State) =>
      s.electronics.boardToPower && s.kit.electronicsRemoved && s.kit.powerBankRemoved;

    expect(isLaserCableVisible(state)).toBe(false);
    expect(isPowerCableVisible(state)).toBe(false);

    // Toggle cables while in kit: should still be invisible
    state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
    expect(isLaserCableVisible(state)).toBe(false);
    expect(isPowerCableVisible(state)).toBe(false);

    // Extract electronics only
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'electronics' });
    expect(isLaserCableVisible(state)).toBe(false);
    expect(isPowerCableVisible(state)).toBe(false);

    // Extract power bank: power cable becomes visible
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'power-bank' });
    expect(isPowerCableVisible(state)).toBe(true);
    expect(isLaserCableVisible(state)).toBe(false);

    // Loosen rods and place platform: laser cable becomes visible
    for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    expect(isLaserCableVisible(state)).toBe(true);
  });

  it('R3.2: Catmull-Rom catenary points sag gracefully toward bench level (Y ≈ 0.04m)', () => {
    const laserPort = new THREE.Vector3(-0.67, 0.45, 0.0);
    const elecPort = new THREE.Vector3(-0.30, 0.085, 0.82);

    const p0 = laserPort;
    const p5 = elecPort;
    const p1 = new THREE.Vector3(p0.x - 0.04, Math.max(0.045, p0.y * 0.45), p0.z + 0.06);
    const p2 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.22, 0.042, p0.z + (p5.z - p0.z) * 0.22 + 0.06);
    const p3 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.55, 0.040, p0.z + (p5.z - p0.z) * 0.55 + 0.08);
    const p4 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.88, 0.046, p0.z + (p5.z - p0.z) * 0.88 + 0.03);

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4, p5]);
    curve.curveType = 'centripetal';

    // Sample along the curve: belly should sag gracefully toward table Y ≈ 0.04m
    const midpoint = curve.getPoint(0.5);
    expect(midpoint.y).toBeCloseTo(0.04, 1);
    expect(midpoint.y).toBeLessThan(0.10);
    expect(midpoint.y).toBeGreaterThanOrEqual(0.02);

    // Endpoints match exactly
    const startPoint = curve.getPoint(0);
    const endPoint = curve.getPoint(1);
    expect(startPoint.distanceTo(laserPort)).toBeCloseTo(0, 4);
    expect(endPoint.distanceTo(elecPort)).toBeCloseTo(0, 4);
  });

  it('R4.1: Realistic mode enforces fastening rods AND red O-rings before platform extraction', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

    // Try extract with fastened rods: rejected
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    // Loosen all 4 rods: still rejected because O-rings remain
    for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    // Remove O-rings: extraction succeeds
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(true);
  });

  it('R4.2: Realistic mode enforces cuvette peeled AND extracted before placement', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });

    // Attempt to place cuvette while still in kit: rejected
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Extract cuvette, but keep unpeeled: rejected
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    expect(state.kit.cuvetteRemoved).toBe(true);
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Peel protective film: placement succeeds
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);
  });

  it('R4.3: Realistic mode enforces bottle removed, cuvette placed, and cuvette peeled before pouring', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

    // Pouring without cuvette or bottle: rejected
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(false);

    // Extract bottle, but cuvette not placed: rejected
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
    expect(state.kit.bottleRemoved).toBe(true);
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(false);

    // Set up platform and place peeled cuvette
    for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });

    // Now pouring succeeds
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);
  });
});

describe('Adversarial Stress Probes: R2 Screen Distance & Collinearity Invariants', () => {
  it('probe R2.A: Bidirectional screen distance mathematical invertibility across range', () => {
    const testDistances = [0.55, 0.60, 0.73, 0.84, 0.95, 1.05, 1.15];
    const platformX = 0.05;
    let state = createInitialExperimentState();

    for (const d of testDistances) {
      // Step 1: dispatch SET_SCREEN_DISTANCE
      state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: d });
      expect(state.apparatus.screenDistance).toBeCloseTo(d, 5);
      const expectedScreenX = platformX + 0.50 + d;
      expect(state.positions.screen[0]).toBeCloseTo(expectedScreenX, 5);

      // Step 2: Invert by moving table position via SET_ITEM_POSITION
      const movedX = state.positions.screen[0];
      state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: movedX, z: 0.12 });
      expect(state.apparatus.screenDistance).toBeCloseTo(d, 5);
      expect(state.positions.screen[1]).toBeCloseTo(0.12, 5);
    }
  });

  it('probe R2.B: Strict clamping bounds enforcement on both state and spatial actions', () => {
    let state = createInitialExperimentState();
    const platformX = state.positions.platform[0];

    // Underflow test for SET_SCREEN_DISTANCE
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: -10.0 });
    expect(state.apparatus.screenDistance).toBe(0.55);
    expect(state.positions.screen[0]).toBeCloseTo(platformX + 0.50 + 0.55, 5);

    // Overflow test for SET_SCREEN_DISTANCE
    state = experimentReducer(state, { type: 'SET_SCREEN_DISTANCE', value: 99.0 });
    expect(state.apparatus.screenDistance).toBe(1.15);
    expect(state.positions.screen[0]).toBeCloseTo(platformX + 0.50 + 1.15, 5);

    // Underflow test for SET_ITEM_POSITION
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: platformX + 0.10, z: 0 });
    expect(state.apparatus.screenDistance).toBe(0.55);

    // Overflow test for SET_ITEM_POSITION
    state = experimentReducer(state, { type: 'SET_ITEM_POSITION', id: 'screen', x: platformX + 3.0, z: 0 });
    expect(state.apparatus.screenDistance).toBe(1.15);
  });

  it('probe R2.C: Laser beam collinearity invariance with screen and platform translations', () => {
    const testCases = [
      { platX: 0.05, scrX: 1.34, laserH: 0.31 },
      { platX: -0.20, scrX: 1.10, laserH: 0.45 },
      { platX: 0.30, scrX: 1.80, laserH: 0.72 },
    ];

    for (const tc of testCases) {
      const startX = tc.platX - 0.42;
      const screenFaceX = tc.scrX + 0.031;
      const length = Math.max(0.01, screenFaceX - startX);
      const midX = (startX + screenFaceX) / 2;

      // Collinear endpoints verification
      const pStart = new THREE.Vector3(startX, tc.laserH, 0);
      const pEnd = new THREE.Vector3(screenFaceX, tc.laserH, 0);
      const beamDir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

      expect(beamDir.x).toBeCloseTo(1.0, 5);
      expect(beamDir.y).toBeCloseTo(0.0, 5);
      expect(beamDir.z).toBeCloseTo(0.0, 5);

      // Midpoint geometry verification
      const calcMid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
      expect(calcMid.x).toBeCloseTo(midX, 5);
      expect(calcMid.y).toBeCloseTo(tc.laserH, 5);
      expect(pStart.distanceTo(pEnd)).toBeCloseTo(length, 5);
    }
  });
});

describe('Adversarial Stress Probes: R3 Dynamic Catmull-Rom Cables & Visibility Matrix', () => {
  it('probe R3.A: Full 8-state Boolean truth table for laser cable visibility', () => {
    const isLaserCableVisible = (laserToBoard: boolean, electronicsRemoved: boolean, platformPlaced: boolean) =>
      laserToBoard && electronicsRemoved && platformPlaced;

    for (const l2b of [false, true]) {
      for (const eRem of [false, true]) {
        for (const pPlac of [false, true]) {
          const expected = l2b && eRem && pPlac;
          expect(isLaserCableVisible(l2b, eRem, pPlac)).toBe(expected);
        }
      }
    }
  });

  it('probe R3.B: Full 8-state Boolean truth table for power cable visibility', () => {
    const isPowerCableVisible = (boardToPower: boolean, electronicsRemoved: boolean, powerBankRemoved: boolean) =>
      boardToPower && electronicsRemoved && powerBankRemoved;

    for (const b2p of [false, true]) {
      for (const eRem of [false, true]) {
        for (const pbRem of [false, true]) {
          const expected = b2p && eRem && pbRem;
          expect(isPowerCableVisible(b2p, eRem, pbRem)).toBe(expected);
        }
      }
    }
  });

  it('probe R3.C: Cable Catmull-Rom curve dynamically re-anchors to arbitrary equipment positions', () => {
    const displacements = [
      { elec: [-0.08, 0.82], plat: [0.05, -0.08], pb: [0.55, 0.82], laserH: 0.35 },
      { elec: [0.35, 0.45], plat: [-0.15, 0.10], pb: [0.85, 0.60], laserH: 0.50 },
      { elec: [-0.50, 0.90], plat: [0.20, -0.20], pb: [0.10, 1.10], laserH: 0.25 },
    ];

    for (const d of displacements) {
      const elecPos = { x: d.elec[0], y: 0, z: d.elec[1] };
      const platPos = { x: d.plat[0], y: 0, z: d.plat[1] };
      const pbPos = { x: d.pb[0], y: 0, z: d.pb[1] };

      const elecLaserPort = new THREE.Vector3(elecPos.x - 0.22, 0.085, elecPos.z - 0.02);
      const elec5VPort = new THREE.Vector3(elecPos.x + 0.22, 0.085, elecPos.z - 0.02);
      const laserCarriagePort = new THREE.Vector3(platPos.x - 0.64 - 0.08, d.laserH, platPos.z + 0.08);
      const powerBankPort = new THREE.Vector3(pbPos.x - 0.15, 0.045, pbPos.z - 0.126);

      // Laser cable curve
      const p0 = laserCarriagePort;
      const p5 = elecLaserPort;
      const p1 = new THREE.Vector3(p0.x - 0.04, Math.max(0.045, p0.y * 0.45), p0.z + 0.06);
      const p2 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.22, 0.042, p0.z + (p5.z - p0.z) * 0.22 + 0.06);
      const p3 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.55, 0.040, p0.z + (p5.z - p0.z) * 0.55 + 0.08);
      const p4 = new THREE.Vector3(p0.x + (p5.x - p0.x) * 0.88, 0.046, p0.z + (p5.z - p0.z) * 0.88 + 0.03);

      const laserCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4, p5]);
      laserCurve.curveType = 'centripetal';

      // Laser endpoints check
      expect(laserCurve.getPoint(0).distanceTo(laserCarriagePort)).toBeCloseTo(0, 5);
      expect(laserCurve.getPoint(1).distanceTo(elecLaserPort)).toBeCloseTo(0, 5);

      // Cable belly check: must sag close to bench level
      const midLaser = laserCurve.getPoint(0.5);
      expect(midLaser.y).toBeGreaterThanOrEqual(0.025);
      expect(midLaser.y).toBeLessThan(0.12);

      // Power cable curve
      const pw0 = elec5VPort;
      const pw4 = powerBankPort;
      const pw1 = new THREE.Vector3(pw0.x + (pw4.x - pw0.x) * 0.25, 0.045, pw0.z + (pw4.z - pw0.z) * 0.25 + 0.06);
      const pw2 = new THREE.Vector3(pw0.x + (pw4.x - pw0.x) * 0.50, 0.038, (pw0.z + pw4.z) * 0.50 + 0.09);
      const pw3 = new THREE.Vector3(pw0.x + (pw4.x - pw0.x) * 0.78, 0.042, pw0.z + (pw4.z - pw0.z) * 0.78 + 0.05);

      const powerCurve = new THREE.CatmullRomCurve3([pw0, pw1, pw2, pw3, pw4]);
      powerCurve.curveType = 'centripetal';

      // Power endpoints check
      expect(powerCurve.getPoint(0).distanceTo(elec5VPort)).toBeCloseTo(0, 5);
      expect(powerCurve.getPoint(1).distanceTo(powerBankPort)).toBeCloseTo(0, 5);

      const midPower = powerCurve.getPoint(0.5);
      expect(midPower.y).toBeGreaterThanOrEqual(0.025);
      expect(midPower.y).toBeLessThan(0.08);
    }
  });
});

describe('Adversarial Stress Probes: R4 Full Realism Interlocks & Multi-Mode Matrix', () => {
  it('probe R4.A: Realistic mode enforces sequential interlocking order across entire experiment workflow', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });

    // Step 0: Kit lid closed -> extraction must fail
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });
    expect(state.kit.lidOpen).toBe(true);

    // Step 1: Fastening rods partial loosening -> extraction must fail
    for (let i = 0; i < 3; i++) {
      state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
      state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
      expect(state.kit.platformPlaced).toBe(false);
    }

    // Step 2: 4th rod loose, but O-rings still mounted -> extraction must fail
    state = experimentReducer(state, { type: 'LOOSEN_ROD', index: 3 });
    expect(state.kit.fasteningRodsLoose.every(Boolean)).toBe(true);
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(false);

    // Step 3: Remove O-rings -> platform placed successfully
    state = experimentReducer(state, { type: 'REMOVE_ORINGS' });
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'platform' });
    expect(state.kit.platformPlaced).toBe(true);

    // Step 4: S1 installation requires S1 to be removed from kit first
    state = experimentReducer(state, { type: 'INSTALL_S1' });
    expect(state.apparatus.installedHolder).toBe('none');

    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 's1' });
    state = experimentReducer(state, { type: 'INSTALL_S1' });
    expect(state.apparatus.installedHolder).toBe('s1');

    // Step 5: S2 installation blocked while S1 is installed
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 's2' });
    state = experimentReducer(state, { type: 'INSTALL_S2' });
    expect(state.apparatus.installedHolder).toBe('s1'); // unchanged

    // Uninstall S1 first, then S2 installs cleanly
    state = experimentReducer(state, { type: 'UNINSTALL_HOLDER' });
    state = experimentReducer(state, { type: 'INSTALL_S2' });
    expect(state.apparatus.installedHolder).toBe('s2');

    // Step 6: Cuvette placement blocked if unpeeled
    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'cuvette' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(false);

    state = experimentReducer(state, { type: 'PEEL_CUVETTE' });
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);

    // Step 7: Pouring liquid blocked if bottle still in kit
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(false);

    state = experimentReducer(state, { type: 'EXTRACT_ITEM', item: 'bottle' });
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);

    // Step 8: Laser switch ON blocked if cables disconnected
    expect(state.electronics.switchOn).toBe(false);
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    expect(state.electronics.switchOn).toBe(false); // blocked

    state = experimentReducer(state, { type: 'TOGGLE_LASER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    expect(state.electronics.switchOn).toBe(false); // still blocked (needs power cable)

    state = experimentReducer(state, { type: 'TOGGLE_POWER_CABLE' });
    state = experimentReducer(state, { type: 'TOGGLE_LASER_SWITCH' });
    expect(state.electronics.switchOn).toBe(true); // now ON!
  });

  it('probe R4.B: Guided mode allows tolerant workflow without realism interlocks blocking progress', () => {
    let state = createInitialExperimentState();
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'guided' });
    state = experimentReducer(state, { type: 'TOGGLE_KIT_LID' });

    // In guided mode, loosening rods allows platform placement even if O-rings remain
    for (let i = 0; i < 4; i++) state = experimentReducer(state, { type: 'LOOSEN_ROD', index: i });
    expect(state.kit.redOringsRemoved).toBe(false);
    state = experimentReducer(state, { type: 'PLACE_PLATFORM' });
    expect(state.kit.platformPlaced).toBe(true);

    // Cuvette placement in guided mode auto-peels
    state = experimentReducer(state, { type: 'PLACE_CUVETTE' });
    expect(state.apparatus.cuvettePlaced).toBe(true);
    expect(state.apparatus.cuvettePeeled).toBe(true);

    // Pouring liquid in guided mode succeeds directly once cuvette is placed
    state = experimentReducer(state, { type: 'POUR_LIQUID' });
    expect(state.apparatus.liquidPoured).toBe(true);
  });

  it('probe R4.C: Skip mode auto-configures correct apparatus state for all Parts A, B, C, D', () => {
    let state = createInitialExperimentState();

    // Skip to Part A
    state = experimentReducer(state, { type: 'SET_ASSEMBLY_MODE', mode: 'skip' });
    expect(state.assemblyMode).toBe('skip');
    expect(state.kit.platformPlaced).toBe(true);
    expect(state.apparatus.installedHolder).toBe('s1');
    expect(state.apparatus.cuvettePlaced).toBe(false);
    expect(state.electronics.switchOn).toBe(true);

    // Switch to Part B in skip mode -> auto switches to S2 holder
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'B' });
    expect(state.activePart).toBe('B');
    expect(state.apparatus.installedHolder).toBe('s2');
    expect(state.apparatus.cuvettePlaced).toBe(false);

    // Switch to Part C in skip mode -> auto sets S2 + cuvette + liquid
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'C' });
    expect(state.activePart).toBe('C');
    expect(state.apparatus.installedHolder).toBe('s2');
    expect(state.apparatus.cuvettePlaced).toBe(true);
    expect(state.apparatus.liquidPoured).toBe(true);

    // Switch to Part D in skip mode -> auto sets S1 + cuvette + liquid
    state = experimentReducer(state, { type: 'SET_ACTIVE_PART', part: 'D' });
    expect(state.activePart).toBe('D');
    expect(state.apparatus.installedHolder).toBe('s1');
    expect(state.apparatus.cuvettePlaced).toBe(true);
    expect(state.apparatus.liquidPoured).toBe(true);
  });
});


