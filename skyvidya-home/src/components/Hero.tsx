import { useEffect, useState } from 'react';

export default function Hero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background Monolith Layer */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80" 
          style={{ 
            backgroundImage: "url('src/public/Gemini_Generated_Image_1nt2df1nt2df1nt2.png?q=80&w=2048&auto=format&fit=crop')" 
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F14_100%)] z-10" />
        <div className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay pointer-events-none z-20" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent z-10" />
      </div>

      {/* Content Layer */}
      <div 
        className="relative z-30 flex flex-col items-center justify-center text-center px-4 w-full max-w-7xl mx-auto h-full animate-blur-in"
      >
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <span className="h-px w-8 bg-text-muted/40" />
            <h2 className="font-mono text-sm tracking-[0.25em] text-text-muted uppercase">Skyvidya // 01</h2>
          </div>
        </div>

        <div 
          className="mb-6 md:mb-8 group"
          style={{ 
            transform: `translateY(${scrollY * -0.1}px)`,
            opacity: Math.max(0, 1 - (scrollY / 400))
          }}
        >
          <div className="relative overflow-hidden rounded-full bg-surface/30 border border-white/10 backdrop-blur-md px-4 py-2 md:px-6 md:py-3 transition-all duration-500 hover:bg-surface/50 hover:border-primary/30 hover:shadow-[0_0_40px_-10px_rgba(255,94,58,0.3)]">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_#FF5E3A]" />
              <p className="font-body text-xs md:text-sm text-text-main tracking-wide">
                <span className="text-white font-medium">Synergy Mesh: Ecosystem by Design</span>
              </p>
            </div>
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000" />
          </div>
        </div>

        <h1 
          className="font-display font-bold text-6xl md:text-8xl lg:text-9xl tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mix-blend-overlay mb-8 select-none"
          style={{ 
            transform: `translateY(${scrollY * -0.2}px)`,
            opacity: Math.max(0, 1 - (scrollY / 500))
          }}
        >
          SKYVIDYA<br/>
        </h1>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pb-8 gap-4 mix-blend-screen opacity-0 animate-[blur-in_1s_ease-out_1s_forwards]">
        <span className="font-mono text-[10px] tracking-[0.2em] text-text-muted uppercase rotate-90 origin-center mb-8">Scroll to Descend</span>
        <div className="w-[1px] h-16 bg-white/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-primary animate-scroll-line shadow-[0_0_10px_#FF5E3A]" />
        </div>
      </div>

      {/* Decorative HUD Elements */}
      <div className="absolute bottom-8 left-8 hidden md:block z-20">
        <div className="flex flex-col gap-1">
          <div className="w-16 h-[1px] bg-white/20" />
          <div className="w-8 h-[1px] bg-white/20" />
          <div className="font-mono text-[10px] text-text-muted mt-2">SYS.VER.2.04</div>
        </div>
      </div>
      <div className="absolute bottom-8 right-28 hidden md:block z-20 text-right">
        <div className="flex flex-col gap-1 items-end">
          <div className="w-16 h-[1px] bg-accent/50 shadow-[0_0_5px_#00D4FF]" />
          <div className="font-mono text-[10px] text-accent mt-2 tracking-widest">SECURE LINK ESTABLISHED</div>
        </div>
      </div>
    </section>
  );
}
