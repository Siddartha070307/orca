# ORCA Backend — Frontend Developer Handover Specification

**System**: ORCA (Marine EcOsystem Reasoning with Collaborative Agents) — Smart India Hackathon Problem Statement 26176  
**Backend Root**: `D:\SIH\orca-backend`  
**API Version**: `v1.0.0`  
**Protocol**: HTTP/REST JSON (FastAPI)  
**Default Local Base URL**: `http://localhost:8000`  

---

## 1. API Endpoints & Request Schemas

The backend exposes the following active endpoints:
- `POST /query`: Main multi-agent query orchestration pipeline.
- `GET /health`: System health, agent registry count, and subsystem readiness.
- `GET /zones`: Catalog of restricted marine sanctuaries and naval exclusion perimeters.
- `GET /pfz`: Direct lookup for INCOIS Potential Fishing Zone (PFZ) bulletins.

> [!NOTE]
> `GET /query/history` is **NOT IMPLEMENTED** in the current backend. Frontend applications should not attempt to call a history route.

---

### `POST /query`
Main unified query pipeline. Accepts voice or text queries from web/mobile applications, coastal feature phones, or offshore vessels.

#### Request Schema (`app/models/schemas.py:QueryRequest`)
```typescript
interface QueryRequest {
  // Required: Free-form user natural language question (1 to 2000 chars)
  text: string;

  // Optional: Target user profile and connectivity tier (default: "app")
  // Allowed values: exactly "app" | "boat_near_shore" | "boat_open_sea"
  user_type?: "app" | "boat_near_shore" | "boat_open_sea";

  // Optional: Explicit GPS coordinates of vessel or port. If omitted, extracted from text.
  location?: {
    lat: number; // Decimal latitude (-90.0 to 90.0)
    lon: number; // Decimal longitude (-180.0 to 180.0)
  } | null;

  // Optional: Multi-turn session identifier. If omitted, a new session is initialized.
  session_id?: string | null;

  // Optional: ISO 639-1 language code (e.g. "en", "hi", "kn", "ta").
  // If omitted, language is detected automatically from text.
  language?: string | null;

  // Optional: ISO-8601 timestamp string (e.g. "2026-09-10T18:33:34Z" or "2026-09-11T10:00:00+05:30").
  // Used for deterministic testing and client clock synchronization.
  // The backend converts the timestamp to the target local timezone (Asia/Kolkata / IST / UTC+05:30)
  // before relative calendar arithmetic.
  timestamp?: string | null;
}
```

#### Example Requests

##### 1. Web/Mobile App Query (`user_type: "app"`)
```json
{
  "text": "Is it safe to fish near Mangalore tomorrow morning?",
  "user_type": "app",
  "location": {
    "lat": 12.87,
    "lon": 74.84
  },
  "session_id": "session_user_8912",
  "language": "en",
  "timestamp": "2026-09-10T15:30:00+05:30"
}
```

##### 2. Follow-Up Turn (Inherits Location & Temporal Context)
```json
{
  "text": "What about tomorrow evening?",
  "user_type": "app",
  "session_id": "session_user_8912"
}
```

##### 3. Near-Shore Fishing Boat (`user_type: "boat_near_shore"`)
```json
{
  "text": "Can I sail from Kochi today?",
  "user_type": "boat_near_shore",
  "location": {
    "lat": 9.93,
    "lon": 76.26
  }
}
```

##### 4. Deep-Sea Vessel (`user_type: "boat_open_sea"`)
```json
{
  "text": "Current conditions 40km offshore Goa",
  "user_type": "boat_open_sea",
  "location": {
    "lat": 15.35,
    "lon": 73.40
  }
}
```

---

### `GET /health`
Liveness, registered agent count, and integration subsystem diagnostic check.

