// Persistent storage & initial mock data for Fisherman & Vessel Safety Module

import {
  Fisherman,
  Vessel,
  FishingSession,
  LandingCentre,
  SafetyAlert
} from '../types/fisherman';

export const OFFICIAL_LANDING_CENTRES: LandingCentre[] = [
  {
    id: 'lc_machilipatnam',
    name: 'Machilipatnam Fishing Harbour',
    state: 'Andhra Pradesh',
    lat: 16.18,
    lon: 81.18,
    geofenceRadiusKm: 5.0,
    vhfChannel: 'Ch 16 / 08',
    contactEmergency: '08672-222340'
  },
  {
    id: 'lc_vizag',
    name: 'Visakhapatnam Fishing Harbour',
    state: 'Andhra Pradesh',
    lat: 17.69,
    lon: 83.30,
    geofenceRadiusKm: 6.0,
    vhfChannel: 'Ch 16 / 12',
    contactEmergency: '0891-2565100'
  },
  {
    id: 'lc_kakinada',
    name: 'Kakinada Fisheries Jetty',
    state: 'Andhra Pradesh',
    lat: 16.95,
    lon: 82.25,
    geofenceRadiusKm: 4.5,
    vhfChannel: 'Ch 16 / 10',
    contactEmergency: '0884-2361244'
  },
  {
    id: 'lc_kasimedu',
    name: 'Kasimedu Fishing Harbour (Chennai)',
    state: 'Tamil Nadu',
    lat: 13.12,
    lon: 80.30,
    geofenceRadiusKm: 5.0,
    vhfChannel: 'Ch 16 / 14',
    contactEmergency: '044-25951234'
  },
  {
    id: 'lc_kochi',
    name: 'Thoppumpady Fisheries Harbour (Kochi)',
    state: 'Kerala',
    lat: 9.94,
    lon: 76.26,
    geofenceRadiusKm: 6.0,
    vhfChannel: 'Ch 16 / 06',
    contactEmergency: '0484-2224500'
  },
  {
    id: 'lc_mangalore',
    name: 'Old Mangalore Bunder Harbour',
    state: 'Karnataka',
    lat: 12.86,
    lon: 74.83,
    geofenceRadiusKm: 4.0,
    vhfChannel: 'Ch 16 / 11',
    contactEmergency: '0824-2423100'
  }
];

export const DEFAULT_FISHERMAN: Fisherman = {
  id: 'FISH-00421',
  fullName: 'Ravi Kumar',
  idType: 'Fisherman Biometric Card',
  idNumberMasked: 'XXXX-XXXX-4892',
  mobileNumber: '+91 98480 23114',
  emergencyContactName: 'Lakshmi Kumar (Spouse)',
  emergencyContactNumber: '+91 98480 55912',
  homeHarbour: 'Machilipatnam Fishing Harbour',
  state: 'Andhra Pradesh',
  district: 'Krishna District',
  preferredLanguage: 'telugu',
  registeredDate: '12-Jan-2025',
  totalSessions: 14
};

export const DEFAULT_VESSEL: Vessel = {
  id: 'VES-0087',
  name: 'Sea Star',
  registrationNumber: 'IND-AP-04-MM-2024',
  officialNumber: 'AP/KRI/FSH/8821',
  callSign: 'VTC-9821',
  vesselType: 'motorized',
  category: 'Motorized Fiber Reinforced Plastic (FRP)',
  portOfRegistry: 'Machilipatnam',
  baseHarbour: 'Machilipatnam Fishing Harbour',
  ownerName: 'Ravi Kumar',
  ownerContact: '+91 98480 23114',
  overallLength: 9.5,
  beam: 2.6,
  depth: 1.2,
  grossTonnage: 4.2,
  engineType: 'Yamaha Outboard 4-Stroke',
  enginePowerHP: 20,
  fuelType: 'Petrol / Kerosene',
  fuelCapacityLiters: 90,
  maxOperatingRangeKm: 45,
  maxCrewCapacity: 5,
  constructionYear: 2022,
  material: 'FRP (Fiberglass)',
  fishingMethod: 'Gillnetting & Handline',
  targetFish: 'Pelagic / Scombrids / Sardines',
  permittedArea: 'Andhra Pradesh Coastal Waters (up to 25 NM)',
  licenseRef: 'FISH-LIC-AP-2026-9921',
  safetyCertificateStatus: 'VALID',
  safetyEquipment: {
    lifeJackets: true,
    lifeRaft: false,
    firstAidKit: true,
    fireExtinguisher: true,
    radioVHF: true,
    navGps: true,
    distressBeaconEPIRB: false,
    navigationLights: true,
    aisTransponder: false
  },
  documents: [
    {
      id: 'doc_1',
      name: 'Vessel Registration Certificate (eSamudra)',
      category: 'Vessel Registration',
      uploadedDate: '15-Feb-2025',
      verificationStatus: 'VERIFIED',
      fileName: 'AP_REG_VES_0087.pdf'
    },
    {
      id: 'doc_2',
      name: 'Department of Fisheries Fishing Permit',
      category: 'Fishing License',
      uploadedDate: '20-Feb-2025',
      verificationStatus: 'VERIFIED',
      fileName: 'AP_LIC_2026_9921.pdf'
    },
    {
      id: 'doc_3',
      name: 'Annual Seaworthiness Inspection Certificate',
      category: 'Safety Certificate',
      uploadedDate: '10-Aug-2025',
      verificationStatus: 'PENDING VERIFICATION',
      fileName: 'SEAWORTHINESS_2025.pdf'
    }
  ],
  registeredDate: '15-Jan-2025'
};

