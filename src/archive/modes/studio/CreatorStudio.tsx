import React, { useState } from 'react';
import {
  Wrench,
  Layers,
  Settings,
  FileText,
  Download,
  Play,
  Plus,
  Check,
  Package,
  Zap,
  Sparkles,
  Upload
} from '../../components/icons/Icons';
import { PhOLabPackage, PhOLabComponentManifest } from '../../types/pholab';

interface CreatorStudioProps {
  initialPackage: PhOLabPackage;
  onSavePackage: (pkg: PhOLabPackage) => void;
  onTestInLab: (pkg: PhOLabPackage) => void;
}

const AVAILABLE_CATALOG_COMPONENTS: PhOLabComponentManifest[] = [
  {
    id: 'sand_bowl',
    name: 'Tigela Rasa com Areia Fina (b)',
    category: 'granular',
    icon: 'Disc',
    description: 'Recipiente para estudo de crateras de impacto e penetração de projéteis.',
    inKitBox: false,
    properties: { diameterCm: 22, depthCm: 6 }
  },
  {
    id: 'steel_balls',
    name: 'Esferas de Aço Calibradas (d)',
    category: 'granular',
    icon: 'CircleDot',
    description: 'Conjunto de 4 esferas (2.0mm a 16.0mm) de densidade 7.8 g/cm³.',
    inKitBox: true,
    properties: { count: 6, densityKgM3: 7800 }
  },
  {
    id: 'aluminum_rail',
    name: 'Trilho de Alumínio em V de 1m (h)',
    category: 'supports',
    icon: 'Spline',
    description: 'Trilho para aceleração com rolamento puro e inclinação ajustável.',
    inKitBox: false,
    properties: { lengthCm: 100, defaultAngleDeg: 5.0 }
  },
  {
    id: 'wooden_track',
    name: 'Calha de Madeira com Areia (j)',
    category: 'granular',
    icon: 'Layers',
    description: 'Pista horizontal preenchida com areia para estudo de frenagem granular.',
    inKitBox: false,
    properties: { lengthCm: 60, widthCm: 10 }
  },
  {
    id: 'chronometer',
    name: 'Cronômetro Digital de Precisão (k)',
    category: 'sensors',
    icon: 'Timer',
    description: 'Instrumento digital com resolução de centésimos de segundo (0.01 s).',
    inKitBox: true,
    properties: { precisionS: 0.01 }
  },
  {
    id: 'millimeter_ruler',
    name: 'Régua Acrílica Transparente (o)',
    category: 'measuring',
    icon: 'RulerHorizontal',
    description: 'Régua milimetrada de 30 cm para nivelamento e leitura de diâmetros.',
    inKitBox: true,
    properties: { lengthCm: 30, precisionMm: 0.5 }
  },
  {
    id: 'holding_stand',
    name: 'Suporte de Haste e Guia de Altura (f)',
    category: 'supports',
    icon: 'Anchor',
    description: 'Base de madeira com haste vertical graduada e parafuso borboleta.',
    inKitBox: false,
    properties: { maxDropHeightCm: 100 }
  },
  {
    id: 'tape_measure',
    name: 'Trena Métrica Flexível de 3m (e)',
    category: 'measuring',
    icon: 'Ruler',
    description: 'Trena de alta precisão para medidas de até 300 cm.',
    inKitBox: true,
    properties: { rangeM: 3, precisionMm: 1 }
  }
];