#### Response Schema (`app/models/schemas.py:HealthResponse`)
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "agents_registered": 9,
  "uptime_seconds": 3412.5,
  "services": {
    "weather_intelligence": "Open-Meteo Live API Ready",
    "ocean_analytics": "INCOIS Mock PFZ Engine Active",
    "geospatial_reasoning": "Shapely Geofencing Active",
    "language_engine": "Bhashini ULCA / Passthrough Ready",
    "llm_engine": "Anthropic Claude / Resilient Fallback Active",
    "dissemination_router": "Multi-Channel Disseminator Active (App/SMS/NAVIC)"
  }
}
```

---

### `GET /zones`
Returns the static database of restricted marine protected areas, sanctuaries, and naval security boundaries.

#### Response Schema
```json
{
  "restricted_marine_zones": [
    {
      "name": "Gahirmatha Marine Sanctuary",
      "type": "Marine Sanctuary",
      "coordinates": [
        [86.75, 20.40],
        [87.15, 20.40],
        [87.15, 20.85],
        [86.75, 20.85],
        [86.75, 20.40]
      ],
      "buffer_km": 2.0
    },
    {
      "name": "Karwar Naval Base Perimeter",
      "type": "Naval Security Zone",
      "coordinates": [
        [74.05, 14.75],
        [74.20, 14.75],
        [74.20, 14.88],
        [74.05, 14.88],
        [74.05, 14.75]
      ],
      "buffer_km": 2.0
    }
  ]
}
```

---

### `GET /pfz`
Direct lookup for INCOIS Potential Fishing Zone (PFZ) bulletins.

#### Query Parameters
- `lat` (float, default: 12.87)
- `lon` (float, default: 74.84)
- `sector` (optional string, e.g. "Karnataka", "Kerala", "Goa")

---

## 2. Response Payload Structure (`QueryResponse`)

The `POST /query` endpoint returns a response strictly typed by `app/models/schemas.py:QueryResponse`.

### Actual Top-Level Fields

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `query_id` | `string` | Unique tracking ID (e.g. `"orca_4e38487bbc12"`) |
| `session_id` | `string \| null` | Active multi-turn session ID |
| `timestamp` | `string` | ISO-8601 UTC timestamp of query processing |
| `user_type` | `string` | Target client tier: `"app"`, `"boat_near_shore"`, `"boat_open_sea"` |
| `original_query` | `string` | Raw query string submitted by user |
| `detected_language` | `string` | Detected language code (e.g. `"en"`, `"hi"`, `"kn"`, `"ta"`) |
| `translated_query` | `string` | English-normalized query string used by planner |
| `verdict` | `string` | Final deterministic safety decision: `"SAFE"`, `"CAUTION"`, `"UNSAFE"` |
| `safety_summary` | `string` | One-line human-readable summary of the safety decision |
| `report` | `string` | Full advisory report formatted in Markdown |
| `dissemination_channel`| `string` | Dissemination route: `"app"`, `"boat_sms"`, `"boat_satellite"` |
| `dispatched_payload` | `DispatchedPayload` | Payload tailored to transmission tier (rich dashboard, SMS, or binary packet) |
| `visualization` | `VisualizationPayload` | Top-level object containing `geojson`, `charts`, and `map_bounds` |
| `agent_traces` | `AgentResult[]` | Full execution trace of all 9 logical agents |
| `time_range` | `object \| null` | Evaluated temporal window (`start`, `end`, `label`, `is_current`, `target_time`) |

> [!IMPORTANT]
> Fields such as `confidence`, `primary_drivers`, and detailed intermediate metrics do **NOT** exist at the top level of `QueryResponse`. They are located inside `agent_traces` under the respective agent results (see Section 3).

#### Complete JSON Response Example
```json
{
  "query_id": "orca_4e38487bbc12",
  "session_id": "session_user_8912",
  "timestamp": "2026-09-10T17:32:19.884573Z",
  "user_type": "app",
  "original_query": "Is it safe to fish near Mangalore tomorrow morning?",
  "detected_language": "en",
  "translated_query": "Is it safe to fish near Mangalore tomorrow morning?",
  "verdict": "SAFE",
  "safety_summary": "Status: SAFE | Wind: 18.5 km/h | Wave: 1.35 m | PFZ: 14.2 km offshore",
  "report": "**SAFETY ADVISORY: SAFE TO SAIL NEAR MANGALORE [SAFE]**\n\n**Forecast Period:** Tomorrow Morning (06:00 to 12:00 IST)\n\nFavorable marine atmospheric and sea state conditions are predicted across coastal Karnataka waters...\n\n**Key Telemetry:**\n- Max Wind Speed: 18.5 km/h\n- Peak Wave Height: 1.35 m\n- Target PFZ: PFZ-SW-01 (Bearing 285°, Distance 14.2 km)\n- Restricted Sanctuary: 42.1 km (Clear)",
  "dissemination_channel": "app",
  "dispatched_payload": {
    "channel": "app",
    "status": "DELIVERED_IN_RESPONSE",
    "content": {
      "format": "rich_dashboard",
      "text_summary": "**SAFETY ADVISORY: SAFE TO SAIL NEAR MANGALORE [SAFE]**...",
      "target_ui": "ORCA Web/Mobile Client",
      "protocol": "HTTPS_REST_API"
    },
    "metadata": {
      "resolution": "high",
      "includes_interactive_geojson": true,
      "includes_charts": true
    }
  },
  "visualization": {
    "geojson": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": { "type": "Point", "coordinates": [74.84, 12.87] },
          "properties": {
            "id": "user-vessel",
            "title": "Vessel / Port Location",
            "category": "user",
            "marker-color": "#2563eb",
            "marker-symbol": "ferry"
          }
        },
        {
          "type": "Feature",
          "geometry": { "type": "Point", "coordinates": [74.71, 12.91] },
          "properties": {
            "id": "PFZ-SW-01",
            "title": "PFZ: PFZ-SW-01",
            "category": "pfz",
            "marker-color": "#059669",
            "marker-symbol": "star",
            "sst_celsius": 28.3,
            "chlorophyll_mg_m3": 1.45,
            "suitability_score": 88,
            "bearing_deg": 285,
            "distance_km": 14.2
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [[74.84, 12.87], [74.71, 12.91]]
          },
          "properties": {
            "id": "nav-course-vector",
            "title": "Course Vector (14.2 km @ 285°)",
            "stroke": "#0284c7",
            "stroke-width": 2.5,
            "stroke-dasharray": "5, 5"
          }
        }
      ]
    },
    "charts": {
      "available": true,
      "labels": ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00"],
      "timestamps": [
        "2026-09-11T06:00:00+05:30",
        "2026-09-11T07:00:00+05:30",
        "2026-09-11T08:00:00+05:30",
        "2026-09-11T09:00:00+05:30",
        "2026-09-11T10:00:00+05:30",
        "2026-09-11T11:00:00+05:30",
        "2026-09-11T12:00:00+05:30"
      ],
      "source": { "name": "Open-Meteo API", "is_simulated": false },
      "wave_series": {
        "name": "Significant Wave Height (m)",
        "unit": "m",
        "data": [1.25, 1.3, 1.35, 1.35, 1.3, 1.25, 1.2],
        "caution_threshold": 2.0,
        "danger_threshold": 3.5
      },
      "wind_series": {
        "name": "Wind Speed (km/h)",
        "unit": "km/h",
        "data": [16.0, 17.5, 18.5, 18.0, 17.0, 16.5, 15.0],
        "caution_threshold": 35.0,
        "danger_threshold": 50.0
      },
      "gust_series": {
        "name": "Wind Gusts (km/h)",
        "unit": "km/h",
        "data": [22.0, 23.5, 24.0, 23.5, 22.0, 21.5, 20.0],
        "caution_threshold": 55.0,
        "danger_threshold": 70.0
      },
      "temperature_series": {
        "name": "Air Temperature (°C)",
        "unit": "°C",
        "data": [27.5, 28.0, 28.5, 28.5, 28.0, 27.5, 27.0]
      },
      "precipitation_series": {
        "name": "Precipitation (mm)",
        "unit": "mm",
        "data": [0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0]
      }
    },
    "map_bounds": [73.84, 12.37, 74.84, 13.37]
  },
  "agent_traces": [
    {
      "agent": "RiskAssessmentAgent",
      "status": "success",
      "confidence": 1.0,
      "result": {
        "verdict": "SAFE",
        "primary_drivers": [
          "Sustained wind 18.5 km/h below 35.0 km/h caution threshold",
          "Significant wave height 1.35 m below 2.0 m caution threshold",
          "Distance to Karwar Naval Base boundary is 42.1 km (safe buffer >= 2.0 km)"
        ],
        "evaluated_hierarchy": [
          "Hard Constraints: None violated (Wind <= 50, Wave <= 3.5, No storm alert, Not in sanctuary)",
          "Advisories: None triggered (Wind < 35, Wave < 2.0, Boundary distance > 2.0 km)",
          "Decision: SAFE"
        ]
      },
      "sources": [{ "name": "ORCA Deterministic Safety Rules Engine", "timestamp": "2026-09-10T17:32:19Z" }],
      "warnings": []
    }
  ],
  "time_range": {
    "start": "2026-09-11T06:00:00+05:30",
    "end": "2026-09-11T12:00:00+05:30",
    "label": "Tomorrow Morning",
    "is_current": false,
    "target_time": "tomorrow morning"
  }
}
```

---

## 3. Finding Nested Data in `agent_traces`

When advanced UI components need granular intermediate agent data, inspect the `agent_traces` array by agent name:

| Required Data | Agent Name | Location in `AgentResult` |
| :--- | :--- | :--- |
| **Safety Primary Drivers** | `RiskAssessmentAgent` | `trace.result["primary_drivers"]` (list of strings) |
| **Evaluated Safety Hierarchy** | `RiskAssessmentAgent` | `trace.result["evaluated_hierarchy"]` (list of strings) |
| **Agent Confidence Score** | Any agent | `trace.confidence` (float `0.0`–`1.0`) |
| **Warnings** | Any agent | `trace.warnings` (list of strings) |
| **Extracted Location Coordinates** | `PlanningAgent` | `trace.result["location"]` (`{"lat": float, "lon": float}`) |
| **Temporal Window Range** | `PlanningAgent` / `WeatherIntelligenceAgent` | `trace.time_range` (`{"start": ..., "end": ..., "label": ...}`) |
| **Weather Metrics Evaluated** | `WeatherIntelligenceAgent` | `trace.result["metrics"]` (`wind_speed_kmh`, `wave_height_m`, etc.) |
| **Window Peak Telemetry** | `WeatherIntelligenceAgent` | `trace.result["evaluated_window"]` (`peak_wind_kmh`, `peak_wave_m`, `data_points_evaluated`) |
| **PFZ Candidates List** | `OceanAnalyticsAgent` | `trace.result["candidates"]` (ranked candidate array) |
| **Top Recommended PFZ** | `OceanAnalyticsAgent` | `trace.result["recommended_pfz"]` (PFZ coordinate, bearing, SST, chlorophyll) |
| **Detected Ocean Fronts** | `OceanAnalyticsAgent` | `trace.result["ocean_fronts"]` (thermal gradient list) |
| **Geofence Boundary Distance** | `GeospatialReasoningAgent` | `trace.result["min_distance_to_boundary_km"]` (float in km) |
| **Nearest Restricted Zone** | `GeospatialReasoningAgent` | `trace.result["nearest_zone_name"]` (string) |

---

## 4. Mapping `user_type` to `dissemination_channel`

The client passes `user_type` in `QueryRequest`. The backend Dissemination Router automatically routes the output to the corresponding channel:

| Client `user_type` | Backend `dissemination_channel` | `dispatched_payload.format` | Description & Target UI |
| :--- | :--- | :--- | :--- |
| **`"app"`** | `"app"` | `"rich_dashboard"` | Modern web/mobile interactive dashboard with GeoJSON maps and charts. |
| **`"boat_near_shore"`** | `"boat_sms"` | `"structured_sms"` | Compact GSM SMS string under 160 characters for coastal cellular feature phones. |
| **`"boat_open_sea"`** | `"boat_satellite"` | `"binary_packet"` | Compact telemetry dictionary containing hex-encoded bitfields for ISRO NAVIC / MSS satellite terminals. |

---

## 5. Authoritative Safety Thresholds

The frontend UI must strictly adhere to the authoritative ORCA safety thresholds defined in `app/core/safety_rules.py`:

### 1. Sustained Wind Speed (`wind_speed_10m`)
- `< 35.0 km/h`: **SAFE** (Green `#16a34a`)
- `>= 35.0 km/h` and `< 50.0 km/h`: **CAUTION** (Amber `#d97706`)
- `>= 50.0 km/h`: **UNSAFE** (Red `#dc2626`)

