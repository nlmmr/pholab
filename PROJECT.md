# Project: PhOLab 2.0 - Visual & Mechanical Realism (IPhO 2024)

## Architecture
PhOLab 2.0 is an interactive optical physics laboratory simulation built on React, Three.js, and TypeScript.
The architecture is structured into four primary modular layers:
1. **Visual & 3D Asset Layer (`src/core/assets/` & `src/experiments/ipho-2024-e2/scene/`)**:
   - `AssetRegistry` and `MeshFactory` providing high-fidelity procedural generation and future `.gltf` model extensibility.
   - Exact physical proportions and PBR materials based on official IPhO 2024 photographs (case cradle, optical platform with 3-ring goniometer, 4 chrome columns for S1/S2, official silkscreen controller with rocker switch and green Euroblock terminal, acrylic cuvette with "One" peelable film, pink dropper bottle with white screw cap, grooved base screen).
2. **Physics & Collision Layer (`src/core/physics/`)**:
   - Deterministic, zero-dependency rigid body engine (`RigidBodySimulator`) running at 120 Hz Symplectic Euler sub-stepping.
   - Solid colliders: Oriented Bounding Boxes (OBB with 15-axis SAT) and upright Cylinders for all movable apparatus.
   - Static environment boundaries: Lab benchtop ($Y=0, X \in [-3.2, 3.2], Z \in [-1.7, 1.7]$), Floor ($Y=-0.78$ m), and kit box walls.
   - Dynamic gravity ($g = 9.81\text{ m/s}^2$), inelastic impact restitution ($e \le 0.25$), non-clipping impulse resolution.
3. **Ergonomics & Controls Layer (`src/components/3d/controls/` & `src/experiments/ipho-2024-e2/scene/IPhO2024E2Engine.ts`)**:
   - `SimpleOrbitControls`: MMB pan smoothed with `panSpeed = 0.00040` (66.7% reduction) and inertial damping (`panDelta`); LMB orbit vs single-click selection deconflicted via 4px movement threshold.
   - `IPhO2024E2Engine`: Grab offset calculation bug fixed using true 3D contact vector $\mathbf{r}_{\text{offset}} = \mathbf{P}_{\text{object}} - \mathbf{P}_{\text{hit}}$; mid-drag reparenting glitch prevented in `sync()`; `Alt + LMB` isolated as the exclusive 3D grab/drag modifier; mouse wheel knob microadjustments (angle $\pm 0.25^\circ$, current $\pm 0.1\text{ mA}$).
4. **Assembly Modes & Interlocks Layer (`src/experiments/ipho-2024-e2/state.ts` & `IPhO2024E2Engine.ts`)**:
   - Unified physics and controls across Full Realism, Guided Snap, and Skip Assembly modes.
   - Full Realism mode enforces 4 fastener rods unscrewed, red O-rings removed, cuvette film peeled, and dropper bottle extracted.
   - Guided Snap mode provides pulsing ghost mesh guidance and magnetic snap tolerance ($0.32$ m).
   - Skip Assembly mode auto-positions apparatus for parts A, B, C, and D while preserving active physical manipulation.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | AssetRegistry & MeshFactory | Abstraction layer for procedural meshes and future .gltf/.glb loading | M1 | R1 |
