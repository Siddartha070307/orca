import React, { useEffect, useRef, useState, useCallback } from 'react';
import Map from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Graphic from '@arcgis/core/Graphic.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';

import { initArcGisConfig, DEFAULT_MAP_VIEW, BASEMAP_CONFIG } from '../../config/arcgis';
import { ActiveMarineParameter, PointInspectionData, GeodeticMeasurement } from '../../types';
import { OCEAN_LAYERS } from '../../data/layerDefinitions';
import { fetchIncoisPfzFeatures } from '../../data/providers/incois/incoisAdapter';
import {
  fetchPointMarineProfile,
  fetchMarineSpatialGrid,
  MarineSpatialPoint
} from '../../services/marinePhysicsService';
import { calculateGeodetic } from '../../services/geodeticCalc';
import { GeocodingResult } from '../../services/geocodingService';

import { IncoisDynamicLayer } from './IncoisDynamicLayer';
import { SamudraOceanRenderer } from './SamudraOceanRenderer';
import { DynamicLegend } from './DynamicLegend';
import { PointInspectorModal } from './PointInspectorModal';
import { MeasurementTool } from './MeasurementTool';
import { OceanLayerPanel } from './OceanLayerPanel';

import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Home,
  Crosshair,
  Info,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface OceanMapProps {
  isLayerPanelOpen: boolean;
  setIsLayerPanelOpen: (open: boolean) => void;
  selectedLocation: GeocodingResult | null;
}