### 2. Significant Wave Height (`wave_height`)
- `< 2.0 m`: **SAFE** (Green `#16a34a`)
- `>= 2.0 m` and `< 3.5 m`: **CAUTION** (Amber `#d97706`)
- `>= 3.5 m`: **UNSAFE** (Red `#dc2626`)

### 3. Wind Gusts (`wind_gusts_10m`)
- `< 55.0 km/h`: **SAFE** (Green `#16a34a`)
- `>= 55.0 km/h` and `< 70.0 km/h`: **CAUTION** (Amber `#d97706`)
- `>= 70.0 km/h`: **UNSAFE** (Red `#dc2626`)

### 4. Severe Weather Codes
- WMO Codes `95`, `96`, `99` (Thunderstorm with hail / severe squall) or storm alert: **UNSAFE** (Red `#dc2626`)

### 5. Geospatial Restricted Boundaries
- Vessel located **inside** restricted sanctuary/naval polygon: **UNSAFE**
- Vessel located **outside** but distance `<= 2.0 km` from boundary: **CAUTION**
- Vessel distance `> 2.0 km` from boundary: **SAFE**

### 6. Safety Subordination Invariant
- Ocean / Potential Fishing Zone (PFZ) suitability (even 95% favorable SST and chlorophyll) **NEVER** overrides an adverse weather or geofence condition.
- If wind `>= 50.0 km/h` or wave `>= 3.5 m` or vessel inside a sanctuary, the verdict is strictly **UNSAFE**.

