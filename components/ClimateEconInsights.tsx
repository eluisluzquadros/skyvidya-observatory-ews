import React from 'react';
import { AlertTriangle, TrendingUp, Heart, Building2, Landmark, Zap, RefreshCw } from 'lucide-react';
import type { MunicipalityRisk } from '../analyticsTypes';

interface SocioeconomicoData {
    pibPerCapita?: number;
    pibTotal?: number;
    idhm?: number;
    densidadeDemografica?: number;
    taxaMortalidadeInfantil?: number;
    receitasBrutas?: number;
    despesasBrutas?: number;
}

interface Insight {
    id: string;
    theme: 'T1' | 'T2' | 'T3' | 'T4';
    themeLabel: string;
    severity: 'alert' | 'warning' | 'info';
    icon: React.ElementType;
    title: string;
    narrative: string;
}

const THEME_COLORS: Record<string, string> = {
    T1: 'var(--amber)',
    T2: 'var(--purple)',
    T3: 'var(--cyan)',
    T4: 'var(--red)',
};

const SEVERITY_BORDER: Record<string, string> = {
    alert: 'var(--red)',
    warning: 'var(--amber)',
    info: 'var(--cyan)',
};

function formatBRL(v: number): string {
    if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
    return `R$ ${v.toFixed(0)}`;
}

// Data validation guards (same as EconomicImpactChart)
const isValidIdhm = (v?: number) => v != null && v >= 0 && v <= 1;

function generateInsights(mun: MunicipalityRisk, socio: SocioeconomicoData): Insight[] {
    const insights: Insight[] = [];
    const riskHigh = mun.riskCategory === 'Alto' || mun.riskCategory === 'Muito Alto';
    const riskMed = mun.riskCategory === 'Médio';
    const trendGrowing = mun.trend === 'Crescente';

    // T1 – ADAPTAÇÃO: Baixa capacidade adaptativa (IDH + risco)
    // Only use IDHM if it's in the valid 0-1 range (current data has indicator issue)
    if (isValidIdhm(socio.idhm)) {
        const idhm = socio.idhm!;
        if (idhm < 0.6 && riskHigh) {
            insights.push({
                id: 'low-adaptive-capacity',
                theme: 'T1', themeLabel: 'Adaptação Climática',
                severity: 'alert',
                icon: AlertTriangle,
                title: 'Baixa capacidade adaptativa',
                narrative: `IDHM de ${idhm.toFixed(3)} (${idhm < 0.55 ? 'muito baixo' : 'baixo'}) combinado com risco ${mun.riskCategory.toLowerCase()} indica população com limitada resiliência socioeconômica para absorver choques climáticos.`,
            });
        } else if (idhm < 0.65 && trendGrowing) {
            insights.push({
                id: 'idhm-trend-risk',
                theme: 'T1', themeLabel: 'Adaptação Climática',
                severity: 'warning',
                icon: AlertTriangle,
                title: 'Vulnerabilidade em ascensão',
                narrative: `IDHM ${idhm.toFixed(3)} com frequência crescente de desastres aponta deterioração potencial das condições de vida e das capacidades de adaptação locais.`,
            });
        }
    }

    // T2 – MACROECONOMIA: Exposição de ativos econômicos
    if (socio.pibTotal != null) {
        const pibBRL = formatBRL(socio.pibTotal * 1000);
        if (riskHigh && (trendGrowing || mun.last2yrCount > mun.last5yrCount / 2.5)) {
            insights.push({
                id: 'economic-exposure',
                theme: 'T2', themeLabel: 'Macroeconomia',
                severity: riskHigh && trendGrowing ? 'alert' : 'warning',
                icon: TrendingUp,
                title: 'Ativos econômicos em risco crescente',
                narrative: `PIB municipal de ${pibBRL} exposto a risco ${mun.riskCategory.toLowerCase()} com ${mun.last2yrCount} ocorrências nos últimos 2 anos${trendGrowing ? ' e tendência crescente' : ''}. Perdas em infraestrutura e produtividade podem comprometer o crescimento local.`,
            });
        } else if (socio.pibPerCapita != null && socio.pibPerCapita < 15000 && riskHigh) {
            insights.push({
                id: 'low-income-high-risk',
                theme: 'T2', themeLabel: 'Macroeconomia',
                severity: 'warning',
                icon: TrendingUp,
                title: 'Baixa renda per capita em zona de alto risco',
                narrative: `PIB per capita de ${formatBRL(socio.pibPerCapita)} com risco ${mun.riskCategory.toLowerCase()} reduz a capacidade de recuperação econômica pós-desastre e amplia o ciclo de vulnerabilidade.`,
            });
        }
    }

    // T3 – MICROECONOMIA: Densidade urbana + risco
    if (socio.densidadeDemografica != null && socio.densidadeDemografica > 100 && riskHigh) {
        insights.push({
            id: 'urban-density',
            theme: 'T3', themeLabel: 'Microeconomia',
            severity: socio.densidadeDemografica > 300 ? 'alert' : 'warning',
            icon: Building2,
            title: 'Densidade urbana amplifica impactos',
            narrative: `Densidade de ${socio.densidadeDemografica.toFixed(0)} hab/km² concentra exposição econômica e humana. Alta densidade em zona de risco ${mun.riskCategory.toLowerCase()} eleva perdas per capita e dificulta evacuação e recuperação pós-desastre.`,
        });
    }

    // T4 – FINANÇAS PÚBLICAS: PIB per capita baixo + risco alto → fiscal stress
    if (socio.pibPerCapita != null && riskHigh && trendGrowing) {
        const pibLow = socio.pibPerCapita < 20000;
        if (pibLow) {
            insights.push({
                id: 'fiscal-climate-stress',
                theme: 'T4', themeLabel: 'Finanças Públicas',
                severity: 'alert',
                icon: Landmark,
                title: 'Pressão fiscal climática estrutural',
                narrative: `PIB per capita de ${formatBRL(socio.pibPerCapita)} indica base tributária limitada. Com tendência crescente de eventos extremos e risco ${mun.riskCategory.toLowerCase()}, o município tem capacidade reduzida de absorver gastos emergenciais e reconstrução.`,
            });
        } else if (!pibLow && riskHigh) {
            insights.push({
                id: 'revenue-at-risk',
                theme: 'T4', themeLabel: 'Finanças Públicas',
                severity: 'warning',
                icon: Zap,
                title: 'Base tributária sob risco climático',
                narrative: `PIB per capita de ${formatBRL(socio.pibPerCapita)} representa base fiscal relevante exposta a risco ${mun.riskCategory.toLowerCase()}. Tendência crescente de eventos extremos ameaça arrecadação via paralisação de atividades e destruição de infraestrutura produtiva.`,
            });
        }
    }

    // Positive: Low risk + good HDI = resilience signal
    if (!riskHigh && !riskMed && !trendGrowing && socio.idhm != null && socio.idhm > 0.7) {
        insights.push({
            id: 'resilience',
            theme: 'T1', themeLabel: 'Adaptação Climática',
            severity: 'info',
            icon: Zap,
            title: 'Perfil de resiliência climática',
            narrative: `IDHM ${socio.idhm.toFixed(3)} com risco ${mun.riskCategory?.toLowerCase() || 'baixo'} e tendência ${mun.trend?.toLowerCase() || 'estável'}. Municípios com este perfil são referência para modelos de adaptação climática bem-sucedidos.`,
        });
    }

    return insights.slice(0, 4);
}

