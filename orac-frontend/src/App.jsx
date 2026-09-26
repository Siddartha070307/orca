import React, { useState, useCallback, useMemo } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import MapPanel from './components/MapPanel';
import ChartsPanel from './components/ChartsPanel';
import DispatchPanel from './components/DispatchPanel';
import PfzCandidatesPanel from './components/PfzCandidatesPanel';
import { stopAllNarration } from './components/AudioNarrationPlayer';
import { getOrCreateSessionId, resetSessionId } from './utils/session';

const SimulationModal = React.lazy(() => import('./components/SimulationModal'));

function SimulationLoadingFallback() {
  return (
    <div
      className="orca-sim-loading"
      role="status"
      aria-label="Loading 3D Maritime Simulation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-abyss)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--marine-cyan)',
        fontFamily: 'var(--font-main)',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          border: '3px solid var(--border-medium)',
          borderTopColor: 'var(--marine-cyan)',
          borderRadius: '50%',
          animation: 'sim-spin 1s linear infinite',
        }}
      />
      <div style={{ fontSize: '13px', letterSpacing: '1px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
        Loading 3D Maritime Simulation...
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        Initializing Three.js WebGL Engine &amp; Bathymetry Data
      </div>
      <style>{`@keyframes sim-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
import { sendQuery } from './api/orcaClient';
import { getStoredLanguage, setStoredLanguage } from './components/LanguageSelector';
import { Map, BarChart3, Radio, ChevronDown, ChevronUp, Layers, MessageSquare, Waves, Compass } from 'lucide-react';
import { useTranslation } from './i18n/useTranslation';
import './styles/theme.css';

export default function App() {
  const { currentLanguage, changeLanguage, t } = useTranslation();

  // Detect embed=compact mode — renders only ChatPanel for Authority/Researcher iframes
  const isCompactEmbed = useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === 'compact',
    []
  );

  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
  const [userType, setUserType] = useState('app'); // 'app' | 'boat_near_shore' | 'boat_open_sea'
  const selectedLanguage = currentLanguage;

  const handleSelectLanguage = useCallback((code) => {
    changeLanguage(code);
  }, [changeLanguage]);

  // Browser GPS State
  const [userLocation, setUserLocation] = useState(null); // { lat: number, lon: number } | null
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'requesting' | 'success' | 'denied' | 'unavailable' | 'error'

  const [messages, setMessages] = useState([]);
  const [latestResponse, setLatestResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bottom drawer active tab: 'pfz' | 'charts' | 'dispatch'
  const [activeDrawerTab, setActiveDrawerTab] = useState('pfz');
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  // Active dashboard view: 'chat' | 'map' (chat-first default on all screen sizes)
  const [mobileActiveView, setMobileActiveView] = useState('chat');

  // 3D Ocean Simulation State
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [selectedSimulationPfz, setSelectedSimulationPfz] = useState(null);

  // Extract 4 PFZ Candidates from response (Single source of truth propagation)
  const pfzCandidates = useMemo(() => {
    // Priority 1: From visualization GeoJSON
    const geoFeatures = latestResponse?.visualization?.geojson?.features;
    if (Array.isArray(geoFeatures)) {
      const cands = geoFeatures
        .filter(f => f.properties?.category === 'pfz' || f.properties?.id?.startsWith('PFZ-'))
        .map(f => ({
          ...f.properties,
          latitude: f.geometry?.coordinates?.[1],
          longitude: f.geometry?.coordinates?.[0]
        }))
        .sort((a, b) => (a.rank || 1) - (b.rank || 1));
      if (cands.length > 0) return cands;
    }

    // Priority 2: From ocean_analytics trace
    const oceanTrace = latestResponse?.agent_traces?.find(t => t.agent_name === 'ocean_analytics');
    const traceCands = oceanTrace?.result?.pfz_candidates || oceanTrace?.result?.candidates;
    if (Array.isArray(traceCands) && traceCands.length > 0) {
      return traceCands;
    }

    return [];
  }, [latestResponse]);

  // Extract weather for 3D simulation
  const simWeather = useMemo(() => {
    const weatherTrace = latestResponse?.agent_traces?.find(t => t.agent_name === 'weather_data');
    const w = weatherTrace?.result || {};
    return {
      wave_height: w.wave_height || w.significant_wave_height || 1.2,
      wind_speed: w.wind_speed || 15.0,
      weather_condition: w.condition || w.weather_condition || 'Clear',
    };
  }, [latestResponse]);

  // Extract vessel coordinates for 3D simulation
  const vesselCoordinates = useMemo(() => {
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number') {
      return userLocation;
    }
    const userFeature = latestResponse?.visualization?.geojson?.features?.find(
      (f) => f.properties?.category === 'user' || f.properties?.id === 'user-location'
    );
    if (userFeature?.geometry?.coordinates) {
      const [lon, lat] = userFeature.geometry.coordinates;
      if (typeof lat === 'number' && typeof lon === 'number') {
        return { lat, lon };
      }
    }
    return null;
  }, [userLocation, latestResponse]);

  // Launch 3D Simulation handler
  const handleStartSimulation = useCallback((candidate) => {
    stopAllNarration();
    setSelectedSimulationPfz(candidate || pfzCandidates[0] || null);
    setIsSimulationOpen(true);
  }, [pfzCandidates]);

  // Handle Browser Geolocation Request (Explicit User Action Only)
  const handleRequestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Verify numerical coordinates
        if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
          setUserLocation({
            lat: +latitude.toFixed(4),
            lon: +longitude.toFixed(4)
          });
          setGpsStatus('success');
        } else {
          setGpsStatus('error');
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setGpsStatus('unavailable');
        } else {
          setGpsStatus('error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }, []);

  const handleClearGps = useCallback(() => {
    setUserLocation(null);
    setGpsStatus('idle');
  }, []);

  // Handle Query Execution
  const handleSendMessage = async (text) => {
    stopAllNarration();
    setError(null);
    const userMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Pass userLocation if explicitly acquired via GPS
      const response = await sendQuery({
        text,
        user_type: userType,
        session_id: sessionId,
        language: selectedLanguage,
        location: userLocation || null
      });

      // Maintain multi-turn session ID if synchronized by backend
      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
      }

      setLatestResponse(response);
      setActiveDrawerTab('pfz');
      setDrawerCollapsed(false);

      const orcaMessage = {
        id: response.query_id || 'orca_' + Date.now(),
        sender: 'orca',
        data: response,
        timestamp: response.timestamp || new Date().toISOString()
      };

      setMessages((prev) => [...prev, orcaMessage]);
    } catch (err) {
      console.error('Query failed:', err);
      setError(err.message || 'Failed to communicate with ORCA intelligence backend.');
    } finally {
      setLoading(false);
    }
  };

  // Reset conversation and session ID
  const handleResetSession = () => {
    stopAllNarration();
    const newId = resetSessionId();
    setSessionId(newId);
    setMessages([]);
    setLatestResponse(null);
    setSelectedSimulationPfz(null);
    setIsSimulationOpen(false);
    setError(null);
  };

  const visualization = latestResponse?.visualization;
  const charts = visualization?.charts;
  const dispatchedPayload = latestResponse?.dispatched_payload;
  const disseminationChannel = latestResponse?.dissemination_channel;
  const queryId = latestResponse?.query_id;

  // ── Compact embed mode: render ONLY the chat panel (for Authority/Researcher iframes) ──
  if (isCompactEmbed) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
          background: 'var(--bg-abyss)',
          overflow: 'hidden',
        }}
      >
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={loading}
          error={error}
          sessionId={sessionId}
          onResetSession={handleResetSession}
          userLocation={userLocation}
          gpsStatus={gpsStatus}
          onRequestGps={handleRequestGps}
          onClearGps={handleClearGps}
          selectedLanguage={selectedLanguage}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        userType={userType}
        onSelectUserType={setUserType}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* View Switcher Bar (Advisory Chat vs Map & Telemetry - all screen sizes) */}
      <div className="mobile-view-tabs" role="tablist" aria-label="Dashboard View Switcher">
        <button
          role="tab"
          aria-selected={mobileActiveView === 'chat'}
          className={`mobile-tab-btn ${mobileActiveView === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileActiveView('chat')}
        >
          <MessageSquare size={14} />
          <span>Advisory Chat</span>
        </button>
        <button
          role="tab"
          aria-selected={mobileActiveView === 'map'}
          className={`mobile-tab-btn ${mobileActiveView === 'map' ? 'active' : ''}`}
          onClick={() => setMobileActiveView('map')}
        >
          <Map size={14} />
          <span>Map & Telemetry</span>
        </button>
      </div>

      {/* Main Workspace: Left Chat Pane, Right Telemetry & Map Pane */}
      <main className={`dashboard-workspace mobile-view-${mobileActiveView}`}>
        {/* Left: Conversational Intelligence Feed */}
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={loading}
          error={error}
          sessionId={sessionId}
          onResetSession={handleResetSession}
          userLocation={userLocation}
          gpsStatus={gpsStatus}
          onRequestGps={handleRequestGps}
          onClearGps={handleClearGps}
          selectedLanguage={selectedLanguage}
        />

        {/* Right: Live RFC 7946 Map + Multi-Metric Charts + Dissemination Drawer */}
        <section className="telemetry-pane" aria-label="Geospatial Telemetry Workspace">
          {/* Top Bar for Map & Controls */}
          <div className="telemetry-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Map size={16} color="var(--marine-cyan)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                ISRO / INCOIS Live Marine Situational Awareness
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {userLocation && (
                <span style={{ color: 'var(--marine-blue)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  GPS: {userLocation.lat.toFixed(2)}°N, {userLocation.lon.toFixed(2)}°E
                </span>
              )}

              {/* 3D Ocean Simulation Launch Button */}
              <button
                onClick={() => handleStartSimulation(pfzCandidates[0])}
                style={{
                  background: 'var(--marine-foam)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--marine-cyan)',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: 'var(--shadow-sm)'
                }}
                title="Launch 3D Ocean Surface Simulation with Gerstner Waves and PFZ Beacon"
              >
                <Compass size={13} color="var(--marine-cyan)" />
                <span>3D Ocean Simulation</span>
              </button>

              <span className="hide-on-mobile">•</span>
              <span className="hide-on-mobile">RFC 7946 GeoJSON</span>
            </div>
          </div>

          {/* Interactive ArcGIS Geospatial Viewport */}
          <MapPanel
            visualization={visualization}
            queryId={queryId}
            userLocation={userLocation}
            onStartSimulation={handleStartSimulation}
          />

          {/* Collapsible Telemetry & Dissemination Bottom Drawer */}
          <div className={`telemetry-bottom-drawer ${drawerCollapsed ? 'collapsed' : ''}`}>
            {/* Drawer Header & Tabs */}
            <div
              style={{
                height: '40px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                background: 'var(--bg-surface)',
                borderBottom: drawerCollapsed ? 'none' : '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}
              onClick={() => setDrawerCollapsed(!drawerCollapsed)}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`tab-button ${activeDrawerTab === 'pfz' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDrawerTab('pfz');
                    setDrawerCollapsed(false);
                  }}
                  aria-label="View Four PFZ Candidates"
                >
                  <Waves size={14} />
                  <span>{t('dispatch.pfzTab', 'PFZ Candidates')} ({pfzCandidates.length})</span>
                </button>

                <button
                  className={`tab-button ${activeDrawerTab === 'charts' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDrawerTab('charts');
                    setDrawerCollapsed(false);
                  }}
                  aria-label="View Weather Telemetry Charts"
                >
                  <BarChart3 size={14} />
                  <span>{t('dispatch.chartsTab', 'Weather Telemetry Charts')}</span>
                </button>

                <button
                  className={`tab-button ${activeDrawerTab === 'dispatch' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDrawerTab('dispatch');
                    setDrawerCollapsed(false);
                  }}
                  aria-label="View Dispatched Payload Router"
                >
                  <Radio size={14} />
                  <span>{t('dispatch.dispatchTab', 'Dissemination Router')}</span>
                  {disseminationChannel && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'var(--marine-foam)',
                        color: 'var(--marine-blue)',
                        textTransform: 'uppercase',
                        fontWeight: 700
                      }}
                    >
                      {disseminationChannel}
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <span>{drawerCollapsed ? t('dispatch.expandTelemetry', 'Expand Telemetry') : t('dispatch.collapse', 'Collapse')}</span>
                {drawerCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </div>

            {/* Drawer Body */}
            {!drawerCollapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeDrawerTab === 'pfz' ? (
                  <PfzCandidatesPanel
                    candidates={pfzCandidates}
                    verdict={latestResponse?.verdict}
                    onStartSimulation={handleStartSimulation}
                  />
                ) : activeDrawerTab === 'charts' ? (
                  <ChartsPanel charts={charts} />
                ) : (
                  <DispatchPanel
                    dispatchedPayload={dispatchedPayload}
                    disseminationChannel={disseminationChannel}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 3D Ocean Simulation Full-Screen Modal (Lazy-Loaded) */}
      {isSimulationOpen && (
        <React.Suspense fallback={<SimulationLoadingFallback />}>
          <SimulationModal
            isOpen={isSimulationOpen}
            onClose={() => setIsSimulationOpen(false)}
            selectedPfz={selectedSimulationPfz}
            allCandidates={pfzCandidates}
            onSelectPfz={setSelectedSimulationPfz}
            verdict={latestResponse?.verdict || 'SAFE'}
            weather={simWeather}
            timeRange={latestResponse?.time_range}
            originalQuery={latestResponse?.original_query || ''}
            vesselCoordinates={vesselCoordinates}
          />
        </React.Suspense>
      )}
    </div>
  );
}
