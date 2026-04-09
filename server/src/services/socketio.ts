/**
 * Shared Socket.IO instance registry.
 * Entrypoints (server.ts / server/src/index.ts) registram o io via setIO().
 * Routes usam safeEmit() sem importar o io diretamente.
 *
 * Padrão: objeto mutável exportado (funciona com ESM lazy resolution no Node 24)
 */

const _registry: { io: any } = { io: null };

export function setIO(io: any) {
    _registry.io = io;
}

export function safeEmit(event: string, data?: unknown) {
    _registry.io?.emit(event, data);
}
