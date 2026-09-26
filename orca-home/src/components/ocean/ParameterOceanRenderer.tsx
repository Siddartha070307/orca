import React, { useEffect, useRef } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import Point from '@arcgis/core/geometry/Point.js';
import { MarineSpatialPoint } from '../../services/marinePhysicsService';
import { ActiveMarineParameter } from '../../types';

interface ParameterOceanRendererProps {
  view: MapView | null;
  activeParameter: ActiveMarineParameter;
  opacity: number;
  spatialPoints: MarineSpatialPoint[];
}

export const ParameterOceanRenderer: React.FC<ParameterOceanRendererProps> = ({
  view,
  activeParameter,
  opacity,
  spatialPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!view || !activeParameter || spatialPoints.length === 0) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Parameters handled by ArcGIS WMS/WFS layers (SST, Chlorophyll, PFZ, Bathymetry)
    // do not need canvas scalar rendering, so canvas clears
    if (
      activeParameter === 'sst' ||
      activeParameter === 'chlorophyll' ||
      activeParameter === 'pfz' ||
      activeParameter === 'bathymetry'
    ) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      if (!canvas || !view.container) return;
      canvas.width = view.container.clientWidth;
      canvas.height = view.container.clientHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Project marine geographic points to screen coordinates
      const projected = spatialPoints
        .map(pt => {
          const geom = new Point({
            latitude: pt.lat,
            longitude: pt.lon,
            spatialReference: { wkid: 4326 }
          });
          const screen = view.toScreen(geom);
          if (!screen) return null;
          return {
            x: screen.x,
            y: screen.y,
            data: pt
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (projected.length === 0) return;

      // 1. RENDER SIGNIFICANT WAVE HEIGHT OVERLAY
      if (activeParameter === 'waves') {
        projected.forEach(p => {
          const h = p.data.waveHeight;
          const radius = Math.max(70, Math.min(180, 90 * (view.zoom / 5)));

          // Scientific color palette for wave height (m)
          // 0.5 - 1.2m: Cyan/Teal calm
          // 1.2 - 2.0m: Blue-amber moderate
          // 2.0m+: Orange-red rough sea
          let colorStop0 = 'rgba(40, 215, 229, 0.45)';
          let colorStop1 = 'rgba(22, 199, 199, 0.15)';
          if (h > 2.0) {
            colorStop0 = 'rgba(255, 77, 90, 0.5)';
            colorStop1 = 'rgba(245, 185, 66, 0.15)';
          } else if (h > 1.4) {
            colorStop0 = 'rgba(245, 185, 66, 0.45)';
            colorStop1 = 'rgba(40, 215, 229, 0.15)';
          }

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          grad.addColorStop(0, colorStop0);
          grad.addColorStop(0.7, colorStop1);
          grad.addColorStop(1, 'rgba(3, 20, 31, 0)');

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Wave crest ripple indicator
          ctx.strokeStyle = h > 1.8 ? 'rgba(255, 77, 90, 0.6)' : 'rgba(40, 215, 229, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const rippleR = 15 + ((frame * 0.4) % 30);
          ctx.arc(p.x, p.y, rippleR, 0, Math.PI * 2);
          ctx.stroke();

          // Wave Height Value Badge
          ctx.fillStyle = 'rgba(3, 20, 31, 0.75)';
          ctx.fillRect(p.x - 22, p.y - 10, 44, 20);
          ctx.strokeStyle = 'rgba(40, 215, 229, 0.5)';
          ctx.strokeRect(p.x - 22, p.y - 10, 44, 20);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${h.toFixed(1)}m`, p.x, p.y);
          ctx.restore();
        });
      }

      // 2. RENDER SWELL HEIGHT & PROPAGATION OVERLAY
      if (activeParameter === 'swell') {
        projected.forEach(p => {
          const sw = p.data.swellHeight;
          const dir = p.data.swellDirection;
          const radius = Math.max(70, Math.min(180, 90 * (view.zoom / 5)));

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          grad.addColorStop(0, 'rgba(0, 119, 182, 0.5)');
          grad.addColorStop(0.7, 'rgba(72, 202, 228, 0.2)');
          grad.addColorStop(1, 'rgba(3, 20, 31, 0)');

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Swell Direction Vector Arrow
          const arrowLen = 28;
          const rad = (dir * Math.PI) / 180;
          const dx = arrowLen * Math.sin(rad);
          const dy = -arrowLen * Math.cos(rad); // Screen Y is inverted

          ctx.strokeStyle = '#48CAE4';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();

          // Arrow head
          const headAngle = Math.atan2(dy, dx);
          ctx.fillStyle = '#ADE8F4';
          ctx.beginPath();
          ctx.moveTo(p.x + dx, p.y + dy);
          ctx.lineTo(
            p.x + dx - 8 * Math.cos(headAngle - Math.PI / 6),
            p.y + dy - 8 * Math.sin(headAngle - Math.PI / 6)
          );
          ctx.lineTo(
            p.x + dx - 8 * Math.cos(headAngle + Math.PI / 6),
            p.y + dy - 8 * Math.sin(headAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          // Swell value label
          ctx.fillStyle = 'rgba(2, 62, 138, 0.85)';
          ctx.fillRect(p.x - 26, p.y + 14, 52, 18);
          ctx.strokeStyle = '#48CAE4';
          ctx.strokeRect(p.x - 26, p.y + 14, 52, 18);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${sw.toFixed(1)}m (${p.data.swellPeriod}s)`, p.x, p.y + 23);
          ctx.restore();
        });
      }

      // 3. RENDER 10M SURFACE MARINE WIND OVERLAY
      if (activeParameter === 'wind') {
        projected.forEach(p => {
          const spd = p.data.windSpeed;
          const dir = p.data.windDirection;
          const radius = Math.max(70, Math.min(180, 95 * (view.zoom / 5)));

          // Beaufort speed color
          let color0 = 'rgba(6, 182, 212, 0.4)';
          let color1 = 'rgba(2, 132, 199, 0.15)';
          if (spd > 12) {
            color0 = 'rgba(239, 68, 68, 0.5)';
            color1 = 'rgba(245, 158, 11, 0.15)';
          } else if (spd > 7) {
            color0 = 'rgba(16, 185, 129, 0.45)';
            color1 = 'rgba(6, 182, 212, 0.15)';
          }

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          grad.addColorStop(0, color0);
          grad.addColorStop(0.7, color1);
          grad.addColorStop(1, 'rgba(3, 20, 31, 0)');

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();

          // Wind Arrow pointing in meteorological direction (from which wind blows to where it goes)
          const rad = (dir * Math.PI) / 180;
          const arrowLen = 30;
          const dx = arrowLen * Math.sin(rad);
          const dy = -arrowLen * Math.cos(rad);

          ctx.strokeStyle = '#F1F5F9';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(dy, dx);
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.moveTo(p.x + dx, p.y + dy);
          ctx.lineTo(
            p.x + dx - 8 * Math.cos(angle - Math.PI / 6),
            p.y + dy - 8 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            p.x + dx - 8 * Math.cos(angle + Math.PI / 6),
            p.y + dy - 8 * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          // Wind Speed Label
          ctx.fillStyle = 'rgba(3, 20, 31, 0.8)';
          ctx.fillRect(p.x - 26, p.y + 14, 52, 18);
          ctx.strokeStyle = '#38BDF8';
          ctx.strokeRect(p.x - 26, p.y + 14, 52, 18);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${spd.toFixed(1)} m/s`, p.x, p.y + 23);
          ctx.restore();
        });
      }

      frame++;
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    const extentWatcher = view.watch('extent', () => {
      // Re-render when extent changes
      render();
    });

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      extentWatcher.remove();
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [view, activeParameter, opacity, spatialPoints]);

  if (!activeParameter) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
