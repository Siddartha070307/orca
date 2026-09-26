import esriConfig from '@arcgis/core/config.js';
import IdentityManager from '@arcgis/core/identity/IdentityManager.js';

// Initialize ArcGIS Maps SDK Configuration
export function initArcGisConfig(): void {
  // Read API key strictly from environment variable, never hardcoded
  const apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
  if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
    esriConfig.apiKey = apiKey.trim();
  }

  // Prevent ArcGIS Online OAuth sign-in modal from appearing
  try {
    if (IdentityManager) {
      IdentityManager.dialog = null as any;
      IdentityManager.getCredential = () => Promise.reject(new Error('ArcGIS online authentication canceled'));
    }
  } catch (e) {}
  
  // Set default request timeout to prevent hanging connections
  esriConfig.request.timeout = 15000;
}

// Default viewport coordinates framed around Indian Subcontinent, Bay of Bengal, and Arabian Sea
export const DEFAULT_MAP_VIEW = {
  center: [81.5, 15.5], // Centered over Bay of Bengal / East Coast India
  zoom: 5,
  minZoom: 3,
  maxZoom: 16,
  constraints: {
    minZoom: 3,
    maxZoom: 16,
    rotationEnabled: false // Professional GIS 2D orientation
  }
};

// Basemap configuration - Professional colorful geographic GIS basemap
// Land: light green/beige terrain, Ocean: light blue, Clear cities & roads
export const BASEMAP_CONFIG = {
  defaultBasemapId: 'topo-vector',
  fallbackBasemapId: 'arcgis/topographic'
};

