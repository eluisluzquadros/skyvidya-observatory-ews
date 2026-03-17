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
    analyticsAvailable, onRefreshAnalytics, analyticsRefreshing,
}) => {
    const [customMode, setCustomMode] = useState(disasterFilter.preset === 'custom');
    const [tempStart, setTempStart] = useState(disasterFilter.startDate ?? '');
    const [tempEnd, setTempEnd] = useState(disasterFilter.endDate ?? todayISO());

    const handlePreset = (p: typeof PRESETS[number]) => {
        setCustomMode(false);
        const startDate = p.months ? monthsAgoISO(p.months) : null;
        onFilterChange({ preset: p.id, startDate, endDate: null });
    };

    const handleOpenCustom = () => {
        setTempStart(disasterFilter.startDate ?? '');
        setTempEnd(disasterFilter.endDate ?? todayISO());
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
            <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', height: 48, justifyContent: 'space-between', gap: 12 }}>

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div className="glow-orange" style={{
                        width: 30, height: 30,
                        border: '1px solid var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--bg-primary)',
                    }}>
                        <span className="font-display" style={{ color: 'var(--primary)', fontSize: '1rem', fontWeight: 700 }}>⊕</span>
                    </div>
                    <div>
                        <h1 className="font-display" style={{
                            fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.15em',
                            color: 'white', textTransform: 'uppercase', lineHeight: 1,
                        }}>
                            S2ID <span style={{ color: 'var(--primary)' }}>Command</span>
                        </h1>
                        <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                            CENTRO INTEGRADO DE COMANDO
                        </p>
                    </div>
                </div>

                {/* ── Date Range Filter ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <Calendar style={{ width: 12, height: 12, color: 'var(--text-muted)', marginRight: 2, flexShrink: 0 }} />

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
                                max={tempEnd || todayISO()}
                                className="tactical-input"
                                style={{ width: 132, fontSize: '0.65rem', colorScheme: 'dark', padding: '3px 8px' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>→</span>
                            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>ATÉ</span>
                            <input
                                type="date"
                                value={tempEnd}
                                onChange={e => setTempEnd(e.target.value)}
                                min={tempStart || undefined}
                                max={todayISO()}
                                className="tactical-input"
                                style={{ width: 132, fontSize: '0.65rem', colorScheme: 'dark', padding: '3px 8px' }}
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
                <div style={{ position: 'relative', flex: '0 1 220px' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Município, UF, tipo..."
                        className="tactical-input input-glow"
                        style={{ width: '100%', paddingLeft: 28, fontSize: '0.7rem' }}
                    />
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Event Counter */}
                    <div className="font-mono hud-border" style={{
                        fontSize: '0.7rem', color: 'var(--text-secondary)',
                        padding: '4px 10px',
                    }}>
                        {loading
                            ? <span style={{ color: 'var(--cyan)' }}>...</span>
                            : <><span style={{ color: 'var(--primary)', fontWeight: 700 }}>{eventCount.toLocaleString('pt-BR')}</span> EVENTOS</>
                        }
                    </div>

                    {/* Analytics Pipeline Status */}
                    <div className="font-mono hud-border" style={{
                        fontSize: '0.65rem', padding: '4px 8px',
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: analyticsAvailable ? 'var(--green)' : 'var(--text-muted)',
                    }}>
                        <Activity style={{ width: 10, height: 10 }} />
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
                        >
                            <RefreshCw style={{
                                width: 12, height: 12,
                                animation: analyticsRefreshing ? 'spin 1s linear infinite' : 'none',
                                color: 'var(--purple)',
                            }} />
                        </button>
                    )}

                    <button onClick={onImportClick} className="btn-tactical primary" aria-label="Importar dados">
                        <Terminal style={{ width: 12, height: 12 }} />
                        <span>Import</span>
                    </button>

                    <button onClick={onRefresh} className="btn-tactical" disabled={loading} title="Atualizar dados" aria-label="Atualizar dados">
                        <RefreshCw style={{ width: 12, height: 12, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    <button onClick={onDonateClick} className="donate-btn" aria-label="Apoiar o projeto" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Heart style={{ width: 12, height: 12 }} />
                        <span>Apoie</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default TopBar;
