import React, { useState, useEffect, useMemo } from 'react';
import {
    AlertTriangle, Activity, MapPin, Shield, Skull,
    ChevronRight, Newspaper, BarChart3, Radio,
    Sparkles, MessageSquare, Target, Search,
} from 'lucide-react';

import Globe from './components/Globe';
import StatCard from './components/StatCard';
import TopBar from './components/TopBar';
import RiskBadge from './components/RiskBadge';
import ValidationFeed from './components/ValidationFeed';
import EconomicImpactChart from './components/EconomicImpactChart';
import TacticalAI from './components/TacticalAI';
import TacticalChat from './components/TacticalChat';
import DonationModal from './components/DonationModal';
import ImportModal from './components/ImportModal';
import ChoroplethMap from './components/ChoroplethMap';
import ViewToggle from './components/ViewToggle';
import AnalyticsPanel from './components/AnalyticsPanel';
import GeoRAGChat from './components/GeoRAGChat';

import { DisasterDecree, DisasterFilter, NewsArticle, EconomicIndicator, ComexData } from './types';
import { fetchRealDisasters, generateInsight, fetchEventNews, fetchEconomicImpact, formatEventDate, OracleAnalyticsContext } from './services/geminiService';
import {
    fetchRiskData, fetchDistributions, fetchMunicipalityGeoJSON, fetchLISAClusters,
    triggerAnalyticsPipeline, clearGeoJSONCache,
} from './services/analyticsService';
import type {
    MunicipalityRisk, AnalyticsDistributions, GeoJSONCollection, LISAClusterData, ChoroplethColorBy,
} from './analyticsTypes';

type RightPanel = 'detail' | 'news' | 'economic' | 'ai' | 'chat' | 'analytics' | 'georag';

