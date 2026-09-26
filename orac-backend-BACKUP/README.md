# ORCA — Agentic Marine Intelligence Platform

**Smart India Hackathon | Problem Statement SIH26176 (ISRO)**

ORCA is an agentic AI marine intelligence backend designed to empower Indian fishermen, coastal authorities, and marine researchers. A user submits a natural-language query (e.g., *"Is it safe to fish near Mangalore tomorrow?"*), and ORCA routes it through a 9-agent pipeline that analyzes live atmospheric weather, ocean wave telemetry, INCOIS Potential Fishing Zones (PFZ), and maritime geofencing under a deterministic safety rule hierarchy.

---

## Architecture Overview

```
                          User Request
                               │
                               ▼
                   [1. User Interaction Agent] (Bhashini Multi-Lingual)
                               │
                               ▼
                    [2. Planning Agent] (Claude Intent & Plan)
                               │
                               ▼
                 [3. Marine Data Discovery Agent]
                 ├── Live Open-Meteo Weather API
                 └── INCOIS PFZ Mission Feed (Modular Mock)
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
[4. Weather Intelligence] [5. Ocean Analytics] [6. Geospatial Reasoning]
(Thresholds: Wind/Wave)   (SST / Chlorophyll)  (Haversine / Geofencing)
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                   [7. Risk Assessment Agent]
                (Deterministic Safety Hierarchy)
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
[8. Visualization Agent]                    [9. Reporting Agent]
(GeoJSON Map & Charts)                     (Claude Evidence Synthesis)
         │                                           │
         └─────────────────────┬─────────────────────┘
                               ▼
                  [Dissemination Router]
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ["app" Tier]      ["boat_near_shore"]      ["boat_open_sea"]
(Rich REST JSON)     (GSM SMS <= 160 chars)  (Simulated ISRO NAVIC / DAT)
                               │
                               ▼
                    [User Interaction Agent] (Egress Translation)
                               │
                               ▼
                            Client
```

---

## Priority Tiers Implementation

| Tier | Component | Status | Description |
|---|---|---|---|
| **Tier 1** | **User Interaction Agent** | **Complete** | Bhashini language detection, English normalization, regional egress |
| **Tier 1** | **Planning Agent** | **Complete** | Claude intent parsing, entity extraction, task pipeline orchestration |
| **Tier 1** | **Weather Intelligence Agent** | **Complete** | Live Open-Meteo data evaluation, safety threshold compliance |
| **Tier 1** | **Ocean Analytics Agent** | **Complete** | SST thermal front and chlorophyll-a ranking for PFZ advisories |
| **Tier 1** | **Risk Assessment Agent** | **Complete** | Deterministic safety rule hierarchy arbiter |
| **Tier 2** | **Marine Data Discovery Agent** | **Complete** | Multi-source discovery, live API queries, provenance tagging |
| **Tier 2** | **Geospatial Reasoning Agent** | **Complete** | Haversine distance calculations, Shapely geofence compliance |
| **Tier 3** | **Visualization Agent** | **Complete** | GeoJSON features (pins, vectors, restricted zones) & hourly forecast charts |
| **Tier 3** | **Reporting Agent** | **Complete** | Claude evidence-grounded synthesis citing exact metrics |
| **Tier 3** | **Dissemination Router** | **Complete** | Dynamic routing for App, 2G SMS (<160 chars), and NAVIC satellite |

---

## Real vs. Mock Integrations

1. **Weather Data (REAL):**
   - Live calls to **Open-Meteo Weather & Marine API** (no API key required).
   - Fetches live wind speed, wind gusts, wave height, wave period, and hourly forecast arrays.
2. **Language & Translation (REAL + FALLBACK):**
   - Pluggable client for **Bhashini ULCA / Dhruva API**.
   - If credentials are empty or the service is unreachable, gracefully falls back without crashing.
3. **LLM Orchestration (REAL + RESILIENT FALLBACK):**
   - Uses Anthropic **Claude 3.5 Sonnet** via `anthropic` SDK.
   - If `ANTHROPIC_API_KEY` is not provided, automatically engages a deterministic fallback intent parser and evidence-grounded synthesizer.
4. **Ocean / PFZ Data (MODULAR MOCK):**
   - Simulated behind an abstract `OceanDataProvider` interface, structured identically to INCOIS bulletins for Mangalore, Kochi, Goa, Mumbai, Chennai, Visakhapatnam, Kanyakumari, etc.
   - Swappable for a live INCOIS OCM-3 satellite feed without touching agent logic.
