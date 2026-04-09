import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, Ship, RefreshCw, Building2 } from 'lucide-react';
import { EconomicIndicator, ComexData, AftermathCheckpoint } from '../types';
import type { MunicipalityRisk } from '../analyticsTypes';
import ClimateEconInsights from './ClimateEconInsights';
import AftermathTimeline from './AftermathTimeline';
import type { SocioeconomicoData } from './ClimateEconInsights';

interface EconomicImpactChartProps {
    indicators: EconomicIndicator[];
    comex: ComexData[];
    aftermath: AftermathCheckpoint[];
    loading: boolean;
    socioeconomico?: SocioeconomicoData;
    municipalityName?: string;
    municipalityRisk?: MunicipalityRisk;
    eventType?: string;
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

// Validation ranges: skip indicators with values outside expected range (data quality guard)
const SOCIO_VALIDATORS: Partial<Record<keyof SocioeconomicoData, (v: number) => boolean>> = {
    idhm:                  v => v >= 0 && v <= 1,
    taxaMortalidadeInfantil: v => v >= 0 && v <= 30,
    receitasBrutas:        () => false,
    despesasBrutas:        () => false,
};

const SOCIO_LABELS: Array<{ key: keyof SocioeconomicoData; label: string; fmt: (v: number) => string }> = [
    { key: 'pibPerCapita',          label: 'PIB per capita',      fmt: v => formatCurrency(v) },
    { key: 'pibTotal',              label: 'PIB total',           fmt: v => formatCurrency(v * 1000) },
    { key: 'densidadeDemografica',  label: 'Densidade demog.',    fmt: v => `${v.toFixed(1)} hab/km²` },
    { key: 'idhm',                  label: 'IDHM',               fmt: v => v.toFixed(3) },
    { key: 'taxaMortalidadeInfantil', label: 'Mortalidade inf.', fmt: v => `${v.toFixed(1)}‰` },
    { key: 'receitasBrutas',        label: 'Receitas brutas',     fmt: v => formatCurrency(v * 1e9) },
    { key: 'despesasBrutas',        label: 'Despesas brutas',     fmt: v => formatCurrency(v * 1000) },
];

type EconTab = 'aftermath' | 'mercado' | 'comex';

const EconomicImpactChart: React.FC<EconomicImpactChartProps> = ({ indicators, comex, aftermath, loading, socioeconomico, municipalityName, municipalityRisk, eventType }) => {
    const [activeTab, setActiveTab] = useState<EconTab>('aftermath');

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <RefreshCw style={{ width: 14, height: 14, color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--amber)' }}>ANALISANDO IMPACTO ECONÔMICO...</span>
            </div>
        );
    }

    const hasSocio = socioeconomico && Object.keys(socioeconomico).length > 0;
    const hasAftermath = aftermath && aftermath.length > 0;

    if (!indicators.length && !comex.length && !hasSocio && !hasAftermath) {
        return (
            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                {'>'} SELECIONE UM EVENTO PARA ANÁLISE ECONÔMICA
            </div>
        );
    }

