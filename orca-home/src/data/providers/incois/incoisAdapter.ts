// Official INCOIS Data Provider Adapter

export interface IncoisLayerMeta {
  id: string;
  name: string;
  wmsLayer: string;
  wfsTypeName?: string;
  crs: string[];
  bbox: [number, number, number, number];
  units: string;
  status: 'LIVE' | 'LATEST AVAILABLE' | 'UNAVAILABLE';
  cadence: string;
}

export const INCOIS_SERVICES = {
  wmsBase: 'https://incois.gov.in/geoserver/wms',
  wfsPfzBase: 'https://incois.gov.in/geoserver/PFZ_Automation/ows',
  osfPortal: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
  pfzPortal: 'https://incois.gov.in/geoportal/MFASPFZ/index.html',
  chloroGin: 'https://incois.gov.in/site/services/ChloroGIN.jsp'
};

export const INCOIS_OFFICIAL_LAYERS: Record<string, IncoisLayerMeta> = {
  sst: {
    id: 'sst',
    name: 'Sea Surface Temperature',
    wmsLayer: 'PFZ-TUNA-SST-CHL:sst',
    crs: ['EPSG:4326', 'CRS:84', 'EPSG:3857'],
    bbox: [43.71, -12.93, 118.42, 46.86],
    units: '°C',
    status: 'LATEST AVAILABLE',
    cadence: 'Daily NRT Composite'
  },
  chlorophyll: {
    id: 'chlorophyll',
    name: 'Chlorophyll-a',
    wmsLayer: 'PFZ-TUNA-SST-CHL:chl',
    crs: ['EPSG:4326', 'CRS:84', 'EPSG:3857'],
    bbox: [35.0, -5.0, 103.0, 30.0],
    units: 'mg/m³',
    status: 'LATEST AVAILABLE',
    cadence: 'Daily Ocean Colour'
  },
  bathymetry: {
    id: 'bathymetry',
    name: 'Bathymetry Depth Contours',
    wmsLayer: 'PFZ_Bathymetry:bathymetry',
    crs: ['EPSG:4326', 'CRS:84', 'EPSG:3857'],
    bbox: [40.0, -15.0, 120.0, 45.0],
    units: 'm below sea level',
    status: 'LATEST AVAILABLE',
    cadence: 'Climatological Baseline'
  },
  heatwave: {
    id: 'heatwave',
    name: 'Marine Heatwave Basin Domain',
    wmsLayer: 'MHW:MHWDomainBasin',
    crs: ['EPSG:4326', 'CRS:84', 'EPSG:3857'],
    bbox: [30.0, -30.0, 120.0, 35.0],
    units: '°C Anomaly',
    status: 'LATEST AVAILABLE',
    cadence: 'Daily 30-Day Persistence'
  },
  pfz: {
    id: 'pfz',
    name: 'Potential Fishing Zone Advisories',
    wmsLayer: 'PFZ_Automation:pfzlines',
    wfsTypeName: 'PFZ_Automation:pfzlines',
    crs: ['EPSG:4326', 'CRS:84'],
    bbox: [65.0, 5.0, 95.0, 25.0],
    units: 'Advisory Polylines & Bearing',
    status: 'LIVE',
    cadence: 'Daily at 14:00 IST'
  }
};

/**
 * Fetch operational PFZ lines directly from INCOIS GeoServer WFS
 */
export async function fetchIncoisPfzFeatures() {
  const url = `${INCOIS_SERVICES.wfsPfzBase}?service=WFS&version=1.0.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application%2Fjson`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`INCOIS GeoServer HTTP ${res.status}`);
    const data = await res.json();
    const first = data.features?.[0];
    const year = first?.properties?.Year || new Date().getFullYear();
    const julianDay = first?.properties?.Julian_day || 'N/A';
    return {
      features: data.features || [],
      count: data.features?.length || 0,
      timestamp: `Year ${year}, Julian Day ${julianDay} (Operational Advisory)`,
      status: (data.features?.length > 0 ? 'LIVE' : 'LATEST AVAILABLE') as 'LIVE' | 'LATEST AVAILABLE'
    };
  } catch (err: any) {
    console.warn('INCOIS PFZ fetch error:', err.message);
    return {
      features: [],
      count: 0,
      timestamp: 'N/A',
      status: 'UNAVAILABLE' as const,
      error: err.message
    };
  }
}
