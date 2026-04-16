# PRD — Skyvidya Observatory EWS v3.0
**Produto:** Skyvidya Observatory: Early Warning System (EWS)
**Versão:** 3.0
**Última atualização:** 2026-04-10
**Status:** Em desenvolvimento ativo

---

## Visão do Produto

Plataforma de comando e análise geoespacial de desastres naturais no Brasil. Combina dados históricos reais do Atlas Digital (45.942 eventos, 1994–presente) com análise espacial avançada (LISA/MCDA), visualização interativa 3D/2D, inteligência artificial generativa, **Modern Geospatial Data Stack** (Kestra + dbt + DuckDB medallion) e design system 2026 para suporte à tomada de decisão em defesa civil e gestão de riscos.

**Nome oficial:** Skyvidya Observatory: Early Warning System — EWS
_(anterior: S2ID Command / Centro Integrado de Comando)_

---

## Usuários-Alvo

- **Analistas de defesa civil** — monitoramento, triagem de eventos, análise de risco municipal
- **Pesquisadores de desastres** — exploração de padrões espaciais (clusters LISA, tendências MCDA)
- **Gestores públicos** — dashboards de alto nível, narrativas automatizadas por estado
- **Jornalistas/mídia** — validação de eventos via correlação com notícias e dados históricos

---

## Funcionalidades Implementadas (v3.0)

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
- Polígonos municipais (5.573 municípios, GeoJSON 10MB)
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
- Indicador pipeline status na TopBar (MCDA ON/OFF, link para Kestra UI)
- Botão Refresh Analytics manual
- Socket.IO: frontend escuta `pipeline-started/completed/failed` em tempo real

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

### FASE A — Reporting Assets (Notebook 03) ✅
**Status:** Implementado (commit `e38988b`)

- `analytics/pipeline/reporting_charts.py` com matplotlib/seaborn
- 7 mapas PNG + 3 gráficos de distribuição + 1 tabela CSV
- Endpoints Express: `GET /api/analytics/report-assets` e `GET /api/analytics/report-assets/:file`
- Bronze data integration + ImportModal fix

---

### FASE B — AI Content Framework (Notebook 04) ✅
**Status:** Implementado (commit `b95fcaa`)

- `analytics/llm_generation.py` — classe `LLMContentGenerator`
- Funções: `extract_kpis()`, `generate_executive_summary()`, `generate_risk_narrative()`, `generate_recommendations()`, `generate_impact_projection()`
- Endpoints FastAPI: `POST /llm/generate-report`, `GET /llm/report/{uf}`
- Proxy Express: `POST /api/analytics/llm/generate`, `GET /api/analytics/llm/report/:scope`

---

### FASE C — GeoRAG Enhanced (Notebook 05) ✅
**Status:** Implementado (commit `c343d8e`)

- ChromaDB persistido em `analytics/data/chroma/`
- Modelo: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- `semantic_search()` + `hybrid_query()` (rule-based + semântico com re-ranking)
- Kepler.gl config: `GET /api/analytics/georag/kepler-config`
- Exportação CSV/GeoJSON: `POST /api/analytics/georag/export`

---

### FASE 11 — Data Quality & Bugfixes ✅
**Status:** Implementado (commits `982c683`, `10c9137`, `51267f5`, `2536a42`)

- Atlas dedup: `Protocolo_S2iD` como ID único — 28.643 colisões resolvidas
- UF normalization: uppercase enforced — 1 registro inválido removido
- Server-side stats: aggregation no Express — eliminação do limite de 2k eventos
- UTF-8 mojibake fix: `fix_mojibake()` em `report_data.py` — corrige dupla codificação UTF-8 → Latin-1

---

### FASE MDS — Modern Geospatial Data Stack ✅
**Status:** Implementado (entregue 2026-04-02)

