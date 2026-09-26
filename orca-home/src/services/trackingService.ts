// Vessel Tracking Provider Abstraction (Real GPS vs Demo Simulation)

import { TrackingPoint, LandingCentre } from '../types/fisherman';
import { calculateGeodetic } from './geodeticCalc';

export type TrackingMode = 'LIVE GPS' | 'AUTHORIZED VMS/AIS' | 'DEMO SIMULATION' | 'LOCATION UNAVAILABLE';

export interface TrackingProvider {
  getStatus(): TrackingMode;
  getCurrentLocation(): Promise<TrackingPoint | null>;
  isRealProvider(): boolean;
}

/**
 * Real device / browser GPS Tracking Provider
 */
export class RealTrackingProvider implements TrackingProvider {
  getStatus(): TrackingMode {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      return 'LIVE GPS';
    }
    return 'LOCATION UNAVAILABLE';
  }

  isRealProvider(): boolean {
    return true;
  }

  async getCurrentLocation(): Promise<TrackingPoint | null> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return null;
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            lat: parseFloat(pos.coords.latitude.toFixed(4)),
            lon: parseFloat(pos.coords.longitude.toFixed(4)),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            speedKnots: pos.coords.speed ? parseFloat((pos.coords.speed * 1.94384).toFixed(1)) : 0,
            headingDeg: pos.coords.heading ? Math.round(pos.coords.heading) : 0,
            isSimulated: false
          });
        },
        _err => {
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }
}

// Pre-defined demo waypoints along Andhra offshore fishing grounds
const DEMO_WAYPOINTS = [
  { lat: 16.18, lon: 81.18, name: 'Machilipatnam Harbour (Departure)' },
  { lat: 16.14, lon: 81.24, name: 'Krishna Estuary Outer Channel' },
  { lat: 16.08, lon: 81.33, name: 'Offshore Shelf Approach' },
  { lat: 16.02, lon: 81.42, name: 'PFZ Sector 6/7 Thermal Front (Active Fishing)' },
  { lat: 15.96, lon: 81.50, name: 'Deep Pelagic Drop-off (28m depth)' },
  { lat: 16.04, lon: 81.38, name: 'Return Trajectory Midpoint' },
  { lat: 16.16, lon: 81.20, name: 'Approach to Machilipatnam Landing Geofence' }
];

/**
 * Demo Simulation Tracking Provider for SIH 2026 Presentation
 */
export class DemoTrackingProvider implements TrackingProvider {
  private waypointIndex = 3; // default at PFZ active fishing ground

  getStatus(): TrackingMode {
    return 'DEMO SIMULATION';
  }

  isRealProvider(): boolean {
    return false;
  }

  setWaypointStep(index: number) {
    this.waypointIndex = Math.max(0, Math.min(DEMO_WAYPOINTS.length - 1, index));
  }

  async getCurrentLocation(): Promise<TrackingPoint> {
    const wp = DEMO_WAYPOINTS[this.waypointIndex];
    return {
      lat: wp.lat,
      lon: wp.lon,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      speedKnots: this.waypointIndex === 0 ? 0 : 5.8,
      headingDeg: this.waypointIndex < 4 ? 118 : 300,
      isSimulated: true
    };
  }

  advanceSimulation(): TrackingPoint {
    this.waypointIndex = (this.waypointIndex + 1) % DEMO_WAYPOINTS.length;
    const wp = DEMO_WAYPOINTS[this.waypointIndex];
    return {
      lat: wp.lat,
      lon: wp.lon,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      speedKnots: this.waypointIndex === 0 ? 0 : 6.2,
      headingDeg: this.waypointIndex < 4 ? 118 : 300,
      isSimulated: true
    };
  }
}

/**
 * Return Detection Service
 * Checks if vessel coordinate is within a registered landing centre geofence
 */
export function checkReturnToLandGeofence(
  currentLat: number,
  currentLon: number,
  landingCentres: LandingCentre[]
): { isNearLanding: boolean; centre: LandingCentre | null; distanceKm: number } {
  let nearest: LandingCentre | null = null;
  let minDistance = 999999;

  landingCentres.forEach(centre => {
    const res = calculateGeodetic(currentLat, currentLon, centre.lat, centre.lon);
    if (res.distanceKm < minDistance) {
      minDistance = res.distanceKm;
      nearest = centre;
    }
  });

  if (nearest && minDistance <= (nearest as LandingCentre).geofenceRadiusKm) {
    return { isNearLanding: true, centre: nearest, distanceKm: minDistance };
  }

  return { isNearLanding: false, centre: nearest, distanceKm: minDistance };
}
