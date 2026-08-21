import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { Notebook } from '../../../shared/equipment/Notebook';
import { IPHO_2024_E2_CONFIG } from '../config';
import { ExperimentScene } from './ExperimentScene';
import {
  createInitialExperimentState,
  experimentReducer,
  isCircuitComplete,
  isLaserEmitting,
  patternVisibility,
} from '../state';
import { FocusTarget, InteractionId } from '../scene/IPhO2024E2Engine';

const STORAGE_KEY = 'pholab:ipho-2024-e2:part-a';

function restoreState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialExperimentState();
    const parsed = JSON.parse(stored);
    return { ...createInitialExperimentState(), ...parsed };
  } catch {
    return createInitialExperimentState();
  }
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

interface ContextAction {
  label: string;
  hint: string;
  buttons?: { label: string; action: () => void; disabled?: boolean; tone?: 'primary' | 'danger' }[];
}

interface LabProps {
  onExit: () => void;
}

export const IPhO2024E2Lab: React.FC<LabProps> = ({ onExit }) => {
  const [state, dispatch] = useReducer(experimentReducer, undefined, restoreState);
  const [selected, setSelected] = useState<InteractionId | null>(null);
  const [focus, setFocus] = useState<FocusTarget>('overview');
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const rodsRemaining = state.kit.fasteningRodsLoose.filter((value) => !value).length;
  const visibility = patternVisibility(state);
  const context = useMemo<ContextAction | null>(() => {
    if (!selected) return null;
    if (selected === 'kit-lid') return {
      label: 'Optics equipment box',
      hint: state.kit.lidOpen ? 'The kit is accessible.' : 'Open the case to reach the apparatus.',
      buttons: [{ label: state.kit.lidOpen ? 'Close kit' : 'Open kit', action: () => dispatch({ type: 'TOGGLE_KIT_LID' }), tone: 'primary' }],
    };
    if (selected.startsWith('fastening-')) return {
      label: 'White fastening rod',
      hint: rodsRemaining ? `Tap each rod to unscrew it. ${rodsRemaining} still secure.` : 'All four rods are loose. The platform can be lifted out.',
    };
    if (selected === 'platform') return {
      label: 'Main platform',
      hint: state.kit.platformPlaced ? 'The optical platform is ready on the bench.' : rodsRemaining ? 'Release all four white rods first.' : 'Lift the platform out of the case.',
      buttons: state.kit.platformPlaced ? undefined : [{ label: 'Place on bench', action: () => dispatch({ type: 'PLACE_PLATFORM' }), disabled: rodsRemaining > 0, tone: 'primary' }],
    };
    if (selected === 's1-holder') return {
      label: 'S1 thin-slide holder',
      hint: state.apparatus.s1Installed ? 'S1 is seated in the four locating protrusions.' : state.kit.s1Removed ? 'Fit the holder into the circular stage.' : 'Remove the holder by its metal frame.',
      buttons: state.apparatus.s1Installed ? undefined : [{ label: state.kit.s1Removed ? 'Install S1' : 'Remove from kit', action: () => dispatch({ type: state.kit.s1Removed ? 'INSTALL_S1' : 'REMOVE_S1' }), disabled: state.kit.s1Removed ? !state.kit.platformPlaced : !state.kit.lidOpen, tone: 'primary' }],
    };
    if (selected === 'screen') return {
      label: 'Observation screen',
      hint: state.apparatus.screenPlaced ? 'The screen is free-standing beyond the lens.' : 'Place it beyond the optical platform.',
      buttons: state.apparatus.screenPlaced ? undefined : [{ label: 'Place screen', action: () => dispatch({ type: 'PLACE_SCREEN' }), disabled: !state.kit.lidOpen, tone: 'primary' }],
    };
    if (selected === 'electronics') return {
      label: 'Laser electronic board',
      hint: 'The board needs one cable to the laser and one to the power bank.',
      buttons: [
        { label: state.electronics.laserToBoard ? 'Disconnect laser' : 'Connect laser', action: () => dispatch({ type: 'TOGGLE_LASER_CABLE' }), tone: 'primary' },
        { label: state.electronics.boardToPower ? 'Disconnect power' : 'Connect power bank', action: () => dispatch({ type: 'TOGGLE_POWER_CABLE' }) },
      ],
    };
    if (selected === 'power-bank') return {
      label: 'Power bank',
      hint: state.electronics.boardToPower ? 'Power cable is connected to the board.' : 'Connect the board to the 5 V supply.',
      buttons: [{ label: state.electronics.boardToPower ? 'Disconnect power' : 'Connect board', action: () => dispatch({ type: 'TOGGLE_POWER_CABLE' }), tone: 'primary' }],
    };
    if (selected === 'laser-switch') return {
      label: 'Laser switch',
      hint: !isCircuitComplete(state) ? 'The switch moves, but the circuit is incomplete.' : isLaserEmitting(state) ? 'Laser emission is on.' : 'The circuit is ready.',
    };
    if (selected === 'laser-height-knob') return { label: 'Laser height', hint: 'Drag ↑↓ to bring the beam onto the free lower edge of S1.' };
    if (selected === 'lens-height-knob') return { label: 'Lens height', hint: 'Drag ↑↓ until the horizontal fringes become clear on the screen.' };
    if (selected === 'rotation-knob' || selected === 'protractor') return { label: 'Rotate sample', hint: 'Drag ←→ slowly. Read the scale at the fixed red reference mark.' };
    return null;
  }, [selected, state, rodsRemaining]);

  const reset = () => {
    if (!window.confirm('Reset the apparatus and delete all measurements?')) return;
    dispatch({ type: 'RESET' });
    setElapsed(0);
    setSelected(null);
    setFocus('overview');
  };

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <button className="lab-brand" onClick={onExit} aria-label="Return to experiment catalog"><span className="brand-mark">Φ</span><strong>PhOLab</strong></button>
        <div className="experiment-title"><span>{IPHO_2024_E2_CONFIG.shortTitle}</span><strong>Part A · Thin slide</strong></div>
        <div className="lab-actions">
          <span className="mode-badge">IPhO Original</span>
          <button className="timer-button" onClick={() => setTimerRunning((value) => !value)} aria-label={timerRunning ? 'Pause timer' : 'Resume timer'}><span className={timerRunning ? 'timer-dot active' : 'timer-dot'} />{formatTime(elapsed)}</button>
          <button className="header-button instructions-button" onClick={() => setInstructionsOpen(true)} aria-label="Open experiment instructions"><span>Instructions</span></button>
          <button className="header-button notebook-button" onClick={() => setNotebookOpen(true)} aria-label={`Open experimental notebook, ${state.measurements.length} measurements`}>Notebook <i>{state.measurements.length}</i></button>
        </div>
      </header>

      <main className="lab-stage">
        <ExperimentScene state={state} selected={selected} onSelect={setSelected} dispatch={dispatch} focusRequest={focus} />

        <div className="stage-status" aria-label="Experiment status">
          <span className={state.kit.platformPlaced ? 'ready' : ''}>Kit</span>
          <i />
          <span className={isCircuitComplete(state) ? 'ready' : ''}>Power</span>
          <i />
          <span className={visibility > 0.42 ? 'ready' : ''}>Pattern</span>
          <i />
          <span className={state.measurements.length >= IPHO_2024_E2_CONFIG.minimumMeasurements ? 'ready' : ''}>Data</span>
        </div>

        <div className="view-presets" aria-label="Camera views">
          {([
            ['overview', 'Overview'], ['kit', 'Kit'], ['apparatus', 'Apparatus'], ['screen', 'Screen'], ['angle', 'Scale'],
            ['laser', 'Laser'], ['lens', 'Lens'],
          ] as [FocusTarget, string][]).map(([id, label]) => <button key={id} className={focus === id ? 'active' : ''} onClick={() => setFocus(id)}>{label}</button>)}
        </div>

        {context ? (
          <div className="context-card" role="status">
            <button className="context-close" onClick={() => setSelected(null)} aria-label="Close contextual action">×</button>
            <span>{context.label}</span>
            <p>{context.hint}</p>
            {context.buttons && <div className="context-actions">{context.buttons.map((button) => <button key={button.label} className={button.tone === 'primary' ? 'primary' : ''} onClick={button.action} disabled={button.disabled}>{button.label}</button>)}</div>}
          </div>
        ) : (
          <div className="navigation-hint">Drag to orbit · scroll or pinch to zoom · tap an instrument to focus</div>
        )}
      </main>

      {instructionsOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInstructionsOpen(false)}>
          <aside className="instructions-drawer">
            <header className="sheet-header"><div><span className="eyebrow">Official task · 2.0 points</span><h2>Part A: thickness of S1</h2></div><button className="icon-button" onClick={() => setInstructionsOpen(false)} aria-label="Close instructions">×</button></header>
            <section>
              <h3>Objective</h3>
              <p>Observe complete fringe shifts while rotating the thin microscope slide from 0° to 70°. Record the angle <i>θₘ</i> for each fringe index <i>m</i>.</p>
            </section>
            <section>
              <h3>Apparatus</h3>
              <p>Connect the laser to its electronic board and the board to the power bank. Seat S1 in the rotating stage. Adjust the laser so it strikes the free lower edge of the slide, then bring the lens to nearly the same height.</p>
            </section>
            <section className="task-callout">
              <strong>A-1</strong><p>Start at zero degrees, rotate slowly up to 70°, and collect at least 25 pairs of <i>m</i> and <i>θₘ</i>. Recognize complete shifts visually; the notebook will not read the scale for you.</p>
            </section>
            <section>
              <h3>Given constants</h3>
              <dl><div><dt>Glass index</dt><dd>1.51</dd></div><div><dt>Air index</dt><dd>1.00</dd></div><div><dt>Laser wavelength</dt><dd>650 nm</dd></div></dl>
            </section>
            <p className="safety-note">Avoid looking into the beam. Handle the slide and lens by their frames.</p>
            <a className="official-link" href={IPHO_2024_E2_CONFIG.officialProblemUrl} target="_blank" rel="noreferrer">Open the official IPhO 2024 problem ↗</a>
            <button className="reset-button" onClick={reset}>Reset experiment</button>
          </aside>
        </div>
      )}

      <Notebook open={notebookOpen} measurements={state.measurements} onClose={() => setNotebookOpen(false)} onAdd={(measurement) => dispatch({ type: 'ADD_MEASUREMENT', measurement })} onUpdate={(measurement) => dispatch({ type: 'UPDATE_MEASUREMENT', measurement })} onDelete={(id) => dispatch({ type: 'DELETE_MEASUREMENT', id })} />
    </div>
  );
};