**Orquestração — Kestra CE**
- DAG `ews.disaster/s2id-ingestion-pipeline` com 9 tasks (agendamento semanal seg 06:00 BRT)
- Task 0: notifica frontend via `POST /api/pipeline/started` → Socket.IO `pipeline-started`
- Tasks 1–2: health check Express + scraping S2ID (Puppeteer)
- Task 3: Express spawna `bronze_ingest.py` via `runScript()`
- Tasks 4–5: `dbt run silver` + `dbt run gold` (containers com `docker.volumes` bind-mount)
- Tasks 6–7: Express spawna `lisa_analysis.py` + `export_gold_geojson.py`
- Task 8: notifica frontend via `POST /api/pipeline/done` → Socket.IO `pipeline-completed`
- Stack free-tier, local, via `npm run stack:up` (Docker Compose)

**Transformações — dbt Core + DuckDB**
- Adapter: `dbt-duckdb`; arquivo: `ews.duckdb` (spatial extension habilitada)
- **Bronze** (`bronze.stg_s2id_raw`): `read_parquet(latest.parquet)` + audit cols
- **Silver** (`silver.stg_s2id_clean`): incremental, dedup por `Protocolo_S2iD`, UF válida, join IBGE
- **Gold** (`gold.mart_disasters`): risk S1–S5, rankings por município/UF
- **Gold** (`gold.mart_analytics`): série temporal por UF
- **Gold** (`gold.mart_disasters_geo`): spatial join disasters × polígonos IBGE
- Testes de qualidade: `npm run dbt:test`

**DuckDB-first no Express**
- `/api/disasters` → `duckdbService.getSilverDisasters()` se DuckDB pronto; fallback `storage.ts`
- `/api/stats` → `duckdbService.getGoldStats()` se DuckDB pronto; fallback `storage.ts`
- Conexão lazy: DuckDB inicializa sob demanda; sem impacto em startup

**Bug fixes incluídos**
- `fetchWithRetry` em `geminiService.ts` — 3 tentativas com backoff exponencial
- Default `preset: 'all'` no `App.tsx` (não `'24h'`) — corrige "0 eventos" no startup
- `handleRefresh()` tenta Kestra REST API; fallback gracioso para reload local

---

## Funcionalidades Planejadas (Roadmap)

### FASE 12 — Monitoramento Produção
**Prioridade:** Alta
**Descrição:** Resiliência operacional para coleta contínua

- Retry logic para scrapes com falha (exponential backoff)
- Alertas email/Slack para falhas de coleta
- Logs persistentes com rotação
- Métricas de taxa de sucesso ao longo do tempo

---

### FASE 13 — AI Assistant Unificado
**Prioridade:** Alta
**Descrição:** Merge Oracle + GeoRAG em chatbot flutuante único

- Botão FAB (Floating Action Button) substitui painéis Oracle/GeoRAG separados
- Router de intent unificado que direciona para contexto MCDA ou busca semântica
- Libera 2 slots na sidebar direita

---

### FASE 14 — Módulo Financeiro
**Prioridade:** Baixa
**Descrição:** Tracking de impacto econômico associado a eventos críticos

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
| Orquestrador | Kestra CE (Docker, free) | Airflow: pesado; GitHub Actions: sem UI visual de DAG |
| Storage analítico | DuckDB embedded (`ews.duckdb`) | PostGIS exige servidor externo; DuckDB roda no processo Express |
| Transformações | dbt Core + dbt-duckdb | Scripts Python ad-hoc não têm lineage, testes ou contratos de schema |
| Script execution no Kestra | Express como proxy (`runScript()`) | Containers efêmeros no Kestra não herdam filesystem do host |
| dbt em Kestra | `docker.volumes` bind-mount | Sem volumes dbt não consegue escrever no `ews.duckdb` do host |
| DuckDB-first no Express | Silver → /api/disasters; Gold → /api/stats | Fallback para `storage.ts` garante zero downtime se pipeline não rodou |

---

## Métricas de Sucesso

| Métrica | Baseline | Target |
|---|---|---|
| Tempo de carregamento inicial | 45k registros client-side | < 2k registros com filtro server-side |
| Cobertura de municípios MCDA | 0 | 5.573 (100% Brasil) |
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
