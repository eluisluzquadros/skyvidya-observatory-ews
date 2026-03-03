import React from 'react';
import { Search, Clock, Coffee, Heart, Terminal, RefreshCw } from 'lucide-react';
import { TimeRange } from '../types';

interface TopBarProps {
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onImportClick: () => void;
    onRefresh: () => void;
    onDonateClick: () => void;
    loading: boolean;
    eventCount: number;
}

const TIME_RANGES: { label: string; value: TimeRange }[] = [
    { label: '1H', value: '1h' },
    { label: '3H', value: '3h' },
    { label: '6H', value: '6h' },
    { label: '12H', value: '12h' },
    { label: '24H', value: '24h' },
    { label: '48H', value: '48h' },
    { label: '7D', value: '7d' },
    { label: 'ALL', value: 'all' },
];

const TopBar: React.FC<TopBarProps> = ({
    timeRange, onTimeRangeChange, searchQuery, onSearchChange,
    onImportClick, onRefresh, onDonateClick, loading, eventCount,
}) => {
    return (
        <nav className="hud-border" style={{
            borderBottom: '1px solid var(--border-primary)',
            zIndex: 50,
            flexShrink: 0,
        }}>
            <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', height: 48, justifyContent: 'space-between', gap: 16 }}>

                {/* Logo + Title */}
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
                        <p className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                            CENTRO INTEGRADO DE COMANDO
                        </p>
                    </div>
                </div>

                {/* Time Range Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Clock style={{ width: 12, height: 12, color: 'var(--text-muted)', marginRight: 6 }} />
                    {TIME_RANGES.map(t => (
                        <button
                            key={t.value}
                            onClick={() => onTimeRangeChange(t.value)}
                            className="filter-chip"
                            style={timeRange === t.value ? {
                                borderColor: 'var(--primary)',
                                color: 'var(--primary)',
                                background: 'rgba(255, 94, 58, 0.08)',
                                boxShadow: '0 0 8px var(--primary-glow)',
                            } : {}}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', flex: '0 1 240px' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar municípios, UF, tipo..."
                        className="tactical-input input-glow"
                        style={{ width: '100%', paddingLeft: 30 }}
                    />
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Event Counter */}
                    <div className="font-mono hud-border" style={{
                        fontSize: '0.6rem', color: 'var(--text-secondary)',
                        padding: '4px 10px',
                    }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{eventCount}</span> EVENTOS
                    </div>

                    <button onClick={onImportClick} className="btn-tactical primary">
                        <Terminal style={{ width: 12, height: 12 }} />
                        <span>Import</span>
                    </button>

                    <button onClick={onRefresh} className="btn-tactical" disabled={loading}>
                        <RefreshCw style={{ width: 12, height: 12, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    <button onClick={onDonateClick} className="donate-btn" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Heart style={{ width: 12, height: 12 }} />
                        <span>Apoie</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default TopBar;
