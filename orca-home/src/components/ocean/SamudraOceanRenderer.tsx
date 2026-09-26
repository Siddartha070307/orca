import React, { useEffect, useRef } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import Point from '@arcgis/core/geometry/Point.js';
import { MarinePhysicsPoint } from '../../data/providers/openmeteo/openmeteoAdapter';
import { COASTAL_ALERT_SECTORS, THREAT_COLORS } from '../../data/coastalAlertSegments';
import { INDIA_LAND_POLYGONS } from '../../data/landPolygon';
import { ActiveMarineParameter } from '../../types';

interface SamudraOceanRendererProps {
  view: MapView | null;
  activeParameter: ActiveMarineParameter;
  opacity: number;
  spatialPoints: MarinePhysicsPoint[];
}

// Exact SAMUDRA Significant Wave Height & Swell Color Palette (0 to >=12m)
function getSamudraWaveColor(h: number, alpha: number): string {
  if (h <= 0.5) return `rgba(0, 204, 204, ${alpha})`;      // Teal / Cyan
  if (h <= 1.0) return `rgba(0, 85, 255, ${alpha})`;       // Deep Blue
  if (h <= 1.5) return `rgba(51, 119, 255, ${alpha})`;     // Medium Blue
  if (h <= 2.0) return `rgba(170, 119, 255, ${alpha})`;    // Lavender
  if (h <= 2.5) return `rgba(170, 51, 221, ${alpha})`;     // Vivid Purple
  if (h <= 3.0) return `rgba(136, 0, 153, ${alpha})`;      // Deep Magenta
  if (h <= 4.0) return `rgba(204, 34, 51, ${alpha})`;      // Crimson / Brick Red
  if (h <= 5.0) return `rgba(255, 17, 34, ${alpha})`;      // Bright Red
  if (h <= 7.0) return `rgba(255, 136, 170, ${alpha})`;    // Rose / Pink
  if (h <= 10.0) return `rgba(187, 187, 204, ${alpha})`;   // Slate Gray
  return `rgba(238, 238, 238, ${alpha})`;                 // Off-White >=12m
}

// Exact SAMUDRA Current Speed Color Palette (0 to >=4.0 m/s)
function getSamudraCurrentColor(speed: number, alpha: number): string {
  if (speed <= 0.2) return `rgba(5, 25, 55, ${alpha})`;     // Dark Navy
  if (speed <= 0.5) return `rgba(0, 135, 90, ${alpha})`;    // Forest Green
  if (speed <= 0.8) return `rgba(160, 152, 0, ${alpha})`;   // Olive / Yellow
  if (speed <= 1.5) return `rgba(128, 21, 69, ${alpha})`;   // Maroon / Red-Purple
  if (speed <= 3.0) return `rgba(76, 29, 149, ${alpha})`;   // Deep Purple
  if (speed <= 4.0) return `rgba(0, 119, 255, ${alpha})`;   // Bright Cyan
  return `rgba(203, 243, 240, ${alpha})`;                  // Light Cyan-White >=4.0
}

// SAMUDRA Wind Speed Color Palette (0 to >=25 m/s)
function getSamudraWindColor(speed: number, alpha: number): string {
  if (speed <= 3.0) return `rgba(0, 75, 35, ${alpha})`;     // Light Breeze (Dark Green)
  if (speed <= 7.0) return `rgba(56, 176, 0, ${alpha})`;    // Moderate (Green)
  if (speed <= 12.0) return `rgba(255, 170, 0, ${alpha})`;  // Fresh (Amber/Yellow)
  if (speed <= 18.0) return `rgba(255, 84, 0, ${alpha})`;   // Strong (Orange)
  return `rgba(157, 2, 8, ${alpha})`;                      // Gale (Crimson >=25 m/s)
}

// Wave/Swell Period Color Palette (seconds)
function getPeriodColor(period: number, alpha: number): string {
  if (period <= 6.0) return `rgba(29, 53, 87, ${alpha})`;    // Short / Choppy (Deep Navy)
  if (period <= 9.0) return `rgba(69, 123, 157, ${alpha})`;  // Moderate (Blue)
  if (period <= 12.0) return `rgba(168, 218, 220, ${alpha})`// Medium (Light Blue)
  if (period <= 15.0) return `rgba(231, 111, 81, ${alpha})`; // Long Swell (Coral)
  return `rgba(230, 57, 70, ${alpha})`;                     // Very Long Swell (Red)
}

