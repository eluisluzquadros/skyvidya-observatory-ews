import path from 'path';
import fs from 'fs';
import logger from './logger';
import { DisasterRecord, FilterOptions } from '../types';

// __dirname is not available in ESM — use process.cwd() which is always the project root
const DB_PATH = path.resolve(process.cwd(), 'server/data/duckdb/ews.duckdb');

// Lazy-loaded duckdb connection — only opens when ews.duckdb exists
// Uses dynamic import to support ESM ("type": "module") projects
let _db: any = null;
let _duckdbModule: any = null;

async function loadDuckDB() {
    if (_duckdbModule) return _duckdbModule;
    try {
        _duckdbModule = await import('duckdb');
        return _duckdbModule;
    } catch {
        return null;
    }
}

async function getConnection() {
    if (_db) return _db;
    if (!fs.existsSync(DB_PATH)) return null;
    try {
        const duckdb = await loadDuckDB();
        if (!duckdb) return null;
        const Ctor = duckdb.default?.Database ?? duckdb.Database;
        _db = new Ctor(DB_PATH);
        logger.info('[duckdb] Connected to ews.duckdb');
        return _db;
    } catch (err) {
        logger.warn('[duckdb] Could not open ews.duckdb:', err);
        return null;
    }
}

// Returns null when DuckDB is unavailable (triggers fallback to storage.ts in routes)
async function query<T>(sql: string, params: unknown[] = []): Promise<T[] | null> {
    const db = await getConnection();
    if (!db) return null;
    return new Promise((resolve, reject) => {
        db.all(sql, ...params, (err: Error | null, rows: T[]) => {
            if (err) reject(err);
            else resolve(rows ?? []);
        });
    });
}

// Returns true only when the dbt pipeline has been executed at least once
export function isDuckDBReady(): boolean {
    return fs.existsSync(DB_PATH);
}

// ─── Individual disaster records from Silver layer ─────────────────────────
// Maps Silver columns → DisasterRecord shape expected by the frontend
export async function getSilverDisasters(filters: FilterOptions = {}): Promise<DisasterRecord[] | null> {
    if (!isDuckDBReady()) return null;
    try {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filters.uf) {
            conditions.push('uf = ?');
            params.push(filters.uf);
        }
        if (filters.type) {
            conditions.push("lower(disaster_type) LIKE lower(concat('%', ?, '%'))");
            params.push(filters.type);
        }
        if (filters.municipality) {
            conditions.push("lower(municipality) LIKE lower(concat('%', ?, '%'))");
            params.push(filters.municipality);
        }
        if (filters.startDate) {
            conditions.push('event_date >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push('event_date <= ?');
            params.push(filters.endDate);
        }
        if (filters.source && filters.source !== 'all') {
            conditions.push('data_source = ?');
            params.push(filters.source);
        }

        const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit  = filters.limit  ?? 2000;
        const offset = filters.offset ?? 0;

        const rows = await query<any>(`
            SELECT
                decree_id               AS id,
                municipality,
                uf,
                disaster_type           AS type,
                event_date::VARCHAR     AS date,
                COALESCE(status, 'active') AS status,
                affected_count          AS affected,
                data_source             AS source,
                report_type             AS "reportType",
                COALESCE(collected_at, _ingested_at::VARCHAR) AS "collectedAt"
            FROM silver.stg_s2id_clean
            ${where}
            ORDER BY event_date DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        if (rows === null) return null;  // connection unavailable — trigger fallback
        return rows as DisasterRecord[];
    } catch (err) {
        logger.warn('[duckdb] Silver query failed:', err);
        return null;
    }
}

// ─── Aggregated stats from Gold layer ──────────────────────────────────────
export async function getGoldStats(filters: { startDate?: string; endDate?: string } = {}): Promise<{
    total: number;
    totalAffected: number;
    totalCritical: number;
    ufsCount: number;
    byUf: { uf: string; count: number }[];
    byType: { type: string; count: number }[];
    bySource: { source: string; count: number }[];
} | null> {
    if (!isDuckDBReady()) return null;
    try {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filters.startDate) { conditions.push('latest_event_date >= ?'); params.push(filters.startDate); }
        if (filters.endDate)   { conditions.push('latest_event_date <= ?'); params.push(filters.endDate); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [totals, byUf, byType] = await Promise.all([
            query<any>(`
                SELECT
                    SUM(total_events)   AS total,
                    SUM(total_affected) AS totalAffected,
                    SUM(total_events) FILTER (WHERE risk_category IN ('S4 ALTO','S5 CRÍTICO')) AS totalCritical,
                    COUNT(DISTINCT uf)  AS ufsCount
                FROM gold.mart_disasters ${where}
            `, params),

            query<any>(`
                SELECT uf, SUM(total_events) AS count
                FROM gold.mart_disasters ${where}
                GROUP BY uf ORDER BY count DESC
            `, params),

            query<any>(`
                SELECT primary_disaster_type AS type, SUM(total_events) AS count
                FROM gold.mart_disasters ${where}
                GROUP BY primary_disaster_type ORDER BY count DESC
            `, params),
        ]);

        const t = totals[0] ?? {};
        return {
            total:         Number(t.total ?? 0),
            totalAffected: Number(t.totalAffected ?? 0),
            totalCritical: Number(t.totalCritical ?? 0),
            ufsCount:      Number(t.ufsCount ?? 0),
            byUf:          byUf.map(r => ({ uf: r.uf, count: Number(r.count) })),
            byType:        byType.map(r => ({ type: r.type, count: Number(r.count) })),
            bySource:      [{ source: 's2id', count: Number(t.total ?? 0) }],
        };
    } catch (err) {
        logger.warn('[duckdb] Gold stats query failed:', err);
        return null;
    }
}

export function closeConnection() {
    if (_db) { _db.close(); _db = null; }
}
