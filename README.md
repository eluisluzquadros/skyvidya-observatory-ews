<div align="center">
<img width="800" alt="Skyvidya Observatory EWS" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Skyvidya Observatory — Early Warning System (EWS)
**v3.0 · Monitoramento Inteligente de Desastres Naturais no Brasil**
</div>

Plataforma de comando e análise geoespacial de desastres naturais no Brasil. Agrega dados reais do **S2ID** e **Atlas Digital** com análise espacial avançada (LISA/MCDA), visualização 3D/2D, IA generativa (Gemini), busca geoespacial semântica, **Modern Geospatial Data Stack** (Kestra + dbt + DuckDB medallion) e design system 2026.

---

## Arquitetura

```
Frontend (React 19 / Vite :3000)
  └── Globe 3D (D3.js) | Mapa Coroplético (D3 + GeoJSON)
  └── AnalyticsPanel | GeoRAGChat | TacticalAI (Gemini)
  └── Pipeline status indicator (Socket.IO)
  └── Design System: Syne + Plus Jakarta Sans + JetBrains Mono

Backend Express.js (:3001)          [único API gateway]
  └── /api/disasters   — DuckDB Silver layer (fallback: database.json)
  └── /api/stats       — DuckDB Gold layer (fallback: storage.ts)
  └── /api/analytics/* — Risk MCDA, LISA clusters, GeoJSON, Rankings
  └── /api/pipeline/*  — Webhooks Kestra + trigger + runScript()

Python FastAPI (:8000)              [analytics microservice]
  └── /pipeline/run   — ingestion → LISA → MCDA → JSON output
  └── /georag/query   — busca geoespacial em linguagem natural

Modern Data Stack (opcional, orquestração visual)
  └── Kestra CE (:8080) — DAG de 9 tasks (agendamento semanal seg 06:00 BRT)
  └── dbt Core — modelos Bronze/Silver/Gold sobre DuckDB
  └── DuckDB embedded — ews.duckdb (spatial extension habilitada)

Lineage dos dados:
  S2ID scrape / Atlas CSV
    → database.json                      (Puppeteer — storage existente)
    → bronze/latest.parquet              (bronze_ingest.py)
    → silver.stg_s2id_clean  (DuckDB)    (dbt silver — dedup, UF, IBGE join)
    → gold.mart_disasters    (DuckDB)    (dbt gold — risk S1–S5, rankings)
    → gold.mart_analytics    (DuckDB)    (dbt gold — série temporal por UF)
    → gold.mart_disasters_geo(DuckDB)    (dbt gold spatial — polígonos IBGE)
    → municipality_geometries.geojson    (export_gold_geojson.py)
    → Express /api/* → React frontend
```

---

## Features

### Interface & UX
- **Sidebar esquerda colapsável** — feed de eventos com toggle hide/show; ícone `‹` retrai, `›` expande
- **Sidebar direita colapsável** — painéis de detalhe com toggle; icon rail vertical quando recolhida (clique em qualquer ícone ativa o painel)
- **Auto-select do evento mais recente** — ao carregar, a sidebar direita já exibe dados e insights do evento mais recente sem necessidade de clique
- **7 painéis na sidebar direita**: Detalhe · News · Econ · Oracle · Comms · Risco · GeoRAG

### Visualização
- **Globe 3D interativo** — pan, zoom, auto-rotação, tooltips em hover (D3.js)
- **Mapa Coroplético 2D** — 4 modos de cor: risco MCDA, tendência, ameaça principal, clusters LISA
- **Toggle Globe/Mapa** — alternância fluida entre visualizações
- **Design Command Center 2026** — tema escuro `#0B0F14`, Syne bold para branding, acentos laranja/ciano

### Dados Reais
- **45.942 eventos** do Atlas Digital (1994–presente) via `database.json`
- **5.573 municípios** com scores MCDA calculados pelo pipeline Python
- **Filtros server-side** por período: presets 1A / 2A / 5A / 10A / 20A / HIST e calendário customizado DE→ATÉ
- **Datas reais** no formato DD/MM/AAAA — sem dados fictícios gerados por IA

