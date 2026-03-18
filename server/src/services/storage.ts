import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from './logger';
import { DisasterRecord, CollectionStatus, FilterOptions } from '../types';

// Database structure
interface Database {
    disasters: DisasterRecord[];
    collectionStatus: CollectionStatus[];
    metadata: {
        lastUpdated: string;
        version: string;
    };
}

// Default empty database
const defaultDb: Database = {
    disasters: [],
    collectionStatus: [],
    metadata: {
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
    },
};

class StorageService {
    private dbPath: string;
    private db: Database;

    constructor() {
        // Ensure data directory exists
        const dataDir = path.dirname(config.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.dbPath = config.dbPath.replace('.sqlite', '.json');
        this.db = this.loadDatabase();
        logger.info('JSON storage initialized');
    }

    private loadDatabase(): Database {
        try {
            if (fs.existsSync(this.dbPath)) {
                const content = fs.readFileSync(this.dbPath, 'utf-8');
                return JSON.parse(content) as Database;
            }
        } catch (error) {
            logger.error('Error loading database, creating new one:', error);
        }
        return { ...defaultDb };
    }

    private saveDatabase(): void {
        try {
            this.db.metadata.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2), 'utf-8');
        } catch (error) {
            logger.error('Error saving database:', error);
            throw error;
        }
    }

    // Insert or update disaster records
    insertDisasters(records: DisasterRecord[]): number {
        const existingIds = new Set(this.db.disasters.map(d => d.id));
        let insertedCount = 0;
        let updatedCount = 0;

        for (const record of records) {
            if (existingIds.has(record.id)) {
                // Update existing
                const index = this.db.disasters.findIndex(d => d.id === record.id);
                if (index !== -1) {
                    this.db.disasters[index] = record;
                    updatedCount++;
                }
            } else {
                // Insert new
                this.db.disasters.push(record);
                existingIds.add(record.id);
                insertedCount++;
            }
        }

        this.saveDatabase();
        logger.info(`Storage: Inserted ${insertedCount}, Updated ${updatedCount} records`);
        return insertedCount + updatedCount;
    }

    // Get disasters with filters
    getDisasters(filters: FilterOptions = {}): DisasterRecord[] {
        let results = [...this.db.disasters];

        // Apply filters
        if (filters.uf) {
            results = results.filter(d => d.uf === filters.uf);
        }

        if (filters.type) {
            results = results.filter(d =>
                d.type.toLowerCase().includes(filters.type!.toLowerCase())
            );
        }

        if (filters.startDate) {
            results = results.filter(d => d.date >= filters.startDate!);
        }

        if (filters.endDate) {
            results = results.filter(d => d.date <= filters.endDate!);
        }

        if (filters.source && filters.source !== 'all') {
            results = results.filter(d => d.source === filters.source);
        }

        // Sort by date descending
        results.sort((a, b) => b.date.localeCompare(a.date));

        // Apply pagination
        if (filters.offset) {
            results = results.slice(filters.offset);
        }

        if (filters.limit) {
            results = results.slice(0, filters.limit);
        }

        return results;
    }

    // Get statistics
    getStats(filters: { startDate?: string; endDate?: string } = {}): {
        total: number;
        totalAffected: number;
        totalCritical: number;
        ufsCount: number;
        bySource: { source: string; count: number }[];
        byUf: { uf: string; count: number }[];
        byType: { type: string; count: number }[];
    } {
        let disasters = this.db.disasters;

        if (filters.startDate) disasters = disasters.filter(d => d.date >= filters.startDate!);
        if (filters.endDate)   disasters = disasters.filter(d => d.date <= filters.endDate!);

        const sourceCount: Record<string, number> = {};
        const ufCount: Record<string, number> = {};
        const typeCount: Record<string, number> = {};
        let totalAffected = 0;
        let totalCritical = 0;
        const ufsSet = new Set<string>();

        for (const d of disasters) {
            sourceCount[d.source] = (sourceCount[d.source] || 0) + 1;
            ufCount[d.uf] = (ufCount[d.uf] || 0) + 1;
            typeCount[d.type] = (typeCount[d.type] || 0) + 1;
            totalAffected += d.affected || 0;
            ufsSet.add(d.uf);
            // severity >= 4: affected > 20000 or high-risk type + affected > 10000
            const highRisk = ['Inunda', 'Enxurrada', 'Deslizamento'].some(t => d.type.includes(t));
            if (d.affected > 20000 || (highRisk && d.affected > 10000)) totalCritical++;
        }

        return {
            total: disasters.length,
            totalAffected,
            totalCritical,
            ufsCount: ufsSet.size,
            bySource: Object.entries(sourceCount).map(([source, count]) => ({ source, count })),
            byUf: Object.entries(ufCount)
                .map(([uf, count]) => ({ uf, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            byType: Object.entries(typeCount)
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
        };
    }

    // Collection status methods
    updateCollectionStatus(status: CollectionStatus): void {
        const id = `${status.source}-${status.reportType || 'main'}`;
        const existingIndex = this.db.collectionStatus.findIndex(
            s => s.source === status.source && (s.reportType || 'main') === (status.reportType || 'main')
        );

        if (existingIndex >= 0) {
            this.db.collectionStatus[existingIndex] = status;
        } else {
            this.db.collectionStatus.push(status);
        }

        this.saveDatabase();
    }

    getCollectionStatus(): CollectionStatus[] {
        return [...this.db.collectionStatus];
    }

    // Clear old data (optional cleanup)
    clearOldData(daysToKeep: number = 30): number {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const dateStr = cutoffDate.toISOString().split('T')[0];

        const beforeCount = this.db.disasters.length;
        this.db.disasters = this.db.disasters.filter(
            d => d.source !== 's2id' || d.collectedAt >= dateStr
        );
        const removed = beforeCount - this.db.disasters.length;

        if (removed > 0) {
            this.saveDatabase();
            logger.info(`Cleared ${removed} old S2ID records`);
        }

        return removed;
    }

    // Get database info
    getDbInfo(): { path: string; size: number; recordCount: number; lastUpdated: string } {
        const stats = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath) : { size: 0 };
        return {
            path: this.dbPath,
            size: stats.size,
            recordCount: this.db.disasters.length,
            lastUpdated: this.db.metadata.lastUpdated,
        };
    }

    close(): void {
        // No-op for JSON storage, just save to be safe
        this.saveDatabase();
        logger.info('Storage closed');
    }
}

export const storage = new StorageService();
export default storage;
