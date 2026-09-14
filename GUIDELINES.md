# PhOLab — Diretrizes Mestras de Arquitetura e Engenharia (Master Guidelines)

> **Documento Oficial de Referência**  
> Este documento estabelece os princípios invioláveis, a arquitetura de software, os padrões de interação e as convenções técnicas que devem guiar **absolutamente todo o desenvolvimento** do ecossistema **PhOLab** (*Physics Olympiad Laboratory*). Qualquer contribuição, refatoração ou adição de novos recursos por desenvolvedores ou agentes deve obedecer estritamente a estas diretrizes.

---

## 1. Visão e Filosofia Central

### 1.1 O Que é o PhOLab?
O PhOLab é uma plataforma aberta, interativa e de alta fidelidade voltada para o treino e a vivência de **tarefas experimentais de olimpíadas internacionais de física** (IPhO, APhO, EuPhO, OBF, USAPhO). 

A plataforma é concebida como uma **Oficina Aberta de Física Experimental Paramétrica**:
* Um ambiente onde equipamentos, instrumentos e suportes existem como componentes físicos modulares que podem ser montados das mais variadas formas para investigar a natureza.
* Uma experiência focada na prática real: desembalar o kit da maleta de transporte, retirar travas, fazer conexões elétricas, realizar alinhamentos finos mecânicos e ler escalas analógicas e digitais diretamente nos instrumentos.

### 1.2 O Princípio da Soberania do Estudante
> **"Treine para o experimento, não para a interface."**

O papel do software PhOLab termina na **condução do aparato físico e na disponibilização dos instrumentos reais de medição**. 
* **O simulador SÓ fornece o experimento físico:** Toda a coleta de dados, montagem de tabelas, plotagem de gráficos, cálculo de incertezas, linearizações e redação de respostas pertence ao estudante (no seu próprio caderno físico, planilha ou código Python), exatamente como na vida real.
* **Proibição de HUDs mágicos:** Medições não aparecem em popups ou textos em tela cheia. Se o aluno quer saber o ângulo, ele deve dar zoom e ler o transferidor analógico. Se quer saber a corrente, deve ler o display LCD da placa.
* **Proibição de botões de montagem automática:** O estudante não clica em "Montar Bancada". Ele desparafusa as hastes, remove a plataforma da maleta, insere o porta-amostras no estágio e conecta os cabos elétricos.

---

## 2. A Moeda do Ecossistema: O Pacote `.pholab` e o Studio

### 2.1 A Oficina de Montagem Paramétrica (PhOLab Studio)
No **PhOLab Studio**, o criador de experimentos formula provas de forma totalmente visual: ele seleciona instrumentos e suportes da biblioteca oficial, posiciona-os no espaço 3D, define suas restrições cinemáticas e acopla suas propriedades físicas a solvers analíticos. O aparato montado responde com fidelidade estrita às leis físicas configuradas.

### 2.2 Geração Automatizada do Arquivo `.pholab`
* **Zero Código Manual para Criadores:** O criador de experimentos **não escreve código Three.js nem JSON manualmente**. Ele organiza os componentes na caixa e na bancada pelo Studio, define as constantes físicas nominais e verdades ocultas, calibra as incertezas e anexa o PDF do exame com seu *Marking Scheme*.
* **Compilação do Pacote:** Ao salvar ou exportar, o PhOLab Studio compila automaticamente todas as declarações estruturais, restrições cinemáticas e equações físicas no arquivo universal `.pholab`.
* **Autocontido e Portável:** O arquivo `.pholab` contém todas as instruções necessárias para que tanto o site quanto o visualizador offline executem a experiência com fidelidade idêntica.

### 2.3 Estrutura Padrão do Pacote `.pholab`
```
experimento.pholab (JSON / ZIP autocontido)
├── manifest.json         # Topologia do kit, peças, sockets, knobs e posições iniciais
├── physics.json          # Constantes nominais, verdades ocultas (gabarito) e ruídos
├── task.pdf              # Caderno oficial do enunciado da tarefa
├── marking-scheme.pdf    # Critérios e pontuação oficial para autoavaliação posterior
└── assets/               # (Opcional) Modelos GLTF e texturas específicas se houver
```

