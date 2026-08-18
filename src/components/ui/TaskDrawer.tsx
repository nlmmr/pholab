import React, { useState } from 'react';
import { X, BookOpen, CheckCircle, FileText, AlertTriangle, Key } from 'lucide-react';
import { ExamChallenge } from '../../physics/types';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: ExamChallenge;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  isOpen,
  onClose,
  challenge
}) => {
  const [activeTab, setActiveTab] = useState<'task' | 'scheme' | 'truth'>('task');
  const [showTruthUnlocked, setShowTruthUnlocked] = useState(false);

  return (
    <div className={`task-drawer-overlay ${isOpen ? 'open' : 'closed'}`}>
      <div className="task-drawer-header">
        <div className="task-drawer-tabs">
          <button
            className={`tab-btn ${activeTab === 'task' ? 'active' : ''}`}
            onClick={() => setActiveTab('task')}
          >
            <FileText size={14} style={{ display: 'inline', marginRight: 5 }} />
            Caderno de Prova
          </button>
          <button
            className={`tab-btn ${activeTab === 'scheme' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheme')}
          >
            <CheckCircle size={14} style={{ display: 'inline', marginRight: 5 }} />
            Marking Scheme
          </button>
          <button
            className={`tab-btn ${activeTab === 'truth' ? 'active' : ''}`}
            onClick={() => setActiveTab('truth')}
          >
            <Key size={14} style={{ display: 'inline', marginRight: 5 }} />
            Gabarito da Seed
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="task-drawer-body">
        {activeTab === 'task' && (
          <div>
            <h2>{challenge.title}</h2>
            <p style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
              ORIGEM: {challenge.olympiadSource.toUpperCase()} | TEMPO TOTAL: {challenge.examDurationMinutes} MIN
            </p>

            <div className="task-spec-box">
              <div className="task-spec-row">
                <span>SEMENTE DA PROVA:</span>
                <strong style={{ color: '#38bdf8' }}>{challenge.seed}</strong>
              </div>
              <div className="task-spec-row">
                <span>INSTRUMENTOS NO KIT:</span>
                <span>{challenge.kitItems.length} componentes</span>
              </div>
            </div>

            <h3>1. Introdução Teórica & Modelagem</h3>
            <p>
              Ao incidir um feixe de luz monocromática de comprimento de onda \(\lambda\) sobre uma rede de difração com passo de trilha \(d\), os máximos principais de interferência ocorrem em ângulos de desvio \(\theta_m\) regidos pela relação:
            </p>
            <div style={{ background: '#0a0e14', padding: '8px 12px', borderRadius: 6, margin: '8px 0', fontFamily: 'monospace', color: '#34d399' }}>
              d · sin(θ_m) = m · λ &nbsp;&nbsp;(m = 0, ±1, ±2, ...)
            </div>
            <p>
              Para um anteparo ou detector colocado a uma distância \(L\) do elemento difrator, a posição transversal linear \(x_m\) do pico de ordem \(m\) relaciona-se com o ângulo através de:
            </p>
            <div style={{ background: '#0a0e14', padding: '8px 12px', borderRadius: 6, margin: '8px 0', fontFamily: 'monospace', color: '#34d399' }}>
              tan(θ_m) = x_m / L &nbsp;⇒&nbsp; sin(θ_m) = x_m / √(x_m² + L²)
            </div>

            <h3>2. Tarefas Experimentais Propostas</h3>
            <ul>
              <li>
                <strong>Tarefa A (Alinhamento & Calibração):</strong> Abra a caixa do kit, monte o trilho óptico, a fonte laser e o fotodetector no estágio micrométrico. Ajuste o zero da posição (x = 0.00 mm) e realize a tara do medidor digital.
              </li>
              <li>
                <strong>Tarefa B (Envelope de Difração):</strong> Insira a fenda simples (a = 80 µm) a uma distância L ≥ 400 mm. Varra o perfil de intensidade com o micrômetro (Δx = 0.2 mm) e determine a largura experimental da fenda a ± σ_a.
              </li>
              <li>
                <strong>Tarefa C (Passo de Trilha da Rede):</strong> Substitua a fenda pela rede de difração desconhecida. Meça as posições dos picos x_m para as ordens m = +1, -1, +2, -2 para ao menos 3 distâncias L distintas.
              </li>
              <li>
                <strong>Tarefa D (Análise de Incertezas & Linearização):</strong> Fora do simulador (em seu caderno ou software de planilha/Python), construa o gráfico linearizado de sin(θ_m) em função da ordem m. Ajuste uma reta por mínimos quadrados ponderados e determine o passo de trilha d ± Δd.
              </li>
            </ul>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 8, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 600, fontSize: 12 }}>
                <AlertTriangle size={15} />
                NOTA IMPORTANTE PARA O COMPETIDOR
              </div>
              <p style={{ fontSize: 12, marginTop: 6, color: '#e2e8f0', marginBottom: 0 }}>
                Este simulador não gera tabelas nem gráficos automáticos. Você deve anotar manualmente as leituras da régua do trilho, do micrômetro transversal e do mostrador do fotômetro.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'scheme' && (
          <div>
            <h2>Critérios Oficiais de Correção (Marking Scheme)</h2>
            <p>Esquema de pontuação baseado no padrão oficial da International Physics Olympiad (IPhO):</p>

            <div style={{ marginTop: 14 }}>
              <div className="task-spec-box" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#ffffff' }}>
                  <span>Item 1: Alinhamento e Tara Inicial</span>
                  <span style={{ color: '#34d399' }}>1.0 ponto</span>
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
                  Registro do valor residual de escuro e desconto correto da tara no detector.
                </p>
              </div>

              <div className="task-spec-box" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#ffffff' }}>
                  <span>Item 2: Tabela de Medições da Rede (x_m vs L)</span>
                  <span style={{ color: '#34d399' }}>3.0 pontos</span>
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
                  Mínimo de 3 distâncias \(L\) com leitura simétrica das ordens positivas e negativas para compensar desvios angulares.
                </p>
              </div>

              <div className="task-spec-box" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#ffffff' }}>
                  <span>Item 3: Gráfico Linearizado e Coeficiente Angular</span>
                  <span style={{ color: '#34d399' }}>3.5 pontos</span>
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
                  Gráfico de \(\sin\theta\) vs \(m\), determinação do coeficiente angular \(S = \lambda / d\) e barras de erro experimentais.
                </p>
              </div>

              <div className="task-spec-box" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#ffffff' }}>
                  <span>Item 4: Propagação de Incertezas e Resultado Final</span>
                  <span style={{ color: '#34d399' }}>2.5 pontos</span>
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
                  Cálculo rigoroso de Δd / d = √[(Δλ/λ)² + (ΔS/S)²] e declaração do resultado no formato d ± Δd.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'truth' && (
          <div>
            <h2>Gabarito Oculto da Semente (Teacher Key)</h2>
            <p>
              Estes são os valores físicos exatos gerados deterministicamente para a semente <strong>{challenge.seed}</strong>.
            </p>

            {!showTruthUnlocked ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', background: '#0a0e14', borderRadius: 8, marginTop: 16 }}>
                <AlertTriangle size={32} color="#f59e0b" style={{ margin: '0 auto 10px auto' }} />
                <p style={{ fontSize: 12, color: '#cbd5e1' }}>
                  O gabarito contém os parâmetros exatos do seu kit. Deseja visualizar agora para conferir sua resolução?
                </p>
                <button
                  className="btn-dock primary"
                  style={{ margin: '14px auto 0 auto' }}
                  onClick={() => setShowTruthUnlocked(true)}
                >
                  Revelar Gabarito Físico
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div className="task-spec-box">
                  <div className="task-spec-row">
                    <span>Comprimento de Onda Exato (\(\lambda\)):</span>
                    <strong style={{ color: '#10b981' }}>{challenge.hiddenTruth.exactWavelengthNm?.toFixed(3)} nm</strong>
                  </div>
                  <div className="task-spec-row">
                    <span>Passo de Trilha Exato (\(d\)):</span>
                    <strong style={{ color: '#38bdf8' }}>{challenge.hiddenTruth.trackPitchNm} nm ({(1e6 / (challenge.hiddenTruth.trackPitchNm || 1600)).toFixed(1)} linhas/mm)</strong>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                  Se seu cálculo experimental com regressão linear estiver dentro do intervalo de \(\pm 2\%\) desse valor, seu resultado atinge pontuação máxima na IPhO!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
