# ORCA — Conversational Marine Intelligence Frontend

**Smart India Hackathon | Problem Statement SIH26176 (ISRO)**  
**Marine EcOsystem Reasoning with Collaborative Agents**

ORCA is an agentic AI marine intelligence platform designed to empower Indian fishermen, coastal authorities, and deep-sea vessels. This frontend connects directly to the ORCA 9-agent backend pipeline running at `http://localhost:8000`.

---

## Key Features

1. **Natural Language Marine Inquiries**:
   - Supports conversational queries in English and 10 Indic languages: Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati, Bengali, Odia, or automatic language detection.
   - Preserves multi-turn context (e.g. *"Is it safe to fish near Mangalore tomorrow morning?"* followed by *"What about tomorrow evening?"*).

2. **Authoritative Safety Verdicts & Decision Explainability**:
   - Color-coded safety verdicts based on strict INCOIS / meteorological thresholds:
     - `SAFE` → Green (`#16a34a`)
     - `CAUTION` → Amber (`#d97706`)
     - `UNSAFE` → Red (`#dc2626`)
   - **"Why?" Decision Engine**: Reveals the exact `primary_drivers` and `evaluated_hierarchy` behind every verdict.
   - **Full Agent Pipeline Trace**: Inspects execution status, confidence ratings (0–100%), provenance sources, and telemetry from all 9 logical agents.

3. **Interactive Maritime Geospatial Map (Leaflet)**:
   - Full RFC 7946 GeoJSON compliance with `[longitude, latitude]` coordinate order.
   - **Vessel / Port Pin**: Blue marker (`#2563eb`) with ferry icon.
   - **Potential Fishing Zone (PFZ)**: Green marker (`#059669`) with star icon, showing Sea Surface Temperature (SST), Chlorophyll-a, suitability score, bearing, and target fish species.
   - **Navigation Course Vector**: Dashed blue line (`#0284c7`) connecting origin to recommended PFZ.
   - **Restricted Marine Boundaries**: Distinct red polygons (`#dc2626` fill, `#b91c1c` border) highlighting marine sanctuaries (e.g. Gahirmatha Olive Ridley Sanctuary, Gulf of Mannar) and naval defense perimeters (e.g. Karwar INS Kadamba / Project Seabird).
   - **Nationwide Restricted Zones Toggle**: Fetches `GET /zones` to overlay all registered national exclusion perimeters.
   - Automatic map boundary framing (`map.fitBounds`) on every query turn.

4. **Hourly Forecast Telemetry Charts (Recharts)**:
   - Evaluates Significant Wave Height (m), Sustained Wind Speed (km/h), Wind Gusts (km/h), Air Temperature (°C), and Precipitation (mm).
   - Authoritative reference lines for Caution (amber) and Danger (red) thresholds.
   - **Zero-Fabrication Guarantee**: If telemetry is unavailable, displays an advisory banner without rendering synthetic or extrapolated data.

5. **Multi-Tier Dissemination Router**:
   - **App Tier (`app`)**: Rich interactive web and mobile dashboard.
   - **Coastal Near-Shore (`boat_near_shore`)**: Simulated GSM SMS terminal strictly conforming to the 160-character budget.
   - **Offshore Deep-Sea (`boat_open_sea`)**: Simulated ISRO NAVIC / MSS S-Band Satellite telegram frame with NMEA checksum and hex bitfields.

---

## Project Structure

```
orca-frontend/
├── src/
│   ├── main.jsx                 # Mount point & Leaflet stylesheet
│   ├── App.jsx                  # Main dashboard layout
│   ├── api/
│   │   └── orcaClient.js        # POST /query, GET /health, GET /zones (configurable base URL)
│   ├── components/
│   │   ├── Header.jsx           # App branding, health badge, tier & language selectors
│   │   ├── ChatPanel.jsx        # Conversational feed, suggested queries, session reset
│   │   ├── MessageBubble.jsx    # User & ORCA bubbles with Markdown reports
│   │   ├── VerdictBadge.jsx     # Single source of truth for SAFE/CAUTION/UNSAFE colors
│   │   ├── WhyExpandable.jsx    # Primary drivers & safety hierarchy cards
│   │   ├── AgentTraceCard.jsx   # Generic & specialized trace card with confidence scores
│   │   ├── AgentTraceList.jsx   # Collapsible list of all 9 pipeline agents
│   │   ├── MapPanel.jsx         # RFC 7946 Leaflet map, popups, and national zones toggle
│   │   ├── ChartsPanel.jsx      # Recharts hourly forecast with threshold lines & zero-fab
│   │   ├── DispatchPanel.jsx    # App, GSM SMS, and ISRO NAVIC satellite views
│   │   ├── UserTypeToggle.jsx   # Switch between App, Near-Shore, and Open-Sea tiers
│   │   ├── LanguageSelector.jsx # 10 Indic languages + English selector
│   │   └── HealthBadge.jsx      # Live agent count badge ("● 9 agents active")
│   ├── utils/
│   │   ├── session.js           # Session UUID generation and multi-turn persistence
│   │   └── geojsonUtils.js      # Leaflet coordinate and bounds transformations
│   └── styles/
│       └── theme.css            # Deep oceanic glassmorphism and color variables
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Backend Base URL Configuration

The frontend connects to the backend via `VITE_BACKEND_BASE_URL`.

Create or edit `.env` in `orca-frontend/`:
```env
VITE_BACKEND_BASE_URL=http://localhost:8000
```

When deploying to staging or production, simply update this variable without modifying any source code.

---

## Setup & Running Locally

### 1. Prerequisites
- Node.js 18+ (tested on Node v24.17.0)
- npm 9+
- Backend running at `http://localhost:8000`

### 2. Install Dependencies
```bash
cd orca-frontend
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
The application will be accessible at:
```
http://localhost:3000
```

### 4. Build for Production
```bash
npm run build
```

---

## Verified Integration Points

| Endpoint | Method | Purpose | Verified Status |
|---|---|---|---|
| `/health` | `GET` | System liveness & 9 active agents check | **Verified** |
| `/zones` | `GET` | Nationwide marine sanctuaries and naval boundaries | **Verified** |
| `/query` | `POST` | Multi-agent reasoning pipeline & RFC 7946 GeoJSON | **Verified** |
| `/query` (Multi-Turn) | `POST` | Session context persistence across turns | **Verified** |
