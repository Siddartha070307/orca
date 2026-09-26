import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Compass,
  Anchor,
  Wind,
  Waves,
  Languages,
  Volume2
} from 'lucide-react';

interface ReasoningStep {
  agentName: string;
  agentId: string;
  finding: string;
  signal: 'SAFE' | 'CAUTION' | 'DANGER';
  evidence: string;
}

const DEMO_STEPS: ReasoningStep[] = [
  {
    agentName: 'Environmental Agent (A01)',
    agentId: 'env_agent',
    finding: 'SST 29.8°C with moderate thermal gradient off Krishna delta (0.6°C/km). Strong upwelling plume detected.',
    signal: 'SAFE',
    evidence: 'INCOIS ChloroGIN SST & Oceansat-3 chlorophyll inversion: 1.42 mg/m³.'
  },
  {
    agentName: 'Ocean Dynamics Agent (A03)',
    agentId: 'dynamics_agent',
    finding: 'Significant wave height 1.2m at departure (05:00), rising to 1.7m by 11:00. Surface current 0.45 m/s southward.',
    signal: 'CAUTION',
    evidence: 'Copernicus Marine Physics U/V vector model & wave spectrum.'
  },
  {
    agentName: 'Atmospheric / Weather Agent (A02)',
    agentId: 'weather_agent',
    finding: '10m marine wind 14–18 knots from SE. Squall probability low (<15%) during morning hours.',
    signal: 'SAFE',
    evidence: 'Copernicus 10m wind field & IMD coastal AWS telemetry.'
  },
  {
    agentName: 'PFZ Intelligence Agent (A04)',
    agentId: 'pfz_agent',
    finding: 'High fish aggregation zone identified at 34 km bearing 118° ESE from Machilipatnam landing centre.',
    signal: 'SAFE',
    evidence: 'INCOIS PFZ operational advisory vector #2026257001 (Day 257).'
  },
  {
    agentName: 'Marine Hazard Agent (A05)',
    agentId: 'hazard_agent',
    finding: 'No active tropical cyclone in North Indian Ocean basin. Normal sea state (Green status).',
    signal: 'SAFE',
    evidence: 'IMD RSMC New Delhi Bulletin & INCOIS OSF alert matrix.'
  },
  {
    agentName: 'Vessel Safety Agent (A06)',
    agentId: 'vessel_agent',
    finding: '5-meter motorized traditional craft limited to wave heights < 1.5m and range < 30 km. 40 km offshore exceeds craft margin.',
    signal: 'CAUTION',
    evidence: 'Naval Architecture dynamic roll resonance curve for 5m traditional craft.'
  },
  {
    agentName: 'Geofencing Agent (A07)',
    agentId: 'geofence_agent',
    finding: 'Target coordinates are 185 km inside Indian EEZ. Zero risk of international maritime boundary crossing.',
    signal: 'SAFE',
    evidence: 'Geodesic buffer calculation against IMBL / EEZ limits.'
  },
  {
    agentName: 'Multi-Source Fusion Agent (A08)',
    agentId: 'fusion_agent',
    finding: 'Cross-sensor variance between satellite SST and in-situ wave buoy is 0.08 (98.2% data confidence).',
    signal: 'SAFE',
    evidence: 'Timestamp synchronization across INCOIS, Copernicus, and IMD feeds.'
  },
  {
    agentName: 'Synthesis & Orchestration Agent (A09)',
    agentId: 'synthesis_agent',
    finding: 'CONDITIONAL VENTURE APPROVED. Restrict offshore distance to 28 km (PFZ Sector A) instead of 40 km. Return to port by 10:30 IST before wave height reaches 1.7m.',
    signal: 'CAUTION',
    evidence: 'Multi-Criteria Decision Analysis (AHP) prioritizing vessel seaworthiness over fish aggregation distance.'
  }
];

