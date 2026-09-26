import { OceanLayerDefinition } from '../types';

export const OCEAN_LAYERS: OceanLayerDefinition[] = [
  // 1. Sea Surface Temperature
  {
    id: 'sst',
    name: 'Sea Surface Temperature',
    shortDescription: 'Surface ocean thermal skin temperature indicating thermal fronts and upwelling zones.',
    category: 'environment',
    source: 'INCOIS',
    datasetName: 'PFZ-TUNA-SST-CHL:sst (Near-Real-Time Satellite Composite)',
    serviceType: 'wms',
    endpointUrl: 'https://incois.gov.in/geoserver/wms',
    officialReferenceUrl: 'https://incois.gov.in/site/services/ChloroGIN.jsp',
    units: '°C',
    spatialResolution: '0.05° (~5 km)',
    temporalResolution: 'Daily Composite',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Daily at 06:00 UTC',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Derived from Oceansat/MODIS-Aqua infrared and microwave radiometers. Rendered directly via INCOIS GeoServer WMS.',
    legend: {
      title: 'SEA SURFACE TEMPERATURE',
      units: '°C',
      gradient: 'linear-gradient(to right, #001f3f, #0074D9, #7FDBFF, #2ECC40, #FFDC00, #FF851B, #FF4136)',
      minLabel: '24°C',
      midLabel: '28°C',
      maxLabel: '32°C'
    }
  },

  // 2. Chlorophyll-a
  {
    id: 'chlorophyll',
    name: 'Chlorophyll-a Concentration',
    shortDescription: 'Phytoplankton concentration indicating biological productivity and marine food chain density.',
    category: 'ecosystem',
    source: 'INCOIS',
    datasetName: 'PFZ-TUNA-SST-CHL:chl (Ocean Colour Radiance)',
    serviceType: 'wms',
    endpointUrl: 'https://incois.gov.in/geoserver/wms',
    officialReferenceUrl: 'https://incois.gov.in/site/services/ChloroGIN.jsp',
    units: 'mg/m³',
    spatialResolution: '1 km (Oceansat-3 / MODIS)',
    temporalResolution: 'Daily NRT',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Daily at 08:00 UTC',
    defaultOpacity: 0.70,
    isBrowserAccessible: true,
    notes: 'Bio-optical chlorophyll pigment inversion algorithm. Vital indicator for pelagic fish habitat selection.',
    legend: {
      title: 'CHLOROPHYLL-a CONCENTRATION',
      units: 'mg/m³',
      gradient: 'linear-gradient(to right, #001219, #005f73, #0a9396, #94d2bd, #e9d8a6, #ee9b00, #ca6702)',
      minLabel: '0.05 mg/m³',
      midLabel: '1.0 mg/m³',
      maxLabel: '5.0 mg/m³'
    }
  },

  // 3. Potential Fishing Zone
  {
    id: 'pfz',
    name: 'Potential Fishing Zone (PFZ)',
    shortDescription: 'Operational multi-parameter advisories identifying fish aggregation along thermal-chlorophyll fronts.',
    category: 'ecosystem',
    source: 'INCOIS',
    datasetName: 'PFZ_Automation:pfzlines (Operational Fishery Advisory)',
    serviceType: 'wfs',
    endpointUrl: 'https://incois.gov.in/geoserver/PFZ_Automation/ows',
    officialReferenceUrl: 'https://incois.gov.in/geoportal/MFASPFZ/index.html',
    units: 'Advisory Lines & Bearings',
    spatialResolution: 'Vector Polylines (Lat/Lon coordinates)',
    temporalResolution: 'Daily Operational Advisory',
    status: 'LIVE',
    updateCadence: 'Daily at 14:00 IST',
    defaultOpacity: 0.95,
    isBrowserAccessible: true,
    notes: '87 active operational lines for Indian EEZ sectors (Goa, AP, Tamil Nadu, Kerala, Odisha). Sourced live via INCOIS WFS.',
    legend: {
      title: 'POTENTIAL FISHING ZONE',
      units: 'Advisory Features',
      discreteItems: [
        { label: 'PFZ Advisory Line', color: '#00F0FF', value: 'Active Operational Line' },
        { label: 'Landing Centre / Harbour', color: '#F5B942', value: 'Base Port' },
        { label: 'EEZ Maritime Limit', color: '#8B6CFF', value: '200 NM Boundary' }
      ]
    }
  },

  // 4. Surface Currents
  {
    id: 'currents',
    name: 'Surface Ocean Currents',
    shortDescription: 'Near-surface hydrodynamic circulation vectors driven by tides, monsoons, and geostrophic flow.',
    category: 'environment',
    source: 'Copernicus Marine / INCOIS OSF (Secondary adapter: Open-Meteo)',
    datasetName: 'GLOBAL_ANALYSISFORECAST_PHY_001_024 (U/V Vector Streamlines)',
    serviceType: 'vector-particle',
    endpointUrl: 'https://marine-api.open-meteo.com/v1/marine',
    officialReferenceUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description',
    units: 'm/s',
    spatialResolution: '0.083° (~8 km)',
    temporalResolution: 'Hourly Hydrodynamic Model',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Daily Forecast Cycles',
    defaultOpacity: 0.85,
    isBrowserAccessible: true,
    notes: 'SAMUDRA-style continuous current speed field with animated white particle streamlines following U/V components.',
    legend: {
      title: 'SURFACE CURRENTS SPEED',
      units: 'm/s',
      gradient: 'linear-gradient(to right, #051937, #00875a, #a09800, #801545, #4c1d95, #0077ff, #cbf3f0)',
      minLabel: '0.0 m/s',
      midLabel: '0.8 m/s',
      maxLabel: '>= 4.0 m/s'
    }
  },

  // 5. Surface Ocean Wind
  {
    id: 'wind',
    name: 'Surface Ocean Wind (10m)',
    shortDescription: '10-meter marine atmospheric boundary layer wind vectors influencing sea state and drift.',
    category: 'environment',
    source: 'ECMWF / Copernicus Marine (Secondary adapter: Open-Meteo)',
    datasetName: '10m Marine Boundary Layer Wind Field (u10/v10)',
    serviceType: 'rest-raster',
    endpointUrl: 'https://marine.copernicus.eu/',
    officialReferenceUrl: 'https://help.marine.copernicus.eu/',
    units: 'm/s (knots)',
    spatialResolution: '0.1° (~10 km)',
    temporalResolution: 'Hourly NRT',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Hourly Updates',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Direction conventions verified as meteorological ("from which wind blows"). Speed scale matches Beaufort categories.',
    legend: {
      title: '10M MARINE WIND SPEED',
      units: 'm/s',
      gradient: 'linear-gradient(to right, #004b23, #38b000, #70e000, #ffaa00, #ff5400, #9d0208)',
      minLabel: '0 m/s (Calm)',
      midLabel: '10 m/s (Moderate)',
      maxLabel: '25+ m/s (Gale)'
    }
  },

  // 6. Significant Wave Height
  {
    id: 'waves',
    name: 'Significant Wave Height',
    shortDescription: 'Combined wind sea and swell significant wave height for vessel navigation and coastal risk.',
    category: 'environment',
    source: 'INCOIS OSF / Copernicus WAV (Secondary adapter: Open-Meteo)',
    datasetName: 'GLOBAL_ANALYSISFORECAST_WAV_001_027 (Spectral Wave Model)',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/rsmc_waves.jsp',
    officialReferenceUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description',
    units: 'm',
    spatialResolution: '0.08° (~8 km)',
    temporalResolution: 'Hourly Forecast',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Hourly Updates',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Rendered with official SAMUDRA color ramp (0-0.5m cyan, 1-1.5m blue, 2-3m purple, 4-5m red, 7-10m+).',
    legend: {
      title: 'SIGNIFICANT WAVE HEIGHT',
      units: 'm',
      gradient: 'linear-gradient(to right, #00cccc, #0055ff, #3377ff, #aa77ff, #aa33dd, #880099, #cc2233, #ff1122, #ff88aa, #bbbbcc, #eeeeee)',
      minLabel: '0 m',
      midLabel: '2.5 m',
      maxLabel: '>= 12 m'
    }
  },

  // 7. Swell Wave Height
  {
    id: 'swell',
    name: 'Swell Wave Height',
    shortDescription: 'Long-period ocean swell generated by distant maritime storms and monsoon swells.',
    category: 'environment',
    source: 'INCOIS OSF / Copernicus WAV (Secondary adapter: Open-Meteo)',
    datasetName: 'Swell Wave Height & Direction (VHM0_SW1)',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    officialReferenceUrl: 'https://open-meteo.com/en/docs/marine-weather-api',
    units: 'm',
    spatialResolution: '0.08° (~8 km)',
    temporalResolution: 'Hourly Forecast',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Hourly Updates',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Swell wave height in meters and propagation direction arrows indicating incoming open-ocean swell.',
    legend: {
      title: 'SWELL WAVE HEIGHT',
      units: 'm',
      gradient: 'linear-gradient(to right, #00cccc, #0055ff, #3377ff, #aa77ff, #aa33dd, #880099, #cc2233, #ff1122, #ff88aa, #bbbbcc, #eeeeee)',
      minLabel: '0 m',
      midLabel: '2.5 m',
      maxLabel: '>= 12 m'
    }
  },

  // 8. Wave Period
  {
    id: 'wave_period',
    name: 'Peak Wave Period',
    shortDescription: 'Time interval between successive wave crests. Critical for vessel resonance and shoaling impact.',
    category: 'environment',
    source: 'INCOIS OSF / Copernicus WAV (Secondary adapter: Open-Meteo)',
    datasetName: 'Peak Wave Period (VTPK / Tp)',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    officialReferenceUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description',
    units: 'seconds (s)',
    spatialResolution: '0.08° (~8 km)',
    temporalResolution: 'Hourly Forecast',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Hourly Updates',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Displays actual wave period in seconds. Short period (<6s) indicates choppy wind sea; long period (>10s) indicates energetic swell.',
    legend: {
      title: 'PEAK WAVE PERIOD',
      units: 'seconds',
      gradient: 'linear-gradient(to right, #1d3557, #457b9d, #a8dadc, #f1faee, #e76f51, #e63946)',
      minLabel: '4 s (Choppy)',
      midLabel: '9 s (Moderate)',
      maxLabel: '16+ s (Long Swell)'
    }
  },

  // 9. Swell Period
  {
    id: 'swell_period',
    name: 'Swell Wave Period',
    shortDescription: 'Period of dominant open-ocean swell waves approaching coastal harbours.',
    category: 'environment',
    source: 'INCOIS OSF / Copernicus WAV (Secondary adapter: Open-Meteo)',
    datasetName: 'Primary Swell Wave Period (VTPK_SW1)',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    officialReferenceUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description',
    units: 'seconds (s)',
    spatialResolution: '0.08° (~8 km)',
    temporalResolution: 'Hourly Forecast',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Hourly Updates',
    defaultOpacity: 0.75,
    isBrowserAccessible: true,
    notes: 'Dominant swell wave period in seconds. Crucial for predicting swell surge (Kallakkadal) events along SW India.',
    legend: {
      title: 'SWELL WAVE PERIOD',
      units: 'seconds',
      gradient: 'linear-gradient(to right, #03045e, #0077b6, #00b4d8, #90e0ef, #caf0f8, #f72585)',
      minLabel: '5 s',
      midLabel: '11 s',
      maxLabel: '18+ s'
    }
  },

  // 10. Mixed Layer Depth (MLD)
  {
    id: 'mld',
    name: 'Mixed Layer Depth (MLD)',
    shortDescription: 'Upper ocean layer depth of uniform temperature and density, governing thermal capacity.',
    category: 'environment',
    source: 'INCOIS OSF / HYCOM',
    datasetName: 'Ocean State Forecast MLD Numerical Model',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    officialReferenceUrl: 'https://incois.gov.in/',
    units: 'meters (m)',
    spatialResolution: '0.25° Grid Model',
    temporalResolution: 'Daily Model Cycle',
    status: 'UNAVAILABLE',
    updateCadence: 'Daily',
    defaultOpacity: 0.70,
    isBrowserAccessible: false,
    notes: 'INCOIS OSF produces MLD numerical grids. Public browser WMS endpoint is not currently exposed. Under ORCA integrity rules, no synthetic MLD field is generated.',
    legend: {
      title: 'MIXED LAYER DEPTH',
      units: 'm',
      gradient: 'linear-gradient(to right, #caf0f8, #90e0ef, #00b4d8, #0077b6, #03045e)',
      minLabel: '10 m (Shallow)',
      midLabel: '50 m',
      maxLabel: '120+ m (Deep)'
    }
  },

  // 11. D20 (20°C Isotherm Depth)
  {
    id: 'd20',
    name: 'Depth of 20°C Isotherm (D20)',
    shortDescription: 'Thermocline depth indicator representing upper ocean thermal energy and cyclone heat potential.',
    category: 'environment',
    source: 'INCOIS OSF / GODAS',
    datasetName: 'Subsurface 20°C Isotherm Depth Analysis',
    serviceType: 'rest-raster',
    endpointUrl: 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    officialReferenceUrl: 'https://incois.gov.in/',
    units: 'meters (m)',
    spatialResolution: '0.25° Grid',
    temporalResolution: 'Daily Analysis',
    status: 'UNAVAILABLE',
    updateCadence: 'Daily',
    defaultOpacity: 0.70,
    isBrowserAccessible: false,
    notes: 'Subsurface thermocline depth requires subsurface CTD/Argo assimilation model. Public browser WMS is not available. No synthetic D20 field is substituted.',
    legend: {
      title: 'DEPTH OF 20°C ISOTHERM',
      units: 'm',
      gradient: 'linear-gradient(to right, #e0fbfc, #98c1d9, #3d5a80, #293241)',
      minLabel: '20 m',
      midLabel: '80 m',
      maxLabel: '150+ m'
    }
  },

  // 12. Bathymetry & Depth Contours
  {
    id: 'bathymetry',
    name: 'Bathymetry & Depth Contours',
    shortDescription: 'Seafloor topography and continental shelf slope influencing coastal wave shoaling and fish habitat.',
    category: 'environment',
    source: 'INCOIS / GEBCO',
    datasetName: 'PFZ_Bathymetry:bathymetry (GEBCO / INCOIS Depth Grids)',
    serviceType: 'wms',
    endpointUrl: 'https://incois.gov.in/geoserver/wms',
    officialReferenceUrl: 'https://incois.gov.in/geoportal/MFASPFZ/index.html',
    units: 'm below sea level',
    spatialResolution: '15 arc-second grid (~450m)',
    temporalResolution: 'Authoritative Static Baseline',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Static Reference',
    defaultOpacity: 0.65,
    isBrowserAccessible: true,
    notes: 'Authoritative depth isobaths showing continental shelf break (200m line), continental slope, and deep oceanic trenches.',
    legend: {
      title: 'OCEAN DEPTH CONTOURS',
      units: 'm Below Sea Level',
      gradient: 'linear-gradient(to right, #001e3d, #003566, #004d80, #006699, #0080b3, #0099cc, #33b5e5)',
      minLabel: '0m (Coast)',
      midLabel: '-200m (Shelf)',
      maxLabel: '-4000m (Deep)'
    }
  },

  // 13. IMD Cyclone Warning
  {
    id: 'cyclone',
    name: 'IMD Cyclone Warning',
    shortDescription: 'Official India Meteorological Department tropical cyclone track, wind radii, and cone of uncertainty.',
    category: 'safety',
    source: 'IMD',
    datasetName: 'RSMC New Delhi Tropical Cyclone Track API',
    serviceType: 'feature',
    endpointUrl: 'https://api.imd.gov.in/api/v1/cyclone_track',
    officialReferenceUrl: 'https://mausam.imd.gov.in/',
    units: 'Knots / hPa / Category',
    spatialResolution: 'Point & Polygon Geometry',
    temporalResolution: '3-Hourly during active systems',
    status: 'UNAVAILABLE',
    updateCadence: 'Event-driven',
    defaultOpacity: 0.90,
    isBrowserAccessible: false,
    notes: 'Official IMD API requires registered API authentication credentials (HTTP 401). Currently, RSMC New Delhi bulletin confirms: No Active Tropical Cyclone System in North Indian Ocean.',
    legend: {
      title: 'CYCLONE INTENSITY & TRACK',
      units: 'Category',
      discreteItems: [
        { label: 'Depression / Deep Dep.', color: '#3B82F6', value: '17–33 kts' },
        { label: 'Cyclonic Storm', color: '#F59E0B', value: '34–47 kts' },
        { label: 'Severe Cyclonic Storm', color: '#EF4444', value: '48–63 kts' },
        { label: 'Very Severe / Super', color: '#8B5CF6', value: '64+ kts' },
        { label: 'Cone of Uncertainty', color: 'rgba(239,68,68,0.25)', value: 'Forecast Envelope' }
      ]
    }
  },

  // 14. Marine Hazards & Coastal Threat Status
  {
    id: 'hazards',
    name: 'Coastal Threat Status & OSF Alerts',
    shortDescription: 'INCOIS early warnings for rough sea, swell surge, high waves, and coastal inundation.',
    category: 'safety',
    source: 'INCOIS',
    datasetName: 'Ocean State Forecast (OSF) Threat Status Segments',
    serviceType: 'feature',
    endpointUrl: 'https://incois.gov.in/portal/osf/osf.jsp',
    officialReferenceUrl: 'https://incois.gov.in/',
    units: 'Threat Status Tier',
    spatialResolution: 'Coastal Districts & Marine Sectors',
    temporalResolution: '6-Hourly Updates',
    status: 'LATEST AVAILABLE',
    updateCadence: '6-Hourly',
    defaultOpacity: 0.85,
    isBrowserAccessible: true,
    notes: 'Directly mirrors the INCOIS SAMUDRA Coastal Threat Status segments: Red (Warning), Orange (Alert), Yellow (Watch), Green (No Threat).',
    legend: {
      title: 'THREAT STATUS',
      units: 'Alert Tier',
      discreteItems: [
        { label: 'Warning', color: '#FF0000', value: 'Severe danger / No sail' },
        { label: 'Alert', color: '#FFA500', value: 'Rough sea / Be prepared' },
        { label: 'Watch', color: '#FFFF00', value: 'Be cautious' },
        { label: 'No Threat', color: '#00875A', value: 'Normal sea state' }
      ]
    }
  },

  // 15. Marine Heatwave
  {
    id: 'heatwave',
    name: 'Marine Heatwave',
    shortDescription: 'Prolonged anomalously warm ocean events impacting coral reefs and fish migration.',
    category: 'safety',
    source: 'INCOIS / NOAA Coral Reef Watch',
    datasetName: 'MHW:MHWDomainBasin (INCOIS Basin Boundary)',
    serviceType: 'wms',
    endpointUrl: 'https://incois.gov.in/geoserver/wms',
    officialReferenceUrl: 'https://incois.gov.in/',
    units: '°C Anomaly',
    spatialResolution: '0.05° Grid Baseline',
    temporalResolution: 'Daily 30-Day Persistence Filter',
    status: 'LATEST AVAILABLE',
    updateCadence: 'Daily',
    defaultOpacity: 0.65,
    isBrowserAccessible: true,
    notes: 'INCOIS MHW domain basin boundary is connected via GeoServer WMS. Full anomaly relative to 30-year climatology is computed on INCOIS backend servers.',
    legend: {
      title: 'MARINE HEATWAVE CATEGORY',
      units: 'Category (Hobday et al.)',
      discreteItems: [
        { label: 'Category I: Moderate', color: '#FDE047', value: '1x–2x Baseline Anomaly' },
        { label: 'Category II: Strong', color: '#FB923C', value: '2x–3x Baseline Anomaly' },
        { label: 'Category III: Severe', color: '#EF4444', value: '3x–4x Baseline Anomaly' },
        { label: 'Category IV: Extreme', color: '#7E22CE', value: '>4x Baseline Anomaly' }
      ]
    }
  }
];
