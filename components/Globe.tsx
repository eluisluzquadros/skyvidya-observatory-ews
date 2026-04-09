import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Play, Pause } from 'lucide-react';
import { DisasterDecree } from '../types';

interface GlobeProps {
  data: DisasterDecree[];
  onPointClick?: (point: DisasterDecree) => void;
  selectedEvent?: DisasterDecree | null;
}

const STATE_COORDS: Record<string, [number, number]> = {
  'SC': [-49.38, -27.59], 'RS': [-51.22, -30.03], 'PR': [-51.46, -25.43],
  'SP': [-46.63, -23.55], 'RJ': [-43.17, -22.91], 'MG': [-44.28, -18.51],
  'BA': [-41.68, -12.97], 'PE': [-37.73, -8.01], 'CE': [-39.32, -5.19],
  'AM': [-63.02, -3.12], 'PA': [-52.29, -3.42], 'MT': [-55.91, -12.64],
  'GO': [-49.26, -15.83], 'MS': [-54.62, -20.44], 'ES': [-40.31, -19.18],
  'RN': [-36.52, -5.79], 'PB': [-36.62, -7.12], 'AL': [-36.62, -9.57],
  'SE': [-37.07, -10.91], 'PI': [-42.68, -8.09], 'MA': [-44.28, -5.53],
  'TO': [-48.33, -10.18], 'RO': [-63.90, -11.50], 'AC': [-70.47, -9.97],
  'RR': [-60.67, 2.82], 'AP': [-51.07, 0.90], 'DF': [-47.88, -15.79]
};

const getSeverityColor = (severity: number = 2): string => {
  const colors: Record<number, string> = {
    1: '#4ade80', 2: '#00d4ff', 3: '#ffb800', 4: '#f87171', 5: '#ff3a3a',
  };
  return colors[severity] || '#00d4ff';
};

