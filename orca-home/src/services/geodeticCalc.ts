import { GeodeticMeasurement } from '../types';

/**
 * Calculates Great-Circle geodetic distance and initial bearing between two geographic coordinates
 * Uses authoritative WGS-84 spherical approximation (Haversine & Forward Azimuth equations)
 */
export function calculateGeodetic(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): GeodeticMeasurement {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  // Haversine formula for distance
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const distanceNmi = distanceKm * 0.539957; // 1 km = 0.539957 nautical miles

  // Forward azimuth / bearing formula
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearingDeg = (toDeg(θ) + 360) % 360;

  return {
    point1: { lat: lat1, lon: lon1 },
    point2: { lat: lat2, lon: lon2 },
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    distanceNmi: parseFloat(distanceNmi.toFixed(2)),
    bearingDeg: parseFloat(bearingDeg.toFixed(1))
  };
}
