import React from 'react';
import { Ruler, Trash2, Navigation2, CheckCircle2 } from 'lucide-react';
import { GeodeticMeasurement } from '../../types';

interface MeasurementToolProps {
  active: boolean;
  measurement: GeodeticMeasurement | null;
  step: 'first_point' | 'second_point' | 'complete';
  onReset: () => void;
  onClose: () => void;
}

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  active,
  measurement,
  step,
  onReset,
  onClose
}) => {
  if (!active) return null;

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 ocean-glass rounded-xl shadow-2xl px-5 py-3 border border-[#16C7C7]/30 flex items-center space-x-6 animate-in fade-in slide-in-from-top-3">
      {/* Icon & Label */}
      <div className="flex items-center space-x-2 border-r border-slate-700/60 pr-4">
        <div className="p-2 rounded-lg bg-[#16C7C7]/15 text-[#28D7E5]">
          <Ruler className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-100 font-heading">Geodetic Range</div>
          <div className="text-[10px] text-slate-400 font-mono">Great-Circle Calculation</div>
        </div>
      </div>

      {/* Measurement Status & Values */}
      {step === 'first_point' && (
        <div className="text-xs text-[#28D7E5] flex items-center space-x-1.5 animate-pulse">
          <span>Click start point (e.g. Machilipatnam Coast)</span>
        </div>
      )}

      {step === 'second_point' && (
        <div className="text-xs text-[#F5B942] flex items-center space-x-1.5 animate-pulse">
          <span>Click destination offshore (e.g. 40 km offshore PFZ)</span>
        </div>
      )}

      {step === 'complete' && measurement && (
        <div className="flex items-center space-x-6">
          {/* Distance Km */}
          <div>
            <div className="text-[10px] text-slate-400 font-mono">RANGE (KM)</div>
            <div className="text-sm font-bold font-mono text-[#28D7E5]">
              {measurement.distanceKm} <span className="text-xs font-normal text-slate-400">km</span>
            </div>
          </div>

          {/* Distance Nautical Miles */}
          <div>
            <div className="text-[10px] text-slate-400 font-mono">NAUTICAL MILES</div>
            <div className="text-sm font-bold font-mono text-[#36D399]">
              {measurement.distanceNmi} <span className="text-xs font-normal text-slate-400">nmi</span>
            </div>
          </div>

          {/* Azimuth / Bearing */}
          <div className="flex items-center space-x-2">
            <div>
              <div className="text-[10px] text-slate-400 font-mono">FORWARD BEARING</div>
              <div className="text-sm font-bold font-mono text-[#8B6CFF] flex items-center space-x-1">
                <Navigation2
                  className="w-3.5 h-3.5 inline-block transform"
                  style={{ transform: `rotate(${measurement.bearingDeg}deg)` }}
                />
                <span>{measurement.bearingDeg}°</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2 pl-2 border-l border-slate-700/60">
        <button
          onClick={onReset}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Reset measurement points"
          aria-label="Reset Measurement"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-[#061F2C] hover:bg-[#082A36] border border-slate-700 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
