import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck, Heart } from 'lucide-react';
import { OFFICIAL_DATA_SOURCES } from '../../data/sources';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#020B11] border-t border-slate-800/80 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Branding & Mission */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-3">
              <img src="/orca-logo.svg" alt="ORCA" className="w-8 h-8" />
              <span className="text-xl font-extrabold tracking-widest text-white font-heading">
                ORCA
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Marine EcOsystem Reasoning with Collaborative Agents. Advanced Agentic AI for Satellite Earth Observation & Maritime Decision Support.
            </p>
            <div className="text-[11px] font-mono text-[#28D7E5]">
              SIH 2026 Problem Statement 26176
              <br />
              Theme: Space Technology (ISRO)
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-heading">
              Platform Navigation
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a
                  href="#live-ocean-section"
                  className="hover:text-[#28D7E5] transition-colors flex items-center space-x-1"
                >
                  <span className="text-[#16C7C7]">›</span>
                  <span>Live Ocean Layers</span>
                </a>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="hover:text-[#28D7E5] transition-colors flex items-center space-x-1"
                >
                  <span className="text-[#16C7C7]">›</span>
                  <span>Dashboard Workspace</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/fisherman"
                  className="hover:text-[#28D7E5] transition-colors flex items-center space-x-1"
                >
                  <span className="text-[#16C7C7]">›</span>
                  <span>Fisherman Safety Portal</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/3d"
                  className="hover:text-[#28D7E5] transition-colors flex items-center space-x-1"
                >
                  <span className="text-[#16C7C7]">›</span>
                  <span>3D Ocean Simulation</span>
                </Link>
              </li>
              <li>
                <a
                  href="#about-section"
                  className="hover:text-[#28D7E5] transition-colors flex items-center space-x-1"
                >
                  <span className="text-[#16C7C7]">›</span>
                  <span>About ORCA & Architecture</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Authoritative Data Sources */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-heading">
              Authoritative Data Sources
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              {OFFICIAL_DATA_SOURCES.map(src => (
                <li key={src.id}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#28D7E5] transition-colors inline-flex items-center space-x-1.5"
                  >
                    <span>{src.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Problem Statement & Theme */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-heading">
              Hackathon Context
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Smart India Hackathon (SIH) 2026.
              <br />
              Organization: <strong className="text-slate-200">ISRO / Department of Space</strong>
              <br />
              Focus: Blue Economy, Fishermen Safety, Space Technology, & Collaborative Agentic Reasoning.
            </p>
            <div className="p-2.5 rounded-xl bg-[#061F2C] border border-slate-800 text-[11px] font-mono text-[#36D399] flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Verified Data Provenance</span>
            </div>
          </div>
        </div>

        {/* Mandatory Transparency Disclaimer */}
        <div className="pt-8 border-t border-slate-800/80 text-[11px] text-slate-500 leading-relaxed space-y-2">
          <p>
            <strong>Data Availability Disclaimer:</strong> ORCA presents marine observations, hydrodynamic model products, and advisories from external authoritative sources including INCOIS, MOSDAC/ISRO, Copernicus Marine, IMD, and Esri ArcGIS. Availability, spatial resolution, update frequency, and latency depend strictly on the respective source services. Data availability and update times depend on the respective source services.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 text-slate-500 font-mono text-[10px]">
            <span>© 2026 ORCA Marine Intelligence • SIH PS 26176</span>
            <span className="mt-2 sm:mt-0">Built for ISRO Space Technology Theme</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
