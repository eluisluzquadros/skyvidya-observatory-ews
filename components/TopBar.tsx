import React, { useState } from 'react';
import { Search, Heart, Terminal, RefreshCw, Activity, Calendar, X, Check } from 'lucide-react';
import { DisasterFilter, FilterPreset } from '../types';

interface TopBarProps {
    disasterFilter: DisasterFilter;
    onFilterChange: (filter: DisasterFilter) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onImportClick: () => void;
    onRefresh: () => void;
    onDonateClick: () => void;
    loading: boolean;
    eventCount: number;
    maxDataDate?: string;
    analyticsAvailable?: boolean;
    onRefreshAnalytics?: () => void;
    analyticsRefreshing?: boolean;
}

const PRESETS: { label: string; id: FilterPreset; months: number | null; title: string }[] = [
    { label: '1A',   id: '1y',  months: 12,  title: 'Último 1 ano' },
    { label: '2A',   id: '2y',  months: 24,  title: 'Últimos 2 anos' },
    { label: '5A',   id: '5y',  months: 60,  title: 'Últimos 5 anos' },
    { label: '10A',  id: '10y', months: 120, title: 'Últimos 10 anos' },
    { label: '20A',  id: '20y', months: 240, title: 'Últimos 20 anos' },
    { label: 'HIST', id: 'all', months: null, title: 'Todo histórico (~30 anos)' },
];

const monthsAgoISO = (months: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
};

const todayISO = () => new Date().toISOString().split('T')[0];

