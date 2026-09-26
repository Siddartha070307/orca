import React, { useState } from 'react';
import { Header } from '../components/sections/Header';
import { MarineMarquee } from '../components/sections/MarineMarquee';
import { Hero } from '../components/sections/Hero';
import { OceanMap } from '../components/ocean/OceanMap';
import { DataCredibility } from '../components/sections/DataCredibility';
import { AgentNetwork } from '../components/sections/AgentNetwork';
import { ReasoningDemonstration } from '../components/sections/ReasoningDemonstration';
import { About } from '../components/sections/About';
import { Footer } from '../components/sections/Footer';
import { GeocodingResult } from '../services/geocodingService';

export const HomePage: React.FC = () => {
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);

  const handleSelectLocation = (location: GeocodingResult) => {
    setSelectedLocation(location);
    // Smooth scroll to the ocean map
    const mapSection = document.getElementById('live-ocean-section');
    mapSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col selection:bg-[#16C7C7]/30 selection:text-[#28D7E5]">
      {/* Top Header */}
      <Header onOpenLayers={() => setIsLayerPanelOpen(true)} />

      {/* Marine Intelligence Marquee */}
      <MarineMarquee />

      {/* Hero Section with Large Search Bar */}
      <Hero onSelectLocation={handleSelectLocation} />

      {/* Main Live Ocean Map Section (Dominant centerpiece) */}
      <section id="live-ocean-section" className="py-6 px-4 sm:px-6 lg:px-8 max-w-[1500px] w-full mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#36D399] animate-pulse" />
              <h2 className="text-lg font-bold text-white font-heading tracking-wider">
                LIVE OCEAN OBSERVATION PORTAL
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              ArcGIS Topographic Basemap • Official Multi-Layer Marine Overlays • Dynamic Point Inspection
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsLayerPanelOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-slate-900 bg-[#16C7C7] hover:bg-[#28D7E5] shadow-lg shadow-[#16C7C7]/20 transition-all cursor-pointer flex items-center space-x-2"
            >
              <span>OPEN LAYER DRAWER</span>
              <span className="w-2 h-2 rounded-full bg-slate-900" />
            </button>
          </div>
        </div>

        {/* Ocean Map Centerpiece */}
        <OceanMap
          isLayerPanelOpen={isLayerPanelOpen}
          setIsLayerPanelOpen={setIsLayerPanelOpen}
          selectedLocation={selectedLocation}
        />
      </section>

      {/* Data Credibility Section (Authoritative Sources & Matrix) */}
      <DataCredibility />

      {/* 9 Collaborative Agents Section (Interactive Orbit Network) */}
      <AgentNetwork />

      {/* Collaborative Reasoning Demonstration */}
      <ReasoningDemonstration />

      {/* About ORCA Storytelling & Verified Sources */}
      <About />

      {/* Footer with Disclaimer & Attributions */}
      <Footer />
    </div>
  );
};
