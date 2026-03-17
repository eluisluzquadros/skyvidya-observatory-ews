import React from 'react';
import { Globe2, Map } from 'lucide-react';

interface ViewToggleProps {
  activeView: 'globe' | 'map';
  onToggle: (view: 'globe' | 'map') => void;
  analyticsAvailable: boolean;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ activeView, onToggle, analyticsAvailable }) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 glass-panel rounded-lg p-0.5">
      <button
        onClick={() => onToggle('globe')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
          activeView === 'globe'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Globe2 size={13} />
        Globe
      </button>
      <button
        onClick={() => analyticsAvailable && onToggle('map')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
          activeView === 'map'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : analyticsAvailable
              ? 'text-gray-500 hover:text-gray-300'
              : 'text-gray-700 cursor-not-allowed'
        }`}
        title={analyticsAvailable ? 'Mapa Analítico' : 'Execute o pipeline de analytics primeiro'}
      >
        <Map size={13} />
        Mapa Analítico
      </button>
    </div>
  );
};

export default ViewToggle;
