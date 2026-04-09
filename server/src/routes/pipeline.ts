import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import logger from '../services/logger';
import analyticsData from '../services/analyticsData';

// Lazy io getter — avoids circular import with index.ts / server.ts
// The io instance is set after the router is created, so we resolve at call-time.
function getIO(): any {
    try {
        // Dynamic require-style resolution: try server/src/index first, then server.ts root
        // safeEmit pattern: silently skip if io not ready
        return (globalThis as any).__ewsIO ?? null;
    } catch { return null; }
}

function safeEmit(event: string, data?: unknown) {
    getIO()?.emit(event, data);
}

const ROOT = path.resolve(__dirname, '../../../');

// Runs a Python script from pipeline/scripts/ and returns a Promise<void>
// stdout/stderr are logged; rejects on non-zero exit or spawn error.
function runScript(scriptName: string, env?: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(ROOT, 'pipeline', 'scripts', scriptName);
        const proc = spawn('python', [scriptPath], {
            env: { ...process.env, ...env },
            cwd: ROOT,
        });
        proc.stdout.on('data', (d: Buffer) => logger.info(`[${scriptName}] ${d.toString().trimEnd()}`));
        proc.stderr.on('data', (d: Buffer) => logger.warn(`[${scriptName}] ${d.toString().trimEnd()}`));
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

const router = Router();

// POST /api/pipeline/started
// Kestra chama esta rota na Task 0 (antes de qualquer processamento)
router.post('/started', (req: Request, res: Response) => {
    const { pipeline_run_id, timestamp } = req.body ?? {};
    const event = {
        pipeline_run_id: pipeline_run_id ?? 'unknown',
        status: 'running',
        timestamp: timestamp ?? new Date().toISOString(),
    };
    logger.info(`[pipeline] Kestra iniciou execução: ${event.pipeline_run_id}`);
    safeEmit('pipeline-started', event);
    res.json({ success: true, received: event });
});

// POST /api/pipeline/done
// Webhook chamado pelo Kestra ao fim de cada execução (sucesso ou falha).
// Broadcast via Socket.IO para todos os clientes conectados.
router.post('/done', (req: Request, res: Response) => {
    const { pipeline_run_id, status, timestamp } = req.body ?? {};

    const event = {
        pipeline_run_id: pipeline_run_id ?? 'unknown',
        status: status ?? 'unknown',
        timestamp: timestamp ?? new Date().toISOString(),
        received_at: new Date().toISOString(),
    };

    logger.info(`[pipeline] Kestra notificou: ${JSON.stringify(event)}`);

    // Recarregar dados analíticos em memória (GeoJSON, LISA, risk)
    if (status === 'success') {
        analyticsData.reload();
    }

    // Notificar todos os clientes WebSocket conectados
    if (status === 'success') {
        safeEmit('pipeline-completed', event);
        safeEmit('data-updated', { source: 'kestra', ...event });
    } else {
        safeEmit('pipeline-failed', event);
    }

    res.json({ success: true, received: event });
});

// POST /api/pipeline/trigger
// Aciona o DAG Kestra via API REST — chamado pelo botão Refresh do frontend
// Kestra API: POST /api/v1/executions/{namespace}/{id}
router.post('/trigger', async (req: Request, res: Response) => {
    const KESTRA_URL = process.env.KESTRA_URL ?? 'http://localhost:8080';
    const namespace  = 'ews.disaster';
    const flowId     = 's2id-ingestion-pipeline';
    const source     = req.body?.source ?? 'atlas';

    try {
        const kestraRes = await fetch(
            `${KESTRA_URL}/api/v1/executions/${namespace}/${flowId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: { source } }),
            }
        );

        if (!kestraRes.ok) {
            const text = await kestraRes.text();
            logger.warn(`[pipeline] Kestra trigger falhou (${kestraRes.status}): ${text}`);
            // Fallback: Kestra offline — retorna aviso mas não erro fatal
            return res.json({
                success: false,
                message: 'Kestra indisponível — use npm run stack:up para iniciá-lo.',
                kestra_status: kestraRes.status,
            });
        }

        const execution = await kestraRes.json();
        logger.info(`[pipeline] DAG acionado: ${execution.id}`);
        safeEmit('pipeline-started', { pipeline_run_id: execution.id, status: 'running' });

        res.json({ success: true, execution_id: execution.id, kestra_ui: `${KESTRA_URL}/ui/executions/${namespace}/${flowId}/${execution.id}` });
    } catch (err) {
        logger.warn('[pipeline] Kestra não acessível:', err);
        res.json({
            success: false,
            message: 'Kestra offline. Para subir: npm run stack:up',
        });
    }
});

// POST /api/pipeline/bronze
// Converte database.json → Bronze GeoParquet (DuckDB). Chamado pelo Kestra Task 3.
router.post('/bronze', async (_req: Request, res: Response) => {
    try {
        await runScript('bronze_ingest.py');
        res.json({ success: true, message: 'Bronze ingest completed' });
    } catch (err) {
        logger.error('[pipeline] bronze_ingest falhou:', err);
        res.status(500).json({ success: false, error: String(err) });
    }
});

// POST /api/pipeline/lisa
// Roda análise LISA via PySAL (analytics/pipeline/lisa_analysis.py). Chamado pelo Kestra Task 6.
router.post('/lisa', async (_req: Request, res: Response) => {
    try {
        const lisaScript = path.join(ROOT, 'analytics', 'pipeline', 'lisa_analysis.py');
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('python', [lisaScript], { cwd: ROOT, env: process.env });
            proc.stdout.on('data', (d: Buffer) => logger.info(`[lisa_analysis] ${d.toString().trimEnd()}`));
            proc.stderr.on('data', (d: Buffer) => logger.warn(`[lisa_analysis] ${d.toString().trimEnd()}`));
            proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`lisa_analysis exit ${code}`))));
            proc.on('error', reject);
        });
        res.json({ success: true, message: 'LISA analysis completed' });
    } catch (err) {
        logger.warn('[pipeline] LISA falhou (non-fatal):', err);
        // allowFailed: LISA é opcional — retorna 200 mesmo com erro
        res.json({ success: false, message: 'LISA failed (non-fatal)', error: String(err) });
    }
});

// POST /api/pipeline/geo-export
// Exporta Gold GeoJSON enriquecido → municipality_geometries.geojson. Chamado pelo Kestra Task 7.
router.post('/geo-export', async (_req: Request, res: Response) => {
    try {
        await runScript('export_gold_geojson.py');
        analyticsData.reload();
        safeEmit('data-updated', { source: 'geo-export', timestamp: new Date().toISOString() });
        res.json({ success: true, message: 'GeoJSON export completed' });
    } catch (err) {
        logger.warn('[pipeline] geo-export falhou (non-fatal):', err);
        res.json({ success: false, message: 'geo-export failed (non-fatal)', error: String(err) });
    }
});

// GET /api/pipeline/status — útil para o TopBar indicator do frontend
router.get('/status', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            message: 'Kestra CE gerencia o agendamento. Ver http://localhost:8080 para DAGs.',
            kestra_ui: 'http://localhost:8080',
            dag_id: 'ews.disaster.s2id-ingestion-pipeline',
        },
    });
});

export default router;
