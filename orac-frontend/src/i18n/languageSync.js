/**
 * Cross-app language synchronisation (child side).
 *
 * orca-home (the parent shell) embeds this app in an iframe and pushes its
 * selected language with `window.postMessage`. This module owns the strict
 * validation of those messages; `I18nProvider` simply applies whatever comes
 * back from `parseLanguageSyncMessage`.
 *
 * Validation performed before any message is trusted:
 *   1. the message must come from our direct parent window
 *   2. the event origin must be on the allow-list (this origin, the configured
 *      orca-home origin, or — during local development only — localhost)
 *   3. the payload must be an object with the exact discriminator type
 *   4. the language code must exist in VALID_LANGUAGE_CODES
 *
 * A `?lang=<code>` URL parameter seeds the same state on direct loads (new tab
 * or cross-app redirect) where no parent frame exists.
 */
import { VALID_LANGUAGE_CODES } from '../components/LanguageSelector';

export const ORCA_LANGUAGE_SYNC_TYPE = 'ORCA_LANGUAGE_SYNC';

/** Dev servers run on arbitrary localhost ports, so allow them only in DEV. */
function isDevLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return url.protocol.startsWith('http') && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
  } catch {
    return false;
  }
}

/** Origins allowed to push a language into this app. */
export function getAllowedLanguageOrigins() {
  const allowed = new Set();

  if (typeof window !== 'undefined' && window.location?.origin) {
    allowed.add(window.location.origin);
  }

  const homeUrl = import.meta.env?.VITE_ORCA_HOME_URL;
  if (homeUrl) {
    try {
      allowed.add(new URL(homeUrl).origin);
    } catch {
      // malformed configuration — simply not added to the allow-list
    }
  }

  if (import.meta.env?.DEV) {
    // Local development: parent shell may be served from any localhost port.
    ['http://localhost', 'http://127.0.0.1', 'http://[::1]'].forEach((o) => allowed.add(o));
  }

  return allowed;
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (getAllowedLanguageOrigins().has(origin)) return true;
  if (import.meta.env?.DEV && isDevLocalOrigin(origin)) return true;
  return false;
}

/**
 * Returns a validated language code from a `message` event, or null when the
 * event is not a trusted ORCA_LANGUAGE_SYNC message.
 */
export function parseLanguageSyncMessage(event) {
  if (typeof window === 'undefined' || !event) return null;

  // Must be addressed by our direct parent (never by a nested frame or self).
  if (window.parent === window) return null;
  if (event.source !== window.parent) return null;

  if (!isAllowedOrigin(event.origin)) return null;

  const data = event.data;
  if (!data || typeof data !== 'object') return null;
  if (data.type !== ORCA_LANGUAGE_SYNC_TYPE) return null;

  const language = data.language;
  if (typeof language !== 'string' || !VALID_LANGUAGE_CODES.has(language)) return null;

  return language;
}

/**
 * Reads a validated `?lang=` parameter from the current URL.
 * Used when this app is opened directly (new tab / redirect) rather than
 * embedded, so the parent's language choice still survives the hand-off.
 */
export function readLanguageFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    return lang && VALID_LANGUAGE_CODES.has(lang) ? lang : null;
  } catch {
    return null;
  }
}
