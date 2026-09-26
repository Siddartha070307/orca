export type LayerStatus = 
  | 'LIVE' 
  | 'LATEST AVAILABLE' 
  | 'FORECAST' 
  | 'HISTORICAL' 
  | 'SIMULATION' 
  | 'UNAVAILABLE';

export type LayerCategory = 
  | 'environment' 
  | 'ecosystem' 
  | 'safety' 
  | 'analysis';

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

export interface DynamicLegendConfig {
  title: string;
  units: string;
  gradient?: string; // CSS gradient string
  minLabel?: string;
  midLabel?: string;
  maxLabel?: string;
  discreteItems?: LegendItem[];
}

export interface OceanLayerDefinition {
  id: string;
  name: string;
  shortDescription: string;
  category: LayerCategory;
  source: string;
  datasetName: string;
  serviceType: 'wms' | 'wfs' | 'geojson' | 'vector-particle' | 'rest-raster' | 'feature';
  endpointUrl: string;
  officialReferenceUrl: string;
  units: string;
  spatialResolution: string;
  temporalResolution: string;
  status: LayerStatus;
  updateCadence: string;
  defaultOpacity: number;
  isBrowserAccessible: boolean;
  notes?: string;
  legend: DynamicLegendConfig;
}

export type ActiveMarineParameter = 
  | 'currents' 
  | 'wind' 
  | 'waves' 
  | 'swell' 
  | 'wave_period'
  | 'swell_period'
  | 'sst' 
  | 'chlorophyll' 
  | 'pfz' 
  | 'bathymetry' 
  | 'hazards'
  | 'heatwave'
  | 'mld'
  | 'd20'
  | 'cyclone'
  | null;

export interface ActiveLayerState {
  id: string;
  visible: boolean;
  opacity: number;
}

export interface PointInspectionData {
  latitude: number;
  longitude: number;
  timestamp: string;
  layerValues: {
    layerId: string;
    layerName: string;
    value: string | number;
    unit: string;
    source: string;
    status: LayerStatus;
  }[];
}

export interface GeodeticMeasurement {
  point1: { lat: number; lon: number };
  point2: { lat: number; lon: number };
  distanceKm: number;
  distanceNmi: number;
  bearingDeg: number;
}

export interface OrcaAgent {
  id: string;
  number: number;
  name: string;
  shortRole: string;
  fullRole: string;
  domain: string;
  inputs: string[];
  algorithms: string[];
  outputs: string[];
  collaboratesWith: string[]; // Agent IDs
  status: 'ACTIVE' | 'SYNTHESIZING' | 'STANDBY';
  telemetryMetric: {
    label: string;
    value: string;
  };
}

export interface MarineDataSource {
  id: string;
  name: string;
  fullName: string;
  category: 'Indian Marine' | 'Global Ocean' | 'Meteorology' | 'GIS Engine';
  url: string;
  datasets: string[];
  parametersProvided: string[];
  orcaRole: string;
  isOperational: boolean;
  badgeText: string;
}
