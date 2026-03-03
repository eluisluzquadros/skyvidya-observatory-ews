export default function Diagnostic() {
  return (
    <section className="relative w-full py-16 md:py-32 px-6 md:px-12 max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Header Section */}
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 md:gap-12 mb-12 md:mb-20">
        <div className="max-w-3xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="h-px w-8 bg-text-muted/40" />
            <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">DIAGNÓSTICO VITAL // 03</h2>
          </div>
          <h2 className="text-4xl sm:text-6xl md:text-8xl lg:text-[clamp(3.5rem,10vw,6.25rem)] leading-[1.1] tracking-tight">
            <span className="font-serif italic text-white block mb-2">O Custo da</span>
            <span className="font-display font-medium text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">
              Inércia Digital
            </span>
          </h2>
        </div>
        
        <div className="max-w-md text-left lg:text-right lg:pb-6">
          <p className="text-text-muted text-base md:text-lg leading-relaxed font-light">
            A mortalidade precoce não é azar. É falta de dados.<br className="hidden md:block"/>
            Sem inteligência de malha, seu negócio é apenas uma<br className="hidden md:block"/>
            ilha isolada.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Main Large Card */}
        <div className="lg:col-span-7 glass-card border-accent/20 rounded-[30px] md:rounded-[40px] p-6 md:p-14 flex flex-col justify-between relative overflow-hidden group hover:border-accent/40 transition-colors duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-8 md:mb-16">
              <h3 className="font-serif italic text-3xl md:text-5xl lg:text-6xl text-white">O Abismo do 1º Ano</h3>
              <span className="material-symbols-outlined text-4xl md:text-6xl text-primary/80 group-hover:text-primary transition-colors">warning</span>
            </div>
            
            <p className="text-text-main/80 text-lg md:text-2xl leading-relaxed max-w-2xl mb-12 md:mb-20 font-light">
              20% das empresas desaparecem em 12 meses. O motivo? Planejamento financeiro baseado em intuição, não em dados reais de ecossistema.
            </p>

            <div className="flex flex-wrap items-center gap-8 md:gap-16 pt-10 border-t border-accent/20 mt-auto">
              <div>
                <div className="font-serif italic text-4xl md:text-6xl text-accent mb-2">60%</div>
                <div className="font-mono text-[10px] tracking-widest text-accent/70 uppercase">Mortalidade 5 Anos</div>
              </div>
              <div className="hidden sm:block w-px h-16 md:h-20 bg-accent/20" />
              <div>
                <div className="font-serif italic text-4xl md:text-6xl text-white mb-2">40%</div>
                <div className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Sobrevivência</div>
              </div>
            </div>
          </div>
        </div>

        {/* Side Cards */}
        <div className="lg:col-span-5 flex flex-col gap-6 md:gap-8">
          
          {/* Side Card 1 */}
          <div className="flex-1 glass-card border-accent/20 rounded-[30px] md:rounded-[40px] p-8 md:p-10 flex flex-col justify-center group hover:border-accent/40 transition-colors duration-500">
            <span className="material-symbols-outlined text-3xl md:text-4xl text-accent mb-6 md:mb-8 group-hover:scale-110 transition-transform origin-left">visibility_off</span>
            <h4 className="font-display font-bold text-xl md:text-2xl text-white mb-4 tracking-wide uppercase">Sinergia Invisível</h4>
            <p className="text-text-muted text-base md:text-lg leading-relaxed font-light">
              Isolamento estratégico é a causa raiz da estagnação.
            </p>
          </div>

          {/* Side Card 2 */}
          <div className="flex-1 glass-card border-primary/20 rounded-[30px] md:rounded-[40px] p-8 md:p-10 flex flex-col justify-center group hover:border-primary/40 transition-colors duration-500">
            <span className="material-symbols-outlined text-3xl md:text-4xl text-primary mb-6 md:mb-8 group-hover:scale-110 transition-transform origin-left">trending_down</span>
            <h4 className="font-display font-bold text-xl md:text-2xl text-white mb-4 tracking-wide uppercase">Baixa Estratégia</h4>
            <p className="text-text-muted text-base md:text-lg leading-relaxed font-light">
              Alto anseio sem visão de longo prazo = Falência.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