interface ClimateEconInsightsProps {
    municipalityRisk: MunicipalityRisk;
    socioeconomico: SocioeconomicoData;
}

const ClimateEconInsights: React.FC<ClimateEconInsightsProps> = ({ municipalityRisk, socioeconomico }) => {
    const insights = generateInsights(municipalityRisk, socioeconomico);

    if (insights.length === 0) {
        return (
            <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', padding: '12px 16px' }}>
                {'>'} SEM ALERTAS CLIMÁTICO-ECONÔMICOS PARA ESTE PERFIL
            </div>
        );
    }

    return (
        <div style={{ padding: '12px 12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Zap style={{ width: 13, height: 13, color: 'var(--primary)' }} />
                <h4 className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    Insights Clima × Economia
                </h4>
                <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    iCS Edital Nº4
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {insights.map((ins) => {
                    const Icon = ins.icon;
                    const borderColor = SEVERITY_BORDER[ins.severity];
                    const themeColor = THEME_COLORS[ins.theme];
                    return (
                        <div
                            key={ins.id}
                            className="animate-fade-in"
                            style={{
                                padding: '10px 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-primary)',
                                borderLeft: `3px solid ${borderColor}`,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon style={{ width: 12, height: 12, color: borderColor, flexShrink: 0 }} />
                                    <span className="font-display" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {ins.title}
                                    </span>
                                </div>
                                <span className="font-mono" style={{
                                    fontSize: '0.42rem', color: themeColor,
                                    border: `1px solid ${themeColor}40`,
                                    padding: '1px 5px', flexShrink: 0, marginLeft: 6,
                                }}>
                                    {ins.theme} · {ins.themeLabel}
                                </span>
                            </div>
                            <p className="font-mono" style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                {ins.narrative}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClimateEconInsights;
export type { SocioeconomicoData };