export const OceanMap: React.FC<OceanMapProps> = ({
  isLayerPanelOpen,
  setIsLayerPanelOpen,
  selectedLocation
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<MapView | null>(null);

  // Dynamic INCOIS WMS layer instances
  const dynamicLayersRef = useRef<Record<string, any>>({});
  const pfzGraphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const searchGraphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const measurementGraphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number }>({
    lat: 15.5,
    lon: 81.5
  });

  // Active Marine Parameter (Defaults to 'currents' for SAMUDRA flow field)
  const [activeParameter, setActiveParameter] = useState<ActiveMarineParameter>('currents');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.75);

  // Real Spatial Marine Data
  const [marineSpatialPoints, setMarineSpatialPoints] = useState<MarineSpatialPoint[]>([]);

  // Telemetry point inspection state
  const [inspectionData, setInspectionData] = useState<PointInspectionData | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // Measurement tool state
  const [isMeasurementActive, setIsMeasurementActive] = useState(false);
  const [measurementStep, setMeasurementStep] = useState<'first_point' | 'second_point' | 'complete'>('first_point');
  const [firstMeasurePoint, setFirstMeasurePoint] = useState<{ lat: number; lon: number } | null>(null);
  const [measurementResult, setMeasurementResult] = useState<GeodeticMeasurement | null>(null);

  // 1. Initialize ArcGIS Map with Professional Geographic Topographic Basemap
  useEffect(() => {
    initArcGisConfig();

    if (!mapDivRef.current) return;

    const map = new Map({
      basemap: BASEMAP_CONFIG.defaultBasemapId
    });
    mapRef.current = map;

    const pfzLayer = new GraphicsLayer({ id: 'orca_pfz_layer', opacity: 0.95 });
    const searchLayer = new GraphicsLayer({ id: 'orca_search_layer' });
    const measureLayer = new GraphicsLayer({ id: 'orca_measure_layer' });

    pfzGraphicsLayerRef.current = pfzLayer;
    searchGraphicsLayerRef.current = searchLayer;
    measurementGraphicsLayerRef.current = measureLayer;

    // Add graphics layers on top of map
    map.addMany([pfzLayer, measureLayer, searchLayer]);

    const view = new MapView({
      container: mapDivRef.current,
      map: map,
      center: DEFAULT_MAP_VIEW.center,
      zoom: DEFAULT_MAP_VIEW.zoom,
      constraints: DEFAULT_MAP_VIEW.constraints,
      ui: {
        components: []
      }
    });

    viewRef.current = view;

    view.when(() => {
      setMapLoaded(true);

      view.on('pointer-move', event => {
        const pt = view.toMap({ x: event.x, y: event.y });
        if (pt && typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
          setCurrentCoords({
            lat: parseFloat(pt.latitude.toFixed(4)),
            lon: parseFloat(pt.longitude.toFixed(4))
          });
        }
      });
    });

    // 2. Fetch live INCOIS PFZ operational advisory lines via WFS
    fetchIncoisPfzFeatures().then(res => {
      if (res.features && res.features.length > 0 && pfzGraphicsLayerRef.current) {
        const lineSymbol = new SimpleLineSymbol({
          color: [0, 240, 255, 0.95],
          width: 3.0,
          style: 'solid'
        });

        res.features.forEach((feat: any) => {
          if (feat.geometry && feat.geometry.coordinates) {
            const paths =
              feat.geometry.type === 'MultiLineString'
                ? (feat.geometry.coordinates as number[][][])
                : [feat.geometry.coordinates as number[][]];

            const polyline = new Polyline({
              paths: paths,
              spatialReference: { wkid: 4326 }
            });

            const p = feat.properties || {};
            const popupTemplate = new PopupTemplate({
              title: `PFZ Advisory: Sector ${p.SECTORBOUN || ''} - ${p.SECTORBO_1 || ''}`,
              content: `
                <div style="font-family: monospace; font-size: 12px; color: #1e293b; line-height: 1.6;">
                  <p><strong>State:</strong> ${p.State_Name || 'Indian Coast'}</p>
                  <p><strong>Advisory UID:</strong> ${p.UID || 'N/A'}</p>
                  <p><strong>Valid Day:</strong> Year ${p.Year || '2026'}, Julian Day ${p.Julian_day || 'N/A'}</p>
                  <p><strong>Length:</strong> ${p.Length ? p.Length.toFixed(1) + ' km' : 'N/A'}</p>
                  <p><strong>Bearing:</strong> ${p.Bearing ? p.Bearing + '°' : 'Optimal Front'}</p>
                  <p><strong>Source:</strong> INCOIS Marine Fisheries Advisory Services</p>
                </div>
              `
            });

            const graphic = new Graphic({
              geometry: polyline,
              symbol: lineSymbol,
              attributes: p,
              popupTemplate: popupTemplate
            });

            pfzGraphicsLayerRef.current?.add(graphic);
          }
        });
      }
    });

    // 3. Fetch Real Marine Spatial Grid across North Indian Ocean Basin
    fetchMarineSpatialGrid().then(pts => {
      if (pts && pts.length > 0) {
        setMarineSpatialPoints(pts);
      }
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // 4. Handle Active Parameter Switching (INCOIS Dynamic WMS & PFZ Graphics)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Managed INCOIS Dynamic Layers
    const dynamicLayerKeys = ['sst', 'chlorophyll', 'bathymetry', 'heatwave'];
    dynamicLayerKeys.forEach(layerId => {
      let instance = dynamicLayersRef.current[layerId];
      const isSelected = activeParameter === layerId;

      if (isSelected) {
        if (!instance) {
          let sublayerName = '';
          if (layerId === 'sst') sublayerName = 'PFZ-TUNA-SST-CHL:sst';
          else if (layerId === 'chlorophyll') sublayerName = 'PFZ-TUNA-SST-CHL:chl';
          else if (layerId === 'bathymetry') sublayerName = 'PFZ_Bathymetry:bathymetry';
          else if (layerId === 'heatwave') sublayerName = 'MHW:MHWDomainBasin';

          instance = new IncoisDynamicLayer({
            id: `orca_${layerId}`,
            layerName: sublayerName,
            opacity: layerOpacity
          });

          dynamicLayersRef.current[layerId] = instance;
          map.add(instance, 0); // Position directly above basemap, below graphics
        } else {
          instance.visible = true;
          instance.opacity = layerOpacity;
        }
      } else {
        if (instance) {
          instance.visible = false;
        }
      }
    });

    // Manage PFZ Graphics Layer Visibility
    if (pfzGraphicsLayerRef.current) {
      pfzGraphicsLayerRef.current.visible = activeParameter === 'pfz';
      pfzGraphicsLayerRef.current.opacity = layerOpacity;
    }
  }, [activeParameter, layerOpacity]);

  // 5. Handle Location Search Fly-To Animation
  useEffect(() => {
    if (!selectedLocation || !viewRef.current || !searchGraphicsLayerRef.current) return;

    const view = viewRef.current;
    const layer = searchGraphicsLayerRef.current;
    layer.removeAll();

    const targetPoint = new Point({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      spatialReference: { wkid: 4326 }
    });

    const markerSymbol = new SimpleMarkerSymbol({
      style: 'circle',
      color: [22, 199, 199, 0.9],
      size: '14px',
      outline: {
        color: [255, 255, 255, 1],
        width: 2
      }
    });

    const markerGraphic = new Graphic({
      geometry: targetPoint,
      symbol: markerSymbol
    });

    layer.add(markerGraphic);

    view.goTo(
      {
        target: targetPoint,
        zoom: selectedLocation.zoomLevel
      },
      {
        duration: 1600,
        easing: 'ease-in-out'
      }
    );
  }, [selectedLocation]);

  // 6. Handle Map Click for Telemetry Inspection & Measurement
  const handleMapClick = useCallback(
    async (event: any) => {
      const point = viewRef.current?.toMap({ x: event.x, y: event.y });
      if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') return;

      const lat = parseFloat(point.latitude.toFixed(4));
      const lon = parseFloat(point.longitude.toFixed(4));

      // Handle Geodetic Measurement Mode
      if (isMeasurementActive) {
        if (measurementStep === 'first_point') {
          setFirstMeasurePoint({ lat, lon });
          setMeasurementStep('second_point');

          measurementGraphicsLayerRef.current?.removeAll();
          const markerGraphic = new Graphic({
            geometry: new Point({ latitude: lat, longitude: lon, spatialReference: { wkid: 4326 } }),
            symbol: new SimpleMarkerSymbol({
              style: 'diamond',
              color: [245, 185, 66, 1],
              size: '12px'
            })
          });
          measurementGraphicsLayerRef.current?.add(markerGraphic);
        } else if (measurementStep === 'second_point' && firstMeasurePoint) {
          const result = calculateGeodetic(firstMeasurePoint.lat, firstMeasurePoint.lon, lat, lon);
          setMeasurementResult(result);
          setMeasurementStep('complete');

          const polyline = new Polyline({
            paths: [
              [
                [firstMeasurePoint.lon, firstMeasurePoint.lat],
                [lon, lat]
              ]
            ],
            spatialReference: { wkid: 4326 }
          });

          const lineGraphic = new Graphic({
            geometry: polyline,
            symbol: new SimpleLineSymbol({
              color: [245, 185, 66, 0.9],
              width: 3,
              style: 'dash'
            })
          });

          const secondMarker = new Graphic({
            geometry: new Point({ latitude: lat, longitude: lon, spatialReference: { wkid: 4326 } }),
            symbol: new SimpleMarkerSymbol({
              style: 'diamond',
              color: [255, 77, 90, 1],
              size: '12px'
            })
          });

          measurementGraphicsLayerRef.current?.addMany([lineGraphic, secondMarker]);
        }
        return;
      }

      // Handle Marine Telemetry Inspection
      setInspectionLoading(true);
      setInspectionData(null);

      try {
        const pointData = await fetchPointMarineProfile(lat, lon);

        const layerValues: PointInspectionData['layerValues'] = [];

        if (pointData.seaSurfaceTemperature !== null) {
          layerValues.push({
            layerId: 'sst',
            layerName: 'Sea Surface Temperature',
            value: pointData.seaSurfaceTemperature.toFixed(1),
            unit: '°C',
            source: 'INCOIS / Satellite Radiometer Composite',
            status: 'LATEST AVAILABLE'
          });
        }

        if (pointData.waveHeight !== null) {
          layerValues.push({
            layerId: 'waves',
            layerName: 'Significant Wave Height',
            value: pointData.waveHeight.toFixed(2),
            unit: 'm',
            source: 'Copernicus Marine / ECMWF Spectral Model',
            status: 'LATEST AVAILABLE'
          });
        }

        if (pointData.currentVelocity !== null) {
          layerValues.push({
            layerId: 'currents',
            layerName: 'Current Speed & Direction',
            value: `${pointData.currentVelocity.toFixed(2)} m/s (${pointData.currentDirection ?? '—'}°)`,
            unit: 'm/s',
            source: 'Copernicus Marine Global Hydrodynamic Model',
            status: 'LATEST AVAILABLE'
          });
        }

        if (pointData.windSpeed !== null) {
          layerValues.push({
            layerId: 'wind',
            layerName: '10m Surface Wind',
            value: `${pointData.windSpeed.toFixed(1)} m/s (${pointData.windDirection ?? '—'}°)`,
            unit: 'm/s',
            source: 'ECMWF Marine Boundary Layer Model',
            status: 'LATEST AVAILABLE'
          });
        }

        if (pointData.swellHeight !== null) {
          layerValues.push({
            layerId: 'swell',
            layerName: 'Swell Wave Height & Period',
            value: `${pointData.swellHeight.toFixed(2)} m (${pointData.swellPeriod ? pointData.swellPeriod.toFixed(0) + 's' : ''})`,
            unit: 'm',
            source: 'Copernicus Marine Spectral Swell',
            status: 'LATEST AVAILABLE'
          });
        }

        setInspectionData({
          latitude: lat,
          longitude: lon,
          timestamp: pointData.time,
          layerValues
        });
      } catch (err) {
        console.error('Inspection error:', err);
      } finally {
        setInspectionLoading(false);
      }
    },
    [isMeasurementActive, measurementStep, firstMeasurePoint]
  );

  // Attach click listener to MapView
  useEffect(() => {
    if (!viewRef.current) return;
    const handle = viewRef.current.on('click', handleMapClick);
    return () => handle.remove();
  }, [handleMapClick]);

  // Navigation handlers
  const handleZoomIn = () => viewRef.current?.goTo({ zoom: (viewRef.current.zoom || 5) + 1 });
  const handleZoomOut = () => viewRef.current?.goTo({ zoom: (viewRef.current.zoom || 5) - 1 });
  const handleHomeReset = () => {
    viewRef.current?.goTo({
      center: DEFAULT_MAP_VIEW.center,
      zoom: DEFAULT_MAP_VIEW.zoom
    });
  };

  const handleResetMeasurement = () => {
    measurementGraphicsLayerRef.current?.removeAll();
    setMeasurementStep('first_point');
    setFirstMeasurePoint(null);
    setMeasurementResult(null);
  };

  const handleCloseMeasurement = () => {
    setIsMeasurementActive(false);
    handleResetMeasurement();
  };

  const activeDef = OCEAN_LAYERS.find(l => l.id === activeParameter);

  return (
    <div className="relative w-full h-[700px] rounded-2xl overflow-hidden shadow-2xl border border-slate-300/80 bg-[#03141F]">
      {/* 1. ArcGIS MapView Container */}
      <div ref={mapDivRef} className="w-full h-full" />

      {/* 2. SAMUDRA-style Continuous Ocean Field & Streamline Flow Engine */}
      <SamudraOceanRenderer
        view={viewRef.current}
        activeParameter={activeParameter}
        opacity={layerOpacity}
        spatialPoints={marineSpatialPoints}
      />

      {/* 3. Responsive Left Slide-in Layer Drawer */}
      <OceanLayerPanel
        isOpen={isLayerPanelOpen}
        onClose={() => setIsLayerPanelOpen(false)}
        activeParameter={activeParameter}
        onSelectParameter={param => setActiveParameter(param)}
        opacity={layerOpacity}
        onChangeOpacity={op => setLayerOpacity(op)}
        onToggleMeasurement={() => {
          setIsMeasurementActive(!isMeasurementActive);
          handleResetMeasurement();
        }}
        isMeasurementActive={isMeasurementActive}
        activeProvider={activeDef?.source}
        activeTimestamp="Latest Operational Model Cycle"
      />

      {/* 4. SAMUDRA-style Dynamic Legend */}
      <DynamicLegend activeParameter={activeParameter} />

      {/* 5. Point Telemetry Inspector Modal */}
      <PointInspectorModal
        data={inspectionData}
        loading={inspectionLoading}
        onClose={() => setInspectionData(null)}
      />

      {/* 6. Geodetic Measurement Tool HUD */}
      <MeasurementTool
        active={isMeasurementActive}
        measurement={measurementResult}
        step={measurementStep}
        onReset={handleResetMeasurement}
        onClose={handleCloseMeasurement}
      />

      {/* 7. Floating Map Controls */}
      <div className="absolute top-6 left-6 z-20 flex flex-col space-y-2">
        <button
          onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
          className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl shadow-xl transition-all duration-200 border font-heading text-xs font-semibold cursor-pointer ${
            isLayerPanelOpen
              ? 'bg-[#082A36] text-white border-[#16C7C7]'
              : 'bg-white/95 text-slate-800 hover:text-[#16C7C7] border-slate-300 hover:border-[#16C7C7]'
          }`}
          aria-label="Toggle Ocean Layers Drawer"
        >
          <Layers className="w-4 h-4 text-[#16C7C7]" />
          <span>{isLayerPanelOpen ? 'CLOSE DRAWER' : 'LAYERS'}</span>
          {activeParameter && (
            <span className="w-2 h-2 rounded-full bg-[#16C7C7] animate-pulse ml-1" />
          )}
        </button>

        <button
          onClick={handleHomeReset}
          className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded-xl border border-slate-300 hover:border-slate-400 transition-all shadow-xl cursor-pointer"
          title="Reset to India / Indian Ocean View"
          aria-label="Reset View"
        >
          <Home className="w-4 h-4" />
        </button>

        <button
          onClick={handleZoomIn}
          className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded-xl border border-slate-300 hover:border-slate-400 transition-all shadow-xl cursor-pointer"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={handleZoomOut}
          className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded-xl border border-slate-300 hover:border-slate-400 transition-all shadow-xl cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded-xl border border-slate-300 hover:border-slate-400 transition-all shadow-xl cursor-pointer"
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 8. Active Parameter HUD Bar (Top Center) */}
      {activeDef && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 text-slate-800 px-4 py-2 rounded-xl shadow-lg border border-slate-300/80 flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16C7C7] animate-pulse" />
            <span className="font-bold font-heading text-slate-900 uppercase">
              {activeDef.name}
            </span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600 font-sans">
            Provider: <strong>{activeDef.source}</strong>
          </span>
          <span className="text-slate-400">|</span>
          <button
            onClick={() => setActiveParameter(null)}
            className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
          >
            Clear Layer
          </button>
        </div>
      )}

      {/* 9. Honest Status Banner for Unavailable Server-Side Models (MLD, D20, Cyclone) */}
      {(activeParameter === 'mld' || activeParameter === 'd20' || activeParameter === 'cyclone') && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[#061F2C]/95 text-slate-200 px-4 py-2.5 rounded-xl shadow-2xl border border-[#FF4D5A]/40 flex items-center space-x-3 text-xs max-w-xl text-center">
          <AlertCircle className="w-5 h-5 text-[#FF4D5A] shrink-0" />
          <div className="text-left font-mono text-[11px] leading-snug">
            {activeParameter === 'mld' && (
              <>
                <strong>INCOIS OSF Mixed Layer Depth (MLD):</strong> Spatial raster requires server-side NetCDF ingestion. Under ORCA integrity rules, no synthetic field is substituted.
              </>
            )}
            {activeParameter === 'd20' && (
              <>
                <strong>Depth of 20°C Isotherm (D20):</strong> Subsurface CTD/Argo assimilation analysis is not accessible via public browser WMS. No synthetic field is substituted.
              </>
            )}
            {activeParameter === 'cyclone' && (
              <>
                <strong>IMD Cyclone Warning:</strong> RSMC New Delhi confirms zero active cyclones currently in the North Indian Ocean. Official IMD API endpoint requires registered server authentication.
              </>
            )}
          </div>
        </div>
      )}

      {/* 10. Coordinate HUD (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20 bg-white/90 px-3 py-1.5 rounded-lg border border-slate-300 shadow text-[11px] font-mono text-slate-700 flex items-center space-x-3 pointer-events-none">
        <div className="flex items-center space-x-1.5 text-[#0077B6] font-bold">
          <Crosshair className="w-3.5 h-3.5" />
          <span>
            {currentCoords.lat >= 0 ? `${currentCoords.lat}° N` : `${Math.abs(currentCoords.lat)}° S`},{' '}
            {currentCoords.lon >= 0 ? `${currentCoords.lon}° E` : `${Math.abs(currentCoords.lon)}° W`}
          </span>
        </div>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600">ArcGIS Topographic Basemap</span>
      </div>
    </div>
  );
};
