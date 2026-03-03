# PRD - S2ID Disaster Monitor (Antigravity)

## 1. Introduction
The S2ID Disaster Monitor is a specialized platform designed to aggregate, analyze, and visualize disaster data from the Brazilian Government's **S2ID (Sistema Integrado de Informações sobre Desastres)** and **Atlas Digital** platforms. The goal is to provide a unified dashboard for monitoring disaster records ("Danos Informados", "Reconhecimentos Vigentes", etc.) and historical data.

## 2. Objectives
- **Automate Data Collection:** Remove manual effort in collecting reports from S2ID and Atlas Digital. ✅
- **Centralize Information:** Store all disaster data in a unified database. ✅
- **Real-time Monitoring:** Provide a dashboard that reflects the latest available data. ✅
- **Historical Analysis:** Enable visualization of disaster trends over time (1991-2024+). ✅

## 3. Core Features

### 3.1. Data Collection (Backend) ✅
- **S2ID Scraper:**
    - [x] Automated CSV export from S2ID reports using Puppeteer.
    - [x] Handling of "Select All" states and specific disaster types.
    - [x] Date range handling and input masking fixes.
    - [x] Download detection and verification (mtime-based).
    - [x] User-Agent spoofing for headless mode.
    - [x] Scheduled cron jobs for daily updates (6 AM).
- **Atlas Digital:**
    - [x] Direct CSV download for historical data (~17MB file).
    - [x] Weekly update schedule (Sundays 3 AM).
    - [x] 24-hour caching to avoid redundant downloads.
- **Manual Import:**
    - [x] Validated script to import manually downloaded S2ID CSVs.
    - [x] Robust encoding detection (UTF-8 / Latin-1).

### 3.2. Data Management ✅
- **Database:** JSON-based storage with 45,942 records.
- **Deduplication:** Logic to prevent duplicate records based on unique keys (Municipality + Date + Type).
- **Status Tracking:** Log of successful/failed scrape attempts with timestamps.

### 3.3. Frontend Dashboard ✅
- **Command Center UI/UX:** High-contrast, glassmorphism design with `Space Grotesk` and `JetBrains Mono` typography inspired by Skyvidya/Palantir.
- **3D Globe Visualization:** Interactive 3D D3.js Earth visualization mapped with real-time disaster points.
- **Interactive Controls:** Auto-rotation toggle (Play/Pause), pan-and-drag, and robust zoom capabilities.
- **Interactive Tooltips:** Live data hover states showing specific Disaster details (UF, Type, Municipality, Population Affected).
- **Overview:** KPIs (Total Disasters, Affected Population, Active Recognitions) rendered in Skyvidya-style HUD cards.
- **Charts:** Distribution by disaster type and state impact using Recharts.
- **Data Table:** Paginated list of recent records with active status indicators.

### 3.4. API Endpoints ✅
- `GET /api/disasters` - List with filters (uf, type, limit, offset).
- `GET /api/stats` - Aggregate statistics.
- `GET /api/status` - Collection and scheduler status.
- `GET /api/scrape` - Scrapes S2ID / generates 30 years historical fallback data (1994-2024).

## 4. Technical Architecture
- **Frontend:** React (Vite) + TailwindCSS + D3.js + Lucide React + Recharts.
- **Backend:** Node.js + Express + Puppeteer + Socket.io (for live stream updates).
- **Database:** JSON file storage (~15MB, ~46K records).
- **Scheduling:** node-cron for automated collection.

## 5. Current Statistics (as of 2025-12-16)
| Metric | Value |
|--------|-------|
| Total Records | 45,942 |
| Atlas Records | 42,734 |
| S2ID Records | 3,208 |
| Top State | MG (5,716 records) |
| Top Disaster Type | Estiagem (19,741 records) |
| Date Coverage | 1991 - 2024 |
| Affected Population | ~28.5 million |

## 6. Future Enhancements
- [ ] **Advanced Search:** Global search across all indexed events.
- [ ] **Export Feature:** Download filtered data as CSV/Excel.
- [ ] **Notifications:** Email/Slack alerts for failed collections via WebSockets.
- [ ] **Auth / Accounts:** User login for admin operations.
- [ ] **Financial APIs:** Track market impact (B3/IBOVESPA) of critical disasters.
- [ ] **COMEX STAT:** Track import/export supply chain bottlenecks.
- [ ] **Migration to PostgreSQL:** For better scalability instead of flat JSON.

## 7. Success Metrics
- ✅ Successful daily scrape of S2ID reports without intervention.
- ✅ Accurate parsing of 100% of valid CSV records.
- ✅ Dashboard functional with real data in 3D "Command Center" UI.
- [ ] Dashboard load time < 2s (needs optimization with pagination).
