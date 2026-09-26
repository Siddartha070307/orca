// ORCA Backend API Client (TypeScript)
// Port of orac-frontend/src/api/orcaClient.js for orca-home consoles
// Connects to VITE_BACKEND_BASE_URL (default: http://localhost:8000)

const BASE_URL = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_BASE_URL
    ? import.meta.env.VITE_BACKEND_BASE_URL
    : 'http://localhost:8000'
).replace(/\/+$/, '');

export interface QueryLocation {
  lat: number;
  lon: number;
}

export interface QueryParams {
  text: string;
  user_type?: 'app' | 'boat_near_shore' | 'boat_open_sea' | string;
  location?: QueryLocation | null;
  session_id?: string | null;
  language?: string | null;
  timestamp?: string | null;
}

export interface AgentTrace {
  agent?: string;
  agent_name?: string;
  category?: string;
  status?: string;
  verdict?: 'SAFE' | 'CAUTION' | 'UNSAFE' | string;
  confidence?: number;
  execution_time_ms?: number;
  result?: any;
  evidence?: Record<string, any>;
  details?: string;
}

export interface WeatherMetrics {
  wave_height_m?: number;
  wind_speed_kmh?: number;
  wind_gust_kmh?: number;
  condition?: string;
  storm_description?: string;
  has_storm_alert?: boolean;
  sst_c?: number;
  [key: string]: any;
}

export interface QueryResponse {
  query_id?: string;
  session_id?: string;
  timestamp?: string;
  user_type?: string;
  language?: string;
  verdict?: 'SAFE' | 'CAUTION' | 'UNSAFE' | string;
  advisory?: string;
  response?: string;
  text?: string;
  location_name?: string;
  agent_traces?: AgentTrace[];
  weather_summary?: {
    metrics?: WeatherMetrics;
    [key: string]: any;
  };
  visualization?: {
    geojson?: any;
    charts?: any;
    [key: string]: any;
  };
  dispatched_payload?: any;
  dissemination_channel?: string;
  evidence?: Record<string, any>;
  [key: string]: any;
}

/**
 * Call GET /health
 * Checks agent registry, system uptime, and subsystem readiness
 */
export async function fetchHealth(): Promise<any> {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching /health:', error);
    throw error;
  }
}

/**
 * Call GET /zones
 * Fetches the nationwide catalog of marine protected sanctuaries and naval exclusion perimeters
 */
export async function fetchZones(): Promise<any> {
  try {
    const response = await fetch(`${BASE_URL}/zones`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch restricted zones: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching /zones:', error);
    throw error;
  }
}

/**
 * Call POST /query
 * Dispatches a natural language marine intelligence query to the 9-agent backend
 * Reuses the exact same request/response shape as orac-frontend.
 *
 * @param params QueryParams
 */
export async function sendQuery({
  text,
  user_type = 'app',
  location = null,
  session_id = null,
  language = null,
  timestamp = null
}: QueryParams): Promise<QueryResponse> {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Query text is required.');
  }

  const payload: Record<string, any> = {
    text: text.trim(),
    user_type
  };

  if (location && typeof location.lat === 'number' && typeof location.lon === 'number') {
    payload.location = { lat: location.lat, lon: location.lon };
  }
  if (session_id) {
    payload.session_id = session_id;
  }
  if (language) {
    payload.language = language;
  }
  if (timestamp) {
    payload.timestamp = timestamp;
  }

  try {
    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg = `Server returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.detail) {
          errorMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        if (errorBody) errorMsg = errorBody;
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}
