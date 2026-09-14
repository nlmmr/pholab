import { ExamChallenge } from '../physics/types';
import { ExamSeedPRNG } from '../physics/ExamSeedPRNG';

/**
 * Creates an official IPhO-style challenge with hidden seed-dependent truths
 */
export function createIPhOPilotChallenge(seed: string): ExamChallenge {
  const prng = new ExamSeedPRNG(seed);

  // Hidden exact parameters determined by seed (teacher grading key)
  const trueTrackPitchNm = Math.round(prng.range(1550, 1680)); // e.g. ~1.6 um optical disc track pitch
  const trueWavelengthNm = 532.0 + prng.range(-0.4, 0.4);
  const trueLinesPerMm = 1e6 / trueTrackPitchNm; // ~600 lines/mm

  return {
    id: 'ipho-diffraction-challenge',
    title: 'Medição Interferométrica da Constante de Rede e Comprimento de Onda',
    olympiadSource: 'IPhO Experimental Competition (Adaptado)',
    examDurationMinutes: 180, // 3 horas
    seed,
    taskSummary:
      'Determine com precisão a densidade de linhas (d) da rede de difração e o passo de trilha do meio óptico através da medição dos ângulos de desvio de ordens m = ±1, ±2 no banco óptico. Analise a propagação de incertezas e erros de calibração do micrômetro transversal.',
    kitItems: [
      {
        id: 'rail-1000',
        name: 'Trilho Óptico Métrico (1000 mm)',
        type: 'laser_source', // Carrier container
        initialInBox: false, // Already on desk
        description: 'Trilho de alumínio anodizado de 1000 mm com graduação milimétrica e pés de apoio niveladores.'
      },
      {
        id: 'diode-laser-green',
        name: 'Fonte Laser Diodo (532 nm / 5 mW)',
        type: 'laser_source',
        initialInBox: true,
        description: 'Emissor laser semicondutor colimado com interruptor de chave e suporte pós-montado.'
      },
      {
        id: 'diffraction-grating-target',
        name: 'Rede de Difração em Suporte Giratório',
        type: 'diffraction_grating',
        initialInBox: true,
        description: 'Amostra de rede de difração holográfica para determinação do passo d.',
        defaultParams: {
          slitWidthUm: 40,
          linesPerMm: Math.round(trueLinesPerMm)
        }
      },
      {
        id: 'single-slit-aperture',
        name: 'Fenda Simples de Calibração (a = 80 µm)',
        type: 'single_slit',
        initialInBox: true,
        description: 'Fenda metálica calibrada para estudo do envelope de difração de Fraunhofer.',
        defaultParams: {
          slitWidthUm: 80
        }
      },
      {
        id: 'double-slit-aperture',
        name: 'Fenda Dupla de Young (a = 50 µm, d = 250 µm)',
        type: 'double_slit',
        initialInBox: true,
        description: 'Fenda dupla para interferência de dois feixes e determinação de franjas.',
        defaultParams: {
          slitWidthUm: 50,
          slitSeparationUm: 250
        }
      },
      {
        id: 'polarizer-rotary',
        name: 'Filtro Polarizador Linear com Escala 360°',
        type: 'polarizer',
        initialInBox: true,
        description: 'Disco polaróide montado em anel graduado de 0° a 360° com resolução de 1°.',
        defaultParams: {
          angleDegrees: 0,
          extinctionRatio: 1.5e-4
        }
      },
      {
        id: 'photodetector-micrometer-stage',
        name: 'Estágio Micrométrico com Fotodetector',
        type: 'photodetector_stage',
        initialInBox: true,
        description: 'Detector de estado sólido com fenda coletora de 0.2 mm acoplada a um micrômetro transversal com tambor de 0.01 mm.'
      },
      {
        id: 'projection-screen-mm',
        name: 'Anteparo de Projeção com Malha Milimetrada',
        type: 'projection_screen',
        initialInBox: true,
        description: 'Tela branca fosca com quadrícula milimétrica para inspeção visual direta de franjas.'
      }
    ],
    hiddenTruth: {
      trackPitchNm: trueTrackPitchNm,
      exactWavelengthNm: trueWavelengthNm,
      gratingLinesPerMm: trueLinesPerMm
    }
  };
}
