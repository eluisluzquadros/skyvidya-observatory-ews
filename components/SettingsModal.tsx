import React from 'react';
import { X, RefreshCw, Database, Shield, Download, Mail, Server, Activity } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onImport: (type: string) => void;
    loading: boolean;
    collectionStatus: any[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, onRefresh, onImport, loading, collectionStatus
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '20px'
        }} onClick={onClose}>
            <div className="hud-border" style={{
                width: '100%', maxWidth: '600px', background: 'var(--bg-card)',
                position: 'relative', overflow: 'hidden', padding: 0
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Database style={{ width: 18, height: 18, color: 'var(--primary)' }} />
                        <span className="font-brand" style={{ letterSpacing: '0.1em', fontSize: '0.9rem' }}>CONFIGURAÇÕES DO SISTEMA</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X style={{ width: 20, height: 20 }} />
                    </button>
                </div>

                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    
                    {/* Data Section */}
                    <section>
                        <h3 className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '4px' }}>
                            CONTROLE DE DADOS (INGESTÃO)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button className="btn-tactical primary" onClick={onRefresh} disabled={loading} style={{ height: '40px', justifyContent: 'center' }}>
                                <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                <span>Sincronizar Agora</span>
                            </button>
                            <button className="btn-tactical" onClick={() => onImport('s2id')} disabled={loading} style={{ height: '40px', justifyContent: 'center' }}>
                                <Download style={{ width: 14, height: 14 }} />
                                <span>Disparar Scraper S2ID</span>
                            </button>
                        </div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                            A sincronização automática ocorre a cada 6 horas. O disparador manual força uma nova raspagem no site da S2ID.
                        </p>
                    </section>

                    {/* Future Features Section */}
                    <section style={{ opacity: 0.6 }}>
                        <h3 className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '4px' }}>
                            GESTÃO DE ACESSO (EM BREVE)
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div className="hud-border" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                                <Mail style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Autenticação Supabase</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Login com Google / Email corporativo</span>
                                </div>
                                <Shield style={{ width: 14, height: 14, marginLeft: 'auto', color: 'var(--text-dim)' }} />
                            </div>
                            <div className="hud-border" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                                <Server style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Persistência em Banco</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Arquitetura Medallion (Bronze, Silver, Gold)</span>
                                </div>
                                <Activity style={{ width: 14, height: 14, marginLeft: 'auto', color: 'var(--text-dim)' }} />
                            </div>
                        </div>
                    </section>

                    {/* Collection Status */}
                    <section>
                        <h3 className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '4px' }}>
                            STATUS DAS FONTES
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {collectionStatus.map((s, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{s.source.toUpperCase()} - {s.reportType || 'Main'}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ color: s.status === 'success' ? 'var(--green)' : 'var(--red)', fontSize: '0.6rem' }}>
                                            ● {s.status.toUpperCase()}
                                        </span>
                                        <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>
                                            {s.lastSuccess ? new Date(s.lastSuccess).toLocaleString('pt-BR') : 'Sem dados'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px', background: 'rgba(0,0,0,0.3)',
                    borderTop: '1px solid var(--border-primary)',
                    display: 'flex', justifyContent: 'flex-end'
                }}>
                    <button className="btn-tactical" onClick={onClose} style={{ minWidth: 80 }}>
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
