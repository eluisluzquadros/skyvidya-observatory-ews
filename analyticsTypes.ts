/**
 * S2ID Analytics - Frontend TypeScript Types
 *
 * Types for the analytics layer (risk scoring, LISA clusters, GeoRAG).
 * Separate from the existing types.ts to keep concerns isolated.
 */

// === Risk Analysis Types ===

export type RiskCategory = 'Muito Baixo' | 'Baixo' | 'Médio' | 'Alto' | 'Muito Alto';
export type TrendDirection = 'Crescente' | 'Estável' | 'Decrescente';

export interface MunicipalityRisk {
    cd_mun: string;
    name: string;
    uf: string;
    population: number;
    area_km2: number;
    riskScore: number;
    riskCategory: RiskCategory;
    trend: TrendDirection;
    principalThreat: string;
    historicCount: number;
    last10yrCount: number;
    last5yrCount: number;
    last2yrCount: number;
    ratesPer10k: {
        historic: number;
        last10yr: number;
        last5yr: number;
        last2yr: number;
    };
    lat: number | null;
    lng: number | null;
    cobradeBreakdown?: Record<string, { name: string; count: number }>;
    socioeconomico?: {
        pibPerCapita?: number;
        pibTotal?: number;
        idhm?: number;
        densidadeDemografica?: number;
        taxaMortalidadeInfantil?: number;
        receitasBrutas?: number;
        despesasBrutas?: number;
    };
    danos?: {
        // PEPR — Perdas Econômicas Setor Privado (R$)
        peprAgricultura?: number;
        peprPecuaria?: number;
        peprIndustria?: number;
        peprComercio?: number;
        peprServicos?: number;
        // PEPL — Perdas em Serviços Públicos Essenciais (R$)
        peplSaude?: number;
        peplEnsino?: number;
        peplTransportes?: number;
        peplEnergia?: number;
        // DH — Danos Humanos
        dhMortos?: number;
        dhDesabrigados?: number;
        dhDesalojados?: number;
        dhOutrosAfetados?: number;
    };
}

// === LISA Cluster Types ===

export type LISAClusterType = 'HH (Alto-Alto)' | 'LH (Baixo-Alto)' | 'LL (Baixo-Baixo)' | 'HL (Alto-Baixo)' | 'N/A';

export interface LISAMunicipality {
    cd_mun: string;
    name: string;
    uf: string;
    clusterType: string;
    moranI: number;
    pValue: number;
}

export interface LISAVariableData {
    municipalities: LISAMunicipality[];
    summary: Record<string, number>;
    totalSignificant: number;
}

export interface LISAClusterData {
    variables: Record<string, LISAVariableData>;
    globalMoranI: Array<{
        variable: string;
        moran_I: number;
        p_value: number;
        z_score: number;
        significant: boolean;
    }>;
    totalVariables: number;
}

// === Distribution Types ===

export interface AnalyticsDistributions {
    riskCategories?: Array<{ category: string; count: number }>;
    trends?: Array<{ trend: string; count: number }>;
    threats?: Array<{ threat: string; count: number }>;
}

// === GeoRAG Types ===

export interface GeoRAGResponse {
    success: boolean;
    data: {
        textResponse: string;
        municipalities: MunicipalityRisk[];
        queryType: string;
        totalResults: number;
    };
}

// === Analytics Metadata ===

export interface AnalyticsMetadata {
    lastUpdated: string;
    version: string;
    totalMunicipalities: number;
    ufsAnalyzed: string[];
    pipelineDurationSeconds: number;
    riskCategories: string[];
    cobradeTypes: Record<string, string>;
}

export interface PipelineStatus {
    metadata: AnalyticsMetadata | null;
    available: boolean;
    pythonService: {
        pipeline: {
            status: string;
            last_run: string | null;
            last_duration: number | null;
            progress: string;
        };
    } | null;
}

// === GeoJSON Types ===

export interface GeoJSONFeature {
    type: 'Feature';
    properties: {
        CD_MUN: string;
        NM_MUN_SEM_ACENTO: string;
        SIGLA_UF: string;
        CENSO_2020_POP: number;
        AREA_KM2: number;
        Risco_Ampliado_MCDA_Score?: number;
        Risco_Ampliado_MCDA_Cat?: string;
        Tendencia_Eventos_Climaticos_Extremos?: string;
        principal_ameaca?: string;
    };
    geometry: {
        type: string;
        coordinates: any;
    };
}

export interface GeoJSONCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

// === Choropleth Map Types ===

export type ChoroplethColorBy = 'riskCategory' | 'trend' | 'principalThreat' | 'lisaCluster';

// === Color Maps ===

export const RISK_CATEGORY_COLORS: Record<string, string> = {
    'Muito Baixo': '#3b82f6', // blue
    'Baixo': '#22c55e',       // green
    'Médio': '#eab308',       // yellow
    'Alto': '#f97316',        // orange
    'Muito Alto': '#ef4444',  // red
};

export const TREND_COLORS: Record<string, string> = {
    'Crescente': '#ef4444',     // red
    'Estável': '#eab308',        // yellow
    'Decrescente': '#22c55e',   // green
};

export const LISA_CLUSTER_COLORS: Record<string, string> = {
    'HH': '#ef4444', // red (hotspot)
    'LL': '#3b82f6', // blue (coldspot)
    'LH': '#f97316', // orange (low outlier in hot area)
    'HL': '#06b6d4', // cyan (high outlier in cold area)
    'N/A': '#1e293b',// dark gray (not significant)
};

export const THREAT_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
    '#84cc16', '#a855f7', '#d946ef',
];

// === LLM Reports ===

export interface LLMReportKPIs {
    scope: string;
    scope_type: 'municipality' | 'state' | 'national';
    total_municipalities: number;
    total_population: number;
    risk_distribution: Record<string, number>;
    high_risk_count: number;
    high_risk_pct: number;
    trend_distribution: Record<string, number>;
    dominant_trend: string;
    crescente_pct: number;
    top_threats: { name: string; count: number }[];
    principal_threat: string;
    historic_events: number;
    last10yr_events: number;
    last5yr_events: number;
    last2yr_events: number;
    top_high_risk_municipalities: { name: string; uf: string; riskCategory: string; riskScore: number }[];
}

export interface LLMReport {
    scope: string;
    scopeType: 'municipality' | 'state' | 'national';
    generatedAt: string;
    kpis: LLMReportKPIs;
    summary: string;
    riskNarrative: string;
    recommendations: string[];
    impactProjection: string;
}

// === Report Assets ===

export interface ReportAsset {
    filename: string;
    type: 'png' | 'csv';
    size: number;
    updatedAt: string;
    url: string;
}
