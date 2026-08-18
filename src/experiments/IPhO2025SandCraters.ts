import { PhOLabPackage } from '../types/pholab';

export const IPHO_2025_SAND_CRATERS_PACKAGE: PhOLabPackage = {
  formatVersion: '1.0.0',
  id: 'ipho-2025-sand-craters',
  title: 'Sand craters and dunes (NASA Spirit Rover on Mars)',
  olympiad: '55th International Physics Olympiad (IPhO)',
  year: 2025,
  country: 'França (France)',
  durationMinutes: 180,
  difficulty: 'IPhO / Internacional',
  physicsDomain: 'granular_mechanics_and_craters',
  summary:
    'Estudo experimental da mecânica de impacto de meteoritos em solo arenoso marciano e dinâmica de rolamento com frenagem em dunas para prevenção de atolamento do rover Spirit.',
  author: 'IPhO 2025 Academic Committee',
  createdAt: '2025-07-20T09:00:00Z',

  components: [
    {
      id: 'plastic_box',
      name: 'Caixa Plástica Coletora (a)',
      category: 'granular',
      icon: 'Box',
      description: 'Caixa de contenção para recolher o excesso de areia durante os impactos.',
      inKitBox: true,
      properties: { capacityLiters: 5, material: 'Polipropileno' }
    },
    {
      id: 'sand_bowl',
      name: 'Tigela de Areia (b)',
      category: 'granular',
      icon: 'Disc',
      description: 'Tigela rasa preenchida com areia seca e nivelada com a régua.',
      inKitBox: false,
      properties: { diameterCm: 22, depthCm: 6 }
    },
    {
      id: 'sand_bottle',
      name: 'Garrafa de Areia (c)',
      category: 'granular',
      icon: 'FlaskConical',
      description: 'Frasco com 1 kg de areia calibrada de grão fino.',
      inKitBox: true,
      properties: { sandMassG: 1000, grainSizeMm: 0.25 }
    },
    {
      id: 'steel_balls',
      name: 'Conjunto de 6 Esferas de Aço (d)',
      category: 'granular',
      icon: 'CircleDot',
      description: 'Esferas com 4 diâmetros diferentes: 2.0 mm, 5.0 mm, 9.0 mm e 16.0 mm (densidade 7800 kg/m³).',
      inKitBox: true,
      properties: { count: 6, densityKgM3: 7800 }
    },
    {
      id: 'holding_stand',
      name: 'Suporte de Haste e Ajuste de Altura (f)',
      category: 'supports',
      icon: 'Anchor',
      description: 'Base de madeira com pés de borracha, haste vertical graduada e parafuso borboleta guia.',
      inKitBox: false,
      properties: { maxDropHeightCm: 100, guideRodLengthCm: 15 }
    },
    {
      id: 'tape_measure',
      name: 'Trena Métrica de 3 metros (e)',
      category: 'measuring',
      icon: 'Ruler',
      description: 'Trena flexível para medição exata da altura de queda h até 2 metros.',
      inKitBox: true,
      properties: { rangeM: 3, precisionMm: 1 }
    },
    {
      id: 'millimeter_ruler',
      name: 'Régua Acrílica Transparente (o)',
      category: 'measuring',
      icon: 'RulerHorizontal',
      description: 'Régua milimetrada para nivelar a areia e medir o diâmetro D das crateras.',
      inKitBox: true,
      properties: { lengthCm: 30, precisionMm: 0.5 }
    },
    {
      id: 'aluminum_rail',
      name: 'Trilho de Alumínio 1m (h)',
      category: 'supports',
      icon: 'Spline',
      description: 'Trilho perfilado com calha em V para rolamento puro sem deslizamento.',
      inKitBox: false,
      properties: { lengthCm: 100, defaultAngleDeg: 5.0 }
    },
    {
      id: 'wooden_track',
      name: 'Calha de Madeira com Areia (j)',
      category: 'granular',
      icon: 'Layers',
      description: 'Pista de madeira preenchida com camada uniforme de areia para teste de frenagem.',
      inKitBox: false,
      properties: { lengthCm: 60, widthCm: 10 }
    },
    {
      id: 'chronometer',
      name: 'Cronômetro Digital de Precisão (k)',
      category: 'sensors',
      icon: 'Timer',
      description: 'Cronômetro digital com resolução de 0.01 s para medição de tempos de rolamento.',
      inKitBox: true,
      properties: { precisionS: 0.01 }
    },
    {
      id: 'stirring_spoon',
      name: 'Colher & Pincel de Nivelamento (i, n)',
      category: 'granular',
      icon: 'Utensils',
      description: 'Ferramentas para homogeneizar e descompactar a areia após cada impacto.',
      inKitBox: true,
      properties: {}
    }
  ],

  nominalParameters: {
    g_acceleration: 9.81,
    air_density_kg_m3: 1.2,
    steel_density_kg_m3: 7800,
    rail_angle_deg: 5.0,
  },

  hiddenTruths: {
    power_law_prefactor: 6.92,
    power_law_exponent: 0.25,
    sand_effective_friction_mu: 0.80,
    true_g_ms2: 9.81
  },

  stochasticNoise: {
    measurementSigmaPercent: 1.8,
    environmentalJitter: 0.04
  },

  taskDocument: {
    title: 'IPhO 2025 France — Experimental Problem Q2: Sand Craters and Dunes',
    totalPages: 13,
    pages: [
      {
        pageNumber: 1,
        title: 'Q2-1: Introduction & Equipment List',
        points: 0,
        contentMarkdown: `### NASA Spirit Rover on Mars — Sand Craters and Dunes (10.0 points)
NASA's Spirit rover landed on Mars in 2004 to study its geology and potential presence of water. The landing site is surrounded by craters of various sizes and sand dunes. During exploration, the rover must avoid getting stuck in the sand dunes of Mars.

The problem has two independent parts:
- **Part A**: Crater formation (Impact physics & power laws)
- **Part B**: Rolling and bogging in sand (Kinematics & granular friction)

#### Equipment List:
• **(a)** Plastic box (collect overflowing sand)
• **(b)** Bowl filled with sand
• **(c)** Bottle of calibrated sand
• **(d)** 6 steel balls (4 diameters: 2.0 mm, 5.0 mm, 9.0 mm, 16.0 mm)
• **(e)** Tape measure (3m)
• **(f)** Holding device (wooden tray, vertical rod, clamping screw)
• **(g)** Sieve to find small balls
• **(h)** Aluminium rail (1 m long)
• **(i)** Brush
• **(j)** Wooden track
• **(k)** Chronometer (0.01s)
• **(l)** Adhesive putty
• **(n)** Spoon for stirring
• **(o)** Transparent ruler`,
      },
      {
        pageNumber: 2,
        title: 'Q2-2: Photographs of All Equipment',
        points: 0,
        contentMarkdown: `### Apparatus Assembly
Verify all components in your physical kit box before starting. The vertical rod (f4) is fixed onto the wooden base (f1) with the clamping screw (f2) holding the horizontal guide rod (f3).`,
      },
      {
        pageNumber: 3,
        title: 'Q2-3: Part A — Impact Craters Theory',
        points: 0,
        contentMarkdown: `### Theoretical Models for Crater Diameter $D$ vs Energy $E$

Different models predict how crater diameter $D$ depends on impact parameters:
- **Model 1**: $D$ depends only on projectile diameter $d$:
  $$D = c_1 d$$
- **Model 2**: Meteorite energy $E$ converted through volumetric processes:
  $$D = c_2 E^{1/3}$$
- **Model 3**: Energy $E$ used to eject material outside the crater:
  $$D = c_3 E^{1/4}$$

#### Steel Projectile Specifications:
| Projétil | Diâmetro $d$ | Massa $m$ |
|---|---|---|
| **Ball #1** | $2.0\\text{ mm}$ | $0.033\\text{ g}$ |
| **Ball #2** | $5.0\\text{ mm}$ | $0.51\\text{ g}$ |
| **Ball #3** | $9.0\\text{ mm}$ | $3.0\\text{ g}$ |
| **Ball #4** | $16.0\\text{ mm}$ | $17.0\\text{ g}$ |`,
      },
      {
        pageNumber: 4,
        title: 'Q2-4: Question A.1 — Drop Ball #3 & Repeatability',
        points: 0.6,
        contentMarkdown: `### Task A.1 (0.6 points)
Drop ball #3 ($d = 9.0\\text{ mm}, m = 3.0\\text{ g}$) from a height $h = 50\\text{ cm}$ and measure the diameter $D$ of the crater formed. Repeat the experiment **5 times**.

> **Crucial Experimental Note**: After each impact, stir the sand with the spoon (n) and level it carefully with the edge of ruler (o). Avoid compacting the sand!`,
        solutionMarkdown: `#### Official Solution A.1:
- Measured values of $D$: $23\\text{ mm}, 24\\text{ mm}, 22\\text{ mm}, 25\\text{ mm}, 25\\text{ mm}$
- Result: **$D = (23.8 \\pm 1.2)\\text{ mm}$**
- Rubric:
  - 2 measures between 22-26mm: 0.2 pt
  - 3 more measures between 22-26mm: 0.2 pt
  - Mean between 23-25mm: 0.1 pt
  - Uncertainty between 0.5-2.0mm: 0.1 pt`,
      },
      {
        pageNumber: 5,
        title: 'Q2-5: Questions A.2 & A.3 — Air Drag & Multi-Decade Energy Scaling',
        points: 2.2,
        contentMarkdown: `### Task A.2 (0.5 points)
Determine the theoretical expression for the maximum drop height $h_{\\max}$ where air drag remains $< 10\\%$ of gravity. Calculate $h_{\\max}$ for the 4 balls.

### Task A.3 (1.7 points)
Investigate the relationship between $D$ and $E = mgh$ across at least 3.5 decades of energy ($3\\times 10^{-5}\\text{ J}$ to $0.4\\text{ J}$). Record $(m, h, E, D)$ in a structured table.`,
        solutionMarkdown: `#### Official Solution A.2:
$$h_{\\max} = 0.1 \\cdot \\frac{2}{3} \\frac{\\rho_a}{\\rho_0} \\frac{1}{C_x} d$$
Numerical values: $h_{\\max} = (0.9\\text{ m}, 2\\text{ m}, 4\\text{ m}, 7\\text{ m})$

#### Official Solution A.3:
Expected experimental fit: $D = 6.92 \\cdot (mh)^{0.25}$ ($D$ in mm, $m$ in g, $h$ in cm).`,
      },
      {
        pageNumber: 6,
        title: 'Q2-6: Question A.4 — Power Law Identification Graph',
        points: 1.2,
        contentMarkdown: `### Task A.4 (1.2 points)
Plot $\\log(D)$ vs $\\log(E)$. Add theoretical lines of slope $1/3$ and $1/4$. State which model best fits the Martian crater formation data.`,
        solutionMarkdown: `#### Official Solution A.4:
The slope is measured as **$\\alpha = 1/4 = 0.25$**, confirming **Model 3** (crater ejection mechanism).`,
      },
      {
        pageNumber: 7,
        title: 'Q2-7: Part B — Rolling Motion on Inclined Rail',
        points: 0.4,
        contentMarkdown: `### Task B.1 (0.4 points)
Express the position $x(t)$ of the rolling sphere ($J = \\frac{1}{10}md^2$) on the rail inclined at angle $\\theta$ without slipping:
$$K = \\frac{1}{2}mv^2 + \\frac{1}{2}J\\omega^2$$`,
        solutionMarkdown: `#### Official Solution B.1:
$$x(t) = \\frac{1}{1 + \\frac{4J}{md^2}} \\cdot \\frac{1}{2} g \\sin\\theta \\cdot t^2 = \\frac{5}{7} \\cdot \\frac{1}{2} g \\sin\\theta \\cdot t^2$$`,
      },
      {
        pageNumber: 8,
        title: 'Q2-8: Questions B.2 & B.3 — Chronometry & Statistical Uncertainty',
        points: 1.5,
        contentMarkdown: `### Task B.2 (0.7 points)
With $\\theta = 5^\\circ$, measure the time $t_{50}$ taken to travel $\\ell = 50\\text{ cm}$. Repeat 5 times and state the statistical uncertainty.

### Task B.3 (0.8 points)
Measure travel time $t$ for at least 8 different values of $\\ell$ from $10\\text{ cm}$ to $100\\text{ cm}$.`,
        solutionMarkdown: `#### Official Solution B.2:
- $t_{50} = (1.33 \\pm 0.04)\\text{ s}$

#### Official Solution B.3:
| $\\ell\\text{ (cm)}$ | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|
| $t\\text{ (s)}$ | $0.54$ | $0.87$ | $1.04$ | $1.16$ | $1.33$ | $1.45$ | $1.60$ | $1.71$ | $1.78$ | $1.83$ |`,
      },
      {
        pageNumber: 9,
        title: 'Q2-9: Question B.4 — Experimental Determination of g',
        points: 1.0,
        contentMarkdown: `### Task B.4 (1.0 points)
Plot $\\ell$ vs $t^2$. From the slope $\\frac{5}{14} g \\sin\\theta$, deduce an experimental estimate of $g$ with its uncertainty.`,
        solutionMarkdown: `#### Official Solution B.4:
Slope $= \\frac{5}{14} g \\sin(5^\\circ)$.
Deduced value: **$g = (9 \\pm 1)\\text{ m/s}^2$**.`,
      },
      {
        pageNumber: 10,
        title: 'Q2-10: Theory — Braking Models in Sand Track',
        points: 0.6,
        contentMarkdown: `### Motion of Ball in Sand Track
After accelerating over distance $\\ell$, the sphere enters the sand track and stops after travelling distance $L$.
- **Model #1 (Solid Friction of Coulomb)**: $T = -\\mu_{\\text{eff}} m g \\implies L \\propto \\ell^1$
- **Model #2 (Fluid Drag)**: $T = -kv \\implies L \\propto \\ell^{1/2}$

### Task B.5 (0.6 points)
Derive the analytical relationship for both models.`,
        solutionMarkdown: `#### Official Solution B.5:
- Model #1: $L = \\frac{5}{7} \\left(\\frac{\\sin\\theta}{\\mu_{\\text{eff}}}\\right) \\ell \\quad (\\alpha = 1)$
- Model #2: $L = \\frac{m}{k} \\sqrt{\\frac{5}{7} 2g \\sin\\theta} \\sqrt{\\ell} \\quad (\\alpha = 1/2)$`,
      },
      {
        pageNumber: 11,
        title: 'Q2-11: Question B.6 — Stopping Distance Measurement in Sand',
        points: 0.8,
        contentMarkdown: `### Task B.6 (0.8 points)
Release Ball #4 ($d = 16\\text{ mm}$) from $\\ell = 50\\text{ cm}$ on the $5^\\circ$ rail. Measure the stopping distance $L_{50}$ in the sand track 5 times.
*Always scrape and level the sand before each run!*`,
        solutionMarkdown: `#### Official Solution B.6:
$L_{50} = (6.4 \\pm 0.5)\\text{ cm}$ (or $3.8\\text{--}7.0\\text{ cm}$ according to grain density).`,
      },
      {
        pageNumber: 12,
        title: 'Q2-12: Question B.7 — Model Discrimination Graph',
        points: 1.5,
        contentMarkdown: `### Task B.7 (1.5 points)
Plot $L$ as a function of $\\ell$ for 8 values of $\\ell$ ($10\\text{ cm}$ to $100\\text{ cm}$). Conclude which model best describes the drag force in Martian sand dunes.`,
        solutionMarkdown: `#### Official Solution B.7:
Linear fit $L \\propto \\ell$ confirms **Model #1 (Solid Coulomb Friction)** with exponent $\\alpha = 1$.`,
      },
      {
        pageNumber: 13,
        title: 'Q2-13: Question B.8 — Effective Friction Coefficient',
        points: 0.2,
        contentMarkdown: `### Task B.8 (0.2 points)
From $L = \\frac{5}{7} \\left(\\frac{\\sin 5^\\circ}{\\mu_{\\text{eff}}}\\right) \\ell$, calculate the effective friction coefficient $\\mu_{\\text{eff}}$.`,
        solutionMarkdown: `#### Official Solution B.8:
Result: **$\\mu_{\\text{eff}} = 0.80 \\pm 0.15$** (accepted range: $0.6\\text{ to }1.0$).`,
      },
    ],
  },
};