### 2.4 Estratégia de Plataforma: Web-First com PWA Offline
1. **Foco Imediato:** Aplicação Web moderna (React 18 + TypeScript + Three.js + Vite), com suporte a **PWA (Progressive Web App)** e *Service Workers* para funcionamento 100% offline em navegadores após o primeiro carregamento.
2. **O Site como Hub Central:** Plataforma de catálogo, busca de provas por olimpíada/ano, execução instantânea no navegador e download de arquivos `.pholab`.
3. **Fase Posterior (Desktop App):** Empacotamento para aplicativo desktop nativo e isolado (via Tauri) para ambientes de prova fechados sem internet.

---

## 3. As Primitivas Mecânicas Universais (The Core Physical Primitives)

> **Regra de Ouro da Arquitetura:**  
> **Nenhum experimento deve introduzir mecânicas descartáveis (*one-offs*).** Qualquer interação deve ser uma instância ou combinação do catálogo finito de primitivas universais abaixo.

### 3.1 Primitivas de Montagem e Articulação
1. **`Fastener` (Parafusos, Hastes Roscadas, Porcas e O-Rings):**
   * Modela fixadores com graus de aperto contínuos (`tightness`: 0.0 a 1.0).
   * **Modo de Operação Definido pelo Criador:** O manifesto do experimento define se a interação é:
     * *Manual Direta:* Arraste contínuo do mouse com o cursor simulando os dedos (ex: hastes brancas da IPhO 2024).
     * *Por Ferramenta Equipável:* Exige que o usuário pegue a ferramenta fornecida no estojo (ex: chave de fenda, chave allen, pinça) antes de acionar a rosca.
   * Enquanto apertado, bloqueia os graus de liberdade da peça acoplada.
   * O-rings elásticos exigem o ato de puxar e destacar do berço de retenção.
2. **`Hinge` (Dobradiças e Tampas Basculantes):**
   * Rotação restrita a um eixo de charneira (ex: tampa da maleta óptica).
   * O usuário clica e arrasta o mouse no arco natural de abertura angular.
3. **`SocketPort` & `Plug` (Portas de Encaixe e Ancoragem):**
   * Define acoplamentos mecânicos físicos (ex: 4 pinos nos furos da cubeta, haste vertical na base).
   * Oferece suporte a *snapping* sutil apenas dentro de um raio de tolerância realista (ex: 2 a 3 cm), evitando a frustração do alinhamento milimétrico com mouse.
4. **`LinearRailGuide` (Guia de Translação 1D):**
   * Restringe o movimento de um corpo rígido estritamente ao longo de um trilho ou haste vertical.
   * Suporta parafuso borboleta de trava (*clamp thumbscrew*).
5. **`RotaryDial` (Knobs de Ajuste Fino, Transferidores e Potenciômetros):**
   * Converte arrastes lineares ou circulares em rotação contínua $\Delta\theta$.
   * Usado tanto para rotação de estágios mecânicos (goniômetros) quanto para parâmetros elétricos (potenciômetros de corrente).
6. **`CableJackPort` (Portas Elétricas / Cabos):**
   * Define terminais de conexão (banana, BNC, USB, borne).
   * Conecta extremidades de cabos flexíveis (curvas Catmull-Rom), alimentando um grafo de continuidade de circuito resolvido em tempo real.
7. **`FluidMediumContainer` (Recipiente de Líquidos e Grãos):**
   * Modela cubetas, frascos e tigelas.
   * Suporta ações físicas de destampar frasco, despejar fluido (*pour*), destacar películas protetoras e imergir lâminas/sondas.

### 3.2 Primitivas de Instrumentação e Medição
1. **`GraduatedScale` (Escalas Físicas Analógicas):**
   * Réguas milimetradas, nônios e transferidores circulares graduados com subdivisões realistas ($10^\circ, 5^\circ, 1^\circ, 0.5^\circ$).
   * A leitura é visual, associada a marcas fixas de referência (*fiducial marks*).
2. **`DigitalDisplay` (Mostradores Digitais Procedurais):**
   * Telas LCD monocromáticas com retroiluminação ou displays LED de 7 segmentos.
   * Exibem valores com quantização real de dígitos, tempo de resposta e instabilidade no dígito menos significativo (jitter instrumental).
3. **`PatternSurface` (Anteparos de Projeção / Inspeção):**
   * Telas e anteparos onde os solvers de onda, óptica geométrica ou física de impacto projetam imagens e padrões em tempo real.