export const CreatorStudio: React.FC<CreatorStudioProps> = ({
  initialPackage,
  onSavePackage,
  onTestInLab,
}) => {
  const [pkg, setPkg] = useState<PhOLabPackage>(initialPackage);
  const [activeCatalogTab, setActiveCatalogTab] = useState<'granular' | 'supports' | 'measuring' | 'sensors'>('granular');

  const handleToggleComponent = (comp: PhOLabComponentManifest) => {
    setPkg((prev) => {
      const exists = prev.components.some((c) => c.id === comp.id);
      return {
        ...prev,
        components: exists
          ? prev.components.filter((c) => c.id !== comp.id)
          : [...prev.components, comp],
      };
    });
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.id || 'custom-experiment'}.pholab`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studio-container">
      {/* Left Parts Catalog (KSP VAB Style) */}
      <div className="studio-parts-catalog">
        <div className="catalog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={14} color="var(--ksp-amber)" />
            <span>Paleta de Peças (KSP VAB)</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {pkg.components.length} no Kit
          </span>
        </div>

        <div className="catalog-tabs">
          <button
            className={`catalog-tab-btn ${activeCatalogTab === 'granular' ? 'active' : ''}`}
            onClick={() => setActiveCatalogTab('granular')}
          >
            Mecânica
          </button>
          <button
            className={`catalog-tab-btn ${activeCatalogTab === 'supports' ? 'active' : ''}`}
            onClick={() => setActiveCatalogTab('supports')}
          >
            Suportes
          </button>
          <button
            className={`catalog-tab-btn ${activeCatalogTab === 'measuring' ? 'active' : ''}`}
            onClick={() => setActiveCatalogTab('measuring')}
          >
            Medição
          </button>
          <button
            className={`catalog-tab-btn ${activeCatalogTab === 'sensors' ? 'active' : ''}`}
            onClick={() => setActiveCatalogTab('sensors')}
          >
            Sensores
          </button>
        </div>

        <div className="catalog-items-list">
          {AVAILABLE_CATALOG_COMPONENTS.filter((c) => c.category === activeCatalogTab).map((comp) => {
            const isIncluded = pkg.components.some((c) => c.id === comp.id);
            return (
              <div
                key={comp.id}
                className={`catalog-item-card ${isIncluded ? 'included' : ''}`}
                onClick={() => handleToggleComponent(comp)}
              >
                <div className="catalog-item-icon">
                  {isIncluded ? <Check size={16} color="#10b981" /> : <Plus size={16} />}
                </div>
                <div className="catalog-item-info">
                  <div className="catalog-item-name">{comp.name}</div>
                  <div className="catalog-item-desc">{comp.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Inspector / Physics Configuration */}
      <div className="studio-center-area">
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
              Oficina de Formulação de Experimentos
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              Configure as grandezas físicas, ruídos estocásticos e enunciados da sua prova olímpica.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ksp-action" onClick={handleExport}>
              <Download size={14} />
              <span>Exportar Pacote .pholab</span>
            </button>
            <button className="btn-ksp-action primary" onClick={() => onTestInLab(pkg)}>
              <Play size={14} />
              <span>Testar no Laboratório 3D</span>
            </button>
          </div>
        </div>

        {/* 1. Identification Card */}
        <div className="studio-panel-card">
          <div className="studio-panel-title">
            <Package size={15} />
            <span>1. Identificação da Prova & Metadados</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Título do Experimento</label>
              <input
                className="form-input"
                type="text"
                value={pkg.title}
                onChange={(e) => setPkg({ ...pkg, title: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Olimpíada de Origem</label>
              <input
                className="form-input"
                type="text"
                value={pkg.olympiad}
                onChange={(e) => setPkg({ ...pkg, olympiad: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label className="form-label">Duração (Min)</label>
              <input
                className="form-input"
                type="number"
                value={pkg.durationMinutes}
                onChange={(e) => setPkg({ ...pkg, durationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Resumo da Tarefa Experimental</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60 }}
              value={pkg.summary}
              onChange={(e) => setPkg({ ...pkg, summary: e.target.value })}
            />
          </div>
        </div>

        {/* 2. Physics & Hidden Truths Card */}
        <div className="studio-panel-card">
          <div className="studio-panel-title">
            <Zap size={15} />
            <span>2. Constantes Físicas & Verdades Ocultas (Gabarito)</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prefator Lei de Potência (D = A·(mh)^B)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={pkg.hiddenTruths.power_law_prefactor || 6.92}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    hiddenTruths: { ...pkg.hiddenTruths, power_law_prefactor: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expoente Teórico (B = 0.25)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={pkg.hiddenTruths.power_law_exponent || 0.25}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    hiddenTruths: { ...pkg.hiddenTruths, power_law_exponent: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Coef. Atrito Efetivo Areia (μ_eff)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={pkg.hiddenTruths.sand_effective_friction_mu || 0.80}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    hiddenTruths: { ...pkg.hiddenTruths, sand_effective_friction_mu: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* 3. Stochastic Noise Calibration Card */}
        <div className="studio-panel-card">
          <div className="studio-panel-title">
            <Settings size={15} />
            <span>3. Calibração de Incertezas Experimentais & Ruído Estocástico (σ)</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Dispersão de Medição de Régua: {pkg.stochasticNoise.measurementSigmaPercent}%
              </label>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={pkg.stochasticNoise.measurementSigmaPercent}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    stochasticNoise: { ...pkg.stochasticNoise, measurementSigmaPercent: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Jitter de Cronometragem Humana: {pkg.stochasticNoise.environmentalJitter}s
              </label>
              <input
                type="range"
                min="0.01"
                max="0.10"
                step="0.005"
                value={pkg.stochasticNoise.environmentalJitter}
                onChange={(e) =>
                  setPkg({
                    ...pkg,
                    stochasticNoise: { ...pkg.stochasticNoise, environmentalJitter: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* 4. PDF Task Document */}
        <div className="studio-panel-card">
          <div className="studio-panel-title">
            <FileText size={15} />
            <span>4. Caderno de Prova & Anexo de PDF Oficial</span>
          </div>

          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            O arquivo <code>.pholab</code> inclui o enunciado completo com {pkg.taskDocument.totalPages} páginas e o Marking Scheme com critérios de pontuação associados.
          </p>
        </div>
      </div>
    </div>
  );
};
