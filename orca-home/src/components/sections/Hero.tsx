import React from 'react';
import { LocationSearch } from '../ocean/LocationSearch';
import { GeocodingResult } from '../../services/geocodingService';
import { ShieldCheck, Database, Cpu } from 'lucide-react';

interface HeroProps {
  onSelectLocation: (result: GeocodingResult) => void;
}

export const Hero: React.FC<HeroProps> = ({ onSelectLocation }) => {
  return (
    <section className="relative pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
      {/* Small Category Pill */}
      <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full ocean-glass border border-[#16C7C7]/30 text-xs text-[#28D7E5] font-mono mb-6 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-[#16C7C7] animate-pulse" />
        <span>ISRO Space Technology • SIH 2026 Problem Statement 26176</span>
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight font-heading leading-tight mb-4">
        UNDERSTAND THE OCEAN.{' '}
        <span className="bg-gradient-to-r from-[#28D7E5] via-[#16C7C7] to-[#8B6CFF] bg-clip-text text-transparent">
          ACT WITH INTELLIGENCE.
        </span>
      </h1>

      {/* Supporting Text */}
      <p className="max-w-3xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed font-normal mb-8">
        ORCA combines marine observations, satellite-derived oceanography from INCOIS, MOSDAC, and Copernicus Marine, and collaborative AI reasoning to transform complex multi-parameter sea conditions into actionable intelligence.
      </p>

      {/* Large Search Bar */}
      <div className="mb-6">
        <LocationSearch onSelectLocation={onSelectLocation} />
      </div>

      {/* Fast Metric Badges */}
      <div className="flex flex-wrap justify-center items-center gap-6 pt-2 text-xs font-mono text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Database className="w-3.5 h-3.5 text-[#16C7C7]" />
          <span>INCOIS Live PFZ & ChloroGIN SST</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Cpu className="w-3.5 h-3.5 text-[#8B6CFF]" />
          <span>9 Collaborative Domain Agents</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#36D399]" />
          <span>ArcGIS Persistent Basemap Engine</span>
        </div>
      </div>
    </section>
  );
};
