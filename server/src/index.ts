import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import config from './config';
import logger from './services/logger';
import scheduler from './services/scheduler';
import apiRoutes from './routes/api';
import storage from './services/storage';

// Load environment variables
dotenv.config();

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

// API Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'S2ID Backend Collector',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            disasters: '/api/disasters',
            stats: '/api/stats',
            status: '/api/status',
            refresh: '/api/refresh (POST)',
            health: '/api/health',
        },
    });
});

// Socket.IO connection handling
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

// Export io for use in other modules
export { io };

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
    logger.info(`🚀 S2ID Backend running on http://localhost:${PORT}`);
    logger.info(`📡 WebSocket server ready`);

    // Start scheduler
    scheduler.start();

    logger.info('');
    logger.info('Available endpoints:');
    logger.info(`  GET  http://localhost:${PORT}/api/disasters`);
    logger.info(`  GET  http://localhost:${PORT}/api/stats`);
    logger.info(`  GET  http://localhost:${PORT}/api/status`);
    logger.info(`  POST http://localhost:${PORT}/api/refresh`);
    logger.info(`  GET  http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    scheduler.stop();
    storage.close();
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    scheduler.stop();
    storage.close();
    httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

export default app;
