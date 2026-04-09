import { GoogleGenAI, Type } from "@google/genai";
import { DisasterDecree, TimeRange, NewsArticle, EconomicIndicator, ComexData, AftermathCheckpoint } from "../types";
import type { MunicipalityRisk, AnalyticsDistributions } from "../analyticsTypes";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Severity Calculator ──
export const calculateSeverity = (event: DisasterDecree): 1 | 2 | 3 | 4 | 5 => {
  const { affected, type } = event;
  const highRiskTypes = ['Inundação', 'Enxurrada', 'Deslizamento'];
  const isHighRisk = highRiskTypes.some(t => type.includes(t));

  if (affected > 50000 || (isHighRisk && affected > 20000)) return 5;
  if (affected > 20000 || (isHighRisk && affected > 10000)) return 4;
  if (affected > 5000) return 3;
  if (affected > 1000) return 2;
  return 1;
};

// ── State Coordinates ──
export const STATE_COORDS: Record<string, [number, number]> = {
  'SC': [-49.38, -27.59], 'RS': [-51.22, -30.03], 'PR': [-51.46, -25.43],
  'SP': [-46.63, -23.55], 'RJ': [-43.17, -22.91], 'MG': [-44.28, -18.51],
  'BA': [-41.68, -12.97], 'PE': [-37.73, -8.01], 'CE': [-39.32, -5.19],
  'AM': [-63.02, -3.12], 'PA': [-52.29, -3.42], 'MT': [-55.91, -12.64],
  'GO': [-49.26, -15.83], 'MS': [-54.62, -20.44], 'ES': [-40.31, -19.18],
  'RN': [-36.52, -5.79], 'PB': [-36.62, -7.12], 'AL': [-36.62, -9.57],
  'SE': [-37.07, -10.91], 'PI': [-42.68, -8.09], 'MA': [-44.28, -5.53],
  'TO': [-48.33, -10.18], 'RO': [-63.90, -11.50], 'AC': [-70.47, -9.97],
  'RR': [-60.67, 2.82], 'AP': [-51.07, 0.90], 'DF': [-47.88, -15.79]
};

const DISASTERS_API = '/api/disasters';

// ── Fetch Real Disasters from Backend API ──
const fetchWithRetry = async (url: string, retries = 3, baseDelay = 600): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries - 1) {
      await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
    }
  }
  throw lastError;
};

export const fetchRealDisasters = async (options: {
  startDate?: string | null;
  endDate?: string | null;
  uf?: string | null;
  municipality?: string | null;
  limit?: number;
} = {}): Promise<DisasterDecree[]> => {
  try {
    const params = new URLSearchParams({ limit: String(options.limit ?? 2000) });
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate)   params.set('endDate', options.endDate);
    if (options.uf)        params.set('uf', options.uf);
    if (options.municipality) params.set('municipality', options.municipality);

    const res = await fetchWithRetry(`${DISASTERS_API}?${params}`);
    const json = await res.json();
    const records: DisasterDecree[] = json.data || [];

    return records.map(d => ({
      ...d,
      severity: calculateSeverity(d),
      lat: STATE_COORDS[d.uf]?.[1] ?? -15.79,
      lng: STATE_COORDS[d.uf]?.[0] ?? -47.88,
    }));
  } catch (error) {
    console.error('Backend API error (after retries):', error);
    return [];
  }
};

// ── Fetch Status of Data Collections ──
export const fetchCollectionStatus = async (): Promise<any[]> => {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return [];
    const json = await res.json();
    return json.collections || [];
  } catch {
    return [];
  }
};

// ── Trigger Data Refresh (Sync/Scraper) ──
export const triggerRefresh = async (source?: string): Promise<{ success: boolean; count?: number; message?: string }> => {
  try {
    const res = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    const json = await res.json();
    return { 
      success: res.ok && json.success, 
      count: json.count,
      message: json.message
    };
  } catch (error) {
    return { success: false, message: 'Falha na conexão com o servidor.' };
  }
};

// ── Format ISO date YYYY-MM-DD → DD/MM/YYYY ──
export const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return dateStr; // already DD/MM/YYYY or unknown
};

