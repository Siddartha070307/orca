import React, { useState } from 'react';
import { Header } from '../components/sections/Header';
import { Footer } from '../components/sections/Footer';
import {
  Waves,
  Mountain,
  Compass,
  Sliders,
  RotateCcw,
  Maximize2,
  Activity,
  Layers
} from 'lucide-react';

export const SimulationPage: React.FC = () => {
  const [waveHeight, setWaveHeight] = useState<number>(1.5);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0.8);
  const [depthOffset, setDepthOffset] = useState<number>(120);

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col">
      <Header onOpenLayers={() => {}} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#8B6CFF]/20 text-[#8B6CFF] border border-[#8B6CFF]/40">
                3D SIMULATION ENGINE
              </span>
              <span className="text-xs text-slate-400 font-mono">SIH 2026 PS 26176</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-heading mt-1">
              3D Ocean Hydrodynamics & Bathymetry Simulation
            </h1>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Simulate wave shoaling, current dispersion, and continental shelf bathymetric depth profiles.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#8B6CFF]/15 text-[#8B6CFF] border border-[#8B6CFF]/30 text-xs font-mono font-medium">
              SIMULATION MODE ACTIVE
            </span>
          </div>
        </div>

        {/* 3D Visualization Canvas Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Simulated Environment Viewport */}
          <div className="lg:col-span-8 relative h-[500px] rounded-3xl overflow-hidden ocean-glass border border-[#16C7C7]/30 shadow-2xl flex flex-col justify-between p-6">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center space-x-2 bg-[#061F2C]/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono">
                <Waves className="w-4 h-4 text-[#28D7E5]" />
                <span>Simulated Bay of Bengal Shelf Profile</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 bg-[#03141F]/80 px-2 py-1 rounded">
                Depth: -{depthOffset}m | Hsig: {waveHeight}m
              </div>
            </div>

            {/* Dynamic CSS/SVG Bathymetric Profile Simulation */}
            <div className="relative w-full h-64 flex items-end justify-center">
              <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="oceanWater" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#16C7C7" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#082A36" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#03141F" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="seabedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                </defs>

                {/* Animated Wave Surface */}
                <path
                  d={`M 0,${60 + Math.sin(Date.now() / 400) * (waveHeight * 4)} Q 200,${
                    40 + (waveHeight * 8)
                  } 400,${60 - (waveHeight * 4)} T 800,${60 + (waveHeight * 4)} L 800,240 L 0,240 Z`}
                  fill="url(#oceanWater)"
                />

                {/* Seabed Topography Profile */}
                <path
                  d={`M 0,${180 - depthOffset * 0.4} Q 300,${
                    200 - depthOffset * 0.3
                  } 500,220 L 800,235 L 800,240 L 0,240 Z`}
                  fill="url(#seabedGrad)"
                  stroke="#16C7C7"
                  strokeWidth="1.5"
                />

                {/* Depth Isobath Labels */}
                <text x="40" y={220} fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono">
                  Continental Shelf Break
                </text>
                <text x="600" y={230} fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">
                  Deep Basin (-2500m)
                </text>
              </svg>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-mono z-10">
              <span>Machilipatnam Coastline (0 km)</span>
              <span>Offshore Shelf (60 km)</span>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-4 p-6 rounded-3xl ocean-glass border border-[#16C7C7]/20 space-y-6">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-[#28D7E5]" />
              <h2 className="text-sm font-bold text-white font-heading uppercase tracking-wider">
                Simulation Controls
              </h2>
            </div>

            {/* Wave Height */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Significant Wave Height</span>
                <span className="text-[#28D7E5] font-bold">{waveHeight} m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.5"
                step="0.1"
                value={waveHeight}
                onChange={e => setWaveHeight(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#16C7C7]"
              />
            </div>

            {/* Current Velocity */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Current Velocity</span>
                <span className="text-[#8B6CFF] font-bold">{currentSpeed} m/s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={currentSpeed}
                onChange={e => setCurrentSpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8B6CFF]"
              />
            </div>

            {/* Bathymetric Depth */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Seafloor Depth</span>
                <span className="text-[#36D399] font-bold">-{depthOffset} m</span>
              </div>
              <input
                type="range"
                min="20"
                max="400"
                step="10"
                value={depthOffset}
                onChange={e => setDepthOffset(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#36D399]"
              />
            </div>

            {/* Simulation Status Note */}
            <div className="p-3.5 rounded-xl bg-[#061F2C] border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
              Visualizes hydrodynamic interaction between surface wave orbitals and bathymetric shoaling gradients.
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
