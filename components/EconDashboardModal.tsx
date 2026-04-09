import React, { useState } from 'react';
import {
    X, TrendingDown, TrendingUp, AlertTriangle, Users, Landmark,
    Wheat, Factory, ShoppingCart, Truck, Zap, Heart, GraduationCap,
    MessageSquare, BarChart3,
} from 'lucide-react';
import type { MunicipalityRisk } from '../analyticsTypes';
import type { AftermathCheckpoint } from '../types';
import AftermathTimeline from './AftermathTimeline';
import ClimateEconInsights from './ClimateEconInsights';
import type { SocioeconomicoData } from './ClimateEconInsights';

interface DanosData {
    peprAgricultura?: number;
    peprPecuaria?: number;
    peprIndustria?: number;
    peprComercio?: number;
    peprServicos?: number;
    peplSaude?: number;
    peplEnsino?: number;
    peplTransportes?: number;
    peplEnergia?: number;
    dhMortos?: number;
    dhDesabrigados?: number;
    dhDesalojados?: number;
    dhOutrosAfetados?: number;
}

interface EconDashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    municipalityRisk: MunicipalityRisk;
    socioeconomico?: SocioeconomicoData;
    danos?: DanosData;
    aftermath?: AftermathCheckpoint[];
    eventType?: string;
    onOpenOracle?: () => void;
}

const fmt = (v: number): string => {
    if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}Bi`;
    if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}Mi`;
    if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
    return `R$ ${v.toFixed(0)}`;
};

const fmtN = (v: number): string => {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toLocaleString('pt-BR');
};

const SECTOR_CONFIG: Array<{
    key: keyof DanosData;
    label: string;
    icon: React.ElementType;
    color: string;
    comexLink?: string;
}> = [
    { key: 'peprAgricultura', label: 'Agricultura', icon: Wheat,        color: '#eab308', comexLink: 'Grãos, café, açúcar' },
    { key: 'peprPecuaria',   label: 'Pecuária',    icon: TrendingDown,  color: '#f97316', comexLink: 'Carne, couro, laticínios' },
    { key: 'peprIndustria',  label: 'Indústria',   icon: Factory,       color: '#8b5cf6', comexLink: 'Manufaturados, químicos' },
    { key: 'peprComercio',   label: 'Comércio',    icon: ShoppingCart,  color: '#06b6d4', comexLink: 'Importações, varejo' },
    { key: 'peprServicos',   label: 'Serviços',    icon: Zap,           color: '#3b82f6' },
    { key: 'peplSaude',      label: 'Saúde Pública', icon: Heart,       color: '#ef4444' },
    { key: 'peplTransportes',label: 'Transportes', icon: Truck,         color: '#10b981' },
    { key: 'peplEnsino',     label: 'Educação',    icon: GraduationCap, color: '#a78bfa' },
];

