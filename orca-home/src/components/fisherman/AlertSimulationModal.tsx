import React from 'react';
import { X, Waves, Wind, AlertTriangle, Radio, Clock, ShieldAlert, Sparkles, Compass } from 'lucide-react';
import { SafetyAlert, AlertSeverity } from '../../types/fisherman';

interface AlertSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLat: number;
  currentLon: number;
  onSimulateAlert: (alert: SafetyAlert) => void;
}

interface SimOption {
  type: SafetyAlert['type'];
  title: string;
  severity: AlertSeverity;
  source: string;
  dataValue: string;
  recommendation: string;
  icon: React.ReactNode;
  btnColor: string;
}

export const AlertSimulationModal: React.FC<AlertSimulationModalProps> = ({
  isOpen,
  onClose,
  currentLat,
  currentLon,
  onSimulateAlert
}) => {
  if (!isOpen) return null;

  const simulationOptions: SimOption[] = [
    {
      type: 'HIGH_WAVE',
      title: 'High Wave Surge Alert (SWAN Model)',
      severity: 'WARNING',
      source: 'INCOIS Ocean State Forecast (Simulated)',
      dataValue: 'Significant Wave Height: 3.8 m (Threshold 2.0 m)',
      recommendation: 'Rough sea condition detected. Motorized traditional craft must curtail offshore venture and head to safe harbour.',
      icon: <Waves className="w-5 h-5 text-[#FF4D5A]" />,
      btnColor: 'border-[#FF4D5A]/40 hover:bg-[#FF4D5A]/15 text-[#FF4D5A]'
    },
    {
      type: 'STRONG_WIND',
      title: 'Squally Wind Warning (10m WRF Model)',
      severity: 'WARNING',
      source: 'IMD / NCMRWF Boundary Layer (Simulated)',
      dataValue: 'Wind Speed: 24.5 m/s (47 knots - Gale Force)',
      recommendation: 'Squally weather with gusts up to 55 knots. Steer away from open sea and anchor in protected estuary.',
      icon: <Wind className="w-5 h-5 text-[#F5B942]" />,
      btnColor: 'border-[#F5B942]/40 hover:bg-[#F5B942]/15 text-[#F5B942]'
    },
    {
      type: 'CYCLONE_RISK',
      title: 'Tropical Cyclone Proximity Alert',
      severity: 'CRITICAL',
      source: 'RSMC New Delhi Warning Bulletin (Simulated)',
      dataValue: 'Deep Depression located 85 km ESE, tracking WNW at 18 km/h',
      recommendation: 'EVACUATE ACTIVE FISHING GROUND IMMEDIATELY. Direct bearing toward Machilipatnam Landing Centre.',
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      btnColor: 'border-red-500/50 hover:bg-red-500/20 text-red-400'
    },
    {
      type: 'RESTRICTED_ZONE',
      title: 'Maritime Boundary Geofence Caution',
      severity: 'CAUTION',
      source: 'Indian Coast Guard Geofence Engine (Simulated)',
      dataValue: 'Distance to International Maritime Boundary: 4.8 NM',
      recommendation: 'Vessel approaching international border buffer. Adjust heading to 270° West to remain within Indian EEZ.',
      icon: <Compass className="w-5 h-5 text-[#8B6CFF]" />,
      btnColor: 'border-[#8B6CFF]/40 hover:bg-[#8B6CFF]/15 text-[#8B6CFF]'
    },
    {
      type: 'COMM_LOSS',
      title: 'VHF / AIS Heartbeat Interruption',
      severity: 'CAUTION',
      source: 'Coastal Vessel Monitoring Network (Simulated)',
      dataValue: 'No AIS/VHF acknowledgment in last 45 minutes',
      recommendation: 'Perform radio check on VHF Channel 16. Verify 12V battery connections to NavIC transponder.',
      icon: <Radio className="w-5 h-5 text-[#28D7E5]" />,
      btnColor: 'border-[#28D7E5]/40 hover:bg-[#28D7E5]/15 text-[#28D7E5]'
    },
    {
      type: 'RETURN_REMINDER',
      title: 'Sunset & Sea-State Return Reminder',
      severity: 'SAFE',
      source: 'ORCA Safe-Return Assistant (Automated)',
      dataValue: 'Estimated travel time to landing harbour: 2h 15m (Sunset: 18:14 IST)',
      recommendation: 'Begin haul of fishing gear to ensure daylight arrival at Machilipatnam harbour.',
      icon: <Clock className="w-5 h-5 text-[#36D399]" />,
      btnColor: 'border-[#36D399]/40 hover:bg-[#36D399]/15 text-[#36D399]'
    }
  ];

  const handleSelect = (opt: SimOption) => {
    const alert: SafetyAlert = {
      id: `SIM-ALT-${Date.now()}`,
      type: opt.type,
      title: `[SIMULATION] ${opt.title}`,
      severity: opt.severity,
      location: { lat: currentLat, lon: currentLon },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
      source: opt.source,
      actualDataValue: opt.dataValue,
      recommendation: opt.recommendation,
      isSimulated: true,
      acknowledged: false
    };

    onSimulateAlert(alert);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl ocean-glass rounded-2xl shadow-2xl border border-[#F5B942]/40 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#061F2C] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#F5B942]/15 text-[#F5B942]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading tracking-wider uppercase">
                SIH Judge Demonstration — Alert Simulation Suite
              </h2>
              <p className="text-[11px] text-[#F5B942] font-mono">
                Select a scenario to demonstrate real-time alert dispatch & reasoning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-400 text-center">
            DEMONSTRATION ONLY: Injected alerts are clearly tagged as SIMULATED to preserve data integrity.
          </div>

          {simulationOptions.map((opt, idx) => (
            <div
              key={idx}
              onClick={() => handleSelect(opt)}
              className="p-3.5 rounded-xl bg-[#061F2C]/60 hover:bg-[#082A36] border border-slate-800 hover:border-[#16C7C7]/50 cursor-pointer transition-all flex items-start justify-between space-x-4"
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-black/30 mt-0.5">{opt.icon}</div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white font-heading">{opt.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                        opt.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : opt.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : opt.severity === 'CAUTION'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {opt.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono mt-0.5">{opt.dataValue}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{opt.recommendation}</div>
                </div>
              </div>

              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors shrink-0 cursor-pointer ${opt.btnColor}`}
              >
                Trigger
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#03141F] border-t border-slate-800 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
