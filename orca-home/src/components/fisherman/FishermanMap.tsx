import React, { useEffect, useRef } from 'react';
import Map from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Graphic from '@arcgis/core/Graphic.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import Circle from '@arcgis/core/geometry/Circle.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';

import { BASEMAP_CONFIG } from '../../config/arcgis';
import { FishingSession } from '../../types/fisherman';
import { Ship, Radio, MapPin, Compass, Play } from 'lucide-react';

interface FishermanMapProps {
  session: FishingSession;
  onAdvanceSimulation?: () => void;
}

export const FishermanMap: React.FC<FishermanMapProps> = ({
  session,
  onAdvanceSimulation
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapDivRef.current) return;

    const map = new Map({
      basemap: BASEMAP_CONFIG.defaultBasemapId
    });

    const graphicsLayer = new GraphicsLayer({ id: 'fisherman_tracking_layer' });
    graphicsLayerRef.current = graphicsLayer;
    map.add(graphicsLayer);

    const view = new MapView({
      container: mapDivRef.current,
      map: map,
      center: [session.currentLocation.lon, session.currentLocation.lat],
      zoom: 10,
      ui: { components: ['zoom'] }
    });

    viewRef.current = view;

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // Update graphics when session location or track changes
  useEffect(() => {
    if (!graphicsLayerRef.current || !viewRef.current) return;
    const layer = graphicsLayerRef.current;
    layer.removeAll();

    const { currentLocation, departureLocation, currentTrack, vesselName, fishermanName, sessionId } = session;

    // 1. Departure Harbour Marker & Geofence Buffer (5 km)
    const depPoint = new Point({
      latitude: departureLocation.lat,
      longitude: departureLocation.lon,
      spatialReference: { wkid: 4326 }
    });

    const depSymbol = new SimpleMarkerSymbol({
      style: 'circle',
      color: [0, 135, 90, 0.9],
      size: '14px',
      outline: { color: [255, 255, 255, 1], width: 2 }
    });

    const depGraphic = new Graphic({
      geometry: depPoint,
      symbol: depSymbol,
      popupTemplate: new PopupTemplate({
        title: `Departure: ${session.departureHarbour}`,
        content: `Base harbour landing geofence. Departed at ${session.departureTime}.`
      })
    });

    // Geofence Circle (5000 meters)
    const geofenceCircle = new Circle({
      center: depPoint,
      radius: 5000,
      geodesic: true
    });

    const geofenceGraphic = new Graphic({
      geometry: geofenceCircle,
      symbol: new SimpleFillSymbol({
        color: [0, 135, 90, 0.12],
        outline: { color: [0, 135, 90, 0.6], width: 1.5, style: 'dash' }
      })
    });

    layer.addMany([geofenceGraphic, depGraphic]);

    // 2. Vessel Track Trajectory Polyline
    if (currentTrack.length > 1) {
      const lineCoords = currentTrack.map(pt => [pt.lon, pt.lat]);
      const polyline = new Polyline({
        paths: [lineCoords],
        spatialReference: { wkid: 4326 }
      });

      const trackLineGraphic = new Graphic({
        geometry: polyline,
        symbol: new SimpleLineSymbol({
          color: [22, 199, 199, 0.9],
          width: 3.5,
          style: 'solid'
        })
      });

      layer.add(trackLineGraphic);
    }

    // 3. Intended PFZ Fishing Area Graphic
    const pfzPoint = new Point({
      latitude: 16.02,
      longitude: 81.42,
      spatialReference: { wkid: 4326 }
    });

    const pfzSymbol = new SimpleMarkerSymbol({
      style: 'diamond',
      color: [245, 185, 66, 0.95],
      size: '16px',
      outline: { color: [255, 255, 255, 1], width: 2 }
    });

    const pfzGraphic = new Graphic({
      geometry: pfzPoint,
      symbol: pfzSymbol,
      popupTemplate: new PopupTemplate({
        title: 'INCOIS PFZ Optimal Fishing Front',
        content: 'Sector 6/7 thermal-chlorophyll convergence zone. Bearing 118° ESE.'
      })
    });

    layer.add(pfzGraphic);

    // 4. Current Active Vessel Marker
    const vesselPoint = new Point({
      latitude: currentLocation.lat,
      longitude: currentLocation.lon,
      spatialReference: { wkid: 4326 }
    });

    const vesselSymbol = new SimpleMarkerSymbol({
      style: 'circle',
      color: [255, 77, 90, 0.95],
      size: '18px',
      outline: { color: [255, 255, 255, 1], width: 3 }
    });

    const vesselGraphic = new Graphic({
      geometry: vesselPoint,
      symbol: vesselSymbol,
      popupTemplate: new PopupTemplate({
        title: `🚢 ${vesselName} (${session.vesselId})`,
        content: `
          <div style="font-family: monospace; font-size: 11px; line-height: 1.6; color: #0f172a;">
            <p><strong>Master:</strong> ${fishermanName}</p>
            <p><strong>Session:</strong> ${sessionId}</p>
            <p><strong>Location:</strong> ${currentLocation.lat.toFixed(4)}° N, ${currentLocation.lon.toFixed(4)}° E</p>
            <p><strong>Distance from Port:</strong> ${session.distanceFromDepartureKm.toFixed(1)} km</p>
            <p><strong>Status:</strong> ${session.status}</p>
          </div>
        `
      })
    });

    layer.add(vesselGraphic);

    // Pan camera to follow vessel
    viewRef.current.goTo(
      { target: vesselPoint, zoom: 10 },
      { duration: 800 }
    );
  }, [session]);

  return (
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-[#03141F]">
      {/* Map View Container */}
      <div ref={mapDivRef} className="w-full h-full" />

      {/* Top Floating HUD: Provider Status & Step Simulation Button */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-white/95 text-slate-800 border border-slate-300 shadow-lg text-xs font-mono flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#F5B942] animate-pulse" />
          <span className="font-bold text-slate-900">🟡 DEMO TRACKING MODE</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">NavIC Simulation</span>
        </div>

        {onAdvanceSimulation && (
          <button
            type="button"
            onClick={onAdvanceSimulation}
            className="px-3 py-1.5 rounded-xl bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 border border-[#16C7C7] shadow-lg text-xs font-heading font-bold flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Advance simulated vessel to next route waypoint"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Step Vessel Waypoint</span>
          </button>
        )}
      </div>

      {/* Bottom Floating Legend HUD */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-xl bg-white/95 border border-slate-300 shadow-lg text-[10px] font-mono text-slate-700 flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 border border-white" />
          <span>Active Vessel</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white" />
          <span>Landing Port</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rotate-45 bg-amber-500 border border-white" />
          <span>Target PFZ</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-0.5 bg-[#16C7C7]" />
          <span>Route Track</span>
        </div>
      </div>
    </div>
  );
};
