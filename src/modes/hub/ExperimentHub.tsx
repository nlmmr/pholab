import React, { useState } from 'react';
import {
  BookOpen,
  Play,
  Download,
  Upload,
  Clock,
  Award,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Sparkles,
  Layers,
  Plus
} from '../../components/icons/Icons';
import { PhOLabPackage } from '../../types/pholab';

interface ExperimentHubProps {
  currentPackage: PhOLabPackage;
  onStartExperiment: () => void;
  onOpenStudioNew: () => void;
  onImportPackage: (pkg: PhOLabPackage) => void;
}

export const ExperimentHub: React.FC<ExperimentHubProps> = ({
  currentPackage,
  onStartExperiment,
  onOpenStudioNew,
  onImportPackage,
}) => {
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSolution, setShowSolution] = useState(false);

  const totalPages = currentPackage.taskDocument.totalPages;
  const pageData = currentPackage.taskDocument.pages.find((p) => p.pageNumber === currentPage);

  const handleDownloadPackage = () => {
    const jsonStr = JSON.stringify(currentPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPackage.id}.pholab`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed && (parsed.id || parsed.title)) {
            // Fill any fallback metadata if missing
            const validPackage: PhOLabPackage = {
              formatVersion: parsed.formatVersion || '1.0.0',
              id: parsed.id || 'imported-experiment',
              title: parsed.title || 'Experimento Importado',
              olympiad: parsed.olympiad || 'Olimpíada de Física',
              year: parsed.year || new Date().getFullYear(),
              country: parsed.country || 'Internacional',
              durationMinutes: parsed.durationMinutes || 180,
              difficulty: parsed.difficulty || 'Avançado',
              physicsDomain: parsed.physicsDomain || 'granular_mechanics_and_craters',
              summary: parsed.summary || 'Pacote de experimento importado com sucesso.',
              author: parsed.author || 'Autor da Comunidade',
              createdAt: parsed.createdAt || new Date().toISOString(),
              components: parsed.components || currentPackage.components,
              nominalParameters: parsed.nominalParameters || currentPackage.nominalParameters,
              hiddenTruths: parsed.hiddenTruths || currentPackage.hiddenTruths,
              stochasticNoise: parsed.stochasticNoise || currentPackage.stochasticNoise,
              taskDocument: parsed.taskDocument || currentPackage.taskDocument,
            };
            onImportPackage(validPackage);
          } else {
            alert('O arquivo selecionado não contém um formato de experimento .pholab válido.');
          }
        } catch (err) {
          console.error('Erro ao importar pacote:', err);
          alert('Erro ao processar o arquivo .pholab. Verifique se o JSON está bem formatado.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="hub-container">
      {/* Header Banner (pho.rs style) */}
      <div className="hub-header">
        <div className="hub-header-title">
          <h2>Painel de Experimentos de Física</h2>
          <p>Arquivo aberto e interativo de tarefas experimentais de olimpíadas internacionais (IPhO, APhO, EuPhO).</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="btn-nav-action primary" style={{ cursor: 'pointer' }}>
            <Upload size={14} />
            <span>Importar .pholab</span>
            <input type="file" accept=".pholab,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <button className="btn-nav-action" onClick={onOpenStudioNew}>
            <Plus size={14} />
            <span>Criar Novo no Studio</span>
          </button>
        </div>
      </div>

      <div className="hub-grid">
        {/* Main Column — Available Official Challenges */}
        <div className="hub-main-column">
          <div className="hub-section-title">Experimento Oficial em Destaque</div>

          {/* IPhO 2025 Official Card */}
          <div className="experiment-card">
            <div className="experiment-card-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="experiment-badge">
                    <Award size={12} />
                    {currentPackage.olympiad} ({currentPackage.country})
                  </span>
                  <span className="experiment-badge" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>
                    Ano: {currentPackage.year}
                  </span>
                </div>
                <h3 className="experiment-card-title">{currentPackage.title}</h3>
              </div>
            </div>

            <div className="experiment-card-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} />
                Duração: {currentPackage.durationMinutes} min
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Layers size={13} />
                Domínio: Mecânica Granular e Dinâmica de Impacto
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText size={13} />
                13 Páginas (Enunciado + Marking Scheme)
              </span>
            </div>

            <p className="experiment-card-desc">{currentPackage.summary}</p>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Aparato do Kit Fornecido:
              </div>
              <div className="equipment-tags">
                {currentPackage.components.map((c) => (
                  <span key={c.id} className="equipment-tag">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="experiment-card-footer">
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-card-action secondary" onClick={() => setIsPdfModalOpen(true)}>
                  <BookOpen size={14} />
                  <span>Caderno de Prova & Solução (PDF)</span>
                </button>
                <button className="btn-card-action secondary" onClick={handleDownloadPackage}>
                  <Download size={14} />
                  <span>Baixar .pholab</span>
                </button>
              </div>

              <button className="btn-card-action primary" onClick={onStartExperiment}>
                <Play size={14} />
                <span>Realizar Experimento no Lab 3D</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Info Card (pho.rs style) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="hub-sidebar-card">
            <h3>Sobre o PhOLab</h3>
            <p>
              O PhOLab foi projetado para reproduzir com máxima fidelidade experimental os problemas práticos das principais olimpíadas de física do mundo.
            </p>
            <p>
              Cada problema inclui medições com incertezas realistas, dispersão de grãos/ruído quântico e critérios oficiais de pontuação (Marking Schemes).
            </p>
          </div>

          <div className="hub-sidebar-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <h3 style={{ color: 'var(--academic-navy)' }}>Modo Criador Disponível</h3>
            <p style={{ color: '#1e3a8a' }}>
              Professores e pesquisadores podem usar o <strong>Criador (Studio)</strong> para desenhar experimentos originais, calibrar incertezas e exportar arquivos <code>.pholab</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded PDF Viewer Modal (13 Pages with Solution) */}
      {isPdfModalOpen && (
        <div className="pdf-viewer-overlay" onClick={() => setIsPdfModalOpen(false)}>
          <div className="pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-viewer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={18} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {currentPackage.taskDocument.title}
                </span>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: 18, cursor: 'pointer' }}
                onClick={() => setIsPdfModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="pdf-pagination-bar">
              <button
                className="btn-ksp-action"
                style={{ padding: '4px 8px' }}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Anterior
              </button>

              <span>
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn-ksp-action"
                style={{ padding: '4px 8px' }}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima <ChevronRight size={14} />
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {pageData?.solutionMarkdown && (
                  <button
                    className={`btn-ksp-action ${showSolution ? 'primary' : ''}`}
                    style={{ padding: '4px 10px' }}
                    onClick={() => setShowSolution((s) => !s)}
                  >
                    <Check size={13} />
                    <span>{showSolution ? 'Ocultar Marking Scheme' : 'Ver Marking Scheme (Gabarito)'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pdf-page-content">
              {pageData ? (
                <>
                  <h3>{pageData.title}</h3>
                  <div style={{ whiteSpace: 'pre-line', lineHeight: 1.7, fontSize: 14, color: '#334155' }}>
                    {pageData.contentMarkdown}
                  </div>

                  {showSolution && pageData.solutionMarkdown && (
                    <div className="pdf-solution-box">
                      <div className="pdf-solution-title">Marking Scheme Oficial & Pontuação ({pageData.points} pts)</div>
                      <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, fontSize: 13, color: '#713f12' }}>
                        {pageData.solutionMarkdown}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>Página não encontrada.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
