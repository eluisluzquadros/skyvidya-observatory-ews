import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type {
  MunicipalityRisk,
  GeoJSONCollection,
  GeoJSONFeature,
  ChoroplethColorBy,
  LISAClusterData,
} from '../analyticsTypes';
import {
  RISK_CATEGORY_COLORS,
  TREND_COLORS,
  LISA_CLUSTER_COLORS,
  THREAT_COLORS,
} from '../analyticsTypes';

interface ChoroplethMapProps {
  riskData: MunicipalityRisk[];
  geojson: GeoJSONCollection | null;
  colorBy: ChoroplethColorBy;
  lisaVariable?: string;
  lisaClusters?: LISAClusterData | null;
  selectedMunicipality?: string | null;
  onMunicipalityClick?: (municipality: MunicipalityRisk) => void;
}



const ChoroplethMap: React.FC<ChoroplethMapProps> = ({
  riskData,
  geojson,
  colorBy,
  lisaVariable,
  lisaClusters,
  selectedMunicipality,
  onMunicipalityClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    name: string; uf: string;
    riskCategory: string; riskScore: number;
    trend: string; threat: string;
    population: number;
  } | null>(null);

  // Build lookup maps as useMemo so D3 effect reacts when data arrives
  const riskLookup = useMemo(() => {
    const map = new Map<string, MunicipalityRisk>();
    riskData.forEach(r => map.set(String(r.cd_mun), r));
    return map;
  }, [riskData]);

  const lisaLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (lisaClusters && lisaVariable) {
      const varData = lisaClusters.variables[lisaVariable];
      if (varData) {
        varData.municipalities.forEach(m => map.set(String(m.cd_mun), m.clusterType));
      }
    }
    return map;
  }, [lisaClusters, lisaVariable]);

  const threatColorMap = useMemo(() => {
    const threats = [...new Set(riskData.map(r => r.principalThreat))];
    const map = new Map<string, string>();
    threats.forEach((t, i) => map.set(String(t), THREAT_COLORS[i % THREAT_COLORS.length]));
    return map;
  }, [riskData]);

  const getColor = useCallback((feature: GeoJSONFeature): string => {
    const cdMun = String(feature.properties.CD_MUN);
    const risk = riskLookup.get(cdMun);

    switch (colorBy) {
      case 'riskCategory': {
        const cat = risk?.riskCategory || feature.properties.Risco_Ampliado_MCDA_Cat || '';
        return RISK_CATEGORY_COLORS[cat] || '#1e293b';
      }
      case 'trend': {
        const trend = risk?.trend || feature.properties.Tendencia_Eventos_Climaticos_Extremos || '';
        return TREND_COLORS[trend] || '#1e293b';
      }
      case 'principalThreat': {
        const threat = risk?.principalThreat || feature.properties.principal_ameaca || '';
        return threatColorMap.get(threat) || '#1e293b';
      }
      case 'lisaCluster': {
        const cluster = lisaLookup.get(cdMun);
        if (!cluster) return '#1e293b';
        for (const [key, color] of Object.entries(LISA_CLUSTER_COLORS)) {
          if (cluster.includes(key.split(' ')[0])) return color;
        }
        return LISA_CLUSTER_COLORS['N/A'];
      }
      default:
        return '#1e293b';
    }
  }, [colorBy, riskLookup, lisaLookup, threatColorMap]);

  // Main D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !geojson) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0B0F14');

    const g = svg.append('g');

    // Projection auto-fitted to Brazil's GeoJSON extent
    const projection = d3.geoMercator()
      .fitExtent([[16, 16], [width - 16, height - 16]], geojson as any);

    const pathGenerator = d3.geoPath().projection(projection);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Draw municipality polygons
    g.selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', (d: any) => pathGenerator(d) || '')
      .attr('fill', (d: any) => getColor(d))
      .attr('stroke', (d: any) => {
        const cdMun = String(d.properties?.CD_MUN);
        return cdMun === selectedMunicipality ? '#00D4FF' : 'rgba(255,255,255,0.12)';
      })
      .attr('stroke-width', (d: any) => {
        const cdMun = String(d.properties?.CD_MUN);
        return cdMun === selectedMunicipality ? 2 : 0.3;
      })
      .attr('opacity', 0.85)
      .attr('cursor', 'pointer')
      .on('mouseover', function(event: MouseEvent, d: any) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#00D4FF')
          .attr('stroke-width', 1.5);

        const cdMun = String(d.properties?.CD_MUN);
        const risk = riskLookup.get(cdMun);
        const rect = container.getBoundingClientRect();

        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          name: d.properties?.NM_MUN_SEM_ACENTO || risk?.name || 'N/A',
          uf: d.properties?.SIGLA_UF || risk?.uf || '',
          riskCategory: risk?.riskCategory || 'N/A',
          riskScore: risk?.riskScore || 0,
          trend: risk?.trend || 'N/A',
          threat: risk?.principalThreat || 'N/A',
          population: risk?.population || d.properties?.CENSO_2020_POP || 0,
        });
      })
      .on('mouseout', function(_, d: any) {
        const cdMun = String(d.properties?.CD_MUN);
        d3.select(this)
          .attr('opacity', 0.85)
          .attr('stroke', cdMun === selectedMunicipality ? '#00D4FF' : 'rgba(255,255,255,0.12)')
          .attr('stroke-width', cdMun === selectedMunicipality ? 2 : 0.3);
        setTooltip(null);
      })
      .on('click', (_, d: any) => {
        const cdMun = String(d.properties?.CD_MUN);
        const risk = riskLookup.get(cdMun);
        if (risk && onMunicipalityClick) {
          onMunicipalityClick(risk);
        }
      });

    // Cleanup
    return () => {
      svg.selectAll('*').remove();
    };
  }, [geojson, colorBy, selectedMunicipality, getColor, onMunicipalityClick, riskLookup]);

  // Get legend items based on colorBy mode
  const getLegendItems = () => {
    switch (colorBy) {
      case 'riskCategory':
        return Object.entries(RISK_CATEGORY_COLORS);
      case 'trend':
        return Object.entries(TREND_COLORS);
      case 'lisaCluster':
        return Object.entries(LISA_CLUSTER_COLORS).filter(([k]) => k !== 'N/A');
      case 'principalThreat': {
        const threats = [...new Set(riskData.map(r => r.principalThreat))].slice(0, 8);
        return threats.map(t => [t, threatColorMap.get(t) || '#666'] as [string, string]);
      }
      default:
        return [];
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none glass-panel p-3 rounded-lg text-xs font-mono"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            maxWidth: 280,
          }}
        >
          <div className="text-cyan-400 font-bold text-sm mb-1">
            {tooltip.name} - {tooltip.uf}
          </div>
          <div className="space-y-0.5 text-gray-300">
            <div>Risco: <span style={{ color: RISK_CATEGORY_COLORS[tooltip.riskCategory] || '#ccc' }} className="font-bold">{tooltip.riskCategory}</span> ({(tooltip.riskScore * 100).toFixed(1)}%)</div>
            <div>Tendência: <span style={{ color: TREND_COLORS[tooltip.trend] || '#ccc' }} className="font-bold">{tooltip.trend}</span></div>
            <div>Ameaça: <span className="text-white">{tooltip.threat}</span></div>
            <div>Pop: {tooltip.population.toLocaleString('pt-BR')}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 glass-panel p-3 rounded-lg text-xs font-mono">
        <div className="text-gray-400 mb-2 uppercase tracking-wider text-[10px]">
          {colorBy === 'riskCategory' ? 'Categoria de Risco' :
           colorBy === 'trend' ? 'Tendência' :
           colorBy === 'principalThreat' ? 'Ameaça Principal' :
           'Cluster LISA'}
        </div>
        <div className="space-y-1">
          {getLegendItems().map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-300 truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => {
            if (!svgRef.current) return;
            d3.select(svgRef.current).transition().duration(300).call(
              d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.5
            );
          }}
          className="glass-panel w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white transition-colors"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => {
            if (!svgRef.current) return;
            d3.select(svgRef.current).transition().duration(300).call(
              d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.67
            );
          }}
          className="glass-panel w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white transition-colors"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => {
            if (!svgRef.current) return;
            d3.select(svgRef.current).transition().duration(300).call(
              d3.zoom<SVGSVGElement, unknown>().transform as any,
              d3.zoomIdentity
            );
          }}
          className="glass-panel w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-white transition-colors"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Stats badge */}
      {riskData.length > 0 && (
        <div className="absolute top-4 left-4 glass-panel px-3 py-1.5 rounded text-xs font-mono text-gray-400">
          {riskData.length} municípios
        </div>
      )}
    </div>
  );
};

export default ChoroplethMap;
