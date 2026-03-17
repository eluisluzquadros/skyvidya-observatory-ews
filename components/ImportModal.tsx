import React, { useState } from 'react';
import { X, Upload, FileText, Terminal, Loader2, CheckCircle } from 'lucide-react';
import { DisasterDecree } from '../types';
import { parseS2IDData } from '../services/geminiService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: DisasterDecree[]) => void;
  onRefresh?: () => void;
}

const PUPPETEER_SCRIPT = `// Script para extração automática do S2ID
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://s2id.mi.gov.br/paginas/relatorios/');
  await page.waitForSelector('.tabela-dados', { timeout: 30000 });
  
  const data = await page.evaluate(() => {
    const rows = document.querySelectorAll('.tabela-dados tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('td');
      return Array.from(cells).map(c => c.textContent?.trim());
    });
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();`;

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, onRefresh }) => {
  const [rawData, setRawData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'script'>('paste');

  const handleParse = async () => {
    if (!rawData.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const parsed = await parseS2IDData(rawData);
      if (parsed.length > 0) {
        onImport(parsed);
        setSuccess(true);
        setTimeout(() => { onClose(); setSuccess(false); setRawData(''); }, 1500);
      } else {
        setError('Nenhum dado válido encontrado.');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao processar dados.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} />

      <div className="animate-fade-in" style={{
        position: 'relative', width: 520, maxHeight: '80vh',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload style={{ width: 16, height: 16, color: 'var(--blue)' }} />
            <h2 className="font-display" style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
              Importar Dados S2ID
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)' }}>
          {[
            { key: 'paste' as const, label: 'Colar Dados', icon: FileText },
            { key: 'script' as const, label: 'Script Automático', icon: Terminal },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="font-mono"
              style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: activeTab === tab.key ? 'var(--blue)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
              }}
            >
              <tab.icon style={{ width: 12, height: 12 }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          {activeTab === 'paste' ? (
            <>
              <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                Cole dados copiados do sistema S2ID, CSV, JSON, ou texto livre com informações de decretos.
                A IA irá extrair e estruturar automaticamente.
              </p>
              <textarea
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
                placeholder="Cole aqui os dados do S2ID..."
                className="tactical-input font-mono"
                style={{
                  width: '100%', minHeight: 180, resize: 'vertical',
                  fontSize: '0.65rem', lineHeight: 1.6,
                }}
              />
              {error && (
                <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--red)', marginTop: 8 }}>
                  {'>'} ERRO: {error}
                </p>
              )}
              {success && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <CheckCircle style={{ width: 14, height: 14, color: 'var(--green)' }} />
                  <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--green)' }}>DADOS IMPORTADOS COM SUCESSO</span>
                </div>
              )}
              <button
                onClick={handleParse}
                disabled={!rawData.trim() || loading}
                className="btn-tactical primary"
                style={{ marginTop: 12, width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                {loading ? (
                  <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Processando...</>
                ) : (
                  <><Upload style={{ width: 14, height: 14 }} /> Importar e Processar</>
                )}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p className="font-body" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5, textAlign: 'center' }}>
                Conectar ao módulo <strong>S2ID SC-1 (Scraper)</strong> no servidor backend. <br />
                Isto fará a extração automática dos dados do portal S2ID em tempo real usando Puppeteer headless.
              </p>

              {error && (
                <p className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--red)', marginBottom: 12 }}>
                  {'>'} ERRO: {error}
                </p>
              )}
              {success && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <CheckCircle style={{ width: 14, height: 14, color: 'var(--green)' }} />
                  <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--green)' }}>INGESTÃO AUTOMÁTICA CONCLUÍDA</span>
                </div>
              )}

              <button
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  setSuccess(false);
                  try {
                    const res = await fetch('/api/refresh', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ source: 's2id' }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Erro ao conectar ao scraper.');
                    const count = json.data?.s2id ?? 0;
                    if (onRefresh) onRefresh();
                    if (count === 0) {
                      setError('Scraper executado, mas nenhum novo registro encontrado.');
                    } else {
                      setSuccess(true);
                      setTimeout(() => { onClose(); setSuccess(false); }, 2000);
                    }
                  } catch (err: any) {
                    setError(err.message || 'Falha na conexão com servidor.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="btn-tactical primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center', background: 'rgba(0, 212, 255, 0.1)' }}
              >
                {loading ? (
                  <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> VASCULHANDO REDE S2ID...</>
                ) : (
                  <><Terminal style={{ width: 16, height: 16 }} /> Iniciar Ingestão Automática</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;