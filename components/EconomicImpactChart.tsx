import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Ship, RefreshCw } from 'lucide-react';
import { EconomicIndicator, ComexData } from '../types';

interface EconomicImpactChartProps {
    indicators: EconomicIndicator[];
    comex: ComexData[];
    loading: boolean;
}

const directionIcon = (dir: string) => {
    if (dir === 'up') return <TrendingUp style={{ width: 11, height: 11, color: 'var(--green)' }} />;
    if (dir === 'down') return <TrendingDown style={{ width: 11, height: 11, color: 'var(--red)' }} />;
    return <Minus style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />;
};

const formatCurrency = (v: number, prefix = 'R$'): string => {
    if (v >= 1e9) return `${prefix} ${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${prefix} ${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${prefix} ${(v / 1e3).toFixed(1)}K`;
    return `${prefix} ${v.toFixed(0)}`;
};

const EconomicImpactChart: React.FC<EconomicImpactChartProps> = ({ indicators, comex, loading }) => {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <RefreshCw style={{ width: 14, height: 14, color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--amber)' }}>ANALISANDO IMPACTO ECONÔMICO...</span>
            </div>
        );
    }

    if (!indicators.length && !comex.length) {
        return (
            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                {'>'} SELECIONE UM EVENTO PARA ANÁLISE ECONÔMICA
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Market Indicators */}
            {indicators.length > 0 && (
                <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <BarChart3 style={{ width: 13, height: 13, color: 'var(--amber)' }} />
                        <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                            Indicadores de Mercado
                        </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {indicators.map((ind, idx) => (
                            <div
                                key={ind.id || idx}
                                className="animate-fade-in"
                                style={{
                                    padding: '8px 10px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-primary)',
                                    animationDelay: `${idx * 60}ms`,
                                    animationFillMode: 'both',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {ind.name.substring(0, 20)}
                                    </span>
                                    {directionIcon(ind.direction)}
                                </div>
                                <div className="font-display" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {formatCurrency(ind.value)}
                                </div>
                                <div className="font-mono" style={{
                                    fontSize: '0.5rem', marginTop: 2,
                                    color: ind.changePercent >= 0 ? 'var(--green)' : 'var(--red)',
                                }}>
                                    {ind.changePercent >= 0 ? '+' : ''}{ind.changePercent.toFixed(2)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* COMEX STAT */}
            {comex.length > 0 && (
                <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Ship style={{ width: 13, height: 13, color: 'var(--purple)' }} />
                        <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                            COMEX STAT — Impacto Comércio Exterior
                        </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {comex.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className="animate-fade-in"
                                style={{
                                    padding: '10px 12px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-primary)',
                                    borderLeft: `2px solid var(--purple)`,
                                    animationDelay: `${(indicators.length + idx) * 60}ms`,
                                    animationFillMode: 'both',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <div>
                                        <h5 className="font-display" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>
                                            {item.product}
                                        </h5>
                                        <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>
                                            NCM: {item.ncm} • {item.uf} • {item.period}
                                        </span>
                                    </div>
                                    <span className="font-mono" style={{
                                        fontSize: '0.55rem', fontWeight: 700,
                                        color: item.variation >= 0 ? 'var(--green)' : 'var(--red)',
                                    }}>
                                        {item.variation >= 0 ? '+' : ''}{item.variation.toFixed(1)}%
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div>
                                        <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>EXPORT</span>
                                        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--green)' }}>
                                            {formatCurrency(item.exportValue, 'US$')}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>IMPORT</span>
                                        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>
                                            {formatCurrency(item.importValue, 'US$')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EconomicImpactChart;