| 2 | Case & Foam Cradle 3D Fidelity | Reinforced polymer case, recessed yellow insert lid, 2 orange latches, true 1:1 concave cavities | M1 | R1 |
| 3 | Fastener Rods & Retention O-rings | 4 white nylon rods with metric thread & knurled caps, seated red elastomeric O-rings | M1 | R1 |
| 4 | Optical Platform 3D Fidelity | Machined aluminum base, Allen screws, 3 concentric goniometer rings (1°, 5°/10°, bilateral 0-80°), white nylon knob, cylindrical lens | M1 | R1 |
| 5 | Holders S1 & S2 3D Fidelity | 4 mirror chrome columns, circular base ring, black clamp, thin S1 (149 µm) and thick S2 (1.061 mm) slides | M1 | R1 |
| 6 | Cuvette & Dropper Bottle Fidelity | Crystalline acrylic cuvette, "One" peelable film, pink liquid meniscus, pink translucent bottle with white screw cap | M1 | R1 |
| 7 | Electronic Controller & Power Bank | White ABS chassis, IPhO 54th silkscreen, On/Off rocker switch, turned aluminum knob, green Euroblock terminal, black power bank | M1 | R1 |
| 8 | Observation Screen Fidelity | Anodized gray metal frame, grooved base with clamping screws, flat matte white projection surface | M1 | R1 |
| 9 | Rigid Body Dynamics Engine | Deterministic 120 Hz Symplectic Euler physics engine with gravity g = 9.81 m/s^2 | M2 | R2 |
| 10 | Solid Colliders (OBB & Cylinder) | 15-axis SAT OBB for boxes/slabs, collidable cylinders for bottle/holders | M2 | R2 |
| 11 | Environment Non-Clipping | Tabletop (Y=0), Floor (Y=-0.78m), and box wall non-clipping boundaries | M2 | R2 |
| 12 | Inelastic Restitution & Damping | Bouncing with e <= 0.25, resting velocity cutoff (0.08 m/s), zero jitter at rest | M2 | R2 |
| 13 | Grab Offset Bug Fix | Fix grabOffset = object.position - raycastHit.point, fix mid-drag reparenting in sync() | M3 | R3 |
| 14 | MMB Camera Pan Smoothing | panSpeed = 0.00040 (66.7% reduction) with panDelta inertial damping | M3 | R3 |
| 15 | LMB Orbit vs Select Deconfliction | Single click selects without camera movement; orbit requires >4px drag threshold | M3 | R3 |
| 16 | Alt+LMB Exclusive Drag Command | Sole command for 3D item elevation and movement, with configurable 3D elevation | M3 | R3 |
| 17 | Scroll Wheel Knob Microadjustment | Knob hover intercepts wheel for fine angle (+-0.25°) and current (+-0.1 mA) adjustments | M3 | R3 |
| 18 | Assembly Modes Harmonization | Unified physics and controls across Full Realism, Guided Snap, and Skip Assembly | M3 | R4 |
| 19 | Assembly Interlocks Enforcement | Enforce 4 loose rods, removed O-rings, peeled cuvette, and extracted bottle in Full Realism | M3 | R4 |
| 20 | E2E Automated Test Suite & QA | 100% test pass on node test_runner.cjs and clean npm run build with zero TS errors | M4 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | 3D Visual & Proportional Fidelity | AssetRegistry, MeshFactory, Case & Foam, Rods & O-rings, Platform, S1/S2, Cuvette/Bottle, Controller, Screen | None | DONE (AssetRegistry + 9/9 test suites pass, zero build errors) |
| M2 | Rigid Body Physics, Gravity & Collisions | src/core/physics/ (OBB SAT, Cylinder, Planes, 120Hz engine, g=9.81, restitution, non-clipping, unit tests) | None | DONE (25/25 tests pass, zero build errors) |
| M3 | Controls Unification, Camera Damping, Grab Offset & Assembly Interlocks | SimpleOrbitControls damping/thresholds, IPhO2024E2Engine grabOffset 3D fix & sync() reparenting fix, wheel microadjustment, Alt+LMB exclusivity, mode interlocks | M1, M2 | DONE (368/368 tests pass, zero build errors) |
| M4 | System Integration, E2E Test Suite & Adversarial Verification | Full E2E tests across Tiers 1-5, node test_runner.cjs 100% pass, npm run build clean compilation, forensic audit | M1, M2, M3 | IN_PROGRESS (Gate verification: Reviewers, Challengers, Auditor) |

## Interface Contracts
### AssetRegistry ↔ Engine
- `AssetRegistry.registerAsset(descriptor: AssetDescriptor)`
- `AssetRegistry.create(assetId: string): THREE.Object3D`
- Each asset defines `collision: AssetCollisionVolume` (dimensions, type: 'obb' | 'cylinder', offset) consumed by `RigidBodySimulator`.

### Physics Engine (`src/core/physics/`) ↔ Engine (`IPhO2024E2Engine.ts`)
- `RigidBodySimulator.step(dt: number)`
- `RigidBodySimulator.addBody(body: RigidBody)`
- `RigidBodySimulator.setBodyPosition(id: string, pos: THREE.Vector3)`
- `RigidBody.isHeld`: When dragged by Alt+LMB, body position is directly updated; when released, dynamic gravity and collisions resume.
- Environment limits: Table top at $Y=0$, Floor at $Y=-0.78$, Box rim at $Y_{\text{box}} + 0.28$.

### Controls (`SimpleOrbitControls.ts`) ↔ Engine (`IPhO2024E2Engine.ts`)
- Wheel event delegation: If pointer hovers over an interactive knob (`userData.interactionId`), wheel event adjusts value and stops propagation; otherwise passes to camera zoom.
- Orbit drag threshold: Movements $\le 4$ px do not trigger camera rotation, preserving single-click selection.

## Code Layout
- `src/core/assets/`: `AssetRegistry.ts`, `MeshFactory.ts`, `types.ts`, procedural mesh generators.
- `src/core/physics/`: `colliders/OBBCollider.ts`, `colliders/CylinderCollider.ts`, `colliders/PlaneCollider.ts`, `RigidBody.ts`, `RigidBodySimulator.ts`.
- `src/components/3d/controls/SimpleOrbitControls.ts`: Damped pan, orbit deadband threshold.
- `src/experiments/ipho-2024-e2/scene/IPhO2024E2Engine.ts`: Integration of AssetRegistry, physics step in `animate()`, 3D grabOffset, Alt+LMB exclusivity, wheel microadjustments.
- `src/experiments/ipho-2024-e2/state.ts`: Assembly modes and interlock rules.
- `test_runner.cjs`: Automated test suite runner.
