import React from 'react';
import { Satellite, Radio, Compass, ShieldAlert, Sparkles, Waves } from 'lucide-react';

export const MarineMarquee: React.FC = () => {
  const items = [
    { icon: <Satellite className="w-3.5 h-3.5 text-[#28D7E5]" />, text: 'Satellite Earth Observations' },
    { icon: <Waves className="w-3.5 h-3.5 text-[#16C7C7]" />, text: 'INCOIS PFZ Bio-Thermal Analysis' },
    { icon: <Radio className="w-3.5 h-3.5 text-[#36D399]" />, text: 'Real-World Decision Support' },
    { icon: <ShieldAlert className="w-3.5 h-3.5 text-[#F5B942]" />, text: 'IMD Coastal Cyclone & Swell Warnings' },
    { icon: <Compass className="w-3.5 h-3.5 text-[#8B6CFF]" />, text: 'Safer Fishermen Navigation & Geofencing' },
    { icon: <Sparkles className="w-3.5 h-3.5 text-[#28D7E5]" />, text: 'Collaborative Multi-Agent DAG Reasoning' },
    { icon: <Waves className="w-3.5 h-3.5 text-[#16C7C7]" />, text: 'Copernicus Marine Currents & Wave Models' }
  ];

  return (
    <div className="w-full bg-[#03141F] border-b border-slate-800/80 py-2.5 overflow-hidden select-none">
      <div className="flex animate-marquee space-x-12 items-center">
        {/* Render twice for seamless infinite loop */}
        {[...items, ...items].map((item, idx) => (
          <div
            key={idx}
            className="flex items-center space-x-2 text-xs font-mono text-slate-400 shrink-0"
          >
            {item.icon}
            <span>{item.text}</span>
            <span className="text-slate-700 ml-6">•</span>
          </div>
        ))}
      </div>
    </div>
  );
};