### Analytics Pipeline (Python)
- **Ingestão** (Notebook 00): Atlas CSV + IBGE GeoParquet + COBRADE + 4 janelas temporais
- **LISA** (Notebook 01): Local Moran's I para 8 variáveis core, clusters HH/HL/LH/LL
- **MCDA** (Notebook 02): 8 critérios MinMax → score de risco → 5 categorias + tendência
- **Output**: `risk_analysis.json` (8.5MB), `lisa_clusters.json` (3.4MB), `municipality_geometries.geojson` (10MB)
- **Reporting Assets**: 7 PNGs (matplotlib) + 1 CSV exportáveis via endpoint
- Runtime: ~107s para Brasil completo

### Modern Data Stack (Kestra + dbt + DuckDB)
- **Kestra CE** (:8080 via Docker) — orquestrador visual com DAG de 9 tasks (agendamento semanal)
- **dbt Core** — transformações Bronze → Silver → Gold sobre DuckDB (incluindo `dbt-duckdb` adapter)
- **DuckDB embedded** (`ews.duckdb`) — engine analítica com extensão `spatial`; sem servidor externo
- **Medallion**: Bronze (raw Parquet) → Silver (dedup, IBGE join) → Gold (risk S1–S5, rankings, GeoJSON)
- **DuckDB-first no Express**: `/api/disasters` serve Silver layer; `/api/stats` serve Gold layer; fallback automático para `storage.ts` se DuckDB não estiver pronto
- **Socket.IO broadcast**: Kestra notifica frontend em tempo real via webhooks `pipeline-started/completed/failed`
- Toda a stack é **free tier** e roda localmente via Docker Compose

### IA & Análise
- **Oracle AI** (Gemini 2.5 Flash) — insights enriquecidos com contexto MCDA real
- **GeoRAG** — queries em linguagem natural sobre perfis de risco municipal (ChromaDB + DuckDB)
- **LLM Content** — narrativas profissionais por município/estado via Gemini
- **News Validation** — correlação de eventos com notícias via Gemini
- **Economic Impact** — análise de impacto econômico por evento
- **Kepler.gl Config** — visualização avançada + exportação CSV/GeoJSON dos resultados GeoRAG

---

## Setup

### Pré-requisitos
- Node.js v18+
- Python 3.10+
- Docker Desktop (para Kestra CE — opcional)
- IBGE GeoParquet em `analytics/data/ibge/BR_Municipios_2024.geoparquet`

### Instalação

```bash
# Dependências Node
npm install

# Dependências Python (analytics microservice)
cd analytics && pip install -r requirements.txt && cd ..

# Dependências Python (pipeline scripts)
pip install -r pipeline/requirements.txt
```

### Variáveis de ambiente

Crie `.env` na raiz:
```env
GEMINI_API_KEY=sua_chave_aqui
```

Para usar a Modern Data Stack (Kestra), copie e edite:
```bash
cp pipeline/.env.example pipeline/.env
# Defina HOST_EWS_DATA e HOST_EWS_DBT com os caminhos absolutos do projeto
```

### Executar

```bash
# Dev diário (frontend + backend + Python analytics)
npm run dev:all

# Ou separado:
npm run dev:frontend    # :3000
npm run dev:backend     # :3001
npm run dev:analytics   # :8000

# Pipeline Python (gera JSONs em server/data/analytics/)
npm run pipeline

# Download único do GeoParquet IBGE (executar uma vez)
npm run pipeline:download

# Modern Data Stack — pipeline manual (sem Kestra)
npm run bronze:ingest   # database.json → Bronze GeoParquet
npm run dbt:run         # Bronze → Silver → Gold (inclui dbt deps)
npm run geo:export      # Gold DuckDB → municipality_geometries.geojson
npm run pipeline:full   # bronze:ingest + dbt:run + geo:export em sequência

# Modern Data Stack — Kestra CE (orquestração visual)
npm run stack:up        # Sobe Kestra em http://localhost:8080
npm run stack:logs      # Logs do container Kestra
npm run stack:down      # Para o Kestra
```

