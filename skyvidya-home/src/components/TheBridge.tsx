export default function TheBridge() {
  const steps = [
    {
      number: '1',
      title: 'Inovação',
      description: 'Innovation Sprints e Workshops remotos ou híbridos. Obrigatório para estratégias.'
    },
    {
      number: '2',
      title: 'Inteligência',
      description: 'Compliance ESG: coleta e enriquecimento de Leads, risco Climático e Socioambiental.'
    },
    {
      number: '3',
      title: 'Sinergia',
      description: 'Gestão de Open Innovation e Matchmaking entre inovações e fontes de financiamento.'
    },
    {
      number: '4',
      title: 'Ecossistema',
      description: 'Skyvidya orienta e acelera sua navegação no primeiro Ecossistema de Inovação Figital.'
    }
  ];

  return (
    <section className="relative w-full py-32 px-6 md:px-12 max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center bg-[#0B0F14]">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <div className="relative z-10 mb-16 max-w-3xl">
        <div className="flex items-center gap-4 mb-6">
          <span className="h-px w-8 bg-text-muted/40" />
          <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">A PONTE // 04</h2>
        </div>
        <h2 className="font-serif text-5xl md:text-6xl text-white mb-6 tracking-tight">
          Como a inovação vira o primeiro nó
        </h2>
        <p className="text-slate-400 text-lg leading-relaxed font-light max-w-2xl">
          Não é uma metáfora — é engenharia de produto. Cada inovação consome tokens de valor crescente.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step) => (
          <div 
            key={step.number}
            className="glass-card rounded-2xl p-8 flex flex-col hover:border-white/10 hover:bg-white/5 transition-all duration-300 group"
          >
            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm mb-8 group-hover:bg-accent/30 transition-colors">
              {step.number}
            </div>
            <h3 className="text-xl font-bold text-white mb-4 tracking-wide">
              {step.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed font-light">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