4. **Modelo de Eficiência e Acoplamento Físico Generalizável ($\eta \in [0, 1]$):**
   * A física do simulador não atua de forma binária ("funciona / não funciona").
   * Modela perdas e atenuações contínuas baseadas no grau de alinhamento geométrico, nivelamento ou calibração. Essa função exponencial/gaussiana aplica-se genericamente a:
     * Alinhamento de feixes ópticos e lentes (óptica ondulatória).
     * Nivelamento e descompactação de leitos arenosos (mecânica granular).
     * Entreferros e alinhamento de bobinas/eletroímãs (eletromagnetismo).
     * Vedações térmicas e perdas por atrito (termodinâmica).

---

## 4. O Caso Canônico: IPhO 2024 E2 (Diffraction from Phase Steps)

O experimento da IPhO 2024 é a **implementação de referência** e o teste de estresse das novas diretrizes. Todo o seu funcionamento deve ser refatorado para usar estritamente as primitivas universais:

### 4.1 Mapeamento de Componentes para Primitivas
| Componente da IPhO 2024 | Primitiva Universal | Comportamento Físico |
| :--- | :--- | :--- |
| **Estojo de Óptica** | `Container` + `Hinge` | Tampa articulada com arraste angular; aloja os berços dos instrumentos. |
| **4 Hastes Brancas** | `Fastener` (Threaded) | Roscas manuais com indicação "OPEN"; exigem desrosqueamento antes de liberar a bancada. |
| **O-Rings Vermelhos** | `Fastener` (Elastic) | Anéis de borracha que travam frascos e suportes na espuma. |
| **Plataforma Principal** | `RigidBody` com Sockets | Retirada manualmente da maleta e posicionada na bancada de trabalho. |
| **Ajuste de Altura do Laser/Lente** | `LinearRailGuide` | Translação 1D vertical acoplada a knobs de rosca sem-fim. |
| **Transferidor Circular** | `RotaryDial` + `GraduatedScale` | Rotação analógica contínua com escala de alta definição lida no ponteiro vermelho. |
| **Placa Laser Current Controller** | `DigitalDisplay` + `CableJackPort` + `RotaryDial` | Display LCD azul funcional (`I(Laser)=15.0 mA`), chave liga/desliga e potenciômetro de corrente que atenua o laser. |
| **Suportes S1 e S2** | `Plug` intercambiável | Encaixe nos 4 pinos do estágio circular; S1 (lâmina fina) e S2 (lâmina grossa). |
| **Cubeta e Líquido Rosa** | `FluidMediumContainer` | Película protetora destacável, encaixe nos 4 furos centrais e enchimento com líquido. |

### 4.2 Parâmetros Oficiais de Referência (Marking Scheme)
O simulador deve utilizar os valores numéricos exatos estabelecidos pelo comitê acadêmico da IPhO 2024:
* **Comprimento de onda do laser vermelho ($\lambda$):** $650\text{ nm}$
* **Índice de refração do vidro da lâmina ($n$):** $1.51$
* **Índice de refração do ar ($N_{\text{ar}}$):** $1.00$
* **Espessura oficial oculta da lâmina fina S1 ($h$):** $148.9\,\mu\text{m} = 0.1489\text{ mm}$ ($B = 229.1$)
* **Espessura oficial oculta da lâmina grossa S2 ($H$):** $1.061\text{ mm}$ ($B = 275.7$)
* **Índice de refração oficial do líquido rosa ($N_{\text{liq}}$):** $1.332$ ($B = 128.0$)

---

## 5. Convenções de Experiência do Usuário (UX), Câmera e Controles Globais

### 5.1 Mapa Canônico de Controles e Teclas (Keybindings Oficiais)
Para evitar conflitos de comandos à medida que novas ferramentas e áreas forem adicionadas, o PhOLab adota o seguinte mapeamento universal:

