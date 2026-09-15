# E2E Test Infrastructure: PhOLab 2.0 Visual & Mechanical Realism (IPhO 2024)

## 1. Test Philosophy
- **Requirement-Driven & Opaque-Box**: Derived strictly from `ORIGINAL_REQUEST.md` (specifically header `## 2026-09-14T22:10:15Z`) and `PROJECT.md`. Tests validate external contracts, observable physics, kinematics, state transitions, and user interactions without coupling to transient private implementation details.
- **Progressive Testability & Autonomous Isolation**: Each test case sets up its own clean state, executes without relying on preceding execution order, and operates deterministically.
- **Physics & Mathematical Rigor**: Expected values for optical physics (diffraction phase difference $\Delta\phi$, fringe count $k$, fringe spacing $\Delta y$, alignment loss) and rigid body mechanics (120 Hz Symplectic Euler sub-stepping, 15-axis SAT OBB collision, upright cylinder contact detection, coefficient of restitution $e \le 0.25$, gravitational acceleration $g = 9.81\text{ m/s}^2$) are derived from analytical first-principles oracles.
- **Zero-Dependency Runner**: Tests compile via in-memory `esbuild` and execute in pure Node.js through `test_runner.cjs`, guaranteeing instant verification without external browser harness overhead.

---

## 2. Feature Inventory & Coverage Matrix

| Feature ID | Feature Description | Requirement Source | Tier 1: Feature (>=5) | Tier 2: Boundaries (>=5) | Tier 3: Pairwise | Tier 4: Scenarios |
|---|---|---|:---:|:---:|:---:|:---:|
| **R1.1** | AssetRegistry & MeshFactory Architecture | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A |
| **R1.2** | Case & Foam Cradle 3D Fidelity | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A, D |
| **R1.3** | Fastener Rods & Retention O-rings | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A |
| **R1.4** | Optical Platform & 3-Ring Goniometer (0-80°) | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A, B, C |
| **R1.5** | S1 & S2 Mirror Chrome 4-Column Holders | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part B, C |
| **R1.6** | Cuvette & Pink Dropper Bottle Fidelity | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part D |
| **R1.7** | Electronic Controller & Power Bank Silkscreen | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A, B |
| **R1.8** | Observation Screen with Grooved Clamping Base | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | ? | Part A, B, C, D |
| **R2.1** | Deterministic 120Hz RigidBody Simulation | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ? | Part A, D |
| **R2.2** | Solid 15-Axis SAT OBB Colliders | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ? | Part A, C |
| **R2.3** | Solid Upright Cylindrical Colliders | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ? | Part B, D |
| **R2.4** | Environment Non-Clipping (Table Y=0, Floor Y=-0.78m) | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ? | Part A, D |
| **R2.5** | Inelastic Restitution (e<=0.25) & Sleep Rest Damping | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | ? | Part A, B, C, D |
| **R3.1** | 3D Contact Vector GrabOffset Fix (No Jump) | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ? | Part A, D |
| **R3.2** | MMB Pan Smoothing (66.7% reduction, damping) | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ? | Part B, C |
| **R3.3** | LMB Orbit vs Single-Click Selection (>4px deadband) | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ? | Part A, B, C, D |
| **R3.4** | Alt+LMB Exclusive 3D Grab & Elevation Command | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ? | Part A, D |
| **R3.5** | Scroll Wheel Knob Microadjustment (+-0.25°, +-0.1mA) | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | ? | Part B, C |
| **R4.1** | Full Realism Mode Platform Interlocks | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ? | Part A |
| **R4.2** | Full Realism Mode Cuvette & Liquid Interlocks | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ? | Part D |
| **R4.3** | Guided Snap Mode Ghost Mesh & 0.32m Attraction | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ? | Part A, B |
| **R4.4** | Skip Assembly Mode Part Auto-Placement (Parts A-D) | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ? | Part A, B, C, D |
| **R4.5** | Contextual Roadblock Guidance & Failure Feedback | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | ? | Part A, D |

---

## 3. 4-Tier Testing Methodology

### Tier 1: Feature Coverage (>=5 test cases per feature)
- Validates the nominal baseline ("happy path") and functional capabilities of all 23 features across R1, R2, R3, and R4.
- Every individual feature is backed by at least 5 distinct, rigorous assertions.
- Total Tier 1 test target: >=115 automated test cases.

