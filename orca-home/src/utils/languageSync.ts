/**
 * languageSync — keeps the orca-home shell language and the embedded
 * orac-frontend Engine (iframe / new tab / redirect) in sync.
 *
 * Transport rules (security):
 *  - `window.postMessage` is only used toward the embedded orac-frontend frame.
 *  - The target origin is always the resolved origin of the embed URL
 *    (never `"*"`).
 *  - The receiver (orac-frontend) independently validates `event.origin`,
 *    `event.source === window.parent`, the message shape and the language code.
 *
 * No new i18n system is introduced: both apps keep their own dictionaries and
 * only the selected language *code* is transported.
 */

/** Discriminator for the cross-app language message. */
export const ORCA_LANGUAGE_SYNC_TYPE = 'ORCA_LANGUAGE_SYNC';

export interface LanguageSyncMessage {
  type: typeof ORCA_LANGUAGE_SYNC_TYPE;
  language: string;
}

export interface OrcaFrontendUrlOptions {
  /** `?role=fisherman` style role gate */
  role?: string;
  /** `?embed=compact` style embed mode */
  embed?: string;
  /** `?lang=<code>` initial language */
  lang?: string;
}

/**
 * Builds an orac-frontend URL with optional query params, preserving any
 * query string already present on the base URL.
 * Falls back to naive string concatenation if the base is not a valid URL.
 */
export function buildOrcaFrontendUrl(base: string, options: OrcaFrontendUrlOptions = {}): string {
  const entries = Object.entries(options).filter(
    (entry): entry is [string, string] => Boolean(entry[1])
  );

  try {
    const url = new URL(base);
    entries.forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  } catch {
    const hasQuery = base.includes('?');
    const query = entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    if (query.length === 0) return base;
    return `${base}${hasQuery ? '&' : '?'}${query.join('&')}`;
  }
}

/**
 * Resolves the origin of an embed URL so the message can be posted to a
 * specific origin instead of `"*"` (avoids leaking the message to any other
 * frame that happens to embed us).
 * Returns null when the origin cannot be determined (e.g. `about:blank`).
 */
export function resolveTargetOrigin(url: string): string | null {
  try {
    const origin = new URL(url, window.location.href).origin;
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Posts the current language to an embedded orac-frontend iframe.
 * Safe to call before the frame finishes loading — the child also reads
 * `?lang=` on initial load, so no message is lost.
 *
 * @returns true when a message was actually posted.
 */
export function postLanguageToIframe(
  iframe: HTMLIFrameElement | null | undefined,
  language: string
): boolean {
  if (!iframe || !language) return false;

  const targetOrigin = resolveTargetOrigin(iframe.src || '');
  if (!targetOrigin) return false;

  const target = iframe.contentWindow;
  if (!target) return false;

  const message: LanguageSyncMessage = { type: ORCA_LANGUAGE_SYNC_TYPE, language };
  target.postMessage(message, targetOrigin);
  return true;
}
