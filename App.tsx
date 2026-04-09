import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    AlertTriangle, Activity, MapPin, Shield, Skull,
    ChevronRight, ChevronLeft, Newspaper, BarChart3,
    Sparkles, Target, X,
} from 'lucide-react';

import Globe from './components/Globe';
import StatCard from './components/StatCard';
import TopBar from './components/TopBar';
import RiskBadge from './components/RiskBadge';
import ValidationFeed from './components/ValidationFeed';
import EconomicImpactChart from './components/EconomicImpactChart';
import EconDashboardModal from './components/EconDashboardModal';
import NewsTickerBar from './components/NewsTickerBar';
import TacticalAI from './components/TacticalAI';
import TacticalChat from './components/TacticalChat';
import DonationModal from './components/DonationModal';
import SettingsModal from './components/SettingsModal';
import ChoroplethMap from './components/ChoroplethMap';
import ViewToggle from './components/ViewToggle';
import AnalyticsPanel from './components/AnalyticsPanel';

import { DisasterDecree, DisasterFilter, FilterPreset, NewsArticle, EconomicIndicator, ComexData, AftermathCheckpoint } from './types';
import { fetchRealDisasters, generateInsight, fetchEventNews, fetchEconomicImpact, formatEventDate, fetchCollectionStatus, triggerRefresh } from './services/geminiService';
import { realtime } from './services/apiService';
import type { OracleAnalyticsContext } from './services/geminiService';
import {
    fetchRiskData, fetchDistributions, fetchMunicipalityGeoJSON,
    fetchLISAClusters,
} from './services/analyticsService';
import type {
    MunicipalityRisk, AnalyticsDistributions, GeoJSONCollection, LISAClusterData, ChoroplethColorBy,
} from './analyticsTypes';

type RightPanel = 'detail' | 'news' | 'economic' | 'analytics';

