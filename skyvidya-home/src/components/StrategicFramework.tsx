export default function StrategicFramework() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-20 min-h-screen flex flex-col justify-center">
      <div className="mb-16">
        <div className="flex items-center gap-4 mb-6">
          <span className="h-px w-8 bg-text-muted/40" />
          <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">STRATEGIC FRAMEWORK // 06</h2>
        </div>
        <h2 className="font-serif text-5xl md:text-7xl mb-4 text-slate-100 italic">The Frame</h2>
        <p className="text-slate-400 uppercase tracking-[0.3em] text-xs">Ecosystem Synergy</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden mb-24">
        {[
          { id: '01 / IDE', icon: 'lightbulb', title: 'Ideação', desc: 'Concepção estratégica e validação de teses disruptivas no mercado global.' },
          { id: '02 / ENG', icon: 'architecture', title: 'Engenharia', desc: 'Desenvolvimento de infraestrutura robusta com foco em escalabilidade.' },
          { id: '03 / MON', icon: 'payments', title: 'Monetização', desc: 'Modelagem de receitas baseada em economia real e digital.' },
          { id: '04 / MKT', icon: 'public', title: 'Mercado', desc: 'Análise preditiva de tendências e posicionamento estratégico de marca.' },
          { id: '05 / INT', icon: 'psychology', title: 'Inteligência', desc: 'Processamento de dados via IA para suporte à decisão executiva.' },
          { id: '06 / GROWTH', icon: 'campaign', title: 'Marketing', desc: 'Estratégias de aquisição baseadas em comunidades e viralidade.' },
          { id: '07 / OPS', icon: 'support_agent', title: 'SAC', desc: 'Suporte de alto nível com automação inteligente e humanizada.' },
          { id: '08 / FIN', icon: 'account_balance', title: 'Financiamento', desc: 'Estruturação de capital e acesso a liquidez em ecossistemas Figital.' },
        ].map((item) => (
          <div key={item.id} className="glass-panel p-8 group transition-all duration-500 hover:bg-white/[0.02]">
            <div className="flex justify-between items-start mb-8">
              <span className="text-xs font-mono text-slate-500">{item.id}</span>
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">{item.icon}</span>
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">{item.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}

        <div className="bg-success/10 border-2 border-success/30 p-8 group cursor-pointer transition-all duration-500 hover:bg-success/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <div className="flex justify-between items-start mb-8">
            <span className="text-xs font-mono text-success">09 / ECO</span>
            <span className="material-symbols-outlined text-success animate-pulse">hub</span>
          </div>
          <h3 className="text-2xl font-bold mb-3 tracking-tight text-white uppercase italic">Marketplace</h3>
          <p className="text-success font-bold text-sm mb-4">Ecossistema Figital</p>
          <div className="flex items-center gap-2 text-[10px] text-success/80 tracking-widest font-mono">
            EXPLORE NOW <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </div>
        </div>
      </div>

      <div className="relative mb-24 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-white/5 p-8 md:p-12">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
              <span className="text-[10px] tracking-[0.4em] uppercase text-primary font-bold">Protocol established</span>
              <div className="h-px w-12 bg-primary/30" />
            </div>
            <h2 className="font-serif text-5xl md:text-6xl text-white mb-6 italic">Skyvidya Score™</h2>
            <p className="text-slate-400 text-lg md:text-xl font-light">
              Projetado com <span className="text-accent font-bold">AI</span> & Validado com <span className="text-white font-bold">Humanos!</span>
            </p>
            <div className="mt-8 flex gap-4 justify-center md:justify-start">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded text-[10px] tracking-widest text-slate-400">98.4% ACCURACY</div>
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded text-[10px] tracking-widest text-slate-400">BLOCKCHAIN VERIFIED</div>
            </div>
          </div>
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="50%" cy="50%" fill="transparent" r="45%" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="50%" cy="50%" fill="transparent" r="45%" stroke="url(#gradientDial)" strokeDasharray="283" strokeDashoffset="60" strokeLinecap="round" strokeWidth="8" />
              <defs>
                <linearGradient id="gradientDial" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF5E3A" />
                  <stop offset="100%" stopColor="#00D4FF" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-bold text-white leading-none">94</span>
              <span className="text-[10px] tracking-widest text-slate-500 uppercase mt-2">Score Index</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
