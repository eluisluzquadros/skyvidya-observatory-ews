import React from 'react';
import { Clock, TrendingDown, TrendingUp, Landmark } from 'lucide-react';
import type { AftermathCheckpoint } from '../types';

interface AftermathTimelineProps {
    aftermath: AftermathCheckpoint[];
    eventType: string;
}

const formatFiscal = (v: number): string => {
    if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}B`;
    return `R$ ${v.toFixed(0)}M`;
};

const ImpactBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
    const pct = Math.min(Math.abs(value) / max * 100, 100);
    return (
        <div style={{ height: 3, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
    );
};

const AftermathTimeline: React.FC<AftermathTimelineProps> = ({ aftermath, eventType }) => {
    if (!aftermath || aftermath.length === 0) return null;

    const maxFiscal = Math.max(...aftermath.map(a => Math.abs(a.fiscalImpact)), 1);
    const maxMarket = Math.max(...aftermath.map(a => Math.abs(a.marketImpact)), 0.1);
    const maxComex  = Math.max(...aftermath.map(a => Math.abs(a.comexImpact)), 0.1);

    return (
        <div style={{ padding: '12px 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock style={{ width: 13, height: 13, color: 'var(--amber)' }} />
                <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    Aftermath · Janela Temporal
                </h4>
                <span className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {eventType}
                </span>
            </div>

            {/* Timeline connector */}
            <div style={{ position: 'relative' }}>
                {/* Horizontal line */}
                <div style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    right: 16,
                    height: 1,
                    background: 'var(--border-primary)',
                    zIndex: 0,
                }} />

                {/* Checkpoint dots row */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${aftermath.length}, 1fr)`, gap: 6, marginBottom: 10 }}>
                    {aftermath.map((cp) => {
                        const isNegMarket = cp.marketImpact < 0;
                        const dotColor = cp.marketImpact < -2 ? 'var(--red)' :
                                         cp.marketImpact < 0 ? 'var(--amber)' : 'var(--green)';
                        return (
                            <div key={cp.period} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: dotColor,
                                    border: `2px solid var(--bg-primary)`,
                                    boxShadow: `0 0 6px ${dotColor}`,
                                    marginBottom: 6,
                                }} />
                                <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    {cp.period}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Checkpoint cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {aftermath.map((cp, idx) => {
                    const marketColor = cp.marketImpact < 0 ? 'var(--red)' : 'var(--green)';
                    const comexColor  = cp.comexImpact  < 0 ? 'var(--red)' : 'var(--green)';
                    return (
                        <div
                            key={cp.period}
                            className="animate-fade-in"
                            style={{
                                padding: '10px 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-primary)',
                                borderLeft: `3px solid ${cp.marketImpact < -2 ? 'var(--red)' : cp.marketImpact < 0 ? 'var(--amber)' : 'var(--green)'}`,
                                animationDelay: `${idx * 80}ms`,
                                animationFillMode: 'both',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span className="font-display" style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {cp.label}
                                </span>
                                <span className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>
                                    {cp.period}
                                </span>
                            </div>

                            {/* Metrics row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                                <div>
                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)', marginBottom: 2 }}>MERCADO</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {cp.marketImpact < 0
                                            ? <TrendingDown style={{ width: 9, height: 9, color: marketColor }} />
                                            : <TrendingUp style={{ width: 9, height: 9, color: marketColor }} />}
                                        <span className="font-mono" style={{ fontSize: '0.55rem', color: marketColor, fontWeight: 700 }}>
                                            {cp.marketImpact >= 0 ? '+' : ''}{cp.marketImpact.toFixed(1)}%
                                        </span>
                                    </div>
                                    <ImpactBar value={cp.marketImpact} max={maxMarket} color={marketColor} />
                                </div>
                                <div>
                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)', marginBottom: 2 }}>COMEX</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {cp.comexImpact < 0
                                            ? <TrendingDown style={{ width: 9, height: 9, color: comexColor }} />
                                            : <TrendingUp style={{ width: 9, height: 9, color: comexColor }} />}
                                        <span className="font-mono" style={{ fontSize: '0.55rem', color: comexColor, fontWeight: 700 }}>
                                            {cp.comexImpact >= 0 ? '+' : ''}{cp.comexImpact.toFixed(1)}%
                                        </span>
                                    </div>
                                    <ImpactBar value={cp.comexImpact} max={maxComex} color={comexColor} />
                                </div>
                                <div>
                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)', marginBottom: 2 }}>FISCAL</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Landmark style={{ width: 9, height: 9, color: 'var(--purple)' }} />
                                        <span className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--purple)', fontWeight: 700 }}>
                                            {formatFiscal(cp.fiscalImpact)}
                                        </span>
                                    </div>
                                    <ImpactBar value={cp.fiscalImpact} max={maxFiscal} color="var(--purple)" />
                                </div>
                            </div>

                            <p className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                {cp.narrative}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AftermathTimeline;
