// INCOIS (Indian National Centre for Ocean Information Services) Adapter

export interface IncoisPfzFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'MultiLineString' | 'LineString';
    coordinates: number[][][] | number[][];
  };
  properties: {
    State_Name?: string;
    SECTORBOUN?: string;
    SECTORBO_1?: string;
    Julian_day?: string;
    Sno?: string;
    Year?: number;
    UID?: string;
    Length?: number;
    Bearing?: number;
    LandingCentre?: string;
    DistanceKM?: number;
  };
}

export interface IncoisPfzResponse {
  type: 'FeatureCollection';
  features: IncoisPfzFeature[];
  timestamp: string;
  source: 'INCOIS';
  status: 'LIVE' | 'LATEST AVAILABLE' | 'UNAVAILABLE';
  error?: string;
}

const INCOIS_WFS_BASE = 'https://incois.gov.in/geoserver/PFZ_Automation/ows';
const INCOIS_WMS_BASE = 'https://incois.gov.in/geoserver/wms';

/**
 * Fetches operational Potential Fishing Zone (PFZ) advisory vector lines directly from INCOIS GeoServer WFS
 */
export async function fetchIncoisPfzLines(): Promise<IncoisPfzResponse> {
  const url = `${INCOIS_WFS_BASE}?service=WFS&version=1.0.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application%2Fjson`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`INCOIS GeoServer responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    
    // Extract metadata from first feature if available
    const firstFeature = data.features?.[0];
    const year = firstFeature?.properties?.Year || new Date().getFullYear();
    const julianDay = firstFeature?.properties?.Julian_day || 'N/A';

    return {
      type: 'FeatureCollection',
      features: data.features || [],
      timestamp: `Year ${year}, Julian Day ${julianDay} (Operational Advisory)`,
      source: 'INCOIS',
      status: data.features?.length > 0 ? 'LIVE' : 'LATEST AVAILABLE'
    };
  } catch (err: any) {
    console.warn('INCOIS PFZ WFS Fetch Warning:', err.message);
    return {
      type: 'FeatureCollection',
      features: [],
      timestamp: 'N/A',
      source: 'INCOIS',
      status: 'UNAVAILABLE',
      error: `INCOIS GeoServer temporarily unreachable from browser: ${err.message}`
    };
  }
}

/**
 * Official WMS Layer Definitions on INCOIS GeoServer
 */
export const INCOIS_WMS_LAYERS = {
  sst: {
    url: INCOIS_WMS_BASE,
    sublayers: [{ name: 'PFZ-TUNA-SST-CHL:sst', title: 'INCOIS Sea Surface Temperature' }]
  },
  chlorophyll: {
    url: INCOIS_WMS_BASE,
    sublayers: [{ name: 'PFZ-TUNA-SST-CHL:chl', title: 'INCOIS Chlorophyll-a' }]
  },
  bathymetry: {
    url: INCOIS_WMS_BASE,
    sublayers: [{ name: 'PFZ_Bathymetry:bathymetry', title: 'INCOIS Bathymetry Depth Contours' }]
  },
  heatwaveDomain: {
    url: INCOIS_WMS_BASE,
    sublayers: [{ name: 'MHW:MHWDomainBasin', title: 'INCOIS Marine Heatwave Basin Domain' }]
  },
  eez: {
    url: INCOIS_WMS_BASE,
    sublayers: [{ name: 'PFZ_EEZ:indiaeez', title: 'Indian Exclusive Economic Zone' }]
  }
};
