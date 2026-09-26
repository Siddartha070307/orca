// Session ID management for multi-turn conversational context in ORCA

const SESSION_STORAGE_KEY = 'orca_session_id';

/**
 * Generate a random UUID v4 string
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Retrieve the current active session_id, or initialize a new one if not present
 */
export function getOrCreateSessionId() {
  try {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = 'session_' + generateUUID().replace(/-/g, '').slice(0, 12);
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
  } catch {
    // In case sessionStorage is blocked or unavailable
    return 'session_' + generateUUID().replace(/-/g, '').slice(0, 12);
  }
}

/**
 * Reset the session (clears conversational context)
 */
export function resetSessionId() {
  try {
    const newSessionId = 'session_' + generateUUID().replace(/-/g, '').slice(0, 12);
    sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    return newSessionId;
  } catch {
    return 'session_' + generateUUID().replace(/-/g, '').slice(0, 12);
  }
}
