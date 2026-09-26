import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  INDIAN_MARITIME_DEFAULT_CENTER,
  INDIAN_MARITIME_DEFAULT_ZOOM,
  convertBoundsToLeaflet,
  convertZonesCatalogToGeoJSON,
  deduplicateRestrictedZones,
  sanitizeFeatureCollection,
  getVesselMarkerSvg,
  getPfzMarkerSvg,
  getUserGpsMarkerSvg
} from '../utils/geojsonUtils';
import { escapeHtml, formatSafeNumber, safeJoinList } from '../utils/security';
import { fetchZones } from '../api/orcaClient';
import { ShieldAlert, Crosshair, Navigation, LocateFixed } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet asset URLs in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

/**
 * Controller sub-component to handle map camera movements (Bounds or Center)
 */
function MapCameraController({ mapBounds, centerTarget }) {
  const map = useMap();

  // Priority 1: Center Target (e.g. explicit GPS click)
  useEffect(() => {
    if (centerTarget && Array.isArray(centerTarget) && centerTarget.length === 2) {
      try {
        map.setView(centerTarget, Math.max(map.getZoom(), 9), { animate: true });
      } catch (e) {
        console.warn('Map center failed:', e);
      }
    }
  }, [map, centerTarget]);

  // Priority 2: Backend Query Map Bounds
  useEffect(() => {
    if (!mapBounds) return;
    const leafletBounds = convertBoundsToLeaflet(mapBounds);
    if (leafletBounds) {
      try {
        map.fitBounds(leafletBounds, {
          padding: [50, 50],
          maxZoom: 12,
          animate: true
        });
      } catch (e) {
        console.warn('Map fitBounds failed:', e);
      }
    }
  }, [map, mapBounds]);

  return null;
}

/**
 * Constructs CARTO basemap tile URL.
 * Uses the official CARTO light raster basemap endpoint with ?key= parameter when VITE_CARTO_API_KEY is configured.
 * Gracefully falls back to the public CARTO light basemap endpoint if missing or empty.
 */
