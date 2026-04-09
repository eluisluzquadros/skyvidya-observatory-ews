import { DisasterDecree, FilterState } from '../types';

// Configuration - can be overridden via window config or environment
const getApiBase = () => {
    if (typeof window !== 'undefined' && (window as any).__S2ID_CONFIG__?.API_URL) {
        return (window as any).__S2ID_CONFIG__.API_URL;
    }
    return '/api';
};

const API_BASE = getApiBase();

// Types from backend
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
    count?: number;
}

interface CollectionStatus {
    source: 'atlas' | 's2id';
    reportType?: string;
    lastRun: string | null;
    lastSuccess: string | null;
    recordCount: number;
    status: 'idle' | 'running' | 'success' | 'error';
    error?: string;
}

interface SchedulerStatus {
    atlasWeekly: {
        schedule: string;
        nextRun: string | null;
        enabled: boolean;
    };
    s2idDaily: {
        schedule: string;
        nextRun: string | null;
        enabled: boolean;
    };
}

export interface SystemStatus {
    collections: CollectionStatus[];
    scheduler: SchedulerStatus;
    serverTime: string;
}

export interface Stats {
    total: number;
    bySource: { source: string; count: number }[];
    byUf: { uf: string; count: number }[];
    byType: { type: string; count: number }[];
}

// Check if backend is available
export async function checkBackendHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        return data.success === true;
    } catch {
        return false;
    }
}

// Fetch disasters from backend
export async function fetchDisastersFromAPI(filters?: FilterState): Promise<DisasterDecree[]> {
    const params = new URLSearchParams();

    if (filters?.uf) params.append('uf', filters.uf);
    if (filters?.type) params.append('type', filters.type);

    const url = `${API_BASE}/disasters${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const result: ApiResponse<DisasterDecree[]> = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
    }

    return result.data;
}

// Fetch statistics from backend
export async function fetchStatsFromAPI(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const result: ApiResponse<Stats> = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
    }

    return result.data;
}

// Fetch system status (collection status + scheduler)
export async function fetchSystemStatus(): Promise<SystemStatus> {
    const response = await fetch(`${API_BASE}/status`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const result: ApiResponse<SystemStatus> = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
    }

    return result.data;
}

// Trigger manual data refresh
export async function triggerRefresh(source?: 'atlas' | 's2id'): Promise<{ atlas?: number; s2id?: number }> {
    const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source }),
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const result: ApiResponse<{ atlas?: number; s2id?: number }> = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Unknown API error');
    }

    return result.data;
}

// Format date for display
export function formatLastUpdate(dateString: string | null): string {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays < 7) return `Há ${diffDays} dias`;

    return date.toLocaleDateString('pt-BR');
}

// Real-time connection via Socket.IO
import { io as ioClient, Socket } from 'socket.io-client';

const WS_URL = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001';

export class RealtimeConnection {
    private socket: Socket | null = null;

    connect(): void {
        if (this.socket?.connected) return;
        this.socket = ioClient(WS_URL, { transports: ['websocket', 'polling'] });
        this.socket.on('connect', () =>
            console.log('[realtime] Socket.IO connected:', this.socket?.id)
        );
        this.socket.on('disconnect', () =>
            console.log('[realtime] Socket.IO disconnected')
        );
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }

    on(event: string, callback: (...args: any[]) => void): void {
        this.socket?.on(event, callback);
    }

    off(event: string, callback: (...args: any[]) => void): void {
        this.socket?.off(event, callback);
    }

    emit(event: string, data?: unknown): void {
        this.socket?.emit(event, data);
    }
}

export const realtime = new RealtimeConnection();
