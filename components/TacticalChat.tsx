import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, Radio } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '../types';

const socket: Socket = io();

const TacticalChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [username] = useState(`OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
  const [onlineCount, setOnlineCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on('users-count', (count: number) => setOnlineCount(count));
    return () => { socket.off('chat-message'); socket.off('users-count'); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg: ChatMessage = { id: Date.now().toString(), user: username, text: input, timestamp: new Date().toISOString() };
    socket.emit('chat-message', msg);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border-primary)',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio style={{ width: 14, height: 14, color: 'var(--green)' }} />
          <h3 className="font-mono" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--green)', fontWeight: 700 }}>
            Comms Channel
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
          <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--green)' }}>{onlineCount}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 ? (
          <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            {'>'} CANAL DE COMUNICAÇÃO SEGURO ATIVO<br />
            {'>'} OPERADOR: {username}
          </div>
        ) : messages.map((msg, idx) => (
          <div key={msg.id || idx} className="animate-fade-in" style={{ marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
              <span className="font-mono" style={{
                fontSize: '0.5rem', fontWeight: 700,
                color: msg.user === username ? 'var(--green)' : 'var(--blue)',
              }}>
                {msg.user}
              </span>
              <span className="font-mono" style={{ fontSize: '0.4rem', color: 'var(--text-muted)' }}>
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="font-body" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.4, paddingLeft: 4 }}>
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Transmitir mensagem..."
            className="tactical-input"
            style={{ flex: 1 }}
          />
          <button onClick={handleSend} disabled={!input.trim()} className="btn-tactical primary" style={{ flexShrink: 0 }}>
            <Send style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TacticalChat;
