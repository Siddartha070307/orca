import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ShieldCheck, Activity, AlertTriangle } from 'lucide-react';
import { OCEAN_LAYERS } from '../../data/layerDefinitions';
import { ActiveMarineParameter } from '../../types';

interface DynamicLegendProps {
  activeParameter: ActiveMarineParameter;
}

// SAMUDRA Segmented Scale Definitions
const SAMUDRA_SCALES: Record<string, { label: string; segments: Array<{ val: string; bg: string; text?: string }> }> = {
  waves: {
    label: 'Significant Wave Height (m)',
    segments: [
      { val: '0', bg: '#00cccc', text: '#000' },
      { val: '0.5', bg: '#00cccc', text: '#000' },
      { val: '1', bg: '#0055ff', text: '#fff' },
      { val: '1.5', bg: '#3377ff', text: '#fff' },
      { val: '2', bg: '#aa77ff', text: '#000' },
      { val: '2.5', bg: '#aa33dd', text: '#fff' },
      { val: '3', bg: '#880099', text: '#fff' },
      { val: '4', bg: '#cc2233', text: '#fff' },
      { val: '5', bg: '#ff1122', text: '#fff' },
      { val: '7', bg: '#ff88aa', text: '#000' },
      { val: '10', bg: '#bbbbcc', text: '#000' },
      { val: '>=12', bg: '#eeeeee', text: '#000' }
    ]
  },
  swell: {
    label: 'Swell Wave Height (m)',
    segments: [
      { val: '0', bg: '#00cccc', text: '#000' },
      { val: '0.5', bg: '#00cccc', text: '#000' },
      { val: '1', bg: '#0055ff', text: '#fff' },
      { val: '1.5', bg: '#3377ff', text: '#fff' },
      { val: '2', bg: '#aa77ff', text: '#000' },
      { val: '2.5', bg: '#aa33dd', text: '#fff' },
      { val: '3', bg: '#880099', text: '#fff' },
      { val: '4', bg: '#cc2233', text: '#fff' },
      { val: '5', bg: '#ff1122', text: '#fff' },
      { val: '7', bg: '#ff88aa', text: '#000' },
      { val: '10', bg: '#bbbbcc', text: '#000' },
      { val: '>=12', bg: '#eeeeee', text: '#000' }
    ]
  },
  currents: {
    label: 'Currents (m/s)',
    segments: [
      { val: '0.0', bg: '#051937', text: '#fff' },
      { val: '0.2', bg: '#00875a', text: '#fff' },
      { val: '0.5', bg: '#a09800', text: '#fff' },
      { val: '0.8', bg: '#801545', text: '#fff' },
      { val: '1.5', bg: '#4c1d95', text: '#fff' },
      { val: '3.0', bg: '#0077ff', text: '#fff' },
      { val: '>=4.0', bg: '#cbf3f0', text: '#000' }
    ]
  }
};

export const DynamicLegend: React.FC<DynamicLegendProps> = ({ activeParameter }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!activeParameter) {
    return null;
  }

  const def = OCEAN_LAYERS.find(l => l.id === activeParameter);
  if (!def) return null;

  const samudraScale = SAMUDRA_SCALES[activeParameter];
  const showThreatStatusBox =
    activeParameter === 'hazards' ||
    activeParameter === 'waves' ||
    activeParameter === 'swell' ||
    activeParameter === 'currents';

  return (
    <div className="absolute bottom-6 right-6 z-20 max-w-sm w-84 ocean-glass rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-[#16C7C7]/30 backdrop-blur-md">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 bg-[#061F2C]/90 border-b border-[#16C7C7]/20 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-[#28D7E5] animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-slate-100 uppercase font-heading">
            {def.legend.title}
          </span>
        </div>
        <button
          type="button"
          aria-label="Toggle Legend Visibility"
          className="text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Legend Body */}
      {!collapsed && (
        <div className="p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{def.name}</span>
            <span className="text-[10px] text-[#16C7C7] font-mono font-bold">{def.units}</span>
          </div>

          {/* SAMUDRA Multi-Stop Segmented Color Bar (For Waves, Swell, Currents) */}
          {samudraScale ? (
            <div className="space-y-1">
              <div className="text-[10px] text-slate-300 font-mono font-semibold">
                {samudraScale.label}
              </div>
              <div className="flex w-full rounded border border-slate-700 overflow-hidden shadow">
                {samudraScale.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center py-1 font-mono text-[9px] font-bold leading-none"
                    style={{ backgroundColor: seg.bg, color: seg.text || '#fff' }}
                  >
                    {seg.val}
                  </div>
                ))}
              </div>
            </div>
          ) : def.legend.gradient ? (
            /* Continuous Gradient Bar */
            <div>
              <div
                className="h-3 w-full rounded-full border border-slate-700/80 shadow-inner"
                style={{ background: def.legend.gradient }}
              />
              <div className="flex justify-between text-[10px] text-slate-300 font-mono mt-1 font-semibold">
                <span>{def.legend.minLabel}</span>
                {def.legend.midLabel && <span>{def.legend.midLabel}</span>}
                <span>{def.legend.maxLabel}</span>
              </div>
            </div>
          ) : null}

          {/* Discrete Legend Items */}
          {def.legend.discreteItems && (
            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
              {def.legend.discreteItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-sm shadow-sm inline-block shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300">{item.label}</span>
                  </div>
                  {item.value && (
                    <span className="text-[10px] text-slate-400 font-mono">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SAMUDRA Threat Status Mini HUD (Active for Coastal Warnings) */}
          {showThreatStatusBox && (
            <div className="p-2 rounded-lg bg-black/40 border border-slate-700/60 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold tracking-wider text-slate-200 font-heading">
                <AlertTriangle className="w-3 h-3 text-[#F5B942]" />
                <span>INCOIS OSF THREAT STATUS</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF0000]" />
                  <span className="text-slate-300">Warning</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FFA500]" />
                  <span className="text-slate-300">Alert</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FFFF00]" />
                  <span className="text-slate-300">Watch</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#00875A]" />
                  <span className="text-slate-300">No Threat</span>
                </div>
              </div>
            </div>
          )}

          {/* Source Provenance Badge */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-[#36D399]" />
              <span className="truncate max-w-[170px]">{def.source}</span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#28D7E5] font-bold">
              {def.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
