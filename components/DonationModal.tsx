import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Copy, Check, QrCode } from 'lucide-react';

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
    const [copied, setCopied] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const pixKey = 'contato@s2id-command.com.br';

    useEffect(() => {
        if (isOpen) closeRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(pixKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* noop */ }
    };

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Apoie o Projeto"
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                aria-hidden="true"
                style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
                }}
            />

            {/* Modal */}
            <div className="animate-fade-in" style={{
                position: 'relative', width: 360,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--green-dim)',
                boxShadow: '0 0 40px rgba(0,255,65,0.08), 0 20px 60px rgba(0,0,0,0.6)',
                overflow: 'hidden',
            }}>
                {/* Scanline effect */}
                <div className="scanlines" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04 }} />

                {/* Corner accents */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderTop: '2px solid var(--green)', borderLeft: '2px solid var(--green)' }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderTop: '2px solid var(--green)', borderRight: '2px solid var(--green)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: 16, height: 16, borderBottom: '2px solid var(--green)', borderLeft: '2px solid var(--green)' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderBottom: '2px solid var(--green)', borderRight: '2px solid var(--green)' }} />

                {/* Header */}
                <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36,
                            background: 'linear-gradient(135deg, rgba(0,255,65,0.15), rgba(0,212,255,0.15))',
                            border: '1px solid var(--green-dim)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Heart style={{ width: 18, height: 18, color: 'var(--green)' }} />
                        </div>
                        <div>
                            <h2 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>
                                Apoie o Projeto
                            </h2>
                            <p className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Me pague um café ☕
                            </p>
                        </div>
                    </div>
                    <button
                        ref={closeRef}
                        onClick={onClose}
                        aria-label="Fechar modal"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                        <X style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 24px 24px' }}>
                    <p className="font-body" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                        O S2ID Command é um projeto open-source de inteligência para monitoramento de desastres.
                        Sua contribuição ajuda a manter os servidores e a IA funcionando.
                    </p>

                    {/* PIX Section */}
                    <div style={{
                        padding: 16, background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        marginBottom: 16,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <QrCode style={{ width: 14, height: 14, color: 'var(--green)' }} />
                            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Chave PIX
                            </span>
                        </div>

                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-secondary)',
                        }}>
                            <code className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-primary)', flex: 1, wordBreak: 'break-all' }}>
                                {pixKey}
                            </code>
                            <button
                                onClick={handleCopy}
                                style={{
                                    background: copied ? 'rgba(0,255,65,0.15)' : 'rgba(0,212,255,0.1)',
                                    border: `1px solid ${copied ? 'var(--green)' : 'var(--blue)'}`,
                                    cursor: 'pointer', padding: '4px 8px',
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {copied ? <Check style={{ width: 12, height: 12, color: 'var(--green)' }} /> : <Copy style={{ width: 12, height: 12, color: 'var(--blue)' }} />}
                                <span className="font-mono" style={{ fontSize: '0.625rem', color: copied ? 'var(--green)' : 'var(--blue)' }}>
                                    {copied ? 'COPIADO' : 'COPIAR'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Suggested amounts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[5, 15, 50].map((amount) => (
                            <button
                                key={amount}
                                className="btn-tactical"
                                style={{
                                    padding: '10px 0',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                    border: '1px solid var(--border-secondary)',
                                    background: 'var(--bg-card)',
                                }}
                            >
                                <span className="font-display" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--green)' }}>R${amount}</span>
                                <span className="font-mono" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                    {amount === 5 ? 'Café' : amount === 15 ? 'Lanche' : 'Servidor'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DonationModal;