const App: React.FC = () => {
    // ── Core State ──
    const [data, setData] = useState<DisasterDecree[]>([]);
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState<string>('');

    // ── Filters ──
    const [disasterFilter, setDisasterFilter] = useState<DisasterFilter>({ startDate: null, endDate: null, preset: 'all' });
    const [searchQuery, setSearchQuery] = useState('');

    // ── Selection ──
    const [selectedEvent, setSelectedEvent] = useState<DisasterDecree | null>(null);

    // ── Panels ──
    const [rightPanel, setRightPanel] = useState<RightPanel>('detail');
    const [leftCollapsed, setLeftCollapsed] = useState(false);

    // ── Modals ──
    const [showImport, setShowImport] = useState(false);
    const [showDonate, setShowDonate] = useState(false);

    // ── Event Data ──
    const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(false);
    const [economicData, setEconomicData] = useState<{ indicators: EconomicIndicator[]; comex: ComexData[] }>({ indicators: [], comex: [] });
    const [econLoading, setEconLoading] = useState(false);

    // ── Analytics State ──
    const [activeView, setActiveView] = useState<'globe' | 'map'>('globe');
    const [analyticsRiskData, setAnalyticsRiskData] = useState<MunicipalityRisk[]>([]);
    const [analyticsDistributions, setAnalyticsDistributions] = useState<AnalyticsDistributions | null>(null);
    const [analyticsGeoJSON, setAnalyticsGeoJSON] = useState<GeoJSONCollection | null>(null);
    const [analyticsLISA, setAnalyticsLISA] = useState<LISAClusterData | null>(null);
    const [choroplethColorBy, setChoroplethColorBy] = useState<ChoroplethColorBy>('riskCategory');
    const [selectedLisaVariable, setSelectedLisaVariable] = useState<string>('LAST10_YEARS_COUNT');
    const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
    const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
    const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);

    // ── Load Data ──
    const loadData = async (filter?: DisasterFilter) => {
        const f = filter ?? disasterFilter;
        setLoading(true);
        try {
            const result = await fetchRealDisasters({
                startDate: f.startDate,
                endDate: f.endDate,
            });
            setData(result);
            const intel = await generateInsight(result);
            setInsight(intel);
        } catch (e) {
            console.error('Data fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(disasterFilter); }, [disasterFilter]);

    // ── Filter Data (client-side: search only; date filtering is server-side) ──
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.toLowerCase();
        return data.filter((d) =>
            d.municipality.toLowerCase().includes(q) ||
            d.uf.toLowerCase().includes(q) ||
            d.type.toLowerCase().includes(q)
        );
    }, [data, searchQuery]);

    // ── Stats ──
    const stats = useMemo(() => {
        const total = filteredData.length;
        const critical = filteredData.filter(d => (d.severity ?? 0) >= 4).length;
        const totalAffected = filteredData.reduce((sum, d) => sum + (d.affected || 0), 0);
        const statesSet = new Set(filteredData.map(d => d.uf));
        return { total, critical, totalAffected, states: statesSet.size };
    }, [filteredData]);

    // ── Event Selection Handler ──
    const handleEventSelect = async (event: DisasterDecree) => {
        setSelectedEvent(event);
        setRightPanel('detail');

        // Fetch news validation
        setNewsLoading(true);
        try {
            const news = await fetchEventNews(event);
            setNewsArticles(news);
        } catch { setNewsArticles([]); }
        finally { setNewsLoading(false); }

        // Fetch economic impact
        setEconLoading(true);
        try {
            const econ = await fetchEconomicImpact(event);
            setEconomicData(econ);
        } catch { setEconomicData({ indicators: [], comex: [] }); }
        finally { setEconLoading(false); }
    };

    // ── Import Handler ──
    const handleImport = (imported: DisasterDecree[]) => {
        setData(prev => [...imported, ...prev]);
    };

    // ── Analytics Data Loading (lazy - loads when analytics tab or map view activated) ──
    const loadAnalyticsData = async () => {
        if (analyticsLoaded) return;
        try {
            const [risk, dist, geo] = await Promise.all([
                fetchRiskData().catch(() => []),
                fetchDistributions().catch(() => null),
                fetchMunicipalityGeoJSON().catch(() => null),
            ]);
            setAnalyticsRiskData(risk);
            setAnalyticsDistributions(dist);
            setAnalyticsGeoJSON(geo);
            if (risk.length > 0) setAnalyticsLoaded(true);

            // Load LISA data in background
            fetchLISAClusters().then(setAnalyticsLISA).catch(() => {});
        } catch (e) {
            console.error('Analytics data fetch failed:', e);
        }
    };

    useEffect(() => {
        if (activeView === 'map' || rightPanel === 'analytics' || rightPanel === 'georag') {
            loadAnalyticsData();
        }
    }, [activeView, rightPanel]);

    // ── Refresh Analytics Pipeline ──
    const handleRefreshAnalytics = async () => {
        setAnalyticsRefreshing(true);
        try {
            await triggerAnalyticsPipeline();
            // Reset cache and reload
            clearGeoJSONCache();
            setAnalyticsLoaded(false);
            await loadAnalyticsData();
        } catch (e) {
            console.error('Analytics pipeline trigger failed:', e);
        } finally {
            setAnalyticsRefreshing(false);
        }
    };

    // ── Analytics Municipality Click Handler ──
    const handleMunicipalityClick = (municipality: MunicipalityRisk) => {
        setSelectedMunicipality(municipality.cd_mun);
        setRightPanel('analytics');
    };

    // ── LISA variables list ──
    const lisaVariables = useMemo(() => {
        if (!analyticsLISA) return [];
        return Object.keys(analyticsLISA.variables);
    }, [analyticsLISA]);

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
                onImportClick={() => setShowImport(true)}
                onRefresh={() => loadData(disasterFilter)}
                onDonateClick={() => setShowDonate(true)}
                loading={loading}
                eventCount={filteredData.length}
                analyticsAvailable={analyticsLoaded}
                onRefreshAnalytics={handleRefreshAnalytics}
                analyticsRefreshing={analyticsRefreshing}
            />

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ═══ LEFT SIDEBAR ═══ Event Feed */}
                <aside className="hud-border" style={{
                    width: leftCollapsed ? 44 : 320,
                    background: 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    transition: 'width 0.3s ease',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}>
                    {!leftCollapsed && (
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

                            {/* Intel Brief */}
                            {insight && (
                                <div style={{
                                    padding: '10px 12px', borderBottom: '1px solid var(--border-primary)',
                                    maxHeight: 120, overflowY: 'auto',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Shield style={{ width: 12, height: 12, color: 'var(--amber)' }} />
                                        <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                            Intel Brief
                                        </span>
                                    </div>
                                    <p className="prose prose-tactical font-body" style={{ maxWidth: 'none', whiteSpace: 'pre-wrap' }}>
                                        {insight.substring(0, 400)}{insight.length > 400 ? '...' : ''}
                                    </p>
                                </div>
                            )}

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
                        </>
                    )}

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setLeftCollapsed(!leftCollapsed)}
                        style={{
                            padding: '8px', borderTop: '1px solid var(--border-primary)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', justifyContent: 'center',
                        }}
                    >
                        <ChevronRight style={{
                            width: 14, height: 14, color: 'var(--text-muted)',
                            transform: leftCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                            transition: 'transform 0.3s',
                        }} />
                    </button>
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
                    width: 360,
                    background: 'var(--bg-panel)',
                    display: 'flex', flexDirection: 'column',
                    flexShrink: 0,
                    overflow: 'hidden',
                }}>
                    {/* Panel Tabs */}
                    <div style={{
                        display: 'flex', borderBottom: '1px solid var(--border-primary)',
                        background: 'rgba(0,0,0,0.3)',
                    }}>
                        {([
                            { key: 'detail' as const, icon: MapPin, label: 'Detalhe' },
                            { key: 'news' as const, icon: Newspaper, label: 'News' },
                            { key: 'economic' as const, icon: BarChart3, label: 'Econ' },
                            { key: 'ai' as const, icon: Sparkles, label: 'Oracle' },
                            { key: 'chat' as const, icon: MessageSquare, label: 'Comms' },
                            { key: 'analytics' as const, icon: Target, label: 'Risco' },
                            { key: 'georag' as const, icon: Search, label: 'GeoRAG' },
                        ]).map(tab => (
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
                                    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <tab.icon style={{ width: 13, height: 13 }} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Panel Content */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {rightPanel === 'detail' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
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
                                            <div className="hud-border" style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
                                                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                                                <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--cyan)', fontWeight: 600 }}>{selectedEvent.status}</div>
                                            </div>
                                            <div className="hud-border" style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
                                                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coordenadas</span>
                                                <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                    {(selectedEvent.lat ?? 0).toFixed(2)}, {(selectedEvent.lng ?? 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick action buttons */}
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => setRightPanel('news')} className="btn-tactical" style={{ flex: 1, justifyContent: 'center' }}>
                                                <Newspaper style={{ width: 12, height: 12 }} /> Validar
                                            </button>
                                            <button onClick={() => setRightPanel('economic')} className="btn-tactical" style={{ flex: 1, justifyContent: 'center' }}>
                                                <BarChart3 style={{ width: 12, height: 12 }} /> Impacto
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
                            <EconomicImpactChart
                                indicators={economicData.indicators}
                                comex={economicData.comex}
                                loading={econLoading}
                            />
                        )}

                        {rightPanel === 'ai' && (
                            <TacticalAI
                                data={filteredData}
                                analyticsContext={analyticsLoaded ? { riskData: analyticsRiskData, distributions: analyticsDistributions || undefined } as OracleAnalyticsContext : undefined}
                            />
                        )}
                        {rightPanel === 'chat' && <TacticalChat />}

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

                        {rightPanel === 'georag' && (
                            <GeoRAGChat
                                onMunicipalityClick={(mun: MunicipalityRisk) => {
                                    handleMunicipalityClick(mun);
                                    if (activeView !== 'map') setActiveView('map');
                                }}
                            />
                        )}
                    </div>
                </aside>
            </div>

            {/* Modals */}
            <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />
            <DonationModal isOpen={showDonate} onClose={() => setShowDonate(false)} />
        </div>
    );
};

export default App;