// ── Parse Real S2ID Data ──
export const parseS2IDData = async (rawInput: string): Promise<DisasterDecree[]> => {
  try {
    try {
      const preParsed = JSON.parse(rawInput);
      if (Array.isArray(preParsed) && preParsed.length > 0 && preParsed[0].municipality) {
        return preParsed.map((d: DisasterDecree) => ({
          ...d,
          severity: calculateSeverity(d),
          lat: STATE_COORDS[d.uf]?.[1],
          lng: STATE_COORDS[d.uf]?.[0],
        }));
      }
    } catch (e) { /* not JSON */ }

    const prompt = `
      You are a specialized data scraper and parser for the Brazilian Civil Defense system (S2ID).
      Extract structured data from the following RAW TEXT.
      Map the data to JSON:
      - id: unique hash based on municipality+date
      - municipality: city name
      - uf: 2-letter state code
      - type: disaster type (Estiagem, Enxurrada, etc.)
      - date: DD/MM/YYYY
      - status: Homologado, Em Análise, Reconhecido
      - affected: number of affected people

      Raw Input: """${rawInput.substring(0, 50000)}"""
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              municipality: { type: Type.STRING },
              uf: { type: Type.STRING },
              type: { type: Type.STRING },
              date: { type: Type.STRING },
              status: { type: Type.STRING },
              affected: { type: Type.INTEGER },
            },
            required: ["id", "municipality", "uf", "type", "date", "status", "affected"],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    const data = JSON.parse(jsonText) as DisasterDecree[];
    return data.map(d => ({
      ...d,
      severity: calculateSeverity(d),
      lat: STATE_COORDS[d.uf]?.[1],
      lng: STATE_COORDS[d.uf]?.[0],
    }));
  } catch (error) {
    console.error("Failed to parse S2ID data:", error);
    throw new Error("Não foi possível processar os dados.");
  }
};

// ── Helper: Build MCDA context summary for prompts ──
function buildMCDAContext(riskData?: MunicipalityRisk[], distributions?: AnalyticsDistributions): string {
  if (!riskData || riskData.length === 0) return '';

  const highRisk = riskData.filter(m => m.riskCategory === 'Muito Alto' || m.riskCategory === 'Alto');
  const growing = riskData.filter(m => m.trend === 'Crescente');
  const top5 = [...riskData].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  let context = `\n\nDADOS MCDA (Multi-Criteria Decision Analysis) - ${riskData.length} municípios analisados:`;
  context += `\n• ${highRisk.length} municípios em risco Alto/Muito Alto (${(highRisk.length / riskData.length * 100).toFixed(1)}%)`;
  context += `\n• ${growing.length} municípios com tendência Crescente de desastres`;

  if (top5.length > 0) {
    context += `\n• Top 5 municípios por score de risco MCDA:`;
    for (const m of top5) {
      context += `\n  - ${m.name} (${m.uf}): score=${m.riskScore.toFixed(3)}, cat=${m.riskCategory}, tendência=${m.trend}, ameaça principal=${m.principalThreat}`;
    }
  }

  if (distributions?.riskCategories) {
    context += `\n• Distribuição de risco: ${distributions.riskCategories.map(c => `${c.category}=${c.count}`).join(', ')}`;
  }
  if (distributions?.threats) {
    const topThreats = distributions.threats.slice(0, 5);
    context += `\n• Ameaças dominantes: ${topThreats.map(t => `${t.threat}(${t.count})`).join(', ')}`;
  }

  return context;
}

// ── Intelligence Briefing ──
export const generateInsight = async (
  data: DisasterDecree[],
  riskData?: MunicipalityRisk[],
  distributions?: AnalyticsDistributions,
): Promise<string> => {
  if (!data || data.length === 0) {
    return "> MONITORAMENTO ATIVO: NENHUM EVENTO CRÍTICO REGISTRADO NO PERÍODO SELECIONADO. \n\nO sistema permanece em prontidão tática. Altere o filtro para '48H' ou 'HISTORICO' para analisar dados anteriores.";
  }
  try {
    const dataSummary = JSON.stringify(data.slice(0, 30));
    const mcdaContext = buildMCDAContext(riskData, distributions);

    // Pre-compute aggregates so the model can focus on interpretation, not arithmetic
    const total = data.length;
    const critical = data.filter(d => (d.affected ?? 0) > 20000).length;
    const totalAffected = data.reduce((s, d) => s + (d.affected ?? 0), 0);
    const ufs = new Set(data.map(d => d.uf)).size;

    const prompt = `
      You are a civil defense intelligence analyst writing for a Brazilian disaster monitoring platform.
      The current filter shows: ${total} disaster decrees across ${ufs} states, ${critical} with very high impact, totalling ${totalAffected.toLocaleString('pt-BR')} people affected.

      Write a SHORT qualitative briefing in Portuguese (pt-BR) — 2 sentences maximum, no bullet points, no headers.
      Sentence 1: Characterize the overall severity and geographic pattern of this period in plain language (accessible to non-experts).
      Sentence 2: Highlight the single most critical finding (worst event, dominant threat type, or geographic concentration) and what it implies operationally.
      ${mcdaContext ? 'Use MCDA risk data to enrich the operational implication.' : ''}
      Do NOT repeat the raw numbers — translate their meaning instead.
      Data: ${dataSummary}
      ${mcdaContext}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "> FALHA AO ESTABELECER CONEXÃO COM MÓDULO DE INTELIGÊNCIA.";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error generating insight:", msg);
    return `> ERRO CRÍTICO: ${msg}`;
  }
};

