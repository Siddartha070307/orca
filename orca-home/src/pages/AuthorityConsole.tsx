import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '../components/sections/Header';
import { OrcaFrontendEmbed } from '../components/OrcaFrontendEmbed';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Compass,
  MapPin,
  Anchor,
  Activity,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Radio,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Maximize2,
  MessageSquare,
  X
} from 'lucide-react';
import { useI18n } from '../utils/i18n';
import Map from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Graphic from '@arcgis/core/Graphic.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import Point from '@arcgis/core/geometry/Point.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';
import IdentityManager from '@arcgis/core/identity/IdentityManager.js';
import { initArcGisConfig, BASEMAP_CONFIG } from '../config/arcgis';
import { OFFICIAL_LANDING_CENTRES, getStoredSessionHistory } from '../services/fishermanStorage';

// Authoritative restricted zones catalog (mirrors backend RESTRICTED_ZONES)
const NATIONWIDE_RESTRICTED_ZONES = [
  {
    id: 'zone-karwar',
    name: 'Karwar Naval Exclusion Perimeter (INS Kadamba / Project Seabird)',
    type: 'Naval Security Exclusion Zone',
    state: 'Karnataka',
    riskLevel: 'CRITICAL',
    coordinates: [
      [74.08, 14.78],
      [74.18, 14.78],
      [74.18, 14.86],
      [74.08, 14.86],
      [74.08, 14.78]
    ],
    bufferKm: 10,
    regulation: 'Defense of India Act & Coastal Security Directive'
  },
  {
    id: 'zone-mannar',
    name: 'Gulf of Mannar Marine Biosphere Reserve & National Park',
    type: 'Marine Biosphere Reserve / National Park',
    state: 'Tamil Nadu',
    riskLevel: 'HIGH',
    coordinates: [
      [79.00, 9.10],
      [79.35, 9.10],
      [79.35, 9.30],
      [79.00, 9.30],
      [79.00, 9.10]
    ],
    bufferKm: 5,
    regulation: 'Wildlife Protection Act (Schedule I Coral & Dugong Habitat)'
  },
  {
    id: 'zone-gahirmatha',
    name: 'Gahirmatha Marine Sanctuary (Olive Ridley Nesting Ground)',
    type: 'Marine Sanctuary',
    state: 'Odisha',
    riskLevel: 'HIGH',
    coordinates: [
      [86.75, 20.60],
      [87.15, 20.60],
      [87.15, 20.90],
      [86.75, 20.90],
      [86.75, 20.60]
    ],
    bufferKm: 20,
    regulation: 'Seasonal Mechanized Fishing Prohibition Order'
  },
  {
    id: 'zone-bombayhigh',
    name: 'Mumbai Offshore High Security Zone (Bombay High Oil Field)',
    type: 'Critical Energy Infrastructure Exclusion Perimeter',
    state: 'Maharashtra',
    riskLevel: 'CRITICAL',
    coordinates: [
      [71.80, 19.20],
      [72.25, 19.20],
      [72.25, 19.65],
      [71.80, 19.65],
      [71.80, 19.20]
    ],
    bufferKm: 15,
    regulation: 'Petroleum & Natural Gas (Safety in Offshore Operations) Rules'
  }
];

// Active sector advisory records across Indian waters
interface SectorAdvisoryRecord {
  id: string;
  sector: string;
  state: string;
  lat: number;
  lon: number;
  verdict: 'UNSAFE' | 'CAUTION' | 'SAFE';
  windSpeedKmh: number;
  waveHeightM: number;
  sstC: number;
  restrictedProximity: string;
  isRestrictedConflict: boolean;
  vesselsAtSea: number;
  summary: string;
  updatedAt: string;
  agentTraces: Array<{
    agent: string;
    status: string;
    verdict?: string;
    confidence: number;
    details: string;
  }>;
}

