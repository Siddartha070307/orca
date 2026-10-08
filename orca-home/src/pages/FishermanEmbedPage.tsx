import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '../components/sections/Header';
import { ExternalLink, Anchor, Radio, RefreshCw, AlertCircle, Sparkles, ClipboardCheck } from 'lucide-react';
import { useI18n } from '../utils/i18n';
import { buildOrcaFrontendUrl, postLanguageToIframe } from '../utils/languageSync';
import { MyFishermanRegistrationModal } from './MyFishermanRegistrationModal';

export const FishermanEmbedPage: React.FC = () => {
  const { t, language } = useI18n();
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const fishermanFrontendUrl = import.meta.env.VITE_ORAC_FRONTEND_URL || 'http://localhost:3000';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The embed URL is resolved once: `lang` seeds the Engine's initial language
  // (used on direct load) while later changes are pushed via postMessage so the
  // iframe never has to reload.
  const [embedUrl] = useState(() =>
    buildOrcaFrontendUrl(fishermanFrontendUrl, { role: 'fisherman', lang: language })
  );

  // Keep the embedded Engine in sync whenever the shell language changes.
  const syncLanguage = useCallback(() => {
    postLanguageToIframe(iframeRef.current, language);
  }, [language]);

  useEffect(() => {
    syncLanguage();
  }, [syncLanguage]);

  const handleOpenDedicatedTab = () => {
    window.open(
      buildOrcaFrontendUrl(fishermanFrontendUrl, { role: 'fisherman', lang: language }),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleCrossAppRedirect = () => {
    window.location.href = buildOrcaFrontendUrl(fishermanFrontendUrl, { role: 'fisherman', lang: language });
  };

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col">
      {/* Persistent Shell Header with Role Badge & Switch Role Button */}
      <Header />

      {/* Engine Status & Integration Sub-bar */}
      <div className="bg-[#061F2C]/90 border-b border-[#16C7C7]/20 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#36D399] animate-pulse" />
            <span className="font-semibold text-slate-200">
              FISHERMAN ENGINE (:3000)
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">
            ChatPanel • MapPanel • PFZ Candidates • AgentTraceList • Weather Charts • Disseminator
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowRegistration(true)}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#082A36] border border-[#F5B942]/40 text-[#F5B942] hover:bg-[#F5B942]/15 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F5B942]/60"
            title="Review and update your fisherman registration"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>My Registration</span>
          </button>

          <button
            onClick={handleOpenDedicatedTab}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] hover:bg-[#16C7C7]/15 transition-all cursor-pointer"
            title="Open Fisherman Dashboard in dedicated browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in New Tab</span>
          </button>

          <button
            onClick={handleCrossAppRedirect}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
            title="Direct window redirect to port 3000"
          >
            <span>Cross-App Redirect</span>
          </button>
        </div>
      </div>

      {/* Main Container with Embedded orac-frontend Iframe */}
      <div className="relative flex-1 w-full bg-[#000810] min-h-[calc(100vh-130px)]">
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#03141F] z-10 text-slate-300 space-y-4">
            <div className="w-10 h-10 border-3 border-[#16C7C7]/20 border-t-[#16C7C7] rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-white tracking-wider font-heading">
                CONNECTING TO FISHERMAN ENGINE (:3000)...
              </p>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Initializing Leaflet &amp; ArcGIS Maps, 9-Agent Pipeline, and Voice Narrations
              </p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="ORCA Fisherman Intelligence Engine"
          className="w-full h-full border-0 absolute inset-0"
          onLoad={() => {
            setIframeLoading(false);
            // Re-post once the child has mounted its message listener
            syncLanguage();
          }}
          onError={() => {
            setIframeLoading(false);
            setIframeError(true);
          }}
          allow="geolocation; microphone; camera; display-capture"
        />

        {iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#03141F] z-20 text-slate-300 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-[#FF4D5A] mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Unable to load Fisherman Engine</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 font-mono">
              Ensure orac-frontend Vite dev server is running on port 3000 (cd orac-frontend &amp;&amp; npm run dev).
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#16C7C7] text-slate-950 font-bold text-xs"
              >
                Retry Connection
              </button>
              <button
                onClick={handleCrossAppRedirect}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold text-xs"
              >
                Direct Redirect to :3000
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fisherman self-service registration editor */}
      <MyFishermanRegistrationModal
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
      />
    </div>
  );
};
