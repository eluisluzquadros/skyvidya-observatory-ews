import { DisasterDecree, FilterState } from '../types';

// Configuration - can be overridden via window config or environment
const getApiBase = () => {
    if (typeof window !== 'undefined' && (window as any).__S2ID_CONFIG__?.API_URL) {
        return (window as any).__S2ID_CONFIG__.API_URL;
    }
    return 'http://localhost:3001/api';
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

// WebSocket connection for real-time updates
export class RealtimeConnection {
    private socket: WebSocket | null = null;
    private listeners: Map<string, Function[]> = new Map();

    connect(): void {
        // Note: This is a simplified WebSocket. For full Socket.IO support,
        // you would need to import socket.io-client
        console.log('WebSocket connection would be established here');
        // In a real implementation:
        // this.socket = io(WS_URL);
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback: Function): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

export const realtime = new RealtimeConnection();