export const SamudraOceanRenderer: React.FC<SamudraOceanRendererProps> = ({
  view,
  activeParameter,
  opacity,
  spatialPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; age: number; maxAge: number; speed: number }>>([]);

  useEffect(() => {
    if (!view || !activeParameter) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Parameters handled by IncoisDynamicLayer (SST, Chlorophyll, Bathymetry, Heatwave Basin)
    // or pure WFS (PFZ) don't need continuous canvas scalar fields
    if (
      activeParameter === 'sst' ||
      activeParameter === 'chlorophyll' ||
      activeParameter === 'bathymetry' ||
      activeParameter === 'heatwave' ||
      activeParameter === 'pfz'
    ) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
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

    // Initialize streamline particles for Currents parameter
    if (activeParameter === 'currents') {
      const pCount = 180;
      particlesRef.current = [];
      for (let i = 0; i < pCount; i++) {
        particlesRef.current.push({
          x: Math.random() * (canvas.width || 800),
          y: Math.random() * (canvas.height || 600),
          age: Math.floor(Math.random() * 60),
          maxAge: 40 + Math.floor(Math.random() * 40),
          speed: 1.0 + Math.random() * 2.0
        });
      }
    }

    const render = () => {
      if (!canvas || !view.container) return;
      const width = view.container.clientWidth;
      const height = view.container.clientHeight;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. PROJECT SPATIAL STATIONS TO SCREEN
      const screenPoints = spatialPoints
        .map(pt => {
          const geom = new Point({ latitude: pt.lat, longitude: pt.lon, spatialReference: { wkid: 4326 } });
          const scr = view.toScreen(geom);
          if (!scr) return null;
          return { x: scr.x, y: scr.y, pt };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (screenPoints.length === 0 && activeParameter !== 'hazards') return;

      // 2. RENDER CONTINUOUS OCEAN SCALAR FIELD (Waves, Swell, Currents, Wind, Periods)
      const isScalarFieldParam =
        activeParameter === 'waves' ||
        activeParameter === 'swell' ||
        activeParameter === 'currents' ||
        activeParameter === 'wind' ||
        activeParameter === 'wave_period' ||
        activeParameter === 'swell_period';

      if (isScalarFieldParam && screenPoints.length > 0) {
        const step = 20; // 20px grid cells for high-speed continuous field
        const effectiveAlpha = Math.max(0.2, Math.min(0.85, opacity * 0.75));

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            // Find inverse distance weighted value from 4 nearest marine points
            let sumWeight = 0;
            let valWeighted = 0;
            let minDist = 999999;

            for (let i = 0; i < screenPoints.length; i++) {
              const sp = screenPoints[i];
              const dx = x - sp.x;
              const dy = y - sp.y;
              const distSq = dx * dx + dy * dy;
              const dist = Math.sqrt(distSq);
              if (dist < minDist) minDist = dist;

              // Distance influence radius up to 450px
              if (dist < 450) {
                const w = 1 / Math.pow(Math.max(25, dist), 1.8);
                sumWeight += w;

                let val = 0;
                if (activeParameter === 'waves') val = sp.pt.waveHeight;
                else if (activeParameter === 'swell') val = sp.pt.swellHeight;
                else if (activeParameter === 'currents') val = sp.pt.currentVelocity;
                else if (activeParameter === 'wind') val = sp.pt.windSpeed;
                else if (activeParameter === 'wave_period') val = sp.pt.wavePeriod;
                else if (activeParameter === 'swell_period') val = sp.pt.swellPeriod;

                valWeighted += val * w;
              }
            }

            // Only paint if within reasonable maritime influence of stations
            if (sumWeight > 0 && minDist < 360) {
              const finalVal = valWeighted / sumWeight;
              let fillStyle = '';

              if (activeParameter === 'waves' || activeParameter === 'swell') {
                fillStyle = getSamudraWaveColor(finalVal, effectiveAlpha);
              } else if (activeParameter === 'currents') {
                fillStyle = getSamudraCurrentColor(finalVal, effectiveAlpha);
              } else if (activeParameter === 'wind') {
                fillStyle = getSamudraWindColor(finalVal, effectiveAlpha);
              } else if (activeParameter === 'wave_period' || activeParameter === 'swell_period') {
                fillStyle = getPeriodColor(finalVal, effectiveAlpha);
              }

              ctx.fillStyle = fillStyle;
              ctx.fillRect(x, y, step, step);
            }
          }
        }

        // 3. MASK OUT LAND (INDIA, SRI LANKA, PAKISTAN)
        // Uses `destination-out` so all underlying colorful basemap roads, cities, and relief remain crystal clear
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';

        INDIA_LAND_POLYGONS.forEach(poly => {
          ctx.beginPath();
          let started = false;
          poly.forEach(([lon, lat]) => {
            const p = new Point({ latitude: lat, longitude: lon, spatialReference: { wkid: 4326 } });
            const s = view.toScreen(p);
            if (s) {
              if (!started) {
                ctx.moveTo(s.x, s.y);
                started = true;
              } else {
                ctx.lineTo(s.x, s.y);
              }
            }
          });
          if (started) {
            ctx.closePath();
            ctx.fill();
          }
        });
        ctx.restore();
      }

      // 4. RENDER DYNAMIC STREAMLINES / FLOW PARTICLES (For Surface Currents)
      if (activeParameter === 'currents') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.4;

        particlesRef.current.forEach(p => {
          p.age++;
          if (p.age > p.maxAge || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
            p.age = 0;
          }

          // Interpolate local U/V flow velocity
          let uSum = 0, vSum = 0, wSum = 0;
          for (let i = 0; i < screenPoints.length; i++) {
            const sp = screenPoints[i];
            const dist = Math.hypot(p.x - sp.x, p.y - sp.y);
            if (dist < 300) {
              const w = 1 / Math.pow(Math.max(30, dist), 1.5);
              uSum += sp.pt.u * w;
              vSum += sp.pt.v * w;
              wSum += w;
            }
          }

          const u = wSum > 0 ? (uSum / wSum) * 2.5 : 0.8;
          const v = wSum > 0 ? (vSum / wSum) * 2.5 : -0.3;

          const oldX = p.x;
          const oldY = p.y;
          p.x += u * p.speed;
          p.y -= v * p.speed; // Canvas y is inverted relative to northward v

          ctx.beginPath();
          ctx.moveTo(oldX, oldY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        });
        ctx.restore();
      }

      // 5. RENDER DIRECTIONAL WIND ARROWS (For Wind)
      if (activeParameter === 'wind') {
        ctx.save();
        screenPoints.forEach(sp => {
          const dirRad = ((sp.pt.windDirection + 180) * Math.PI) / 180; // Meteorological to screen
          const arrowLen = Math.max(16, Math.min(32, sp.pt.windSpeed * 2.5));
          const toX = sp.x + Math.sin(dirRad) * arrowLen;
          const toY = sp.y - Math.cos(dirRad) * arrowLen;

          // Wind shaft
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          // Arrowhead
          const headAngle = 0.45;
          const headLen = 7;
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headLen * Math.sin(dirRad - headAngle), toY + headLen * Math.cos(dirRad - headAngle));
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headLen * Math.sin(dirRad + headAngle), toY + headLen * Math.cos(dirRad + headAngle));
          ctx.stroke();

          // Speed Badge
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(sp.x - 18, sp.y - 8, 36, 16);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${sp.pt.windSpeed.toFixed(0)}m/s`, sp.x, sp.y);
        });
        ctx.restore();
      }

      // 6. RENDER SWELL DIRECTION ARROWS (For Swell)
      if (activeParameter === 'swell') {
        ctx.save();
        screenPoints.forEach(sp => {
          const dirRad = (sp.pt.swellDirection * Math.PI) / 180;
          const arrowLen = 22;
          const toX = sp.x + Math.sin(dirRad) * arrowLen;
          const toY = sp.y - Math.cos(dirRad) * arrowLen;

          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          // Period Badge
          ctx.fillStyle = 'rgba(3, 20, 31, 0.85)';
          ctx.fillRect(sp.x - 16, sp.y - 8, 32, 16);
          ctx.fillStyle = '#00F0FF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${sp.pt.swellPeriod.toFixed(0)}s`, sp.x, sp.y);
        });
        ctx.restore();
      }

      // 7. RENDER SAMUDRA COASTAL THREAT STATUS ALERT SECTORS
      // Active for hazards, waves, swell, or currents
      const showCoastalAlerts =
        activeParameter === 'hazards' ||
        activeParameter === 'waves' ||
        activeParameter === 'swell' ||
        activeParameter === 'currents';

      if (showCoastalAlerts) {
        ctx.save();
        COASTAL_ALERT_SECTORS.forEach(sec => {
          const color = THREAT_COLORS[sec.threatStatus] || '#00875A';
          ctx.strokeStyle = color;
          ctx.lineWidth = activeParameter === 'hazards' ? 5.5 : 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          let started = false;
          sec.coordinates.forEach(([lon, lat]) => {
            const p = new Point({ latitude: lat, longitude: lon, spatialReference: { wkid: 4326 } });
            const s = view.toScreen(p);
            if (s) {
              if (!started) {
                ctx.moveTo(s.x, s.y);
                started = true;
              } else {
                ctx.lineTo(s.x, s.y);
              }
            }
          });
          if (started) {
            ctx.stroke();
          }
        });
        ctx.restore();
      }

      frame++;
      if (activeParameter === 'currents') {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    // Re-render when map finishes panning/zooming
    const handle = view.watch('stationary', isStationary => {
      if (isStationary) render();
    });

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      handle.remove();
    };
  }, [view, activeParameter, opacity, spatialPoints]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
