import React from 'react';
import { ShieldCheck, ExternalLink, Database, CheckCircle2, Clock } from 'lucide-react';
import { OFFICIAL_DATA_SOURCES } from '../../data/sources';

const CREDIBILITY_MATRIX = [
  {
    parameter: 'Potential Fishing Zone (PFZ)',
    source: 'INCOIS',
    sourceUrl: 'https://incois.gov.in/geoportal/MFASPFZ/index.html',
    dataType: 'Operational GIS Vectors (WFS / GeoJSON)',
    update: 'Daily at 14:00 IST',
    orcaUse: 'Fishery advisory lines, bearing from landing centres, habitat suitability correlation',
    status: 'LIVE',
    statusColor: 'text-[#36D399] bg-[#36D399]/15 border-[#36D399]/30'
  },
  {
    parameter: 'Sea Surface Temperature (SST)',
    source: 'INCOIS / ChloroGIN',
    sourceUrl: 'https://incois.gov.in/site/services/ChloroGIN.jsp',
    dataType: 'Satellite Infrared / Microwave Composite (WMS)',
    update: 'Daily at 06:00 UTC',
    orcaUse: 'Ocean thermal front boundary delineation and upwelling index computation',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  },
  {
    parameter: 'Chlorophyll-a Concentration',
    source: 'INCOIS Ocean Colour',
    sourceUrl: 'https://incois.gov.in/site/services/ChloroGIN.jsp',
    dataType: 'Bio-Optical Radiance Inversion (WMS)',
    update: 'Daily at 08:00 UTC',
    orcaUse: 'Phytoplankton density tracking and food chain aggregation modeling',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  },
  {
    parameter: 'Surface Ocean Currents (U/V Vectors)',
    source: 'Copernicus Marine',
    sourceUrl: 'https://marine.copernicus.eu/',
    dataType: 'Global Hydrodynamic Model (eastward & northward velocity)',
    update: 'Daily Forecast Cycles',
    orcaUse: 'Animated particle drift rendering, vessel drift estimation, and eddy kinetic energy',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  },
  {
    parameter: 'Significant Wave Height & Swell',
    source: 'Copernicus Marine',
    sourceUrl: 'https://data.marine.copernicus.eu/',
    dataType: 'Global Spectral Wave Analysis & Forecast',
    update: '3-Hourly Refresh',
    orcaUse: 'Sea-venture safety threshold calculation and capsizing risk evaluation',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  },
  {
    parameter: '10m Surface Marine Winds',
    source: 'Copernicus Marine / ECMWF',
    sourceUrl: 'https://help.marine.copernicus.eu/en/articles/4933466-does-copernicus-marine-service-provide-pressure-and-wind-data',
    dataType: 'Atmospheric Boundary-Layer 10m Wind Field',
    update: 'Hourly Forecast',
    orcaUse: 'Squall detection, Beaufort wind force classification, and chop formation',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  },
  {
    parameter: 'Cyclone Track & Wind Radii',
    source: 'IMD (India Meteorological Department)',
    sourceUrl: 'https://mausam.imd.gov.in/',
    dataType: 'RSMC New Delhi Bulletins & Cyclone API',
    update: '3-Hourly during active cyclogenesis',
    orcaUse: 'Maritime hazard warning, exclusion zones, and storm surge alerts',
    status: 'UNAVAILABLE (AUTH REQUIRED)',
    statusColor: 'text-[#FF4D5A] bg-[#FF4D5A]/15 border-[#FF4D5A]/30'
  },
  {
    parameter: 'Ocean Bathymetry & EEZ Limits',
    source: 'INCOIS / GEBCO / ArcGIS',
    sourceUrl: 'https://incois.gov.in/geoportal/MFASPFZ/index.html',
    dataType: 'Seafloor Isobaths & Maritime Boundaries (WMS / MapServer)',
    update: 'Authoritative Static Baseline',
    orcaUse: 'Continental shelf break identification and maritime legal compliance',
    status: 'LATEST AVAILABLE',
    statusColor: 'text-[#28D7E5] bg-[#28D7E5]/15 border-[#28D7E5]/30'
  }
];

export const DataCredibility: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#16C7C7]/10 text-[#28D7E5] font-mono text-xs mb-3 border border-[#16C7C7]/30">
          <Database className="w-3.5 h-3.5" />
          <span>PROVENANCE & INTEGRITY</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-white font-heading tracking-tight mb-4">
          POWERED BY AUTHORITATIVE MARINE DATA
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          ORCA does not rely on a single data provider or synthetic approximations. Different marine parameters are obtained from appropriate authoritative observation, satellite, model, and advisory services.
        </p>
      </div>

      {/* Authoritative Data Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {OFFICIAL_DATA_SOURCES.slice(0, 3).map(src => (
          <div
            key={src.id}
            className="p-6 rounded-2xl ocean-glass border border-[#16C7C7]/20 hover:border-[#16C7C7]/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#16C7C7]/15 text-[#28D7E5] border border-[#16C7C7]/30">
                  {src.badgeText}
                </span>
                <span className="flex items-center space-x-1 text-xs text-[#36D399] font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified</span>
                </span>
              </div>
              <h3 className="text-lg font-bold text-white font-heading">{src.name}</h3>
              <p className="text-xs text-slate-400 mb-4">{src.fullName}</p>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">{src.orcaRole}</p>
            </div>

            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-[#28D7E5] hover:underline pt-3 border-t border-slate-800"
            >
              <span>Visit Official Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>

      {/* Structured Parameter Matrix Table */}
      <div className="ocean-glass rounded-2xl border border-[#16C7C7]/20 overflow-hidden shadow-2xl">
        <div className="p-4 bg-[#061F2C]/80 border-b border-[#16C7C7]/20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#36D399]" />
            <span className="text-xs font-semibold text-white tracking-wider font-heading uppercase">
              Operational Dataset Provenance Matrix
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Real Endpoints • Zero Synthetic Fallbacks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#03141F] text-slate-400 font-mono border-b border-slate-800">
                <th className="py-3.5 px-4 font-medium">PARAMETER</th>
                <th className="py-3.5 px-4 font-medium">OFFICIAL SOURCE</th>
                <th className="py-3.5 px-4 font-medium">DATA TYPE & PROTOCOL</th>
                <th className="py-3.5 px-4 font-medium">UPDATE CADENCE</th>
                <th className="py-3.5 px-4 font-medium">ORCA APPLICATION</th>
                <th className="py-3.5 px-4 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {CREDIBILITY_MATRIX.map((row, i) => (
                <tr key={i} className="hover:bg-[#061F2C]/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-200">{row.parameter}</td>
                  <td className="py-3 px-4">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#28D7E5] hover:underline inline-flex items-center space-x-1"
                    >
                      <span>{row.source}</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </a>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{row.dataType}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{row.update}</td>
                  <td className="py-3 px-4 text-slate-300 leading-snug">{row.orcaUse}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${row.statusColor}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
