# Project: PhOLab 2.0 Laboratory Improvement

## Architecture
- **State Store** (`src/experiments/ipho-2024-e2/state.ts`): React `useReducer` managing laboratory state machine (apparatus, electronics, kit, positions, assembly mode, notebook).
- **3D Scene Engine** (`src/experiments/ipho-2024-e2/scene/IPhO2024E2Engine.ts`): Three.js WebGL scene engine handling mesh hierarchies, raycasting, pointer drag operations, camera presets/transitions, procedural cables, and dynamic laser beam geometry.
- **Optical Physics & Simulation** (`src/experiments/ipho-2024-e2/physics.ts`, `PhaseStepPattern.ts`): Mathematical wave optics solver computing alignment loss, laser fringe profile, and phase step diffraction pattern modulated by Euclidean distance.
- **UI & Interactivity Overlays** (`IPhO2024E2Lab.tsx`, `ExperimentScene.tsx`, `HUDOverlayRuler.tsx`): React components providing HUD ruler, notebook, assembly mode selector, contextual action cards, and keyboard/mouse interaction handling.
- **Testing Infrastructure** (`test_runner.cjs`): Self-contained test suite runner compiling TypeScript via `esbuild` and verifying state, physics, calibration, primitives, and interaction suites.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Single-Click Selection Deconfliction | Left clicking 3D objects selects object and shows action card without moving camera | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Double Right-Click Camera Focus | Double right clicking directly on object smoothly focuses camera and updates preset badge | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Knob Dragging Stability | Dragging rotation, laser height, lens height, or current knobs does not abruptly alter camera | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Escape Key Closes Overlays | Pressing Escape dismisses HUD ruler, dropdown, notebook, instructions, or context card | M1 | ORIGINAL_REQUEST §R5 |
| 5 | Windows Alt Key Suppression | Prevent default Windows browser menu bar activation on Alt press/release | M1 | ORIGINAL_REQUEST §R5 |
| 6 | Clean Overlay Pointer Events | Interactive overlays yield pointer events cleanly to canvas when not dragged | M1 | ORIGINAL_REQUEST §R5 |
| 7 | Screen Drag Spatial Sync | Alt+dragging screen computes and updates `state.apparatus.screenDistance` via 3D Euclidean separation | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Programmatic Screen Distance Sync | Adjusting `screenDistance` programmatically moves screen on bench along optical axis | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Collinear Laser Beam & Projection Plane | Beam cylinder and pattern projection plane maintain strict collinear alignment at all times | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Dynamic Fringe Spacing Modulation | Phase step pattern dynamically scales fringe spacing with screen distance ($\sqrt{D_0 / D}$) | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Procedural Catmull-Rom Dynamic Cables | Cables dynamically recalculate catenary curves anchored to physical sockets on Alt+drag | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Cable Visibility & Disconnect State | Cleanly hide or disconnect cables when unattached or stored in kit | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Realism Mode Platform Foam Interlock | Block platform extraction until all 4 rods loosened and both red O-rings removed | M4 | ORIGINAL_REQUEST §R4 |
| 14 | Realism Mode Liquid Pouring Interlock | Block pouring pink liquid until bottle on bench and cuvette film peeled | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Contextual Roadblock Hints | Clear contextual hints on action cards and 3D drops explaining remaining prerequisites | M4 | ORIGINAL_REQUEST §R4 |
| 16 | Mode Preservation (Guided & Skip) | Assisted behaviors and full accessibility preserved in Guided and Skip modes | M4 | ORIGINAL_REQUEST §R4 |
| 17 | Automated Verification & Testing | 100% test pass via `npm test`, zero TS errors via `npm run build`, clean dev server | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Kinematics, Camera & UI Ergonomics | Features 1, 2, 3, 4, 5, 6 | none | IN_PROGRESS |
| M2 | Spatial Bench Synchronization & Optical Physics | Features 7, 8, 9, 10 | none | IN_PROGRESS |
| M3 | Dynamic Flexible Cabling (Catmull-Rom) | Features 11, 12 | none | IN_PROGRESS |
| M4 | Realistic Mode Competition Interlocks | Features 13, 14, 15, 16 | none | IN_PROGRESS |
| M5 | Full Integration, E2E Verification & Hardening | Feature 17, Tiers 1-5 tests | M1, M2, M3, M4, Test Track | PLANNED |

## Interface Contracts

### M1 ↔ M2: Camera Target Tracking
- `CAMERA_VIEWS.screen.target` and `focus('screen')` dynamically track `state.positions.screen`.
- Knob drag handles update apparatus state without dispatching camera focus changes.

### M2 ↔ M3: Platform Movement & Cable Anchoring
- Laser carriage world socket: `laserCarriage.localToWorld(new THREE.Vector3(-0.08, 0, 0.05))`.
- Tracks both platform translation $(X, Z)$ and vertical laser knob position $Y$.

### M3 ↔ M4: Kit Storage & Assembly Mode Interlocks
- Disconnecting/storing items in kit updates cable connection state (`laserToBoard: false`, `boardToPower: false`).
- Realistic mode restricts extraction until transport restraints are removed.

## Code Layout
- `src/experiments/ipho-2024-e2/scene/IPhO2024E2Engine.ts`: 3D engine, interaction, raycasting, camera, cables, beam
- `src/experiments/ipho-2024-e2/components/IPhO2024E2Lab.tsx`: UI layout, action cards, keyboard handlers, hints
- `src/experiments/ipho-2024-e2/state.ts`: Experiment state machine, reducer, actions
- `src/experiments/ipho-2024-e2/physics.ts`: Analytical optics solver
- `src/experiments/ipho-2024-e2/scene/PhaseStepPattern.ts`: Diffraction pattern rendering
- `src/core/primitives/CableConnection.ts`: Catmull-Rom procedural cable primitive
- `src/components/3d/controls/SimpleOrbitControls.ts`: Camera orbit and pan controls
- `src/components/HUDOverlayRuler.tsx`: Ruler overlay
- `test_runner.cjs`: Test compilation and execution harness
