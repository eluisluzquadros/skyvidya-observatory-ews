<div align="center">
<img width="800" alt="Skyvidya Observatory" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Skyvidya Observatory EWS — S2ID Disaster Monitor V2
</div>

Centro Integrado de Comando para análise e monitoramento de desastres naturais no Brasil. Agrega dados do **S2ID** e **Atlas Digital** com análise espacial avançada (LISA/MCDA), visualização 3D/2D, IA generativa e busca geoespacial semântica.

---

## Arquitetura

```
Frontend (React/Vite :3000)
  └── Globe 3D (D3.js) | Mapa Coroplético (D3 + GeoJSON)
  └── AnalyticsPanel | GeoRAGChat | TacticalAI (Gemini)

Backend Express.js (:3001)
  └── /api/disasters   — 45.942 registros Atlas (filtros server-side)
  └── /api/analytics/* — Risk MCDA, LISA clusters, GeoJSON, Rankings

Python FastAPI (:8000)           [analytics microservice]
  └── /pipeline/run   — ingestion → LISA → MCDA → JSON output
  └── /georag/query   — busca geoespacial em linguagem natural
```

---

## Features

### Visualização
- **Globe 3D interativo** — pan, zoom, auto-rotação, tooltips em hover (D3.js)
- **Mapa Coroplético 2D** — 4 modos de cor: risco MCDA, tendência, ameaça principal, clusters LISA
- **Toggle Globe/Mapa** — alternância fluida entre as duas visualizações
- **Design Command Center** — tema escuro `#0B0F14`, acentos laranja/ciano, estética Palantir

### Dados Reais
- **45.942 eventos** do Atlas Digital (1994–presente) via `database.json`
- **5.572 municípios** com scores MCDA calculados pelo pipeline Python
- **Filtros server-side** por período: presets 1A/2A/5A/10A/20A/HIST e calendário customizado
- **Datas reais** no formato DD/MM/AAAA — sem dados fictícios gerados por IA

### Analytics Pipeline (Python)
- **Ingestão** (Notebook 00): Atlas CSV + IBGE GeoParquet + COBRADE + 4 janelas temporais
- **LISA** (Notebook 01): Local Moran's I para 8 variáveis core, clusters HH/HL/LH/LL
- **MCDA** (Notebook 02): 8 critérios MinMax → score de risco → 5 categorias + tendência
- **Output**: `risk_analysis.json` (8.5MB), `lisa_clusters.json` (3.4MB), `municipality_geometries.geojson` (10MB)

### IA & Análise
- **Oracle AI** (Gemini 2.5 Flash) — insights enriquecidos com contexto MCDA real
- **GeoRAG** — queries em linguagem natural sobre perfis de risco municipal (DuckDB)
- **News Validation** — correlação de eventos com notícias via Gemini
- **Economic Impact** — análise de impacto econômico por evento

### Filtros de Período
- Presets rápidos: **1A, 2A, 5A, 10A, 20A, HIST** (histórico ~30 anos)
- **Calendário customizado**: seletores DE/ATÉ com validação de datas
- Filtragem **server-side** para escala de 45k registros

---

## Setup

### Pré-requisitos
- Node.js v18+
- Python 3.10+
- IBGE GeoParquet em `analytics/data/ibge/BR_Municipios_2024.geoparquet`

### Instalação

```bash
# Dependências Node
npm install

# Dependências Python
cd analytics && pip install -r requirements.txt && cd ..
```

### Variáveis de ambiente

Crie `.env` na raiz:
```env
GEMINI_API_KEY=sua_chave_aqui
```

### Executar

```bash
# Tudo junto (frontend + backend + Python analytics)
npm run dev:all

# Ou separado:
npm run dev:frontend    # :3000
npm run dev:backend     # :3001
npm run dev:python      # :8000

# Pipeline analytics (gera JSONs em server/data/analytics/)
npm run pipeline
```

---

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm run dev:all` | Frontend + Backend + Python analytics (concurrently) |
| `npm run dev:frontend` | Vite dev server (:3000) |
| `npm run dev:backend` | Express.js (:3001) com ts-node |
| `npm run dev:python` | FastAPI (:8000) com uvicorn |
| `npm run pipeline` | Executa pipeline Python completo |
| `npm run pipeline:download` | Download único do GeoParquet IBGE |
| `npm run build` | Build de produção |

---

## Estrutura do Projeto

```
s2id-disaster-monitor/
├── App.tsx                          # Root component com estado global
├── types.ts + analyticsTypes.ts     # Tipos TypeScript
├── services/
│   ├── geminiService.ts             # Gemini AI + fetchRealDisasters
│   └── analyticsService.ts          # Cliente API analytics
├── components/
│   ├── Globe.tsx                    # Globe 3D D3.js
│   ├── ChoroplethMap.tsx            # Mapa coroplético D3 + GeoJSON
│   ├── AnalyticsPanel.tsx           # Dashboard MCDA/LISA
│   ├── GeoRAGChat.tsx               # Chat de queries geoespaciais
│   ├── TacticalAI.tsx               # Oracle AI (Gemini)
│   ├── TopBar.tsx                   # NavBar com filtros de período
│   └── ...
├── server/
│   ├── src/index.ts                 # Express API (:3001)
│   ├── src/routes/analytics.ts      # Rotas /api/analytics/*
│   └── src/services/analyticsData.ts # Cache JSON analytics
├── analytics/
│   ├── pipeline/
│   │   ├── ingestion.py             # Notebook 00 → ingestão
│   │   ├── lisa_analysis.py         # Notebook 01 → LISA
│   │   ├── mcda_trend.py            # Notebook 02 → MCDA
│   │   └── report_data.py           # Notebook 03 → JSON output
│   ├── georag/engine.py             # Notebook 05 → GeoRAG
│   ├── main.py                      # FastAPI app
│   ├── config.py                    # Paths, COBRADE_MAP, configs
│   └── requirements.txt
└── docs/
    └── google_colab/                # Notebooks de referência (00–05)
```

---

## Roadmap

- [ ] **FASE A** — Reporting Assets: geração de mapas PNG e tabelas CSV via Notebook 03
- [ ] **FASE B** — AI Content Framework: narrativas textuais por município/estado via Gemini (Notebook 04)
- [ ] **FASE C1** — GeoRAG Semântico: embeddings ChromaDB + busca vetorial (Notebook 05)
- [ ] **FASE C2+C3** — Kepler.gl config + exportação CSV/GeoJSON dos resultados GeoRAG

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | React 18, Vite, D3.js v7, Recharts, Tailwind CSS v4, Lucide, Socket.IO client |
| Backend | Express.js, TypeScript, node-cron, Puppeteer, Socket.IO |
| Analytics | Python 3.10+, FastAPI, GeoPandas, PySAL (LISA), scikit-learn, DuckDB |
| IA | Google Gemini 2.5 Flash (`@google/genai`) |
| Dados | Atlas Digital (45.942 eventos), IBGE GeoParquet 2024 (5.572 municípios) |
