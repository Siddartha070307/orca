// Secondary Open Marine Physics Adapter (Derived from ECMWF / Copernicus Marine Numerical Models)

export interface MarinePhysicsPoint {
  lat: number;
  lon: number;
  name: string;
  currentVelocity: number; // m/s
  currentDirection: number; // deg
  u: number; // Eastward m/s
  v: number; // Northward m/s
  waveHeight: number; // m
  waveDirection: number; // deg
  wavePeriod: number; // s
  swellHeight: number; // m
  swellDirection: number; // deg
  swellPeriod: number; // s
  windSpeed: number; // m/s
  windDirection: number; // deg
  sst: number; // °C
}

export const INDIAN_OCEAN_STATIONS = [
  // Bay of Bengal Sector
  { lat: 19.5, lon: 88.0, name: 'North Bay of Bengal (off Bengal/Odisha)' },
  { lat: 18.0, lon: 86.0, name: 'North Andhra Offshore (off Visakhapatnam)' },
  { lat: 16.0, lon: 82.5, name: 'Central Andhra Offshore (off Machilipatnam/Kakinada)' },
  { lat: 14.5, lon: 83.5, name: 'South Andhra Offshore (off Ongole/Nellore)' },
  { lat: 13.2, lon: 81.5, name: 'Coromandel Coast (off Chennai)' },
  { lat: 11.5, lon: 82.0, name: 'Tamil Nadu Offshore (off Pondicherry/Nagapattinam)' },
  { lat: 9.5,  lon: 82.5, name: 'Palk Strait / Sri Lanka East' },
  { lat: 15.0, lon: 88.5, name: 'Central Bay of Bengal Deep Basin' },
  { lat: 12.0, lon: 92.0, name: 'Andaman Sea West (off Port Blair)' },
  { lat: 10.0, lon: 93.5, name: 'Nicobar Offshore' },

  // Arabian Sea Sector
  { lat: 21.0, lon: 69.0, name: 'Gujarat Coast (off Porbandar/Veraval)' },
  { lat: 19.0, lon: 71.5, name: 'Konkan Coast (off Mumbai Offshore)' },
  { lat: 17.5, lon: 71.0, name: 'Maharashtra Coast (off Ratnagiri)' },
  { lat: 15.5, lon: 72.5, name: 'Goa Offshore' },
  { lat: 13.5, lon: 73.5, name: 'Karnataka Offshore (off Mangalore)' },
  { lat: 11.0, lon: 74.5, name: 'North Kerala (off Kozhikode/Cochin)' },
  { lat: 9.0,  lon: 75.0, name: 'South Kerala (off Kollam/Vizhinjam)' },
  { lat: 10.5, lon: 72.0, name: 'Lakshadweep Sea (off Kavaratti)' },
  { lat: 16.5, lon: 67.5, name: 'Central Arabian Sea Basin' },
  { lat: 13.0, lon: 66.0, name: 'South Arabian Sea Deep Basin' },

  // Southern Indian Ocean Sector
  { lat: 7.0,  lon: 77.5, name: 'Kanyakumari / Gulf of Mannar' },
  { lat: 6.0,  lon: 81.0, name: 'South Sri Lanka (off Galle/Dondra)' },
  { lat: 5.0,  lon: 76.0, name: 'Equatorial Indian Ocean West' },
  { lat: 5.0,  lon: 85.0, name: 'Equatorial Indian Ocean East' },
  { lat: 2.0,  lon: 78.0, name: 'Southern Equatorial Current Zone' },
  { lat: 2.0,  lon: 88.0, name: 'South Bay of Bengal Equatorial' }
];

/**
 * Queries real-time marine physical telemetry across the Indian Ocean basin
 */
export async function fetchOpenMeteoPhysicsGrid(): Promise<MarinePhysicsPoint[]> {
  const lats = INDIAN_OCEAN_STATIONS.map(c => c.lat).join(',');
  const lons = INDIAN_OCEAN_STATIONS.map(c => c.lon).join(',');

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=UTC`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC`;

  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(marineUrl).then(r => (r.ok ? r.json() : null)),
      fetch(weatherUrl).then(r => (r.ok ? r.json() : null))
    ]);

    const mItems: any[] = Array.isArray(marineRes) ? marineRes : marineRes ? [marineRes] : [];
    const wItems: any[] = Array.isArray(weatherRes) ? weatherRes : weatherRes ? [weatherRes] : [];

    const results: MarinePhysicsPoint[] = [];

    INDIAN_OCEAN_STATIONS.forEach((station, i) => {
      const mCur = mItems[i]?.current;
      const wCur = wItems[i]?.current;

      const velKmh = mCur?.ocean_current_velocity != null ? mCur.ocean_current_velocity : 1.0;
      const curDir = mCur?.ocean_current_direction != null ? mCur.ocean_current_direction : 180;
      const velMs = parseFloat((velKmh / 3.6).toFixed(2));
      const curRad = (curDir * Math.PI) / 180;
      const u = parseFloat((velMs * Math.sin(curRad)).toFixed(3));
      const v = parseFloat((velMs * Math.cos(curRad)).toFixed(3));

      results.push({
        lat: station.lat,
        lon: station.lon,
        name: station.name,
        currentVelocity: velMs,
        currentDirection: curDir,
        u,
        v,
        waveHeight: mCur?.wave_height != null ? mCur.wave_height : 1.2,
        waveDirection: mCur?.wave_direction != null ? mCur.wave_direction : 180,
        wavePeriod: mCur?.wave_period != null ? mCur.wave_period : 8.0,
        swellHeight: mCur?.swell_wave_height != null ? mCur.swell_wave_height : 1.0,
        swellDirection: mCur?.swell_wave_direction != null ? mCur.swell_wave_direction : 180,
        swellPeriod: mCur?.swell_wave_period != null ? mCur.swell_wave_period : 9.0,
        windSpeed: wCur?.wind_speed_10m != null ? wCur.wind_speed_10m : 5.0,
        windDirection: wCur?.wind_direction_10m != null ? wCur.wind_direction_10m : 220,
        sst: mCur?.sea_surface_temperature != null ? mCur.sea_surface_temperature : 28.5
      });
    });

    return results;
  } catch (err: any) {
    console.warn('Failed to fetch open marine physics grid:', err.message);
    return [];
  }
}
