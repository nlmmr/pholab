# PhOLab 2.0 · Real Olympiad Experiments

[![Deploy to GitHub Pages](https://github.com/nlmmr/pholab/actions/workflows/deploy.yml/badge.svg)](https://github.com/nlmmr/pholab/actions/workflows/deploy.yml)
[![Tests: 100% Passed](https://img.shields.io/badge/tests-153%20passed-brightgreen.svg)](test_runner.cjs)

PhOLab is a high-fidelity virtual physics laboratory for practicing the rigorous experimental skills required in the International Physics Olympiad (IPhO). The central philosophy is hands-on physical realism: students assemble, align, wire, and read genuine experimental apparatus directly in 3D rather than manipulating arbitrary sliders.

🌐 **Live Simulation:** [https://nlmmr.github.io/pholab/](https://nlmmr.github.io/pholab/)

---

## Current Experiment

### **IPhO 2024 E2 — Diffraction from Phase Steps (Parts A, B, C & D)**

Faithful interactive recreation of the official optical apparatus from the 54th International Physics Olympiad (Isfahan, 2024):

- **Three-Tier Assembly Mechanics:**
  - `Guided Snap`: Assisted assembly with glowing translucent ghost meshes and automatic magnetic alignment.
  - `Full Realism`: Authentic competition sequence with strict safety interlocks (loosening 4 threaded fastening rods, removing red transport O-rings, peeling cuvette protective adhesive film before pouring, and manual unboxing/storing).
  - `Skip Assembly`: Instant apparatus presets for rapid physics data collection across Parts A, B, C, and D.
- **Procedural PBR Realism:**
  - Zero external GLTF assets: procedural knurled knobs with bump/roughness canvas maps, brushed steel vertical posts, anodized aluminum faceplates with official serigraphy, crystal acrylic cuvettes with physical transmission ($IOR = 1.51$), curved liquid meniscus, and high-resolution 2048×2048 circular protractor goniometer.
- **Physical Fresnel Diffraction & Speckle:**
  - High-precision optical pattern rendering matching Figure 7 of the official IPhO 2024 exam, featuring central phase discontinuity, fringe modulation, Gaussian envelope, and realistic 650 nm laser speckle.
- **Calibrated 2D Viewport Overlay Ruler & Caliper:**
  - Draggable and rotatable on-screen measurement tool (`R` hotkey) dynamically calibrated in real time against the Three.js Perspective camera projection (mm/pixel).
- **Kinematic & Cabling Dynamics:**
  - Procedural flexible Catmull-Rom catenary cables for laser output and 5V USB power bank.
  - Full bidirectional spatial synchronization: moving the observation screen on the bench dynamically recalculates $D = X_{\text{screen}} - X_{\text{laser}}$ and modulates diffraction fringes in real time, while maintaining perfect collinear beam alignment.
- **Manual Measurement Notebook:**
  - Complete data recording table supporting at least 25 measurements per part, with official IPhO 2024 truth benchmarks.

---

## Run Locally

```bash
npm install --legacy-peer-deps
npm run dev
```

The laboratory will launch at [http://127.0.0.1:3000/](http://127.0.0.1:3000/).

### Automated Verification & Production Build

```bash
npm test        # Runs 153 automated tests across physics, state, calibration, primitives, and interactions
npm run build   # Production bundle with zero TypeScript compilation errors
```

---

## Architecture

- `src/experiments/ipho-2024-e2/`: Complete IPhO 2024 E2 experiment implementation (declarative `.pholab` definition, analytical Fresnel solver, state reducer, and Three.js engine).
- `src/core/primitives/`: Modular universal physical primitives (`SocketPort`, `FluidMediumContainer`, `FastenerEntity`, `HingeEntity`, `LinearSliderEntity`, `RotaryDialEntity`, `DigitalDisplayMesh`).
- `src/components/`: Calibrated HUD tools (`HUDOverlayRuler.tsx`) and shared 3D controls.
- `src/shared/equipment/`: Laboratory equipment UI (interactive scientific measurement notebook).

---

Official problem source: [IPhO 2024 E2 Problem Sheet](https://ipho.olimpicos.net/pdf/IPhO_2024_Q5.pdf).

