<div align="center">
<img width="800" alt="Skyvidya Observatory" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Skyvidya Observatory EWS (S2ID Disaster Monitor V2)
</div>

A high-performance "Command Center" inspired WebGIS dashboard for analyzing and monitoring natural disasters across Brazil. Initially built to aggregate data from the Brazilian Government's **S2ID** and **Atlas Digital**, it has been revamped into a state-of-the-art interactive 3D Globe visualization.

## Features
- **3D Globe Visualization:** Interactive Earth mapped with real-time disaster points (D3.js). Features pan, zoom, auto-rotation (Play/Pause), and live hover tooltips.
- **Command Center Aesthetics:** High-contrast `'#0B0F14'` glassmorphism UI styled with vibrant orange and cyan accents, inspired by Palantir and Skyvidya.
- **Data Ingestion:** Scrapes S2ID / generates robust 30-year historical fallback records (1994-2024) to ensure data-rich local demonstrations.

## Run Locally

**Prerequisites:** Node.js v18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key (for upcoming AI assistant features).
3. Run the application:
   ```bash
   npm run dev
   ```
The app and WebSocket server will start and be available at `http://localhost:5173`.
