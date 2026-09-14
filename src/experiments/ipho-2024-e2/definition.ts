import { IPHO_2024_E2_CONFIG } from './config';

/**
 * .pholab Declarative Manifest — IPhO 2024 E2: Diffraction from Phase Steps
 * Compliant with GUIDELINES.md Section 2.3, Section 3, Section 4.1 & 4.2.
 */
export const IPHO_2024_E2_DEFINITION = {
  // Configurações básicas e constantes do exame oficial
  ...IPHO_2024_E2_CONFIG,
  formatVersion: '2.0.0',
  id: 'ipho-2024-e2',
  title: 'Diffraction from Phase Steps',
  shortTitle: 'IPhO 2024 E2',
  olympiad: 'IPhO 2024',
  year: 2024,
  country: 'Iran',
  durationMinutes: 300,
  area: 'Optics',
  format: 'Experimental',
  status: 'available',
  description:
    'Assemble the official optical kit, align a red laser with a microscope slide, and measure fringe shifts from the physical protractor.',

  // Suporte a modos de montagem
  supportedAssemblyModes: ['guided', 'realistic', 'skip'] as const,
  assemblyModes: {
    guided: {
      name: 'Guided Mode',
      description: 'Visual ghost alignment hints and generous snap tolerances.',
      snapToleranceM: 0.32,
      strictSequencing: false,
    },
    realistic: {
      name: 'Realistic Olympiad Mode',
      description: 'Physical tolerances (2-3 cm) with strict manual sequencing and tool requirements.',
      snapToleranceM: 0.08,
      strictSequencing: true,
    },
    skip: {
      name: 'Quick Practice / Skip Assembly',
      description: 'Pre-assembled apparatus for immediate optical measurement and theoretical investigation.',
      snapToleranceM: 0.50,
      strictSequencing: false,
    },
  },

  // 1. Topologia da maleta, berços de espuma e coordenadas na bancada
  topology: {
    kitBox: {
      dimensions: [1.46, 0.28, 1.28] as [number, number, number],
      benchInitialPosition: [-1.85, 0.05, 0.15] as [number, number, number],
      floorPosition: [-2.2, 0.05, 0.95] as [number, number, number],
      hingeAxis: 'x' as const,
      maxLidAngleRad: Math.PI * 0.62,
    },
    foamCutouts: {
      platformCavity: {
        id: 'plat-cavity',
        name: 'Plataforma Principal (Central)',
        position: [0, 0.21, -0.05] as [number, number, number],
        geometry: 'box' as const,
        size: [1.18, 0.08, 0.74] as [number, number, number],
        targetItem: 'platform',
      },
      s1Cavity: {
        id: 's1-cavity',
        name: 'Berço Suporte S1 (Lâmina Fina)',
        position: [-0.44, 0.21, 0.42] as [number, number, number],
        geometry: 'cylinder' as const,
        radius: 0.13,
        height: 0.08,
        targetItem: 's1',
      },
      s2Cavity: {
        id: 's2-cavity',
        name: 'Berço Suporte S2 (Lâmina Grossa)',
        position: [-0.15, 0.21, 0.42] as [number, number, number],
        geometry: 'cylinder' as const,
        radius: 0.13,
        height: 0.08,
        targetItem: 's2',
      },
      cuvetteCavity: {
        id: 'cuvette-cavity',
        name: 'Berço da Cubeta Óptica',
        position: [0.14, 0.21, 0.42] as [number, number, number],
        geometry: 'box' as const,
        size: [0.18, 0.08, 0.18] as [number, number, number],
        targetItem: 'cuvette',
      },
      bottleCavity: {
        id: 'bottle-cavity',
        name: 'Berço Frasco Líquido Rosa',
        position: [0.44, 0.21, 0.42] as [number, number, number],
        geometry: 'cylinder' as const,
        radius: 0.075,
        height: 0.08,
        targetItem: 'bottle',
      },
      screenCavity: {
        id: 'screen-cavity',
        name: 'Berço do Anteparo Milimetrado',
        position: [0.38, 0.21, -0.42] as [number, number, number],
        geometry: 'box' as const,
        size: [0.52, 0.06, 0.22] as [number, number, number],
        targetItem: 'screen',
      },
      electronicsCavity: {
        id: 'elec-cavity',
        name: 'Berço da Placa Laser Controller com LCD',
        position: [-0.38, 0.21, -0.42] as [number, number, number],
        geometry: 'box' as const,
        size: [0.48, 0.06, 0.22] as [number, number, number],
        targetItem: 'electronics',
      },
    },
    workbenchInitialCoordinates: {
      kit: [-1.85, 0.15] as [number, number],
      platform: [0.05, -0.08] as [number, number],
      screen: [1.34, 0.0] as [number, number],
      electronics: [-0.08, 0.82] as [number, number],
      powerBank: [0.55, 0.82] as [number, number],
      bottle: [-1.05, 0.82] as [number, number],
      paper: [1.4, 0.78] as [number, number],
      s1: [0.90, 0.35] as [number, number],
      s2: [0.90, 0.65] as [number, number],
      cuvette: [0.50, 0.35] as [number, number],
    },
  },

  // 2. Equipamentos e Primitivas Mecânicas/Instrumentais Universais (GUIDELINES.md Section 3)
  equipment: {
    // Compatibilidade reversa com listas existentes
    shared: [
      'cable',
      'power bank',
      'switch',
      'adjustment knob',
      'red laser',
      'convex lens',
      'observation screen',
      'experimental notebook',
    ],
    specific: [
      'optics equipment box',
      'main platform',
      'rotating protractor',
      'S1 thin-slide holder',
      'S2 thick-slide holder',
      'unknown-liquid container',
    ],

    // Mapeamento explícito de primitivas
    sockets: [
      {
        id: 'stage-slide-socket',
        name: 'Rotating Stage Slide Socket',
        primitive: 'SocketPort',
        accepts: ['s1', 's2'],
        pinCount: 4,
        toleranceRadius: 0.04,
      },
      {
        id: 'stage-cuvette-socket',
        name: 'Rotating Stage Cuvette Socket',
        primitive: 'SocketPort',
        accepts: ['cuvette'],
        pinCount: 4,
        toleranceRadius: 0.04,
      },
      {
        id: 'laser-rail-guide',
        name: 'Laser Vertical Rail Guide',
        primitive: 'LinearRailGuide',
        axis: 'y',
        minVal: 0.18,
        maxVal: 0.52,
      },
      {
        id: 'lens-rail-guide',
        name: 'Cylindrical Lens Vertical Rail Guide',
        primitive: 'LinearRailGuide',
        axis: 'y',
        minVal: 0.18,
        maxVal: 0.52,
      },
      {
        id: 'board-power-jack',
        name: 'USB-C 5V Power Jack Port',
        primitive: 'CableJackPort',
        type: 'usb_c',
      },
      {
        id: 'board-laser-jack',
        name: 'Laser Diode Output Terminal Port',
        primitive: 'CableJackPort',
        type: 'laser_cable',
      },
    ],

    fasteners: [
      {
        id: 'fastening-0',
        name: 'White Fastening Rod #1',
        primitive: 'Fastener',
        type: 'threaded',
        totalTurns: 3.0,
        pitchMm: 1.5,
        label: 'OPEN',
      },
      {
        id: 'fastening-1',
        name: 'White Fastening Rod #2',
        primitive: 'Fastener',
        type: 'threaded',
        totalTurns: 3.0,
        pitchMm: 1.5,
        label: 'OPEN',
      },
      {
        id: 'fastening-2',
        name: 'White Fastening Rod #3',
        primitive: 'Fastener',
        type: 'threaded',
        totalTurns: 3.0,
        pitchMm: 1.5,
        label: 'OPEN',
      },
      {
        id: 'fastening-3',
        name: 'White Fastening Rod #4',
        primitive: 'Fastener',
        type: 'threaded',
        totalTurns: 3.0,
        pitchMm: 1.5,
        label: 'OPEN',
      },
      {
        id: 'red-orings',
        name: 'Elastic Transport Retaining O-Rings',
        primitive: 'Fastener',
        type: 'elastic_oring',
        color: '#dc2626',
      },
    ],

    knobs: [
      {
        id: 'rotation-knob',
        name: 'Goniometer Protractor Stage Dial',
        primitive: 'RotaryDial',
        minDeg: -80,
        maxDeg: 80,
        gearRatio: 0.15,
        stepSoundDeg: 1.0,
      },
      {
        id: 'laser-height-knob',
        name: 'Laser Height Thumbwheel',
        primitive: 'LinearSlider',
        minVal: 0.18,
        maxVal: 0.52,
        sensitivity: 0.0032,
      },
      {
        id: 'lens-height-knob',
        name: 'Cylindrical Lens Height Thumbwheel',
        primitive: 'LinearSlider',
        minVal: 0.18,
        maxVal: 0.52,
        sensitivity: 0.0032,
      },
      {
        id: 'current-knob',
        name: 'Laser Current Potentiometer',
        primitive: 'RotaryDial',
        minVal: 0.0,
        maxVal: 25.0,
        stepVal: 0.1,
        unit: 'mA',
      },
    ],

    displays: [
      {
        id: 'electronics-display',
        name: 'Laser Current LCD Monitor',
        primitive: 'DigitalDisplay',
        widthM: 0.22,
        heightM: 0.08,
        textColor: '#60a5fa',
        bgColor: '#1e3a8a',
        defaultText: 'READY',
      },
    ],

    containers: [
      {
        id: 'kit-case',
        name: 'Optics Equipment Transport Case',
        primitive: 'Hinge',
        hasLid: true,
      },
      {
        id: 'pink-bottle',
        name: 'Dropper Bottle (Unknown Pink Liquid)',
        primitive: 'FluidMediumContainer',
        hasCap: true,
      },
      {
        id: 'cuvette',
        name: 'Precision Optical Cuvette',
        primitive: 'FluidMediumContainer',
        wallMaterialType: 'optical_acrylic',
        wallIor: 1.491,
        pathLengthMm: 10.0,
        hasPeelFilm: true,
        hasLiquid: true,
        hasMeniscus: true,
      },
    ],

    plugs: [
      {
        id: 's1-holder',
        name: 'S1 Thin-Slide Holder',
        primitive: 'Plug',
        type: 's1',
        pinCount: 4,
        targetSocket: 'stage-slide-socket',
      },
      {
        id: 's2-holder',
        name: 'S2 Thick-Slide Holder',
        primitive: 'Plug',
        type: 's2',
        pinCount: 4,
        targetSocket: 'stage-slide-socket',
      },
      {
        id: 'cuvette-feet',
        name: 'Cuvette Snap Alignment Feet',
        primitive: 'Plug',
        type: 'cuvette',
        pinCount: 4,
        targetSocket: 'stage-cuvette-socket',
      },
    ],
  },

  // 3. Parâmetros Físicos Nominais e Gabarito Oculto (GUIDELINES.md Section 4.2)
  physics: {
    nominalConstants: {
      wavelengthNm: 650,
      wavelengthM: 650e-9,
      glassIndex: 1.51,
      ambientIndex: 1.00,
    },
    hiddenTruthBenchmarks: {
      hiddenSlideThicknessS1Mm: 0.1489, // 148.9 µm
      hiddenSlideThicknessS2Mm: 1.061,  // 1061 µm
      hiddenLiquidIndexN: 1.332,        // Líquido rosa desconhecido
      hiddenSlideThicknessMm: 0.1489,   // Compatibilidade reversa
      markingSchemeSlopes: {
        partA_B_S1: 229.1,
        partB_B_S2: 275.7,
        partC_B_Liquid: 128.0,
      },
    },
    stochasticNoise: {
      measurementSigmaPercent: 0.015,
      environmentalJitter: 0.005,
    },
  },
} as const;

export type IPhO2024E2Definition = typeof IPHO_2024_E2_DEFINITION;
