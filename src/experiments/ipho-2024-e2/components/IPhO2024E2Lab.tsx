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
import { HUDOverlayRuler, CameraCalibration } from '../../../components/HUDOverlayRuler';

const STORAGE_KEY = 'pholab:ipho-2024-e2:part-a';

function restoreState(): IPhO2024E2State {
  const initial = createInitialExperimentState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initial;
    const parsed = JSON.parse(stored);
    return {
      ...initial,
      ...parsed,
      assemblyMode: parsed.assemblyMode ?? initial.assemblyMode,
      kit: {
        ...initial.kit,
        ...(parsed.kit || {}),
        fasteningRodsLoose: Array.isArray(parsed.kit?.fasteningRodsLoose) && parsed.kit.fasteningRodsLoose.length === 4
          ? parsed.kit.fasteningRodsLoose
          : initial.kit.fasteningRodsLoose,
      },
      positions: {
        ...initial.positions,
        ...(parsed.positions || {}),
      },
      apparatus: {
        ...initial.apparatus,
        ...(parsed.apparatus || {}),
      },
      electronics: {
        ...initial.electronics,
        ...(parsed.electronics || {}),
        laserCurrentMa: typeof parsed.electronics?.laserCurrentMa === 'number'
          ? parsed.electronics.laserCurrentMa
          : initial.electronics.laserCurrentMa,
      },
    };
  } catch {
    return initial;
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

const PART_DETAILS = {
  A: {
    eyebrow: 'Official task · 2.0 points',
    title: 'Part A: Thickness of S1',
    subtitle: 'Thin slide (h)',
    objective:
      'Observe complete fringe shifts while rotating the thin microscope slide S1 from 0° to 70°. Record the angle θₘ for each fringe index m to determine the thickness h of S1.',
    apparatus:
      'Connect the laser to its electronic board and the board to the power bank. Seat S1 in the rotating stage. Adjust the laser so it strikes the free lower edge of the slide, then bring the lens to nearly the same height.',
    calloutCode: 'A-1',
    calloutText:
      'Start at zero degrees, rotate slowly up to 70°, and collect at least 25 pairs of m and θₘ. Recognize complete shifts visually; the notebook will not read the scale for you.',
    constants: [
      { label: 'Glass index (n)', value: '1.51' },
      { label: 'Air index (N)', value: '1.00' },
      { label: 'Laser wavelength (λ)', value: '650 nm' },
    ],
  },
  B: {
    eyebrow: 'Official task · 2.0 points',
    title: 'Part B: Thickness of S2',
    subtitle: 'Thick slide (H)',
    objective:
      'Determine the thickness H of the thick microscope slide S2. Because H ≈ 1.06 mm (~7× thicker than S1), fringe shifts occur rapidly. Keep angles strictly within 0° to 20°.',
    apparatus:
      'Uninstall S1 and seat the thick slide S2 into the locating protrusions on the circular stage. Align the laser beam onto the bottom edge.',
    calloutCode: 'B-1',
    calloutText:
      'Rotate S2 slowly from 0° up to 20°, counting complete fringe shifts m(θ). Determine the thickness H.',
    constants: [
      { label: 'Glass index (n)', value: '1.51' },
      { label: 'Air index (N)', value: '1.00' },
      { label: 'Laser wavelength (λ)', value: '650 nm' },
      { label: 'Angular limit', value: '20°' },
    ],
  },
  C: {
    eyebrow: 'Official task · 2.5 points',
    title: 'Part C: Liquid index with S2',
    subtitle: 'Liquid index N (with S2)',
    objective:
      'Peel the protective film from the acrylic cuvette, place it around S2 on the rotary stage, and fill it with pink liquid. Measure fringe shifts up to 40° to find the refractive index N.',
    apparatus:
      'Thick slide S2 inside the acrylic cuvette filled with pink liquid on the rotary platform.',
    calloutCode: 'C-1',
    calloutText:
      'With S2 immersed in pink liquid, measure fringe shifts up to 40°. Determine the liquid refractive index N using the thickness H determined in Part B.',
    constants: [
      { label: 'Glass index (n)', value: '1.51' },
      { label: 'Laser wavelength (λ)', value: '650 nm' },
      { label: 'Angular limit', value: '40°' },
    ],
  },
  D: {
    eyebrow: 'Official task · 3.5 points',
    title: 'Part D: Liquid index with S1',
    subtitle: 'Liquid index N (with S1)',
    objective:
      'Repeat the liquid immersion measurement using the thin slide S1 inside the filled cuvette. Measure fringe shifts to determine the definitive refractive index N_B with highest precision.',
    apparatus:
      'Thin slide S1 inside the acrylic cuvette filled with pink liquid on the rotary platform.',
    calloutCode: 'D-1',
    calloutText:
      'Collect pairs of (m, θₘ) with S1 immersed in pink liquid. Compute N_B and evaluate its experimental uncertainty.',
    constants: [
      { label: 'Glass index (n)', value: '1.51' },
      { label: 'Laser wavelength (λ)', value: '650 nm' },
    ],
  },
} as const;

export const IPhO2024E2Lab: React.FC<LabProps> = ({ onExit }) => {
  const [state, dispatch] = useReducer(experimentReducer, undefined, restoreState);
  const [selected, setSelected] = useState<InteractionId | null>(null);
  const [focus, setFocus] = useState<FocusTarget>('overview');
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [assemblyMenuOpen, setAssemblyMenuOpen] = useState(false);
  const [rulerOpen, setRulerOpen] = useState(false);
  const [calibration, setCalibration] = useState<CameraCalibration | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape') {
        let handled = false;
        if (assemblyMenuOpen) {
          setAssemblyMenuOpen(false);
          handled = true;
        }
        if (rulerOpen) {
          setRulerOpen(false);
          handled = true;
        }
        if (notebookOpen) {
          setNotebookOpen(false);
          handled = true;
        }
        if (instructionsOpen) {
          setInstructionsOpen(false);
          handled = true;
        }
        if (selected) {
          setSelected(null);
          handled = true;
        }
        if (handled) {
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          return;
        }
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRulerOpen((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [assemblyMenuOpen, rulerOpen, notebookOpen, instructionsOpen, selected]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!assemblyMenuOpen) return;
    const handleClickOutside = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.assembly-dropdown-wrapper')) {
        setAssemblyMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [assemblyMenuOpen]);

  const rodsRemaining = state.kit.fasteningRodsLoose.filter((value) => !value).length;
  const visibility = patternVisibility(state);
  const currentPart = PART_DETAILS[state.activePart];

  const context = useMemo<ContextAction | null>(() => {
    if (!selected) return null;

    if (selected === 'kit-lid') {
      const locText = state.kit.location === 'floor' ? 'floor next to the bench' : 'bench';
      return {
        label: 'Optics equipment box',
        hint: `${state.kit.lidOpen ? 'The kit is open and components are accessible.' : 'Open the case to reach the apparatus.'} Currently located on the ${locText}.`,
        buttons: [
          {
            label: state.kit.lidOpen ? 'Close kit' : 'Open kit',
            action: () => dispatch({ type: 'TOGGLE_KIT_LID' }),
            tone: 'primary',
          },
          {
            label: state.kit.location === 'floor' ? 'Place box on bench' : 'Place box on floor',
            action: () => dispatch({ type: 'TOGGLE_KIT_LOCATION' }),
          },
        ],
      };
    }

    if (selected.startsWith('fastening-')) {
      return {
        label: 'White fastening rod',
        hint: rodsRemaining
          ? `Tap each rod to unscrew it. ${rodsRemaining} still secure.`
          : 'All four rods are loose. The platform can be lifted out.',
      };
    }

    if (selected === 'red-orings') {
      return {
        label: 'Red transport O-rings',
        hint: state.kit.redOringsRemoved
          ? 'Transport O-rings have been removed.'
          : 'Four red elastic rubber rings secure the optical platform during transport.',
        buttons: state.kit.redOringsRemoved
          ? undefined
          : [
              {
                label: 'Remove O-rings',
                action: () => dispatch({ type: 'REMOVE_ORINGS' }),
                tone: 'primary',
              },
            ],
      };
    }

    if (selected === 'platform') {
      const canStore = !state.apparatus.s1Installed && !state.apparatus.s2Installed && !state.apparatus.cuvettePlaced;
      const isRealistic = state.assemblyMode === 'realistic';
      const oringsNeedRemoval = isRealistic && !state.kit.redOringsRemoved;
      const disablePlace = rodsRemaining > 0 || !state.kit.lidOpen || oringsNeedRemoval;
      let hint = 'Lift the platform out of the foam cutout.';
      if (state.kit.platformPlaced) {
        hint = 'The optical platform is on the bench. You can drag it freely with Alt + drag.';
      } else if (rodsRemaining > 0) {
        hint = `Release all four white rods first (${rodsRemaining} remaining).`;
      } else if (oringsNeedRemoval) {
        hint = 'Remove the four red transport O-rings before extracting the platform in realistic mode.';
      }
      return {
        label: 'Main optical platform',
        hint,
        buttons: state.kit.platformPlaced
          ? [
              {
                label: 'Return to box',
                action: () => dispatch({ type: 'STORE_ITEM', item: 'platform' }),
                disabled: !state.kit.lidOpen || !canStore,
              },
            ]
          : [
              {
                label: 'Place on bench',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'platform' }),
                disabled: disablePlace,
                tone: 'primary',
              },
            ],
      };
    }

    if (selected === 's1-holder') {
      const isInstalled = state.apparatus.installedHolder === 's1' || state.apparatus.s1Installed;
      return {
        label: 'S1 thin-slide holder (h ≈ 149 µm)',
        hint: isInstalled
          ? 'S1 is seated in the four locating protrusions on the rotary stage.'
          : state.kit.s1Removed
          ? 'Slide holder is extracted on the bench. Mount it on the stage or return it to the box.'
          : 'Thin microscope slide S1 securely seated inside the foam cutout.',
        buttons: isInstalled
          ? [{ label: 'Uninstall S1', action: () => dispatch({ type: 'UNINSTALL_HOLDER' }) }]
          : state.kit.s1Removed
          ? [
              {
                label: 'Install on stage',
                action: () => dispatch({ type: 'INSTALL_S1' }),
                disabled: !state.kit.platformPlaced,
                tone: 'primary',
              },
              {
                label: 'Return to box',
                action: () => dispatch({ type: 'STORE_ITEM', item: 's1' }),
                disabled: !state.kit.lidOpen,
              },
            ]
          : [
              {
                label: 'Take from box',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 's1' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ],
      };
    }

    if (selected === 's2-holder') {
      const isInstalled = state.apparatus.installedHolder === 's2' || state.apparatus.s2Installed;
      return {
        label: 'S2 thick-slide holder (H ≈ 1061 µm)',
        hint: isInstalled
          ? 'S2 is seated in the four locating protrusions on the rotary stage.'
          : state.kit.s2Removed
          ? 'Thick slide holder is extracted on the bench. Mount it on the stage or return it to the box.'
          : 'Thick microscope slide S2 securely seated inside the foam cutout.',
        buttons: isInstalled
          ? [{ label: 'Uninstall S2', action: () => dispatch({ type: 'UNINSTALL_HOLDER' }) }]
          : state.kit.s2Removed
          ? [
              {
                label: 'Install on stage',
                action: () => dispatch({ type: 'INSTALL_S2' }),
                disabled: !state.kit.platformPlaced,
                tone: 'primary',
              },
              {
                label: 'Return to box',
                action: () => dispatch({ type: 'STORE_ITEM', item: 's2' }),
                disabled: !state.kit.lidOpen,
              },
            ]
          : [
              {
                label: 'Take from box',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 's2' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ],
      };
    }

    if (selected === 'cuvette') {
      const isPlaced = state.apparatus.cuvettePlaced;
      const isRemoved = state.kit.cuvetteRemoved;
      return {
        label: 'Acrylic optical cuvette',
        hint: !state.apparatus.cuvettePeeled
          ? 'The optical cuvette has protective paper film on its faces that must be peeled off before use.'
          : isPlaced
          ? state.apparatus.liquidPoured
            ? 'The cuvette is placed on the rotary stage and filled with pink liquid.'
            : 'The cuvette is seated on the rotary stage around the sample, empty.'
          : isRemoved
          ? 'Protective film peeled. Ready to be placed onto the optical platform or stored in box.'
          : 'Acrylic cuvette stored in the foam cutout.',
        buttons: [
          ...(!state.apparatus.cuvettePeeled
            ? [{ label: 'Peel protective film', action: () => dispatch({ type: 'PEEL_CUVETTE' }), tone: 'primary' as const }]
            : []),
          ...(!isPlaced && !isRemoved
            ? [
                {
                  label: 'Take from box',
                  action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'cuvette' }),
                  disabled: !state.kit.lidOpen,
                  tone: 'primary' as const,
                },
              ]
            : []),
          ...(!isPlaced && isRemoved
            ? [
                {
                  label: 'Place on stage',
                  action: () => dispatch({ type: 'PLACE_CUVETTE' }),
                  disabled: !state.kit.platformPlaced,
                  tone: 'primary' as const,
                },
                {
                  label: 'Return to box',
                  action: () => dispatch({ type: 'STORE_ITEM', item: 'cuvette' }),
                  disabled: !state.kit.lidOpen,
                },
              ]
            : []),
          ...(isPlaced
            ? [{ label: 'Remove from stage', action: () => dispatch({ type: 'REMOVE_CUVETTE' }) }]
            : []),
        ],
      };
    }

    if (selected === 'pink-bottle') {
      const isRemoved = state.kit.bottleRemoved;
      const isRealistic = state.assemblyMode === 'realistic';
      const cuvetteUnpeeled = isRealistic && !state.apparatus.cuvettePeeled;
      const cannotPour = !state.apparatus.cuvettePlaced || cuvetteUnpeeled;

      let hint = '';
      if (state.apparatus.liquidPoured) {
        hint = 'Pink liquid has already been poured into the cuvette.';
      } else if (!isRemoved) {
        hint = 'Bottle seated in the technical foam cutout inside the kit.';
      } else if (!state.apparatus.cuvettePlaced) {
        hint = 'Bottle on bench. Seat the cuvette on the rotary stage before pouring liquid.';
      } else if (cuvetteUnpeeled) {
        hint = 'Protective film must be peeled from the cuvette before pouring liquid in realistic mode.';
      } else {
        hint = 'Bottle on bench. Add pink liquid into the cuvette surrounding the sample slide.';
      }

      return {
        label: 'Pink liquid dropper bottle',
        hint,
        buttons: !isRemoved
          ? [
              {
                label: 'Take from box',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'bottle' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ]
          : [
              ...(state.apparatus.cuvettePlaced && !state.apparatus.liquidPoured
                ? [
                    {
                      label: 'Pour liquid into cuvette',
                      action: () => dispatch({ type: 'POUR_LIQUID' }),
                      disabled: cannotPour,
                      tone: 'primary' as const,
                    },
                  ]
                : []),
              {
                label: 'Return to box',
                action: () => dispatch({ type: 'STORE_ITEM', item: 'bottle' }),
                disabled: !state.kit.lidOpen,
              },
            ],
      };
    }

    if (selected === 'current-knob') {
      return {
        label: 'Laser current control knob',
        hint: `Laser current set to ${(state.electronics?.laserCurrentMa ?? 15.0).toFixed(1)} mA (nominal 15.0 mA). Drag ←→ to adjust.`,
        buttons: [
          {
            label: 'Nominal (15.0 mA)',
            action: () => dispatch({ type: 'SET_LASER_CURRENT', value: 15.0 }),
            tone: 'primary',
          },
          {
            label: 'Low (8.0 mA)',
            action: () => dispatch({ type: 'SET_LASER_CURRENT', value: 8.0 }),
          },
          {
            label: 'High (22.0 mA)',
            action: () => dispatch({ type: 'SET_LASER_CURRENT', value: 22.0 }),
          },
        ],
      };
    }

    if (selected === 'paper') {
      return {
        label: 'Printed examination task sheet',
        hint: 'Official physical IPhO 2024 Problem E2 examination sheet on the bench. View instructions or open the PDF document.',
        buttons: [
          {
            label: 'Read instructions',
            action: () => setInstructionsOpen(true),
            tone: 'primary',
          },
          {
            label: 'Open official PDF ↗',
            action: () => window.open(IPHO_2024_E2_CONFIG.officialProblemUrl, '_blank'),
          },
        ],
      };
    }

    if (selected === 'screen') {
      const isPlaced = state.apparatus.screenPlaced || state.kit.screenRemoved;
      return {
        label: 'Observation screen',
        hint: isPlaced
          ? 'The screen is free-standing on the bench. Use Alt + drag to reposition freely.'
          : 'Observation screen seated inside the technical foam cutout.',
        buttons: isPlaced
          ? [
              {
                label: 'Return to box',
                action: () => dispatch({ type: 'STORE_ITEM', item: 'screen' }),
                disabled: !state.kit.lidOpen,
              },
            ]
          : [
              {
                label: 'Place on bench',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'screen' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ],
      };
    }

    if (selected === 'electronics') {
      const isRemoved = state.kit.electronicsRemoved;
      const isCabled = state.electronics.laserToBoard || state.electronics.boardToPower;
      return {
        label: 'Laser electronic board',
        hint: !isRemoved
          ? 'Electronic circuit board seated in foam cutout inside the kit.'
          : 'Board on bench. Connect cables to laser and 5 V power bank.',
        buttons: !isRemoved
          ? [
              {
                label: 'Take from box',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'electronics' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ]
          : [
              {
                label: state.electronics.laserToBoard ? 'Disconnect laser' : 'Connect laser',
                action: () => dispatch({ type: 'TOGGLE_LASER_CABLE' }),
                tone: 'primary',
              },
              {
                label: state.electronics.boardToPower ? 'Disconnect power' : 'Connect power bank',
                action: () => dispatch({ type: 'TOGGLE_POWER_CABLE' }),
              },
              ...(!isCabled
                ? [
                    {
                      label: 'Return to box',
                      action: () => dispatch({ type: 'STORE_ITEM', item: 'electronics' }),
                      disabled: !state.kit.lidOpen,
                    },
                  ]
                : []),
            ],
      };
    }

    if (selected === 'power-bank') {
      const isRemoved = state.kit.powerBankRemoved;
      const isCabled = state.electronics.boardToPower;
      return {
        label: 'Power bank',
        hint: !isRemoved
          ? 'Rechargeable 5 V power supply seated in foam cutout inside the kit.'
          : state.electronics.boardToPower
          ? 'Power cable is connected to the board.'
          : 'Connect the board to the 5 V supply.',
        buttons: !isRemoved
          ? [
              {
                label: 'Take from box',
                action: () => dispatch({ type: 'EXTRACT_ITEM', item: 'power-bank' }),
                disabled: !state.kit.lidOpen,
                tone: 'primary',
              },
            ]
          : [
              {
                label: state.electronics.boardToPower ? 'Disconnect power' : 'Connect board',
                action: () => dispatch({ type: 'TOGGLE_POWER_CABLE' }),
                tone: 'primary',
              },
              ...(!isCabled
                ? [
                    {
                      label: 'Return to box',
                      action: () => dispatch({ type: 'STORE_ITEM', item: 'power-bank' }),
                      disabled: !state.kit.lidOpen,
                    },
                  ]
                : []),
            ],
      };
    }

    if (selected === 'laser-switch') {
      return {
        label: 'Laser switch',
        hint: !isCircuitComplete(state)
          ? 'The switch moves, but the circuit is incomplete.'
          : isLaserEmitting(state)
          ? 'Laser emission is active.'
          : 'The circuit is connected but switch is off.',
      };
    }

    if (selected === 'laser-height-knob') {
      return {
        label: 'Laser height',
        hint: 'Drag ↑↓ to bring the beam onto the free lower edge of the slide.',
      };
    }

    if (selected === 'lens-height-knob') {
      return {
        label: 'Lens height',
        hint: 'Drag ↑↓ until the horizontal fringes become clear on the screen.',
      };
    }

    if (selected === 'rotation-knob' || selected === 'protractor') {
      return {
        label: 'Rotate sample stage',
        hint: 'Drag ←→ slowly. Hold Shift for 5× micrometric precision (0.25° increments). Read the angle at the fixed red reference mark.',
      };
    }

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
        <button className="lab-brand" onClick={onExit} aria-label="Return to experiment catalog">
          <span className="brand-mark">Φ</span>
          <strong>PhOLab</strong>
        </button>

        <div className="experiment-title">
          <span>{IPHO_2024_E2_CONFIG.shortTitle}</span>
          <strong>Part {state.activePart} · {currentPart.subtitle}</strong>
          <div className="part-selector" role="tablist" aria-label="Select experiment part">
            {(['A', 'B', 'C', 'D'] as const).map((part) => (
              <button
                key={part}
                className={`part-pill ${state.activePart === part ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_PART', part })}
                aria-selected={state.activePart === part}
              >
                Part {part}
              </button>
            ))}
          </div>
        </div>

        <div className="lab-actions">
          <div className="assembly-dropdown-wrapper">
            <button
              type="button"
              className="header-button assembly-dropdown-button"
              onClick={() => setAssemblyMenuOpen((v) => !v)}
              aria-expanded={assemblyMenuOpen}
              aria-label="Select assembly difficulty mode"
              title="Select Assembly Difficulty Mode"
            >
              <span className="assembly-mode-tag">Assembly:</span>
              <strong>
                {state.assemblyMode === 'guided' && 'Guided Snap ▾'}
                {state.assemblyMode === 'realistic' && 'Full Realism ▾'}
                {state.assemblyMode === 'skip' && 'Skip Assembly ▾'}
              </strong>
            </button>
            {assemblyMenuOpen && (
              <div className="assembly-dropdown-menu" role="menu">
                <button
                  type="button"
                  className={`assembly-menu-item ${state.assemblyMode === 'guided' ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SET_ASSEMBLY_MODE', mode: 'guided' });
                    setAssemblyMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="menu-item-header">
                    <strong>Guided Snap</strong>
                    {state.assemblyMode === 'guided' && <span className="check-mark">✓</span>}
                  </div>
                  <p>Ghost mesh guidance and magnetic socket snap.</p>
                </button>

                <button
                  type="button"
                  className={`assembly-menu-item ${state.assemblyMode === 'realistic' ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SET_ASSEMBLY_MODE', mode: 'realistic' });
                    setAssemblyMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="menu-item-header">
                    <strong>Full Realism</strong>
                    {state.assemblyMode === 'realistic' && <span className="check-mark">✓</span>}
                  </div>
                  <p>Strict physical sequencing with manual precision.</p>
                </button>

                <button
                  type="button"
                  className={`assembly-menu-item ${state.assemblyMode === 'skip' ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SET_ASSEMBLY_MODE', mode: 'skip' });
                    setAssemblyMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="menu-item-header">
                    <strong>Skip Assembly</strong>
                    {state.assemblyMode === 'skip' && <span className="check-mark">✓</span>}
                  </div>
                  <p>Auto-assembles apparatus for Part {state.activePart}.</p>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`header-button ruler-toggle-btn ${rulerOpen ? 'active' : ''}`}
            onClick={() => setRulerOpen((v) => !v)}
            aria-label="Toggle calibrated 2D viewport ruler (shortcut: R)"
            aria-pressed={rulerOpen}
            title="Calibrated Ruler & Caliper Tool (Press 'R' to toggle)"
          >
            <svg
              className="ruler-btn-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-9.9-9.9c-.4-.4-.4-1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l9.9 9.9c.4.4.4 1 0 1.4z" />
              <path d="m14.5 4.5 2 2" />
              <path d="m11.5 7.5 3 3" />
              <path d="m8.5 10.5 2 2" />
              <path d="m5.5 13.5 3 3" />
            </svg>
            <span>Ruler</span>
          </button>
          <button
            className="timer-button"
            onClick={() => setTimerRunning((value) => !value)}
            aria-label={timerRunning ? 'Pause timer' : 'Resume timer'}
          >
            <span className={timerRunning ? 'timer-dot active' : 'timer-dot'} />
            {formatTime(elapsed)}
          </button>
          <button
            className="header-button instructions-button"
            onClick={() => setInstructionsOpen(true)}
            aria-label="Open experiment instructions"
          >
            <span>Instructions</span>
          </button>
          <button
            className="header-button notebook-button"
            onClick={() => setNotebookOpen(true)}
            aria-label={`Open experimental notebook, ${state.measurements.length} measurements`}
          >
            Notebook <i>{state.measurements.length}</i>
          </button>
        </div>
      </header>

      <main className="lab-stage">
        <ExperimentScene
          state={state}
          selected={selected}
          onSelect={setSelected}
          dispatch={dispatch}
          focusRequest={focus}
          onFocusChange={(target) => setFocus(target)}
          timeStr={formatTime(elapsed)}
          timerRunning={timerRunning}
          onCalibrationChange={setCalibration}
        />

        {rulerOpen && (
          <HUDOverlayRuler
            calibration={calibration}
            onClose={() => setRulerOpen(false)}
          />
        )}

        <div className="stage-status" aria-label="Experiment status">
          <span className={state.kit.platformPlaced ? 'ready' : ''}>Kit</span>
          <i />
          <span className={isCircuitComplete(state) ? 'ready' : ''}>Power</span>
          <i />
          <span className={visibility > 0.42 ? 'ready' : ''}>Pattern</span>
          <i />
          <span className={state.measurements.length >= IPHO_2024_E2_CONFIG.minimumMeasurements ? 'ready' : ''}>
            Data
          </span>
        </div>

        <div className="view-presets" aria-label="Camera views">
          <span className="presets-badge" title="Active camera focus">
            Focus: <strong>{focus}</strong>
          </span>
          {(
            [
              ['overview', 'Overview'],
              ['kit', 'Kit'],
              ['apparatus', 'Apparatus'],
              ['screen', 'Screen'],
              ['angle', 'Scale'],
              ['laser', 'Laser'],
              ['lens', 'Lens'],
              ['paper', 'Sheet'],
            ] as [FocusTarget, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={focus === id ? 'active' : ''}
              onClick={() => setFocus(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {context ? (
          <div className="context-card" role="status">
            <button
              className="context-close"
              onClick={() => setSelected(null)}
              aria-label="Close contextual action"
            >
              ×
            </button>
            <span>{context.label}</span>
            <p>{context.hint}</p>
            {context.buttons && (
              <div className="context-actions">
                {context.buttons.map((button) => (
                  <button
                    key={button.label}
                    className={button.tone === 'primary' ? 'primary' : ''}
                    onClick={button.action}
                    disabled={button.disabled}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="navigation-hint">
            {state.assemblyMode === 'guided' && 'Guided Mode: Drag components near stage pins to snap · '}
            {state.assemblyMode === 'realistic' && 'Realistic Mode: Strict physical assembly (loosen rods → remove O-rings → place platform → wire circuit) · '}
            {state.assemblyMode === 'skip' && 'Skip Mode: Apparatus automatically configured for active part · '}
            Alt + drag to move items on bench · Shift + dial for 0.25° precision
          </div>
        )}
      </main>

      {instructionsOpen && (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setInstructionsOpen(false)}
        >
          <aside className="instructions-drawer">
            <header className="sheet-header">
              <div>
                <span className="eyebrow">{currentPart.eyebrow}</span>
                <h2>{currentPart.title}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setInstructionsOpen(false)}
                aria-label="Close instructions"
              >
                ×
              </button>
            </header>
            <section>
              <h3>Objective</h3>
              <p>{currentPart.objective}</p>
            </section>
            <section>
              <h3>Apparatus</h3>
              <p>{currentPart.apparatus}</p>
            </section>
            <section className="task-callout">
              <strong>{currentPart.calloutCode}</strong>
              <p>{currentPart.calloutText}</p>
            </section>
            <section>
              <h3>Given constants</h3>
              <dl>
                {currentPart.constants.map((c) => (
                  <div key={c.label}>
                    <dt>{c.label}</dt>
                    <dd>{c.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <p className="safety-note">
              Avoid looking directly into the laser beam. Handle optical slides and cuvettes by their outer frames only.
            </p>
            <a
              className="official-link"
              href={IPHO_2024_E2_CONFIG.officialProblemUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open the official IPhO 2024 problem ↗
            </a>
            <button className="reset-button" onClick={reset}>
              Reset experiment
            </button>
          </aside>
        </div>
      )}

      <Notebook
        open={notebookOpen}
        measurements={state.measurements}
        activePart={state.activePart}
        onClose={() => setNotebookOpen(false)}
        onAdd={(measurement) => dispatch({ type: 'ADD_MEASUREMENT', measurement })}
        onUpdate={(measurement) => dispatch({ type: 'UPDATE_MEASUREMENT', measurement })}
        onDelete={(id) => dispatch({ type: 'DELETE_MEASUREMENT', id })}
      />
    </div>
  );
};
