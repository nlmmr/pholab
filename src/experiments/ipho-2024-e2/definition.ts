import { IPHO_2024_E2_CONFIG } from './config';

export const IPHO_2024_E2_DEFINITION = {
  ...IPHO_2024_E2_CONFIG,
  area: 'Optics',
  format: 'Experimental',
  status: 'available',
  description:
    'Assemble the official optical kit, align a red laser with a microscope slide, and measure fringe shifts from the physical protractor.',
  equipment: {
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
  },
} as const;
