// Geocoding and Coastal Context Service

export interface GeocodingResult {
  name: string;
  adminRegion: string;
  country: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  isCoastal: boolean;
  oceanRegionName?: string;
  adjacentOceanCoord?: { lat: number; lon: number };
}

// Curated fast-lookup directory for Indian ports, coastal cities, and marine basins
const INDIAN_COASTAL_INDEX: Record<string, GeocodingResult> = {
  'machilipatnam': {
    name: 'Machilipatnam',
    adminRegion: 'Krishna District, Andhra Pradesh',
    country: 'India',
    latitude: 16.1809,
    longitude: 81.1378,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Bay of Bengal',
    adjacentOceanCoord: { lat: 15.95, lon: 81.45 }
  },
  'visakhapatnam': {
    name: 'Visakhapatnam',
    adminRegion: 'Andhra Pradesh',
    country: 'India',
    latitude: 17.6868,
    longitude: 83.2185,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Bay of Bengal',
    adjacentOceanCoord: { lat: 17.60, lon: 83.50 }
  },
  'kakinada': {
    name: 'Kakinada',
    adminRegion: 'East Godavari, Andhra Pradesh',
    country: 'India',
    latitude: 16.9891,
    longitude: 82.2475,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Bay of Bengal (Godavari Estuary)',
    adjacentOceanCoord: { lat: 16.90, lon: 82.55 }
  },
  'chennai': {
    name: 'Chennai',
    adminRegion: 'Tamil Nadu',
    country: 'India',
    latitude: 13.0827,
    longitude: 80.2707,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Coromandel Coast, Bay of Bengal',
    adjacentOceanCoord: { lat: 13.05, lon: 80.50 }
  },
  'mumbai': {
    name: 'Mumbai',
    adminRegion: 'Maharashtra',
    country: 'India',
    latitude: 18.9220,
    longitude: 72.8347,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Arabian Sea',
    adjacentOceanCoord: { lat: 18.85, lon: 72.60 }
  },
  'kochi': {
    name: 'Kochi',
    adminRegion: 'Ernakulam, Kerala',
    country: 'India',
    latitude: 9.9312,
    longitude: 76.2673,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Malabar Coast, Arabian Sea',
    adjacentOceanCoord: { lat: 9.90, lon: 75.95 }
  },
  'mangalore': {
    name: 'Mangalore',
    adminRegion: 'Dakshina Kannada, Karnataka',
    country: 'India',
    latitude: 12.9141,
    longitude: 74.8560,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Arabian Sea',
    adjacentOceanCoord: { lat: 12.90, lon: 74.60 }
  },
  'paradip': {
    name: 'Paradip',
    adminRegion: 'Jagatsinghpur, Odisha',
    country: 'India',
    latitude: 20.3164,
    longitude: 86.6114,
    zoomLevel: 10,
    isCoastal: true,
    oceanRegionName: 'Bay of Bengal (Mahanadi Delta)',
    adjacentOceanCoord: { lat: 20.20, lon: 86.85 }
  },
  'bay of bengal': {
    name: 'Bay of Bengal',
    adminRegion: 'Northern Indian Ocean Basin',
    country: 'International Waters',
    latitude: 14.5000,
    longitude: 87.0000,
    zoomLevel: 6,
    isCoastal: false,
    oceanRegionName: 'Bay of Bengal (Central Basin)',
    adjacentOceanCoord: { lat: 14.50, lon: 87.00 }
  },
  'arabian sea': {
    name: 'Arabian Sea',
    adminRegion: 'North-Western Indian Ocean Basin',
    country: 'International Waters',
    latitude: 15.5000,
    longitude: 68.5000,
    zoomLevel: 6,
    isCoastal: false,
    oceanRegionName: 'Arabian Sea (Central Basin)',
    adjacentOceanCoord: { lat: 15.50, lon: 68.50 }
  },
  'indian ocean': {
    name: 'Indian Ocean',
    adminRegion: 'Equatorial & Subtropical Ocean Basin',
    country: 'International Waters',
    latitude: 8.0000,
    longitude: 78.5000,
    zoomLevel: 5,
    isCoastal: false,
    oceanRegionName: 'Indian Ocean (Equatorial)',
    adjacentOceanCoord: { lat: 8.00, lon: 78.50 }
  }
};

/**
 * Searches for a coastal city, port, or ocean region using exact index + ArcGIS World Geocoder fallback
 */
export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // 1. Check curated index first for instant, high-precision coastal resolution
  const indexMatches: GeocodingResult[] = [];
  for (const [key, value] of Object.entries(INDIAN_COASTAL_INDEX)) {
    if (key.includes(q) || q.includes(key)) {
      indexMatches.push(value);
    }
  }

  if (indexMatches.length > 0) {
    return indexMatches;
  }

  // 2. Query ArcGIS World Geocoding Service
  try {
    const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
      query
    )}&f=json&outFields=PlaceName,Region,CountryCode,Type&maxLocations=5`;

    const res = await fetch(arcgisUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        return data.candidates.map((c: any) => {
          const lat = c.location.y;
          const lon = c.location.x;
          // Heuristic for coastal proximity based on distance to Indian coastline
          const isNearIndiaCoast =
            (lon > 68 && lon < 74 && lat > 8 && lat < 24) ||
            (lon > 79 && lon < 88 && lat > 8 && lat < 22);

          return {
            name: c.attributes.PlaceName || c.address.split(',')[0],
            adminRegion: c.attributes.Region || 'Region',
            country: c.attributes.CountryCode || 'Global',
            latitude: lat,
            longitude: lon,
            zoomLevel: c.attributes.Type === 'Country' ? 5 : 9,
            isCoastal: isNearIndiaCoast,
            oceanRegionName: lon > 78 ? 'Bay of Bengal' : 'Arabian Sea',
            adjacentOceanCoord: isNearIndiaCoast
              ? { lat: lat, lon: lon > 78 ? lon + 0.3 : lon - 0.3 }
              : undefined
          };
        });
      }
    }
  } catch (err) {
    console.warn('ArcGIS Geocoder query error:', err);
  }

  return [];
}