const ACTIVE_SECTOR_ADVISORIES: SectorAdvisoryRecord[] = [
  {
    id: 'ADV-KARWAR-0925',
    sector: 'Karwar / INS Kadamba',
    state: 'Karnataka',
    lat: 14.82,
    lon: 74.13,
    verdict: 'UNSAFE',
    windSpeedKmh: 34.2,
    waveHeightM: 2.8,
    sstC: 28.5,
    restrictedProximity: 'INSIDE NAVAL PERIMETER (0.0 km buffer)',
    isRestrictedConflict: true,
    vesselsAtSea: 3,
    summary: 'IMMEDIATE RECALL ORDER: Unauthorized fishing vessels detected inside Karwar Naval Exclusion Perimeter. Swell wave height 2.8m exceeds safety limits.',
    updatedAt: '25-Sep 06:45 IST',
    agentTraces: [
      { agent: 'GeospatialReasoningAgent', status: 'COMPLETED', verdict: 'UNSAFE', confidence: 0.99, details: 'Polygon intersection test positive: Karwar Naval Exclusion Perimeter boundary violated.' },
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'CAUTION', confidence: 0.95, details: 'Significant wave height 2.8m exceeds 2.0m threshold for small craft.' },
      { agent: 'RiskAssessmentAgent', status: 'COMPLETED', verdict: 'UNSAFE', confidence: 0.98, details: 'Deterministic safety override: National security perimeter breach.' }
    ]
  },
  {
    id: 'ADV-MANNAR-0924',
    sector: 'Gulf of Mannar / Rameswaram',
    state: 'Tamil Nadu',
    lat: 9.18,
    lon: 79.15,
    verdict: 'CAUTION',
    windSpeedKmh: 28.0,
    waveHeightM: 1.9,
    sstC: 29.1,
    restrictedProximity: 'Proximity Warning: 3.2 km to Biosphere Reserve',
    isRestrictedConflict: true,
    vesselsAtSea: 8,
    summary: 'Active fleet operating near northern boundary of Marine Biosphere Reserve. Proximity alert active (< 5 km). Trawling strictly prohibited.',
    updatedAt: '25-Sep 06:15 IST',
    agentTraces: [
      { agent: 'GeospatialReasoningAgent', status: 'COMPLETED', verdict: 'CAUTION', confidence: 0.97, details: 'Boundary distance 3.2 km < 5.0 km sanctuary buffer zone.' },
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.94, details: 'Wave height 1.9m and wind 28 km/h within manageable envelope.' },
      { agent: 'RiskAssessmentAgent', status: 'COMPLETED', verdict: 'CAUTION', confidence: 0.96, details: 'Marine sanctuary proximity buffer caution issued.' }
    ]
  },
  {
    id: 'ADV-GAHIR-0925',
    sector: 'Gahirmatha / Dhamra',
    state: 'Odisha',
    lat: 20.72,
    lon: 86.95,
    verdict: 'CAUTION',
    windSpeedKmh: 31.5,
    waveHeightM: 2.1,
    sstC: 27.9,
    restrictedProximity: 'Buffer Advisory: 8.5 km to Olive Ridley Core',
    isRestrictedConflict: false,
    vesselsAtSea: 5,
    summary: 'Northeast squall line causing 2.1m sea chop. Vessels cautioned to maintain distance from Gahirmatha turtle breeding sanctuary.',
    updatedAt: '25-Sep 05:50 IST',
    agentTraces: [
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'CAUTION', confidence: 0.92, details: 'Wave height 2.1m and wind gusts reaching 42 km/h.' },
      { agent: 'GeospatialReasoningAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.95, details: 'Vessels currently outside 20 km seasonal sanctuary limit.' },
      { agent: 'RiskAssessmentAgent', status: 'COMPLETED', verdict: 'CAUTION', confidence: 0.94, details: 'Weather safety rules triggered: Significant wave height >= 2.0m.' }
    ]
  },
  {
    id: 'ADV-MNG-0925',
    sector: 'Mangalore Coast',
    state: 'Karnataka',
    lat: 12.87,
    lon: 74.84,
    verdict: 'SAFE',
    windSpeedKmh: 14.5,
    waveHeightM: 1.1,
    sstC: 28.2,
    restrictedProximity: 'All Clear (> 45 km to closest naval perimeter)',
    isRestrictedConflict: false,
    vesselsAtSea: 22,
    summary: 'Normal operational clearance. Excellent fishing conditions along PFZ-MNG-01 (31.5 km offshore). Weather and navigation clear.',
    updatedAt: '25-Sep 06:30 IST',
    agentTraces: [
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.98, details: 'Wind speed 14.5 km/h, wave height 1.1m (calm sea state).' },
      { agent: 'OceanAnalyticsAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.96, details: 'PFZ suitability optimal (0.91), fish density index 8.9/10.' },
      { agent: 'GeospatialReasoningAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.99, details: 'Zero restricted marine zone conflicts.' }
    ]
  },
  {
    id: 'ADV-VIZAG-0925',
    sector: 'Visakhapatnam Outer Port',
    state: 'Andhra Pradesh',
    lat: 17.69,
    lon: 83.30,
    verdict: 'SAFE',
    windSpeedKmh: 16.0,
    waveHeightM: 1.3,
    sstC: 28.6,
    restrictedProximity: 'Clear of Eastern Naval Command perimeter',
    isRestrictedConflict: false,
    vesselsAtSea: 18,
    summary: 'Port clearance operational. Coastal waters calm, mackerel and tuna schools detected 28 km offshore along bio-thermal front.',
    updatedAt: '25-Sep 06:00 IST',
    agentTraces: [
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.97, details: 'Wave height 1.3m, barometric pressure stable 1011 hPa.' },
      { agent: 'GeospatialReasoningAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.99, details: 'No entry into restricted naval roadsteads.' },
      { agent: 'RiskAssessmentAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.98, details: 'Safety clearance granted.' }
    ]
  },
  {
    id: 'ADV-KOCHI-0925',
    sector: 'Kochi / Munambam',
    state: 'Kerala',
    lat: 9.94,
    lon: 76.26,
    verdict: 'SAFE',
    windSpeedKmh: 18.2,
    waveHeightM: 1.4,
    sstC: 28.4,
    restrictedProximity: 'Clear of Southern Naval Command shipping lanes',
    isRestrictedConflict: false,
    vesselsAtSea: 34,
    summary: 'Active fleet operating in Arabian Sea shelf. High sardine aggregation. Coastal swell normal at 1.4m.',
    updatedAt: '25-Sep 05:40 IST',
    agentTraces: [
      { agent: 'WeatherIntelligenceAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.96, details: 'Wave height 1.4m, wind 18.2 km/h.' },
      { agent: 'OceanAnalyticsAgent', status: 'COMPLETED', verdict: 'SAFE', confidence: 0.95, details: 'Thermal front delineated at 45m depth contour.' }
    ]
  }
];

export const AuthorityConsole: React.FC = () => {
  const { t } = useI18n();
  const [filterMode, setFilterMode] = useState<'all' | 'hazard' | 'restricted'>('all');
  const [selectedAdvisory, setSelectedAdvisory] = useState<SectorAdvisoryRecord | null>(ACTIVE_SECTOR_ADVISORIES[0]);
  const [showNavalLayers, setShowNavalLayers] = useState(true);
  const [showSanctuaryLayers, setShowSanctuaryLayers] = useState(true);
  const [showHarbours, setShowHarbours] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  // ArcGIS Map container ref
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);

  // Sorted records with CAUTION and UNSAFE prioritized at top
  const sortedAndFilteredAdvisories = useMemo(() => {
    return ACTIVE_SECTOR_ADVISORIES.filter((rec) => {
      if (filterMode === 'hazard') {
        return rec.verdict === 'UNSAFE' || rec.verdict === 'CAUTION';
      }
      if (filterMode === 'restricted') {
        return rec.isRestrictedConflict;
      }
      return true;
    }).sort((a, b) => {
      // UNSAFE (rank 1) > CAUTION (rank 2) > SAFE (rank 3)
      const rank = (v: string) => (v === 'UNSAFE' ? 1 : v === 'CAUTION' ? 2 : 3);
      return rank(a.verdict) - rank(b.verdict);
    });
  }, [filterMode]);

  // Initialize ArcGIS Map with Restricted Zones Emphasized
  useEffect(() => {
    initArcGisConfig();
    try {
      if (IdentityManager) {
        // Suppress OAuth sign in modal popup dialog completely
        IdentityManager.dialog = null as any;
        IdentityManager.getCredential = () => Promise.reject(new Error('Auth canceled'));
      }
    } catch (e) {}

    if (!mapDivRef.current || viewRef.current) return;

    const restrictedLayer = new GraphicsLayer({ id: 'restricted-zones-layer' });
    const harbourLayer = new GraphicsLayer({ id: 'harbour-layer' });
    const sectorAlertsLayer = new GraphicsLayer({ id: 'sector-alerts-layer' });

    const map = new Map({
      basemap: BASEMAP_CONFIG.defaultBasemapId,
      layers: [restrictedLayer, harbourLayer, sectorAlertsLayer]
    });

    const view = new MapView({
      container: mapDivRef.current,
      map: map,
      center: [78.5, 14.0], // Centered over Indian peninsula
      zoom: 5,
      ui: { components: ['zoom'] }
    });

    viewRef.current = view;

    // Draw Restricted Zones with prominent styling
    NATIONWIDE_RESTRICTED_ZONES.forEach((zone) => {
      const isNaval = zone.type.toLowerCase().includes('naval') || zone.type.toLowerCase().includes('energy');
      const fillColor = isNaval ? [220, 38, 38, 0.45] : [245, 158, 11, 0.45];
      const strokeColor = isNaval ? [239, 68, 68, 1.0] : [251, 191, 36, 1.0];

      const polygon = new Polygon({
        rings: [zone.coordinates],
        spatialReference: { wkid: 4326 }
      });

      const fillSymbol = new SimpleFillSymbol({
        color: fillColor,
        outline: {
          color: strokeColor,
          width: 2.5
        }
      });

      const graphic = new Graphic({
        geometry: polygon,
        symbol: fillSymbol,
        attributes: zone,
        popupTemplate: new PopupTemplate({
          title: '{name}',
          content: `
            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">
              <p><strong>Zone Classification:</strong> {type}</p>
              <p><strong>Enforcement Tier:</strong> <span style="color: #ef4444; font-weight: 700;">{riskLevel}</span></p>
              <p><strong>Statutory Buffer:</strong> {bufferKm} km perimeter</p>
              <p><strong>Governing Regulation:</strong> {regulation}</p>
            </div>
          `
        })
      });

      restrictedLayer.add(graphic);
    });

    // Draw Official Landing Centres
    OFFICIAL_LANDING_CENTRES.forEach((centre) => {
      const pt = new Point({
        longitude: centre.lon,
        latitude: centre.lat,
        spatialReference: { wkid: 4326 }
      });

      const symbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: [22, 199, 199, 0.9],
        size: '10px',
        outline: {
          color: [3, 20, 31, 1],
          width: 2
        }
      });

      const graphic = new Graphic({
        geometry: pt,
        symbol: symbol,
        attributes: centre,
        popupTemplate: new PopupTemplate({
          title: '⚓ {name}',
          content: `
            <div style="font-size: 12px; color: #cbd5e1;">
              <p>State: <strong>{state}</strong></p>
              <p>VHF Channel: <strong>{vhfChannel}</strong></p>
              <p>Emergency Contact: <strong>{contactEmergency}</strong></p>
            </div>
          `
        })
      });

      harbourLayer.add(graphic);
    });

    // Draw Sector Alert Points
    ACTIVE_SECTOR_ADVISORIES.forEach((adv) => {
      const pt = new Point({
        longitude: adv.lon,
        latitude: adv.lat,
        spatialReference: { wkid: 4326 }
      });

      const alertColor =
        adv.verdict === 'UNSAFE'
          ? [239, 68, 68, 1]
          : adv.verdict === 'CAUTION'
          ? [245, 158, 11, 1]
          : [52, 211, 153, 1];

      const symbol = new SimpleMarkerSymbol({
        style: 'diamond',
        color: alertColor,
        size: '14px',
        outline: {
          color: [255, 255, 255, 1],
          width: 2
        }
      });

      const graphic = new Graphic({
        geometry: pt,
        symbol: symbol,
        attributes: adv,
        popupTemplate: new PopupTemplate({
          title: '{sector} [{verdict}]',
          content: '{summary}'
        })
      });

      sectorAlertsLayer.add(graphic);
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col selection:bg-[#16C7C7]/30 selection:text-[#28D7E5]">
      {/* Shell Header */}
      <Header />

      {/* Sub-header / Status Banner */}
      <div className="bg-[#061F2C] border-b border-[#F5B942]/20 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#F5B942]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white font-heading tracking-wide">
                {t('auth.heading', 'MARITIME SAFETY & SURVEILLANCE CONSOLE')}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/40 font-bold">
                ENFORCEMENT GRID
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {t(
                'auth.subheading',
                'Directorate General of Shipping • Indian Coast Guard • Marine Police Enforcement Grid'
              )}
            </p>
          </div>
        </div>

        {/* Live Grid Metrics */}
        <div className="flex items-center space-x-3 sm:space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF4D5A] animate-ping" />
            <span className="text-slate-400">UNSAFE ALERTS:</span>
            <span className="text-[#FF4D5A] font-bold">1 SECTOR</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5B942]" />
            <span className="text-slate-400">CAUTION:</span>
            <span className="text-[#F5B942] font-bold">2 SECTORS</span>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#36D399]" />
            <span className="text-slate-400">RESTRICTED ZONES:</span>
            <span className="text-[#36D399] font-bold">4 MONITORED</span>
          </div>
        </div>
        {/* ORCA Intelligence Chat Toggle */}
        <button
          onClick={() => setChatOpen((o) => !o)}
          title={chatOpen ? 'Close Intelligence Chat' : 'Open ORCA Intelligence Chat'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: chatOpen ? 'rgba(46,143,176,0.25)' : 'rgba(46,143,176,0.12)',
            border: '1px solid rgba(46,143,176,0.40)',
            borderRadius: '7px',
            color: '#7DE8FF',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {chatOpen ? <X size={13} /> : <MessageSquare size={13} />}
          {chatOpen ? 'CLOSE CHAT' : 'ORCA INTELLIGENCE'}
        </button>
      </div>

      {/* Main Console Workspace + Docked Chat Panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <main className="flex-1 overflow-y-auto max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Split: Geospatial Map Viewport (Left) + Selected Sector Audit Panel (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Map Viewport (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col ocean-glass rounded-2xl border border-[#16C7C7]/20 overflow-hidden shadow-2xl">
            {/* Map Header & Controls */}
            <div className="p-3.5 bg-[#061F2C]/90 border-b border-[#16C7C7]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#FF4D5A]" />
                <span className="font-heading font-bold text-white tracking-wide">
                  RESTRICTED DEFENSE &amp; SANCTUARY ZONES (EMPHASIZED BY DEFAULT)
                </span>
              </div>

              {/* Layer toggles */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/60">
                  Naval Perimeters Active
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  Sanctuaries Active
                </span>
              </div>
            </div>

            {/* ArcGIS Map Container */}
            <div className="relative w-full h-[400px] sm:h-[450px] bg-[#000810]">
              <div ref={mapDivRef} className="w-full h-full" />

              {/* Floating Symbology Legend */}
              <div className="absolute bottom-3 left-3 bg-[#03141F]/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-[11px] space-y-1.5 shadow-xl font-mono">
                <div className="font-bold text-white mb-1">SURVEILLANCE SYMBOLOGY</div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-red-500/50 border border-red-500 rounded-sm" />
                  <span className="text-slate-300">Naval Security Exclusion Zone</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-amber-500/50 border border-amber-500 rounded-sm" />
                  <span className="text-slate-300">Marine Sanctuary / National Park</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16C7C7]" />
                  <span className="text-slate-300">Official Landing Centre</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rotate-45" />
                  <span className="text-slate-300">Active Sector Alert (UNSAFE)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scoped Safety Assessment & Agent Trace (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col ocean-glass rounded-2xl border border-[#16C7C7]/20 p-5 overflow-hidden">
            {selectedAdvisory ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16C7C7]/15 text-[#28D7E5] border border-[#16C7C7]/30">
                      INCIDENT AUDIT: {selectedAdvisory.id}
                    </span>
                    <h3 className="text-lg font-bold text-white font-heading mt-1">
                      {selectedAdvisory.sector}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {selectedAdvisory.state} • {selectedAdvisory.lat}°N, {selectedAdvisory.lon}°E
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                      selectedAdvisory.verdict === 'UNSAFE'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                        : selectedAdvisory.verdict === 'CAUTION'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {selectedAdvisory.verdict}
                  </span>
                </div>

                {/* Advisory Summary Box */}
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    selectedAdvisory.verdict === 'UNSAFE'
                      ? 'bg-red-950/30 border-red-800/50 text-red-200'
                      : selectedAdvisory.verdict === 'CAUTION'
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                  }`}
                >
                  <p className="font-medium">{selectedAdvisory.summary}</p>
                </div>

                {/* Met-Ocean & Proximity Parameters */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#03141F] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">WAVE &amp; WIND</span>
                    <span className="text-white font-bold">
                      {selectedAdvisory.waveHeightM}m • {selectedAdvisory.windSpeedKmh} km/h
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#03141F] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">VESSELS ACTIVE</span>
                    <span className="text-[#36D399] font-bold">
                      {selectedAdvisory.vesselsAtSea} Vessels Tracked
                    </span>
                  </div>

                  <div className="col-span-2 p-3 rounded-xl bg-[#03141F] border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">BOUNDARY STATUS</span>
                    <span
                      className={`font-semibold ${
                        selectedAdvisory.isRestrictedConflict ? 'text-[#FF4D5A]' : 'text-[#36D399]'
                      }`}
                    >
                      {selectedAdvisory.restrictedProximity}
                    </span>
                  </div>
                </div>

                {/* 9-Agent Pipeline Traces Scoped to this Advisory */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 font-heading tracking-wide mb-2 flex items-center justify-between">
                    <span>COLLABORATIVE AGENT AUDIT TRACE</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {selectedAdvisory.agentTraces.length} Agents Logged
                    </span>
                  </h4>

                  <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                    {selectedAdvisory.agentTraces.map((trace, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#03141F]/80 border border-slate-800 text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-white text-[11px]">
                            {trace.agent}
                          </span>
                          <span className="text-[10px] font-mono text-[#36D399]">
                            {Math.round(trace.confidence * 100)}% Conf.
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{trace.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs text-center py-10">
                <Info className="w-8 h-8 mb-2 opacity-50" />
                <span>Select any sector from the table below to inspect detailed agent verification logs.</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Prioritized Cross-Sector Recent Verdicts Table */}
        <div className="ocean-glass rounded-2xl border border-[#16C7C7]/20 overflow-hidden shadow-2xl">
          {/* Table Header & Filter Bar */}
          <div className="p-4 bg-[#061F2C]/90 border-b border-[#16C7C7]/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#36D399]" />
                <h3 className="text-sm font-bold text-white font-heading tracking-wider uppercase">
                  {t('auth.activeVerdicts', 'Cross-Sector Live Advisory Verdicts')}
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {t(
                  'auth.verdictSubtitle',
                  'Prioritized cross-fleet safety statuses. Caution and Unsafe warnings surfaced to top.'
                )}
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-[#16C7C7] text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                All Sectors ({ACTIVE_SECTOR_ADVISORIES.length})
              </button>

              <button
                onClick={() => setFilterMode('hazard')}
                className={`px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                  filterMode === 'hazard'
                    ? 'bg-[#FF4D5A] text-white font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Caution &amp; Unsafe (3)
              </button>

              <button
                onClick={() => setFilterMode('restricted')}
                className={`px-3 py-1.5 rounded-lg font-mono transition-all cursor-pointer ${
                  filterMode === 'restricted'
                    ? 'bg-[#F5B942] text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Restricted Conflicts (2)
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#03141F] text-slate-400 font-mono border-b border-slate-800">
                  <th className="py-3 px-4 font-medium">{t('auth.table.sector', 'SECTOR / HARBOUR')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.verdict', 'VERDICT')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.wave', 'WAVE (m)')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.wind', 'WIND (km/h)')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.restrictedProximity', 'RESTRICTED BOUNDARY')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.vesselCount', 'VESSELS')}</th>
                  <th className="py-3 px-4 font-medium">{t('auth.table.timestamp', 'UPDATED (IST)')}</th>
                  <th className="py-3 px-4 font-medium text-right">{t('auth.table.actions', 'ACTIONS')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedAndFilteredAdvisories.map((row) => {
                  const isSelected = selectedAdvisory?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedAdvisory(row)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#082A36]'
                          : row.verdict === 'UNSAFE'
                          ? 'hover:bg-red-950/20 bg-red-950/10'
                          : row.verdict === 'CAUTION'
                          ? 'hover:bg-amber-950/20 bg-amber-950/10'
                          : 'hover:bg-[#061F2C]/60'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white font-heading">{row.sector}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{row.state}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                            row.verdict === 'UNSAFE'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                              : row.verdict === 'CAUTION'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}
                        >
                          {row.verdict}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                        {row.waveHeightM} m
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {row.windSpeedKmh} km/h
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono text-[11px] ${
                            row.isRestrictedConflict ? 'text-[#FF4D5A] font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {row.restrictedProximity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[#36D399] font-medium">
                        {row.vesselsAtSea}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {row.updatedAt}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAdvisory(row);
                          }}
                          className="px-2.5 py-1 rounded bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] hover:bg-[#16C7C7]/20 transition-all font-mono text-[11px] cursor-pointer"
                        >
                          Inspect Audit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backend Endpoint Notice & Integration Callout */}
        <div className="p-4 rounded-xl bg-[#061F2C]/80 border border-slate-700/80 text-xs font-mono text-slate-400 flex items-start space-x-3">
          <Info className="w-5 h-5 text-[#28D7E5] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-slate-200">Backend Cross-Session Telemetry Integration:</strong>
            <p className="mt-1">
              ORCA SQLite database (<code className="text-[#16C7C7]">orca.db</code>) contains 449 recorded query sessions in table <code className="text-[#16C7C7]">query_records</code>. Currently running with client-side active sector monitoring. To stream continuous cross-session database queries into this surveillance view, backend route <code className="text-[#16C7C7]">GET /queries?limit=50</code> can be enabled.
            </p>
          </div>
        </div>
      </main>

        {/* Docked ORCA Intelligence Chat — real orac-frontend ChatPanel via iframe */}
        {chatOpen && (
          <aside
            style={{
              width: '380px',
              minWidth: '320px',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid rgba(22,199,199,0.18)',
              background: '#040E17',
              flexShrink: 0,
              overflow: 'hidden',
            }}
            aria-label="ORCA Intelligence Chat Panel"
          >
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#061F2C',
                borderBottom: '1px solid rgba(22,199,199,0.18)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={14} color="#7DE8FF" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7DE8FF', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                  ORCA INTELLIGENCE
                </span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7DE8FF', display: 'flex', alignItems: 'center', padding: '2px' }}
                title="Close chat"
              >
                <X size={14} />
              </button>
            </div>
            {/* Embedded real ChatPanel from orac-frontend */}
            <OrcaFrontendEmbed
              title="ORCA Intelligence — Authority Console"
              style={{ flex: 1, borderRadius: 0, border: 'none', boxShadow: 'none' }}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