| Ação | Controle do Mouse | Tecla de Atalho | Comportamento |
| :--- | :--- | :---: | :--- |
| **Orbitar Câmera** | Botão Esquerdo (Arrastar) | — | Rotação orbital suave 3D ao redor do ponto focal ativo. |
| **Transladar Câmera (Pan)** | Botão do Meio (Arrastar) | `Shift` + Botão Esquerdo | Deslocamento horizontal/vertical do plano de visão. |
| **Zoom Óptico Contínuo** | Roda do Mouse (Scroll) | `+` / `-` | Aproximação ou afastamento contínuo com precisão milimétrica. |
| **Focar Objeto Selecionado** | Clique duplo na peça | `F` | Enquadra suavemente a câmera na peça ou instrumento ativo. |
| **Modo Mover Peça (3D)** | Botão Esquerdo na peça | `W` | Ativa o gizmo de translação 3D livre da peça segurada. |
| **Modo Girar Peça (3D)** | — | `E` | Ativa os anéis ortogonais de rotação angular da peça segurada. |
| **Inclinar Fluido (Despejar)** | Scroll do mouse com frasco ativo | `Q` / `E` | Inclina o frasco no ângulo exato desejado, dosando o fluxo do líquido. |
| **Desfazer / Resetar Rotação** | — | `R` | Realinha a peça com a orientação padrão da gravidade. |
| **Desmarcar / Fechar Painel** | Clique fora do aparato | `Esc` | Cancela o manuseio atual ou fecha gavetas laterais de documentos. |
| **Preset Câmera Geral** | — | `1` | Visão panorâmica da mesa de laboratório. |
| **Preset Câmera Aparato** | — | `2` | Foco central no estágio de teste da bancada. |
| **Preset Câmera Maleta** | — | `3` | Visão de topo do estojo de transporte e berços de peças. |
| **Preset Câmera Instrumentos** | — | `4` | Foco de close-up no transferidor, régua ou display digital. |
| **Preset Câmera Caderno** | — | `5` | Foco de leitura sobre a folha de prova na bancada. |

### 5.2 Feedback Sonoro Físico Procedural (Web Audio API)
O realismo da bancada física é reforçado por um sintetizador de áudio procedural leve (`AudioManager`), sem arquivos de áudio pesados, disparado por eventos de contato:
* **Interruptores e Chaves:** Estalo mecânico (*clique seco*) ao alternar posições On/Off.
* **Parafusos e Roscas:** Ruído metálico contínuo de fricção/catraca proporcional à velocidade de giro do fastener.
* **Encaixes em Sockets:** Som surdo de travamento mecânico (*snap / clack*) quando o pino atinge a tolerância e se fixa.
* **Transferência de Fluidos:** Efeito suave de despejo líquido e gotejamento modulado pela vazão angular do frasco.

### 5.3 Relógio Digital de Prova Tridimensional
* O tempo de prova decorrido é exibido em um **relógio digital físico dentro do ambiente 3D** (por exemplo, fixado na parede do laboratório ou posicionado na bancada).
* A contagem **só é iniciada após o usuário confirmar o início do exame** em um painel introdutório de briefing ao abrir a prova.

### 5.4 Visualização Tríplice da Prova (Documento de Tarefa)
O estudante tem total liberdade de escolher como deseja ler o enunciado oficial e as instruções:
1. **Na Bancada 3D:** O caderno de prova existe como um objeto impresso na mesa; clicar nele aciona um preset de câmera que centraliza na leitura da página.
2. **Em Painel Lateral (Split-Screen):** Uma gaveta retrátil e redimensionável na interface que permite consultar o PDF sem sair da cena.
3. **Em Nova Aba do Navegador:** Link direto para abrir o PDF externamente para quem usa múltiplos monitores.
* O *Marking Scheme* oficial é protegido e revelável por opção do usuário após a conclusão da prática para autoavaliação.

---

## 6. Modos de Operação e Competição Institucional

O PhOLab prevê dois modos distintos de execução para atender tanto ao estudante autônomo quanto a centros olímpicos e colégios:

1. **Modo Prática / Treinamento Livre (Practice Mode):**
   * O estudante pode pausar o relógio a qualquer instante para refletir ou estudar a teoria.
   * Pode continuar de onde parou em sessões anteriores ou reiniciar o aparato do zero a qualquer momento.
   * Tem acesso para revelar o gabarito oficial assim que julgar conveniente.
2. **Modo Prova Oficial / Competição Institucional (Exam Mode):**
   * Configurado por instituições ou pelo pacote `.pholab` oficial de campeonato.
   * **Sem Pausa:** O cronômetro inicia com a confirmação do briefing e não pode ser pausado pelo aluno.
   * **Sem Reinício:** O aluno não pode resetar o experimento para contornar erros práticos; ele deve conviver com as consequências de montagens imperfeitas até o esgotamento do tempo de prova.
   * **Bloqueio de Gabarito:** O *Marking Scheme* permanece estritamente inacessível até a entrega final ou término do prazo oficial.

