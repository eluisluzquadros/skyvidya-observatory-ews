# S2ID Disaster Monitor - Automação de Dados

## ✅ Status da Implementação

### Backend (server/) - Funcionando ✅
Servidor Node.js/TypeScript para coleta automatizada:

| Componente | Status | Descrição |
|------------|--------|-----------|
| API REST | ✅ Funcionando | Endpoints em localhost:3001 |
| Atlas Digital | ✅ Funcionando | 42.734 registros históricos coletados |
| S2ID Scraper | ⚠️ Parcial | Estrutura pronta, download pendente |
| Import Manual | ✅ Funcionando | Script para importar CSV baixado |
| Scheduler | ✅ Funcionando | Diário/Semanal configurado |

### Frontend - Funcionando ✅
- Detecta backend automaticamente
- Mostra "Backend Online" quando conectado
- Carrega dados reais do Atlas Digital

---

## 📊 Dados Disponíveis

### Atlas Digital (Coletado Automaticamente)
- **42.734 registros** de desastres históricos
- **Período**: 1991-2024
- **Tipos**: Estiagem, Enxurrada, Chuvas Intensas, Inundações, etc.

### S2ID (Importação Manual)
Para dados mais recentes do S2ID, siga as instruções abaixo.

---

## 🚀 Como Usar

### 1. Iniciar Backend
```bash
cd server
npm install
npm run dev
```
Backend disponível em: http://localhost:3001

### 2. Iniciar Frontend
```bash
# Em outro terminal
npm run dev
```
Frontend disponível em: http://localhost:3000

---

## 📥 Importar Dados do S2ID (Manual)

Como o scraper automático ainda está em desenvolvimento, você pode importar CSVs manualmente:

### Passo 1: Baixar CSV do S2ID
1. Acesse https://s2id.mi.gov.br/paginas/relatorios/
2. Clique em "Relatório Gerencial - Danos informados"
3. Configure:
   - **Período**: 01/01/2025 até data atual (máximo 365 dias)
   - **Desastre**: Todas as tipologias
   - **Estado**: Todos os estados
4. Clique em "Exportar CSV"

### Passo 2: Importar no Sistema
```bash
cd server
npm run import:s2id "caminho\para\Danos_Informados.csv" danos-informados
```

Tipos disponíveis:
- `danos-informados`
- `reconhecimentos-vigentes`
- `reconhecimentos-realizados`

---

## 🔧 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/disasters` | Lista desastres (com filtros) |
| GET | `/api/stats` | Estatísticas agregadas |
| GET | `/api/status` | Status das coletas |
| POST | `/api/refresh` | Dispara coleta manual |
| GET | `/api/health` | Health check |

### Filtros para `/api/disasters`
- `?uf=RS` - Filtrar por estado
- `?type=Estiagem` - Filtrar por tipo
- `?limit=100` - Limitar resultados
- `?source=atlas` - Filtrar por fonte (atlas/s2id)

---

## ⏰ Agendamento Automático

| Tarefa | Frequência | Horário |
|--------|------------|---------|
| Atlas Digital | Semanal | Domingo 03:00 |
| S2ID (quando funcionar) | Diário | 06:00 |

---

## 📁 Estrutura de Arquivos

```
s2id-disaster-monitor/
├── server/                    # Backend
│   ├── src/
│   │   ├── collectors/
│   │   │   ├── atlasDigital.ts    # ✅ Funcionando
│   │   │   └── s2idScraper.ts     # ⚠️ Em desenvolvimento
│   │   ├── services/
│   │   │   ├── storage.ts         # JSON storage
│   │   │   ├── scheduler.ts       # Agendador
│   │   │   └── logger.ts          # Logging
│   │   ├── routes/api.ts          # API REST
│   │   ├── scripts/
│   │   │   ├── collectAtlas.ts    # Coleta Atlas
│   │   │   ├── collectS2ID.ts     # Coleta S2ID (auto)
│   │   │   └── importS2IDCSV.ts   # Import manual
│   │   └── index.ts               # Entry point
│   └── data/
│       ├── database.json          # Banco de dados
│       └── atlas/atlas_data.csv   # CSV original
├── services/
│   ├── geminiService.ts       # Gemini AI
│   └── apiService.ts          # Cliente API
├── App.tsx                    # Dashboard
└── AUTOMATION.md              # Esta documentação
```

---

## ⚠️ Limitações Conhecidas

1. **S2ID Scraper**: O download automático via Puppeteer não está funcionando devido a restrições do site. Use o import manual por enquanto.

2. **S2ID Período**: Máximo de 365 dias por consulta. Para histórico completo, faça múltiplas consultas.

3. **Gemini API**: Para análises de IA funcionarem, configure `GEMINI_API_KEY` no `.env.local`.

---

## 🐛 Troubleshooting

### Backend não inicia
```bash
cd server
npm install
npm run dev
```

### Frontend não carrega dados
1. Verifique se o backend está rodando em localhost:3001
2. Confira http://localhost:3001/api/health

### CSV não importa
```bash
# Verifique se o arquivo existe
npm run import:s2id "C:\Users\seu_user\Downloads\arquivo.csv"
```
