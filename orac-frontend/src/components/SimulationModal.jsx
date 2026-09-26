import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { OceanSimulationEngine } from '../simulation/OceanSimulationEngine';
import { X, Maximize2, Minimize2, Navigation, Compass, AlertTriangle, ShieldCheck, Waves } from 'lucide-react';
import '../simulation/simulation.css';
import { useTranslation } from '../i18n/useTranslation';

export default function SimulationModal({
  isOpen,
  onClose,
  selectedPfz,
  allCandidates = [],
  onSelectPfz,
  verdict = 'SAFE',
  weather = null,
  timeRange = null,
  originalQuery = '',
  vesselCoordinates = null,
}) {
  const { t } = useTranslation();
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const [hudStats, setHudStats] = useState({
    speedKnots: '0.0',
    headingDeg: 0,
    cameraMode: 'FOLLOW',
    depthStatus: 'SURFACE',
    weatherPreset: 'SUNNY',
    distressState: 'IDLE',
    zone: 'OPEN SEA',
    navTarget: '--',
    navStatus: 'IDLE',
    distanceToTarget: '--',
    commStatus: 'STANDBY',
    pfzVisible: true,
    isStorm: false,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPfz, setCurrentPfz] = useState(selectedPfz || (allCandidates[0] || null));

  // Sync internal candidate if prop changes
  useEffect(() => {
    if (selectedPfz) {
      setCurrentPfz(selectedPfz);
    } else if (allCandidates.length > 0 && !currentPfz) {
      setCurrentPfz(allCandidates[0]);
    }
  }, [selectedPfz, allCandidates]);

  // Update engine when candidate changes
  const handleCandidateChange = useCallback((cand) => {
    setCurrentPfz(cand);
    if (onSelectPfz) onSelectPfz(cand);
    if (engineRef.current) {
      engineRef.current.updateContext({
        selectedPfz: cand,
        allCandidates,
        weather,
      });
    }
  }, [allCandidates, weather, onSelectPfz]);

  // Mount engine on open
  useEffect(() => {
    if (!isOpen) return;

    let engine = null;
    try {
      engine = new OceanSimulationEngine();
      engineRef.current = engine;
      engine.mount(
        mountRef.current,
        {
          selectedPfz: currentPfz,
          allCandidates,
          weather,
        },
        (stats) => setHudStats(stats)
      );
    } catch (err) {
      console.error('[SimulationModal] Engine mount error:', err);
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (engine) {
        engine.destroy();
        engineRef.current = null;
      }
    };
  }, [isOpen]);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (!isOpen) return null;

  // Resolve queried target time & time window strictly without fake dates
  const targetTimeDisplay = useMemo(() => {
    if (timeRange && typeof timeRange === 'object') {
      if (timeRange.target_time) return String(timeRange.target_time);
      if (timeRange.start && timeRange.end && timeRange.start !== timeRange.end) {
        return `${timeRange.start} – ${timeRange.end}`;
      }
      if (timeRange.start) return String(timeRange.start);
      if (timeRange.is_current) return 'REAL-TIME / CURRENT';
    }
    return 'REAL-TIME / CURRENT';
  }, [timeRange]);

  const timeRangeLabel = useMemo(() => {
    if (timeRange && typeof timeRange === 'object') {
      if (timeRange.label) return String(timeRange.label);
      if (timeRange.is_current) return 'Current Observation';
      if (timeRange.start && timeRange.end) return `${timeRange.start} to ${timeRange.end}`;
    }
    return null;
  }, [timeRange]);

  const vesselCoordStr = useMemo(() => {
    if (!vesselCoordinates || typeof vesselCoordinates.lat !== 'number' || typeof vesselCoordinates.lon !== 'number') {
      return 'COASTAL / INCOIS BASE';
    }
    const latH = vesselCoordinates.lat >= 0 ? 'N' : 'S';
    const lonH = vesselCoordinates.lon >= 0 ? 'E' : 'W';
    return `${Math.abs(vesselCoordinates.lat).toFixed(4)}°${latH}, ${Math.abs(vesselCoordinates.lon).toFixed(4)}°${lonH}`;
  }, [vesselCoordinates]);

  const pfz = currentPfz || selectedPfz || allCandidates[0] || {};
  const fdi = typeof pfz.fish_density_index === 'number' ? pfz.fish_density_index : 7.5;
  const fdiPercent = Math.min(100, Math.max(0, (fdi / 10.0) * 100));

  const verdictLower = (verdict || 'SAFE').toLowerCase();
  const verdictClass = verdictLower === 'unsafe' ? 'verdict-unsafe' : verdictLower === 'caution' ? 'verdict-caution' : 'verdict-safe';
  const localizedVerdict = t(`verdict.${(verdict || 'SAFE').toUpperCase()}`, verdict);

  return (
    <div className="orca-sim-modal" role="dialog" aria-modal="true" aria-label="ORCA 3D Ocean Simulation">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="orca-sim-canvas-container" />

      {/* Top Header Bar */}
      <header className="sim-top-bar">
        <div className="sim-title-group">
          <Waves size={18} color="var(--marine-cyan)" />
          <span className="sim-title">{t('sim.title', 'ORCA · 3D OCEAN MARITIME SIMULATION')}</span>
          <span style={{
            background: 'var(--marine-foam)',
            border: '1px solid var(--border-medium)',
            color: 'var(--marine-blue)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            SCENARIO SIMULATION • 3D DIGITAL TWIN
          </span>
          <span className="sim-disclaimer">{t('sim.disclaimer', 'PHYSICS-GROUNDED SCENARIO TWIN — NOT DIRECT NAVIGATION ADVICE')}</span>
          {originalQuery && (
            <div className="sim-query-pill" title={`Original Query: ${originalQuery}`}>
              &ldquo;{originalQuery}&rdquo;
            </div>
          )}
        </div>

        <div className="sim-top-actions">
          {/* ocean3 Marine Navigation & PFZ Controls */}
          <div className="sim-ocean3-controls">
            <button
              id="pfz-btn"
              className={`pfz-toggle-btn ${hudStats.pfzVisible ? 'active' : ''}`}
              onClick={() => engineRef.current?.togglePfz()}
              title="Toggle PFZ GIS Layer [P]"
            >
              <span className="pfz-icon-dot" />
              PFZ <span className="key-hint">[P]</span>
            </button>
            <button
              id="nav-start-btn"
              className={`nav-toggle-btn start-btn ${hudStats.navStatus === 'NAVIGATING' || hudStats.navStatus === 'ARRIVING' ? 'active' : ''}`}
              onClick={() => engineRef.current?.startNav()}
              title="Start Autonomous Marine Navigation [Space]"
            >
              ▶ START <span className="key-hint">[Space]</span>
            </button>
            <button
              id="nav-stop-btn"
              className={`nav-toggle-btn stop-btn ${hudStats.navStatus === 'IDLE' || hudStats.navStatus === 'STOPPED' ? 'disabled' : ''}`}
              onClick={() => engineRef.current?.stopNav()}
              title="Stop Autonomous Navigation"
            >
              ⏹ STOP
            </button>
          </div>

          <button
            className="sim-btn-close"
            style={{ background: 'var(--marine-foam)', borderColor: 'var(--border-medium)', color: 'var(--marine-blue)' }}
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? t('sim.exitFullscreen', 'Exit Fullscreen') : t('sim.fullscreen', 'Fullscreen')}</span>
          </button>

          <button
            className="sim-btn-close"
            onClick={onClose}
            title="Close Simulation [ESC]"
          >
            <X size={15} />
            <span>{t('sim.close', 'Close [ESC]')}</span>
          </button>
        </div>
      </header>

      {/* FPS Counter */}
      <div id="fps" className="sim-fps">60 fps</div>

      {/* ocean3 Storm Danger Warning Notification Banner */}
      <div id="storm-warning" className={`storm-warning ${hudStats.isStorm || hudStats.navStatus === 'STORM_BLOCKED' ? '' : 'hidden'}`}>
        <div className="warning-icon">⚠️</div>
        <div className="warning-content">
          <div className="warning-title">DANGER · STORM CONDITIONS</div>
          <div className="warning-msg" id="storm-warning-msg">AUTONOMOUS NAVIGATION DISABLED — VESSEL REMAINS SAFELY AT COAST</div>
        </div>
      </div>

      {/* ocean3 PFZ Productivity Legend */}
      <div id="pfz-legend" className={`pfz-legend ${hudStats.pfzVisible ? '' : 'hidden'}`}>
        <div className="legend-header">PFZ PRODUCTIVITY</div>
        <div className="legend-row"><span className="legend-dot green"></span><span className="legend-lvl">HIGH</span><span className="legend-id">PFZ-1 (FAR)</span></div>
        <div className="legend-row"><span className="legend-dot yellow"></span><span className="legend-lvl">MODERATE</span><span className="legend-id">PFZ-2 (MED)</span></div>
        <div className="legend-row"><span className="legend-dot red"></span><span className="legend-lvl">LOW</span><span className="legend-id">PFZ-3 (NEAR)</span></div>
      </div>

      {/* Distress Guidance Alerts (Engine-Managed Elements) */}
      <div id="distress-alert" className="hidden">
        <div className="alert-icon">⚠</div>
        <div className="alert-content">
          <div className="alert-title">{t('sim.severeStormWarning', 'SEVERE STORM WARNING')}</div>
          <div className="alert-sub">{t('sim.emergencyAlert', '— INCOIS / ORCA EMERGENCY SAFETY ALERT —')}</div>
          <div className="alert-msg">{t('sim.returnToShore', 'RETURN TO SHORE IMMEDIATELY · FOLLOW NAVIGATION GUIDANCE')}</div>
        </div>
      </div>

      <div id="distress-success" className="hidden">
        <div className="success-icon">✅</div>
        <div className="success-content">
          <div className="success-title">{t('sim.safelyReturned', 'VESSEL SAFELY RETURNED TO SHORE')}</div>
          <div className="success-sub">{t('sim.guidanceComplete', 'ORCA AUTONOMOUS SAFETY GUIDANCE COMPLETE')}</div>
        </div>
      </div>

      {/* Primary Telemetry HUD */}
      <div id="hud" className="sim-hud">
        <div className="hud-item" id="speed-badge">
          {t('sim.speed', 'SPEED:')} <span id="speed-val">{hudStats.speedKnots}</span> KTS
        </div>
        <div className="hud-item">
          {t('sim.heading', 'HEADING:')} <span>{hudStats.headingDeg}°</span>
        </div>
        <div className="hud-item" id="cam-badge">
          {t('sim.camera', 'CAMERA:')} <span id="cam-mode">{hudStats.cameraMode}</span> <span className="key-hint">[C]</span>
        </div>
        <div className="hud-item" id="depth-badge">
          {t('sim.depth', 'DEPTH:')} <span id="depth-val">{hudStats.depthStatus}</span> <span className="key-hint">[U]</span>
        </div>
        <div className="hud-item" id="weather-badge">
          {t('sim.weather', 'WEATHER:')} <span id="weather-val">{hudStats.weatherPreset}</span>
        </div>
        <div className="hud-item" id="zone-badge">
          ZONE: <span id="zone-val" style={{ color: 'var(--verdict-safe)' }}>{hudStats.zone || 'OPEN SEA'}</span>
        </div>
        <div className="hud-item" id="nav-target-badge">
          TARGET: <span id="target-val" style={{ color: 'var(--marine-cyan)' }}>{hudStats.navTarget || '--'}</span>
        </div>
        <div className="hud-item" id="nav-status-badge">
          STATUS: <span id="status-val" style={{ color: hudStats.navStatus === 'NAVIGATING' ? 'var(--marine-cyan)' : hudStats.navStatus === 'ARRIVED' ? 'var(--verdict-safe)' : hudStats.navStatus?.includes('STORM') ? 'var(--verdict-unsafe)' : 'var(--text-secondary)' }}>{hudStats.navStatus || 'IDLE'}</span>
        </div>
        {hudStats.distanceToTarget && hudStats.distanceToTarget !== '--' && (
          <div className="hud-item" id="nav-dist-badge">
            DISTANCE: <span id="dist-val">{hudStats.distanceToTarget}</span>
          </div>
        )}
        <div className="hud-item" id="comm-badge">
          COMM LINK: <span id="comm-val" style={{ color: hudStats.commStatus?.includes('ACTIVE') ? 'var(--verdict-unsafe)' : 'var(--marine-cyan)' }}>{hudStats.commStatus || 'STANDBY'}</span>
        </div>
        <div className="hud-item" id="time-badge" title={`Queried Target Time: ${targetTimeDisplay}`}>
          {t('sim.queryTime', 'QUERY TIME:')} <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{targetTimeDisplay}</span>
        </div>
        {timeRangeLabel && (
          <div className="hud-item" id="timerange-badge" title={`Time Range Window: ${timeRangeLabel}`}>
            {t('sim.window', 'WINDOW:')} <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timeRangeLabel}</span>
          </div>
        )}
        <div className="hud-item" id="vessel-badge" title={`Vessel Coordinates: ${vesselCoordStr}`}>
          {t('sim.vessel', 'VESSEL:')} <span>{vesselCoordStr}</span>
        </div>

        <div className="hud-item hidden" id="radio-indicator">
          <span className="signal-pulse">📩</span> ORCA: <span id="distress-status-text">MONITORING</span>
        </div>

        <div className="hud-item hidden" id="nav-badge">
          <div id="nav-arrow-container">
            <svg id="nav-arrow" viewBox="0 0 24 24" width="20" height="20">
              <path d="M12 2 L19 21 L12 17 L5 21Z" fill="var(--marine-cyan)" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div id="nav-text-container">
            <span className="nav-title">{t('sim.shoreGuidance', 'SHORE GUIDANCE')}</span>
            <span id="nav-dist-val">--- M</span>
          </div>
        </div>
      </div>

      {/* Selected PFZ Floating Intelligence Card */}
      <aside className="sim-pfz-card" aria-label="Selected PFZ Candidate Intelligence">
        <div className="sim-pfz-header">
          <span className="sim-pfz-title">
            ★ {t('sim.pfzCandidate', 'PFZ CANDIDATE')} #{pfz.pfz_rank || pfz.rank || 1}
          </span>
          <span className={`sim-pfz-verdict-badge ${verdictClass}`}>
            {t('sim.tripVerdict', 'TRIP:')} {localizedVerdict}
          </span>
        </div>

        {/* 4 Candidate Selector Buttons */}
        {allCandidates.length > 1 && (
          <div className="sim-cand-switcher">
            {allCandidates.slice(0, 4).map((cand, index) => {
              const candRank = cand.pfz_rank || cand.rank || (index + 1);
              const currentRank = pfz.pfz_rank || pfz.rank || 1;
              const isActive = (cand.id && pfz.id)
                ? cand.id === pfz.id
                : (candRank === currentRank);
              const key = cand.id || `sim-candidate-${candRank}-${index}`;
              return (
                <button
                  key={key}
                  className={`sim-cand-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleCandidateChange(cand)}
                >
                  PFZ #{candRank}{candRank === 1 ? ' ★' : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* PFZ Metrics */}
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.targetTime', 'Target Time:')}</span>
          <span className="sim-metric-val" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={targetTimeDisplay}>
            {targetTimeDisplay}
          </span>
        </div>
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.distanceOffshore', 'Distance Offshore:')}</span>
          <span className="sim-metric-val">{(pfz.distance_km || 0).toFixed(1)} km</span>
        </div>
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.compassBearing', 'Compass Bearing:')}</span>
          <span className="sim-metric-val">{(pfz.bearing_deg || 0).toFixed(0)}°</span>
        </div>
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.seaSurfaceTemp', 'Sea Surface Temp:')}</span>
          <span className="sim-metric-val">{(pfz.sst_celsius || 28.5).toFixed(1)} °C</span>
        </div>
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.chlorophyll', 'Chlorophyll-a:')}</span>
          <span className="sim-metric-val">{(pfz.chlorophyll_mg_m3 || 1.8).toFixed(2)} mg/m³</span>
        </div>
        <div className="sim-metric-row">
          <span className="sim-metric-label">{t('sim.zoneStatus', 'Zone Status:')}</span>
          <span className="sim-metric-val" style={{ color: pfz.is_in_restricted_zone ? 'var(--verdict-unsafe)' : 'var(--verdict-safe)' }}>
            {pfz.is_in_restricted_zone ? t('sim.restrictedGeofence', 'RESTRICTED / GEOFENCE') : t('sim.openFishingWaters', 'Open Fishing Waters')}
          </span>
        </div>

        {/* Fish Density Progress Bar */}
        <div className="fdi-bar-container">
          <div className="sim-metric-row" style={{ padding: 0 }}>
            <span className="sim-metric-label">{t('sim.fishDensityIndex', 'Fish Density Index:')}</span>
            <span className="sim-metric-val" style={{ color: 'var(--verdict-safe)' }}>{fdi.toFixed(1)} / 10.0</span>
          </div>
          <div className="fdi-bar-track">
            <div className="fdi-bar-fill" style={{ width: `${fdiPercent}%` }} />
          </div>
        </div>

        {/* Target Species */}
        <div className="sim-metric-row" style={{ marginTop: '4px' }}>
          <span className="sim-metric-label">{t('sim.targetCatch', 'Target Catch:')}</span>
          <span className="sim-metric-val" style={{ color: 'var(--marine-cyan)', fontSize: '10px' }}>
            {Array.isArray(pfz.target_species) ? pfz.target_species.join(', ') : (pfz.target_species || 'Mackerel, Tuna')}
          </span>
        </div>
      </aside>

      {/* Weather Controls Panel */}
      <div id="weather-panel" className="sim-weather-panel">
        <button className="weather-btn active" data-weather="sunny">
          ☀ {t('sim.sunny', 'SUNNY')} <span className="key-hint">[1]</span>
        </button>
        <button className="weather-btn" data-weather="cloudy">
          ☁ {t('sim.cloudy', 'CLOUDY')} <span className="key-hint">[2]</span>
        </button>
        <button className="weather-btn" data-weather="night">
          🌙 {t('sim.night', 'NIGHT')} <span className="key-hint">[3]</span>
        </button>
        <button className="weather-btn" data-weather="storm">
          ⛈ {t('sim.storm', 'STORM')} <span className="key-hint">[4]</span>
        </button>
      </div>

      {/* Visual Distress Guidance Simulation Trigger */}
      <div className="sim-distress-controls">
        <button
          className="sim-distress-btn"
          onClick={() => {
            if (engineRef.current) engineRef.current.triggerDistress();
          }}
          title="Triggers procedural audio siren, emergency storm banner, and navigation beacon (Simulation Test)"
        >
          <AlertTriangle size={11} style={{ display: 'inline', marginRight: '4px' }} />
          {t('sim.testDistress', 'Test Distress Guidance')}
        </button>
        <button
          className="sim-distress-btn"
          style={{ background: 'var(--verdict-safe-bg)', borderColor: 'var(--verdict-safe-border)', color: 'var(--verdict-safe)' }}
          onClick={() => {
            if (engineRef.current) engineRef.current.resetDistress();
          }}
        >
          {t('sim.reset', 'Reset')}
        </button>
      </div>

      {/* Geospatial Mini Tactical Radar Overlay */}
      <div id="radar-container" className="sim-radar-container">
        <div className="radar-header">{t('sim.tacticalRadar', 'ORCA TACTICAL RADAR')}</div>
        <canvas id="radar-canvas" width="160" height="160" />
        <div className="radar-legend">
          <span><span className="legend-dot green" />{t('sim.shore', 'SHORE')}</span>
          <span><span className="legend-dot cyan" />{t('sim.boat', 'BOAT')}</span>
          <span><span className="legend-dot amber" />{t('sim.buoy', 'BUOY')}</span>
          <span><span className="legend-dot emerald" />{t('sim.pfz', 'PFZ')}</span>
        </div>
      </div>

      {/* Bottom Key Controls Hint */}
      <footer id="hint" className="sim-hint">
        <span className="key">Space</span> Start/Stop Nav · <span className="key">W</span> <span className="key">S</span> Throttle · <span className="key">A</span> <span className="key">D</span> Steer · <span className="key">P</span> PFZ · <span className="key">C</span> Camera · <span className="key">U</span> Dive/Surface · <span className="key">1-4</span> Weather
      </footer>
    </div>
  );
}
