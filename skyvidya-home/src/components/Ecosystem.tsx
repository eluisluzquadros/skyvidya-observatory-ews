export default function Ecosystem() {
  return (
    <section className="relative w-full min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col gap-24">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="h-px w-8 bg-text-muted/40" />
            <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">The Ecosystem // 02</h2>
          </div>
          <h3 className="font-display text-4xl md:text-5xl font-medium tracking-tight text-white/90">
            Architecting <br/>
            <span className="text-primary">Intelligence.</span>
          </h3>
        </div>

        <div className="flex flex-col gap-8 pb-32">
          {/* Card 01: LAB */}
          <div id="lab" className="sticky top-24 group transition-transform duration-500 hover:scale-[1.02] ease-out">
            <div className="glass-card glow-cyan rounded-2xl overflow-hidden relative min-h-[500px] flex flex-col md:flex-row border-t border-white/10">
              <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay" />
              <div className="flex-1 p-8 md:p-12 flex flex-col justify-between z-10 relative">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="font-mono text-accent text-xs tracking-wider border border-accent/20 px-2 py-1 rounded">01 // ENGINE</span>
                    <span className="material-symbols-outlined text-accent/40 text-4xl group-hover:text-accent transition-colors duration-300">deployed_code</span>
                  </div>
                  <h3 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight group-hover:text-accent transition-colors duration-300">SKYVIDYA LAB</h3>
                  <p className="text-text-muted text-lg md:text-xl font-light leading-relaxed max-w-lg">
                    High-velocity software engineering. We build the engines that power tomorrow through rapid prototyping and scalable architecture.
                  </p>
                </div>
                <div className="mt-12 flex items-center gap-4">
                  <button className="group/btn relative inline-flex items-center justify-center bg-transparent border border-accent text-accent font-bold font-display tracking-widest uppercase text-xs py-3 px-8 transition-all duration-300 hover:bg-accent hover:text-background-dark hover:shadow-[0_0_20px_-5px_rgba(0,212,255,0.4)]">
                    <span>EXPLORE LAB</span>
                    <span className="material-symbols-outlined ml-2 text-sm transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </button>
                  <div className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" />
                </div>
              </div>
              <div className="w-full md:w-1/3 bg-black/20 border-l border-white/5 relative overflow-hidden min-h-[200px] md:min-h-auto">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  alt="Abstract digital wireframe cube glowing in cyan" 
                  className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40 group-hover:scale-110 transition-transform duration-700 ease-out" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDehA4HN8SeioDjTPPzh9QI1suxAAwpFDvQCbxlN0Jr7a9YwjqFn1JUyWt2LNnAIUruHbmgpdNx2vmfaUMTaTtIjyLmJ35gQimiez4sZXrYJIu98RZ5mJItC278KXYZknAME9ij9NOxy81IWTOeIugTRCXyZKo3qMrzg9gsZNtVMl53fX9DlI7GujpMtJbAoJI3hmZHYXgRH7kYcEWuN5eLllsn3a1CHAiPZvRMyjUblisIPXwXerPwINmovBTorvY6mIHSNnEvipAg"
                />
              </div>
            </div>
          </div>

          {/* Card 02: R&D */}
          <div id="rd" className="sticky top-32 group transition-transform duration-500 hover:scale-[1.02] ease-out">
            <div className="glass-card glow-indigo rounded-2xl overflow-hidden relative min-h-[500px] flex flex-col md:flex-row border-t border-white/10 bg-[#1A1F26]/95">
              <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay" />
              <div className="flex-1 p-8 md:p-12 flex flex-col justify-between z-10 relative">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="font-mono text-indigo-400 text-xs tracking-wider border border-indigo-400/20 px-2 py-1 rounded">02 // DISCOVERY</span>
                    <span className="material-symbols-outlined text-indigo-400/40 text-4xl group-hover:text-indigo-400 transition-colors duration-300">biotech</span>
                  </div>
                  <h3 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight group-hover:text-indigo-400 transition-colors duration-300">SKYVIDYA R&D</h3>
                  <p className="text-text-muted text-lg md:text-xl font-light leading-relaxed max-w-lg">
                    Deep-tech research and capacity building. Pushing the boundaries of the possible in AI, quantum computing, and spatial interfaces.
                  </p>
                </div>
                <div className="mt-12 flex items-center gap-4">
                  <button className="group/btn relative inline-flex items-center justify-center bg-transparent border border-indigo-400 text-indigo-400 font-bold font-display tracking-widest uppercase text-xs py-3 px-8 transition-all duration-300 hover:bg-indigo-400 hover:text-background-dark hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)]">
                    <span>VIEW RESEARCH</span>
                    <span className="material-symbols-outlined ml-2 text-sm transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </button>
                  <div className="h-px flex-1 bg-gradient-to-r from-indigo-400/30 to-transparent" />
                </div>
              </div>
              <div className="w-full md:w-1/3 bg-black/20 border-l border-white/5 relative overflow-hidden min-h-[200px] md:min-h-auto">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-400/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  alt="Abstract purple liquid data flow visualization" 
                  className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40 group-hover:scale-110 transition-transform duration-700 ease-out" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoXHd0CMkXGUt0MrJ1dCIhugYoQRY-qGp7Zvh5iy5zHz6DzoWKeUHs3qFqoidEvv-DTKPxaLZzVv6ZVS0Vu9-cFc98wxWfHTG02164WAy5Kd2LpTx8L4HmmOS_nJxqncDmpLY_iHaMNPNqR33cX4gdKrhRNtYAObFjnvBHuRZlCHMAjpYWsKc4RhUhKVmMfvdd4tc8IvVODlr5P5ysey00wd2qyXXMlOHIhqLRdzGpQJfgPBFNRpAV4PAt80UYVb7vaD5HqMTP5GlX"
                />
              </div>
            </div>
          </div>

          {/* Card 03: HUB */}
          <div id="hub" className="sticky top-40 group transition-transform duration-500 hover:scale-[1.02] ease-out">
            <div className="glass-card glow-orange rounded-2xl overflow-hidden relative min-h-[500px] flex flex-col md:flex-row border-t border-white/10 bg-[#1E232A]/95">
              <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay" />
              <div className="flex-1 p-8 md:p-12 flex flex-col justify-between z-10 relative">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="font-mono text-primary text-xs tracking-wider border border-primary/20 px-2 py-1 rounded">03 // NEXUS</span>
                    <span className="material-symbols-outlined text-primary/40 text-4xl group-hover:text-primary transition-colors duration-300">hub</span>
                  </div>
                  <h3 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight group-hover:text-primary transition-colors duration-300">SKYVIDYA HUB</h3>
                  <p className="text-text-muted text-lg md:text-xl font-light leading-relaxed max-w-lg">
                    Innovation marketplace. Connecting visionaries with execution. A unified platform for partners, developers, and investors.
                  </p>
                </div>
                <div className="mt-12 flex items-center gap-4">
                  <button className="group/btn relative inline-flex items-center justify-center bg-transparent border border-primary text-primary font-bold font-display tracking-widest uppercase text-xs py-3 px-8 transition-all duration-300 hover:bg-primary hover:text-background-dark hover:shadow-[0_0_20px_-5px_rgba(255,94,58,0.4)]">
                    <span>ENTER HUB</span>
                    <span className="material-symbols-outlined ml-2 text-sm transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </button>
                  <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
                </div>
              </div>
              <div className="w-full md:w-1/3 bg-black/20 border-l border-white/5 relative overflow-hidden min-h-[200px] md:min-h-auto">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  alt="Abstract orange geometric network connections" 
                  className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40 group-hover:scale-110 transition-transform duration-700 ease-out" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0aNhSGle1xESmJO6rq0iQfBqY8xkRN-HVrHZ9JnNmU89TmYZvyHt0-ggyiYO0gjIIZBuqXkkOzYBOf1AxrvCkPqGXD0NLiFv706hyjAcaErRehB_Odm6xr3V_pH7f2ROP1PZrlg2OLWNT99fRtpFum2uAJ8WjtuD04SkyYLR8Cms1oUcWmKqdymYEO7Hh4Dv24P1lqkLWrTT91NY1kaqKPdfO8i_i6zQcG0wmFD-2tVeG8b736UVke1zXZqty59-0Ayb2qcUWu2fn"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