---

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm run dev:all` | Frontend + Backend + Python analytics (concurrently) |
| `npm run dev:frontend` | Vite dev server (:3000) |
| `npm run dev:backend` | Express.js (:3001) com ts-node |
| `npm run dev:analytics` | FastAPI (:8000) com uvicorn |
| `npm run pipeline` | Pipeline Python completo (LISA + MCDA + JSONs) |
| `npm run pipeline:download` | Download único do GeoParquet IBGE |
| `npm run pipeline:full` | bronze:ingest + dbt:run + geo:export em sequência |
| `npm run bronze:ingest` | database.json → Bronze GeoParquet |
| `npm run dbt:run` | Bronze → Silver → Gold (com dbt deps) |
| `npm run dbt:test` | Executa testes de qualidade dbt |
| `npm run dbt:silver` | Apenas camada Silver |
| `npm run dbt:gold` | Apenas camada Gold |
| `npm run dbt:spatial` | Apenas mart_disasters_geo (Gold spatial) |
| `npm run geo:export` | Gold DuckDB → municipality_geometries.geojson |
| `npm run stack:up` | Sobe Kestra CE em http://localhost:8080 |
| `npm run stack:down` | Para o Kestra |
| `npm run stack:logs` | Logs do container Kestra |
| `npm run collect:atlas` | Download Atlas Digital CSV |
| `npm run collect:s2id` | Scraping S2ID via Puppeteer |
| `npm run collect:all` | Atlas + S2ID |
| `npm run build` | Build de produção |

---

## Estrutura do Projeto

```
s2id-disaster-monitor/
├── App.tsx                          # Root component — layout 3 colunas, estado global
├── index.html                       # Entry point — Skyvidya Observatory EWS
├── index.css                        # Design System 2026 (CSS vars, fontes, tokens)
├── types.ts + analyticsTypes.ts     # Tipos TypeScript
├── services/
│   ├── geminiService.ts             # Gemini AI + fetchRealDisasters + retry
│   ├── analyticsService.ts          # Cliente API analytics
│   └── apiService.ts                # Socket.IO client (pipeline events)
├── components/
│   ├── TopBar.tsx                   # NavBar — branding EWS + filtros + pipeline indicator
│   ├── Globe.tsx                    # Globe 3D D3.js
│   ├── ChoroplethMap.tsx            # Mapa coroplético D3 + GeoJSON
│   ├── AnalyticsPanel.tsx           # Dashboard MCDA/LISA
│   ├── GeoRAGChat.tsx               # Chat de queries geoespaciais
│   ├── TacticalAI.tsx               # Oracle AI (Gemini)
│   ├── ViewToggle.tsx               # Toggle Globe ↔ Mapa Analítico
│   └── ...
├── server/
│   ├── src/index.ts                 # Express API (:3001)
│   ├── src/routes/api.ts            # /api/disasters + /api/stats (DuckDB-first)
│   ├── src/routes/analytics.ts      # Rotas /api/analytics/*
│   ├── src/routes/pipeline.ts       # Webhooks Kestra + runScript() proxy
│   ├── src/services/duckdbService.ts # DuckDB lazy connect — Silver/Gold queries
│   └── src/services/analyticsData.ts # Cache JSON analytics + reload()
├── analytics/
│   ├── pipeline/
│   │   ├── ingestion.py             # Notebook 00 → ingestão
│   │   ├── lisa_analysis.py         # Notebook 01 → LISA
│   │   ├── mcda_trend.py            # Notebook 02 → MCDA
│   │   └── report_data.py           # Notebook 03 → JSON output
│   ├── georag/engine.py             # Notebook 05 → GeoRAG (ChromaDB + DuckDB)
│   ├── main.py                      # FastAPI app (:8000)
│   ├── config.py                    # Paths, COBRADE_MAP, configs
│   └── requirements.txt
├── pipeline/                        # Modern Data Stack
│   ├── docker-compose.yml           # Kestra CE + volumes
│   ├── .env.example                 # HOST_EWS_DATA, HOST_EWS_DBT
│   ├── kestra/flows/
│   │   └── s2id-ingestion.yml       # DAG 9 tasks (semanal seg 06:00 BRT)
│   ├── dbt/
│   │   ├── dbt_project.yml          # Config medallion bronze/silver/gold
│   │   ├── profiles.yml             # Target dev (local) + docker (Kestra)
│   │   ├── packages.yml             # dbt-utils >= 1.1.0
│   │   └── models/
│   │       ├── bronze/              # stg_s2id_raw.sql + sources.yml
│   │       ├── silver/              # stg_s2id_clean.sql + stg_ibge_municipalities.sql
│   │       └── gold/                # mart_disasters.sql + mart_analytics.sql + mart_disasters_geo.sql
│   └── scripts/
│       ├── bronze_ingest.py         # database.json → Bronze GeoParquet
│       └── export_gold_geojson.py   # Gold DuckDB → municipality_geometries.geojson
└── docs/
    ├── PRD.md                       # Product Requirements Document
    └── google_colab/                # Notebooks de referência (00–05)
