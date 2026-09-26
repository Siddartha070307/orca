import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Compass, Waves, ArrowRight, Loader2 } from 'lucide-react';
import { searchLocation, GeocodingResult } from '../../services/geocodingService';

interface LocationSearchProps {
  onSelectLocation: (result: GeocodingResult) => void;
}

const QUICK_CHIPS = [
  'Machilipatnam',
  'Visakhapatnam',
  'Kakinada',
  'Chennai',
  'Bay of Bengal',
  'Arabian Sea'
];

export const LocationSearch: React.FC<LocationSearchProps> = ({ onSelectLocation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounce search queries
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      const res = await searchLocation(query);
      setResults(res);
      setLoading(false);
      setIsOpen(res.length > 0);
    }, 280);

    return () => clearTimeout(handler);
  }, [query]);

  // Handle outside click to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: GeocodingResult) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelectLocation(item);
  };

  const handleChipClick = async (name: string) => {
    setQuery(name);
    setLoading(true);
    const res = await searchLocation(name);
    setLoading(false);
    if (res.length > 0) {
      handleSelect(res[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none text-slate-400">
          {loading ? (
            <Loader2 className="w-5 h-5 text-[#28D7E5] animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-[#16C7C7]" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search a coastal location, port, city or ocean region (e.g. Machilipatnam, Visakhapatnam)..."
          className="w-full pl-12 pr-12 py-3.5 bg-[#061F2C]/90 text-slate-100 placeholder:text-slate-400 text-sm md:text-base rounded-2xl border border-[#16C7C7]/30 shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#16C7C7] focus:border-transparent transition-all backdrop-blur-md"
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-4 text-xs font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
          >
            ESC
          </button>
        )}
      </div>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 px-1">
        <span className="text-[11px] text-slate-400 font-mono mr-1">Quick Sectors:</span>
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#061F2C]/60 hover:bg-[#082A36] text-slate-300 hover:text-[#28D7E5] border border-slate-800 hover:border-[#16C7C7]/40 transition-all font-heading cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Geocoding Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 ocean-glass rounded-xl shadow-2xl border border-[#16C7C7]/30 overflow-hidden divide-y divide-slate-800 animate-in fade-in slide-in-from-top-2">
          {results.map((r, idx) => (
            <div
              key={idx}
              onClick={() => handleSelect(r)}
              className="p-3 hover:bg-[#082A36]/80 cursor-pointer flex items-center justify-between transition-colors group"
            >
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 p-1.5 rounded-lg bg-[#16C7C7]/15 text-[#28D7E5] group-hover:bg-[#16C7C7]/25 transition-colors">
                  {r.isCoastal ? <Waves className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-100 font-heading">
                      {r.name}
                    </span>
                    {r.isCoastal && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#36D399]/15 text-[#36D399] border border-[#36D399]/30">
                        Coastal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.adminRegion}, {r.country}
                  </div>
                  {r.oceanRegionName && (
                    <div className="text-[10px] text-[#16C7C7] font-mono mt-0.5 flex items-center space-x-1">
                      <Compass className="w-3 h-3 inline-block" />
                      <span>Ocean Context: {r.oceanRegionName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400">
                  {r.latitude.toFixed(2)}°N, {r.longitude.toFixed(2)}°E
                </div>
                <div className="text-xs text-[#28D7E5] font-medium flex items-center justify-end space-x-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Fly to location</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