export function getCartoTileUrl(apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CARTO_API_KEY)) {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (cleanKey) {
    return `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cleanKey)}`;
  }
  return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

export default function MapPanel({
  visualization,
  queryId,
  userLocation,
  defaultCenter = INDIAN_MARITIME_DEFAULT_CENTER,
  defaultZoom = INDIAN_MARITIME_DEFAULT_ZOOM
}) {
  const { t } = useTranslation();
  const cartoApiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CARTO_API_KEY) || '';
  const tileUrl = useMemo(() => getCartoTileUrl(cartoApiKey), [cartoApiKey]);

  const [showCatalogZones, setShowCatalogZones] = useState(false);
  const [catalogZonesData, setCatalogZonesData] = useState(null);
  const [loadingZones, setLoadingZones] = useState(false);
  const [centerTarget, setCenterTarget] = useState(null);
  const geoJsonLayerRef = useRef(null);

  const rawGeojson = visualization?.geojson;
  const mapBounds = visualization?.map_bounds;

  // Sanitize query GeoJSON to guarantee geometry integrity
  const geojson = useMemo(() => sanitizeFeatureCollection(rawGeojson), [rawGeojson]);

  // Load national restricted zones catalog once on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        setLoadingZones(true);
        const data = await fetchZones();
        if (isMounted && data?.restricted_marine_zones) {
          const fc = convertZonesCatalogToGeoJSON(data.restricted_marine_zones);
          setCatalogZonesData(fc);
        }
      } catch (err) {
        console.error('Error loading zones catalog:', err);
      } finally {
        if (isMounted) setLoadingZones(false);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Multi-tier deduplication: Only render catalog zones that are NOT already in query GeoJSON
  const deduplicatedCatalogZones = useMemo(() => {
    if (!catalogZonesData || !showCatalogZones) return null;
    const queryFeatures = geojson?.features || [];
    const catalogFeatures = catalogZonesData.features || [];
    const uniqueCatalog = deduplicateRestrictedZones(queryFeatures, catalogFeatures);

    return {
      type: 'FeatureCollection',
      features: uniqueCatalog
    };
  }, [catalogZonesData, showCatalogZones, geojson]);

  // Custom point-to-layer renderer for GeoJSON features
  const pointToLayer = (feature, latlng) => {
    const props = feature.properties || {};
    const cat = props.category || '';
    const id = props.id || '';

    // Vessel / Port Origin Pin: Blue marker (#2563eb)
    if (cat === 'user' || id === 'user-vessel') {
      const vesselIcon = L.divIcon({
        className: 'custom-vessel-marker',
        html: getVesselMarkerSvg(),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });
      return L.marker(latlng, { icon: vesselIcon });
    }

    // PFZ Pin: Green marker (#059669) star icon
    if (cat === 'pfz' || id.startsWith('PFZ-')) {
      const pfzIcon = L.divIcon({
        className: 'custom-pfz-marker',
        html: getPfzMarkerSvg(),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });
      return L.marker(latlng, { icon: pfzIcon });
    }

    // Fallback point marker
    return L.circleMarker(latlng, {
      radius: 7,
      fillColor: props['marker-color'] || '#38bdf8',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    });
  };

  // Styling for line and polygon features
  const styleFeature = (feature) => {
    const props = feature.properties || {};
    const geomType = feature.geometry?.type;
    const cat = props.category || '';
    const id = props.id || '';

    // Navigation vector: Dashed blue line (#0284c7, width 3, dasharray "6, 6")
    if (geomType === 'LineString' || id === 'nav-course-vector') {
      return {
        color: props.stroke || '#0284c7',
        weight: props['stroke-width'] || 3,
        dashArray: props['stroke-dasharray'] || '6, 6',
        opacity: 0.95
      };
    }

    // Restricted Marine Boundaries: Red fill (#dc2626, 28% opacity), red border (#b91c1c, width 2.5)
    if (geomType === 'Polygon' || geomType === 'MultiPolygon' || cat === 'restricted_zone' || id.startsWith('restricted-')) {
      return {
        fillColor: '#dc2626',
        fillOpacity: props['fill-opacity'] || 0.28,
        color: '#b91c1c',
        weight: props['stroke-width'] || 2.5,
        opacity: 1
      };
    }

    return {
      color: '#38bdf8',
      weight: 2,
      opacity: 0.8
    };
  };

  // SECURE POPUP BINDING: Every backend-derived string is sanitized through escapeHtml
  const onEachFeature = (feature, layer) => {
    const props = feature.properties || {};
    const cat = props.category || '';
    const id = props.id || '';

    // 1. PFZ Popup
    if (cat === 'pfz' || id.startsWith('PFZ-')) {
      const escapedTitle = escapeHtml(props.title || props.id || 'Potential Fishing Zone');
      const escapedSst = formatSafeNumber(props.sst_celsius, 1);
      const escapedChl = formatSafeNumber(props.chlorophyll_mg_m3, 2);
      const suitabilityPct = Math.round(
        props.suitability_score !== undefined
          ? props.suitability_score <= 1.0
            ? props.suitability_score * 100
            : props.suitability_score
          : 0
      );
      const escapedDist = formatSafeNumber(props.distance_km, 1);
      const escapedBearing = formatSafeNumber(props.bearing_deg, 0);

      const speciesHtml = Array.isArray(props.target_species) && props.target_species.length > 0
        ? props.target_species
            .map(
              (s) =>
                `<span style="background: rgba(5, 150, 105, 0.15); border: 1px solid rgba(5, 150, 105, 0.3); padding: 2px 6px; border-radius: 4px; margin-right: 4px; color: #065f46; font-size: 11px;">${escapeHtml(s)}</span>`
            )
            .join(' ')
        : '';

      layer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; min-width: 210px;">
          <div style="font-weight: 700; color: #059669; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            ★ ${escapedTitle}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
            <tr><td style="color: #64748b; padding: 2px 0;">${escapeHtml(t('map.seaTemp', 'Sea Temp (SST):'))}</td><td style="font-weight: 600; text-align: right;">${escapedSst}°C</td></tr>
            <tr><td style="color: #64748b; padding: 2px 0;">${escapeHtml(t('map.chlorophyll', 'Chlorophyll-a:'))}</td><td style="font-weight: 600; text-align: right;">${escapedChl} mg/m³</td></tr>
            <tr><td style="color: #64748b; padding: 2px 0;">${escapeHtml(t('map.suitability', 'Suitability:'))}</td><td style="font-weight: 600; text-align: right; color: #059669;">${suitabilityPct}%</td></tr>
            <tr><td style="color: #64748b; padding: 2px 0;">${escapeHtml(t('map.distanceOffshore', 'Distance Offshore:'))}</td><td style="font-weight: 600; text-align: right;">${escapedDist} km</td></tr>
            <tr><td style="color: #64748b; padding: 2px 0;">${escapeHtml(t('map.compassBearing', 'Compass Bearing:'))}</td><td style="font-weight: 600; text-align: right;">${escapedBearing}°</td></tr>
          </table>
          ${speciesHtml ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0;"><strong>${escapeHtml(t('map.targetCatch', 'Target Catch:'))}</strong><div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 2px;">${speciesHtml}</div></div>` : ''}
        </div>
      `);
      return;
    }

    // 2. User Vessel Origin Popup
    if (cat === 'user' || id === 'user-vessel') {
      const escapedTitle = escapeHtml(props.title || t('map.vesselOrigin', 'Vessel / Port Origin'));
      layer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; min-width: 180px;">
          <div style="font-weight: 700; color: #2563eb; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            ⚓ ${escapedTitle}
          </div>
          <div style="color: #64748b; font-size: 11px;">Evaluated departure port or reported vessel location.</div>
        </div>
      `);
      return;
    }

    // 3. Navigation Course Vector Popup
    if (id === 'nav-course-vector') {
      const escapedTitle = escapeHtml(props.title || t('map.navCourse', 'Navigation Vector'));
      const escapedDist = formatSafeNumber(props.distance_km, 1);
      const escapedBearing = formatSafeNumber(props.bearing_deg, 0);

      layer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; min-width: 180px;">
          <div style="font-weight: 700; color: #0284c7; font-size: 13px; margin-bottom: 4px;">
            🧭 ${escapedTitle}
          </div>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
            Course from vessel to target fishing grounds:
          </div>
          <div style="font-weight: 600; margin-top: 4px; color: #0f172a;">
            ${escapedDist !== 'N/A' ? `${escapedDist} km` : ''} ${escapedBearing !== 'N/A' ? `@ ${escapedBearing}°` : ''}
          </div>
        </div>
      `);
      return;
    }

    // 4. Restricted Marine Boundary Popup
    if (cat === 'restricted_zone' || id.startsWith('restricted-') || props.isCatalogZone) {
      const escapedTitle = escapeHtml(props.title || props.name || props.id || 'Restricted Marine Zone');
      const escapedType = escapeHtml(props.zone_type || props.type || 'Exclusion Perimeter');
      const escapedState = props.state ? escapeHtml(props.state) : '';
      const escapedBuffer = formatSafeNumber(props.buffer_km, 1, '2.0');

      layer.bindPopup(`
        <div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; min-width: 220px;">
          <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            ⛔ ${escapeHtml(t('map.restrictedPopupTitle', 'RESTRICTED MARINE BOUNDARY'))}
          </div>
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 3px; font-size: 12px;">
            ${escapedTitle}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">
            ${escapeHtml(t('map.classification', 'Classification:'))} <strong>${escapedType}</strong>
          </div>
          ${escapedState ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">${escapeHtml(t('map.jurisdiction', 'Jurisdiction:'))} ${escapedState}</div>` : ''}
          <div style="font-size: 11px; color: #b91c1c; font-weight: 600; margin-top: 4px; background: rgba(220, 38, 38, 0.08); padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.2);">
            ${escapeHtml(t('map.safetyBuffer', 'Mandatory Safety Buffer:'))} ${escapedBuffer} km
          </div>
        </div>
      `);
    }
  };

  // GPS Marker Icon
  const userGpsIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-gps-marker',
      html: getUserGpsMarkerSvg(),
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16]
    });
  }, []);

  return (
    <div className="map-viewport" role="region" aria-label="Interactive Maritime Geospatial Map">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', background: '#f8fafc' }}
        attributionControl={false}
      >
        {/* Modern light maritime tiles with CARTO API key integration */}
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          subdomains="abcd"
        />

        {/* Dynamic Camera Controller (GPS or Bounds) */}
        <MapCameraController mapBounds={mapBounds} centerTarget={centerTarget} />

        {/* 1. Per-Query GeoJSON Layer (STABLE KEY using queryId) */}
        {geojson && (
          <GeoJSON
            key={queryId || 'active-query-layer'}
            data={geojson}
            pointToLayer={pointToLayer}
            style={styleFeature}
            onEachFeature={onEachFeature}
            ref={geoJsonLayerRef}
          />
        )}

        {/* 2. Nationwide Catalog Overlay (STRICTLY DEDUPLICATED) */}
        {showCatalogZones && deduplicatedCatalogZones && (
          <GeoJSON
            key="national-catalog-deduped"
            data={deduplicatedCatalogZones}
            pointToLayer={pointToLayer}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {/* 3. User GPS Location Marker (Subtle radar pulse beacon) */}
        {userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number' && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={userGpsIcon}>
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0f172a', minWidth: '180px' }}>
                <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '13px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Crosshair size={14} /> {t('map.gpsLocationPopup', 'Your GPS Location')}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Lat: <strong>{userLocation.lat.toFixed(4)}°N</strong><br />
                  Lon: <strong>{userLocation.lon.toFixed(4)}°E</strong>
                </div>
                <div style={{ fontSize: '10px', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
                  Active for subsequent inquiries
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Control Buttons */}
      <div className="map-floating-panel">
        <button
          onClick={() => setShowCatalogZones(!showCatalogZones)}
          className={`map-control-btn ${showCatalogZones ? 'active' : ''}`}
          title="Toggle nationwide restricted marine sanctuaries and naval defense zones catalog"
          aria-label="Toggle all restricted marine zones"
        >
          <ShieldAlert size={14} color={showCatalogZones ? '#f87171' : '#38bdf8'} />
          <span>{showCatalogZones ? t('map.hideAllZones', 'Hide Nationwide Zones') : t('map.showAllZones', 'Show All Restricted Zones')}</span>
        </button>

        {userLocation && (
          <button
            onClick={() => setCenterTarget([userLocation.lat, userLocation.lon])}
            className="map-control-btn"
            title="Recenter map on your device GPS position"
            aria-label="Center on my GPS position"
          >
            <LocateFixed size={14} color="#06b6d4" />
            <span>{t('map.centerGps', 'Center on GPS')}</span>
          </button>
        )}

        {mapBounds && (
          <button
            onClick={() => {
              const b = convertBoundsToLeaflet(mapBounds);
              if (b) setCenterTarget(null);
            }}
            className="map-control-btn"
            title="Fit map view to the current query advisory bounds"
            aria-label="Fit to advisory bounds"
          >
            <Navigation size={14} color="#38bdf8" />
            <span>{t('map.fitBounds', 'Fit Advisory Bounds')}</span>
          </button>
        )}
      </div>

      {/* Map Legend */}
      <div className="map-legend" role="complementary" aria-label="Map Symbology Legend">
        <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '4px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('map.symbology', 'Geospatial Symbology')}
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#2563eb', border: '1.5px solid #fff' }} />
          <span>{t('map.vesselOrigin', 'Vessel / Port Origin')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#059669', border: '1.5px solid #fff' }} />
          <span>{t('map.pfz', 'Potential Fishing Zone (PFZ)')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" />
          <span>{t('map.navCourse', 'Nav Course Vector')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-rect" style={{ background: 'rgba(220, 38, 38, 0.4)', border: '1px solid #b91c1c' }} />
          <span>{t('map.restrictedZone', 'Restricted Sanctuary / Naval Zone')}</span>
        </div>
        {userLocation && (
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#06b6d4', border: '1.5px solid #fff', boxShadow: '0 0 6px #06b6d4' }} />
            <span>{t('map.gpsBeacon', 'Your GPS Device Beacon')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