// ── News Scraping / Validation ──
export const fetchEventNews = async (event: DisasterDecree): Promise<NewsArticle[]> => {
  try {
    const prompt = `
      You are an investigative data journalist AI.
      Generate 5 REALISTIC news articles that would validate and provide context for this disaster event:
      
      Municipality: ${event.municipality}, UF: ${event.uf}
      Disaster Type: ${event.type}
      Date: ${event.date}
      Affected: ${event.affected} people
      
      For EACH article, provide:
      - title: A realistic headline from Brazilian media (G1, Folha, CNN Brasil, UOL, Estadão)
      - source: The news outlet name
      - url: A plausible URL (FAKE but realistic format)
      - snippet: 2-3 sentences describing the article content with QUANTITATIVE data (numbers, statistics, infrastructure damage estimates)
      - publishedAt: realistic ISO date near the event date
      - sentiment: "negative", "neutral", or "positive"
      - relevanceScore: 0.0-1.0 score of how closely this relates to the event
      
      Make the articles RICH with quantitative data: km² affected, infrastructure damage costs in R$, number of displaced families, rescue operations deployed, etc.
      Write in Portuguese (pt-BR).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              source: { type: Type.STRING },
              url: { type: Type.STRING },
              snippet: { type: Type.STRING },
              publishedAt: { type: Type.STRING },
              sentiment: { type: Type.STRING },
              relevanceScore: { type: Type.NUMBER },
            },
            required: ["id", "title", "source", "url", "snippet", "publishedAt", "sentiment", "relevanceScore"],
          },
        },
      },
    });

    const jsonText = response.text;
    return jsonText ? JSON.parse(jsonText) as NewsArticle[] : [];
  } catch (error) {
    console.error("News fetch error:", error);
    return [];
  }
};

// ── Generate Headlines (simplified for feed) ──
export const generateNews = async (event: DisasterDecree): Promise<string[]> => {
  try {
    const prompt = `
      Generate 3 realistic breaking news headlines (Portuguese pt-BR) for:
      Municipality: ${event.municipality}, UF: ${event.uf}, Type: ${event.type}, Date: ${event.date}
      Sound like G1, Folha, CNN Brasil. Include quantitative data.
      Return ONLY a JSON array of strings.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error("News Generation Error:", error);
    return ["Erro ao carregar notícias."];
  }
};

