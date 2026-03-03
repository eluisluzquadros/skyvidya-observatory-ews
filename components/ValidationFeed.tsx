import React from 'react';
import { Newspaper, ExternalLink, TrendingDown, TrendingUp, Minus, RefreshCw } from 'lucide-react';
import { NewsArticle } from '../types';

interface ValidationFeedProps {
    articles: NewsArticle[];
    loading: boolean;
    eventName?: string;
}

const sentimentIcon = (s: string) => {
    if (s === 'negative') return <TrendingDown style={{ width: 12, height: 12, color: 'var(--red)' }} />;
    if (s === 'positive') return <TrendingUp style={{ width: 12, height: 12, color: 'var(--green)' }} />;
    return <Minus style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />;
};

const sentimentLabel = (s: string) => {
    if (s === 'negative') return { text: 'NEGATIVO', color: 'var(--red)' };
    if (s === 'positive') return { text: 'POSITIVO', color: 'var(--green)' };
    return { text: 'NEUTRO', color: 'var(--text-muted)' };
};

const ValidationFeed: React.FC<ValidationFeedProps> = ({ articles, loading, eventName }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border-primary)',
                background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Newspaper style={{ width: 14, height: 14, color: 'var(--blue)' }} />
                    <h3 className="font-mono" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--blue)', fontWeight: 700 }}>
                        Validação Jornalística
                    </h3>
                </div>
                <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>
                    {articles.length} FONTES
                </span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, justifyContent: 'center' }}>
                        <RefreshCw style={{ width: 14, height: 14, color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                        <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>BUSCANDO EVIDÊNCIAS...</span>
                    </div>
                ) : articles.length === 0 ? (
                    <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                        {'>'} SELECIONE UM EVENTO PARA VALIDAÇÃO
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {eventName && (
                            <div className="font-mono" style={{
                                fontSize: '0.55rem', color: 'var(--green)', padding: '6px 10px',
                                background: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.15)',
                                marginBottom: 4,
                            }}>
                                {'>'} VALIDANDO: <span style={{ color: 'white' }}>{eventName}</span>
                            </div>
                        )}
                        {articles.map((article, idx) => {
                            const sent = sentimentLabel(article.sentiment);
                            return (
                                <div
                                    key={article.id || idx}
                                    className="news-card animate-fade-in"
                                    style={{
                                        padding: '10px 12px',
                                        animationDelay: `${idx * 80}ms`,
                                        animationFillMode: 'both',
                                    }}
                                >
                                    {/* Source + Sentiment */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {article.source}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {sentimentIcon(article.sentiment)}
                                            <span className="font-mono" style={{ fontSize: '0.45rem', color: sent.color }}>{sent.text}</span>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h4 className="font-display" style={{
                                        fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600,
                                        lineHeight: 1.3, marginBottom: 6,
                                    }}>
                                        {article.title}
                                    </h4>

                                    {/* Snippet */}
                                    <p className="font-body" style={{
                                        fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8,
                                    }}>
                                        {article.snippet}
                                    </p>

                                    {/* Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>
                                            {new Date(article.publishedAt).toLocaleDateString('pt-BR')}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <div style={{
                                                width: 28, height: 4, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    width: `${article.relevanceScore * 100}%`, height: '100%',
                                                    background: `linear-gradient(90deg, var(--green-dim), var(--green))`,
                                                    borderRadius: 2,
                                                }} />
                                            </div>
                                            <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--green)' }}>
                                                {Math.round(article.relevanceScore * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationFeed;
