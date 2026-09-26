import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import Extent from '@arcgis/core/geometry/Extent';
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import PopupTemplate from '@arcgis/core/PopupTemplate';

import '@arcgis/core/assets/esri/themes/dark/main.css';

import {
  INDIAN_MARITIME_DEFAULT_CENTER,
  INDIAN_MARITIME_DEFAULT_ZOOM,
  convertZonesCatalogToGeoJSON,
  deduplicateRestrictedZones,
  sanitizeFeatureCollection,
  getVesselMarkerSvgDataUrl,
  getPfzMarkerSvgDataUrl,
  getUserGpsMarkerSvgDataUrl
} from '../utils/geojsonUtils';
import { escapeHtml, formatSafeNumber } from '../utils/security';
import { fetchZones } from '../api/orcaClient';
import { ShieldAlert, Crosshair, Navigation, LocateFixed, MapPin, Compass, Play } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export default function MapPanel({
  visualization,
  queryId,
  userLocation,
  defaultCenter = INDIAN_MARITIME_DEFAULT_CENTER,
  defaultZoom = INDIAN_MARITIME_DEFAULT_ZOOM,
  onStartSimulation
}) {
  const { t } = useTranslation();
  const arcgisApiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ARCGIS_API_KEY) || '';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [initError, setInitError] = useState(null);

  const [showCatalogZones, setShowCatalogZones] = useState(false);
  const [catalogZonesData, setCatalogZonesData] = useState(null);
  const [loadingZones, setLoadingZones] = useState(false);

  const mapContainerRef = useRef(null);
  const viewRef = useRef(null);
  const layersRef = useRef({
    restrictedZonesLayer: null,
    catalogZonesLayer: null,
    routeLayer: null,
    vesselLayer: null,
    pfzLayer: null,
    gpsLayer: null
  });

  const rawGeojson = visualization?.geojson;
  const mapBounds = visualization?.map_bounds;

  // Sanitize query GeoJSON
  const geojson = useMemo(() => sanitizeFeatureCollection(rawGeojson), [rawGeojson]);

  // Set ArcGIS API Key once
  useEffect(() => {
    const cleanKey = arcgisApiKey.trim();
    if (cleanKey) {
      esriConfig.apiKey = cleanKey;
    }
  }, [arcgisApiKey]);

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

  // Multi-tier deduplication between query GeoJSON and catalog zones
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

  // Initialize ArcGIS Map and MapView (once per component lifecycle)
  useEffect(() => {
    if (!arcgisApiKey || arcgisApiKey.trim() === '') {
      return;
    }
    const container = mapContainerRef.current;
    if (!container || !(container instanceof HTMLElement) || viewRef.current) {
      return;
    }

    let isMounted = true;

    try {
      // Create dedicated GraphicsLayers for clear layer hierarchy
      const restrictedZonesLayer = new GraphicsLayer({ id: 'orca-restricted-zones', title: 'Restricted Zones' });
      const catalogZonesLayer = new GraphicsLayer({ id: 'orca-catalog-zones', title: 'Catalog Zones', visible: false });
      const routeLayer = new GraphicsLayer({ id: 'orca-route-vector', title: 'Navigation Vector' });
      const vesselLayer = new GraphicsLayer({ id: 'orca-vessel-origin', title: 'Vessel Origin' });
      const pfzLayer = new GraphicsLayer({ id: 'orca-pfz-candidates', title: 'PFZ Candidates' });
      const gpsLayer = new GraphicsLayer({ id: 'orca-user-gps', title: 'User GPS' });

      // Colorful marine/oceanic ArcGIS basemap (arcgis/oceans provides bathymetric blue water & land context)
      const map = new Map({
        basemap: 'arcgis/oceans',
        layers: [
          restrictedZonesLayer,
          catalogZonesLayer,
          routeLayer,
          vesselLayer,
          pfzLayer,
          gpsLayer
        ]
      });

      // Default center: [lat, lon] -> ArcGIS center expects [longitude, latitude]
      const centerLon = defaultCenter && defaultCenter.length === 2 ? defaultCenter[1] : 76.0;
      const centerLat = defaultCenter && defaultCenter.length === 2 ? defaultCenter[0] : 14.8;

      const view = new MapView({
        container: container,
        map,
        center: [centerLon, centerLat],
        zoom: defaultZoom || 6,
        ui: {
          components: []
        },
        popup: {
          dockEnabled: false,
          collapseEnabled: false,
          alignment: 'top-center'
        }
      });

      viewRef.current = view;
      layersRef.current = {
        restrictedZonesLayer,
        catalogZonesLayer,
        routeLayer,
        vesselLayer,
        pfzLayer,
        gpsLayer
      };
      if (typeof window !== 'undefined') {
        window.__orcaMapView = view;
      }
      setMapLoaded(true);

      // Explicitly ensure no invalid default UI widgets are placed by DefaultUI
      view.ui.components = [];

      // Wire popup action triggers safely if supported by SDK version
      if (view.popup && typeof view.popup.on === 'function') {
        view.popup.on('trigger-action', (event) => {
          if (event.action && event.action.id && event.action.id.startsWith('start-sim-')) {
            const feature = view.popup.selectedFeature;
            if (feature && feature.attributes && onStartSimulation) {
              onStartSimulation(feature.attributes);
            }
          }
        });
      } else if (view.popup && view.popup.viewModel && typeof view.popup.viewModel.on === 'function') {
        view.popup.viewModel.on('trigger-action', (event) => {
          if (event.action && event.action.id && event.action.id.startsWith('start-sim-')) {
            const feature = view.popup.selectedFeature;
            if (feature && feature.attributes && onStartSimulation) {
              onStartSimulation(feature.attributes);
            }
          }
        });
      }

      view.when(
        () => {
          if (!isMounted) {
            view.destroy();
            return;
          }
          setInitError(null);

          // Wire button clicks inside popup HTML content once view and popup are ready
          if (view.popup && view.popup.container) {
            view.popup.container.addEventListener('click', (e) => {
              const btn = e.target && e.target.closest ? e.target.closest('[data-sim-rank]') : null;
              if (btn && onStartSimulation) {
                const feature = view.popup.selectedFeature;
                if (feature && feature.attributes) {
                  onStartSimulation(feature.attributes);
                }
              }
            });
          }
        },
        (error) => {
          console.warn('ArcGIS MapView initialization error:', error);
          if (isMounted) {
            setInitError(error?.message || 'Failed to initialize ArcGIS MapView');
          }
        }
      );
    } catch (err) {
      console.error('Failed to instantiate ArcGIS Map:', err);
      if (isMounted) {
        setInitError(err?.message || 'ArcGIS instantiation error');
      }
    }

    return () => {
      isMounted = false;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (typeof window !== 'undefined') {
        delete window.__orcaMapView;
      }
      layersRef.current = {
        restrictedZonesLayer: null,
        catalogZonesLayer: null,
        routeLayer: null,
        vesselLayer: null,
        pfzLayer: null,
        gpsLayer: null
      };
      setMapLoaded(false);
    };
  }, [arcgisApiKey, defaultCenter, defaultZoom, onStartSimulation]);

  // Render Features & Overlays onto ArcGIS GraphicsLayers
  useEffect(() => {
    if (!mapLoaded || !viewRef.current) return;
    const { restrictedZonesLayer, routeLayer, vesselLayer, pfzLayer, gpsLayer } = layersRef.current;
    if (!restrictedZonesLayer || !routeLayer || !vesselLayer || !pfzLayer || !gpsLayer) return;

    // Clear active graphics before populating
    restrictedZonesLayer.removeAll();
    routeLayer.removeAll();
    vesselLayer.removeAll();
    pfzLayer.removeAll();
    gpsLayer.removeAll();

    const features = geojson?.features || [];

    features.forEach((feature) => {
      const props = feature.properties || {};
      const cat = props.category || '';
      const id = props.id || '';
      const geom = feature.geometry;
      if (!geom) return;

      // 1. Vessel / Port Origin Pin
      if (geom.type === 'Point' && (cat === 'user' || id === 'user-vessel')) {
        const [lon, lat] = geom.coordinates;
        if (typeof lat === 'number' && typeof lon === 'number') {
          const point = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 }
          });

          const symbol = new PictureMarkerSymbol({
            url: getVesselMarkerSvgDataUrl(),
            width: '34px',
            height: '34px'
          });

          const escapedTitle = escapeHtml(props.title || t('map.vesselOrigin', 'Vessel / Port Origin'));
          const popupTemplate = new PopupTemplate({
            title: `⚓ ${escapedTitle}`,
            content: `
              <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 190px; padding: 4px;">
                <div style="color: #5A6E7C; font-size: 11px; margin-bottom: 4px;">${escapeHtml(t('map.vesselOriginDesc', 'Evaluated departure port or reported vessel location.'))}</div>
                <div style="color: #5A6E7C; font-size: 10px; font-family: monospace;">Lat: ${lat.toFixed(4)}°N, Lon: ${lon.toFixed(4)}°E</div>
              </div>
            `
          });

          const graphic = new Graphic({
            geometry: point,
            symbol,
            attributes: props,
            popupTemplate
          });

          vesselLayer.add(graphic);
        }
      }

      // 2. PFZ Candidates
      if (geom.type === 'Point' && (cat === 'pfz' || id.startsWith('PFZ-'))) {
        const [lon, lat] = geom.coordinates;
        if (typeof lat === 'number' && typeof lon === 'number') {
          const rank = typeof props.rank === 'number' ? props.rank : 1;
          const isRec = props.is_recommended || rank === 1;

          const point = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 }
          });

          const symbol = new PictureMarkerSymbol({
            url: getPfzMarkerSvgDataUrl(rank),
            width: rank === 1 ? '38px' : '34px',
            height: rank === 1 ? '38px' : '34px'
          });

          const escapedTitle = escapeHtml(props.title || props.id || `PFZ Candidate #${rank}`);
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
          const escapedFdi = formatSafeNumber(props.fish_density_index, 1);
          const isRestricted = !!props.is_in_restricted_zone;

          const speciesHtml = Array.isArray(props.target_species) && props.target_species.length > 0
            ? props.target_species
                .map(
                  (s) =>
                    `<span style="background: rgba(31, 122, 108, 0.12); border: 1px solid rgba(31, 122, 108, 0.25); padding: 2px 6px; border-radius: 4px; margin-right: 4px; color: #1F7A6C; font-size: 10px; font-weight: 600;">${escapeHtml(s)}</span>`
                )
                .join(' ')
            : '';

          const popupTemplate = new PopupTemplate({
            title: `${isRec ? '★' : `#${rank}`} ${escapedTitle}`,
            content: `
              <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 230px; padding: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(22, 35, 46, 0.12); padding-bottom: 5px; margin-bottom: 6px;">
                  <span style="font-weight: 700; color: ${isRec ? '#1F7A6C' : '#1B5E7A'}; font-size: 13px;">${isRec ? '★ Recommended' : `Rank #${rank}`}</span>
                  <span style="font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 700; ${isRestricted ? 'background: rgba(197, 48, 48, 0.12); color: #C53030; border: 1px solid rgba(197, 48, 48, 0.3);' : 'background: rgba(30, 122, 74, 0.12); color: #1E7A4A; border: 1px solid rgba(30, 122, 74, 0.3);'}">
                    ${isRestricted ? escapeHtml(t('map.restrictedBadge', 'RESTRICTED')) : escapeHtml(t('map.openBadge', 'OPEN'))}
                  </span>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px;">
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.seaTemp', 'Sea Temp (SST):'))}</td><td style="font-weight: 600; text-align: right; color: #16232E; font-family: monospace;">${escapedSst}°C</td></tr>
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.chlorophyll', 'Chlorophyll-a:'))}</td><td style="font-weight: 600; text-align: right; color: #16232E; font-family: monospace;">${escapedChl} mg/m³</td></tr>
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.fishDensityIndex', 'Fish Density Index:'))}</td><td style="font-weight: 700; text-align: right; color: #1E7A4A; font-family: monospace;">${escapedFdi} / 10.0</td></tr>
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.suitability', 'Suitability:'))}</td><td style="font-weight: 600; text-align: right; color: #1B5E7A; font-family: monospace;">${suitabilityPct}%</td></tr>
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.distanceOffshore', 'Distance Offshore:'))}</td><td style="font-weight: 600; text-align: right; color: #16232E; font-family: monospace;">${escapedDist} km</td></tr>
                  <tr><td style="color: #5A6E7C; padding: 2px 0;">${escapeHtml(t('map.compassBearing', 'Compass Bearing:'))}</td><td style="font-weight: 600; text-align: right; color: #16232E; font-family: monospace;">${escapedBearing}°</td></tr>
                </table>
                ${speciesHtml ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(22, 35, 46, 0.12);"><strong style="color: #16232E; font-size: 11px;">${escapeHtml(t('map.targetCatch', 'Target Catch:'))}</strong><div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 2px;">${speciesHtml}</div></div>` : ''}
                <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid rgba(22, 35, 46, 0.12);">
                  <button
                    data-sim-rank="${rank}"
                    style="width: 100%; background: #1F7A6C; color: #ffffff; border: none; padding: 7px 0; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; box-shadow: 0 2px 6px rgba(31, 122, 108, 0.2);"
                  >
                    ${escapeHtml(t('map.start3dSimulation', '▶ Start 3D Simulation'))}
                  </button>
                </div>
              </div>
            `,
            actions: [
              {
                id: `start-sim-${rank}`,
                title: t('map.start3dSimulation', '▶ Start 3D Simulation'),
                icon: 'play'
              }
            ]
          });

          const graphic = new Graphic({
            geometry: point,
            symbol,
            attributes: props,
            popupTemplate
          });

          pfzLayer.add(graphic);
        }
      }

      // 3. Navigation Course Vector (Polyline)
      if (geom.type === 'LineString' || id === 'nav-course-vector') {
        const coords = geom.coordinates || [];
        if (coords.length >= 2) {
          const polyline = new Polyline({
            paths: [coords],
            spatialReference: { wkid: 4326 }
          });

          const symbol = new SimpleLineSymbol({
            color: [27, 94, 122, 0.95],
            width: props['stroke-width'] || 3,
            style: 'dash'
          });

          const escapedTitle = escapeHtml(props.title || t('map.navCourse', 'Navigation Vector'));
          const escapedDist = formatSafeNumber(props.distance_km, 1);
          const escapedBearing = formatSafeNumber(props.bearing_deg, 0);

          const popupTemplate = new PopupTemplate({
            title: `🧭 ${escapedTitle}`,
            content: `
              <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 180px; padding: 4px;">
                <div style="color: #5A6E7C; font-size: 11px;">${escapeHtml(t('map.courseDesc', 'Course from vessel to target fishing grounds:'))}</div>
                <div style="font-weight: 600; margin-top: 4px; color: #16232E; font-size: 12px; font-family: monospace;">
                  ${escapedDist !== 'N/A' ? `${escapedDist} km` : ''} ${escapedBearing !== 'N/A' ? `@ ${escapedBearing}°` : ''}
                </div>
              </div>
            `
          });

          const graphic = new Graphic({
            geometry: polyline,
            symbol,
            attributes: props,
            popupTemplate
          });

          routeLayer.add(graphic);
        }
      }

      // 4. Restricted Marine Boundary (Polygon from Query)
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon' || cat === 'restricted_zone' || id.startsWith('restricted-')) {
        const rings = geom.type === 'Polygon' ? geom.coordinates : (geom.coordinates ? geom.coordinates.flat(1) : []);
        if (rings && rings.length > 0) {
          const polygon = new Polygon({
            rings,
            spatialReference: { wkid: 4326 }
          });

          const symbol = new SimpleFillSymbol({
            color: [220, 38, 38, props['fill-opacity'] || 0.25],
            outline: {
              color: [185, 28, 28, 0.95],
              width: props['stroke-width'] || 2.5
            }
          });

          const escapedTitle = escapeHtml(props.title || props.name || props.id || 'Restricted Marine Zone');
          const escapedType = escapeHtml(props.zone_type || props.type || 'Exclusion Perimeter');
          const escapedState = props.state ? escapeHtml(props.state) : '';
          const escapedBuffer = formatSafeNumber(props.buffer_km, 1, '2.0');

          const popupTemplate = new PopupTemplate({
            title: `⛔ ${escapeHtml(t('map.restrictedPopupTitle', 'RESTRICTED MARINE BOUNDARY'))}`,
            content: `
              <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 220px; padding: 4px;">
                <div style="font-weight: 700; color: #16232E; margin-bottom: 3px; font-size: 12px;">
                  ${escapedTitle}
                </div>
                <div style="font-size: 11px; color: #5A6E7C; margin-bottom: 2px;">
                  ${escapeHtml(t('map.classification', 'Classification:'))} <strong style="color: #16232E;">${escapedType}</strong>
                </div>
                ${escapedState ? `<div style="font-size: 11px; color: #5A6E7C; margin-bottom: 2px;">${escapeHtml(t('map.jurisdiction', 'Jurisdiction:'))} ${escapedState}</div>` : ''}
                <div style="font-size: 11px; color: #C53030; font-weight: 600; margin-top: 6px; background: rgba(197, 48, 48, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(197, 48, 48, 0.3);">
                  ${escapeHtml(t('map.safetyBuffer', 'Mandatory Safety Buffer:'))} ${escapedBuffer} km
                </div>
              </div>
            `
          });

          const graphic = new Graphic({
            geometry: polygon,
            symbol,
            attributes: props,
            popupTemplate
          });

          restrictedZonesLayer.add(graphic);
        }
      }
    });

    // 5. User Device GPS Marker
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lon === 'number') {
      const point = new Point({
        longitude: userLocation.lon,
        latitude: userLocation.lat,
        spatialReference: { wkid: 4326 }
      });

      const symbol = new PictureMarkerSymbol({
        url: getUserGpsMarkerSvgDataUrl(),
        width: '36px',
        height: '36px'
      });

      const popupTemplate = new PopupTemplate({
        title: `📍 ${escapeHtml(t('map.gpsLocationPopup', 'Your GPS Location'))}`,
        content: `
          <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 180px; padding: 4px;">
            <div style="font-size: 11px; color: #5A6E7C; font-family: monospace;">
              Lat: <strong style="color: #16232E;">${userLocation.lat.toFixed(4)}°N</strong><br />
              Lon: <strong style="color: #16232E;">${userLocation.lon.toFixed(4)}°E</strong>
            </div>
            <div style="font-size: 10px; color: #1E7A4A; margin-top: 4px; font-weight: 600;">
              Active for subsequent inquiries
            </div>
          </div>
        `
      });

      const graphic = new Graphic({
        geometry: point,
        symbol,
        attributes: userLocation,
        popupTemplate
      });

      gpsLayer.add(graphic);
    }
  }, [mapLoaded, geojson, userLocation, t, onStartSimulation]);

  // Update Catalog Zones Layer and Toggle Visibility
  useEffect(() => {
    if (!mapLoaded || !layersRef.current.catalogZonesLayer) return;
    const { catalogZonesLayer } = layersRef.current;

    catalogZonesLayer.visible = showCatalogZones;

    if (showCatalogZones && deduplicatedCatalogZones?.features) {
      catalogZonesLayer.removeAll();

      deduplicatedCatalogZones.features.forEach((feature) => {
        const props = feature.properties || {};
        const geom = feature.geometry;
        if (!geom) return;

        const rings = geom.type === 'Polygon' ? geom.coordinates : (geom.coordinates ? geom.coordinates.flat(1) : []);
        if (rings && rings.length > 0) {
          const polygon = new Polygon({
            rings,
            spatialReference: { wkid: 4326 }
          });

          const symbol = new SimpleFillSymbol({
            color: [220, 38, 38, 0.22],
            outline: {
              color: [185, 28, 28, 0.9],
              width: 2
            }
          });

          const escapedTitle = escapeHtml(props.title || props.name || props.id || 'Restricted Marine Zone');
          const escapedType = escapeHtml(props.zone_type || props.type || 'Exclusion Perimeter');
          const escapedState = props.state ? escapeHtml(props.state) : '';
          const escapedBuffer = formatSafeNumber(props.buffer_km, 1, '2.0');

          const popupTemplate = new PopupTemplate({
            title: `⛔ ${escapeHtml(t('map.restrictedPopupTitle', 'RESTRICTED MARINE BOUNDARY'))}`,
            content: `
              <div style="font-family: Inter, sans-serif; font-size: 12px; color: #16232E; min-width: 220px; padding: 4px;">
                <div style="font-weight: 700; color: #16232E; margin-bottom: 3px; font-size: 12px;">
                  ${escapedTitle}
                </div>
                <div style="font-size: 11px; color: #5A6E7C; margin-bottom: 2px;">
                  ${escapeHtml(t('map.classification', 'Classification:'))} <strong style="color: #16232E;">${escapedType}</strong>
                </div>
                ${escapedState ? `<div style="font-size: 11px; color: #5A6E7C; margin-bottom: 2px;">${escapeHtml(t('map.jurisdiction', 'Jurisdiction:'))} ${escapedState}</div>` : ''}
                <div style="font-size: 11px; color: #C53030; font-weight: 600; margin-top: 6px; background: rgba(197, 48, 48, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(197, 48, 48, 0.3);">
                  ${escapeHtml(t('map.safetyBuffer', 'Mandatory Safety Buffer:'))} ${escapedBuffer} km
                </div>
              </div>
            `
          });

          const graphic = new Graphic({
            geometry: polygon,
            symbol,
            attributes: props,
            popupTemplate
          });

          catalogZonesLayer.add(graphic);
        }
      });
    }
  }, [mapLoaded, showCatalogZones, deduplicatedCatalogZones, t]);

  // Handle Advisory Bounds auto-fitting on query changes
  useEffect(() => {
    if (!mapLoaded || !viewRef.current) return;
    if (!mapBounds || !Array.isArray(mapBounds) || mapBounds.length !== 4) return;
    const [minLon, minLat, maxLon, maxLat] = mapBounds;
    if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) return;

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    try {
      const extent = new Extent({
        xmin: minLon,
        ymin: minLat,
        xmax: maxLon,
        ymax: maxLat,
        spatialReference: { wkid: 4326 }
      });
      viewRef.current.goTo(extent.expand(1.25), { duration: 800 }).catch((err) => {
        // Resilient fallback: center directly on calculated geographic midpoint
        if (viewRef.current) {
          viewRef.current.goTo({ center: [centerLon, centerLat], zoom: 9 }, { duration: 800 }).catch(() => {});
        }
      });
    } catch (e) {
      if (viewRef.current) {
        viewRef.current.goTo({ center: [centerLon, centerLat], zoom: 9 }, { duration: 800 }).catch(() => {});
      }
    }
  }, [mapLoaded, mapBounds, queryId]);

  // Action: Center on User GPS
  const handleCenterGps = useCallback(() => {
    if (!viewRef.current || !userLocation) return;
    viewRef.current.goTo(
      {
        center: [userLocation.lon, userLocation.lat],
        zoom: 10
      },
      { duration: 600 }
    ).catch(() => {});
  }, [userLocation]);

  // Action: Fit Advisory Bounds
  const handleFitAdvisoryBounds = useCallback(() => {
    if (!viewRef.current || !mapBounds || !Array.isArray(mapBounds) || mapBounds.length !== 4) return;
    const [minLon, minLat, maxLon, maxLat] = mapBounds;
    if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) return;

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    try {
      const extent = new Extent({
        xmin: minLon,
        ymin: minLat,
        xmax: maxLon,
        ymax: maxLat,
        spatialReference: { wkid: 4326 }
      });
      viewRef.current.goTo(extent.expand(1.25), { duration: 600 }).catch(() => {
        if (viewRef.current) {
          viewRef.current.goTo({ center: [centerLon, centerLat], zoom: 9 }, { duration: 600 }).catch(() => {});
        }
      });
    } catch (e) {
      if (viewRef.current) {
        viewRef.current.goTo({ center: [centerLon, centerLat], zoom: 9 }, { duration: 600 }).catch(() => {});
      }
    }
  }, [mapBounds]);

  // Summary counts for fallback display
  const pfzCount = useMemo(() => {
    return (geojson?.features || []).filter((f) => f.properties?.category === 'pfz' || String(f.id || '').startsWith('PFZ-')).length;
  }, [geojson]);

  const restrictedCount = useMemo(() => {
    return (geojson?.features || []).filter(
      (f) => f.properties?.category === 'restricted_zone' || String(f.id || '').startsWith('restricted-')
    ).length;
  }, [geojson]);

  const pfz1Props = useMemo(() => {
    const f1 = (geojson?.features || []).find((f) => (f.properties?.rank === 1 || f.properties?.is_recommended) && (f.properties?.category === 'pfz' || String(f.id || '').startsWith('PFZ-')));
    return f1?.properties || null;
  }, [geojson]);

  // Graceful Fallback UI if API Key is missing or initialization fails
  const hasKey = Boolean(arcgisApiKey && arcgisApiKey.trim().length > 0);
  const showFallback = !hasKey || Boolean(initError);

  if (showFallback) {
    return (
      <div className="map-viewport" role="region" aria-label="Interactive Maritime Geospatial Map">
        <div className="map-fallback-container">
          <div className="map-fallback-card">
            <div className="map-fallback-icon">
              <Compass size={28} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--marine-blue)', fontSize: '1.05rem', marginBottom: '4px' }}>
                ArcGIS Marine Geospatial Integration
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                {!hasKey
                  ? 'To view live ArcGIS marine oceans, bathymetry, coastlines, and navigation charts, configure your ArcGIS API key in .env:'
                  : `ArcGIS map initialization notice: ${initError}`}
              </p>
            </div>

            {!hasKey && (
              <div className="map-fallback-code">
                VITE_ARCGIS_API_KEY=your_arcgis_api_key_here
              </div>
            )}

            {/* Advisory Data Continuity Card: User still has access to all evaluated data */}
            {geojson && (
              <div
                style={{
                  width: '100%',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  fontSize: '0.76rem'
                }}
              >
                <div style={{ color: 'var(--marine-cyan)', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} /> Evaluated Query Geospatial Advisory
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', color: 'var(--text-secondary)' }}>
                  <div>Candidates Evaluated: <strong style={{ color: 'var(--marine-blue)' }}>{pfzCount || 4} Zones</strong></div>
                  <div>Restricted Boundaries: <strong style={{ color: 'var(--verdict-unsafe)' }}>{restrictedCount} Detected</strong></div>
                  {pfz1Props && (
                    <>
                      <div>Rank #1 Fish Density: <strong style={{ color: 'var(--verdict-safe)' }}>{formatSafeNumber(pfz1Props.fish_density_index, 1)}/10</strong></div>
                      <div>Distance Offshore: <strong style={{ color: 'var(--text-primary)' }}>{formatSafeNumber(pfz1Props.distance_km, 1)} km</strong></div>
                    </>
                  )}
                </div>

                {pfz1Props && onStartSimulation && (
                  <button
                    onClick={() => onStartSimulation(pfz1Props)}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      background: 'var(--marine-cyan)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 10px',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={12} fill="#ffffff" /> {t('map.start3dSimulation', '▶ Start 3D Simulation (PFZ #1)')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-viewport" role="region" aria-label="Interactive Maritime Geospatial Map">
      {/* ArcGIS MapView Container */}
      <div ref={mapContainerRef} className="orca-map-container" />

      {/* Floating Control Buttons */}
      <div className="map-floating-panel">
        <button
          onClick={() => setShowCatalogZones(!showCatalogZones)}
          className={`map-control-btn ${showCatalogZones ? 'active' : ''}`}
          title="Toggle nationwide restricted marine sanctuaries and naval defense zones catalog"
          aria-label="Toggle all restricted marine zones"
        >
          <ShieldAlert size={14} color={showCatalogZones ? 'var(--verdict-unsafe)' : 'var(--marine-cyan)'} />
          <span>{showCatalogZones ? t('map.hideAllZones', 'Hide Nationwide Zones') : t('map.showAllZones', 'Show All Restricted Zones')}</span>
        </button>

        {userLocation && (
          <button
            onClick={handleCenterGps}
            className="map-control-btn"
            title="Recenter map on your device GPS position"
            aria-label="Center on my GPS position"
          >
            <LocateFixed size={14} color="var(--marine-cyan)" />
            <span>{t('map.centerGps', 'Center on GPS')}</span>
          </button>
        )}

        {mapBounds && (
          <button
            onClick={handleFitAdvisoryBounds}
            className="map-control-btn"
            title="Fit map view to the current query advisory bounds"
            aria-label="Fit to advisory bounds"
          >
            <Navigation size={14} color="var(--marine-blue)" />
            <span>{t('map.fitBounds', 'Fit Advisory Bounds')}</span>
          </button>
        )}
      </div>

      {/* Map Legend */}
      <div className="map-legend" role="complementary" aria-label="Map Symbology Legend">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--marine-blue)', marginBottom: '4px', fontSize: '0.76rem' }}>
          {t('map.symbology', 'Geospatial Symbology')}
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#1B5E7A', border: '1.5px solid var(--border-medium)' }} />
          <span>{t('map.vesselOrigin', 'Vessel / Port Origin')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#1F7A6C', border: '1.5px solid var(--border-medium)' }} />
          <span>{t('map.pfz', 'Potential Fishing Zone (PFZ)')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" />
          <span>{t('map.navCourse', 'Nav Course Vector')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-rect" style={{ background: 'var(--verdict-unsafe-bg)', border: '1px solid var(--verdict-unsafe-border)' }} />
          <span>{t('map.restrictedZone', 'Restricted Sanctuary / Naval Zone')}</span>
        </div>
        {userLocation && (
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'var(--marine-cyan)', border: '1.5px solid #fff' }} />
            <span>{t('map.gpsBeacon', 'Your GPS Device Beacon')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