    const ECON_TABS: { key: EconTab; label: string; icon: typeof BarChart3; available: boolean }[] = [
        { key: 'aftermath', label: 'Aftermath', icon: BarChart3, available: hasAftermath || (municipalityRisk != null && hasSocio == true) },
        { key: 'mercado',   label: 'Mercado',   icon: BarChart3, available: indicators.length > 0 || hasSocio == true },
        { key: 'comex',     label: 'COMEX',     icon: Ship,      available: comex.length > 0 },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sub-tabs for Econ panel */}
            <div style={{
                display: 'flex', borderBottom: '1px solid var(--border-primary)',
                background: 'rgba(0,0,0,0.2)', flexShrink: 0,
            }}>
                {ECON_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="font-mono"
                        style={{
                            flex: 1, padding: '7px 4px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            border: 'none', cursor: 'pointer',
                            background: activeTab === tab.key ? 'rgba(0,212,255,0.06)' : 'transparent',
                            borderBottom: activeTab === tab.key ? '2px solid var(--amber)' : '2px solid transparent',
                            color: activeTab === tab.key ? 'var(--amber)' : 'var(--text-muted)',
                            fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                            transition: 'all 0.15s',
                            opacity: tab.available ? 1 : 0.4,
                        }}
                    >
                        <tab.icon style={{ width: 10, height: 10 }} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* ── AFTERMATH TAB ── */}
                {activeTab === 'aftermath' && (
                    <div>
                        {hasAftermath && (
                            <AftermathTimeline aftermath={aftermath} eventType={eventType ?? ''} />
                        )}
                        {municipalityRisk && hasSocio && (
                            <ClimateEconInsights
                                municipalityRisk={municipalityRisk}
                                socioeconomico={socioeconomico!}
                            />
                        )}
                        {!hasAftermath && (!municipalityRisk || !hasSocio) && (
                            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                                {'>'} DADOS DE AFTERMATH NÃO DISPONÍVEIS
                            </div>
                        )}
                    </div>
                )}

                {/* ── MERCADO TAB ── */}
                {activeTab === 'mercado' && (
                    <div>
                        {/* IBGE Socioeconomic Indicators */}
                        {hasSocio && (
                            <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <Building2 style={{ width: 13, height: 13, color: 'var(--cyan)' }} />
                                    <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                        Indicadores IBGE{municipalityName ? ` — ${municipalityName}` : ''}
                                    </h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    {SOCIO_LABELS.map(({ key, label, fmt }) => {
                                        const val = socioeconomico![key];
                                        if (val == null) return null;
                                        const validator = SOCIO_VALIDATORS[key];
                                        if (validator && !validator(val)) return null;
                                        return (
                                            <div
                                                key={key}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-primary)',
                                                    borderLeft: '2px solid var(--cyan)',
                                                }}
                                            >
                                                <div className="font-mono" style={{ fontSize: '0.48rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                                                    {label}
                                                </div>
                                                <div className="font-display" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {fmt(val)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Market Indicators */}
                        {indicators.length > 0 && (
                            <div style={{ padding: 12 }}>
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

                        {!hasSocio && indicators.length === 0 && (
                            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                                {'>'} DADOS DE MERCADO NÃO DISPONÍVEIS
                            </div>
                        )}
                    </div>
                )}

                {/* ── COMEX TAB ── */}
                {activeTab === 'comex' && (
                    <div style={{ padding: 12 }}>
                        {comex.length > 0 ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                    <Ship style={{ width: 13, height: 13, color: 'var(--purple)' }} />
                                    <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                        COMEX STAT — Impacto Comércio Exterior
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {comex.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className="animate-fade-in"
                                            style={{
                                                padding: '12px 14px',
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-primary)',
                                                borderLeft: `2px solid var(--purple)`,
                                                animationDelay: `${idx * 60}ms`,
                                                animationFillMode: 'both',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                                    <h5 className="font-display" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                                                        {item.product}
                                                    </h5>
                                                    <div className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                                        <div>NCM: {item.ncm}</div>
                                                        <div>{item.uf} • {item.period}</div>
                                                    </div>
                                                </div>
                                                <span className="font-mono" style={{
                                                    fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                                                    color: item.variation >= 0 ? 'var(--green)' : 'var(--red)',
                                                }}>
                                                    {item.variation >= 0 ? '+' : ''}{item.variation.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div style={{ padding: '6px 8px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                                                    <div className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Exportação</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600 }}>
                                                        {formatCurrency(item.exportValue, 'US$')}
                                                    </div>
                                                </div>
                                                <div style={{ padding: '6px 8px', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                                    <div className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Importação</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--blue)', fontWeight: 600 }}>
                                                        {formatCurrency(item.importValue, 'US$')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                                {'>'} DADOS COMEX NÃO DISPONÍVEIS PARA ESTE EVENTO
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EconomicImpactChart;
