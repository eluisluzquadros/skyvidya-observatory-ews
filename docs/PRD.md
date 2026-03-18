# PRD — Skyvidya Observatory EWS v2.1
**Produto:** Skyvidya Observatory: Early Warning System (EWS)
**Versão:** 2.1
**Última atualização:** 2026-03-18
**Status:** Em desenvolvimento ativo

---

## Visão do Produto

Plataforma de comando e análise geoespacial de desastres naturais no Brasil. Combina dados históricos reais do Atlas Digital (45.942 eventos, 1994–presente) com análise espacial avançada (LISA/MCDA), visualização interativa 3D/2D, inteligência artificial generativa e design system 2026 para suporte à tomada de decisão em defesa civil e gestão de riscos.

**Nome oficial:** Skyvidya Observatory: Early Warning System — EWS
_(anterior: S2ID Command / Centro Integrado de Comando)_

---

## Usuários-Alvo

- **Analistas de defesa civil** — monitoramento, triagem de eventos, análise de risco municipal
- **Pesquisadores de desastres** — exploração de padrões espaciais (clusters LISA, tendências MCDA)
- **Gestores públicos** — dashboards de alto nível, narrativas automatizadas por estado
- **Jornalistas/mídia** — validação de eventos via correlação com notícias e dados históricos

---

## Funcionalidades Implementadas (v2.1)

### F1 — Dados Reais e Filtros de Período ✅
- **45.942 eventos** do Atlas Digital servidos via Express.js (`/api/disasters`)
- Filtros **server-side** por `startDate`/`endDate` (ISO YYYY-MM-DD)
- Presets rápidos na TopBar: **1A, 2A, 5A, 10A, 20A, HIST**
- Calendário customizado DE/ATÉ com validação (campo max/min)
- `DisasterFilter` como tipo central
- Datas exibidas em DD/MM/AAAA — zero dados fictícios gerados por IA

### F2 — Visualização 3D Globe ✅
- Globe interativo D3.js com pontos de desastre reais
- Pan, zoom, auto-rotação com Play/Pause
- Tooltips em hover, seleção por clique
- Design dark-theme Command Center

### F3 — Mapa Coroplético 2D ✅
- Polígonos municipais (5.572 municípios, GeoJSON 10MB)
- 4 modos de cor: `riskCategory`, `trend`, `principalThreat`, `lisaCluster`
- Zoom/pan com d3-zoom, click para seleção, tooltip
- Toggle Globe ↔ Mapa via ViewToggle

### F4 — Pipeline Analytics Python ✅
- **Ingestão** (Notebook 00): Atlas CSV + IBGE GeoParquet 2024 + COBRADE 12 tipos + 4 janelas temporais + per capita
- **LISA** (Notebook 01): Local Moran's I (999 permutações), 8 variáveis core, clusters HH/HL/LH/LL
- **MCDA** (Notebook 02): 8 critérios MinMax → score 0-1 → 5 categorias risco → tendência → ameaça principal
- **Output JSON** (Notebook 03): risk_analysis.json (8.5MB), lisa_clusters.json (3.4MB), municipality_geometries.geojson (10MB)
- Runtime: ~107s para Brasil todo

### F5 — Dashboard Analytics ✅
- StatCards: total municípios, % alto risco, % tendência crescente, ameaça dominante
- Rankings Top-10 por score MCDA
- Distribuição de categorias (Recharts)
- Seletor de variável LISA

### F6 — GeoRAG ✅
- Queries em linguagem natural sobre perfis de risco municipal
- Backend DuckDB + regras NLP
- Interface chat (padrão TacticalAI)
- Resultado com lista de municípios clicáveis

### F7 — Oracle AI (Gemini) ✅
- `chatWithAI()` enriquecido com contexto MCDA real (scores, categorias, tendências)
- `generateInsight()` com referências a padrões MCDA
- `fetchEventNews()` — validação de eventos via correlação com notícias
- `fetchEconomicImpact()` — análise de impacto econômico

### F8 — Automação e Infraestrutura ✅
- `npm run dev:all` com `concurrently` (frontend + backend + Python)
- Scheduler node-cron trigger opcional pós-coleta Atlas
- Indicador pipeline status na TopBar (MCDA ON/OFF)
- Botão Refresh Analytics manual

### F9 — Design System 2026 & Rebrand ✅
- **Nome:** Skyvidya Observatory: Early Warning System — EWS
- **Fontes:** `Syne` (brand bold), `Plus Jakarta Sans` (body), `JetBrains Mono` (dados), `Space Grotesk` (display)
- **Tokens CSS:** `--btn-height-sm: 28px`, `--font-brand`, `--font-body`, escala de spacing
- **Botões uniformes:** `.btn-tactical`, `.filter-chip`, `.donate-btn` todos com `height: var(--btn-height-sm)`
- **Glow-orange:** classe `.glow-orange` adicionada ao sistema
- `font-feature-settings` kern + liga ativados; antialiasing global

