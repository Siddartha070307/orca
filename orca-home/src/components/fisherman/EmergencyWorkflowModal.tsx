import React, { useState } from 'react';
import { X, AlertTriangle, Radio, ShieldAlert, PhoneCall, CheckCircle2 } from 'lucide-react';
import { FishingSession, SafetyAlert } from '../../types/fisherman';

interface EmergencyWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: FishingSession | null;
  onTriggerEmergency: (alert: SafetyAlert) => void;
}

export const EmergencyWorkflowModal: React.FC<EmergencyWorkflowModalProps> = ({
  isOpen,
  onClose,
  session,
  onTriggerEmergency
}) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen || !session) return null;

  const handleDispatchEmergency = () => {
    const alert: SafetyAlert = {
      id: `SOS-${Date.now()}`,
      type: 'SOS_EMERGENCY',
      title: '🚨 CRITICAL DISTRESS / SOS BROADCAST',
      severity: 'CRITICAL',
      location: session.currentLocation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
      source: 'ORCA Emergency Dispatcher (Simulated Mode)',
      actualDataValue: `Coords: ${session.currentLocation.lat.toFixed(4)}° N, ${session.currentLocation.lon.toFixed(4)}° E`,
      recommendation: 'Immediate rescue response activated. Nearest SAR station: Machilipatnam Coast Guard Detachment.',
      isSimulated: true,
      acknowledged: false
    };

    onTriggerEmergency(alert);
    setConfirmed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0a0f18] rounded-2xl shadow-2xl border-2 border-red-500/80 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Red Hazard Header */}
        <div className="p-4 bg-red-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
            <div>
              <h2 className="text-base font-black tracking-wider uppercase font-heading">
                Maritime Emergency & SOS Protocol
              </h2>
              <p className="text-[11px] font-mono text-red-100">
                SAR Beacon Dispatch • NavIC Satellite Distress Simulator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-red-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!confirmed ? (
            <>
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-mono text-red-200 space-y-1">
                <div className="font-bold">⚠️ CONFIRM EMERGENCY TRANSMISSION</div>
                <p className="text-[11px] text-red-300">
                  This action triggers an instant high-priority SOS emergency packet for the active fishing vessel across all simulated communication channels.
                </p>
              </div>

              {/* Vessel & Fisherman Details */}
              <div className="p-4 rounded-xl bg-[#061F2C] border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Vessel:</span>
                  <span className="text-white font-bold">{session.vesselName} ({session.vesselId})</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Master Fisherman:</span>
                  <span className="text-white font-bold">{session.fishermanName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Active Session ID:</span>
                  <span className="text-[#28D7E5] font-bold">{session.sessionId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Latest Coordinates:</span>
                  <span className="text-red-400 font-bold">
                    {session.currentLocation.lat.toFixed(4)}° N, {session.currentLocation.lon.toFixed(4)}° E
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Distance from Base Port:</span>
                  <span className="text-white font-bold">{session.distanceFromDepartureKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">Emergency Contact:</span>
                  <span className="text-white">{session.emergencyContact}</span>
                </div>
              </div>

              {/* Strict Integrity Disclaimer */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-400 text-center">
                DEMO EMERGENCY EVENT — In production, connects directly to MRCC / Coast Guard Toll-Free 1554.
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDispatchEmergency}
                  className="flex-1 py-2.5 rounded-xl text-xs font-heading font-black bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/30 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 animate-spin" />
                  <span>TRANSMIT SOS NOW</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400">
                <Radio className="w-7 h-7 animate-pulse" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white font-heading uppercase tracking-wider">
                  Emergency Event Transmitted
                </h3>
                <p className="text-xs text-red-300 font-mono mt-1">
                  Alert Packet SOS-{Date.now()} logged into ORCA Safety Center
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#061F2C] border border-red-500/30 text-left text-xs font-mono space-y-2">
                <div className="flex items-center space-x-2 text-[#36D399]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NavIC Marine Beacon: Broadcasted (Simulated)</span>
                </div>
                <div className="flex items-center space-x-2 text-[#36D399]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Coast Guard Helpline 1554: Dispatch Generated</span>
                </div>
                <div className="flex items-center space-x-2 text-[#36D399]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Next of Kin SMS: Queued for Delivery</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmed(false);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-heading font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 transition-colors"
              >
                Return to Live Session HUD
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