```

---

## Design System

| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#0B0F14` | Background base |
| `--primary` | `#FF5E3A` | Skyvidya orange |
| `--cyan` | `#00D4FF` | Acento secundário |
| `--font-brand` | `Syne` | Nome da plataforma |
| `--font-body` | `Plus Jakarta Sans` | Conteúdo geral |
| `--font-mono` | `JetBrains Mono` | Dados, labels, código |
| `--btn-height-sm` | `28px` | Altura uniforme de botões |

---

## Roadmap

- [x] **Fase 1–4** — Dados reais, scraper, backend, dashboard inicial
- [x] **Fase 5** — Globe 3D, UI Command Center V1
- [x] **Fase 6–7** — Pipeline Analytics Python (LISA + MCDA + GeoRAG)
- [x] **Fase 8** — Gemini enriquecido com contexto MCDA
- [x] **Fase 9** — Design System 2026 + rebrand Skyvidya Observatory EWS
- [x] **Fase 10** — Sidebar hide/show (ambos) + auto-select evento mais recente
- [x] **Fase A** — Reporting Assets: mapas PNG + tabelas CSV via pipeline + endpoint Express
- [x] **Fase B** — AI Content Framework: narrativas por município/estado via Gemini (Notebook 04)
- [x] **Fase C** — GeoRAG Semântico: ChromaDB + Kepler.gl + exportação CSV/GeoJSON
- [x] **Fase 11** — Data Quality: Atlas dedup (Protocolo_S2iD), UF normalization, UTF-8 mojibake fix, server-side stats
- [x] **Modern Data Stack** — Kestra CE + dbt Core + DuckDB medallion; DuckDB-first no Express; Socket.IO pipeline events
- [ ] **Fase 12** — Monitoramento Produção: retry logic, alertas de falha, logs persistentes
- [ ] **Fase 13** — AI Assistant unificado (Oracle + GeoRAG → chatbot flutuante único)
- [ ] **Fase 14** — Módulo financeiro: impacto econômico por município/evento

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | React 19, Vite 6, D3.js v7, Recharts, Tailwind CSS v4, daisyUI v5, Lucide |
| Fontes | Syne (brand), Plus Jakarta Sans (body), JetBrains Mono (data), Space Grotesk (display) |
| Backend | Express.js, TypeScript, node-cron, Puppeteer, Socket.IO |
| Analytics | Python 3.10+, FastAPI, GeoPandas, PySAL (LISA), scikit-learn, DuckDB, ChromaDB |
| IA | Google Gemini 2.5 Flash (`@google/genai`) |
| Data Stack | Kestra CE (orquestrador), dbt Core + dbt-duckdb, DuckDB embedded (spatial) |
| Dados | Atlas Digital (45.942 eventos), IBGE GeoParquet 2024 (5.573 municípios) |
