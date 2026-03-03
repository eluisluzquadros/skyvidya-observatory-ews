export default function MissionControl() {
  return (
    <section className="relative py-32 px-6 max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-40" />
      <div className="absolute bg-primary/20 w-[600px] h-[600px] -top-40 -left-40 opacity-30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bg-accent/10 w-[500px] h-[500px] bottom-0 -right-20 opacity-20 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-16 relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <span className="h-px w-8 bg-text-muted/40" />
          <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">MISSION CONTROL // 05</h2>
        </div>
        <h2 className="font-display text-6xl md:text-8xl leading-tight max-w-4xl text-white">
          The <span className="italic text-slate-400 font-serif">Constellation</span>
        </h2>
        <p className="mt-6 text-slate-400 max-w-xl text-lg leading-relaxed border-l border-primary/30 pl-6">
          Architecting the future through a unified intelligence ecosystem. Navigating the intersection of Research, Engineering, and Human Potential.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="hud-border p-8 group hover:border-primary/40 transition-all duration-500">
            <div className="flex justify-between items-start mb-12">
              <span className="bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono tracking-widest text-slate-300 uppercase">
                Fase 1 — 2026
              </span>
              <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">hub</span>
            </div>
            <h3 className="font-display text-3xl mb-4 text-white">Skyvidya Global Synergy Mesh™</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              The backbone of our decentralized intelligence network, synchronizing localized data nodes into a global knowledge fabric.
            </p>
            <div className="flex flex-wrap gap-2 pt-6 border-t border-white/5">
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">DECENTRALIZED</span>
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">REAL-TIME</span>
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">AES-256</span>
            </div>
          </div>

          <div className="hud-border p-8 group hover:border-accent/40 transition-all duration-500">
            <div className="flex justify-between items-start mb-12">
              <span className="bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-mono tracking-widest text-slate-300 uppercase">
                Beta Protocol
              </span>
              <span className="material-symbols-outlined text-accent group-hover:scale-110 transition-transform">visibility</span>
            </div>
            <h3 className="font-display text-3xl mb-4 text-white">Skyvidya Observatory™</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              Advanced predictive modeling and trend analysis suite for deep-market intelligence and foresight engineering.
            </p>
            <div className="flex flex-wrap gap-2 pt-6 border-t border-white/5">
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">FORESIGHT</span>
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">ANALYSIS</span>
              <span className="text-[9px] font-mono py-1 px-2 border border-white/5 bg-white/5 text-slate-500">AI-DRIVEN</span>
            </div>
          </div>

          <div className="md:col-span-2 hud-border p-8 flex flex-col md:flex-row gap-8 items-center group hover:border-white/20 transition-all">
            <div className="flex-shrink-0 w-24 h-24 border border-white/10 flex items-center justify-center bg-white/5">
              <span className="material-symbols-outlined text-4xl text-slate-500">psychology</span>
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-3xl text-white">Skyvidya Insights™</h3>
                <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-[10px] font-mono tracking-widest uppercase animate-pulse-soft">Live Feed</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                A curated stream of actionable executive summaries derived from cross-platform telemetry and strategic research labs.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-w-[120px]">
              <button className="text-[10px] font-mono uppercase tracking-widest py-2 px-4 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between">
                Access <span className="material-symbols-outlined text-xs">login</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="hud-border p-8 flex flex-col items-center justify-center text-center">
            <div className="mb-6 relative">
              <div 
                className="w-48 h-48 rounded-full p-1 flex items-center justify-center"
                style={{ background: 'conic-gradient(from 180deg, #FF5E3A 0%, #FF5E3A 98.5%, transparent 98.5%)' }}
              >
                <div className="w-full h-full bg-background-dark rounded-full flex flex-col items-center justify-center">
                  <span className="text-6xl font-display text-white">98.5</span>
                  <span className="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase mt-1">Ecosystem Health</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">+0.4%</div>
            </div>
            <h4 className="font-mono text-xs tracking-widest text-slate-300 uppercase mb-2">Skyvidya Score™</h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              Aggregated performance metric of intelligence throughput across the Synergy Mesh.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="hud-border p-4">
              <span className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Active Nodes</span>
              <span className="text-2xl font-display text-white">4,281</span>
            </div>
            <div className="hud-border p-4">
              <span className="block font-mono text-[10px] text-slate-500 uppercase mb-1">Latency</span>
              <span className="text-2xl font-display text-accent">14ms</span>
            </div>
          </div>

          <div className="hud-border p-6 font-mono text-[10px] text-slate-500 space-y-3">
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-widest">Protocol Version</span>
              <span className="text-white">SYS.VE9.2.94</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-widest">Security Link</span>
              <span className="text-accent">ESTABLISHED</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-widest">Location Telemetry</span>
              <span className="text-white">LAT: S4.85 / LONG: -118.24</span>
            </div>
            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-3/4 animate-pulse" />
              </div>
              <div className="flex justify-between text-[8px]">
                <span>SYNCING DATA FABRIC...</span>
                <span>75%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
