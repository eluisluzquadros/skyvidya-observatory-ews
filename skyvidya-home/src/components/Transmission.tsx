export default function Transmission() {
  return (
    <section id="contact" className="relative w-full flex-grow flex items-center justify-center py-20 px-4 md:px-10 bg-background-dark overflow-hidden min-h-screen">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(139,148,158,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(139,148,158,0.05)_1px,transparent_1px)] bg-[length:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-background-dark pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_center,rgba(255,94,58,0.08)_0%,rgba(11,15,20,0)_70%)] opacity-50 pointer-events-none" />

      <div className="w-full max-w-[1200px] relative z-10">
        <div className="flex items-center gap-4 mb-12">
          <span className="h-px w-8 bg-text-muted/40" />
          <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">TRANSMISSION // 07</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
          <div className="lg:col-span-7 flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-widest uppercase opacity-80">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                System Ready
              </div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-none tracking-tight text-text-main">
                INITIATE<br/>SEQUENCE
              </h2>
              <p className="text-text-muted text-lg max-w-lg font-normal">
                Establish a direct link with our command center. Parameters set for immediate encrypted transmission.
              </p>
            </div>

            <form className="flex flex-col gap-8 w-full max-w-xl">
              <div className="group relative">
                <label className="block text-xs font-mono text-text-muted mb-2 uppercase tracking-widest" htmlFor="identity">Identity_Ref</label>
                <input 
                  className="w-full bg-transparent border-b border-text-muted/30 text-text-main py-3 text-lg font-display focus:outline-none input-glow transition-all duration-300 placeholder-text-muted/20" 
                  id="identity" 
                  placeholder="ENTER DESIGNATION" 
                  type="text"
                />
              </div>

              <div className="group relative">
                <label className="block text-xs font-mono text-text-muted mb-2 uppercase tracking-widest" htmlFor="signal">Signal_Source</label>
                <input 
                  className="w-full bg-transparent border-b border-text-muted/30 text-text-main py-3 text-lg font-display focus:outline-none input-glow transition-all duration-300 placeholder-text-muted/20" 
                  id="signal" 
                  placeholder="EMAIL@DOMAIN.COM" 
                  type="email"
                />
              </div>

              <div className="group relative">
                <label className="block text-xs font-mono text-text-muted mb-2 uppercase tracking-widest" htmlFor="transmission">Transmission_Data</label>
                <textarea 
                  className="w-full bg-transparent border-b border-text-muted/30 text-text-main py-3 text-lg font-display focus:outline-none input-glow transition-all duration-300 resize-none placeholder-text-muted/20" 
                  id="transmission" 
                  placeholder="INPUT MESSAGE PARAMETERS..." 
                  rows={3}
                />
              </div>

              <div className="pt-4">
                <button 
                  className="group relative inline-flex items-center justify-center bg-primary text-background-dark font-bold font-display tracking-widest uppercase text-sm py-4 px-10 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_30px_-5px_rgba(255,94,58,0.5)]" 
                  type="button"
                >
                  <span>Transmit</span>
                  <span className="material-symbols-outlined ml-2 text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-end pb-4">
            <div className="glass-panel p-8 flex flex-col gap-8 relative overflow-hidden">
              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <span className="font-mono text-xs text-primary tracking-widest">SYS_DIAGNOSTIC</span>
                <span className="font-mono text-xs text-text-muted">V.2.0.4</span>
              </div>

              <div className="grid gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">UPLINK_CHANNEL</span>
                  <a className="text-xl font-display text-text-main hover:text-primary transition-colors flex items-center gap-2 group" href="mailto:skyvidya@skyvidya.org">
                    skyvidya@skyvidya.org
                    <span className="material-symbols-outlined text-sm opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">call_made</span>
                  </a>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">GEO_COORDINATES</span>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">my_location</span>
                    <span className="font-mono text-base text-text-main">LAT: 34.05 / LONG: -118.24</span>
                  </div>
                  <span className="text-sm text-text-muted mt-1">Los Angeles, California Sector</span>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">NETWORK_STATUS</span>
                  <div className="flex items-center gap-3 bg-background-dark/50 p-3 border border-white/5">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <span className="font-mono text-sm text-emerald-400">OPERATIONAL</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <span className="font-mono text-[10px] text-text-muted uppercase">© 2026 SKYVIDYA SYSTEMS.</span>
                <div className="flex gap-4">
                  <a className="text-text-muted hover:text-text-main transition-colors" href="#">
                    <span className="sr-only">Twitter</span>
                    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a className="text-text-muted hover:text-text-main transition-colors" href="#">
                    <span className="sr-only">GitHub</span>
                    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
