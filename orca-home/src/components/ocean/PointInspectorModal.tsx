import React from 'react';
import { X, MapPin, Compass, Waves, Wind, Thermometer, Activity, Clock, ShieldCheck } from 'lucide-react';
import { PointInspectionData } from '../../types';

interface PointInspectorModalProps {
  data: PointInspectionData | null;
  loading: boolean;
  onClose: () => void;
}

export const PointInspectorModal: React.FC<PointInspectorModalProps> = ({
  data,
  loading,
  onClose
}) => {
  if (!data && !loading) return null;

  return (
    <div className="absolute top-6 right-6 z-30 w-84 ocean-glass rounded-xl shadow-2xl border border-[#16C7C7]/25 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#061F2C]/90 border-b border-[#16C7C7]/20">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#28D7E5] animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-slate-100 uppercase font-heading">
            Point Marine Profile
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          aria-label="Close Inspection Modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 text-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-3 text-slate-400">
            <div className="w-6 h-6 border-2 border-[#16C7C7] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Querying ocean telemetry...</span>
          </div>
        ) : data ? (
          <>
            {/* Geodetic Coordinates */}
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#03141F]/80 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-[#16C7C7]" />
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">LATITUDE</div>
                  <div className="font-mono font-medium text-slate-200">
                    {data.latitude.toFixed(4)}° N
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Compass className="w-3.5 h-3.5 text-[#28D7E5]" />
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">LONGITUDE</div>
                  <div className="font-mono font-medium text-slate-200">
                    {data.longitude.toFixed(4)}° E
                  </div>
                </div>
              </div>
            </div>

            {/* Environmental Parameters Readout */}
            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold font-mono">
                Observed Physical Parameters
              </div>

              <div className="space-y-1.5">
                {data.layerValues.map((lv, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#061F2C]/50 border border-slate-800/80 hover:border-[#16C7C7]/30 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {lv.layerId === 'sst' && <Thermometer className="w-3.5 h-3.5 text-[#FF4136]" />}
                      {lv.layerId === 'waves' && <Waves className="w-3.5 h-3.5 text-[#268BD2]" />}
                      {lv.layerId === 'wind' && <Wind className="w-3.5 h-3.5 text-[#36D399]" />}
                      {lv.layerId === 'currents' && <Activity className="w-3.5 h-3.5 text-[#8B6CFF]" />}
                      {lv.layerId === 'pfz' && <Compass className="w-3.5 h-3.5 text-[#16C7C7]" />}
                      <span className="text-slate-300 font-medium">{lv.layerName}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-semibold text-slate-100">
                        {lv.value !== null && lv.value !== undefined
                          ? `${lv.value} ${lv.unit}`
                          : 'N/A — unavailable from selected source'}
                      </span>
                      <div className="text-[9px] text-slate-500 font-mono flex items-center justify-end space-x-1">
                        <span>{lv.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance & Timestamp Footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3 h-3 text-[#F5B942]" />
                <span className="font-mono">{data.timestamp}</span>
              </div>
              <div className="flex items-center space-x-1 text-[#36D399]">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Source</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
