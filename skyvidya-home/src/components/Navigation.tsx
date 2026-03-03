export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 flex justify-between items-center mix-blend-difference">
      <div className="flex items-center gap-2 group cursor-pointer">
        <span className="material-symbols-outlined text-primary text-2xl group-hover:rotate-90 transition-transform duration-500">grid_view</span>
        <span className="font-mono text-xs tracking-widest text-text-muted group-hover:text-white transition-colors">SKYVIDYA SYS.</span>
      </div>
      <div className="hidden md:flex gap-8 font-mono text-xs text-text-muted">
        <span>LAT: 34.05</span>
        <span>LONG: -118.24</span>
        <span className="text-accent animate-pulse">STATUS: ONLINE</span>
      </div>
    </nav>
  );
}
