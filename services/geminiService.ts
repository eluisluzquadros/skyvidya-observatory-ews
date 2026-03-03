import { GoogleGenAI, Type } from "@google/genai";
import { DisasterDecree, NewsArticle, EconomicIndicator, ComexData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

// ── Simulated Data ──
const MOCK_PROMPT = `
  Generate a realistic dataset of 20 to 30 natural disaster decrees (Situação de Emergência or Estado de Calamidade Pública) 
  from the Brazilian S2ID system.
  Focus on RECENT events (2024-2025).
  Include a realistic mix of:
  - "Estiagem" (Drought) in Northeast/South regions.
  - "Enxurrada" (Flash Flood) or "Inundação" (Flood) in South/Southeast.
  - "Incêndio Florestal" (Forest Fire) in Center-West/North.
  - "Deslizamento" in mountain/hillside areas.
  - "Vendaval" in coastal or South regions.
  Use realistic, varied population numbers for "affected".
  For dates, use realistic DD/MM/YYYY format from recent months.
`;

export const fetchSimulatedData = async (): Promise<DisasterDecree[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: MOCK_PROMPT,
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
      lat: STATE_COORDS[d.uf]?.[1] ?? -15.79,
      lng: STATE_COORDS[d.uf]?.[0] ?? -47.88,
    }));
  } catch (error) {
    console.error("Failed to fetch simulated data:", error);
    throw error;
  }
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

// ── Intelligence Briefing ──
export const generateInsight = async (data: DisasterDecree[]): Promise<string> => {
  try {
    const dataSummary = JSON.stringify(data.slice(0, 30));
    const prompt = `
      Analyze this JSON data of Brazilian disaster decrees.
      Provide a concise, 3-paragraph SITREP (Situation Report) in Portuguese (pt-BR).
      
      Structure:
      1. PANORAMA GERAL: Overview of the current disaster situation.
      2. ZONA QUENTE: Identify the most critical region/state with highest severity.
      3. ANOMALIAS: Flag unusual patterns (huge populations, uncommon disaster types, clustering events).
      
      Use professional military/civil defense intelligence terminology.
      Include bullet points for key quantitative metrics.
      Data: ${dataSummary}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "> FALHA AO ESTABELECER CONEXÃO COM MÓDULO DE INTELIGÊNCIA.";
  } catch (error) {
    console.error("Error generating insight:", error);
    return "> ERRO CRÍTICO: FALHA NA GERAÇÃO DE ANÁLISE TÁTICA.";
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
export const fetchEconomicImpact = async (event: DisasterDecree): Promise<{
  indicators: EconomicIndicator[];
  comex: ComexData[];
}> => {
  try {
    const prompt = `
      You are a financial analysis AI specialized in correlating natural disasters with economic impacts in Brazil.
      
      Disaster Event:
      Municipality: ${event.municipality}, UF: ${event.uf}
      Type: ${event.type}, Affected: ${event.affected} people
      
      Generate REALISTIC economic impact data:
      
      1. "indicators": Array of 4 financial indicators affected by this disaster:
         - Include IBOVESPA sector index (agriculture, logistics, infrastructure, insurance)
         - Each with: id, name, value (current), change (absolute R$), changePercent, direction ("up"/"down"/"stable"), timestamp
      
      2. "comex": Array of 3 COMEX STAT trade items affected:
         - Products that ${event.uf} exports/imports that could be disrupted by ${event.type}
         - Each with: id, product, ncm (realistic NCM code), uf, exportValue (US$), importValue (US$), period, variation (%)
      
      Make values REALISTIC for the Brazilian economy. Use proper number magnitudes.
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
          },
          required: ["indicators", "comex"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return { indicators: [], comex: [] };
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Economic data error:", error);
    return { indicators: [], comex: [] };
  }
};

// ── AI Chat (Tactical Oracle) ──
export const chatWithAI = async (message: string, context: DisasterDecree[]): Promise<string> => {
  try {
    const dataSummary = JSON.stringify(context.slice(0, 20));
    const prompt = `
      You are the "S2ID COMMAND ORACLE" — an advanced AI system for Brazilian disaster intelligence.
      
      CAPABILITIES:
      - Analyze disaster patterns, severity, and geographic clustering
      - Correlate disasters with economic impacts (agriculture, infrastructure, supply chains)
      - Provide risk assessments and predictions
      - Generate SITREP (Situation Reports) on demand
      
      CURRENT MISSION DATA: ${dataSummary}
      
      USER QUERY: "${message}"
      
      Guidelines:
      1. Respond in Portuguese (pt-BR)
      2. Use professional intelligence/military terminology
      3. Include quantitative data and metrics when relevant
      4. Format with clear sections and bullet points
      5. Keep responses focused and actionable
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