import React from 'react';
import {
  Satellite,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  Compass,
  Users,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { OFFICIAL_DATA_SOURCES } from '../../data/sources';

const PIPELINE_STEPS = [
  {
    icon: <Satellite className="w-5 h-5 text-[#28D7E5]" />,
    title: 'Earth Observation Feeds',
    description: 'Continuous ingestion of raw radiances from Oceansat-3, INSAT-3DR, and Copernicus hydrodynamic models.'
  },
  {
    icon: <Database className="w-5 h-5 text-[#16C7C7]" />,
    title: 'Multi-Source Fusion',
    description: 'Alignment of spatial coordinate systems (EPSG:4326 to Web Mercator) and timestamp latency validation.'
  },
  {
    icon: <Layers className="w-5 h-5 text-[#36D399]" />,
    title: 'ArcGIS Ocean Layers',
    description: 'High-contrast oceanic basemap with independent WMS/WFS rasters and vector current particle flows.'
  },
  {
    icon: <Cpu className="w-5 h-5 text-[#8B6CFF]" />,
    title: '9 Collaborative Agents',
    description: 'Domain agents specialize in thermal fronts, wave energy, winds, PFZ habitat suitability, and craft seaworthiness.'
  },
  {
    icon: <Users className="w-5 h-5 text-[#F5B942]" />,
    title: 'Actionable Decision Support',
    description: 'Clear, multilingual advisories distributed to fishermen, coastal safety authorities, and maritime operators.'
  }
];

export const About: React.FC = () => {
  return (
    <section id="about-section" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#16C7C7]/10 text-[#28D7E5] font-mono text-xs mb-3 border border-[#16C7C7]/30">
          <Compass className="w-3.5 h-3.5" />
          <span>MISSION & SCIENTIFIC FOUNDATION</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-heading tracking-tight mb-4">
          FROM OCEAN DATA TO ACTIONABLE INTELLIGENCE
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          The ocean produces petabytes of satellite observations, numerical ocean forecasts, and coastal advisories every day. ORCA connects these fragmented data streams to provide explainable, human-centered decision support.
        </p>
      </div>

      {/* End-to-End Data Pipeline Architecture */}
      <div className="mb-20">
        <h3 className="text-xs font-mono font-semibold tracking-wider text-[#16C7C7] uppercase mb-6 text-center">
          ORCA END-TO-END ARCHITECTURAL PIPELINE
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {PIPELINE_STEPS.map((step, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl ocean-glass border border-[#16C7C7]/20 flex flex-col justify-between hover:border-[#16C7C7]/40 transition-all relative group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-[#082A36] border border-slate-700">
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    0{idx + 1}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white font-heading mb-2">
                  {step.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {idx < PIPELINE_STEPS.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight className="w-4 h-4 text-[#16C7C7]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Authoritative Data Providers & Verified Sources Explorer */}
      <div className="space-y-6 mb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xl font-bold text-white font-heading">
              VERIFIED SOURCES & OFFICIAL REFERENCES
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Direct verification links to official agency endpoints and catalogues
            </p>
          </div>
          <span className="text-xs text-[#36D399] font-mono flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Strict Provenance Verified</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {OFFICIAL_DATA_SOURCES.map(src => (
            <div
              key={src.id}
              className="p-6 rounded-2xl ocean-glass border border-slate-800 hover:border-[#16C7C7]/30 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {src.category}
                  </span>
                  <h4 className="text-lg font-bold text-white font-heading mt-1.5">
                    {src.name}
                  </h4>
                  <p className="text-xs text-slate-400">{src.fullName}</p>
                </div>

                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-[#082A36] text-[#28D7E5] hover:text-white border border-slate-700 transition-colors"
                  title="Open Official Website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Parameters Provided */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-[#16C7C7] font-semibold">
                  Parameters Provided:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {src.parametersProvided.map((param, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#061F2C] text-slate-300 border border-slate-800"
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>

              {/* ORCA Role */}
              <div className="text-xs text-slate-300 leading-relaxed pt-1">
                <span className="text-slate-400 font-mono text-[11px] font-semibold">ORCA Role: </span>
                {src.orcaRole}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Transparency Statement */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#061F2C]/60 border border-[#16C7C7]/20 shadow-xl space-y-4">
        <div className="flex items-center space-x-2.5 text-[#28D7E5]">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-base font-bold font-heading uppercase tracking-wider">
            Dataset Integrity & Transparency Policy
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          In accordance with the highest scientific standards, ORCA does not generate synthetic ocean polygons, fictitious current vectors, or unverified "live" statuses. When an official service (such as IMD's registered Cyclone API) requires institutional credentials or is temporarily offline, ORCA clearly displays <span className="font-mono text-[#FF4D5A]">"Data service not connected"</span> or <span className="font-mono text-[#F5B942]">"Authentication required"</span> alongside the official technical metadata rather than fabricating numbers.
        </p>
      </div>
    </section>
  );
};
