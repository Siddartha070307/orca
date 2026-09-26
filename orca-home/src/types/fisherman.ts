// Fisherman & Vessel Safety Module Data Models

export interface Fisherman {
  id: string;
  fullName: string;
  idType: 'Aadhaar' | 'Fisherman Biometric Card' | 'Voter ID' | 'Kisan Credit Card';
  idNumberMasked: string; // e.g. "XXXX-XXXX-1234"
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  homeHarbour: string;
  state: string;
  district: string;
  preferredLanguage: string;
  registeredDate: string;
  totalSessions: number;
}

export interface VesselSafetyEquipment {
  lifeJackets: boolean;
  lifeRaft: boolean;
  firstAidKit: boolean;
  fireExtinguisher: boolean;
  radioVHF: boolean;
  navGps: boolean;
  distressBeaconEPIRB: boolean;
  navigationLights: boolean;
  aisTransponder: boolean;
}

export interface VesselDocument {
  id: string;
  name: string;
  category: 'Vessel Registration' | 'Fishing License' | 'Safety Certificate' | 'Insurance' | 'ID Proof';
  uploadedDate: string;
  verificationStatus: 'VERIFIED' | 'PENDING VERIFICATION' | 'NOT PROVIDED' | 'DEMO / UNVERIFIED';
  fileName: string;
}

export interface Vessel {
  id: string;
  name: string;
  registrationNumber: string; // e.g. "IND-AP-04-MM-2024"
  officialNumber?: string;
  callSign?: string;
  vesselType: 'traditional' | 'motorized' | 'mechanized';
  category: string; // e.g. "Trawler", "Gillnetter", "Fiberglass Boat"
  portOfRegistry: string;
  baseHarbour: string;
  ownerName: string;
  ownerContact: string;
  overallLength: number; // in meters (LOA)
  beam: number; // in meters
  depth: number; // in meters
  grossTonnage: number; // in GT
  engineType: string; // e.g. "Inboard Marine Diesel" / "Outboard 9.9 HP"
  enginePowerHP: number;
  fuelType: 'Diesel' | 'Petrol / Kerosene' | 'Electric';
  fuelCapacityLiters: number;
  maxOperatingRangeKm: number;
  maxCrewCapacity: number;
  constructionYear: number;
  material: 'FRP (Fiberglass)' | 'Wood' | 'Steel' | 'Composite';
  fishingMethod: string;
  targetFish: string;
  permittedArea: string;
  licenseRef: string;
  safetyCertificateStatus: 'VALID' | 'PENDING RENEWAL' | 'NOT CERTIFIED';
  safetyEquipment: VesselSafetyEquipment;
  documents: VesselDocument[];
  registeredDate: string;
}

export interface TrackingPoint {
  lat: number;
  lon: number;
  timestamp: string;
  speedKnots: number;
  headingDeg: number;
  isSimulated: boolean;
}

export type SessionStatus =
  | 'READY_TO_DEPART'
  | 'ACTIVE_AT_SEA'
  | 'SESSION_COMPLETED'
  | 'SAFETY_ALERT';

export type AlertSeverity = 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export interface SafetyAlert {
  id: string;
  type:
    | 'HIGH_WAVE'
    | 'STRONG_WIND'
    | 'SWELL_SURGE'
    | 'CYCLONE_RISK'
    | 'RESTRICTED_ZONE'
    | 'COMM_LOSS'
    | 'EXTENDED_SESSION'
    | 'RETURN_REMINDER'
    | 'SOS_EMERGENCY';
  title: string;
  severity: AlertSeverity;
  location: { lat: number; lon: number };
  timestamp: string;
  source: string;
  actualDataValue: string;
  recommendation: string;
  isSimulated: boolean;
  acknowledged: boolean;
}

export interface FishingSession {
  sessionId: string; // e.g. "SESSION-20260915-0042"
  fishermanId: string;
  fishermanName: string;
  vesselId: string;
  vesselName: string;
  departureHarbour: string;
  departureLocation: { lat: number; lon: number };
  departureTime: string;
  expectedReturnTime: string;
  actualReturnTime?: string;
  fishingPurpose: string;
  fishingActivityType: string;
  intendedFishingArea: string;
  crewCount: number;
  emergencyContact: string;
  preferredLanguage: string;
  communicationPreference: 'SMS' | 'NavIC / Radio' | 'WhatsApp' | 'Push Notification';
  status: SessionStatus;
  currentLocation: { lat: number; lon: number };
  distanceFromDepartureKm: number;
  durationSeconds: number;
  currentTrack: TrackingPoint[];
  alertsReceived: SafetyAlert[];
  safetyScore: number; // 0-100
  isDemoTracking: boolean;
}

export interface LandingCentre {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  geofenceRadiusKm: number;
  vhfChannel: string;
  contactEmergency: string;
}
