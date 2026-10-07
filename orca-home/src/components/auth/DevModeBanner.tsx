import React from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

interface DevModeBannerProps {
  devOtp?: string | null;
  onUseOtp?: (otp: string) => void;
  message?: string;
}

export const DevModeBanner: React.FC<DevModeBannerProps> = ({
  devOtp,
  onUseOtp,
  message = 'Development Authentication Mode • External SMS/Email provider not configured.'
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (devOtp) {
      navigator.clipboard.writeText(devOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl bg-[#061F2C] border border-[#16C7C7]/30 p-3.5 my-4 text-xs font-mono shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-[#28D7E5]">
          <Terminal className="w-4 h-4 shrink-0 text-[#16C7C7]" />
          <span className="font-semibold">{message}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#16C7C7]/15 text-[#28D7E5] border border-[#16C7C7]/30 font-bold shrink-0">
          AUTH_DEV_MODE
        </span>
      </div>

      {devOtp && (
        <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-slate-300">
            <span>Generated OTP:</span>
            <span className="text-sm font-bold tracking-widest text-[#36D399] bg-[#03141F] px-2 py-0.5 rounded border border-emerald-500/40">
              {devOtp}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onUseOtp && (
              <button
                type="button"
                onClick={() => onUseOtp(devOtp)}
                className="px-2.5 py-1 rounded bg-[#16C7C7]/20 border border-[#16C7C7]/40 text-[#28D7E5] hover:bg-[#16C7C7]/30 transition-all font-sans text-xs font-semibold cursor-pointer"
              >
                Auto-Fill OTP
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Copy OTP to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#36D399]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

