/**
 * S2ID Analytics Data Service
 *
 * Loads and caches pre-computed analytics JSON files produced by the
 * Python analytics pipeline. Follows the same pattern as storage.ts.
 */

import fs from 'fs';
import path from 'path';
import logger from './logger';
import config from '../config';

// Types for analytics data
export interface MunicipalityRisk {
    cd_mun: string;
    name: string;
    uf: string;
    population: number;
    area_km2: number;
    riskScore: number;
    riskCategory: string;
    trend: string;
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

export interface LISAClusterData {
    variables: Record<string, {
        municipalities: Array<{
            cd_mun: string;
            name: string;
            uf: string;
            clusterType: string;
            moranI: number;
            pValue: number;
        }>;
        summary: Record<string, number>;
        totalSignificant: number;
    }>;
    globalMoranI: Array<{
        variable: string;
        moran_I: number;
        p_value: number;
        z_score: number;
        significant: boolean;
    }>;
    totalVariables: number;
}

export interface DistributionData {
    riskCategories?: Array<{ category: string; count: number }>;
    trends?: Array<{ trend: string; count: number }>;
    threats?: Array<{ threat: string; count: number }>;
}

export interface AnalyticsMetadata {
    lastUpdated: string;
    version: string;
    totalMunicipalities: number;
    totalColumns: number;
    ufsAnalyzed: string[];
    pipelineDurationSeconds: number;
    dataRange: { periods: string[] };
    riskCategories: string[];
    cobradeTypes: Record<string, string>;
}

export interface RiskFilters {
    uf?: string;
    category?: string;
    trend?: string;
    threat?: string;
    limit?: number;
    offset?: number;
}

export interface LISAFilters {
    variable?: string;
    cluster?: string;
}

class AnalyticsDataService {
    private riskData: MunicipalityRisk[] = [];
    private lisaData: LISAClusterData | null = null;
    private geojsonData: any = null;
    private distributionData: DistributionData | null = null;
    private metadata: AnalyticsMetadata | null = null;
    private loaded = false;
    private watchers: fs.FSWatcher[] = [];

    constructor() {
        this.loadAll();
        this.watchFiles();
    }

    private getFilePath(filename: string): string {
        return path.join(config.analyticsDataDir, filename);
    }

    private readJsonFile<T>(filename: string): T | null {
        const filePath = this.getFilePath(filename);
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) as T;
        } catch (error) {
            logger.warn(`Failed to read analytics file ${filename}: ${error}`);
            return null;
        }
    }

    private loadAll(): void {
        logger.info('Loading analytics data...');

        this.riskData = this.readJsonFile<MunicipalityRisk[]>('risk_analysis.json') || [];
        this.lisaData = this.readJsonFile<LISAClusterData>('lisa_clusters.json');
        this.geojsonData = this.readJsonFile<any>('municipality_geometries.geojson');
        this.distributionData = this.readJsonFile<DistributionData>('distributions.json');
        this.metadata = this.readJsonFile<AnalyticsMetadata>('analytics_metadata.json');

        this.loaded = this.riskData.length > 0;

        if (this.loaded) {
            logger.info(
                `Analytics data loaded: ${this.riskData.length} municipalities, ` +
                `LISA: ${this.lisaData ? 'yes' : 'no'}, ` +
                `GeoJSON: ${this.geojsonData ? 'yes' : 'no'}`
            );
        } else {
            logger.info('No analytics data available yet. Run the Python pipeline first.');
        }
    }

    private watchFiles(): void {
        const dir = config.analyticsDataDir;
        if (!fs.existsSync(dir)) {
            // Create directory and start watching
            fs.mkdirSync(dir, { recursive: true });
        }

        try {
            const watcher = fs.watch(dir, (eventType, filename) => {
                if (filename && filename.endsWith('.json') || filename?.endsWith('.geojson')) {
                    logger.info(`Analytics file changed: ${filename}, reloading...`);
                    // Debounce reload
                    setTimeout(() => this.loadAll(), 500);
                }
            });
            this.watchers.push(watcher);
        } catch (error) {
            logger.warn(`Failed to watch analytics directory: ${error}`);
        }
    }

    isAvailable(): boolean {
        return this.loaded;
    }

    getRiskData(filters: RiskFilters = {}): MunicipalityRisk[] {
        let data = [...this.riskData];

        if (filters.uf) {
            data = data.filter(d => d.uf === filters.uf.toUpperCase());
        }
        if (filters.category) {
            data = data.filter(d => d.riskCategory === filters.category);
        }
        if (filters.trend) {
            data = data.filter(d => d.trend === filters.trend);
        }
        if (filters.threat) {
            data = data.filter(d => d.principalThreat === filters.threat);
        }

        // Sort by risk score descending
        data.sort((a, b) => b.riskScore - a.riskScore);

        const offset = filters.offset || 0;
        const limit = filters.limit || data.length;
        return data.slice(offset, offset + limit);
    }

    getMunicipalityRisk(cdMun: string): MunicipalityRisk | undefined {
        return this.riskData.find(d => d.cd_mun === cdMun);
    }

    getLISAData(filters: LISAFilters = {}): LISAClusterData | null {
        if (!this.lisaData) return null;

        if (!filters.variable && !filters.cluster) {
            return this.lisaData;
        }

        // Filter to specific variable
        if (filters.variable) {
            const varData = this.lisaData.variables[filters.variable];
            if (!varData) return null;

            let municipalities = varData.municipalities;
            if (filters.cluster) {
                municipalities = municipalities.filter(
                    m => m.clusterType.includes(filters.cluster!)
                );
            }

            return {
                ...this.lisaData,
                variables: {
                    [filters.variable]: {
                        ...varData,
                        municipalities,
                    },
                },
            };
        }

        return this.lisaData;
    }

    getLISASummary(): Record<string, { summary: Record<string, number>; totalSignificant: number }> | null {
        if (!this.lisaData) return null;

        const result: Record<string, { summary: Record<string, number>; totalSignificant: number }> = {};
        for (const [variable, data] of Object.entries(this.lisaData.variables)) {
            result[variable] = {
                summary: data.summary,
                totalSignificant: data.totalSignificant,
            };
        }
        return result;
    }

    getRankings(uf?: string, limit: number = 10): MunicipalityRisk[] {
        return this.getRiskData({ uf, limit });
    }

    getDistributions(): DistributionData | null {
        return this.distributionData;
    }

    getGeoJSON(): any {
        return this.geojsonData;
    }

    getMetadata(): AnalyticsMetadata | null {
        return this.metadata;
    }

    close(): void {
        this.watchers.forEach(w => w.close());
        this.watchers = [];
    }
}

// Singleton instance
const analyticsData = new AnalyticsDataService();
export default analyticsData;
