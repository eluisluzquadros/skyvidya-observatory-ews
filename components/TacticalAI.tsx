import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { DisasterDecree } from '../types';
import { chatWithAI, OracleAnalyticsContext } from '../services/geminiService';

interface TacticalAIProps {
  data: DisasterDecree[];
  analyticsContext?: OracleAnalyticsContext;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const TacticalAI: React.FC<TacticalAIProps> = ({ data, analyticsContext }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '> ORACLE ONLINE\n\nSistema de inteligência operacional ativo. Pronto para análise tática de desastres, correlação econômica e avaliação de risco.\n\nComandos sugeridos:\n• "SITREP" — Relatório de situação atual\n• "ANÁLISE [UF]" — Análise regional\n• "RISCO [município]" — Avaliação de risco local',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAI(input, data, analyticsContext);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '> ERRO: Falha na conexão com o núcleo de inteligência.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border-primary)',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 22, height: 22,
          background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,212,255,0.2))',
          border: '1px solid var(--purple)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles style={{ width: 12, height: 12, color: 'var(--purple)' }} />
        </div>
        <div>
          <h3 className="font-mono" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--purple)', fontWeight: 700 }}>
            Command Oracle
          </h3>
          <span className="font-mono" style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>
            GEMINI 2.5 • TACTICAL INTELLIGENCE
          </span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="animate-fade-in"
            style={{
              display: 'flex', gap: 8,
              alignItems: 'flex-start',
              animationDelay: `${idx * 40}ms`,
            }}
          >
            <div style={{
              width: 20, height: 20, flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${msg.role === 'assistant' ? 'var(--purple)' : 'var(--green-dim)'}`,
              background: msg.role === 'assistant' ? 'rgba(168,85,247,0.1)' : 'rgba(0,255,65,0.06)',
            }}>
              {msg.role === 'assistant'
                ? <Bot style={{ width: 10, height: 10, color: 'var(--purple)' }} />
                : <User style={{ width: 10, height: 10, color: 'var(--green)' }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span className="font-mono" style={{
                  fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase',
                  color: msg.role === 'assistant' ? 'var(--purple)' : 'var(--green)',
                }}>
                  {msg.role === 'assistant' ? 'ORACLE' : 'OPERADOR'}
                </span>
                <span className="font-mono" style={{ fontSize: '0.4rem', color: 'var(--text-muted)' }}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="font-body" style={{
                fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <Loader2 style={{ width: 14, height: 14, color: 'var(--purple)', animation: 'spin 1s linear infinite' }} />
            <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--purple)' }}>PROCESSANDO CONSULTA...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid var(--border-primary)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Consultar Oracle..."
            className="tactical-input"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="btn-tactical primary"
            style={{ flexShrink: 0 }}
          >
            <Send style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TacticalAI;