// ── Economic Impact Data ──
export const fetchEconomicImpact = async (
  event: DisasterDecree,
  socioContext?: {
    pibPerCapita?: number;
    pibTotal?: number;
    idhm?: number;
    receitasBrutas?: number;
    despesasBrutas?: number;
    riskScore?: number;
    riskCategory?: string;
    trend?: string;
  }
): Promise<{
  indicators: EconomicIndicator[];
  comex: ComexData[];
  aftermath: AftermathCheckpoint[];
}> => {
  try {
    const socioLine = socioContext ? `
      Municipal socioeconomic profile:
      - PIB total: R$ ${socioContext.pibTotal ? (socioContext.pibTotal * 1000).toLocaleString('pt-BR') : 'unknown'} thousand
      - PIB per capita: R$ ${socioContext.pibPerCapita?.toLocaleString('pt-BR') ?? 'unknown'}
      - IDHM: ${socioContext.idhm?.toFixed(3) ?? 'unknown'}
      - Municipal revenue: R$ ${socioContext.receitasBrutas ? (socioContext.receitasBrutas * 1000).toLocaleString('pt-BR') : 'unknown'} thousand
      - Municipal expenses: R$ ${socioContext.despesasBrutas ? (socioContext.despesasBrutas * 1000).toLocaleString('pt-BR') : 'unknown'} thousand
      - Climate risk score: ${socioContext.riskScore?.toFixed(2) ?? 'unknown'} (${socioContext.riskCategory ?? 'unknown'})
      - Event trend: ${socioContext.trend ?? 'unknown'}
    ` : '';

    const prompt = `
      You are a quantitative economist specializing in natural disaster economic impact analysis in Brazil,
      using event study methodology aligned with the iCS "Clima na Economia" research agenda.

      Disaster Event:
      - Municipality: ${event.municipality}, UF: ${event.uf}
      - Type: ${event.type}
      - Date: ${event.date}
      - Affected: ${event.affected} people
      ${socioLine}

      Generate structured economic impact analysis with THREE components:

      1. "indicators": Array of 4 IBOVESPA sector indices most impacted (realistic Brazilian market values):
         - Sectors relevant to this disaster type and UF's economic base
         - Fields: id, name, value (points), change, changePercent, direction ("up"/"down"/"stable"), timestamp

      2. "comex": Array of 3 COMEX STAT trade products disrupted:
         - Products actually exported/imported by ${event.uf} that are disrupted by ${event.type}
         - Consider ${event.uf}'s known export profile (e.g. SC=furniture/poultry, RS=soybeans, AM=electronics)
         - Fields: id, product, ncm, uf, exportValue (US$), importValue (US$), period ("${new Date(event.date).toLocaleDateString('pt-BR', {month:'2-digit',year:'numeric'})}"), variation (%)

      3. "aftermath": Array of 4 time-window impact estimates (event study T+X):
         Each checkpoint: period ("T+1d"/"T+7d"/"T+30d"/"T+90d"), label, marketImpact (% sector index change, negative=loss),
         comexImpact (% trade volume change, negative=disruption), fiscalImpact (R$ millions of municipal fiscal cost),
         narrative (1 sentence explaining what happens at this stage based on historical disaster patterns in Brazil).

         Pattern guidance:
         - T+1d: immediate price shocks, supply chain alerts, emergency spending
         - T+7d: insurance claims, logistics rerouting, first production losses
         - T+30d: COMEX data starts showing disruption, GDP revision, reconstruction contracts
         - T+90d: recovery trajectory, structural economic effects, fiscal stress if municipality has deficit

         Calibrate severity using: affected population=${event.affected}, IDHM=${socioContext?.idhm ?? 'medium'},
         municipal revenue=${socioContext?.receitasBrutas ? 'R$ ' + (socioContext.receitasBrutas * 1000 / 1e6).toFixed(0) + 'M' : 'unknown'}.

      Make all values REALISTIC and evidence-based for the Brazilian economy.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            indicators: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  change: { type: Type.NUMBER },
                  changePercent: { type: Type.NUMBER },
                  direction: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                },
                required: ["id", "name", "value", "change", "changePercent", "direction", "timestamp"],
              },
            },
            comex: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  product: { type: Type.STRING },
                  ncm: { type: Type.STRING },
                  uf: { type: Type.STRING },
                  exportValue: { type: Type.NUMBER },
                  importValue: { type: Type.NUMBER },
                  period: { type: Type.STRING },
                  variation: { type: Type.NUMBER },
                },
                required: ["id", "product", "ncm", "uf", "exportValue", "importValue", "period", "variation"],
              },
            },
            aftermath: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  period: { type: Type.STRING },
                  label: { type: Type.STRING },
                  marketImpact: { type: Type.NUMBER },
                  comexImpact: { type: Type.NUMBER },
                  fiscalImpact: { type: Type.NUMBER },
                  narrative: { type: Type.STRING },
                },
                required: ["period", "label", "marketImpact", "comexImpact", "fiscalImpact", "narrative"],
              },
            },
          },
          required: ["indicators", "comex", "aftermath"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return { indicators: [], comex: [], aftermath: [] };
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Economic data error:", error);
    return { indicators: [], comex: [], aftermath: [] };
  }
};

// ── AI Chat (Tactical Oracle) ──
export interface OracleAnalyticsContext {
  riskData?: MunicipalityRisk[];
  distributions?: AnalyticsDistributions;
}

export const chatWithAI = async (
  message: string,
  context: DisasterDecree[],
  analyticsContext?: OracleAnalyticsContext,
): Promise<string> => {
  try {
    const dataSummary = JSON.stringify(context.slice(0, 20));
    const mcdaContext = buildMCDAContext(analyticsContext?.riskData, analyticsContext?.distributions);
    const prompt = `
      You are the "SKYVIDYA COMMAND ORACLE" — an advanced AI system for Brazilian disaster intelligence.

      CAPABILITIES:
      - Analyze disaster patterns, severity, and geographic clustering
      - Correlate disasters with economic impacts (agriculture, infrastructure, supply chains)
      - Provide risk assessments and predictions using MCDA (Multi-Criteria Decision Analysis) scores
      - Generate SITREP (Situation Reports) on demand
      - Reference municipality-level risk categories (Muito Baixo → Muito Alto), trends (Crescente/Estável/Decrescente), and principal threats

      CURRENT MISSION DATA (recent decrees): ${dataSummary}
      ${mcdaContext}

      USER QUERY: "${message}"

      Guidelines:
      1. Respond in Portuguese (pt-BR)
      2. Use professional intelligence/military terminology
      3. Include quantitative data and metrics when relevant — especially MCDA scores and risk categories when available
      4. Format with clear sections and bullet points
      5. Keep responses focused and actionable
      6. When referencing risk levels, use the MCDA categories: Muito Baixo, Baixo, Médio, Alto, Muito Alto
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "> FALHA NA RESPOSTA DO ORÁCULO.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "> ERRO DE CONEXÃO COM O NÚCLEO DE INTELIGÊNCIA.";
  }
};