const SectorBar: React.FC<{ label: string; value: number; max: number; color: string; icon: React.ElementType; comexLink?: string }> = ({
    label, value, max, color, icon: Icon, comexLink,
}) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon style={{ width: 11, height: 11, color }} />
                    <span className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        {label}
                    </span>
                    {comexLink && (
                        <span className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                            · COMEX: {comexLink}
                        </span>
                    )}
                </div>
                <span className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, color }}>
                    {fmt(value)}
                </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`, background: color,
                    borderRadius: 2, transition: 'width 0.6s ease',
                    boxShadow: `0 0 6px ${color}60`,
                }} />
            </div>
        </div>
    );
};

const EconDashboardModal: React.FC<EconDashboardModalProps> = ({
    isOpen, onClose, municipalityRisk, socioeconomico, danos, aftermath, eventType, onOpenOracle,
}) => {
    const [activeTab, setActiveTab] = useState<'losses' | 'timeline' | 'insights'>('losses');

    if (!isOpen) return null;

    const hasDanos = danos && Object.keys(danos).length > 0;
    const totalPEPR = hasDanos
        ? (danos!.peprAgricultura ?? 0) + (danos!.peprPecuaria ?? 0) +
          (danos!.peprIndustria ?? 0) + (danos!.peprComercio ?? 0) + (danos!.peprServicos ?? 0)
        : 0;
    const totalPEPL = hasDanos
        ? (danos!.peplSaude ?? 0) + (danos!.peplEnsino ?? 0) +
          (danos!.peplTransportes ?? 0) + (danos!.peplEnergia ?? 0)
        : 0;
    const totalDanos = totalPEPR + totalPEPL;
    const maxSector = hasDanos
        ? Math.max(...SECTOR_CONFIG.map(s => (danos![s.key] ?? 0) as number))
        : 1;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9000,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="hud-border"
                style={{
                    width: '90vw', maxWidth: 1100, height: '88vh',
                    background: 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px', borderBottom: '1px solid var(--border-primary)',
                    background: 'rgba(0,0,0,0.3)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <BarChart3 style={{ width: 16, height: 16, color: 'var(--cyan)' }} />
                        <div>
                            <h2 className="font-display" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                Dashboard Climático-Econômico
                            </h2>
                            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                                {municipalityRisk.name} · {municipalityRisk.uf} · Risco {municipalityRisk.riskCategory} · {municipalityRisk.trend}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {onOpenOracle && (
                            <button
                                onClick={onOpenOracle}
                                className="font-mono"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                    background: 'rgba(255,94,58,0.1)', border: '1px solid rgba(255,94,58,0.3)',
                                    color: 'var(--primary)', fontSize: '0.55rem', cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                }}
                            >
                                <MessageSquare style={{ width: 11, height: 11 }} />
                                Oracle IA
                            </button>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X style={{ width: 18, height: 18 }} />
                        </button>
                    </div>
                </div>

                {/* KPI Row */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1,
                    borderBottom: '1px solid var(--border-primary)',
                    background: 'rgba(0,0,0,0.2)',
                }}>
                    {[
                        { label: 'Risk Score', value: municipalityRisk.riskScore.toFixed(3), unit: '', color: municipalityRisk.riskCategory === 'Muito Alto' ? 'var(--red)' : municipalityRisk.riskCategory === 'Alto' ? 'var(--amber)' : 'var(--green)', icon: AlertTriangle },
                        { label: 'Eventos 10a', value: fmtN(municipalityRisk.last10yrCount), unit: '', color: 'var(--cyan)', icon: TrendingDown },
                        { label: 'Mortos (hist.)', value: danos?.dhMortos ? fmtN(danos.dhMortos) : '—', unit: '', color: 'var(--red)', icon: Users },
                        { label: 'Desabrigados', value: danos?.dhDesabrigados ? fmtN(danos.dhDesabrigados) : '—', unit: '', color: 'var(--amber)', icon: Users },
                        { label: 'Prej. Privado', value: totalPEPR > 0 ? fmt(totalPEPR) : '—', unit: '', color: 'var(--purple)', icon: TrendingDown },
                        { label: 'Prej. Público', value: totalPEPL > 0 ? fmt(totalPEPL) : '—', unit: '', color: 'var(--blue)', icon: Landmark },
                    ].map(({ label, value, color, icon: Icon }) => (
                        <div key={label} style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                <Icon style={{ width: 10, height: 10, color }} />
                                <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
                            </div>
                            <div className="font-display" style={{ fontSize: '1rem', fontWeight: 700, color }}>
                                {value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tab Bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.2)' }}>
                    {[
                        { key: 'losses' as const,   label: 'Perdas por Setor' },
                        { key: 'timeline' as const, label: 'Aftermath Timeline' },
                        { key: 'insights' as const, label: 'Análise de Impacto' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className="font-mono"
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: '8px 20px', border: 'none', cursor: 'pointer',
                                background: activeTab === tab.key ? 'rgba(0,212,255,0.08)' : 'transparent',
                                borderBottom: activeTab === tab.key ? '2px solid var(--cyan)' : '2px solid transparent',
                                color: activeTab === tab.key ? 'var(--cyan)' : 'var(--text-muted)',
                                fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

                    {activeTab === 'losses' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Left: Sector bars */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    <TrendingDown style={{ width: 13, height: 13, color: 'var(--red)' }} />
                                    <h3 className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Perdas Econômicas por Setor (histórico acumulado)
                                    </h3>
                                </div>
                                {hasDanos ? (
                                    SECTOR_CONFIG.map(({ key, label, icon, color, comexLink }) => {
                                        const val = (danos![key] ?? 0) as number;
                                        if (val === 0) return null;
                                        return (
                                            <SectorBar
                                                key={key}
                                                label={label}
                                                value={val}
                                                max={maxSector}
                                                color={color}
                                                icon={icon}
                                                comexLink={comexLink}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', padding: 16 }}>
                                        Dados de danos econômicos disponíveis após re-run do pipeline com Danos_Informados CSVs.
                                    </div>
                                )}
                            </div>

                            {/* Right: Human damage + PIB context */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    <Users style={{ width: 13, height: 13, color: 'var(--amber)' }} />
                                    <h3 className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Danos Humanos × Contexto Econômico
                                    </h3>
                                </div>

                                {/* Human damage grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                    {[
                                        { key: 'dhMortos',         label: 'Óbitos',          color: 'var(--red)' },
                                        { key: 'dhDesabrigados',   label: 'Desabrigados',     color: 'var(--amber)' },
                                        { key: 'dhDesalojados',    label: 'Desalojados',      color: 'var(--orange)' },
                                        { key: 'dhOutrosAfetados', label: 'Outros Afetados',  color: 'var(--blue)' },
                                    ].map(({ key, label, color }) => {
                                        const val = (danos?.[key as keyof DanosData] ?? 0) as number;
                                        return (
                                            <div key={key} style={{ padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderLeft: `3px solid ${color}` }}>
                                                <div className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                                                <div className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color }}>
                                                    {val > 0 ? fmtN(val) : '—'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Socioeconomic context */}
                                {socioeconomico && (
                                    <div style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                                        <div className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.1em' }}>
                                            Contexto Socioeconômico (IBGE)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            {socioeconomico.pibPerCapita && (
                                                <div>
                                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>PIB per capita</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                        R$ {socioeconomico.pibPerCapita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                    </div>
                                                </div>
                                            )}
                                            {socioeconomico.pibTotal && (
                                                <div>
                                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>PIB total</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                        {fmt(socioeconomico.pibTotal * 1000)}
                                                    </div>
                                                </div>
                                            )}
                                            {socioeconomico.densidadeDemografica && (
                                                <div>
                                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>Densidade</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                        {socioeconomico.densidadeDemografica.toFixed(1)} hab/km²
                                                    </div>
                                                </div>
                                            )}
                                            {totalDanos > 0 && socioeconomico.pibTotal && (
                                                <div>
                                                    <div className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>Danos / PIB</div>
                                                    <div className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: totalDanos > socioeconomico.pibTotal * 1000 * 0.1 ? 'var(--red)' : 'var(--amber)' }}>
                                                        {((totalDanos / (socioeconomico.pibTotal * 1000)) * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'timeline' && aftermath && aftermath.length > 0 && (
                        <div style={{ maxWidth: 800, margin: '0 auto' }}>
                            <AftermathTimeline aftermath={aftermath} eventType={eventType ?? ''} />
                        </div>
                    )}
                    {activeTab === 'timeline' && (!aftermath || aftermath.length === 0) && (
                        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>
                            {'>'} SELECIONE UM EVENTO PARA VER O AFTERMATH TIMELINE
                        </div>
                    )}

                    {activeTab === 'insights' && socioeconomico && (
                        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <ClimateEconInsights municipalityRisk={municipalityRisk} socioeconomico={socioeconomico} />
                        </div>
                    )}
                    {activeTab === 'insights' && !socioeconomico && (
                        <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>
                            {'>'} DADOS SOCIOECONÔMICOS NECESSÁRIOS PARA GERAR INSIGHTS
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '8px 20px', borderTop: '1px solid var(--border-primary)',
                    background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>
                        Fonte: S2ID/MDR · IBGE · Atlas Digital · iCS Edital Nº4 — Clima na Economia
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.42rem', color: 'var(--text-muted)' }}>
                        SKYVIDYA OBSERVATORY · EWS
                    </span>
                </div>
            </div>

            {/* Floating AI Assistant Button */}
            {onOpenOracle && (
                <button
                    onClick={onOpenOracle}
                    style={{
                        position: 'fixed', bottom: 32, right: 32, zIndex: 9100,
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'var(--primary)', border: '2px solid var(--primary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(255,94,58,0.5)',
                        animation: 'pulse 2s infinite',
                    }}
                    title="Analisar com Oracle IA"
                >
                    <MessageSquare style={{ width: 22, height: 22, color: 'white' }} />
                </button>
            )}
        </div>
    );
};

export default EconDashboardModal;
export type { DanosData };
