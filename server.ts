import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env or .env.local
dotenv.config();

// Fix for __dirname in ESM if needed, but we'll use process.cwd() for root-relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We'll import existing modules from the server/src folder
// Note: tsx will handle the TypeScript files
import _configImport from './server/src/config';
import _loggerImport from './server/src/services/logger';
import _schedulerImport from './server/src/services/scheduler';

// Node 24 ESM interop: CJS default exports may be wrapped in {default:...}
const config    = (_configImport    as any).default ?? _configImport;
const logger    = (_loggerImport    as any).default ?? _loggerImport;
const scheduler = (_schedulerImport as any).default ?? _schedulerImport;
import _apiRoutesImport from './server/src/routes/api';
import _analyticsRoutesImport from './server/src/routes/analytics';
import _pipelineRoutesImport from './server/src/routes/pipeline';
import _storageImport from './server/src/services/storage';
import _analyticsDataImport from './server/src/services/analyticsData';

const apiRoutes       = (_apiRoutesImport       as any).default ?? _apiRoutesImport;
const analyticsRoutes = (_analyticsRoutesImport as any).default ?? _analyticsRoutesImport;
const pipelineRoutes  = (_pipelineRoutesImport  as any).default ?? _pipelineRoutesImport;
const storage         = (_storageImport         as any).default ?? _storageImport;
const analyticsData   = (_analyticsDataImport   as any).default ?? _analyticsDataImport;

const app = express();
const httpServer = createServer(app);

// Socket.IO for real-time updates
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// API Routes — handle ESM default interop (Node 24 may wrap in {default:...})
const _api      = (apiRoutes      as any).default ?? apiRoutes;
const _analytics = (analyticsRoutes as any).default ?? analyticsRoutes;
const _pipeline  = (pipelineRoutes  as any).default ?? pipelineRoutes;
app.use('/api', _api);
app.use('/api/analytics', _analytics);
app.use('/api/pipeline', _pipeline);

// Root endpoint for status
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        service: 'S2ID Unified Backend',
        timestamp: new Date().toISOString(),
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Send current status on connection
    socket.emit('status', {
        collections: storage.getCollectionStatus(),
        scheduler: scheduler.getStatus(),
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });

    // Listen for refresh requests via WebSocket
    socket.on('refresh', async (data) => {
        logger.info(`Refresh requested via WebSocket: ${JSON.stringify(data)}`);
        socket.emit('refresh-started', { source: data?.source || 'all' });

        try {
            if (data?.source === 'atlas') {
                const count = await scheduler.triggerAtlasCollection();
                socket.emit('refresh-completed', { source: 'atlas', count });
            } else if (data?.source === 's2id') {
                const count = await scheduler.triggerS2IDCollection(data?.reportIds);
                socket.emit('refresh-completed', { source: 's2id', count });
            } else {
                const result = await scheduler.triggerAllCollections();
                socket.emit('refresh-completed', { source: 'all', ...result });
            }

            // Broadcast update to all clients
            io.emit('data-updated', {
                collections: storage.getCollectionStatus(),
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('refresh-error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
});

// Register io globally so pipeline routes can emit without circular imports
(globalThis as any).__ewsIO = io;

// Export io for availability anywhere
export { io };

// Start server on port 3001 (Vite proxies /api to this port)
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    logger.info(`🚀 Consolidated Backend running on http://localhost:${PORT}`);
    logger.info(`📡 WebSocket server ready`);

    // Start scheduler
    scheduler.start();
});

// Graceful shutdown
const shutdown = () => {
    logger.info('Shutting down gracefully...');
    scheduler.stop();
    storage.close?.();
    analyticsData.close?.();
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
