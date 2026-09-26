import React, { useState } from 'react';
import { X, Anchor, Compass, Clock, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Fisherman, Vessel, FishingSession } from '../../types/fisherman';
import { OFFICIAL_LANDING_CENTRES } from '../../services/fishermanStorage';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fishermen: Fisherman[];
  vessels: Vessel[];
  onCreateSession: (session: FishingSession) => void;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  fishermen,
  vessels,
  onCreateSession
}) => {
  const [selectedFishermanId, setSelectedFishermanId] = useState(fishermen[0]?.id || '');
  const [selectedVesselId, setSelectedVesselId] = useState(vessels[0]?.id || '');
  const [departureHarbour, setDepartureHarbour] = useState(OFFICIAL_LANDING_CENTRES[0].name);
  const [intendedArea, setIntendedArea] = useState('Sector 6/7 (PFZ Advisory 118° ESE off Machilipatnam)');
  const [fishingActivity, setFishingActivity] = useState('Pelagic Gillnetting & Handline');
  const [crewCount, setCrewCount] = useState(4);
  const [expectedDurationHours, setExpectedDurationHours] = useState(8);
  const [commPreference, setCommPreference] = useState<FishingSession['communicationPreference']>('NavIC / Radio');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const fisherman = fishermen.find(f => f.id === selectedFishermanId) || fishermen[0];
    const vessel = vessels.find(v => v.id === selectedVesselId) || vessels[0];
    const harbourObj = OFFICIAL_LANDING_CENTRES.find(c => c.name === departureHarbour) || OFFICIAL_LANDING_CENTRES[0];

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const sessionId = `SESSION-${todayStr}-${randomSeq}`;

    const now = new Date();
    const returnTime = new Date(now.getTime() + expectedDurationHours * 3600000);

    const newSession: FishingSession = {
      sessionId,
      fishermanId: fisherman.id,
      fishermanName: fisherman.fullName,
      vesselId: vessel.id,
      vesselName: vessel.name,
      departureHarbour: harbourObj.name,
      departureLocation: { lat: harbourObj.lat, lon: harbourObj.lon },
      departureTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
      expectedReturnTime: returnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
      fishingPurpose: 'Commercial Artisanal Fishing',
      fishingActivityType: fishingActivity,
      intendedFishingArea: intendedArea,
      crewCount,
      emergencyContact: `${fisherman.emergencyContactName} (${fisherman.emergencyContactNumber})`,
      preferredLanguage: fisherman.preferredLanguage,
      communicationPreference: commPreference,
      status: 'ACTIVE_AT_SEA',
      currentLocation: { lat: harbourObj.lat + 0.05, lon: harbourObj.lon + 0.08 },
      distanceFromDepartureKm: 8.5,
      durationSeconds: 120, // starts fresh
      currentTrack: [
        {
          lat: harbourObj.lat,
          lon: harbourObj.lon,
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          speedKnots: 0,
          headingDeg: 120,
          isSimulated: true
        },
        {
          lat: harbourObj.lat + 0.05,
          lon: harbourObj.lon + 0.08,
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          speedKnots: 5.5,
          headingDeg: 120,
          isSimulated: true
        }
      ],
      alertsReceived: [],
      safetyScore: 88,
      isDemoTracking: true
    };

    onCreateSession(newSession);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-xl ocean-glass rounded-2xl shadow-2xl border border-[#16C7C7]/30 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#061F2C] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#36D399]/15 text-[#36D399]">
              <Anchor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading tracking-wider uppercase">
                Initiate New Fishing Sea-Venture Session
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Link Registered Fisherman + Registered Vessel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Link Fisherman + Vessel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Select Master Fisherman *
              </label>
              <select
                value={selectedFishermanId}
                onChange={e => setSelectedFishermanId(e.target.value)}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              >
                {fishermen.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} ({f.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Select Registered Vessel *
              </label>
              <select
                value={selectedVesselId}
                onChange={e => setSelectedVesselId(e.target.value)}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              >
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.id}) - {v.vesselType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Departure Landing Centre *
              </label>
              <select
                value={departureHarbour}
                onChange={e => setDepartureHarbour(e.target.value)}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              >
                {OFFICIAL_LANDING_CENTRES.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Expected Duration (Hours)
              </label>
              <input
                type="number"
                min="2"
                max="36"
                value={expectedDurationHours}
                onChange={e => setExpectedDurationHours(parseInt(e.target.value))}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
              Intended Fishing Destination / Zone *
            </label>
            <input
              type="text"
              required
              value={intendedArea}
              onChange={e => setIntendedArea(e.target.value)}
              className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
            />
            <p className="text-[10px] text-[#28D7E5] font-mono mt-1">
              ⚡ INCOIS PFZ Sector 6/7 thermal-chlorophyll front is currently recommended (Bearing 118° ESE).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Onboard Crew Count *
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={crewCount}
                onChange={e => setCrewCount(parseInt(e.target.value))}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                Primary Distress / Alert Channel
              </label>
              <select
                value={commPreference}
                onChange={e => setCommPreference(e.target.value as any)}
                className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
              >
                <option value="NavIC / Radio">NavIC Marine Receiver / VHF Ch 16</option>
                <option value="SMS">SMS Cellular Broadcast</option>
                <option value="WhatsApp">WhatsApp Community Emergency</option>
                <option value="Push Notification">ORCA Mobile App Push</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-heading font-bold bg-[#36D399] hover:bg-[#2ecc71] text-slate-900 transition-all shadow-lg shadow-[#36D399]/20 cursor-pointer flex items-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>START FISHING SESSION NOW</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
