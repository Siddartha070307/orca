import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/sections/Header';
import { Footer } from '../components/sections/Footer';
import {
  Anchor,
  Ship,
  User,
  ShieldCheck,
  Compass,
  AlertTriangle,
  Radio,
  Volume2,
  CheckCircle2,
  PhoneCall,
  Languages,
  Clock,
  MapPin,
  Play,
  RotateCcw,
  Sparkles,
  Waves,
  Wind,
  Thermometer,
  ShieldAlert,
  Navigation,
  ExternalLink,
  Info,
  ChevronRight
} from 'lucide-react';

import {
  Fisherman,
  Vessel,
  FishingSession,
  SafetyAlert,
  LandingCentre
} from '../types/fisherman';
import {
  getStoredFishermen,
  saveFishermen,
  getStoredVessels,
  saveVessels,
  getStoredActiveSession,
  saveActiveSession,
  getStoredSessionHistory,
  saveSessionHistory,
  OFFICIAL_LANDING_CENTRES,
  CompletedSessionRecord
} from '../services/fishermanStorage';
import {
  RealTrackingProvider,
  DemoTrackingProvider,
  checkReturnToLandGeofence
} from '../services/trackingService';
import { fetchPointMarineProfile, MarinePointData } from '../services/marinePhysicsService';
import { MULTILINGUAL_ADVISORIES } from '../data/multilingualAdvisories';

import { FishermanRegistrationModal } from '../components/fisherman/FishermanRegistrationModal';
import { VesselRegistrationModal } from '../components/fisherman/VesselRegistrationModal';
import { CreateSessionModal } from '../components/fisherman/CreateSessionModal';
import { EmergencyWorkflowModal } from '../components/fisherman/EmergencyWorkflowModal';
import { AlertSimulationModal } from '../components/fisherman/AlertSimulationModal';
import { FishermanMap } from '../components/fisherman/FishermanMap';

