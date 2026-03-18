# Action Plan — Skyvidya Observatory EWS
**Última atualização:** 2026-03-18

---

## Fase 1 — Estabilidade & Coleta de Dados ✅
- [x] Fix S2ID Scraper: resolução de inputs de data e detecção de download
- [x] Script de importação manual: parsing robusto de CSV com encoding
- [x] Teste end-to-end: fluxo completo Scrape → Parse → Database — **45.941 registros armazenados**
- [x] Agendamento: Cron jobs (Atlas: domingos 3h; S2ID: diário 6h)

## Fase 2 — Integração Backend ✅
- [x] Database: JSON database armazenando `DisasterRecord` (42.734 Atlas + 3.207 S2ID)
- [x] API Endpoints:
  - `GET /api/disasters` — listagem com filtros
  - `GET /api/stats` — stats agregadas
  - `GET /api/status` — status de coleta
- [x] Conexão Frontend: Dashboard conectado ao backend com dados reais

## Fase 3 — Atlas Digital ✅
- [x] Downloader: download direto do CSV via URL do Atlas S2ID
- [x] Parser: formato CSV Atlas (delimitador ponto-e-vírgula, datas pt-BR)
- [x] Integração: dados históricos Atlas + S2ID live (~71.929 registros processados)
- [x] Cache: 24h para CSV Atlas

## Fase 4 — Dashboard Frontend V1 ✅
- [x] Conexão UI → API: Dashboard com dados reais do backend
- [x] Gráficos: distribuição por tipo e estado (Recharts)
- [x] Filtros: UF e tipo de desastre
- [x] Mapa: Globe 3D interativo (D3.js)
- [x] Indicador de status backend + hora da última atualização

## Fase 5 — Monitoramento & Produção (Parcial)
- [x] Cron jobs configurados e em operação
- [ ] **Error Handling:** retry logic para scrapes com falha
- [ ] **Alertas:** notificações email/Slack para falhas de coleta
- [ ] **Logs persistentes:** logging em arquivo rotativo
- [ ] **Métricas:** taxa de sucesso de coleta ao longo do tempo

## Fase 6 — Command Center V2 ✅
- [x] UI alta-contraste com glassmorphism — `#FF5E3A` (laranja) e `#00D4FF` (ciano)
- [x] Globe 3D com dados reais em tempo real
- [x] Controles interativos: auto-rotação Play/Pause, pan, zoom
- [x] Tooltips hover com contexto preciso (UF, tipo, município, afetados)
- [x] Filtros de período server-side: presets 1A/2A/5A/10A/20A/HIST + calendário DE→ATÉ

## Fase 7 — Analytics Pipeline Python ✅
- [x] **Ingestão** (Notebook 00): Atlas CSV + IBGE GeoParquet + COBRADE + 4 janelas temporais
- [x] **LISA** (Notebook 01): Local Moran's I — 8 variáveis core, clusters HH/HL/LH/LL, 999 permutações
- [x] **MCDA** (Notebook 02): 8 critérios MinMax → score 0-1 → 5 categorias + tendência + ameaça
- [x] **Output** (Notebook 03): risk_analysis.json (8.5MB), lisa_clusters.json (3.4MB), GeoJSON (10MB)
- [x] **ChoroplethMap**: mapa 2D com 4 modos de cor, d3-zoom, tooltips
- [x] **AnalyticsPanel**: StatCards, Top-10 ranking, distribuição Recharts, seletor LISA
- [x] **ViewToggle**: alternância Globe ↔ Mapa Analítico

## Fase 8 — GeoRAG & Gemini MCDA ✅
- [x] **GeoRAG Engine**: DuckDB + NLP rule-based, interface chat, municípios clicáveis
- [x] **Oracle AI enriquecido**: `chatWithAI()` e `generateInsight()` com contexto MCDA real
- [x] **Automação**: trigger pipeline pós-coleta Atlas, indicador MCDA ON/OFF na TopBar
- [x] **Exports JSON** pré-computados servidos diretamente pelo Express (padrão batch)

## Fase 9 — Design System 2026 & Rebrand ✅
- [x] **Rebrand**: "S2ID Command" → **"Skyvidya Observatory: Early Warning System — EWS"**
- [x] **Fontes 2026**: `Syne` (brand), `Plus Jakarta Sans` (body), `JetBrains Mono` (dados)
- [x] **Tokens CSS**: `--btn-height-sm: 28px`, `--font-brand`, spacing scale, radius
- [x] **Botões uniformes**: `.btn-tactical`, `.filter-chip`, `.donate-btn` com altura consistente
- [x] `.glow-orange` adicionado ao CSS (estava faltando, referenciado no TopBar)
- [x] `font-feature-settings` kern + liga; `font-smoothing` global

## Fase 10 — Sidebar UX: Hide/Show & Auto-Select ✅
- [x] **Sidebar esquerda**: botão `‹` recolhe; botão `›` expande; transição `cubic-bezier(0.4,0,0.2,1)`
- [x] **Sidebar direita**: botão `›` no header da tab bar recolhe para icon rail (44px); clique em ícone expande e ativa o painel
- [x] **Icon rail direito**: ícone da aba ativa com borda lateral cyan quando sidebar recolhida
- [x] **Auto-select**: `useRef` one-shot dispara `handleEventSelect(filteredData[0])` após primeiro carregamento — sidebar direita populada imediatamente sem clique

---

## Estatísticas do Dataset

| Métrica | Valor |
|---|---|
| Total de registros | 45.942 |
| Registros Atlas | 42.734 |
| Registros S2ID | 3.207 |
| Municípios com MCDA | 5.572 |
| Estado mais afetado | MG (5.716) |
| Tipo mais frequente | Estiagem (19.741) |
| Período | 1991 – 2025 |

---

## Próximas Ações Prioritárias

### Alta Prioridade
1. **[FASE A]** Reporting Assets — `reporting_charts.py` com matplotlib; 7 PNGs + 1 CSV; endpoint Express + thumbnails no AnalyticsPanel
2. **[FASE B]** AI Content Framework — `LLMContentGenerator` com Gemini; narrativas por UF via FastAPI; botão "Gerar Relatório IA" no frontend

### Média Prioridade
3. **[FASE C1]** GeoRAG Semântico — ChromaDB + `sentence-transformers` multilíngue; `hybrid_query()` re-ranking
4. **[FASE 5]** Monitoramento — retry logic, alertas de falha, logs persistentes

### Baixa Prioridade
5. **[FASE C2+C3]** Kepler.gl config + exportação CSV/GeoJSON dos resultados GeoRAG
6. **Exportação geral** — CSV/Excel de dados filtrados para qualquer período
7. **Módulo financeiro** — tracking de mercado associado a eventos críticos
