import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'red' | 'amber' | 'purple';
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

const colorMap = {
  green:  { text: 'var(--green)',  border: 'var(--green)',  glow: 'var(--green-glow)',  bg: 'rgba(16,185,129,0.05)' },
  blue:   { text: 'var(--cyan)',   border: 'var(--cyan)',   glow: 'var(--cyan-glow)',   bg: 'rgba(0,212,255,0.05)' },
  red:    { text: 'var(--red)',    border: 'var(--red)',    glow: 'var(--red-glow)',    bg: 'rgba(239,68,68,0.05)' },
  amber:  { text: 'var(--amber)',  border: 'var(--amber)',  glow: 'var(--amber-glow)',  bg: 'rgba(245,158,11,0.05)' },
  purple: { text: 'var(--purple)', border: 'var(--purple)', glow: 'var(--purple-glow)', bg: 'rgba(139,92,246,0.05)' },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtext, trend }) => {
  const c = colorMap[color];

  return (
    <div
      className="stat-shimmer hud-border"
      style={{
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(30px)',
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 16px ${c.glow}, inset 0 0 30px ${c.bg}`,
        padding: '12px 14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner accents */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: 6, borderTop: `1px solid ${c.border}`, borderLeft: `1px solid ${c.border}` }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderTop: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 6, borderBottom: `1px solid ${c.border}`, borderLeft: `1px solid ${c.border}` }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 6, height: 6, borderBottom: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}` }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2, fontWeight: 600 }}>
            {title}
          </p>
          <h3 className="font-display" style={{ fontSize: '1.4rem', color: c.text, fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1.1 }}>
            {value}
          </h3>
          {subtext && (
            <p className="font-mono" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: 2 }}>{subtext}</p>
          )}
          {trend && (
            <p className="font-mono" style={{ fontSize: '0.625rem', marginTop: 2, color: trend.direction === 'up' ? 'var(--red)' : 'var(--green)' }}>
              {trend.direction === 'up' ? '▲' : '▼'} {trend.value}%
            </p>
          )}
        </div>
        <div style={{ padding: 6, border: `1px dashed ${c.border}`, background: 'rgba(0,0,0,0.5)', opacity: 0.8 }}>
          <Icon style={{ width: 16, height: 16, color: c.text }} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