---

## 6. GeoJSON Map Layer Specification

The visualization payload (`response.visualization.geojson`) provides standard RFC 7946 GeoJSON.

### Coordinate Order
> [!IMPORTANT]
> Standard GeoJSON order is strictly **`[longitude, latitude]`** (X, Y).

### Layers Included

| Feature ID | Geometry Type | Coordinates Format | Styling & Properties | Suggested Symbol |
| :--- | :--- | :--- | :--- | :--- |
| `user-vessel` | `Point` | `[lon, lat]` | `marker-color: "#2563eb"`, `marker-symbol: "ferry"`, `title: "Vessel / Port Location"` | Vessel Pin |
| `PFZ-...` | `Point` | `[lon, lat]` | `marker-color: "#059669"`, `marker-symbol: "star"`, `sst_celsius`, `chlorophyll_mg_m3`, `suitability_score`, `bearing_deg`, `distance_km` | Fish / Star Pin |
| `nav-course-vector` | `LineString` | `[[u_lon, u_lat], [pfz_lon, pfz_lat]]` | `stroke: "#0284c7"`, `stroke-width: 2.5`, `stroke-dasharray: "5, 5"`, `title: Course Vector` | Dashed Nav Vector |
| `restricted-...` | `Polygon` | `[[[lon, lat], ...]]` | `fill: "#dc2626"`, `fill-opacity: 0.25`, `stroke: "#b91c1c"`, `stroke-width: 2`, `zone_type`, `title` | Red Polygon Overlay |

