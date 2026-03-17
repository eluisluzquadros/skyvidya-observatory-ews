/**
 * S2ID Analytics Service - Frontend API Client
 *
 * Communicates with the Express.js /api/analytics/* endpoints
 * to fetch pre-computed analytics data for the React frontend.
 */

import type {
    MunicipalityRisk,
    LISAClusterData,
    AnalyticsDistributions,
    GeoJSONCollection,
    GeoRAGResponse,
    PipelineStatus,
} from '../analyticsTypes';

const API_BASE = 'http://localhost:3001/api/analytics';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}

// === Risk Data ===

export async function fetchRiskData(filters?: {
    uf?: string;
    category?: string;
    trend?: string;
    threat?: string;
    limit?: number;
    offset?: number;
}): Promise<MunicipalityRisk[]> {
    const params = new URLSearchParams();
    if (filters?.uf) params.set('uf', filters.uf);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.trend) params.set('trend', filters.trend);
    if (filters?.threat) params.set('threat', filters.threat);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const queryString = params.toString();
    const url = `${API_BASE}/risk${queryString ? '?' + queryString : ''}`;
    const result = await fetchJson<{ success: boolean; data: MunicipalityRisk[] }>(url);
    return result.data;
}

export async function fetchMunicipalityRisk(cdMun: string): Promise<MunicipalityRisk> {
    const result = await fetchJson<{ success: boolean; data: MunicipalityRisk }>(
        `${API_BASE}/risk/${cdMun}`
    );
    return result.data;
}

// === LISA Data ===

export async function fetchLISAClusters(
    variable?: string,
    cluster?: string,
): Promise<LISAClusterData> {
    const params = new URLSearchParams();
    if (variable) params.set('variable', variable);
    if (cluster) params.set('cluster', cluster);

    const queryString = params.toString();
    const url = `${API_BASE}/lisa${queryString ? '?' + queryString : ''}`;
    const result = await fetchJson<{ success: boolean; data: LISAClusterData }>(url);
    return result.data;
}

export async function fetchLISASummary(): Promise<Record<string, { summary: Record<string, number>; totalSignificant: number }>> {
    const result = await fetchJson<{ success: boolean; data: any }>(`${API_BASE}/lisa/summary`);
    return result.data;
}

// === Rankings ===

export async function fetchRankings(
    uf?: string,
    limit: number = 10,
): Promise<MunicipalityRisk[]> {
    const params = new URLSearchParams();
    if (uf) params.set('uf', uf);
    params.set('limit', String(limit));

    const result = await fetchJson<{ success: boolean; data: MunicipalityRisk[] }>(
        `${API_BASE}/rankings?${params.toString()}`
    );
    return result.data;
}

// === Distributions ===

export async function fetchDistributions(): Promise<AnalyticsDistributions> {
    const result = await fetchJson<{ success: boolean; data: AnalyticsDistributions }>(
        `${API_BASE}/distributions`
    );
    return result.data;
}

// === GeoJSON ===

let cachedGeoJSON: GeoJSONCollection | null = null;

export async function fetchMunicipalityGeoJSON(): Promise<GeoJSONCollection> {
    if (cachedGeoJSON) return cachedGeoJSON;

    const result = await fetchJson<GeoJSONCollection>(`${API_BASE}/geojson`);
    cachedGeoJSON = result;
    return result;
}

export function clearGeoJSONCache(): void {
    cachedGeoJSON = null;
}

// === GeoRAG ===

export async function queryGeoRAG(query: string): Promise<GeoRAGResponse> {
    const result = await fetchJson<GeoRAGResponse>(`${API_BASE}/georag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    return result;
}

// === Pipeline ===

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
    const result = await fetchJson<{ success: boolean; data: PipelineStatus }>(
        `${API_BASE}/pipeline/status`
    );
    return result.data;
}

export async function triggerAnalyticsPipeline(
    ufs?: string[],
): Promise<void> {
    await fetchJson(`${API_BASE}/pipeline/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ufs }),
    });
}
