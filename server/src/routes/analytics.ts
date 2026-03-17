/**
 * S2ID Analytics API Routes
 *
 * Serves pre-computed analytics data from the Python pipeline.
 * Also proxies GeoRAG queries and pipeline trigger requests to the Python microservice.
 */

import { Router, Request, Response } from 'express';
import { existsSync, readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import analyticsData from '../services/analyticsData';
import logger from '../services/logger';
import config from '../config';

const router = Router();

// GET /api/analytics/risk - Municipality risk data with filters
router.get('/risk', (req: Request, res: Response) => {
    try {
        if (!analyticsData.isAvailable()) {
            return res.status(404).json({
                success: false,
                error: 'Analytics data not available. Run the Python pipeline first.',
            });
        }

        const data = analyticsData.getRiskData({
            uf: req.query.uf as string,
            category: req.query.category as string,
            trend: req.query.trend as string,
            threat: req.query.threat as string,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
        });

        res.json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        logger.error('Error fetching risk data:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch risk data' });
    }
});

// GET /api/analytics/risk/:cd_mun - Single municipality risk profile
router.get('/risk/:cd_mun', (req: Request, res: Response) => {
    try {
        const municipality = analyticsData.getMunicipalityRisk(req.params.cd_mun);
        if (!municipality) {
            return res.status(404).json({
                success: false,
                error: `Municipality ${req.params.cd_mun} not found`,
            });
        }

        res.json({ success: true, data: municipality });
    } catch (error) {
        logger.error('Error fetching municipality risk:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch municipality risk' });
    }
});

// GET /api/analytics/lisa - LISA cluster data
router.get('/lisa', (req: Request, res: Response) => {
    try {
        const data = analyticsData.getLISAData({
            variable: req.query.variable as string,
            cluster: req.query.cluster as string,
        });

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'LISA data not available',
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        logger.error('Error fetching LISA data:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch LISA data' });
    }
});

// GET /api/analytics/lisa/summary - LISA summary statistics
router.get('/lisa/summary', (req: Request, res: Response) => {
    try {
        const summary = analyticsData.getLISASummary();
        if (!summary) {
            return res.status(404).json({
                success: false,
                error: 'LISA summary not available',
            });
        }

        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Error fetching LISA summary:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch LISA summary' });
    }
});

// GET /api/analytics/rankings - Top-N municipalities by risk
router.get('/rankings', (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
        const uf = req.query.uf as string;

        const data = analyticsData.getRankings(uf, limit);
        res.json({ success: true, count: data.length, data });
    } catch (error) {
        logger.error('Error fetching rankings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch rankings' });
    }
});

// GET /api/analytics/distributions - Risk, trend, threat distributions
router.get('/distributions', (req: Request, res: Response) => {
    try {
        const data = analyticsData.getDistributions();
        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Distribution data not available',
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        logger.error('Error fetching distributions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch distributions' });
    }
});

// GET /api/analytics/geojson - Municipality boundary GeoJSON
router.get('/geojson', (req: Request, res: Response) => {
    try {
        const data = analyticsData.getGeoJSON();
        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'GeoJSON data not available',
            });
        }

        // Set caching headers for large GeoJSON + ETag
        const etag = `"geojson-${data.features?.length || 0}"`;
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('ETag', etag);

        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.json(data);
    } catch (error) {
        logger.error('Error fetching GeoJSON:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch GeoJSON' });
    }
});

// GET /api/analytics/pipeline/status - Pipeline metadata
router.get('/pipeline/status', async (req: Request, res: Response) => {
    try {
        const metadata = analyticsData.getMetadata();

        // Also try to get live status from Python service
        let pythonStatus = null;
        try {
            const response = await fetch(`${config.pythonServiceUrl}/pipeline/status`);
            if (response.ok) {
                pythonStatus = await response.json();
            }
        } catch {
            // Python service may not be running
        }

        res.json({
            success: true,
            data: {
                metadata,
                available: analyticsData.isAvailable(),
                pythonService: pythonStatus,
            },
        });
    } catch (error) {
        logger.error('Error fetching pipeline status:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch pipeline status' });
    }
});

// POST /api/analytics/pipeline/trigger - Trigger Python pipeline
router.post('/pipeline/trigger', async (req: Request, res: Response) => {
    try {
        const { ufs, lisa_variables } = req.body;

        const response = await fetch(`${config.pythonServiceUrl}/pipeline/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ufs, lisa_variables }),
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json({
                success: false,
                error: error.detail || 'Failed to trigger pipeline',
            });
        }

        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Error triggering pipeline:', error);
        res.status(503).json({
            success: false,
            error: 'Python analytics service unavailable. Is it running on port 8000?',
        });
    }
});

// GET /api/analytics/report-assets - List available report assets
router.get('/report-assets', (req: Request, res: Response) => {
    try {
        const assetsDir = join(config.analyticsDataDir, 'report_assets');
        if (!existsSync(assetsDir)) {
            return res.json({ success: true, data: [] });
        }

        const files = readdirSync(assetsDir)
            .filter(f => ['.png', '.csv'].includes(extname(f).toLowerCase()))
            .map(filename => {
                const stat = statSync(join(assetsDir, filename));
                return {
                    filename,
                    type: extname(filename).toLowerCase().replace('.', '') as 'png' | 'csv',
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString(),
                    url: `/api/analytics/report-assets/${filename}`,
                };
            })
            .sort((a, b) => a.filename.localeCompare(b.filename));

        res.json({ success: true, count: files.length, data: files });
    } catch (error) {
        logger.error('Error listing report assets:', error);
        res.status(500).json({ success: false, error: 'Failed to list report assets' });
    }
});

// GET /api/analytics/report-assets/:file - Serve individual asset (PNG or CSV)
router.get('/report-assets/:file', (req: Request, res: Response) => {
    try {
        const { file } = req.params;
        // Prevent path traversal
        if (file.includes('..') || file.includes('/') || file.includes('\\')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }

        const ext = extname(file).toLowerCase();
        if (!['.png', '.csv'].includes(ext)) {
            return res.status(400).json({ success: false, error: 'Unsupported file type' });
        }

        const filePath = join(config.analyticsDataDir, 'report_assets', file);
        if (!existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }

        const contentType = ext === '.png' ? 'image/png' : 'text/csv; charset=utf-8';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        if (ext === '.csv') {
            res.set('Content-Disposition', `attachment; filename="${file}"`);
        }
        res.sendFile(filePath);
    } catch (error) {
        logger.error('Error serving report asset:', error);
        res.status(500).json({ success: false, error: 'Failed to serve asset' });
    }
});

// POST /api/analytics/georag/query - Proxy GeoRAG query to Python
router.post('/georag/query', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required',
            });
        }

        const response = await fetch(`${config.pythonServiceUrl}/georag/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json({
                success: false,
                error: error.detail || 'GeoRAG query failed',
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        logger.error('Error in GeoRAG query:', error);
        res.status(503).json({
            success: false,
            error: 'Python analytics service unavailable for GeoRAG queries.',
        });
    }
});

export default router;
