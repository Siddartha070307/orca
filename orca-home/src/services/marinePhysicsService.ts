// Marine Physics Data Adapter (Secondary provider for ECMWF & Copernicus Marine Models via Open-Meteo)

import {
  fetchOpenMeteoPhysicsGrid,
  MarinePhysicsPoint,
  INDIAN_OCEAN_STATIONS
} from '../data/providers/openmeteo/openmeteoAdapter';

export interface MarinePointData {
  latitude: number;
  longitude: number;
  time: string;
  seaSurfaceTemperature: number | null;
  waveHeight: number | null;
  waveDirection: number | null;
  wavePeriod: number | null;
  swellHeight: number | null;
  swellDirection: number | null;
  swellPeriod: number | null;
  currentVelocity: number | null; // in m/s
  currentDirection: number | null; // in degrees
  currentU: number | null; // Eastward velocity component (m/s)
  currentV: number | null; // Northward velocity component (m/s)
  windSpeed: number | null; // in m/s
  windDirection: number | null; // in degrees
  source: string;
  status: 'LATEST AVAILABLE' | 'FORECAST' | 'UNAVAILABLE';
}

export type MarineSpatialPoint = MarinePhysicsPoint;

export interface CurrentVectorPoint {
  lat: number;
  lon: number;
  velocity: number; // m/s
  direction: number; // degrees
  u: number; // eastward m/s
  v: number; // northward m/s
}

/**
 * Queries real-time marine physical telemetry at a specific clicked ocean location
 */
export async function fetchPointMarineProfile(
  lat: number,
  lon: number
): Promise<MarinePointData> {
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=UTC`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC`;

  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(marineUrl).then(r => (r.ok ? r.json() : null)),
      fetch(weatherUrl).then(r => (r.ok ? r.json() : null))
    ]);

    const mCurrent = marineRes?.current;
    const wCurrent = weatherRes?.current;

    let velMs: number | null = null;
    let u: number | null = null;
    let v: number | null = null;

    if (mCurrent?.ocean_current_velocity !== undefined && mCurrent?.ocean_current_velocity !== null) {
      velMs = parseFloat((mCurrent.ocean_current_velocity / 3.6).toFixed(2));
      if (mCurrent?.ocean_current_direction !== undefined && mCurrent?.ocean_current_direction !== null) {
        const rad = (mCurrent.ocean_current_direction * Math.PI) / 180;
        u = parseFloat((velMs * Math.sin(rad)).toFixed(3));
        v = parseFloat((velMs * Math.cos(rad)).toFixed(3));
      }
    }

    const timestamp = mCurrent?.time || wCurrent?.time || new Date().toISOString();

    return {
      latitude: lat,
      longitude: lon,
      time: timestamp,
      seaSurfaceTemperature: mCurrent?.sea_surface_temperature !== undefined ? mCurrent.sea_surface_temperature : null,
      waveHeight: mCurrent?.wave_height !== undefined ? mCurrent.wave_height : null,
      waveDirection: mCurrent?.wave_direction !== undefined ? mCurrent.wave_direction : null,
      wavePeriod: mCurrent?.wave_period !== undefined ? mCurrent.wave_period : null,
      swellHeight: mCurrent?.swell_wave_height !== undefined ? mCurrent.swell_wave_height : null,
      swellDirection: mCurrent?.swell_wave_direction !== undefined ? mCurrent.swell_wave_direction : null,
      swellPeriod: mCurrent?.swell_wave_period !== undefined ? mCurrent.swell_wave_period : null,
      currentVelocity: velMs,
      currentDirection: mCurrent?.ocean_current_direction !== undefined ? mCurrent.ocean_current_direction : null,
      currentU: u,
      currentV: v,
      windSpeed: wCurrent?.wind_speed_10m !== undefined ? wCurrent.wind_speed_10m : null,
      windDirection: wCurrent?.wind_direction_10m !== undefined ? wCurrent.wind_direction_10m : null,
      source: 'Open-Meteo Marine (Secondary / Copernicus & ECMWF Models)',
      status: mCurrent ? 'LATEST AVAILABLE' : 'UNAVAILABLE'
    };
  } catch (err: any) {
    console.warn('Point Marine Profile Query Error:', err.message);
    return {
      latitude: lat,
      longitude: lon,
      time: 'N/A',
      seaSurfaceTemperature: null,
      waveHeight: null,
      waveDirection: null,
      wavePeriod: null,
      swellHeight: null,
      swellDirection: null,
      swellPeriod: null,
      currentVelocity: null,
      currentDirection: null,
      currentU: null,
      currentV: null,
      windSpeed: null,
      windDirection: null,
      source: 'Open-Meteo Marine (Secondary / ECMWF)',
      status: 'UNAVAILABLE'
    };
  }
}

/**
 * Fetches real spatial marine data points across the Indian Ocean basin
 */
export async function fetchMarineSpatialGrid(): Promise<MarineSpatialPoint[]> {
  return await fetchOpenMeteoPhysicsGrid();
}

/**
 * Backward compatibility helper for current particle engine
 */
export async function fetchCurrentVectorGrid(): Promise<CurrentVectorPoint[]> {
  const grid = await fetchMarineSpatialGrid();
  return grid.map(g => ({
    lat: g.lat,
    lon: g.lon,
    velocity: g.currentVelocity,
    direction: g.currentDirection,
    u: g.u,
    v: g.v
  }));
}