### F10 — Sidebar UX: Hide/Show & Auto-Select ✅
- **Sidebar esquerda:** botão `‹` no rodapé para recolher; botão `›` para expandir; transição `cubic-bezier`
- **Sidebar direita:** botão `›` no header da tab bar para recolher; icon rail vertical quando colapsada (44px); clique em ícone expande e ativa o painel correspondente; tab ativa destacada com borda lateral cyan
- **Auto-select do evento mais recente:** `useRef` garante disparo único após o primeiro carregamento bem-sucedido; chama `handleEventSelect(filteredData[0])` populando detalhe + news + economic automaticamente

---

## Funcionalidades Planejadas (Roadmap)

### FASE A — Reporting Assets (Notebook 03)
**Prioridade:** Alta
**Descrição:** Pipeline gera assets visuais estáticos (PNG) e tabelas (CSV) para relatórios

- `analytics/pipeline/reporting_charts.py` com matplotlib/seaborn
- 7 mapas PNG: risco MCDA, tendência, ameaça principal, 4 mapas LISA
- 3 gráficos de distribuição (bar chart, pie, top-5 ameaças)
- 1 tabela CSV: top-N municípios por score
- Endpoints Express: `GET /api/analytics/report-assets` e `GET /api/analytics/report-assets/:file`
- Frontend: seção "Relatório Visual" no AnalyticsPanel com thumbnails clicáveis

**Entregável:** Pipeline gera 7 PNGs + 1 CSV. Frontend exibe thumbnails com modal fullscreen.

---

### FASE B — AI Content Framework (Notebook 04)
**Prioridade:** Alta
**Descrição:** Narrativas textuais profissionais por município/estado via Gemini

- `analytics/llm_generation.py` — classe `LLMContentGenerator`
- Funções: `extract_kpis()`, `generate_executive_summary()`, `generate_risk_narrative()`, `generate_recommendations()`, `generate_impact_projection()`
- Endpoints FastAPI: `POST /llm/generate-report`, `GET /llm/report/{uf}`
- Proxy Express: `POST /api/analytics/llm/generate`, `GET /api/analytics/llm/report/:scope`
- Frontend: botão "Gerar Relatório IA" por UF, seção expandível com markdown renderizado

**Entregável:** Click "Gerar Relatório IA para RS" → narrativa profissional com KPIs reais.

---

### FASE C1 — GeoRAG Semântico (Notebook 05)
**Prioridade:** Média
**Descrição:** Busca vetorial com embeddings para complementar o rule-based atual

- ChromaDB persistido em `analytics/data/chroma/`
- Modelo: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- `semantic_search()` + `hybrid_query()` (rule-based + semântico com re-ranking)

**Entregável:** GeoRAG com busca semântica + resultados notavelmente melhores.

---

### FASE C2+C3 — Kepler.gl + Exportação
**Prioridade:** Baixa
**Descrição:** Config Kepler.gl para resultados GeoRAG + exportação CSV/GeoJSON

- `prepare_kepler_config()` no engine GeoRAG
- Endpoints: `/api/analytics/georag/kepler-config`, `/api/analytics/georag/export`
- Frontend: botões "Exportar CSV" e "Exportar GeoJSON" após cada resposta GeoRAG

---

## Decisões Técnicas

| Decisão | Escolha | Razão |
|---|---|---|
| Nome da plataforma | Skyvidya Observatory EWS | Identidade de marca Skyvidya; EWS comunica função diretamente |
| Dados de eventos | Atlas Digital real (45.942) | Elimina alucinações Gemini com datas futuras |
| Filtragem | Server-side (Express) | Escala de 45k registros inviabiliza client-side |
| Analytics | Python microservice (:8000) | LISA/PySAL/GeoPandas sem equivalente JS |
| Padrão analytics | Batch pré-computado + 1 endpoint live | Evita latência de 107s por request |
| LISA variáveis | 8 core MCDA (não todas 444) | Reduz lisa_clusters.json de 391MB → 3.4MB |
| CSS framework | Tailwind v4 + CSS variables | Componentes analytics em Tailwind; design system em CSS vars |
| Fontes 2026 | Syne + Plus Jakarta Sans + JetBrains Mono | Syne: brand bold moderno; PJS: corpo geométrico legível; JBM: dados |
| LLM | Gemini 2.5 Flash | Já integrado; sem custo adicional |
| Sidebar auto-select | `useRef` one-shot + `handleEventSelect(filteredData[0])` | UX imediata; evita re-seleção em cada mudança de filtro |

---

## Métricas de Sucesso

| Métrica | Baseline | Target |
|---|---|---|
| Tempo de carregamento inicial | 45k registros client-side | < 2k registros com filtro server-side |
| Cobertura de municípios MCDA | 0 | 5.572 (100% Brasil) |
| Pipeline runtime | — | < 120s para Brasil todo |
| Precisão GeoRAG | Apenas rule-based | Hybrid (rule + semântico) |
| Cliques para ver dados do evento | 1 clique obrigatório | 0 cliques (auto-select) |

---

## Restrições

- Express.js permanece como único API gateway para o frontend
- `database.json` e `storage.ts` são intocados pelo pipeline analytics
- Globe 3D e todas features existentes são preservadas (zero remoções)
- Dados fictícios gerados por IA são proibidos no feed de eventos principal
- "S2ID" como referência ao sistema de dados do governo permanece nos comentários e scraper — apenas o nome da *plataforma* mudou para Skyvidya Observatory EWS
