import React from 'react';

interface RiskBadgeProps {
    severity: 1 | 2 | 3 | 4 | 5;
    size?: 'sm' | 'md' | 'lg';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ severity, size = 'sm' }) => {
    const sizeMap = {
        sm: { fontSize: '0.625rem', padding: '1px 6px', minWidth: 24 },
        md: { fontSize: '0.7rem',   padding: '2px 8px', minWidth: 28 },
        lg: { fontSize: '0.8rem',   padding: '3px 10px', minWidth: 32 },
    };

    const s = sizeMap[size];

    return (
        <span
            className={`severity-s${severity} font-mono`}
            style={{
                ...s,
                fontWeight: 700,
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: s.minWidth,
                borderRadius: 2,
            }}
        >
            S{severity}
        </span>
    );
};

export default RiskBadge;