5. **Satellite Dissemination (SIMULATED STAND-IN):**
   - Encodes NMEA-standard checksummed telegram frames (`$ORCA,...*CS`) simulating an ISRO NAVIC S-Band broadcast.
6. **SMS Dissemination (INTERFACE + SIMULATOR):**
   - Formatter strictly enforces the **160-character limit** and routes via a pluggable `SMSGateway`.

---

## Quickstart Guide

### 1. Prerequisites
- Python 3.11 or higher
- Git

### 2. Setup Virtual Environment
```bash
cd orca-backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy the template file:
```bash
cp .env.example .env
```
Edit `.env` (optional for local demo testing):
```env
ANTHROPIC_API_KEY=your-anthropic-key-here
BHASHINI_USER_ID=your-bhashini-id
BHASHINI_API_KEY=your-bhashini-key
PORT=8000
```

### 5. Run the Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive API Docs (Swagger): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 6. Run Test Suite
```bash
python -m pytest -v
```

---

## API Surface

### 1. `POST /query`
Processes natural language marine queries through the 9-agent pipeline.

**Request Body:**
```json
{
  "text": "Is it safe to fish near Mangalore tomorrow?",
  "user_type": "app",
  "location": {
    "lat": 12.87,
    "lon": 74.84
  },
  "language": "en"
}
```

**Response:**
```json
{
  "query_id": "orca_a1b2c3d4e5f6",
  "timestamp": "2026-09-10T14:00:00Z",
  "user_type": "app",
  "original_query": "Is it safe to fish near Mangalore tomorrow?",
  "detected_language": "en",
  "translated_query": "Is it safe to fish near Mangalore tomorrow?",
  "verdict": "SAFE",
  "safety_summary": "Status: SAFE | Wind: 18.0 km/h | Wave: 1.2 m | PFZ: 31.5km offshore",
  "report": "SAFETY ADVISORY: [SAFE] - Sea conditions are favorable near Mangalore...",
  "dissemination_channel": "app",
  "dispatched_payload": {
    "channel": "app",
    "status": "DELIVERED_IN_RESPONSE",
    "content": { ... }
  },
  "visualization": {
    "geojson": {
      "type": "FeatureCollection",
      "features": [ ... ]
    },
    "charts": {
      "wave_series": { ... },
      "wind_series": { ... }
    }
  },
  "agent_traces": [ ... ]
}
```

### 2. `GET /health`
Returns system status, active agent count, and service readiness.

### 3. `GET /zones`
Returns the registry of marine sanctuaries and naval exclusion perimeters.

### 4. `GET /pfz`
Direct query endpoint for INCOIS PFZ bulletins by coastal sector.

---

## Safety Hierarchy Precedence & Authoritative Thresholds

Safety decisions are deterministic and computed strictly in accordance with `app/core/safety_rules.py`:

1. **Sustained Wind Speed (`wind_speed_10m`):**
   - `< 35.0 km/h` = **SAFE**
   - `>= 35.0 km/h` and `< 50.0 km/h` = **CAUTION**
   - `>= 50.0 km/h` = **UNSAFE**

2. **Significant Wave Height (`wave_height`):**
   - `< 2.0 m` = **SAFE**
   - `>= 2.0 m` and `< 3.5 m` = **CAUTION**
   - `>= 3.5 m` = **UNSAFE**

3. **Wind Gusts (`wind_gusts_10m`):**
   - `< 55.0 km/h` = **SAFE**
   - `>= 55.0 km/h` and `< 70.0 km/h` = **CAUTION**
   - `>= 70.0 km/h` = **UNSAFE**

4. **Severe Weather Alerts:**
   - WMO Weather Codes `95`, `96`, `99` (Thunderstorm / Severe Gale) = **UNSAFE**

5. **Geospatial Sanctuary & Naval Boundaries:**
   - Vessel inside restricted polygon = **UNSAFE**
   - Vessel outside but distance `<= 2.0 km` from boundary = **CAUTION**
   - Vessel distance `> 2.0 km` from boundary = **SAFE**

6. **Safety Subordination Rule:**
   - Favorable Ocean / PFZ suitability (SST $26.5^\circ\text{C} - 30.5^\circ\text{C}$, Chlorophyll-a $0.2 - 3.0\text{ mg/m}^3$) **NEVER** overrides a CAUTION or UNSAFE safety condition.

