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
    'Crescente': '#ef4444',   // red
    'Estável': '#eab308',     // yellow
    'Decrescente': '#22c55e', // green
};

export const LISA_CLUSTER_COLORS: Record<string, string> = {
    'HH (Alto-Alto)': '#ef4444',    // red - hot spot
    'HL (Alto-Baixo)': '#93c5fd',   // light blue
    'LH (Baixo-Alto)': '#f97316',   // orange
    'LL (Baixo-Baixo)': '#3b82f6',  // blue - cold spot
    'N/A': '#4b5563',               // gray
};

// === Report Assets ===

export interface ReportAsset {
    filename: string;
    type: 'png' | 'csv';
    size: number;
    updatedAt: string;
    url: string;
}