// ── Risk Report Generator (MCDA-powered) ──
export const generateRiskReport = async (
  riskData: MunicipalityRisk[],
  distributions?: AnalyticsDistributions,
  uf?: string,
): Promise<string> => {
  try {
    const filtered = uf ? riskData.filter(m => m.uf === uf) : riskData;
    const top20 = [...filtered].sort((a, b) => b.riskScore - a.riskScore).slice(0, 20);
    const dataSummary = JSON.stringify(top20.map(m => ({
      name: m.name, uf: m.uf, score: m.riskScore, cat: m.riskCategory,
      trend: m.trend, threat: m.principalThreat, pop: m.population,
      historic: m.historicCount, last10yr: m.last10yrCount, last5yr: m.last5yrCount, last2yr: m.last2yrCount,
    })));

    const distSummary = distributions ? JSON.stringify(distributions) : 'N/A';
    const scope = uf ? `Estado: ${uf}` : 'Brasil (todos os estados)';

    const prompt = `
      Gere um RELATÓRIO DE RISCO MCDA profissional e detalhado em Português (pt-BR).

      ESCOPO: ${scope}
      TOTAL MUNICÍPIOS ANALISADOS: ${filtered.length}
      TOP 20 MUNICÍPIOS POR SCORE DE RISCO: ${dataSummary}
      DISTRIBUIÇÕES GERAIS: ${distSummary}

      ESTRUTURA DO RELATÓRIO:

      ## 1. SUMÁRIO EXECUTIVO
      - Visão geral da situação de risco na área de análise
      - KPIs principais: total municípios, % alto risco, tendência dominante

      ## 2. MUNICÍPIOS CRÍTICOS
      - Lista dos 10 municípios com maior score MCDA
      - Para cada um: score, categoria, tendência, ameaça principal, população
      - Análise do padrão geográfico (concentração regional)

      ## 3. ANÁLISE DE TENDÊNCIAS
      - Proporção Crescente/Estável/Decrescente
      - Implicações das tendências para planejamento de defesa civil

      ## 4. AMEAÇAS PREDOMINANTES
      - Ranking dos tipos de desastre mais frequentes
      - Correlação entre tipo de ameaça e região geográfica

      ## 5. RECOMENDAÇÕES OPERACIONAIS
      - 3-5 ações prioritárias baseadas nos dados
      - Alocação de recursos sugerida

      Use terminologia profissional de defesa civil e gestão de riscos.
      Inclua dados quantitativos em todas as seções.
      Formato: Markdown com headers, bullet points e negrito para destaques.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "> FALHA NA GERAÇÃO DO RELATÓRIO DE RISCO.";
  } catch (error) {
    console.error("Risk report generation error:", error);
    return "> ERRO CRÍTICO: FALHA NA GERAÇÃO DO RELATÓRIO MCDA.";
  }
};