---

## 7. A Arquitetura Final: Biblioteca Universal de Partes (Library & Runtime)

> **Princípio da Arquitetura Final:**  
> No produto consolidado, **não existem pastas de experimentos individuais hardcoded no código-fonte**. Todos os experimentos são meras instâncias descritas em arquivos `.pholab`, executadas por um runtime universal que consome peças de uma biblioteca padrão.

```
src/
├── core/                           # O NÚCLEO MECÂNICO E MATEMÁTICO (Neutro e universal)
│   ├── engine/                     # Loop Three.js, gerenciador de viewport, física e colisões
│   ├── primitives/                 # As 7 primitivas mecânicas e 3 de instrumentação
│   ├── camera/                     # Controles orbitais, pan e presets cinemáticos
│   ├── audio/                      # Sintetizador físico procedural leve (Web Audio API)
│   └── exam/                       # Gerenciador de tempo, briefing e modos de exame
│
├── library/                        # ◄── A BIBLIOTECA UNIVERSAL DE EQUIPAMENTOS
│   ├── optics/                     # Emissor laser, lentes, suportes, transferidores, anteparos
│   ├── mechanics/                  # Trilhos inclinados, esferas, recipientes de areia, suportes
│   ├── electronics/                # Fontes 5V, placas de corrente, multímetros, baterias
│   ├── chemistry/                  # (Futuro) Tubos de ensaio, béqueres, pipetas, termômetros
│   └── biology/                    # (Futuro) Microscópios, placas de Petri, lâminas biológicas
│
├── runtime/                        # ◄── O INTERPRETADOR UNIVERSAL DO FORMATO .PHOLAB
│   ├── PackageLoader.ts            # Carrega e valida o manifesto .pholab (online ou local)
│   ├── SceneAssembler.ts           # Instancia as peças da library nos sockets indicados
│   └── PhysicsBinding.ts           # Conecta os solvers matemáticos às variáveis do aparato
│
├── studio/                         # O EDITOR VISUAL PARAMÉTRICO DE EXPERIMENTOS
│   ├── catalog/                    # Paleta visual de peças da library
│   ├── canvas/                     # Área de montagem com gizmos de posicionamento
│   └── compiler/                   # Compilador e empacotador automático de arquivos .pholab
│
└── shared/                         # Utilitários de matemática, Three.js, tipos e UI
```

---

## 8. Expansibilidade Multidisciplinar (Física, Química, Biologia)

Embora o foco inicial do MVP seja a física experimental de ponta (IPhO), as primitivas mecânicas foram concebidas com neutralidade semântica para expansão a outras ciências:
* O mesmo `FluidMediumContainer` que modela a cubeta de água com corante na IPhO 2024 modelará béqueres e buretas na Olimpíada Internacional de Química (IChO).
* A mesma `GraduatedScale` que gera o transferidor óptico gerará escalas de termômetros, provetas e nônios de paquímetros.
* O mesmo `LinearRailGuide` que move a lente na bancada óptica ajustará o foco macrométrico e micrométrico de um microscópio óptico na Olimpíada Internacional de Biologia (IBO).

---

## 9. Critérios de Aceitação de Código (Code Review Checklist)

Antes de aprovar qualquer alteração no PhOLab, o desenvolvedor ou agente deve validar:
- [ ] O componente novo reside na biblioteca universal (`src/library/`) ou expande as primitivas do núcleo (`src/core/primitives/`), sem ser acoplado rigidamente a uma prova específica?
- [ ] Todas as grandezas são lidas instrumentalmente pelo aluno no espaço 3D, sem popups de HUD?
- [ ] As interações de montagem respeitam a física de cada objeto (roscas contínuas, charneiras, tolerância de sockets)?
- [ ] As teclas de atalho seguem rigorosamente o mapa canônico oficial (seção 5.1), sem introduzir conflitos?
- [ ] O áudio procedural é leve e acionado por eventos físicos reais via Web Audio API?
- [ ] O Three.js limpa geometrias, texturas e materiais no desmontar (`dispose`) para prevenir memory leaks?
- [ ] O experimento é executável 100% offline via PWA ou arquivo `.pholab` autocontido?
