import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Activity,
  ShieldCheck,
  Compass,
  Anchor,
  RotateCcw,
  Globe,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useRole, UserRole } from '../../context/RoleContext';
import { useI18n, SUPPORTED_LANGUAGES, LanguageCode } from '../../utils/i18n';

interface HeaderProps {
  onOpenLayers?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLayers }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, switchRole } = useRole();
  const { t, language, setLanguage } = useI18n();

  const handleLiveLayersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname !== '/overview') {
      navigate('/overview');
      setTimeout(() => {
        const el = document.getElementById('live-ocean-section');
        el?.scrollIntoView({ behavior: 'smooth' });
        onOpenLayers?.();
      }, 100);
    } else {
      const el = document.getElementById('live-ocean-section');
      el?.scrollIntoView({ behavior: 'smooth' });
      onOpenLayers?.();
    }
  };

  const handleAboutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname !== '/overview') {
      navigate('/overview');
      setTimeout(() => {
        document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getRoleBadge = (activeRole: UserRole) => {
    switch (activeRole) {
      case 'fisherman':
        return {
          label: 'FISHERMAN',
          icon: <Anchor className="w-3 h-3 text-[#16C7C7]" />,
          classes: 'bg-[#16C7C7]/15 text-[#28D7E5] border-[#16C7C7]/30'
        };
      case 'authority':
        return {
          label: 'AUTHORITY',
          icon: <ShieldCheck className="w-3 h-3 text-[#F5B942]" />,
          classes: 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30'
        };
      case 'researcher':
        return {
          label: 'RESEARCHER',
          icon: <Compass className="w-3 h-3 text-[#a78bfa]" />,
          classes: 'bg-[#8B6CFF]/15 text-[#a78bfa] border-[#8B6CFF]/30'
        };
    }
  };

  const roleBadge = role ? getRoleBadge(role) : null;

  return (
    <header className="sticky top-0 z-50 w-full ocean-glass border-b border-[#16C7C7]/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: ORCA Branding + Active Role Indicator */}
        <div className="flex items-center space-x-3.5">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#16C7C7]/40 shadow-lg group-hover:border-[#28D7E5] transition-all">
              <img src="/orca-logo.svg" alt="ORCA" className="w-7 h-7" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#36D399] border-2 border-[#03141F]" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-widest text-white font-heading">
                  ORCA
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#16C7C7]/15 text-[#28D7E5] border border-[#16C7C7]/30">
                  ISRO • SIH 26176
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
                Marine EcOsystem Reasoning with Collaborative Agents
              </p>
            </div>
          </Link>

          {/* Active Role Pill */}
          {roleBadge && (
            <div
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold ${roleBadge.classes}`}
              title="Currently active session role"
            >
              {roleBadge.icon}
              <span>{roleBadge.label}</span>
            </div>
          )}
        </div>

        {/* Center: Dynamic Navigation Links based on role */}
        <nav className="hidden lg:flex items-center space-x-1 lg:space-x-2 font-heading text-xs">
          {/* Role specific primary link */}
          {role === 'fisherman' && (
            <Link
              to="/fisherman"
              className={`px-3 py-1.5 rounded-lg font-bold tracking-wide transition-colors ${
                location.pathname === '/fisherman' || location.pathname === '/'
                  ? 'text-[#28D7E5] bg-[#16C7C7]/15 border border-[#16C7C7]/30 shadow-[0_0_10px_rgba(22,199,199,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              FISHERMAN ENGINE
            </Link>
          )}

          {role === 'authority' && (
            <Link
              to="/authority"
              className={`px-3 py-1.5 rounded-lg font-bold tracking-wide transition-colors ${
                location.pathname === '/authority' || location.pathname === '/'
                  ? 'text-[#F5B942] bg-[#F5B942]/15 border border-[#F5B942]/30 shadow-[0_0_10px_rgba(245,185,66,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              AUTHORITY CONSOLE
            </Link>
          )}

          {role === 'researcher' && (
            <Link
              to="/researcher"
              className={`px-3 py-1.5 rounded-lg font-bold tracking-wide transition-colors ${
                location.pathname === '/researcher' || location.pathname === '/'
                  ? 'text-[#a78bfa] bg-[#8B6CFF]/15 border border-[#8B6CFF]/30 shadow-[0_0_10px_rgba(139,108,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              RESEARCH CONSOLE
            </Link>
          )}

          {/* Primary Highlighted Live Ocean Layers Nav Button */}
          <button
            onClick={handleLiveLayersClick}
            className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[#28D7E5] font-bold tracking-wide hover:bg-[#16C7C7]/10 transition-all group"
          >
            <Layers className="w-3.5 h-3.5 text-[#28D7E5]" />
            <span>LIVE OCEAN LAYERS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#36D399] animate-ping ml-1" />
          </button>

          <Link
            to="/3d"
            className="px-3 py-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors font-medium"
          >
            3D SIMULATION
          </Link>

          <button
            onClick={handleAboutClick}
            className="px-3 py-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors font-medium"
          >
            ABOUT
          </button>
        </nav>

        {/* Right: Role Switcher + Language Selector + Telemetry Status */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Switch Role Button */}
          {role && (
            <button
              onClick={() => {
                switchRole();
                navigate('/');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#082A36] border border-[#16C7C7]/40 text-[#28D7E5] hover:bg-[#16C7C7]/20 hover:border-[#28D7E5] transition-all text-xs font-mono font-medium shadow-sm cursor-pointer"
              title="Change active profile (Fisherman / Authority / Researcher)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('roles.switchRole', 'Switch Role')}</span>
            </button>
          )}

          {/* Language Selector */}
          <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs">
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

          {/* Telemetry Status Badge */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#061F2C]/80 border border-slate-700/60 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#36D399] animate-pulse" />
            <span className="text-[11px] font-mono text-slate-300">
              OCEAN DATA: <span className="text-[#36D399] font-medium">CONNECTED</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