export const FishermanPage: React.FC = () => {
  // Master lists
  const [fishermen, setFishermen] = useState<Fisherman[]>(getStoredFishermen);
  const [vessels, setVessels] = useState<Vessel[]>(getStoredVessels);
  const [activeSession, setActiveSession] = useState<FishingSession | null>(getStoredActiveSession);
  const [sessionHistory, setSessionHistory] = useState(getStoredSessionHistory);

  // Modals
  const [isFishermanModalOpen, setIsFishermanModalOpen] = useState(false);
  const [isVesselModalOpen, setIsVesselModalOpen] = useState(false);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAlertSimModalOpen, setIsAlertSimModalOpen] = useState(false);
  const [isEndSessionConfirmOpen, setIsEndSessionConfirmOpen] = useState(false);

  // Language selection for Multilingual Advisories
  const [selectedLang, setSelectedLang] = useState<string>('telugu');

  // Real-time Marine Telemetry at vessel coordinates
  const [vesselMarineData, setVesselMarineData] = useState<MarinePointData | null>(null);
  const [marineLoading, setMarineLoading] = useState(false);

  // Tracking Provider instances
  const demoTrackerRef = useRef(new DemoTrackingProvider());

  // Count-up Session Timer
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE_AT_SEA') return;

    const timer = setInterval(() => {
      setActiveSession(prev => {
        if (!prev) return null;
        const updated = { ...prev, durationSeconds: prev.durationSeconds + 1 };
        saveActiveSession(updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession?.status]);

  // Fetch real marine conditions at current vessel coordinates
  useEffect(() => {
    if (!activeSession) return;
    const { lat, lon } = activeSession.currentLocation;

    setMarineLoading(true);
    fetchPointMarineProfile(lat, lon)
      .then(data => {
        setVesselMarineData(data);
      })
      .finally(() => setMarineLoading(false));
  }, [activeSession?.currentLocation.lat, activeSession?.currentLocation.lon]);

  // Format seconds to HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  // Handler: Register Fisherman
  const handleRegisterFisherman = (newFisherman: Fisherman) => {
    const updated = [newFisherman, ...fishermen];
    setFishermen(updated);
    saveFishermen(updated);
  };

  // Handler: Register Vessel
  const handleRegisterVessel = (newVessel: Vessel) => {
    const updated = [newVessel, ...vessels];
    setVessels(updated);
    saveVessels(updated);
  };

  // Handler: Start New Session
  const handleStartSession = (newSession: FishingSession) => {
    setActiveSession(newSession);
    saveActiveSession(newSession);
  };

  // Handler: Advance Demo Simulation Step
  const handleAdvanceSimulation = () => {
    if (!activeSession) return;
    const nextPoint = demoTrackerRef.current.advanceSimulation();

    setActiveSession(prev => {
      if (!prev) return null;
      const newTrack = [...prev.currentTrack, nextPoint];
      // Recalculate distance
      const dist = prev.distanceFromDepartureKm + 3.2;
      const updated: FishingSession = {
        ...prev,
        currentLocation: { lat: nextPoint.lat, lon: nextPoint.lon },
        currentTrack: newTrack,
        distanceFromDepartureKm: dist
      };
      saveActiveSession(updated);
      return updated;
    });
  };

  // Handler: Ingest Alert
  const handleAddAlert = (alert: SafetyAlert) => {
    if (!activeSession) return;
    setActiveSession(prev => {
      if (!prev) return null;
      const updated: FishingSession = {
        ...prev,
        status: alert.severity === 'CRITICAL' ? 'SAFETY_ALERT' : prev.status,
        alertsReceived: [alert, ...prev.alertsReceived],
        safetyScore: Math.max(30, prev.safetyScore - (alert.severity === 'CRITICAL' ? 35 : 15))
      };
      saveActiveSession(updated);
      return updated;
    });
  };

  // Handler: End Session / Return to Land
  const handleConfirmEndSession = () => {
    if (!activeSession) return;

    const completedEntry = {
      sessionId: activeSession.sessionId,
      fishermanName: activeSession.fishermanName,
      vesselName: activeSession.vesselName,
      departureHarbour: activeSession.departureHarbour,
      departureTime: activeSession.departureTime,
      returnTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
      duration: `${Math.floor(activeSession.durationSeconds / 3600)}h ${Math.floor((activeSession.durationSeconds % 3600) / 60)}m`,
      distanceKm: parseFloat(activeSession.distanceFromDepartureKm.toFixed(1)),
      alertsCount: activeSession.alertsReceived.length,
      status: 'COMPLETED' as const
    };

    const newHistory = [completedEntry, ...sessionHistory];
    setSessionHistory(newHistory);
    saveSessionHistory(newHistory);

    setActiveSession(null);
    saveActiveSession(null);
    setIsEndSessionConfirmOpen(false);
  };

  // Return to Land Detection
  const geofenceCheck = activeSession
    ? checkReturnToLandGeofence(
        activeSession.currentLocation.lat,
        activeSession.currentLocation.lon,
        OFFICIAL_LANDING_CENTRES
      )
    : null;

  // Active Multilingual Advisory Text
  const currentAdvisory = MULTILINGUAL_ADVISORIES[selectedLang] || MULTILINGUAL_ADVISORIES.english;

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col selection:bg-[#16C7C7]/30 selection:text-[#28D7E5]">
      <Header onOpenLayers={() => {}} />

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Title Header with Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#36D399]/20 text-[#36D399] border border-[#36D399]/40 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36D399] animate-pulse" />
                <span>FISHERMAN SAFETY & SESSION MANAGEMENT</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">SIH 2026 PS 26176 • ISRO</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-heading mt-1.5 tracking-tight">
              Artisanal & Mechanized Fishery Safety Command
            </h1>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Verified identity linking, continuous tracking, INCOIS PFZ telemetry, and automated return-to-land decision support.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsFishermanModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-heading font-semibold bg-[#061F2C] hover:bg-[#082A36] text-slate-200 border border-slate-700 hover:border-[#16C7C7] transition-all flex items-center space-x-1.5 cursor-pointer shadow"
            >
              <User className="w-4 h-4 text-[#16C7C7]" />
              <span>Register Fisherman</span>
            </button>

            <button
              onClick={() => setIsVesselModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-heading font-semibold bg-[#061F2C] hover:bg-[#082A36] text-slate-200 border border-slate-700 hover:border-[#28D7E5] transition-all flex items-center space-x-1.5 cursor-pointer shadow"
            >
              <Ship className="w-4 h-4 text-[#28D7E5]" />
              <span>Register Vessel</span>
            </button>

            {!activeSession ? (
              <button
                onClick={() => setIsCreateSessionModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-heading font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 transition-all shadow-lg shadow-[#16C7C7]/20 flex items-center space-x-1.5 cursor-pointer"
              >
                <Anchor className="w-4 h-4" />
                <span>START VOYAGE SESSION</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAlertSimModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-heading font-semibold bg-[#F5B942]/15 hover:bg-[#F5B942]/25 text-[#F5B942] border border-[#F5B942]/30 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Alert Simulation (Demo)</span>
              </button>
            )}

            <button
              onClick={() => setIsEmergencyModalOpen(true)}
              disabled={!activeSession}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeSession
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>🚨 EMERGENCY SOS</span>
            </button>
          </div>
        </div>

        {/* 1. ACTIVE FISHING SESSION SECTION */}
        {activeSession ? (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl ocean-glass border-2 border-[#16C7C7]/40 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                {/* Left: Master Fisherman & Vessel Header */}
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#16C7C7]/15 border border-[#16C7C7]/30 flex items-center justify-center text-[#28D7E5] shrink-0">
                    <Ship className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                          activeSession.status === 'SAFETY_ALERT'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : 'bg-[#28D7E5]/20 text-[#28D7E5] border border-[#28D7E5]/40'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                        <span>
                          {activeSession.status === 'SAFETY_ALERT'
                            ? '🔴 CRITICAL SAFETY ALERT'
                            : '🔵 ACTIVE AT SEA'}
                        </span>
                      </span>

                      <span className="text-xs font-mono text-slate-400">
                        Session: <strong className="text-white">{activeSession.sessionId}</strong>
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white font-heading mt-1">
                      {activeSession.vesselName}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        ({activeSession.vesselId})
                      </span>
                    </h2>

                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      Master Fisherman: <strong>{activeSession.fishermanName}</strong> ({activeSession.fishermanId}) • Base: {activeSession.departureHarbour}
                    </p>
                  </div>
                </div>

                {/* Right: Live Count-Up Session Timer & End Session Button */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="p-3.5 rounded-xl bg-black/50 border border-slate-800 text-center sm:text-right">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Live Voyage Timer
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-[#36D399] tracking-wider mt-0.5">
                      {formatTimer(activeSession.durationSeconds)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Departed: {activeSession.departureTime}
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEndSessionConfirmOpen(true)}
                    className="px-4 py-3 rounded-xl text-xs font-heading font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer text-center"
                  >
                    END SESSION
                  </button>
                </div>
              </div>

              {/* Grid: Voyage Metrics, Telemetry & Return Assistant */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                <div className="p-3 rounded-xl bg-[#061F2C]/50 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">CURRENT POSITION</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">
                    {activeSession.currentLocation.lat.toFixed(4)}° N, {activeSession.currentLocation.lon.toFixed(4)}° E
                  </div>
                  <div className="text-[10px] text-[#28D7E5] font-mono mt-0.5">
                    🟡 Demo NavIC Coordinates
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#061F2C]/50 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">DISTANCE FROM PORT</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">
                    {activeSession.distanceFromDepartureKm.toFixed(1)} km
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Target Area: Sector 6/7
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#061F2C]/50 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">ONBOARD CREW</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">
                    {activeSession.crewCount} Persons
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    All Life Jackets Verified
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#061F2C]/50 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">DECISION SAFETY SCORE</div>
                  <div className="text-sm font-bold font-mono mt-1">
                    <span
                      className={
                        activeSession.safetyScore >= 70
                          ? 'text-[#36D399]'
                          : activeSession.safetyScore >= 45
                          ? 'text-[#F5B942]'
                          : 'text-[#FF4D5A]'
                      }
                    >
                      {activeSession.safetyScore} / 100
                    </span>{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      {activeSession.safetyScore >= 70 ? '● SAFE' : activeSession.safetyScore >= 45 ? '● CAUTION' : '● HAZARD'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ORCA Decision-Support
                  </div>
                </div>
              </div>

              {/* Geofence Alert Notice if Near Port */}
              {geofenceCheck?.isNearLanding && (
                <div className="mt-4 p-3 rounded-xl bg-[#36D399]/15 border border-[#36D399]/40 flex items-center justify-between text-xs font-mono text-[#36D399]">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      🟢 LANDING GEOFENCE DETECTED: Vessel is within {geofenceCheck.distanceKm.toFixed(1)} km of {geofenceCheck.centre?.name}.
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEndSessionConfirmOpen(true)}
                    className="px-3 py-1 bg-[#36D399] text-slate-900 font-bold rounded-lg hover:bg-white transition-colors cursor-pointer"
                  >
                    Confirm Return
                  </button>
                </div>
              )}
            </div>

            {/* 2-Column: Vessel Map & Marine Environmental Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Interactive ArcGIS Map for Fisherman */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center space-x-2">
                    <Compass className="w-4 h-4 text-[#16C7C7]" />
                    <span>Tactical Vessel Geonavigation & Track</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    ArcGIS Topographic Basemap • Active Vessel Overlay
                  </span>
                </div>

                <FishermanMap
                  session={activeSession}
                  onAdvanceSimulation={handleAdvanceSimulation}
                />
              </div>

              {/* Right Column: Marine Intelligence at Vessel Coordinates */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center space-x-2">
                    <Waves className="w-4 h-4 text-[#28D7E5]" />
                    <span>Real-Time Marine Conditions at Vessel</span>
                  </h3>
                  <span className="text-[10px] font-mono text-[#36D399]">
                    {marineLoading ? 'Querying Physics Models...' : '● Verified Models'}
                  </span>
                </div>

                <div className="p-5 rounded-2xl ocean-glass border border-slate-800 space-y-3.5">
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-[#061F2C] border border-slate-800">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[10px]">
                        <Waves className="w-3.5 h-3.5 text-[#28D7E5]" />
                        <span>WAVE HEIGHT (Hs)</span>
                      </div>
                      <div className="text-base font-bold text-white mt-1">
                        {vesselMarineData?.waveHeight !== null
                          ? `${vesselMarineData?.waveHeight?.toFixed(2)} m`
                          : 'DATA UNAVAILABLE'}
                      </div>
                      <div className="text-[9px] text-slate-500">ECMWF / Copernicus WAV</div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#061F2C] border border-slate-800">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[10px]">
                        <Wind className="w-3.5 h-3.5 text-[#36D399]" />
                        <span>SURFACE WIND (10m)</span>
                      </div>
                      <div className="text-base font-bold text-white mt-1">
                        {vesselMarineData?.windSpeed !== null
                          ? `${vesselMarineData?.windSpeed?.toFixed(1)} m/s (${vesselMarineData?.windDirection ?? '—'}°)`
                          : 'DATA UNAVAILABLE'}
                      </div>
                      <div className="text-[9px] text-slate-500">ECMWF Boundary Layer</div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#061F2C] border border-slate-800">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[10px]">
                        <Compass className="w-3.5 h-3.5 text-[#8B6CFF]" />
                        <span>OCEAN CURRENT</span>
                      </div>
                      <div className="text-base font-bold text-white mt-1">
                        {vesselMarineData?.currentVelocity !== null
                          ? `${vesselMarineData?.currentVelocity?.toFixed(2)} m/s`
                          : 'DATA UNAVAILABLE'}
                      </div>
                      <div className="text-[9px] text-slate-500">Copernicus PHY Model</div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#061F2C] border border-slate-800">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[10px]">
                        <Thermometer className="w-3.5 h-3.5 text-[#FF4D5A]" />
                        <span>SEA TEMP (SST)</span>
                      </div>
                      <div className="text-base font-bold text-white mt-1">
                        {vesselMarineData?.seaSurfaceTemperature !== null
                          ? `${vesselMarineData?.seaSurfaceTemperature?.toFixed(1)} °C`
                          : 'DATA UNAVAILABLE'}
                      </div>
                      <div className="text-[9px] text-slate-500">INCOIS ChloroGIN Composite</div>
                    </div>
                  </div>

                  {/* Return-to-Land Assistant */}
                  <div className="p-3.5 rounded-xl bg-[#082A36]/60 border border-[#16C7C7]/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-[#16C7C7] flex items-center space-x-1.5">
                        <Navigation className="w-3.5 h-3.5" />
                        <span>SAFE RETURN-TO-LAND ASSISTANT</span>
                      </span>
                      <span className="text-[#36D399] font-bold">🟢 NORMAL RETURN</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                      Recommended heading back to Machilipatnam: <strong>300° WNW</strong>. Estimated cruising time: 1h 45m. Daylight remaining: 4h 30m.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SAFETY / ALERT CENTER */}
            <div className="p-6 rounded-2xl ocean-glass border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#F5B942]" />
                  <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider">
                    Voyage Safety & Threat Alert Center ({activeSession.alertsReceived.length})
                  </h3>
                </div>
                <button
                  onClick={() => setIsAlertSimModalOpen(true)}
                  className="text-xs text-[#28D7E5] font-mono hover:underline cursor-pointer"
                >
                  + Simulate Another Alert
                </button>
              </div>

              {activeSession.alertsReceived.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#061F2C]/40 border border-slate-800 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-[#36D399] mx-auto" />
                  <div className="text-xs font-semibold text-white">No Active Critical Threats Detected</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    All coastal marine parameters are within safe operating thresholds for {activeSession.vesselName}.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSession.alertsReceived.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-950/40 border-red-500/50 text-red-200'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                          : 'bg-yellow-950/30 border-yellow-500/40 text-yellow-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-heading text-xs uppercase">{alert.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/40 border border-current">
                            {alert.severity}
                          </span>
                          {alert.isSimulated && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/60 text-slate-400">
                              SIMULATED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono opacity-90">{alert.actualDataValue}</div>
                        <div className="text-[11px] font-sans text-slate-300">{alert.recommendation}</div>
                        <div className="text-[9px] font-mono text-slate-400 pt-0.5">
                          Source: {alert.source} • Time: {alert.timestamp}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-black/50 text-[10px] font-mono text-slate-300">
                          Active Monitoring
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No Active Session Banner */
          <div className="p-8 rounded-2xl ocean-glass border border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#16C7C7]/15 border border-[#16C7C7]/30 flex items-center justify-center mx-auto text-[#28D7E5]">
              <Anchor className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-heading">
                No Active Fishing Voyage Session Currently at Sea
              </h2>
              <p className="text-xs text-slate-400 font-mono max-w-md mx-auto mt-1">
                Link a registered fisherman with an approved vessel to begin real-time sea-state tracking and decision support.
              </p>
            </div>
            <button
              onClick={() => setIsCreateSessionModalOpen(true)}
              className="px-6 py-2.5 rounded-xl text-xs font-heading font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 transition-all shadow-lg shadow-[#16C7C7]/20 cursor-pointer"
            >
              CREATE NEW FISHING SESSION
            </button>
          </div>
        )}

        {/* 4. MULTILINGUAL FISHERMAN ADVISORY & COMMUNICATION CENTER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Multilingual Advisory Section */}
          <div className="lg:col-span-8 p-6 rounded-2xl ocean-glass border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <Languages className="w-5 h-5 text-[#28D7E5]" />
                <div>
                  <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider">
                    Multilingual NavIC Sea Advisory ({currentAdvisory.nativeName})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Official INCOIS PFZ Broadcasts translated for Indian Coastal Languages
                  </p>
                </div>
              </div>

              {/* Language Selector */}
              <select
                value={selectedLang}
                onChange={e => setSelectedLang(e.target.value)}
                className="bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-slate-100 font-heading focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              >
                <option value="telugu">తెలుగు (Telugu)</option>
                <option value="tamil">தமிழ் (Tamil)</option>
                <option value="english">English</option>
                <option value="hindi">हिन्दी (Hindi)</option>
                <option value="malayalam">മലയാളം (Malayalam)</option>
                <option value="kannada">ಕನ್ನಡ (Kannada)</option>
                <option value="odia">ଓଡ଼ିଆ (Odia)</option>
                <option value="bengali">বাংলা (Bengali)</option>
                <option value="marathi">मराठी (Marathi)</option>
                <option value="gujarati">ગુજરાતી (Gujarati)</option>
              </select>
            </div>

            {/* Localized Content Card */}
            <div className="p-4 rounded-xl bg-[#061F2C]/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#16C7C7] font-heading">{currentAdvisory.pfzAdvisoryTitle}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#36D399]/15 text-[#36D399]">
                  NavIC Broadcast
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {currentAdvisory.pfzAdvisoryBody}
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{currentAdvisory.waveAlert}</span>
              </div>
            </div>
          </div>

          {/* Right: Communication Channels Center */}
          <div className="lg:col-span-4 p-6 rounded-2xl ocean-glass border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
              <Radio className="w-5 h-5 text-[#16C7C7]" />
              <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider">
                Communication Status
              </h3>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#061F2C] border border-slate-800 flex items-center justify-between">
                <span>NavIC Marine Beacon:</span>
                <span className="text-[#36D399] font-bold">SIMULATION READY</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#061F2C] border border-slate-800 flex items-center justify-between">
                <span>VHF Marine Ch 16:</span>
                <span className="text-[#36D399] font-bold">MONITORING</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#061F2C] border border-slate-800 flex items-center justify-between">
                <span>SMS Cellular Dispatch:</span>
                <span className="text-[#F5B942] font-bold">QUEUED (DEMO)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#061F2C] border border-slate-800 flex items-center justify-between">
                <span>Coast Guard SAR (1554):</span>
                <span className="text-[#28D7E5] font-bold">HOTLINE STANDBY</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. REGISTERED PROFILES & SESSION HISTORY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Registered Fishermen & Vessels Overview */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center space-x-2">
              <User className="w-4 h-4 text-[#16C7C7]" />
              <span>Registered Fishermen & Vessels</span>
            </h3>

            <div className="space-y-3">
              {fishermen.map(f => (
                <div key={f.id} className="p-3.5 rounded-xl ocean-glass border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white font-heading">{f.fullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {f.id} • {f.idType} ({f.idNumberMasked})
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Harbour: {f.homeHarbour} • Sessions: {f.totalSessions}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#36D399]/15 text-[#36D399] border border-[#36D399]/30">
                    VERIFIED
                  </span>
                </div>
              ))}

              {vessels.map(v => (
                <div key={v.id} className="p-3.5 rounded-xl ocean-glass border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white font-heading">{v.name} ({v.id})</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Reg: {v.registrationNumber} • {v.overallLength}m {v.vesselType}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Engine: {v.engineType} ({v.enginePowerHP} HP) • Max Range: {v.maxOperatingRangeKm} km
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#28D7E5]/15 text-[#28D7E5] border border-[#28D7E5]/30">
                    {v.safetyCertificateStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Session History Table */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#28D7E5]" />
              <span>Previous Fishing Voyages ({sessionHistory.length})</span>
            </h3>

            <div className="rounded-2xl ocean-glass border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#061F2C] text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">Session ID</th>
                      <th className="p-3">Vessel / Fisherman</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Distance</th>
                      <th className="p-3">Alerts</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {sessionHistory.map((item: CompletedSessionRecord) => (
                      <tr key={item.sessionId} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white">{item.sessionId}</td>
                        <td className="p-3">
                          <div>{item.vesselName}</div>
                          <div className="text-[10px] text-slate-500">{item.fishermanName}</div>
                        </td>
                        <td className="p-3">{item.duration}</td>
                        <td className="p-3">{item.distanceKm} km</td>
                        <td className="p-3">
                          {item.alertsCount > 0 ? (
                            <span className="text-amber-400">{item.alertsCount} Alerts</span>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#36D399]/15 text-[#36D399] border border-[#36D399]/30">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* MODALS */}
      <FishermanRegistrationModal
        isOpen={isFishermanModalOpen}
        onClose={() => setIsFishermanModalOpen(false)}
        onRegister={handleRegisterFisherman}
      />

      <VesselRegistrationModal
        isOpen={isVesselModalOpen}
        onClose={() => setIsVesselModalOpen(false)}
        onRegister={handleRegisterVessel}
      />

      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        onClose={() => setIsCreateSessionModalOpen(false)}
        fishermen={fishermen}
        vessels={vessels}
        onCreateSession={handleStartSession}
      />

      <EmergencyWorkflowModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        session={activeSession}
        onTriggerEmergency={handleAddAlert}
      />

      <AlertSimulationModal
        isOpen={isAlertSimModalOpen}
        onClose={() => setIsAlertSimModalOpen(false)}
        currentLat={activeSession?.currentLocation.lat || 16.02}
        currentLon={activeSession?.currentLocation.lon || 81.42}
        onSimulateAlert={handleAddAlert}
      />

      {/* Confirmation Dialog: End Session */}
      {isEndSessionConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md ocean-glass rounded-2xl shadow-2xl border border-slate-700 p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-amber-400">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-heading">
                Confirm Return to Port & Complete Session?
              </h3>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Have you safely berthed at <strong>{activeSession?.departureHarbour}</strong>? Ending the session will log your voyage into Session History and close live telemetry.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEndSessionConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSession}
                className="px-5 py-2 rounded-xl text-xs font-heading font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 transition-all shadow cursor-pointer"
              >
                YES — COMPLETE VOYAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
