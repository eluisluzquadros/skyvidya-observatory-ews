export default function SideNav() {
  return (
    <aside className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-8 mix-blend-difference">
      <button 
        className="font-mono text-xs border border-white/20 px-2.5 py-6 rounded hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-widest flex items-center justify-center cursor-pointer"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        MENU
      </button>
      
      <div className="flex flex-col items-center gap-4">
        <button className="w-1.5 h-1.5 rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.5)]" aria-label="Section 1" />
        <button className="w-1 h-1 rounded-full bg-white/30 hover:bg-white/70 transition-all duration-300" aria-label="Section 2" />
        <button className="w-1 h-1 rounded-full bg-white/30 hover:bg-white/70 transition-all duration-300" aria-label="Section 3" />
        <button className="w-1 h-1 rounded-full bg-white/30 hover:bg-white/70 transition-all duration-300" aria-label="Section 4" />
        <button className="w-1 h-1 rounded-full bg-white/30 hover:bg-white/70 transition-all duration-300" aria-label="Section 5" />
      </div>
    </aside>
  );
}
