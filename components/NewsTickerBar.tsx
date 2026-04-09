import React, { useMemo } from 'react';
import { Radio, TrendingUp, AlertTriangle, Users, MapPin } from 'lucide-react';
import type { DisasterDecree } from '../types';
import type { MunicipalityRisk } from '../analyticsTypes';

interface NewsTickerBarProps {
    events: DisasterDecree[];
    analyticsRiskData?: MunicipalityRisk[];
    totalHistoric?: number;
}

interface TickerItem {
    id: string;
    type: 'event' | 'kpi' | 'alert';
    content: React.ReactNode;
}

const TYPE_ABBREV: Record<string, string> = {
    'Enxurrada': 'ENXURRADA',
    'Inundação': 'INUNDAÇÃO',
    'Alagamento': 'ALAGAMENTO',
    'Deslizamento': 'DESLIZAMENTO',
    'Seca': 'SECA',
    'Granizo': 'GRANIZO',
    'Vendaval': 'VENDAVAL',
    'Erosão': 'EROSÃO',
    'Incêndio Florestal': 'INCÊNDIO',
    'Ciclone': 'CICLONE',
    'Tornado': 'TORNADO',
    'Tempestade': 'TEMPESTADE',
};

const fmtDate = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

const NewsTickerBar: React.FC<NewsTickerBarProps> = ({ events, analyticsRiskData = [], totalHistoric }) => {
    const items = useMemo<TickerItem[]>(() => {
        const result: TickerItem[] = [];

        // ── KPI: total events in current filter
        if (events.length > 0) {
            const uniqueMuns = new Set(events.map(e => `${e.municipality}-${e.uf}`)).size;
            const uniqueUFs = new Set(events.map(e => e.uf)).size;
            result.push({
                id: 'kpi-total',
                type: 'kpi',
                content: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Radio style={{ width: 9, height: 9, color: 'var(--cyan)' }} />
                        <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{events.length.toLocaleString('pt-BR')}</span>
                        <span> decretos</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{uniqueMuns.toLocaleString('pt-BR')}</span>
                        <span> municípios</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                        <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{uniqueUFs}</span>
                        <span> estados afetados</span>
                    </span>
                ),
            });
        }

        // ── KPI: Analytics — high risk
        if (analyticsRiskData.length > 0) {
            const highRisk = analyticsRiskData.filter(
                d => d.riskCategory === 'Alto' || d.riskCategory === 'Muito Alto'
            ).length;
            const crescente = analyticsRiskData.filter(d => d.trend === 'Crescente').length;
            result.push({
                id: 'kpi-analytics',
                type: 'kpi',
                content: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp style={{ width: 9, height: 9, color: 'var(--primary)' }} />
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{highRisk.toLocaleString('pt-BR')}</span>
                        <span> municípios em risco Alto/Muito Alto</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                        <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{crescente.toLocaleString('pt-BR')}</span>
                        <span> com tendência crescente</span>
                    </span>
                ),
            });
        }

        // ── KPI: Historic total
        if (totalHistoric && totalHistoric > events.length) {
            result.push({
                id: 'kpi-historic',
                type: 'kpi',
                content: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users style={{ width: 9, height: 9, color: 'var(--text-muted)' }} />
                        <span>Base histórica:</span>
                        <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{totalHistoric.toLocaleString('pt-BR')}</span>
                        <span> registros desde 1991</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>5.573</span>
                        <span> municípios monitorados</span>
                    </span>
                ),
            });
        }

        // ── Recent events (up to 40, most recent first)
        const recent = [...events]
            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
            .slice(0, 40);

        recent.forEach((ev, i) => {
            const typeLabel = TYPE_ABBREV[ev.type] ?? ev.type?.toUpperCase() ?? 'DESASTRE';
            const isAlerta = (ev.severity ?? 0) >= 4;
            result.push({
                id: `ev-${i}`,
                type: isAlerta ? 'alert' : 'event',
                content: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isAlerta && (
                            <AlertTriangle style={{ width: 9, height: 9, color: 'var(--primary)', flexShrink: 0 }} />
                        )}
                        {!isAlerta && (
                            <MapPin style={{ width: 8, height: 8, color: 'var(--text-muted)', flexShrink: 0 }} />
                        )}
                        <span style={{ color: isAlerta ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isAlerta ? 700 : 400 }}>
                            {ev.municipality}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--cyan)' }}>{ev.uf}</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>—</span>
                        <span style={{ color: isAlerta ? 'var(--amber)' : 'var(--text-muted)' }}>{typeLabel}</span>
                        {ev.date && (
                            <>
                                <span style={{ color: 'var(--border-active)', margin: '0 2px' }}>·</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{fmtDate(ev.date)}</span>
                            </>
                        )}
                        {ev.affected > 0 && (
                            <>
                                <span style={{ color: 'var(--border-active)', margin: '0 2px' }}>·</span>
                                <span style={{ color: isAlerta ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.6rem' }}>
                                    {ev.affected.toLocaleString('pt-BR')} afetados
                                </span>
                            </>
                        )}
                    </span>
                ),
            });
        });

        return result;
    }, [events, analyticsRiskData, totalHistoric]);

    if (items.length === 0) return null;

    // Duplicate for seamless loop
    const doubled = [...items, ...items];

    return (
        <div style={{
            height: 26,
            background: 'rgba(0,0,0,0.6)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
        }}>
            {/* Left label */}
            <div style={{
                flexShrink: 0,
                padding: '0 10px',
                borderRight: '1px solid var(--border)',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,94,58,0.08)',
                zIndex: 2,
            }}>
                <span style={{
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    boxShadow: '0 0 6px var(--primary)',
                    animation: 'pulse-red 1.5s infinite',
                    flexShrink: 0,
                }} />
                <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                    AO VIVO
                </span>
            </div>

            {/* Scrolling content */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div
                className="news-ticker-track"
                style={{ display: 'flex', alignItems: 'center', gap: 0, animationDuration: `${items.length * 8}s` }}
            >
                    {doubled.map((item, idx) => (
                        <span
                            key={`${item.id}-${idx}`}
                            className="font-mono"
                            style={{
                                fontSize: '0.62rem',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                                padding: '0 24px',
                                borderRight: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                height: 26,
                            }}
                        >
                            {item.content}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NewsTickerBar;
