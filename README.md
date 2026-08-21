# PhOLab

PhOLab is a web laboratory for practising the experimental skills used in international physics olympiads. The central product rule is simple: participants manipulate and read the apparatus instead of controlling an animation with form sliders.

## Current experiment

**IPhO 2024 E2 - Diffraction from Phase Steps, Part A**

The MVP recreates the official optical kit from unpacking through data collection: fastening rods, removable platform, S1 holder, real electrical connections, laser and lens height adjustments, rotating physical protractor, observation screen, phase-step diffraction pattern, and a manual notebook for at least 25 measurements.

The implementation uses the official 2024 problem constants: glass index 1.51, air index 1.00, and red-laser wavelength 650 nm. The sample thickness remains hidden from the participant.

## Run locally

```bash
npm install
npm run dev
```

Production and test checks:

```bash
npm run build
npm test
```

## Architecture

- `src/experiments/ipho-2024-e2/` contains the experiment definition, state reducer, physics, UI, and Three.js scene.
- `src/shared/equipment/` contains reusable laboratory UI such as the experimental notebook.
- `src/components/3d/` contains the small shared Three.js interaction layer retained from the prototype.

The application loads an experiment; experiment logic does not live in `App.tsx`. Equipment is procedural and intentionally low-poly for mobile performance. The diffraction screen uses a 64-state precomputed phase lookup with interpolation, so no FFT runs during interaction.

## Planned next steps

Parts B, C, and D of IPhO 2024 E2 come next, followed by experiments in mechanics, electricity, and thermodynamics. Login, backend, multiplayer, grading, avatars, and sandbox authoring are intentionally outside this MVP.

Official source: [IPhO 2024 E2 problem](https://ipho.olimpicos.net/pdf/IPhO_2024_Q5.pdf).
