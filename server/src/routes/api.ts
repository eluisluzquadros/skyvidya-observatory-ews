import { Router, Request, Response } from 'express';
import storage from '../services/storage';
import scheduler from '../services/scheduler';
import logger from '../services/logger';
import { FilterOptions } from '../types';
import { getSilverDisasters, getGoldStats, isDuckDBReady } from '../services/duckdbService';

const router = Router();

// GET /api/disasters - List all disasters with optional filters
// Strategy: DuckDB Silver layer (post-pipeline) → fallback to storage.ts (database.json)
router.get('/disasters', async (req: Request, res: Response) => {
    try {
        const filters: FilterOptions = {
            uf:           req.query.uf as string,
            type:         req.query.type as string,
            municipality: req.query.municipality as string,
            startDate:    req.query.startDate as string,
            endDate:      req.query.endDate as string,
            source:       req.query.source as 'atlas' | 's2id' | 'all',
            limit:        req.query.limit  ? parseInt(req.query.limit  as string, 10) : 2000,
            offset:       req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
        };

        let disasters = isDuckDBReady() ? await getSilverDisasters(filters) : null;
        const dataSource = disasters !== null ? 'duckdb_silver' : 'storage_json';

        if (disasters === null) {
            disasters = storage.getDisasters(filters);
        }

        res.json({
            success: true,
            count: disasters.length,
            data: disasters,
            _meta: { source: dataSource },
        });
    } catch (error) {
        logger.error('Error fetching disasters:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch disasters' });
    }
});

// GET /api/stats - Get aggregated statistics
// Strategy: DuckDB Gold layer (post-pipeline) → fallback to storage.ts
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const dateFilters = {
            startDate: req.query.startDate as string | undefined,
            endDate:   req.query.endDate   as string | undefined,
        };

        let stats = isDuckDBReady() ? await getGoldStats(dateFilters) : null;
        const dataSource = stats !== null ? 'duckdb_gold' : 'storage_json';

        if (stats === null) {
            stats = storage.getStats(dateFilters);
        }

        res.json({
            success: true,
            data: stats,
            _meta: { source: dataSource },
        });
    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// GET /api/status - Get collection status
router.get('/status', (req: Request, res: Response) => {
    try {
        const collectionStatus = storage.getCollectionStatus();
        const schedulerStatus = scheduler.getStatus();

        res.json({
            success: true,
            data: {
                collections: collectionStatus,
                scheduler: schedulerStatus,
                serverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Error fetching status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch status',
        });
    }
});

// POST /api/refresh - Trigger manual data collection
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { source, reportIds } = req.body;

        let result: { atlas?: number; s2id?: number } = {};

        if (source === 'atlas') {
            result.atlas = await scheduler.triggerAtlasCollection();
        } else if (source === 's2id') {
            result.s2id = await scheduler.triggerS2IDCollection(reportIds);
        } else {
            // Collect all
            const allResult = await scheduler.triggerAllCollections();
            result = allResult;
        }

        res.json({
            success: true,
            message: 'Collection triggered successfully',
            data: result,
        });
    } catch (error) {
        logger.error('Error triggering refresh:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to trigger collection',
        });
    }
});

// GET /api/health - Health check endpoint
router.get('/health', (req: Request, res: Response) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

// GET /api/disasters/:id - Get single disaster by ID
router.get('/disasters/:id', (req: Request, res: Response) => {
    try {
        const disasters = storage.getDisasters({});
        const disaster = disasters.find(d => d.id === req.params.id);

        if (!disaster) {
            return res.status(404).json({
                success: false,
                error: 'Disaster not found',
            });
        }

        res.json({
            success: true,
            data: disaster,
        });
    } catch (error) {
        logger.error('Error fetching disaster:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch disaster',
        });
    }
});

// GET /api/ufs - Get list of UFs with counts
router.get('/ufs', (req: Request, res: Response) => {
    try {
        const stats = storage.getStats();

        res.json({
            success: true,
            data: stats.byUf,
        });
    } catch (error) {
        logger.error('Error fetching UFs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch UFs',
        });
    }
});

// GET /api/types - Get list of disaster types with counts
router.get('/types', (req: Request, res: Response) => {
    try {
        const stats = storage.getStats();

        res.json({
            success: true,
            data: stats.byType,
        });
    } catch (error) {
        logger.error('Error fetching types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch types',
        });
    }
});

export default router;
