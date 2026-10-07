import React from 'react';
import { useAuth } from '../../context/RoleContext';
import { Sparkles, X, Anchor, ShieldCheck, Compass } from 'lucide-react';

export const WelcomeBanner: React.FC = () => {
  const { welcomeMessage, dismissWelcome, user, role } = useAuth();

  if (!welcomeMessage) return null;

  const getRoleIcon = () => {
    switch (role) {
      case 'fisherman':
        return <Anchor className="w-5 h-5 text-[#16C7C7]" />;
      case 'authority':
        return <ShieldCheck className="w-5 h-5 text-[#F5B942]" />;
      case 'researcher':
        return <Compass className="w-5 h-5 text-[#a78bfa]" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#28D7E5]" />;
    }
  };

  const getBorderColor = () => {
    switch (role) {
      case 'fisherman':
        return 'border-[#16C7C7]/40 shadow-[0_0_20px_rgba(22,199,199,0.2)]';
      case 'authority':
        return 'border-[#F5B942]/40 shadow-[0_0_20px_rgba(245,185,66,0.2)]';
      case 'researcher':
        return 'border-[#8B6CFF]/40 shadow-[0_0_20px_rgba(139,108,255,0.2)]';
      default:
        return 'border-[#16C7C7]/40';
    }
  };

  return (
    <div
      className={`relative mx-4 sm:mx-8 my-4 p-4 rounded-2xl bg-[#061F2C]/95 border ${getBorderColor()} backdrop-blur-md flex items-start justify-between gap-4 transition-all z-40`}
    >
      <div className="flex items-start space-x-3.5">
        <div className="p-2.5 rounded-xl bg-[#03141F] border border-slate-700 shrink-0">
          {getRoleIcon()}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16C7C7]/20 text-[#28D7E5] font-bold">
              AUTHENTICATED SESSION ACTIVE
            </span>
            {user?.role && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                {user.role}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm sm:text-base font-semibold text-white whitespace-pre-line leading-relaxed font-heading">
            {welcomeMessage}
          </div>
        </div>
      </div>

      <button
        onClick={dismissWelcome}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        title="Dismiss welcome banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

