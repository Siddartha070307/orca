/**
 * OrcaFrontendEmbed — shared iframe wrapper for Authority & Researcher consoles.
 *
 * Embeds the real orac-frontend ChatPanel (?embed=compact) as a docked side panel.
 * All query handling, session management, and agent logic lives inside the iframe
 * (the orac-frontend app) — this component is purely a shell + loading/error state.
 *
 * Water theme is the orac-frontend default, so no theme param is needed.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useI18n } from '../utils/i18n';
import { buildOrcaFrontendUrl, postLanguageToIframe } from '../utils/languageSync';

const ORAC_FRONTEND_URL =
  (import.meta as any).env?.VITE_ORAC_FRONTEND_URL ?? 'http://localhost:3000';

interface OrcaFrontendEmbedProps {
  /** Extra CSS class applied to the outermost wrapper */
  className?: string;
  /** Inline style overrides for the outermost wrapper */
  style?: React.CSSProperties;
  /** Accessible title for the iframe */
  title?: string;
}

export const OrcaFrontendEmbed: React.FC<OrcaFrontendEmbedProps> = ({
  className = '',
  style,
  title = 'ORCA Intelligence Chat',
}) => {
  const { language } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);

  // Resolved once so `lang` only seeds the Engine's *initial* language: later
  // language changes are pushed with postMessage instead of reloading the frame.
  const [embedUrl] = useState(() =>
    buildOrcaFrontendUrl(ORAC_FRONTEND_URL, { embed: 'compact', lang: language })
  );

  const handleLoad = useCallback(() => {
    setStatus('ready');
    // The child registers its listener during mount; re-post on every load.
    postLanguageToIframe(iframeRef.current, language);
  }, [language]);
  const handleError = useCallback(() => setStatus('error'), []);
  const handleRetry = useCallback(() => {
    setStatus('loading');
    setRetryKey((k) => k + 1);
  }, []);

  // Keep the embedded Engine in sync whenever the shell language changes.
  useEffect(() => {
    postLanguageToIframe(iframeRef.current, language);
  }, [language]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--bg-abyss, #EAF6FB)',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle, rgba(26,74,94,0.10))',
        boxShadow: 'var(--shadow-sm, 0 2px 6px rgba(26,74,94,0.08))',
        ...style,
      }}
      role="region"
      aria-label="ORCA Intelligence Chat Panel"
    >
      {/* Loading skeleton */}
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'var(--bg-abyss, #EAF6FB)',
            zIndex: 10,
            color: 'var(--marine-cyan, #2E8FB0)',
          }}
        >
          <Loader2 size={28} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-secondary, #33505E)',
              letterSpacing: '0.01em',
            }}
          >
            Connecting to ORCA Intelligence...
          </span>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            background: 'var(--bg-abyss, #EAF6FB)',
            zIndex: 10,
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={28} color="var(--verdict-caution, #C17A1F)" strokeWidth={2} />
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-primary, #1A2E3A)',
                marginBottom: '6px',
              }}
            >
              Chat panel unavailable
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--text-muted, #5C7987)',
                maxWidth: '240px',
              }}
            >
              Could not connect to orac-frontend. Make sure orac-frontend is running on port 3000.
            </div>
          </div>
          <button
            onClick={handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              background: 'var(--marine-cyan, #2E8FB0)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.77rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* The real orac-frontend embed */}
      <iframe
        key={retryKey}
        ref={iframeRef}
        src={embedUrl}
        title={title}
        onLoad={handleLoad}
        onError={handleError}
        allow="geolocation"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          opacity: status === 'ready' ? 1 : 0,
          transition: 'opacity 0.25s ease',
          background: 'transparent',
        }}
      />
    </div>
  );
};

export default OrcaFrontendEmbed;