export const INITIAL_ACTIVE_SESSION: FishingSession = {
  sessionId: 'SESSION-20260915-0042',
  fishermanId: 'FISH-00421',
  fishermanName: 'Ravi Kumar',
  vesselId: 'VES-0087',
  vesselName: 'Sea Star',
  departureHarbour: 'Machilipatnam Fishing Harbour',
  departureLocation: { lat: 16.18, lon: 81.18 },
  departureTime: '06:15 AM IST',
  expectedReturnTime: '04:30 PM IST',
  fishingPurpose: 'Commercial Artisanal Fishing',
  fishingActivityType: 'Pelagic Gillnetting',
  intendedFishingArea: 'Sector 6/7 (PFZ Advisory 118° ESE off Machilipatnam)',
  crewCount: 4,
  emergencyContact: '+91 98480 55912 (Lakshmi Kumar)',
  preferredLanguage: 'telugu',
  communicationPreference: 'NavIC / Radio',
  status: 'ACTIVE_AT_SEA',
  currentLocation: { lat: 16.02, lon: 81.42 },
  distanceFromDepartureKm: 31.5,
  durationSeconds: 15420, // ~4h 17m
  currentTrack: [
    { lat: 16.18, lon: 81.18, timestamp: '06:15 AM', speedKnots: 0, headingDeg: 120, isSimulated: true },
    { lat: 16.15, lon: 81.22, timestamp: '06:45 AM', speedKnots: 6.2, headingDeg: 125, isSimulated: true },
    { lat: 16.11, lon: 81.28, timestamp: '07:30 AM', speedKnots: 6.5, headingDeg: 122, isSimulated: true },
    { lat: 16.07, lon: 81.35, timestamp: '08:45 AM', speedKnots: 5.8, headingDeg: 118, isSimulated: true },
    { lat: 16.02, lon: 81.42, timestamp: '10:32 AM', speedKnots: 2.1, headingDeg: 115, isSimulated: true }
  ],
  alertsReceived: [
    {
      id: 'alt_01',
      type: 'HIGH_WAVE',
      title: 'Increasing Wave Height Advisory',
      severity: 'CAUTION',
      location: { lat: 16.05, lon: 81.40 },
      timestamp: '09:45 AM IST',
      source: 'INCOIS Ocean State Forecast',
      actualDataValue: 'Wave Height: 1.8 m (Threshold 1.5 m)',
      recommendation: 'Monitor sea state; motorized craft advised to begin return if waves exceed 2.0m.',
      isSimulated: true,
      acknowledged: true
    }
  ],
  safetyScore: 82,
  isDemoTracking: true
};

export interface CompletedSessionRecord {
  sessionId: string;
  fishermanName: string;
  vesselName: string;
  departureHarbour: string;
  departureTime: string;
  returnTime: string;
  duration: string;
  distanceKm: number;
  alertsCount: number;
  status: 'COMPLETED';
}

export const INITIAL_COMPLETED_SESSIONS: CompletedSessionRecord[] = [
  {
    sessionId: 'SESSION-20260913-0019',
    fishermanName: 'Ravi Kumar',
    vesselName: 'Sea Star',
    departureHarbour: 'Machilipatnam Fishing Harbour',
    departureTime: '13-Sep 05:40 AM',
    returnTime: '13-Sep 03:15 PM',
    duration: '9h 35m',
    distanceKm: 46.2,
    alertsCount: 0,
    status: 'COMPLETED'
  },
  {
    sessionId: 'SESSION-20260911-0081',
    fishermanName: 'Ravi Kumar',
    vesselName: 'Sea Star',
    departureHarbour: 'Machilipatnam Fishing Harbour',
    departureTime: '11-Sep 06:10 AM',
    returnTime: '11-Sep 04:50 PM',
    duration: '10h 40m',
    distanceKm: 58.0,
    alertsCount: 1,
    status: 'COMPLETED'
  },
  {
    sessionId: 'SESSION-20260908-0034',
    fishermanName: 'Ravi Kumar',
    vesselName: 'Sea Star',
    departureHarbour: 'Machilipatnam Fishing Harbour',
    departureTime: '08-Sep 06:00 AM',
    returnTime: '08-Sep 01:20 PM',
    duration: '7h 20m',
    distanceKm: 34.8,
    alertsCount: 0,
    status: 'COMPLETED'
  }
];

// Helper storage keys
const STORAGE_KEYS = {
  FISHERMEN: 'orca_fishermen_list',
  VESSELS: 'orca_vessels_list',
  ACTIVE_SESSION: 'orca_active_session',
  SESSION_HISTORY: 'orca_session_history'
};

export function getStoredFishermen(): Fisherman[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FISHERMEN);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [DEFAULT_FISHERMAN];
}

export function saveFishermen(list: Fisherman[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FISHERMEN, JSON.stringify(list));
  } catch (e) {}
}

export function getStoredVessels(): Vessel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VESSELS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [DEFAULT_VESSEL];
}

export function saveVessels(list: Vessel[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VESSELS, JSON.stringify(list));
  } catch (e) {}
}

export function getStoredActiveSession(): FishingSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return INITIAL_ACTIVE_SESSION;
}

export function saveActiveSession(session: FishingSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  } catch (e) {}
}

export function getStoredSessionHistory(): CompletedSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return INITIAL_COMPLETED_SESSIONS;
}

export function saveSessionHistory(history: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
  } catch (e) {}
}