const Globe: React.FC<GlobeProps> = ({ data, onPointClick, selectedEvent }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // d3 geoOrthographic.rotate([lambda, phi]) where lambda=-lon, phi=-lat
  // Brazil: lon=-51.93, lat=-14.24 → rotate([51.93, 14.24])
  const rotationRef = useRef<[number, number]>([51.93, 14.24]);
  const isDraggingRef = useRef(false);
  const timerRef = useRef<d3.Timer | null>(null);

  const [tooltip, setTooltip] = useState<{ x: number, y: number, data: DisasterDecree } | null>(null);
  // Start paused by default
  const isPausedRef = useRef(true);
  const [isPaused, setIsPaused] = useState(true);

  const togglePause = () => {
    setIsPaused(prev => {
      isPausedRef.current = !prev;
      return !prev;
    });
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const sensitivity = 75;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    // Defs for gradients and filters
    const defs = svg.append('defs');

    // Globe shadow/glow
    const globeGlow = defs.append('radialGradient').attr('id', 'globe-glow');
    globeGlow.append('stop').attr('offset', '0%').attr('stop-color', '#0a1628').attr('stop-opacity', 1);
    globeGlow.append('stop').attr('offset', '85%').attr('stop-color', '#060810').attr('stop-opacity', 1);
    globeGlow.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0);

    // Atmosphere glow
    const atmosphere = defs.append('radialGradient').attr('id', 'atmosphere');
    atmosphere.append('stop').attr('offset', '88%').attr('stop-color', 'transparent');
    atmosphere.append('stop').attr('offset', '95%').attr('stop-color', 'rgba(0,212,255,0.08)');
    atmosphere.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,212,255,0.02)');

    // Drop shadow for points
    const dropShadow = defs.append('filter').attr('id', 'point-glow');
    dropShadow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3');

    const projection = d3.geoOrthographic()
      .scale(Math.min(width, height) * 0.42)
      .center([0, 0])
      .rotate(rotationRef.current)  // stored as [lambda, phi] = [-lon, -lat]
      .translate([width / 2, height / 2]);

    const initialScale = projection.scale();
    const path = d3.geoPath().projection(projection);

    // Atmosphere ring
    svg.append('circle')
      .attr('class', 'globe-atmosphere')
      .attr('cx', width / 2).attr('cy', height / 2).attr('r', initialScale + 12)
      .attr('fill', 'url(#atmosphere)');

    // Globe background
    svg.append('circle')
      .attr('class', 'globe-bg')
      .attr('cx', width / 2).attr('cy', height / 2).attr('r', initialScale)
      .attr('fill', 'url(#globe-glow)')
      .attr('stroke', 'rgba(0,212,255,0.12)')
      .attr('stroke-width', '0.5');

    // Graticule
    const graticule = d3.geoGraticule().step([15, 15]);
    svg.append('path')
      .datum(graticule())
      .attr('d', path as any)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(30,42,58,0.5)')
      .attr('stroke-width', '0.3');

    // Load World Data
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson').then((worldData: any) => {
      // Countries
      svg.append('g')
        .selectAll('path')
        .data(worldData.features)
        .enter()
        .append('path')
        .attr('d', path as any)
        .attr('fill', '#0c1220')
        .attr('stroke', 'rgba(30,60,90,0.6)')
        .attr('stroke-width', '0.4');

      // Event points
      const pointsGroup = svg.append('g').attr('class', 'points-layer');

      const renderPoints = () => {
        pointsGroup.selectAll('*').remove();

        data.forEach(d => {
          const coords: [number, number] = [
            d.lng ?? STATE_COORDS[d.uf]?.[0] ?? -47.88,
            d.lat ?? STATE_COORDS[d.uf]?.[1] ?? -15.79,
          ];

          // Check if point is visible on current rotation
          const angle = d3.geoDistance(coords, [-projection.rotate()[0], -projection.rotate()[1]]);
          if (angle > Math.PI / 2) return;

          const projected = projection(coords);
          if (!projected) return;

          const color = getSeverityColor(d.severity);
          const isSelected = selectedEvent?.id === d.id;
          const baseRadius = d.severity ? d.severity * 1.5 + 2 : 4;

          const g = pointsGroup.append('g')
            .style('cursor', 'pointer')
            .on('click', () => {
              setTooltip(null);
              onPointClick?.(d);
            })
            .on('mouseenter', (event) => {
              setTooltip({ x: event.clientX, y: event.clientY, data: d });
            })
            .on('mousemove', (event) => {
              setTooltip({ x: event.clientX, y: event.clientY, data: d });
            })
            .on('mouseleave', () => setTooltip(null));

          // Outer glow pulse
          g.append('circle')
            .attr('cx', projected[0]).attr('cy', projected[1])
            .attr('r', baseRadius * 3)
            .attr('fill', color)
            .attr('opacity', 0.08)
            .attr('filter', 'url(#point-glow)');

          // Pulse ring
          const pulse = g.append('circle')
            .attr('cx', projected[0]).attr('cy', projected[1])
            .attr('r', baseRadius)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 0.8)
            .attr('opacity', 0.6);

          pulse.append('animate')
            .attr('attributeName', 'r')
            .attr('values', `${baseRadius};${baseRadius * 3.5};${baseRadius}`)
            .attr('dur', `${2 + Math.random()}s`)
            .attr('repeatCount', 'indefinite');

          pulse.append('animate')
            .attr('attributeName', 'opacity')
            .attr('values', '0.5;0.1;0.5')
            .attr('dur', `${2 + Math.random()}s`)
            .attr('repeatCount', 'indefinite');

          // Core point
          g.append('circle')
            .attr('cx', projected[0]).attr('cy', projected[1])
            .attr('r', isSelected ? baseRadius * 1.3 : baseRadius)
            .attr('fill', color)
            .attr('opacity', isSelected ? 1 : 0.85)
            .attr('stroke', isSelected ? '#fff' : 'none')
            .attr('stroke-width', isSelected ? 1.5 : 0);
        });
      };

      renderPoints();

      // Drag
      const drag = d3.drag()
        .on('start', () => { isDraggingRef.current = true; })
        .on('drag', (event) => {
          const rotate = projection.rotate();
          const k = sensitivity / projection.scale();
          const newRotation: [number, number] = [
            rotate[0] + event.dx * k,
            rotate[1] - event.dy * k,
          ];
          projection.rotate([newRotation[0], newRotation[1], 0]);
          rotationRef.current = [newRotation[0], newRotation[1]];
          svg.selectAll('path').attr('d', path as any);
          renderPoints();
        })
        .on('end', () => { isDraggingRef.current = false; });

      svg.call(drag as any);

      // Zoom
      const zoom = d3.zoom()
        .scaleExtent([0.5, 4])
        .on('zoom', (event) => {
          projection.scale(initialScale * event.transform.k);

          svg.selectAll('path').attr('d', path as any);

          svg.select('.globe-bg').attr('r', initialScale * event.transform.k);
          svg.select('.globe-atmosphere').attr('r', (initialScale * event.transform.k) + 12);

          renderPoints();
        });

      svg.call(zoom as any);

      // Slow auto-rotation
      if (timerRef.current) timerRef.current.stop();
      timerRef.current = d3.timer(() => {
        if (isDraggingRef.current || isPausedRef.current) return;
        const rotate = projection.rotate();
        projection.rotate([rotate[0] + 0.08, rotate[1], 0]);
        svg.selectAll('path').attr('d', path as any);
        renderPoints();
      });
    });

    return () => {
      if (timerRef.current) timerRef.current.stop();
    };
  }, [data, selectedEvent]);

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at center, #080c16 0%, #040610 70%, #000 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid overlay */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' }} />

      {/* Globe Controls HUD */}
      <div className="font-mono" style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
      }}>
        <button
          onClick={togglePause}
          style={{
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,212,255,0.25)',
            color: 'var(--cyan)', padding: '6px 10px', borderRadius: 4,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.55rem', transition: 'all 0.2s', textTransform: 'uppercase',
            letterSpacing: '0.08em', outline: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
        >
          {isPaused ? <Play size={10} /> : <Pause size={10} />}
          <span>{isPaused ? 'ROTATION: PAUSADA' : 'ROTATION: ATIVA'}</span>
        </button>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: 'S1 Baixo', color: '#4ade80' },
          { label: 'S2 Moderado', color: '#00d4ff' },
          { label: 'S3 Elevado', color: '#ffb800' },
          { label: 'S4 Alto', color: '#f87171' },
          { label: 'S5 Crítico', color: '#ff3a3a' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
            <span className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l.label}</span>
          </div>
        ))}
      </div>

      <svg ref={svgRef} style={{ cursor: 'grab', width: '100%', height: '100%' }} />

      {/* Data Tooltip */}
      {tooltip && (
        <div
          className="hud-border font-mono"
          style={{
            position: 'fixed',
            left: tooltip.x + 15,
            top: tooltip.y + 15,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-primary)',
            padding: '10px 14px',
            color: 'white',
            zIndex: 9999,
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.1)',
            minWidth: 180
          }}
        >
          <div style={{ fontSize: '0.5rem', color: 'var(--cyan)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {tooltip.data.uf} • {tooltip.data.type}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white', marginBottom: 6 }}>
            {tooltip.data.municipality}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>Afetados:</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--amber)', fontWeight: 'bold' }}>
              {tooltip.data.affected?.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Globe;