export const ReasoningDemonstration: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Telugu' | 'Tamil'>('English');

  const handleStartSimulation = () => {
    setIsRunning(true);
    setCurrentStepIndex(0);

    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step < DEMO_STEPS.length) {
        setCurrentStepIndex(step);
      } else {
        clearInterval(timer);
        setIsRunning(false);
      }
    }, 900);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStepIndex(-1);
  };

  const getSignalBadge = (signal: ReasoningStep['signal']) => {
    switch (signal) {
      case 'SAFE':
        return 'bg-[#36D399]/15 text-[#36D399] border-[#36D399]/30';
      case 'CAUTION':
        return 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30';
      case 'DANGER':
        return 'bg-[#FF4D5A]/15 text-[#FF4D5A] border-[#FF4D5A]/30';
    }
  };

  const synthesizedTelugu =
    'నియంత్రిత అనుమతి: మీ 5-మీటర్ల పడవతో 40 కి.మీ వెళ్లడం ప్రమాదకరం. 28 కి.మీ దూరంలో ఉన్న మచిలీపట్నం PFZ జోన్ వరకు మాత్రమే వెళ్లండి. ఉదయం 10:30 గంటలకు అలలు 1.7 మీటర్లకు పెరగకముందే తీరానికి తిరిగి రండి.';

  const synthesizedTamil =
    'நிபந்தனை அனுமதி: உங்கள் 5-மீட்டர் படகில் 40 கி.மீ செல்ல வேண்டாம். 28 கி.மீ தூரத்திலுள்ள மச்சிலிப்பட்டினம் PFZ மண்டலம் வரை மட்டும் செல்லவும். காலை 10:30 மணிக்கு அலைகள் 1.7 மீட்டராக உயர்வதற்கு முன் துறைமுகம் திரும்பவும்.';

  const synthesizedEnglish =
    'CONDITIONAL CLEARANCE: Venturing 40 km offshore exceeds safety margins for a 5-meter motorized craft due to wave shoaling (1.7m by midday). Recommended alternative: Venture up to 28 km (PFZ Sector A, bearing 118° ESE). Must return to harbor by 10:30 IST.';

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#16C7C7]/10 text-[#28D7E5] font-mono text-xs mb-3 border border-[#16C7C7]/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>COLLABORATIVE DECISION SYNTHESIS</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-white font-heading tracking-tight mb-4">
          HOW ORCA REASONS IN PRACTICE
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Witness how the 9 agents correlate raw multi-source marine feeds, reconcile conflicting safety constraints, and synthesize actionable maritime advisories.
        </p>
        <div className="mt-2 text-xs font-mono text-slate-400">
          (Demonstration of collaborative reasoning flow)
        </div>
      </div>

      {/* Interactive Scenario Card */}
      <div className="p-6 sm:p-8 rounded-3xl ocean-glass border border-[#16C7C7]/30 shadow-2xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase text-[#28D7E5] tracking-wider font-semibold">
              SAMPLE MARITIME QUERY
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white font-heading">
              "Can a 5-meter motorized fishing craft travel 40 km offshore from Machilipatnam tomorrow at 05:00 IST?"
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1 font-mono">
              <span className="flex items-center space-x-1">
                <Anchor className="w-3.5 h-3.5 text-[#16C7C7]" />
                <span>Craft: 5m Motorized</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Compass className="w-3.5 h-3.5 text-[#28D7E5]" />
                <span>Location: Machilipatnam (16.18°N, 81.14°E)</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Waves className="w-3.5 h-3.5 text-[#8B6CFF]" />
                <span>Destination: 40 km Offshore PFZ</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {currentStepIndex >= 0 && (
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-xl text-xs font-mono text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={handleStartSimulation}
              disabled={isRunning}
              className="px-5 py-2.5 rounded-xl text-xs font-heading font-bold text-slate-900 bg-[#16C7C7] hover:bg-[#28D7E5] shadow-lg shadow-[#16C7C7]/20 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-900" />
              <span>{isRunning ? 'Synthesizing...' : 'Simulate Collaborative Reasoning'}</span>
            </button>
          </div>
        </div>

        {/* Step-by-Step Multi-Agent Stream */}
        <div className="space-y-3">
          {DEMO_STEPS.map((step, idx) => {
            const isVisible = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            if (!isVisible) {
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-800/50 bg-[#03141F]/30 opacity-40 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-slate-500">{step.agentName}</span>
                  <span className="text-[10px] font-mono text-slate-600">Pending collaborative turn...</span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-left-2 ${
                  isCurrent
                    ? 'bg-[#082A36] border-[#16C7C7] shadow-xl'
                    : 'bg-[#061F2C]/60 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white font-heading">
                      {step.agentName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${getSignalBadge(
                        step.signal
                      )}`}
                    >
                      {step.signal}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    Source: {step.evidence}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {step.finding}
                </p>
              </div>
            );
          })}
        </div>

        {/* Final Synthesized Output Card */}
        {currentStepIndex === DEMO_STEPS.length - 1 && (
          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-[#082A36] to-[#03141F] border-2 border-[#16C7C7] shadow-2xl animate-in zoom-in-95 duration-400 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#36D399]" />
                <span className="text-sm font-bold text-white font-heading tracking-wider">
                  ORCA SYNTHESIZED ADVISORY
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                  CONDITIONAL APPROVAL
                </span>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center space-x-1.5 bg-[#061F2C] p-1 rounded-lg border border-slate-700">
                <Languages className="w-3.5 h-3.5 text-slate-400 ml-1" />
                {(['English', 'Telugu', 'Tamil'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                      selectedLanguage === lang
                        ? 'bg-[#16C7C7] text-slate-900 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Synthesized Text in Selected Vernacular Language */}
            <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
              {selectedLanguage === 'Telugu' && synthesizedTelugu}
              {selectedLanguage === 'Tamil' && synthesizedTamil}
              {selectedLanguage === 'English' && synthesizedEnglish}
            </p>

            {/* Evidence & Decision Trace Summary */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-[#28D7E5]" />
                <span>Audio broadcast ready for VHF / NavIC receivers</span>
              </div>
              <span className="text-[11px] text-[#36D399]">
                Consensus Confidence: 98.4% (All 9 Agents Reconciled)
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
