import React, { useEffect } from 'react';
import {
  X,
  Layers,
  Thermometer,
  Wind,
  Waves,
  Activity,
  Compass,
  Fish,
  AlertTriangle,
  Flame,
  Mountain,
  Ruler,
  Sliders,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { OCEAN_LAYERS } from '../../data/layerDefinitions';
import { ActiveMarineParameter, LayerCategory, LayerStatus } from '../../types';

interface OceanLayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeParameter: ActiveMarineParameter;
  onSelectParameter: (paramId: ActiveMarineParameter) => void;
  opacity: number;
  onChangeOpacity: (opacity: number) => void;
  onToggleMeasurement: () => void;
  isMeasurementActive: boolean;
  activeTimestamp?: string;
  activeProvider?: string;
}

const CATEGORY_TITLES: Record<LayerCategory, string> = {
  environment: 'OCEAN ENVIRONMENT',
  ecosystem: 'MARINE ECOSYSTEM & FISHERIES',
  safety: 'MARITIME HAZARDS & SAFETY',
  analysis: 'MAP ANALYSIS'
};

export const OceanLayerPanel: React.FC<OceanLayerPanelProps> = ({
  isOpen,
  onClose,
  activeParameter,
  onSelectParameter,
  opacity,
  onChangeOpacity,
  onToggleMeasurement,
  isMeasurementActive,
  activeTimestamp,
  activeProvider
}) => {
  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getStatusBadge = (status: LayerStatus) => {
    switch (status) {
      case 'LIVE':
        return 'bg-[#36D399]/15 text-[#36D399] border-[#36D399]/30';
      case 'LATEST AVAILABLE':
        return 'bg-[#28D7E5]/15 text-[#28D7E5] border-[#28D7E5]/30';
      case 'FORECAST':
        return 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30';
      case 'HISTORICAL':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'SIMULATION':
        return 'bg-[#8B6CFF]/15 text-[#8B6CFF] border-[#8B6CFF]/30';
      case 'UNAVAILABLE':
      default:
        return 'bg-[#FF4D5A]/15 text-[#FF4D5A] border-[#FF4D5A]/30';
    }
  };

  const getLayerIcon = (id: string) => {
    switch (id) {
      case 'sst':
        return <Thermometer className="w-4 h-4 text-[#FF4136]" />;
      case 'chlorophyll':
        return <Activity className="w-4 h-4 text-[#00A86B]" />;
      case 'pfz':
        return <Fish className="w-4 h-4 text-[#16C7C7]" />;
      case 'currents':
        return <Activity className="w-4 h-4 text-[#8B6CFF]" />;
      case 'waves':
        return <Waves className="w-4 h-4 text-[#268BD2]" />;
      case 'swell':
        return <Compass className="w-4 h-4 text-[#48CAE4]" />;
      case 'wind':
        return <Wind className="w-4 h-4 text-[#36D399]" />;
      case 'cyclone':
        return <AlertTriangle className="w-4 h-4 text-[#EF4444]" />;
      case 'hazards':
        return <AlertTriangle className="w-4 h-4 text-[#F5B942]" />;
      case 'heatwave':
        return <Flame className="w-4 h-4 text-[#FB923C]" />;
      case 'bathymetry':
        return <Mountain className="w-4 h-4 text-[#0080B3]" />;
      default:
        return <Layers className="w-4 h-4 text-[#28D7E5]" />;
    }
  };

  const categories: LayerCategory[] = ['environment', 'ecosystem', 'safety'];

  return (
    <>
      {/* Semi-transparent Backdrop Overlay: clicking outside closes sidebar */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-label="Close Sidebar Overlay"
      />

      {/* Main Drawer Container */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 w-full sm:w-96 max-w-full ocean-glass shadow-2xl border-r border-[#16C7C7]/30 flex flex-col transform transition-transform duration-300 ease-out"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Live Ocean Parameters Drawer"
      >
        {/* Sticky Header with Prominent [X] CLOSE Button */}
        <div className="p-4 bg-[#061F2C] border-b border-[#16C7C7]/20 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#16C7C7]/15 text-[#28D7E5]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider font-heading">
                LIVE OCEAN LAYERS
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {activeParameter ? (
                  <span className="text-[#28D7E5] font-semibold uppercase">
                    Active: {activeParameter}
                  </span>
                ) : (
                  'Normal Geographic Basemap'
                )}
              </p>
            </div>
          </div>

          {/* Prominent [X] CLOSE Button */}
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#FF4D5A]/15 hover:bg-[#FF4D5A]/25 text-[#FF4D5A] hover:text-white border border-[#FF4D5A]/30 text-xs font-bold font-heading transition-colors cursor-pointer"
            aria-label="Close Layer Drawer"
          >
            <X className="w-4 h-4" />
            <span>CLOSE</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Active Parameter Opacity Slider */}
          {activeParameter && (
            <div className="p-3.5 rounded-xl bg-[#082A36]/80 border border-[#16C7C7]/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                  <Sliders className="w-3.5 h-3.5 text-[#16C7C7]" />
                  <span>Overlay Intensity / Opacity</span>
                </span>
                <span className="text-[#28D7E5] font-bold">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={e => onChangeOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#16C7C7]"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                <span>Provider: {activeProvider || 'Official Marine Service'}</span>
                <button
                  onClick={() => onSelectParameter(null)}
                  className="text-[#FF4D5A] hover:underline"
                >
                  Reset Overlay
                </button>
              </div>
            </div>
          )}

          {/* Categories */}
          {categories.map(cat => {
            const layersInCat = OCEAN_LAYERS.filter(l => l.category === cat);
            return (
              <div key={cat} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-[11px] font-bold tracking-wider text-slate-400 font-heading">
                    {CATEGORY_TITLES[cat]}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {layersInCat.length} parameters
                  </span>
                </div>

                <div className="space-y-2">
                  {layersInCat.map(layer => {
                    const isSelected = activeParameter === layer.id;

                    return (
                      <div
                        key={layer.id}
                        onClick={() =>
                          onSelectParameter(isSelected ? null : (layer.id as ActiveMarineParameter))
                        }
                        className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#082A36] border-[#16C7C7] shadow-lg ring-1 ring-[#16C7C7]/50'
                            : 'bg-[#061F2C]/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Header: Icon, Name & Select Indicator */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-2.5 pr-2">
                            <div className="mt-0.5">{getLayerIcon(layer.id)}</div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-slate-100 font-heading leading-tight">
                                  {layer.name}
                                </span>
                                {isSelected && (
                                  <span className="flex items-center space-x-0.5 text-[9px] font-mono text-[#36D399]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>ACTIVE</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 leading-snug mt-0.5">
                                {layer.shortDescription}
                              </div>
                            </div>
                          </div>

                          {/* Radio/Toggle Pill */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
                              isSelected
                                ? 'border-[#16C7C7] bg-[#16C7C7]'
                                : 'border-slate-600 bg-slate-800'
                            }`}
                          >
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                            )}
                          </div>
                        </div>

                        {/* Status & Metadata */}
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium ${getStatusBadge(
                              layer.status
                            )}`}
                          >
                            ● {layer.status}
                          </span>

                          <div className="flex items-center space-x-1.5 text-slate-400">
                            <span className="font-mono text-[10px] text-[#28D7E5]">
                              {layer.units}
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <ShieldCheck className="w-3 h-3 text-[#36D399]" />
                              <span>{layer.source}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Map Analysis Tools */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 font-heading">
                MAP ANALYSIS TOOLS
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#061F2C]/40 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Ruler className="w-4 h-4 text-[#28D7E5]" />
                  <div>
                    <div className="text-xs font-semibold text-slate-100 font-heading">
                      Geodetic Distance
                    </div>
                    <div className="text-[10px] text-slate-400">
                      2-Point Great-Circle Range & Bearing
                    </div>
                  </div>
                </div>
                <button
                  onClick={onToggleMeasurement}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isMeasurementActive
                      ? 'bg-[#16C7C7] text-slate-900 border-[#16C7C7]'
                      : 'bg-[#082A36] text-slate-200 border-slate-700 hover:border-[#16C7C7]'
                  }`}
                >
                  {isMeasurementActive ? 'ACTIVE' : 'START'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#03141F] border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <span className="font-mono">ArcGIS Topographic Basemap</span>
          <button
            onClick={() => onSelectParameter(null)}
            className="text-slate-300 hover:text-white font-mono underline"
          >
            Clear All Overlays
          </button>
        </div>
      </aside>
    </>
  );
};
