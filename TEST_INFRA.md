# E2E Test Infra: PhOLab 2.0 Laboratory Improvement

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user-facing acceptance criteria.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workloads.

## Feature Inventory & Test Matrix
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Interactions) |
|---|---|---|:---:|:---:|:---:|
| 1 | Single-Click Selection Deconfliction | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ✓ |
| 2 | Double Right-Click Camera Focus | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ✓ |
| 3 | Knob Dragging Stability | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ✓ |
| 4 | Escape Key Closes Overlays | ORIGINAL_REQUEST §R5 | 5 tests | 5 tests | ✓ |
| 5 | Windows Alt Key Suppression | ORIGINAL_REQUEST §R5 | 5 tests | 5 tests | ✓ |
| 6 | Clean Overlay Pointer Events | ORIGINAL_REQUEST §R5 | 5 tests | 5 tests | ✓ |
| 7 | Screen Drag Spatial Sync | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ |
| 8 | Programmatic Screen Distance Sync | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ |
| 9 | Collinear Laser Beam & Projection Plane | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ |
| 10 | Dynamic Fringe Spacing Modulation | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ✓ |
| 11 | Procedural Catmull-Rom Dynamic Cables | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ✓ |
| 12 | Cable Visibility & Disconnect State | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ✓ |
| 13 | Realism Mode Platform Foam Interlock | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ✓ |
| 14 | Realism Mode Liquid Pouring Interlock | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ✓ |
| 15 | Contextual Roadblock Hints | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ✓ |
| 16 | Mode Preservation (Guided & Skip) | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ✓ |

## Test Architecture
- **Runner**: `test_runner.cjs` via `npm test`
- **Build Checker**: `npm run build` with zero TypeScript errors
- **Test Modules**:
  - `src/experiments/ipho-2024-e2/physics.test.ts` (optics math, alignment quality, fringe spacing)
  - `src/experiments/ipho-2024-e2/state.test.ts` (state machine, interlocks, storage, spatial distance sync)
  - `src/experiments/ipho-2024-e2/calibration.test.ts` (measurement and calibration logic)
  - `src/core/primitives/primitives.test.ts` (Catmull-Rom cables, procedural splines)
  - `src/experiments/ipho-2024-e2/interaction.test.ts` (camera focus, selection deconfliction, Escape, Alt suppression, hint generation)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|---|---|---|
| 1 | Full Realism Lab Setup | F13, F14, F15, F11, F12 | High |
| 2 | Optical Alignment & Distance Sweep | F7, F8, F9, F10, F3 | High |
| 3 | Multi-Modal Inspection & Overlay Dismissal | F1, F2, F4, F5, F6 | Medium |
| 4 | Guided Mode Fast Assembly Walkthrough | F16, F11, F12, F7 | Medium |
| 5 | Component Repack & Storing Cycle | F11, F12, F1, F4 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total ≥80 tests)
- Tier 2: ≥5 per feature (Total ≥80 tests)
- Tier 3: Major pairwise interactions (Total ≥16 tests)
- Tier 4: ≥5 realistic end-to-end user workflows
- Pass Criteria: 100% tests passing, zero compilation/runtime warnings
