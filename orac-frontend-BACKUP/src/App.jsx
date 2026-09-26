import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import MapPanel from './components/MapPanel';
import ChartsPanel from './components/ChartsPanel';
import DispatchPanel from './components/DispatchPanel';
import { getOrCreateSessionId, resetSessionId } from './utils/session';
import { sendQuery } from './api/orcaClient';
import { getStoredLanguage, setStoredLanguage } from './components/LanguageSelector';
import { Map, BarChart3, Radio, ChevronDown, ChevronUp, Layers, MessageSquare } from 'lucide-react';
import './styles/theme.css';

export default function App() {
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
  const [userType, setUserType] = useState('app'); // 'app' | 'boat_near_shore' | 'boat_open_sea'
  const [selectedLanguage, setSelectedLanguage] = useState(() => getStoredLanguage()); // Persisted in localStorage ('orca_language')

  const handleSelectLanguage = useCallback((code) => {
    const validated = setStoredLanguage(code);
    setSelectedLanguage(validated);
  }, []);

  // Browser GPS State
  const [userLocation, setUserLocation] = useState(null); // { lat: number, lon: number } | null
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'requesting' | 'success' | 'denied' | 'unavailable' | 'error'

  const [messages, setMessages] = useState([]);
  const [latestResponse, setLatestResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bottom drawer active tab: 'charts' | 'dispatch'
  const [activeDrawerTab, setActiveDrawerTab] = useState('charts');
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  // Mobile active tab view (for screens < 768px): 'chat' | 'map'
  const [mobileActiveView, setMobileActiveView] = useState('chat');

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
    const newId = resetSessionId();
    setSessionId(newId);
    setMessages([]);
    setLatestResponse(null);
    setError(null);
  };

  const visualization = latestResponse?.visualization;
  const charts = visualization?.charts;
  const dispatchedPayload = latestResponse?.dispatched_payload;
  const disseminationChannel = latestResponse?.dissemination_channel;
  const queryId = latestResponse?.query_id;

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        userType={userType}
        onSelectUserType={setUserType}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleSelectLanguage}
      />

      {/* Mobile Screen Switcher Bar (Visible on screens <= 800px) */}
      <div className="mobile-view-tabs" role="tablist" aria-label="Mobile View Switcher">
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
              <Map size={16} color="#38bdf8" />
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc' }}>
                ISRO / INCOIS Live Marine Situational Awareness
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: '#94a3b8' }}>
              {userLocation && (
                <span style={{ color: '#06b6d4', fontWeight: 600 }}>
                  GPS: {userLocation.lat.toFixed(2)}°N, {userLocation.lon.toFixed(2)}°E
                </span>
              )}
              <span className="hide-on-mobile">•</span>
              <span className="hide-on-mobile">RFC 7946 GeoJSON</span>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <MapPanel
            visualization={visualization}
            queryId={queryId}
            userLocation={userLocation}
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
                background: 'rgba(10, 19, 34, 0.96)',
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
                  className={`tab-button ${activeDrawerTab === 'charts' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDrawerTab('charts');
                    setDrawerCollapsed(false);
                  }}
                  aria-label="View Weather Telemetry Charts"
                >
                  <BarChart3 size={14} />
                  <span>Weather Telemetry Charts</span>
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
                  <span>Dissemination Router</span>
                  {disseminationChannel && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        textTransform: 'uppercase',
                        fontWeight: 700
                      }}
                    >
                      {disseminationChannel}
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.72rem' }}>
                <span>{drawerCollapsed ? 'Expand Telemetry' : 'Collapse'}</span>
                {drawerCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </div>

            {/* Drawer Body */}
            {!drawerCollapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeDrawerTab === 'charts' ? (
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
    </div>
  );
}
