import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, MapPin, Loader2 } from 'lucide-react';
import { queryGeoRAG } from '../services/analyticsService';
import type { MunicipalityRisk } from '../analyticsTypes';
import { RISK_CATEGORY_COLORS } from '../analyticsTypes';

interface GeoRAGChatProps {
  onMunicipalityClick?: (municipality: MunicipalityRisk) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  municipalities?: MunicipalityRisk[];
  timestamp: Date;
}

const SUGGESTED_QUERIES = [
  'Top 10 cidades mais seguras do RS',
  'Municípios com maior risco de inundação',
  'Cidades com tendência crescente de desastres',
  'Melhor qualidade de vida no Sul',
];

const GeoRAGChat: React.FC<GeoRAGChatProps> = ({ onMunicipalityClick }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (query?: string) => {
    const q = query || input.trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: q,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await queryGeoRAG(q);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.data?.textResponse || 'Sem resultados para essa consulta.',
        municipalities: result.data?.municipalities || [],
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Erro na consulta: ${error instanceof Error ? error.message : 'Serviço GeoRAG indisponível. Verifique se o microserviço Python está rodando.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-purple-400" />
          <span className="text-xs font-mono text-gray-300">GeoRAG Query Engine</span>
        </div>
        <p className="text-[10px] text-gray-600 mt-0.5">
          Consultas espaciais em linguagem natural
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <MapPin size={24} className="mx-auto text-purple-400/40" />
            <p className="text-xs text-gray-600">
              Faça perguntas sobre perfis de risco municipal
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="block w-full text-left px-3 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors border border-transparent hover:border-purple-500/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[95%] rounded-lg px-3 py-2 text-xs font-mono ${
                msg.role === 'user'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-500/20'
                  : 'bg-[#161B22] text-gray-300 border border-white/5'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Municipality results */}
              {msg.municipalities && msg.municipalities.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                  {msg.municipalities.slice(0, 10).map((mun, i) => (
                    <button
                      key={mun.cd_mun}
                      onClick={() => onMunicipalityClick?.(mun)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-[10px] text-gray-600 w-4 text-right">{i + 1}</span>
                      <MapPin size={10} className="text-purple-400 flex-shrink-0" />
                      <span className="flex-1 truncate text-gray-200">{mun.name}</span>
                      <span className="text-[10px]" style={{ color: RISK_CATEGORY_COLORS[mun.riskCategory] || '#666' }}>
                        {mun.riskCategory}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-600 mt-0.5 px-1">
              {formatTime(msg.timestamp)}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-purple-400">
            <Loader2 size={12} className="animate-spin" />
            <span className="font-mono">Processando consulta espacial...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre riscos municipais..."
            className="flex-1 bg-[#0B0F14] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-purple-500/50 focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeoRAGChat;
