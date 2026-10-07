import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole, UserRole } from '../../context/RoleContext';
import { useI18n, SUPPORTED_LANGUAGES, LanguageCode } from '../../utils/i18n';
import {
  Anchor,
  ShieldCheck,
  Compass,
  ArrowRight,
  ShieldAlert,
  Waves,
  Database,
  Radio,
  FileSpreadsheet,
  Globe,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const RoleSelectScreen: React.FC = () => {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const { t, language, setLanguage } = useI18n();

  const handleSelectRole = (selectedRole: UserRole) => {
    navigate(`/login/${selectedRole}`);
  };

  const ROLES_CONFIG: Array<{
    id: UserRole;
    title: string;
    tier: string;
    desc: string;
    icon: React.ReactNode;
    features: string[];
    accentColor: string;
    borderHover: string;
    buttonBg: string;
    badgeBg: string;
  }> = [
    {
      id: 'fisherman',
      title: t('roles.fisherman.title', 'Fisherman / Vessel Operator'),
      tier: t('roles.fisherman.tier', 'OPERATIONAL TIER'),
      desc: t('roles.fisherman.desc', 'Near-shore and deep-sea advisory engine with conversational AI, INCOIS PFZ coordinates, sea-state warnings, and 3D simulation.'),
      icon: <Anchor className="w-8 h-8 text-[#16C7C7]" />,
      features: [
        t('roles.fisherman.f1', 'Natural language & Indic voice advisory feeds'),
        t('roles.fisherman.f2', 'INCOIS Potential Fishing Zones (PFZ) & bearing vectors'),
        t('roles.fisherman.f3', 'Weather risk assessments & multi-channel dispatch')
      ],
      accentColor: '#16C7C7',
      borderHover: 'hover:border-[#16C7C7]/60 hover:shadow-[0_0_25px_rgba(22,199,199,0.25)]',
      buttonBg: 'bg-gradient-to-r from-[#0d9488] to-[#16C7C7] hover:from-[#0f766e] hover:to-[#28D7E5] text-slate-950 font-bold',
      badgeBg: 'bg-[#16C7C7]/15 text-[#28D7E5] border-[#16C7C7]/30'
    },
    {
      id: 'authority',
      title: t('roles.authority.title', 'Port Authority & Coast Guard'),
      tier: t('roles.authority.tier', 'SURVEILLANCE & ENFORCEMENT'),
      desc: t('roles.authority.desc', 'Surveillance console with high-priority restricted naval & marine sanctuary perimeters, cross-vessel compliance, and threat alerts.'),
      icon: <ShieldCheck className="w-8 h-8 text-[#F5B942]" />,
      features: [
        t('roles.authority.f1', 'Real-time restricted zone geofencing (Karwar, Mannar, Gahirmatha)'),
        t('roles.authority.f2', 'Cross-sector fleet safety verdicts (UNSAFE / CAUTION priority)'),
        t('roles.authority.f3', '9-Agent deterministic compliance audit trace')
      ],
      accentColor: '#F5B942',
      borderHover: 'hover:border-[#F5B942]/60 hover:shadow-[0_0_25px_rgba(245,185,66,0.25)]',
      buttonBg: 'bg-gradient-to-r from-[#d97706] to-[#F5B942] hover:from-[#b45309] hover:to-[#fbbf24] text-slate-950 font-bold',
      badgeBg: 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30'
    },
    {
      id: 'researcher',
      title: t('roles.researcher.title', 'Marine Scientist & Oceanographer'),
      tier: t('roles.researcher.tier', 'EXPLORATORY SCIENTIFIC SUITE'),
      desc: t('roles.researcher.desc', 'Data-first console with interactive multi-source filters, multi-sector parameter trend explorer, expanded agent reasoning, and raw CSV/PDF export.'),
      icon: <Compass className="w-8 h-8 text-[#8B6CFF]" />,
      features: [
        t('roles.researcher.f1', 'Authoritative source filtering (INCOIS, MOSDAC, Copernicus, IMD)'),
        t('roles.researcher.f2', 'Multi-sector SST, Chlorophyll, Wave, Wind comparison'),
        t('roles.researcher.f3', 'Comprehensive PFZ matrix & structured data export')
      ],
      accentColor: '#8B6CFF',
      borderHover: 'hover:border-[#8B6CFF]/60 hover:shadow-[0_0_25px_rgba(139,108,255,0.25)]',
      buttonBg: 'bg-gradient-to-r from-[#6d28d9] to-[#8B6CFF] hover:from-[#5b21b6] hover:to-[#a78bfa] text-white font-bold',
      badgeBg: 'bg-[#8B6CFF]/15 text-[#a78bfa] border-[#8B6CFF]/30'
    }
  ];

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#16C7C7]/30 selection:text-[#28D7E5]">
      {/* Top Header Bar */}
      <header className="ocean-glass border-b border-[#16C7C7]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#16C7C7]/40 shadow-lg">
            <img src="/orca-logo.svg" alt="ORCA" className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#36D399] border-2 border-[#03141F]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-widest text-white font-heading">
                ORCA
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16C7C7]/15 text-[#28D7E5] border border-[#16C7C7]/30">
                ISRO • SIH 26176
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
              Marine EcOsystem Reasoning with Collaborative Agents
            </p>
          </div>
        </div>

        {/* Language selector & Telemetry */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs">
            <Globe className="w-3.5 h-3.5 text-[#16C7C7]" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#061F2C] text-slate-100">
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-[#061F2C]/80 border border-slate-700/60 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#36D399] animate-pulse" />
            <span className="text-[11px] font-mono text-slate-300">
              GATEWAY: <span className="text-[#36D399] font-medium">READY</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col justify-center">
        {/* Title & Introduction */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#16C7C7]/10 text-[#28D7E5] font-mono text-xs mb-3 border border-[#16C7C7]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ROLE-BASED AUTHENTICATION GATE</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white font-heading tracking-tight mb-3">
            {t('roles.title', 'ORCA MARINE INTELLIGENCE PLATFORM')}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {t(
              'roles.subtitle',
              'Select your operational role to access dedicated marine situational intelligence, surveillance, or scientific analytics.'
            )}
          </p>
        </div>

        {/* 3 Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {ROLES_CONFIG.map((roleCard) => (
            <div
              key={roleCard.id}
              className={`rounded-2xl ocean-glass border border-[#16C7C7]/20 p-6 flex flex-col justify-between transition-all duration-300 ${roleCard.borderHover} relative group`}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-[#03141F]/80 border border-slate-700/80 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {roleCard.icon}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${roleCard.badgeBg}`}
                  >
                    {roleCard.tier}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white font-heading mb-2">
                  {roleCard.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  {roleCard.desc}
                </p>

                {/* Features List */}
                <div className="space-y-2.5 pt-4 border-t border-slate-800/80 mb-6">
                  {roleCard.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                      <CheckCircle2
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: roleCard.accentColor }}
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Action Button */}
              <button
                onClick={() => handleSelectRole(roleCard.id)}
                className={`w-full py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer ${roleCard.buttonBg}`}
              >
                <span>Login as {roleCard.id.toUpperCase()}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>

        {/* Restricted Administrator Entry — navigation only.
            Authentication is enforced exclusively by the existing
            /admin/authority route gate (AuthorityAdminConsole). */}
        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-md rounded-xl ocean-glass border border-[#F5B942]/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-[#F5B942]/10 border border-[#F5B942]/30 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-[#F5B942]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-semibold tracking-widest text-[#F5B942]">
                  SYSTEM ADMINISTRATION
                </p>
                <p className="text-xs text-slate-400 truncate">
                  Restricted administrative access
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/authority')}
              className="w-full sm:w-auto shrink-0 justify-center px-3.5 py-2 rounded-lg text-xs font-bold bg-[#F5B942]/15 border border-[#F5B942]/40 text-[#F5B942] hover:bg-[#F5B942]/25 hover:border-[#F5B942]/70 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <span>Administrator Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-10 text-center">
          <p className="text-xs font-mono text-slate-400">
            Secure Role-Based Authentication • Server-Validated OTP &amp; Official Credentials • SIH 26176
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="ocean-glass border-t border-[#16C7C7]/20 px-4 py-4 text-center text-xs text-slate-500 font-mono">
        ORCA Platform • SIH 26176 (ISRO) • Powered by INCOIS, MOSDAC, Copernicus Marine &amp; IMD Data Streams
      </footer>
    </div>
  );
};
