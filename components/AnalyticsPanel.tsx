import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, FileText, Loader2, Image, Download, X as XIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type {
  MunicipalityRisk,
  AnalyticsDistributions,
  ChoroplethColorBy,
  ReportAsset,
  LLMReport,
} from '../analyticsTypes';
import { RISK_CATEGORY_COLORS, TREND_COLORS } from '../analyticsTypes';
import { generateRiskReport } from '../services/geminiService';
import { fetchReportAssets, generateLLMReport } from '../services/analyticsService';

interface AnalyticsPanelProps {
  riskData: MunicipalityRisk[];
  distributions: AnalyticsDistributions | null;
  lisaVariables: string[];
  selectedLisaVariable: string;
  onLisaVariableChange: (variable: string) => void;
  colorBy: ChoroplethColorBy;
  onColorByChange: (mode: ChoroplethColorBy) => void;
  onMunicipalityClick?: (municipality: MunicipalityRisk) => void;
}

const TrendIcon: React.FC<{ trend: string; size?: number }> = ({ trend, size = 12 }) => {
  if (trend === 'Crescente') return <TrendingUp size={size} className="text-red-400" />;
  if (trend === 'Decrescente') return <TrendingDown size={size} className="text-green-400" />;
  return <Minus size={size} className="text-yellow-400" />;
};

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  riskData,
  distributions,
  lisaVariables,
  selectedLisaVariable,
  onLisaVariableChange,
  colorBy,
  onColorByChange,
  onMunicipalityClick,
}) => {
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportAssets, setReportAssets] = useState<ReportAsset[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [llmReport, setLlmReport] = useState<LLMReport | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [selectedUF, setSelectedUF] = useState<string>('');
  const [llmExpanded, setLlmExpanded] = useState(false);

  useEffect(() => {
    fetchReportAssets().then(setReportAssets).catch(() => {});
  }, []);

  const handleGenerateLLMReport = async () => {
    setLlmLoading(true);
    setLlmError(null);
    setLlmReport(null);
    setLlmExpanded(true);
    try {
      const params = selectedUF ? { uf: selectedUF } : {};
      const report = await generateLLMReport(params);
      setLlmReport(report);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha na geração do relatório IA.';
      setLlmError(msg.includes('unavailable') ? 'Serviço Python offline. Inicie com npm run dev:all.' : msg);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const report = await generateRiskReport(riskData, distributions || undefined);
      setReportContent(report);
    } catch {
      setReportContent('> ERRO: Falha na geração do relatório.');
    } finally {
      setReportLoading(false);
    }
  };

  // Calculate KPIs
  const totalMunicipalities = riskData.length;
  const highRiskCount = riskData.filter(r => r.riskCategory === 'Alto' || r.riskCategory === 'Muito Alto').length;
  const highRiskPct = totalMunicipalities > 0 ? ((highRiskCount / totalMunicipalities) * 100).toFixed(1) : '0';
  const growingCount = riskData.filter(r => r.trend === 'Crescente').length;
  const growingPct = totalMunicipalities > 0 ? ((growingCount / totalMunicipalities) * 100).toFixed(1) : '0';

  // Get dominant threat
  const threatCounts = new Map<string, number>();
  riskData.forEach(r => {
    if (r.principalThreat !== 'Nenhuma Ameaça Dominante') {
      threatCounts.set(r.principalThreat, (threatCounts.get(r.principalThreat) || 0) + 1);
    }
  });
  const dominantThreat = [...threatCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Top 10 rankings
  const top10 = [...riskData].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  // Distribution chart data
  const riskChartData = distributions?.riskCategories?.map(d => ({
    name: d.category,
    value: d.count,
    fill: RISK_CATEGORY_COLORS[d.category] || '#666',
  })) || [];

  const trendChartData = distributions?.trends?.map(d => ({
    name: d.trend,
    value: d.count,
    fill: TREND_COLORS[d.trend] || '#666',
  })) || [];

  // Color-by selector options
  const colorByOptions: { value: ChoroplethColorBy; label: string }[] = [
    { value: 'riskCategory', label: 'Risco MCDA' },
    { value: 'trend', label: 'Tendência' },
    { value: 'principalThreat', label: 'Ameaça' },
    { value: 'lisaCluster', label: 'Cluster LISA' },
  ];

  if (totalMunicipalities === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6 text-center">
        <BarChart3 size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-mono">Dados de analytics não disponíveis.</p>
        <p className="text-xs mt-2 opacity-60">Execute o pipeline Python de analytics primeiro.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-panel rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Municípios</div>
          <div className="text-lg font-bold text-white font-mono">{totalMunicipalities}</div>
        </div>
        <div className="glass-panel rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Alto Risco</div>
          <div className="text-lg font-bold text-red-400 font-mono">{highRiskPct}%</div>
          <div className="text-[10px] text-gray-500">{highRiskCount} municípios</div>
        </div>
        <div className="glass-panel rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Crescente</div>
          <div className="text-lg font-bold text-amber-400 font-mono">{growingPct}%</div>
          <div className="text-[10px] text-gray-500">{growingCount} municípios</div>
        </div>
        <div className="glass-panel rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ameaça Dom.</div>
          <div className="text-sm font-bold text-cyan-400 font-mono truncate">
            {dominantThreat ? dominantThreat[0] : 'N/A'}
          </div>
          <div className="text-[10px] text-gray-500">{dominantThreat ? `${dominantThreat[1]} mun.` : ''}</div>
        </div>
      </div>

      {/* Map Color Mode Selector */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Colorir mapa por</div>
        <div className="flex flex-wrap gap-1">
          {colorByOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onColorByChange(opt.value)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                colorBy === opt.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISA Variable Selector (only when colorBy is lisaCluster) */}
      {colorBy === 'lisaCluster' && lisaVariables.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Variável LISA</div>
          <select
            value={selectedLisaVariable}
            onChange={(e) => onLisaVariableChange(e.target.value)}
            className="w-full bg-[#161B22] border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-gray-300 focus:border-cyan-500/50 focus:outline-none"
          >
            {lisaVariables.map(v => (
              <option key={v} value={v}>
                {v.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Risk Distribution Chart */}
      {riskChartData.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Distribuição de Risco</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData} layout="vertical" margin={{ left: 2, right: 8 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#9ca3af' }} width={65} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {riskChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Trend Distribution */}
      {trendChartData.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tendências</div>
          <div className="h-28 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trendChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {trendChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            {trendChartData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-gray-400">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 Rankings */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          Top 10 Maior Risco
        </div>
        <div className="space-y-1">
          {top10.map((mun, index) => (
            <button
              key={mun.cd_mun}
              onClick={() => onMunicipalityClick?.(mun)}
              className="w-full flex items-center gap-2 glass-panel rounded px-2.5 py-1.5 hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-[10px] text-gray-600 font-mono w-4 text-right">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200 font-mono truncate">
                  {mun.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{mun.uf}</span>
                  <span style={{ color: RISK_CATEGORY_COLORS[mun.riskCategory] }}>
                    {mun.riskCategory}
                  </span>
                  <TrendIcon trend={mun.trend} size={10} />
                </div>
              </div>
              <div className="text-xs font-mono text-right">
                <span style={{ color: RISK_CATEGORY_COLORS[mun.riskCategory] }}>
                  {(mun.riskScore * 100).toFixed(1)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate MCDA Risk Report */}
      <div>
        <button
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all"
          style={{
            background: reportLoading ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.3)',
            color: 'rgb(192,132,252)',
            cursor: reportLoading ? 'wait' : 'pointer',
          }}
        >
          {reportLoading ? (
            <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Gerando Relatório...</>
          ) : (
            <><FileText size={13} /> Gerar Relatório MCDA</>
          )}
        </button>

        {reportContent && (
          <div
            className="mt-2 glass-panel rounded-lg p-3 text-[11px] text-gray-300 leading-relaxed overflow-y-auto custom-scrollbar"
            style={{ maxHeight: 300, whiteSpace: 'pre-wrap' }}
          >
            {reportContent}
          </div>
        )}
      </div>

      {/* ── Relatório IA (FASE B) ── */}
      <div style={{ padding: '0 12px 12px' }}>
        <div className="font-mono" style={{
          fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <FileText size={10} style={{ color: 'var(--purple)' }} />
          Relatório IA por Escopo
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select
            value={selectedUF}
            onChange={e => setSelectedUF(e.target.value)}
            className="tactical-input font-mono"
            style={{ flex: 1, fontSize: '0.65rem', padding: '4px 8px' }}
          >
            <option value="">Brasil (Nacional)</option>
            {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
              'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
              .map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <button
            onClick={handleGenerateLLMReport}
            disabled={llmLoading}
            className="btn-tactical"
            style={{
              background: llmLoading ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.15)',
              borderColor: 'rgba(168,85,247,0.4)',
              color: 'rgb(192,132,252)',
              padding: '4px 10px',
              fontSize: '0.6rem',
              flexShrink: 0,
            }}
          >
            {llmLoading
              ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              : <><FileText size={11} /> Gerar</>
            }
          </button>
        </div>

        {llmError && (
          <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--red)', marginBottom: 6 }}>
            {'>'} ERRO: {llmError}
          </p>
        )}

        {llmReport && (
          <div style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.04)', padding: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="font-mono" style={{ fontSize: '0.6rem', color: 'rgb(192,132,252)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {llmReport.scope} — {new Date(llmReport.generatedAt).toLocaleDateString('pt-BR')}
              </span>
              <button
                onClick={() => setLlmExpanded(v => !v)}
                className="btn-tactical"
                style={{ fontSize: '0.55rem', padding: '2px 6px' }}
              >
                {llmExpanded ? '▲' : '▼'}
              </button>
            </div>

            {/* KPI badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: llmExpanded ? 8 : 0 }}>
              {[
                { label: 'Alto Risco', value: `${llmReport.kpis.high_risk_pct}%`, color: 'var(--primary)' },
                { label: 'Tendência', value: llmReport.kpis.dominant_trend, color: llmReport.kpis.dominant_trend === 'Crescente' ? 'var(--red)' : llmReport.kpis.dominant_trend === 'Decrescente' ? 'var(--green)' : 'var(--amber)' },
                { label: 'Principal', value: llmReport.kpis.principal_threat, color: 'var(--cyan)' },
              ].map(b => (
                <span key={b.label} className="font-mono" style={{ fontSize: '0.55rem', color: b.color, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', border: `1px solid ${b.color}40` }}>
                  {b.label}: {b.value}
                </span>
              ))}
            </div>

            {llmExpanded && (
              <div className="font-body" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {/* Summary */}
                <p style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{llmReport.summary}</p>

                {/* Risk Narrative */}
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Análise de Risco</div>
                <p style={{ marginBottom: 8 }}>{llmReport.riskNarrative}</p>

                {/* Recommendations */}
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Recomendações</div>
                <ol style={{ margin: '0 0 8px 16px', padding: 0 }}>
                  {llmReport.recommendations.map((rec, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>{rec}</li>
                  ))}
                </ol>

                {/* Impact Projection */}
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Projeção de Impacto</div>
                <p>{llmReport.impactProjection}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Relatório Visual ── */}
      {reportAssets.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div className="font-mono" style={{
            fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Image size={10} />
            Relatório Visual
          </div>

          {/* PNG thumbnails grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
            {reportAssets.filter(a => a.type === 'png').map(asset => (
              <button
                key={asset.filename}
                onClick={() => setLightboxSrc(asset.url)}
                title={asset.filename.replace(/_/g, ' ').replace('.png', '')}
                style={{
                  padding: 0, border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)', cursor: 'pointer',
                  overflow: 'hidden', aspectRatio: '4/3',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
              >
                <img
                  src={asset.url}
                  alt={asset.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {/* CSV downloads */}
          {reportAssets.filter(a => a.type === 'csv').map(asset => (
            <a
              key={asset.filename}
              href={asset.url}
              download={asset.filename}
              className="btn-tactical"
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, textDecoration: 'none', fontSize: '0.6rem' }}
            >
              <Download size={10} />
              <span className="font-mono">{asset.filename.replace(/_/g, ' ').replace('.csv', '').toUpperCase()}</span>
            </a>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.9)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer', color: 'white',
            }}
          >
            <XIcon size={24} />
          </button>
          <img
            src={lightboxSrc}
            alt="Report asset"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
