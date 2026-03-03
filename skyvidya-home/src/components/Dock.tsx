export default function Dock() {
  return (
    <nav className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50 h-[480px] py-4 hidden md:block">
      <div className="relative flex flex-col items-center justify-between w-14 h-full py-8 rounded-full bg-[linear-gradient(180deg,rgba(22,27,34,0.7)_0%,rgba(11,15,20,0.9)_100%)] backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden group/dock transition-all duration-500 hover:border-white/20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-32 bg-primary/20 blur-[30px] rounded-full opacity-50 pointer-events-none" />
        
        {/* Menu Button */}
        <button className="relative z-10 flex flex-col items-center gap-3 group focus:outline-none mb-4">
          <div className="flex flex-col gap-1.5 items-center">
            <span className="w-5 h-[1px] bg-white group-hover:bg-primary transition-colors" />
            <span className="w-3 h-[1px] bg-white group-hover:bg-primary transition-colors" />
          </div>
          <span className="font-mono text-[10px] text-white tracking-widest uppercase group-hover:text-primary transition-colors" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Menu</span>
        </button>

        <ul className="relative z-10 flex flex-col items-center justify-between h-full mt-6 list-none m-0 p-0">
          <li className="relative group/item">
            <a className="flex flex-col items-center px-2 py-1 focus:outline-none" href="#lab">
              <span className="font-body text-xs font-medium tracking-widest text-white/50 transition-all duration-300 group-hover/item:text-white group-hover/item:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                LAB
              </span>
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary opacity-0 transition-all duration-300 transform scale-0 group-hover/item:opacity-100 group-hover/item:scale-100 shadow-[0_0_10px_#FF5E3A]" />
            </a>
          </li>
          
          <li aria-hidden="true" className="w-[1px] h-4 bg-white/10" />
          
          <li className="relative group/item">
            <a className="flex flex-col items-center px-2 py-1 focus:outline-none" href="#rd">
              <span className="font-body text-xs font-medium tracking-widest text-white transition-all duration-300 drop-shadow-[0_0_5px_rgba(255,94,58,0.3)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                R&D
              </span>
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary opacity-100 shadow-[0_0_12px_#FF5E3A]" />
            </a>
          </li>
          
          <li aria-hidden="true" className="w-[1px] h-4 bg-white/10" />
          
          <li className="relative group/item">
            <a className="flex flex-col items-center px-2 py-1 focus:outline-none" href="#hub">
              <span className="font-body text-xs font-medium tracking-widest text-white/50 transition-all duration-300 group-hover/item:text-white group-hover/item:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                HUB
              </span>
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary opacity-0 transition-all duration-300 transform scale-0 group-hover/item:opacity-100 group-hover/item:scale-100 shadow-[0_0_10px_#FF5E3A]" />
            </a>
          </li>
          
          <li aria-hidden="true" className="w-[1px] h-4 bg-white/10" />
          
          <li className="relative group/item">
            <a className="flex flex-col items-center px-2 py-1 focus:outline-none" href="#contact">
              <span className="font-body text-xs font-medium tracking-widest text-white/50 transition-all duration-300 group-hover/item:text-white group-hover/item:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                CONTACT
              </span>
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary opacity-0 transition-all duration-300 transform scale-0 group-hover/item:opacity-100 group-hover/item:scale-100 shadow-[0_0_10px_#FF5E3A]" />
            </a>
          </li>
        </ul>
      </div>
      
      <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 flex flex-col gap-1 opacity-20">
        <div className="h-[1px] w-4 bg-gradient-to-r from-white to-transparent" />
        <div className="h-[1px] w-2 bg-gradient-to-r from-white to-transparent ml-1" />
      </div>
    </nav>
  );
}