// ── Accent-Insensitive Normalization Helper ──
const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const App: React.FC = () => {
    // ── Core State ──
    const [data, setData] = useState<DisasterDecree[]>([]);
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState<string>('');

    // ── Filters ──
    const _24hAgo = new Date(); _24hAgo.setHours(_24hAgo.getHours() - 24);
    const [disasterFilter, setDisasterFilter] = useState<DisasterFilter>({ startDate: _24hAgo.toISOString().split('T')[0], endDate: null, preset: '24h' });
    const [searchQuery, setSearchQuery] = useState('');
    const [maxDataDate, setMaxDataDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // ── Selection ──
    const [selectedEvent, setSelectedEvent] = useState<DisasterDecree | null>(null);

    // ── Panels ──
    const [rightPanel, setRightPanel] = useState<RightPanel>('detail');
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);

    // ── Auto-select ref (fires once after first successful load) ──
    const autoSelectedRef = useRef(false);

    // ── Modals ──
    const [showSettings, setShowSettings] = useState(false);
    const [showDonate, setShowDonate] = useState(false);
    const [collectionStatus, setCollectionStatus] = useState<any[]>([]);
    const [settingsLoading, setSettingsLoading] = useState(false);

    // ── Event Data ──
    const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(false);
    const [economicData, setEconomicData] = useState<{ indicators: EconomicIndicator[]; comex: ComexData[]; aftermath: AftermathCheckpoint[] }>({ indicators: [], comex: [], aftermath: [] });
    const [econLoading, setEconLoading] = useState(false);
    const [showEconDashboard, setShowEconDashboard] = useState(false);

    // ── Analytics State ──
    const [activeView, setActiveView] = useState<'globe' | 'map'>('globe');
    const [analyticsRiskData, setAnalyticsRiskData] = useState<MunicipalityRisk[]>([]);
    const [analyticsDistributions, setAnalyticsDistributions] = useState<AnalyticsDistributions | null>(null);
    const [analyticsGeoJSON, setAnalyticsGeoJSON] = useState<GeoJSONCollection | null>(null);
    const [analyticsLISA, setAnalyticsLISA] = useState<LISAClusterData | null>(null); // loaded on demand
    const [choroplethColorBy, setChoroplethColorBy] = useState<ChoroplethColorBy>('riskCategory');
    const [selectedLisaVariable, setSelectedLisaVariable] = useState<string>('LAST10_YEARS_COUNT');
    const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
    const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
    // refreshKey: incremented by the refresh button to force-reload outside the filter useEffect
    const [refreshKey, setRefreshKey] = useState(0);
    const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

    // ── Server-side Stats (full dataset, respects date filter) ──
    const [serverStats, setServerStats] = useState<{ total: number; totalAffected: number; totalCritical: number; ufsCount: number } | null>(null);

    const fetchServerStats = async (filter: DisasterFilter) => {
        try {
            const params = new URLSearchParams();
            if (filter.startDate) params.set('startDate', filter.startDate);
            if (filter.endDate) params.set('endDate', filter.endDate);
            const res = await fetch(`http://localhost:3001/api/stats?${params}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.success) setServerStats(json.data);
        } catch { /* backend unavailable */ }
    };

    // ── Load Data ──
    const loadData = async (filter?: DisasterFilter) => {
        const f = filter ?? disasterFilter;
        setLoading(true);
        fetchServerStats(f);
        try {
            const result = await fetchRealDisasters({
                startDate: f.startDate,
                endDate: f.endDate,
                municipality: f.municipality,
                uf: f.uf,
            });
            setData(result);
            // Track the latest available data date for the custom date picker
            if (result.length > 0) {
                const latest = result.reduce((max, d) => d.date > max ? d.date : max, result[0].date);
                setMaxDataDate(prev => latest > prev ? latest : prev);
            }
            // Smart fallback: if a short-range filter returns nothing, expand to last 30 days (not all-time)
            const shortRangePresets: FilterPreset[] = ['1h', '3h', '6h', '12h', '24h', '48h'];
            if (result.length === 0 && f.startDate && shortRangePresets.includes(f.preset as FilterPreset)) {
                const d30 = new Date(); d30.setDate(d30.getDate() - 30);
                setDisasterFilter({ preset: 'custom', startDate: d30.toISOString().split('T')[0], endDate: null });
            }
            const intel = await generateInsight(result);
            setInsight(intel);
        } catch (e) {
            console.error('Data fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(disasterFilter); }, [disasterFilter, refreshKey]);

    // ── Socket.IO — pipeline events ──
    useEffect(() => {
        realtime.connect();

        const onPipelineStarted = () => {
            setPipelineStatus('running');
        };
        const onPipelineCompleted = () => {
            setPipelineStatus('completed');
            setRefreshKey((k: number) => k + 1);
            setTimeout(() => setPipelineStatus('idle'), 10_000);
        };
        const onPipelineFailed = (event: any) => {
            setPipelineStatus('failed');
            console.warn('[pipeline] Falha no pipeline Kestra:', event);
            setTimeout(() => setPipelineStatus('idle'), 30_000);
        };

        realtime.on('pipeline-started',   onPipelineStarted);
        realtime.on('pipeline-completed', onPipelineCompleted);
        realtime.on('pipeline-failed',    onPipelineFailed);

        return () => {
            realtime.off('pipeline-started',   onPipelineStarted);
            realtime.off('pipeline-completed', onPipelineCompleted);
            realtime.off('pipeline-failed',    onPipelineFailed);
        };
    }, []);

    // ── 1-Hour Auto-Refresh for Intel ──
    useEffect(() => {
        const interval = setInterval(() => {
            loadData(disasterFilter);
        }, 3600000); // 1 hour
        return () => clearInterval(interval);
    }, [disasterFilter]);

    // ── Auto-select most recent event after first successful load ──
    useEffect(() => {
        if (!loading && filteredData.length > 0 && !autoSelectedRef.current) {
            autoSelectedRef.current = true;
            handleEventSelect(filteredData[0]);
        }
    }, [loading]);

    // ── Auto-select first result when search query changes ──
    useEffect(() => {
        if (searchQuery.trim() && filteredData.length > 0) {
            handleEventSelect(filteredData[0]);
        }
    }, [searchQuery]);

    // ── Filter Data (client-side: search only; date filtering is server-side) ──
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = normalizeName(searchQuery);
        return data.filter((d) =>
            normalizeName(d.municipality).includes(q) ||
            normalizeName(d.uf).includes(q) ||
            normalizeName(d.type).includes(q)
        );
    }, [data, searchQuery]);

    // ── Stats (server-side when available, fallback to client subset) ──
    const stats = useMemo(() => {
        if (serverStats && !searchQuery.trim()) {
            return {
                total: serverStats.total,
                critical: serverStats.totalCritical,
                totalAffected: serverStats.totalAffected,
                states: serverStats.ufsCount,
            };
        }
        const total = filteredData.length;
        const critical = filteredData.filter(d => (d.severity ?? 0) >= 4).length;
        const totalAffected = filteredData.reduce((sum, d) => sum + (d.affected || 0), 0);
        const statesSet = new Set(filteredData.map(d => d.uf));
        return { total, critical, totalAffected, states: statesSet.size };
    }, [filteredData, serverStats, searchQuery]);

    // ── Event Selection Handler ──
    const handleEventSelect = async (event: DisasterDecree) => {
        setSelectedEvent(event);
        setSelectedMunicipality(null); // Clear map selection so ECON resolves from event
        setRightPanel('detail');

        // Fetch news validation
        setNewsLoading(true);
        try {
            const news = await fetchEventNews(event);
            setNewsArticles(news);
        } catch { setNewsArticles([]); }
        finally { setNewsLoading(false); }

        // Fetch economic impact (with socioeconomic context if available)
        setEconLoading(true);
        try {
            const munRisk = analyticsRiskData.find(d =>
                d.uf === event.uf.toUpperCase() &&
                normalizeName(d.name) === normalizeName(event.municipality)
            );
            const socioCtx = munRisk ? {
                pibPerCapita: munRisk.socioeconomico?.pibPerCapita,
                pibTotal: munRisk.socioeconomico?.pibTotal,
                idhm: munRisk.socioeconomico?.idhm,
                receitasBrutas: munRisk.socioeconomico?.receitasBrutas,
                despesasBrutas: munRisk.socioeconomico?.despesasBrutas,
                riskScore: munRisk.riskScore,
                riskCategory: munRisk.riskCategory,
                trend: munRisk.trend,
            } : undefined;
            const econ = await fetchEconomicImpact(event, socioCtx);
            setEconomicData({ ...econ, aftermath: econ.aftermath ?? [] });
        } catch { setEconomicData({ indicators: [], comex: [], aftermath: [] }); }
        finally { setEconLoading(false); }
    };

    // ── Refresh Handler — tenta Kestra, fallback para re-fetch local ──
    const handleRefresh = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/pipeline/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: 'atlas' }),
            });
            const json = await res.json();
            if (json.success) {
                // Kestra acionado — o evento pipeline-started chega via Socket.IO
                setPipelineStatus('running');
                return;
            }
        } catch { /* Kestra offline */ }
        // Fallback: apenas re-fetch os dados já existentes
        setRefreshKey((k: number) => k + 1);
    };

    // ── Import Handler ──
    const handleImport = (imported: DisasterDecree[]) => {
        setData(prev => [...imported, ...prev]);
    };

    // ── Analytics Data Loading ──
    const analyticsLoadedRef = useRef(false);
    const loadAnalyticsData = async () => {
        if (analyticsLoadedRef.current) return;
        analyticsLoadedRef.current = true;
        try {
            const [risk, dist] = await Promise.all([
                fetchRiskData().catch(() => [] as MunicipalityRisk[]),
                fetchDistributions().catch(() => null),
            ]);
            setAnalyticsRiskData(risk);
            setAnalyticsDistributions(dist);
            if (risk.length > 0) setAnalyticsLoaded(true);
            // GeoJSON and LISA only when map/analytics panel is used (heavy files)
        } catch (e) {
            analyticsLoadedRef.current = false;
            console.error('Analytics data fetch failed:', e);
        }
    };

    const loadHeavyAnalytics = async () => {
        fetchMunicipalityGeoJSON().then(setAnalyticsGeoJSON).catch(() => {});
        // LISA is 380 MB — only load on explicit request via AnalyticsPanel
    };

    // ── Settings Handlers ──
    const handleSettingsRefresh = async () => {
        setSettingsLoading(true);
        try {
            await triggerRefresh('atlas'); // Sync with known sources
            setRefreshKey(k => k + 1);
            // Poll for status update
            const status = await fetchCollectionStatus();
            setCollectionStatus(status);
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleSettingsImport = async (type: string) => {
        setSettingsLoading(true);
        try {
            const res = await triggerRefresh('s2id');
            if (res.success) {
                setRefreshKey(k => k + 1);
                const status = await fetchCollectionStatus();
                setCollectionStatus(status);
                alert(`Scraper disparado com sucesso! ${res.count ? res.count + ' novos registros.' : ''}`);
            } else {
                alert(`Erro: ${res.message || 'Falha ao disparar scraper.'}`);
            }
        } finally {
            setSettingsLoading(false);
        }
    };

    // Poll collection status when settings is open
    useEffect(() => {
        let interval: any;
        if (showSettings) {
            fetchCollectionStatus().then(setCollectionStatus);
            interval = setInterval(() => {
                fetchCollectionStatus().then(setCollectionStatus);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [showSettings]);

    // Load risk data immediately on mount
    useEffect(() => {
        loadAnalyticsData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (activeView === 'map' || rightPanel === 'analytics') {
            loadHeavyAnalytics();
        }
    }, [activeView, rightPanel]);

    // Analytics pipeline refresh available via Import modal or server-side triggers

    // ── Analytics Municipality Click Handler ──
    const handleMunicipalityClick = useCallback((municipality: MunicipalityRisk) => {
        setSelectedMunicipality(municipality.cd_mun);
        setRightPanel('analytics');
    }, []);

    // ── Load LISA when cluster mode is selected ──
    useEffect(() => {
        if (choroplethColorBy === 'lisaCluster' && !analyticsLISA) {
            fetchLISAClusters().then(setAnalyticsLISA).catch(() => {});
        }
    }, [choroplethColorBy, analyticsLISA]);

    // ── LISA variables list ──
    const lisaVariables = useMemo(() => {
        if (!analyticsLISA) return [];
        return Object.keys(analyticsLISA.variables);
    }, [analyticsLISA]);

    // ── Normalize municipality names for comparison (removes accents) ──
    const normalizeName = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // ── Resolve selected municipality risk record (for ECON panel) ──
    const selectedMunicipalityRisk = useMemo(() => {
        if (selectedMunicipality) {
            return analyticsRiskData.find(d => d.cd_mun === selectedMunicipality) ?? null;
        }
        if (selectedEvent && analyticsRiskData.length > 0) {
            const name = normalizeName(selectedEvent.municipality);
            const uf = selectedEvent.uf.toUpperCase();
            return analyticsRiskData.find(d =>
                d.uf === uf && normalizeName(d.name) === name
            ) ?? null;
        }
        return null;
    }, [selectedMunicipality, selectedEvent, analyticsRiskData]);

    const [showSentinela, setShowSentinela] = useState(false);
    const [sentinelaTab, setSentinelaTab] = useState<'intel' | 'chat'>('intel');

    const RIGHT_TABS: { key: RightPanel; icon: React.ElementType; label: string }[] = [
        { key: 'detail',    icon: MapPin,        label: 'Detalhe' },
        { key: 'news',      icon: Newspaper,     label: 'News'    },
        { key: 'economic',  icon: BarChart3,     label: 'Econ'    },
        { key: 'analytics', icon: Target,        label: 'Risco'   },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* Scanline overlay */}
            <div className="scanlines" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, opacity: 0.015 }} />

            {/* Top Navigation */}
            <TopBar
                disasterFilter={disasterFilter}
                onFilterChange={setDisasterFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSettingsClick={() => setShowSettings(true)}
                onRefresh={handleRefresh}
                onDonateClick={() => setShowDonate(true)}
                loading={loading}
                eventCount={filteredData.length}
                maxDataDate={maxDataDate}
                analyticsAvailable={analyticsLoaded}
                pipelineStatus={pipelineStatus}
            />

            {/* News Ticker */}
            <NewsTickerBar
                events={filteredData}
                analyticsRiskData={analyticsRiskData}
                totalHistoric={data.length}
            />

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ═══ LEFT SIDEBAR ═══ Event Feed */}
                <aside className="hud-border" style={{
                    width: leftCollapsed ? 44 : 320,
                    background: 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}>
                    {leftCollapsed ? (
                        /* ── Collapsed: small expand button at center ── */
                        <div style={{ flex: 1, position: 'relative' }}>
                            <button
                                onClick={() => setLeftCollapsed(false)}
                                title="Expandir feed"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-primary)',
                                    cursor: 'pointer',
                                    color: 'var(--cyan)',
                                    zIndex: 10,
                                    boxShadow: '0 0 10px rgba(0,212,255,0.2)',
                                }}
                            >
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-primary)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <StatCard title="Total Eventos" value={stats.total} icon={Activity} color="blue" />
                                    <StatCard title="Alerta Crítico" value={stats.critical} icon={Skull} color="red" />
                                    <StatCard title="Afetados" value={stats.totalAffected.toLocaleString('pt-BR')} icon={AlertTriangle} color="amber" />
                                    <StatCard title="UFs Atingidas" value={stats.states} icon={MapPin} color="green" />
                                </div>
                            </div>


                            {/* Event list */}
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Feed de Eventos
                                    </span>
                                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>{filteredData.length}</span>
                                </div>

                                {loading ? (
                                    <div className="font-mono" style={{ padding: 20, textAlign: 'center', fontSize: '0.75rem', color: 'var(--cyan)' }}>
                                        CARREGANDO DADOS...
                                    </div>
                                ) : filteredData.length === 0 ? (
                                    /* Empty state — no events for the selected period */
                                    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                                        <div className="font-mono" style={{ fontSize: '1.5rem', marginBottom: 8, opacity: 0.3 }}>⊘</div>
                                        <p className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                            NENHUM EVENTO ENCONTRADO
                                        </p>
                                        <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                                            {disasterFilter.preset === 'custom'
                                                ? `Período ${disasterFilter.startDate?.slice(0,7) ?? '?'} → ${disasterFilter.endDate?.slice(0,7) ?? '?'} sem registros. Dados disponíveis até ${maxDataDate.slice(0, 7)}.`
                                                : `Período selecionado sem registros. Dados disponíveis de 1991 a ${maxDataDate.slice(0, 7)}.`
                                            }
                                        </p>
                                        <button
                                            onClick={() => setDisasterFilter({ preset: 'all', startDate: null, endDate: null })}
                                            className="btn-tactical"
                                            style={{ color: 'var(--cyan)', borderColor: 'var(--cyan)', margin: '0 auto' }}
                                        >
                                            Ver Todos (HIST)
                                        </button>
                                    </div>
                                ) : (
                                    filteredData.map((event, idx) => (
                                        <div
                                            key={event.id || idx}
                                            onClick={() => handleEventSelect(event)}
                                            className="event-row"
                                            style={{
                                                padding: '10px 12px',
                                                borderBottom: '1px solid var(--border-primary)',
                                                cursor: 'pointer',
                                                background: selectedEvent?.id === event.id ? 'rgba(0,212,255,0.06)' : 'transparent',
                                                borderLeft: selectedEvent?.id === event.id ? '2px solid var(--blue)' : '2px solid transparent',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={(e) => { if (selectedEvent?.id !== event.id) (e.currentTarget.style.background = 'rgba(255,255,255,0.02)'); }}
                                            onMouseLeave={(e) => { if (selectedEvent?.id !== event.id) (e.currentTarget.style.background = 'transparent'); }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h4 className="font-display" style={{
                                                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {event.municipality}
                                                    </h4>
                                                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                        {event.uf} • {event.type}
                                                    </span>
                                                </div>
                                                <RiskBadge severity={event.severity ?? 2} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                                                <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatEventDate(event.date)}</span>
                                                <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--amber)' }}>
                                                    {event.affected?.toLocaleString('pt-BR')} afetados
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Collapse toggle at bottom */}
                            <button
                                onClick={() => setLeftCollapsed(true)}
                                title="Recolher feed"
                                style={{
                                    position: 'absolute',
                                    right: -12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    zIndex: 100,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                                }}
                            >
                                <ChevronLeft style={{ width: 12, height: 12 }} />
                            </button>
                        </>
                    )}
                </aside>

                {/* ═══ CENTER ═══ Globe / Choropleth Map */}
                <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {/* View Toggle */}
                    <ViewToggle
                        activeView={activeView}
                        onToggle={setActiveView}
                        analyticsAvailable={analyticsLoaded}
                    />

                    {/* Globe View (default) */}
                    {activeView === 'globe' && (
                        <Globe
                            data={filteredData}
                            onPointClick={handleEventSelect}
                            selectedEvent={selectedEvent}
                        />
                    )}

                    {/* Choropleth Map View (analytics) */}
                    {activeView === 'map' && (
                        <ChoroplethMap
                            riskData={analyticsRiskData}
                            geojson={analyticsGeoJSON}
                            colorBy={choroplethColorBy}
                            lisaVariable={selectedLisaVariable}
                            lisaClusters={analyticsLISA}
                            selectedMunicipality={selectedMunicipality}
                            onMunicipalityClick={handleMunicipalityClick}
                        />
                    )}

                    {/* Floating status bar */}
                    <div className="font-mono" style={{
                        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 16, alignItems: 'center',
                        padding: '6px 16px',
                        background: 'rgba(6,8,13,0.88)', backdropFilter: 'blur(12px)',
                        border: '1px solid var(--border-primary)',
                        fontSize: '0.65rem', color: 'var(--text-muted)',
                        letterSpacing: '0.05em', zIndex: 10,
                    }}>
                        <span><span style={{ color: 'var(--green)' }}>●</span> SISTEMA ONLINE</span>
                        <span>LAT: -15.79</span>
                        <span>LNG: -47.88</span>
                        <span>ZOOM: 1.0x</span>
                        <span>{new Date().toLocaleTimeString('pt-BR')}</span>
                    </div>
                </main>

                {/* ═══ RIGHT SIDEBAR ═══ Detail/News/Economic/AI/Chat */}
                <aside className="hud-border" style={{
                    width: rightCollapsed ? 44 : 360,
                    background: 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    flexShrink: 0,
                    overflow: 'hidden',
                    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                }}>
                    {rightCollapsed ? (
                        /* ── Collapsed: vertical rail with centered expand button ── */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1, position: 'relative' }}>
                            {/* Expand button - Centered vertically */}
                            <button
                                onClick={() => setRightCollapsed(false)}
                                title="Expandir painel"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-primary)',
                                    cursor: 'pointer',
                                    color: 'var(--cyan)',
                                    zIndex: 10,
                                    boxShadow: '0 0 10px rgba(0,212,255,0.2)',
                                }}
                            >
                                <ChevronLeft style={{ width: 14, height: 14 }} />
                            </button>

                            {/* Tab icons rail (optional, only show if not overlapping expand button) */}
                            <div style={{ marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.6 }}>
                                {RIGHT_TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => { setRightCollapsed(false); setRightPanel(tab.key); }}
                                        title={tab.label}
                                        style={{
                                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: rightPanel === tab.key ? 'rgba(0,212,255,0.1)' : 'none',
                                            border: 'none', cursor: 'pointer',
                                            color: rightPanel === tab.key ? 'var(--cyan)' : 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <tab.icon style={{ width: 13, height: 13 }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Panel Tabs + collapse button */}
                            <div style={{
                                display: 'flex', borderBottom: '1px solid var(--border-primary)',
                                background: 'rgba(0,0,0,0.3)', alignItems: 'stretch',
                            }}>
                                {RIGHT_TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setRightPanel(tab.key)}
                                        className="font-mono"
                                        style={{
                                            flex: 1, padding: '8px 4px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                            border: 'none', cursor: 'pointer',
                                            background: rightPanel === tab.key ? 'rgba(0,212,255,0.08)' : 'transparent',
                                            borderBottom: rightPanel === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
                                            color: rightPanel === tab.key ? 'var(--blue)' : 'var(--text-muted)',
                                            fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <tab.icon style={{ width: 12, height: 12 }} />
                                        {tab.label}
                                    </button>
                                ))}
                                {/* Collapse toggle */}
                                <button
                                    onClick={() => setRightCollapsed(true)}
                                    title="Recolher painel"
                                    style={{
                                        position: 'absolute',
                                        left: -12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: 'var(--bg-panel)',
                                        border: '1px solid var(--border-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        zIndex: 100,
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                    }}
                                >
                                    <ChevronRight style={{ width: 12, height: 12 }} />
                                </button>
                            </div>

                            {/* Panel Content */}
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {rightPanel === 'detail' && (
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                                        {/* Daily Report - 24h (Panorama Global) */}
                                        {insight && (
                                            <div className="hud-border animate-fade-in" style={{
                                                padding: '12px',
                                                background: 'rgba(255, 94, 58, 0.03)',
                                                borderLeft: '3px solid var(--primary)',
                                                marginBottom: 20,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                    <Shield style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                                                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                                        Daily Report - 24h
                                                    </span>
                                                </div>
                                                <div className="prose prose-tactical font-body" style={{ fontSize: '0.72rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                                                    {insight}
                                                </div>
                                                <div style={{ marginTop: 8, textAlign: 'right' }}>
                                                    <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                                                        REFRESH: 1H INTEGRITY CHECK OK
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {selectedEvent ? (
                                            <div className="animate-fade-in">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                    <div>
                                                        <h2 className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: 4 }}>
                                                            {selectedEvent.municipality}
                                                        </h2>
                                                        <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                                            {selectedEvent.uf} • {selectedEvent.type}
                                                        </p>
                                                    </div>
                                                    <RiskBadge severity={selectedEvent.severity ?? 2} size="lg" />
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                                    <div className="hud-border" style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
                                                        <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data</span>
                                                        <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatEventDate(selectedEvent.date)}</div>
                                                    </div>
                                                    <div className="hud-border" style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
                                                        <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Afetados</span>
                                                        <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{selectedEvent.affected?.toLocaleString('pt-BR')}</div>
                                                    </div>
                                                </div>

                                                {/* Quick action buttons */}
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button onClick={() => setRightPanel('news')} className="btn-tactical" style={{ flex: 1, justifyContent: 'center' }}>
                                                        <Newspaper style={{ width: 11, height: 11 }} /> Validar
                                                    </button>
                                                    <button onClick={() => setRightPanel('economic')} className="btn-tactical" style={{ flex: 1, justifyContent: 'center' }}>
                                                        <BarChart3 style={{ width: 11, height: 11 }} /> Impacto
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="font-mono" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                                {'>'} SELECIONE UM EVENTO NO MAPA OU NA LISTA
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'news' && (
                                    <ValidationFeed
                                        articles={newsArticles}
                                        loading={newsLoading}
                                        eventName={selectedEvent ? `${selectedEvent.municipality} — ${selectedEvent.type}` : undefined}
                                    />
                                )}

                                {rightPanel === 'economic' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        {selectedMunicipalityRisk && (
                                            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn-tactical"
                                                    onClick={() => setShowEconDashboard(true)}
                                                    style={{ fontSize: '0.68rem', gap: 4 }}
                                                >
                                                    <BarChart3 style={{ width: 11, height: 11 }} /> Dashboard Completo
                                                </button>
                                            </div>
                                        )}
                                        <EconomicImpactChart
                                            indicators={economicData.indicators}
                                            comex={economicData.comex}
                                            aftermath={economicData.aftermath}
                                            loading={econLoading}
                                            socioeconomico={selectedMunicipalityRisk?.socioeconomico}
                                            municipalityName={selectedMunicipalityRisk?.name}
                                            municipalityRisk={selectedMunicipalityRisk ?? undefined}
                                            eventType={selectedEvent?.type}
                                        />
                                    </div>
                                )}

                                {rightPanel === 'analytics' && (
                                    <AnalyticsPanel
                                        riskData={analyticsRiskData}
                                        distributions={analyticsDistributions}
                                        lisaVariables={lisaVariables}
                                        selectedLisaVariable={selectedLisaVariable}
                                        onLisaVariableChange={setSelectedLisaVariable}
                                        colorBy={choroplethColorBy}
                                        onColorByChange={(mode: ChoroplethColorBy) => {
                                            setChoroplethColorBy(mode);
                                            if (activeView !== 'map') setActiveView('map');
                                        }}
                                        onMunicipalityClick={handleMunicipalityClick}
                                    />
                                )}

                            </div>
                        </>
                    )}
                </aside>
            </div>

            {/* Modals */}
            <SettingsModal 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)}
                onRefresh={handleSettingsRefresh}
                onImport={handleSettingsImport}
                loading={settingsLoading}
                collectionStatus={collectionStatus}
            />
            <DonationModal isOpen={showDonate} onClose={() => setShowDonate(false)} />
            {showEconDashboard && selectedMunicipalityRisk && (
                <EconDashboardModal
                    isOpen={showEconDashboard}
                    onClose={() => setShowEconDashboard(false)}
                    municipalityRisk={selectedMunicipalityRisk}
                    socioeconomico={selectedMunicipalityRisk.socioeconomico}
                    danos={selectedMunicipalityRisk.danos}
                    aftermath={economicData.aftermath}
                    eventType={selectedEvent?.type}
                    onOpenOracle={() => { setShowEconDashboard(false); setShowSentinela(true); }}
                />
            )}

            {/* ── Sentinela Floating Button ── */}
            <button
                onClick={() => setShowSentinela(s => !s)}
                title="Sentinela — IA Tática"
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--amber) 0%, #ff6b00 100%)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.5)',
                    color: '#000',
                }}
            >
                <Sparkles style={{ width: 20, height: 20 }} />
            </button>

            {/* ── Sentinela Slide-out Panel ── */}
            {showSentinela && (
                <div style={{
                    position: 'fixed', bottom: 84, right: 24, zIndex: 1200,
                    width: 380, height: '70vh',
                    background: 'var(--bg-panel)', border: '1px solid var(--border-primary)',
                    borderRadius: 8, display: 'flex', flexDirection: 'column',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-elevated)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles style={{ width: 14, height: 14, color: 'var(--amber)' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.08em' }}>SENTINELA</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>IA Tática Skyvidya</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button
                                onClick={() => setSentinelaTab('intel')}
                                style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', background: sentinelaTab === 'intel' ? 'var(--amber)' : 'transparent', color: sentinelaTab === 'intel' ? '#000' : 'var(--text-muted)' }}
                            >Intel</button>
                            <button
                                onClick={() => setSentinelaTab('chat')}
                                style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', background: sentinelaTab === 'chat' ? 'var(--cyan)' : 'transparent', color: sentinelaTab === 'chat' ? '#000' : 'var(--text-muted)' }}
                            >Chat</button>
                            <button onClick={() => setShowSentinela(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                <X style={{ width: 14, height: 14 }} />
                            </button>
                        </div>
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        {sentinelaTab === 'intel' ? (
                            <TacticalAI
                                data={filteredData}
                                analyticsContext={analyticsLoaded ? { riskData: analyticsRiskData, distributions: analyticsDistributions || undefined } as OracleAnalyticsContext : undefined}
                            />
                        ) : (
                            <TacticalChat />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;