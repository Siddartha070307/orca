/**
 * Security & Sanitization Utilities for ORCA Frontend
 * Prevents XSS and HTML injection in Leaflet popups and DOM interpolations.
 */

/**
 * Escapes unsafe HTML characters in user-controlled or backend-derived strings.
 * Conforms to OWASP XSS prevention recommendations.
 *
 * @param {*} value - The input value to sanitize
 * @returns {string} - HTML-safe escaped string
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely format numerical values to avoid unexpected string injections.
 *
 * @param {*} num - Numerical value
 * @param {number} decimals - Precision decimals
 * @param {string} fallback - Fallback string if invalid
 * @returns {string}
 */
export function formatSafeNumber(num, decimals = 1, fallback = 'N/A') {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return fallback;
  }
  return Number(num).toFixed(decimals);
}

/**
 * Safely sanitize and join an array of strings (e.g. target species).
 *
 * @param {Array<string>} list
 * @returns {string} Escaped, comma-separated string
 */
export function safeJoinList(list, separator = ', ') {
  if (!Array.isArray(list)) return '';
  return list.map((item) => escapeHtml(item)).join(separator);
}
