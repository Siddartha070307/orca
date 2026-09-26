// ORCA Backend API Client
// Connects strictly to http://localhost:8000 (configurable via VITE_BACKEND_BASE_URL)

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_BASE_URL
  ? import.meta.env.VITE_BACKEND_BASE_URL
  : 'http://localhost:8000').replace(/\/+$/, '');

/**
 * Call GET /health
 * Checks agent registry, system uptime, and subsystem readiness
 */
export async function fetchHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
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
export async function fetchZones() {
  try {
    const response = await fetch(`${BASE_URL}/zones`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
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
 *
 * @param {Object} params
 * @param {string} params.text - Natural language query string (1-2000 chars)
 * @param {string} [params.user_type="app"] - "app" | "boat_near_shore" | "boat_open_sea"
 * @param {Object} [params.location] - Optional { lat: number, lon: number }
 * @param {string} [params.session_id] - Session ID for multi-turn continuity
 * @param {string} [params.language] - Optional ISO 639-1 code (e.g. "en", "hi", "kn", "ta")
 * @param {string} [params.timestamp] - Optional ISO-8601 timestamp string
 */
export async function sendQuery({
  text,
  user_type = 'app',
  location = null,
  session_id = null,
  language = null,
  timestamp = null
}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Query text is required.');
  }

  const payload = {
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
        'Accept': 'application/json'
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
        // Fallback to raw error text
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

/**
 * Returns the backend TTS audio URL for a given text and language
 */
export function getTtsAudioUrl(text, language = 'en') {
  return `${BASE_URL}/tts?text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}`;
}

/**
 * Call POST /export-pdf to download a localized PDF advisory report
 */
export async function exportPdf(payload) {
  try {
    const response = await fetch(`${BASE_URL}/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to export PDF: ${response.status} - ${err}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const langSuffix = payload.language ? `_${payload.language}` : '';
    a.download = `ORCA_Advisory${langSuffix}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
}

