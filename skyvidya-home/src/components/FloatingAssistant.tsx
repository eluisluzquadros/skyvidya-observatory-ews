import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Olá! Sou a IA de onboarding do Skyvidya Sys. Como posso ajudar você a explorar nosso ecossistema hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    chatRef.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Você é a IA de onboarding do Skyvidya Sys, um ecossistema de inovação (Lab, R&D, Hub). Ajude o usuário a entender a plataforma, navegar pelas seções (Synergy Mesh, The Frame, Mission Control) e fazer onboarding. Seja futurista, conciso e prestativo. Responda em português.",
      },
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMessage });
      setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro na comunicação com o servidor central.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      {/* Chat Window */}
      <div 
        className={`mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[70vh] glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </div>
            <span className="font-mono text-xs tracking-widest text-white uppercase">SYS.AI_ASSISTANT</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-text-muted hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
            >
              <span className="font-mono text-[10px] text-text-muted mb-1 uppercase tracking-wider">
                {msg.role === 'user' ? 'User_Input' : 'AI_Response'}
              </span>
              <div 
                className={`p-3 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-primary text-background-dark font-medium rounded-tr-sm' 
                    : 'bg-white/5 border border-white/10 text-text-main rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="self-start flex flex-col max-w-[85%] items-start">
              <span className="font-mono text-[10px] text-text-muted mb-1 uppercase tracking-wider">AI_Response</span>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 rounded-tl-sm flex gap-1 items-center h-10">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-background-dark/50">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-4 pr-12 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 w-8 h-8 flex items-center justify-center bg-primary rounded-full text-background-dark disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-primary text-background-dark flex items-center justify-center shadow-[0_0_30px_rgba(255,94,58,0.4)] hover:scale-110 transition-transform duration-300 z-50 relative group"
      >
        <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-20" />
        <span className="material-symbols-outlined text-2xl transition-transform duration-300">
          {isOpen ? 'close' : 'smart_toy'}
        </span>
      </button>
    </div>
  );
}