### Tier 2: Boundary & Corner Cases (>=5 test cases per feature)
- Stresses extreme values, operational thresholds, clamping limits, and singular physical conditions:
  * Bench physical edges ($X = \pm 3.2$ m, $Z = \pm 1.7$ m) and floor stop limit ($Y = -0.78$ m).
  * Extreme angular rotations: exact $0.0^\circ$ optical axis, maximum $80.0^\circ$ goniometer limit, negative clamping, and over-80° saturation.
  * Laser current bounds: $0.0$ mA minimum, $25.0$ mA maximum, sub-threshold behavior ($<12.0$ mA), and exact 15.0 mA default.
  * Rapid release in air: drops from $Y = 1.5$ m, multi-drop velocity dissipation, zero bounce jitter at resting cutoff ($0.08$ m/s).
  * Screen distance travel limits ($0.55$ m minimum to $1.15$ m maximum).
  * Rapid pointer clicks and sub-pixel deadband boundaries (3.9px vs 4.1px).
- Total Tier 2 test target: >=115 automated test cases.

### Tier 3: Cross-Feature Combinations (Pairwise & System Interactions)
- Verifies non-interference and state integrity across orthogonal subsystem boundaries:
  * Physics simulation running concurrently with Full Realism, Guided Snap, and Skip Assembly modes.
  * 3D Contact GrabOffset during kit cradle extraction without scene graph reparenting jumps.
  * Interactive mouse wheel knob microadjustment during live state and optical solver synchronization.
  * Dynamic assembly mode switching while an object is being actively held in 3D space.
  * Multi-body contact resolution (cuvette resting on platform while platform rests on bench).
  * Hotkey interrupts (Escape overlay dismissal) during pointer manipulation.
- Total Tier 3 test target: >=30 automated interaction test cases.

### Tier 4: Real-World Application Scenarios (End-to-End Workflows)
- Executes full, multi-step experimental protocols simulating an international physics competitor:
  * **Part A: Single Slit Diffraction Setup**: Box unboxing under Full Realism, 4 rod unscrewing, O-ring removal, platform seating, S1 holder mounting, laser power-up at 15 mA, screen positioning at 0.84m, and central diffraction maximum verification.
  * **Part B: Thin Slide S1 Diffraction & Angular Sweep**: Calibrated 0.84m screen setup, goniometer angular sweep ($0^\circ, 10^\circ, 20^\circ, 30^\circ, 45^\circ$), optical phase difference verification $\Delta\phi(\theta)$, fringe count measurement $k(\theta)$, and beam collinearity validation.
  * **Part C: Thick Slide S2 Wave Optics & Interference**: Holder swap to S2 (1.061 mm thick slide), cylindrical lens focus carriage adjustment, dense fringe oscillation analysis, alignment loss sensitivity testing, and contrast measurement.
  * **Part D: Liquid Cuvette Refractive Index Determination**: Cuvette extraction, "One" protective film peeling, dropper bottle extraction, liquid dispensing, curved meniscus formation, optical path length shift measurement, and liquid index calculation ($n_{\text{liquid}} \approx 1.33$).

---

## 4. Test Architecture & Runner Infrastructure

- **Test Runner**: `node test_runner.cjs` (also invokable via `npm test`).
- **Compilation Engine**: `esbuild` version >=0.20 bundle mode targeting Node.js CommonJS.
- **Harness Extensions**: Global `describe`, `it`, `expect` matchers (`toBe`, `toEqual`, `toBeCloseTo`, `toBeGreaterThan`, `toBeLessThan`, `toContain`, `toThrow`, `not.*`).
- **Test File Layout**:
  - `src/experiments/ipho-2024-e2/e2e-tier1-features.test.ts` (Tier 1: Feature Coverage)
  - `src/experiments/ipho-2024-e2/e2e-tier2-boundaries.test.ts` (Tier 2: Boundary & Corner Cases)
  - `src/experiments/ipho-2024-e2/e2e-tier3-pairwise.test.ts` (Tier 3: Pairwise Cross-Feature Interactions)
  - `src/experiments/ipho-2024-e2/e2e-tier4-scenarios.test.ts` (Tier 4: Real-World Parts A, B, C, D Scenarios)
  - `src/experiments/ipho-2024-e2/physics.test.ts` (Baseline optical solver physics)
  - `src/experiments/ipho-2024-e2/state.test.ts` (Baseline state machine and actions)
  - `src/experiments/ipho-2024-e2/calibration.test.ts` (Calibration logic & error propagation)
  - `src/core/primitives/primitives.test.ts` (Catmull-Rom procedural cables)
  - `src/experiments/ipho-2024-e2/interaction.test.ts` (Pointer and camera interactions)
- **Quality Gates**:
  - 100% test pass rate across all suites.
  - Zero TypeScript compilation errors on `npm run build`.
  - Zero flaky tests or race conditions.
