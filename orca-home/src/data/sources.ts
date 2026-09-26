import { MarineDataSource } from '../types';

export const OFFICIAL_DATA_SOURCES: MarineDataSource[] = [
  {
    id: 'incois',
    name: 'INCOIS',
    fullName: 'Indian National Centre for Ocean Information Services',
    category: 'Indian Marine',
    url: 'https://incois.gov.in/',
    datasets: [
      'PFZ (Potential Fishing Zone) WebGIS & GeoServer (PFZ_Automation:pfzlines)',
      'Near-Real-Time Ocean Colour & SST Products (PFZ-TUNA-SST-CHL:sst, chl)',
      'Marine Fishery Advisory Services (MFAS)',
      'Ocean State Forecast (OSF) High Wave Alerts'
    ],
    parametersProvided: [
      'PFZ Advisory Vectors & Landing Centres',
      'Sea Surface Temperature (SST)',
      'Chlorophyll-a Concentration',
      'Bathymetry & Indian EEZ Boundaries'
    ],
    orcaRole: 'Primary authoritative provider for Indian coastal fishery intelligence, bio-thermal ocean fronts, and coastal safety alerts.',
    isOperational: true,
    badgeText: 'Primary Indian Marine Source'
  },
  {
    id: 'mosdac',
    name: 'MOSDAC / ISRO',
    fullName: 'Meteorological and Oceanographic Satellite Data Archival Centre',
    category: 'Indian Marine',
    url: 'https://www.mosdac.gov.in/',
    datasets: [
      'Oceansat-3 Ocean Colour Monitor (OCM-3)',
      'INSAT-3DR Imager & Sounder Observations',
      'Ocean Surface & Subsurface Met-Ocean Products'
    ],
    parametersProvided: [
      'Ocean Optical Reflectance & Thermal Radiances',
      'Atmospheric Wind Profiles',
      'Sea Surface Temperature from Space'
    ],
    orcaRole: 'Space-borne Earth Observation data streams for cross-sensor validation and large-scale ocean thermal tracking.',
    isOperational: true,
    badgeText: 'Satellite Observation Source'
  },
  {
    id: 'copernicus',
    name: 'Copernicus Marine',
    fullName: 'Copernicus Marine Environment Monitoring Service (CMEMS)',
    category: 'Global Ocean',
    url: 'https://marine.copernicus.eu/',
    datasets: [
      'GLOBAL_ANALYSISFORECAST_PHY_001_024 (Global Ocean Physics Analysis & Forecast)',
      'GLOBAL_ANALYSISFORECAST_WAV_001_027 (Global Ocean Wave Analysis & Forecast)',
      'Ocean Currents U (eastward) and V (northward) vector fields'
    ],
    parametersProvided: [
      'Ocean Current Velocity & Direction (U/V vectors)',
      'Significant Wave Height, Direction & Period',
      'Global High-Resolution Sea Surface Temperature'
    ],
    orcaRole: 'Continuous high-resolution numerical hydrodynamic models for ocean currents and sea-state dynamics across the Indian Ocean basin.',
    isOperational: true,
    badgeText: 'Global Hydrodynamic Source'
  },
  {
    id: 'imd',
    name: 'IMD',
    fullName: 'India Meteorological Department',
    category: 'Meteorology',
    url: 'https://mausam.imd.gov.in/',
    datasets: [
      'RSMC New Delhi Tropical Cyclone Bulletins',
      'IMD Cyclone Track & Cone of Uncertainty API (api.imd.gov.in/api/v1/cyclone_track)',
      'Fishermen Coastal Weather Warnings'
    ],
    parametersProvided: [
      'Observed & Forecast Cyclone Trajectories',
      'Central Barometric Pressure & Maximum Sustained Wind',
      'Squall & Sea Hazard Warnings'
    ],
    orcaRole: 'Authoritative national meteorological and cyclone hazard warning system for maritime risk evaluation.',
    isOperational: true,
    badgeText: 'National Met Source'
  },
  {
    id: 'arcgis',
    name: 'ArcGIS Maps SDK',
    fullName: 'Esri ArcGIS Maps SDK for JavaScript',
    category: 'GIS Engine',
    url: 'https://developers.arcgis.com/javascript/latest/',
    datasets: [
      'Dark Gray Canvas Vector Basemap',
      'World Ocean Basemap & Bathymetric Reference',
      'World Geocoding Service (Location Search)'
    ],
    parametersProvided: [
      'High-Precision Geographic Coordinates',
      'Stable Cartographic Basemap',
      'Interactive MapView & Geodetic Measurement'
    ],
    orcaRole: 'Underlying geospatial visualization engine providing persistent, high-contrast basemap and coordinate system.',
    isOperational: true,
    badgeText: 'Geospatial Foundation'
  }
];