### Automatic Map Framing
Use `response.visualization.map_bounds` (`[min_lon, min_lat, max_lon, max_lat]`):
- **MapLibre GL / Mapbox GL**: `map.fitBounds([[min_lon, min_lat], [max_lon, max_lat]], { padding: 40 })`
- **Leaflet**: `map.fitBounds([[min_lat, min_lon], [max_lat, max_lon]])`

---

## 7. Time-Series Chart Data Specification

The chart payload is located at `response.visualization.charts`.

### Series & Reference Lines
1. **Wave Height (`wave_series`)**: Unit `m`, caution line at `2.0`, danger line at `3.5`.
2. **Wind Speed (`wind_series`)**: Unit `km/h`, caution line at `35.0`, danger line at `50.0`.
3. **Wind Gusts (`gust_series`)**: Unit `km/h`, caution line at `55.0`, danger line at `70.0`.
4. **Air Temperature (`temperature_series`)**: Unit `°C`.
5. **Precipitation (`precipitation_series`)**: Unit `mm`.

### Zero-Fabrication Behavior
When forecast telemetry is unavailable or out-of-horizon:
- `charts.available === false`
- `charts.labels === []`
- `charts.timestamps === []`
- `data === []` for all series
- Display the `charts.warning` message in an advisory card instead of an empty chart.

---

## 8. Multi-Turn Session State Handling

The backend preserves conversational context across queries:
1. **Initiation**: Pass a unique string in `session_id` (e.g. `session_c7a10f`).
2. **Context Retention**:
   - Query 1: *"Can I sail from Mangalore tomorrow morning?"* -> Sets session location to Mangalore (`12.87, 74.84`) and date to tomorrow.
   - Query 2: *"What about the evening?"* -> Automatically retains Mangalore and combines it with tomorrow evening.
3. **Explicit Override**: Stating a new location (e.g. *"What about near Goa?"*) or a new date overrides that specific facet while retaining others.
4. **New Session**: Send a new `session_id` or omit the field.

---

## 9. Language Support & Translation

- **Supported Languages**: English (`en`), Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Kannada (`kn`), Malayalam (`ml`), Marathi (`mr`), Gujarati (`gu`), Bengali (`bn`), Odia (`or`).
- **Auto-Detection**: If `language` is omitted or null, the backend automatically detects language from script and vocabulary.
- **Bhashini ULCA Integration**: Query translation and regional advisory report generation use Government of India Bhashini APIs with automatic offline fallback.