const TopBar: React.FC<TopBarProps> = ({
    disasterFilter, onFilterChange, searchQuery, onSearchChange,
    onImportClick, onRefresh, onDonateClick, loading, eventCount,
    maxDataDate, analyticsAvailable, onRefreshAnalytics, analyticsRefreshing,
}) => {
    const dataMax = maxDataDate ?? '2025-12-31';
    const [customMode, setCustomMode] = useState(disasterFilter.preset === 'custom');
    const [tempStart, setTempStart] = useState(disasterFilter.startDate ?? '');
    const [tempEnd, setTempEnd] = useState(disasterFilter.endDate ?? dataMax);

    const handlePreset = (p: typeof PRESETS[number]) => {
        setCustomMode(false);
        const startDate = p.months ? monthsAgoISO(p.months) : null;
        onFilterChange({ preset: p.id, startDate, endDate: null });
    };

    const handleOpenCustom = () => {
        setTempStart(disasterFilter.startDate ?? '');
        setTempEnd(disasterFilter.endDate ?? dataMax);
        setCustomMode(true);
    };

    const handleApply = () => {
        if (!tempStart) return;
        onFilterChange({ preset: 'custom', startDate: tempStart, endDate: tempEnd || null });
        setCustomMode(false);
    };

    const handleCancelCustom = () => {
        setCustomMode(false);
        // revert to previous non-custom preset if current is custom
        if (disasterFilter.preset === 'custom') {
            onFilterChange({ preset: 'all', startDate: null, endDate: null });
        }
    };

    const activeLabel = disasterFilter.preset === 'custom' && disasterFilter.startDate
        ? `${disasterFilter.startDate.slice(0, 7)} → ${(disasterFilter.endDate ?? todayISO()).slice(0, 7)}`
        : null;

    return (
        <nav className="hud-border" style={{
            borderBottom: '1px solid var(--border-primary)',
            zIndex: 50,
            flexShrink: 0,
        }}>
            <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', height: 52, justifyContent: 'space-between', gap: 10 }}>

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div className="glow-orange" style={{
                        width: 32, height: 32,
                        border: '1px solid var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,94,58,0.06)',
                        position: 'relative',
                    }}>
                        <span className="font-brand" style={{ color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1 }}>⊕</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <h1 className="logo-brand-name">
                            Skyvidya <span className="brand-accent">Observatory</span>
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span className="logo-brand-sub">Early Warning System</span>
                            <span className="logo-ews-badge">EWS</span>
                        </div>
                    </div>
                </div>

                {/* ── Date Range Filter ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <Calendar style={{ width: 12, height: 12, color: 'var(--text-muted)', marginRight: 2, flexShrink: 0 }} title={`Dados disponíveis: 1991 – ${dataMax.slice(0,7)}`} />

                    {!customMode ? (
                        <>
                            {PRESETS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePreset(p)}
                                    className="filter-chip"
                                    title={p.title}
                                    style={disasterFilter.preset === p.id ? {
                                        borderColor: 'var(--primary)',
                                        color: 'var(--primary)',
                                        background: 'rgba(255, 94, 58, 0.1)',
                                        boxShadow: '0 0 8px var(--primary-glow)',
                                    } : {}}
                                >
                                    {p.label}
                                </button>
                            ))}

                            {/* Custom period button */}
                            <button
                                onClick={handleOpenCustom}
                                className="filter-chip"
                                title="Período personalizado com calendário"
                                style={disasterFilter.preset === 'custom' ? {
                                    borderColor: 'var(--cyan)',
                                    color: 'var(--cyan)',
                                    background: 'rgba(0,212,255,0.08)',
                                } : {}}
                            >
                                {activeLabel
                                    ? <span style={{ color: 'var(--cyan)' }}>{activeLabel}</span>
                                    : <Calendar style={{ width: 10, height: 10 }} />
                                }
                            </button>
                        </>
                    ) : (
                        /* Custom date range picker */
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>DE</span>
                            <input
                                type="date"
                                value={tempStart}
                                onChange={e => setTempStart(e.target.value)}
                                max={tempEnd || dataMax}
                                className="tactical-input"
                                style={{ width: 128, colorScheme: 'dark' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>→</span>
                            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ATÉ</span>
                            <input
                                type="date"
                                value={tempEnd}
                                onChange={e => setTempEnd(e.target.value)}
                                min={tempStart || undefined}
                                max={dataMax}
                                className="tactical-input"
                                style={{ width: 128, colorScheme: 'dark' }}
                            />
                            <button
                                onClick={handleApply}
                                disabled={!tempStart}
                                className="btn-tactical"
                                title="Aplicar período"
                                style={{ color: 'var(--green)', borderColor: 'var(--green-dim)', minWidth: 36 }}
                            >
                                <Check style={{ width: 11, height: 11 }} />
                            </button>
                            <button
                                onClick={handleCancelCustom}
                                className="btn-tactical"
                                title="Cancelar"
                                style={{ minWidth: 36 }}
                            >
                                <X style={{ width: 11, height: 11 }} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', flex: '0 1 200px' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Município, UF, tipo..."
                        className="tactical-input input-glow"
                        style={{ width: '100%', paddingLeft: 30, height: 'var(--btn-height-sm)' }}
                    />
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* Event Counter */}
                    <div className="font-mono hud-border" style={{
                        fontSize: '0.65rem', color: 'var(--text-secondary)',
                        padding: '0 12px', height: 'var(--btn-height-sm)',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        {loading
                            ? <span style={{ color: 'var(--cyan)' }}>...</span>
                            : <><span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.7rem' }}>{eventCount.toLocaleString('pt-BR')}</span><span style={{ letterSpacing: '0.06em' }}> EVENTOS</span></>
                        }
                    </div>

                    {/* Analytics Pipeline Status */}
                    <div className="font-mono hud-border" style={{
                        fontSize: '0.55rem', padding: '0 8px',
                        height: 'var(--btn-height-sm)',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: analyticsAvailable ? 'var(--green)' : 'var(--text-muted)',
                        letterSpacing: '0.06em',
                    }}>
                        <Activity style={{ width: 9, height: 9 }} />
                        <span>{analyticsAvailable ? 'MCDA' : 'MCDA OFF'}</span>
                    </div>

                    {/* Refresh Analytics */}
                    {onRefreshAnalytics && (
                        <button
                            onClick={onRefreshAnalytics}
                            className="btn-tactical"
                            disabled={analyticsRefreshing}
                            title="Atualizar Analytics Pipeline"
                            aria-label="Atualizar pipeline analytics"
                            style={{ padding: '0 10px' }}
                        >
                            <RefreshCw style={{
                                width: 11, height: 11,
                                animation: analyticsRefreshing ? 'spin 1s linear infinite' : 'none',
                                color: 'var(--purple)',
                            }} />
                        </button>
                    )}

                    <button onClick={onImportClick} className="btn-tactical primary" aria-label="Importar dados">
                        <Terminal style={{ width: 11, height: 11 }} />
                        <span>Import</span>
                    </button>

                    <button onClick={onRefresh} className="btn-tactical" disabled={loading} title="Atualizar dados" aria-label="Atualizar dados" style={{ padding: '0 10px' }}>
                        <RefreshCw style={{ width: 11, height: 11, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    <button onClick={onDonateClick} className="donate-btn" aria-label="Apoiar o projeto">
                        <Heart style={{ width: 11, height: 11 }} />
                        <span>Apoie</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default TopBar;
