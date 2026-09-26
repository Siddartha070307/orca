import React, { useEffect, useRef } from 'react';
import type MapView from '@arcgis/core/views/MapView.js';
import Point from '@arcgis/core/geometry/Point.js';
import { CurrentVectorPoint } from '../../services/marinePhysicsService';

interface CurrentParticleOverlayProps {
  view: MapView | null;
  visible: boolean;
  opacity: number;
  vectorPoints: CurrentVectorPoint[];
}

interface Particle {
  x: number; // screen px
  y: number; // screen px
  age: number;
  maxAge: number;
  speed: number;
}

export const CurrentParticleOverlay: React.FC<CurrentParticleOverlayProps> = ({
  view,
  visible,
  opacity,
  vectorPoints
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!visible || !view || vectorPoints.length === 0) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
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

    // Resize canvas to match map container
    const updateCanvasSize = () => {
      if (!canvas || !view.container) return;
      canvas.width = view.container.clientWidth;
      canvas.height = view.container.clientHeight;
    };
    updateCanvasSize();

    // Map geographic vector points to screen coordinates
    const getScreenVectors = () => {
      return vectorPoints
        .map(pt => {
          const geomPoint = new Point({
            latitude: pt.lat,
            longitude: pt.lon,
            spatialReference: { wkid: 4326 }
          });
          const screenPt = view.toScreen(geomPoint);
          if (!screenPt) return null;
          return {
            x: screenPt.x,
            y: screenPt.y,
            u: pt.u,
            v: pt.v,
            velocity: pt.velocity,
            direction: pt.direction
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    let screenVectors = getScreenVectors();

    // Initialize particle pool (around 400 particles for smooth high-FPS rendering)
    const MAX_PARTICLES = 350;
    const particles: Particle[] = [];

    const spawnParticle = (): Particle => {
      // Pick a random screen vector region to spawn from
      if (screenVectors.length > 0 && Math.random() > 0.3) {
        const anchor = screenVectors[Math.floor(Math.random() * screenVectors.length)];
        const spread = 80;
        return {
          x: anchor.x + (Math.random() - 0.5) * spread,
          y: anchor.y + (Math.random() - 0.5) * spread,
          age: 0,
          maxAge: 40 + Math.random() * 50,
          speed: anchor.velocity || 1.0
        };
      }
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        age: 0,
        maxAge: 40 + Math.random() * 50,
        speed: 1.0
      };
    };

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = spawnParticle();
      p.age = Math.random() * p.maxAge; // stagger initial ages
      particles.push(p);
    }
    particlesRef.current = particles;

    // Inverse distance weighting interpolation for vector field at screen coordinate (px, py)
    const interpolateVelocity = (px: number, py: number) => {
      if (screenVectors.length === 0) return { dx: 0, dy: 0, speed: 0 };

      let sumWeight = 0;
      let sumDx = 0;
      let sumDy = 0;
      let sumSpeed = 0;

      for (let i = 0; i < screenVectors.length; i++) {
        const sv = screenVectors[i];
        const distSq = (px - sv.x) * (px - sv.x) + (py - sv.y) * (py - sv.y);
        // Influence radius of ~250px
        if (distSq < 62500) {
          const weight = 1 / (distSq + 100);
          sumWeight += weight;
          // In screen space: u is +X (East), v is -Y (North)
          sumDx += sv.u * weight;
          sumDy += -sv.v * weight;
          sumSpeed += sv.velocity * weight;
        }
      }

      if (sumWeight === 0) return { dx: 0, dy: 0, speed: 0 };
      return {
        dx: sumDx / sumWeight,
        dy: sumDy / sumWeight,
        speed: sumSpeed / sumWeight
      };
    };

    // Animation Loop
    const render = () => {
      // Semi-transparent fade to produce streak trails
      ctx.fillStyle = 'rgba(3, 20, 31, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const vel = interpolateVelocity(p.x, p.y);

        if (vel.speed < 0.05 || p.age >= p.maxAge) {
          particles[i] = spawnParticle();
          continue;
        }

        // Draw particle line segment along flow
        const nextX = p.x + vel.dx * 3.5;
        const nextY = p.y + vel.dy * 3.5;

        // Color mapped by real current velocity: Cyan (normal) to Purple (fast)
        const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * opacity;
        const color =
          vel.speed > 1.2
            ? `rgba(139, 108, 255, ${alpha})`
            : vel.speed > 0.6
            ? `rgba(40, 215, 229, ${alpha})`
            : `rgba(22, 199, 199, ${alpha * 0.85})`;

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();

        p.x = nextX;
        p.y = nextY;
        p.age++;

        // Reset if drifted off screen
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          particles[i] = spawnParticle();
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    // Watch for MapView extent changes to re-project screen vectors
    const extentHandle = view.watch('extent', () => {
      updateCanvasSize();
      screenVectors = getScreenVectors();
    });

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      extentHandle.remove();
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [visible, opacity, view, vectorPoints]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
