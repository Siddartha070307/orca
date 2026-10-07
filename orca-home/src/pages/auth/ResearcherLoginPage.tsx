import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/RoleContext';
import { authService, AuthResponse, OtpResponse } from '../../services/authService';
import { DevModeBanner } from '../../components/auth/DevModeBanner';
import { Compass, Mail, Lock, Shield, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export const ResearcherLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your email or mobile number and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setOtp(''); // a fresh OTP request invalidates any previously entered code

    try {
      const res = (await authService.loginResearcher(identifier.trim(), password)) as OtpResponse;
      if (res.step === 'otp_required') {
        setStep('otp');
        setCooldown(res.cooldown_seconds || 30);
        setDevOtp(res.dev_otp || null);
        setOtpNotice(res.message || 'Credentials verified. Please enter your verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = (await authService.loginResearcher(identifier.trim(), password, otp.trim())) as AuthResponse;
      login(res.user, res.welcome_message);
      navigate('/researcher');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#8B6CFF]/30 selection:text-[#a78bfa]">
      {/* Header */}
      <header className="ocean-glass border-b border-[#8B6CFF]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#8B6CFF]/40 shadow-lg">
            <img src="/orca-logo.svg" alt="ORCA" className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#36D399] border-2 border-[#03141F]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-widest text-white font-heading">
                ORCA
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#8B6CFF]/15 text-[#a78bfa] border border-[#8B6CFF]/30">
                ISRO • SIH 26176
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
              Marine Ecosystem Reasoning with Collaborative Agents
            </p>
          </div>
        </Link>

        <Link
          to="/"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Roles</span>
        </Link>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-12 flex flex-col justify-center">
        <div className="rounded-2xl ocean-glass border border-[#8B6CFF]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(139,108,255,0.15)] relative">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#8B6CFF]/40 flex items-center justify-center mx-auto mb-3">
              <Compass className="w-8 h-8 text-[#8B6CFF]" />
            </div>
            <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-[#8B6CFF]/15 text-[#a78bfa] border-[#8B6CFF]/30 uppercase">
              Scientific Intelligence Suite
            </span>
            <h1 className="text-2xl font-bold text-white font-heading mt-2">
              Researcher Login
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Multi-factor authentication (Credentials + Verification Code)
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {devOtp && (
            <DevModeBanner
              devOtp={devOtp}
              onUseOtp={(code) => setOtp(code)}
              message="Development Authentication Mode (Email/SMS not configured)"
            />
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Email Address or Mobile Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      // Changing the identifier must reset all OTP state so no
                      // stale verification state can survive the change.
                      setOtp('');
                      setDevOtp(null);
                      setCooldown(0);
                      setOtpNotice(null);
                    }}
                    placeholder="e.g. scientist@incois.gov.in or 9845012345"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-sm outline-none placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-sm outline-none placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#6d28d9] to-[#8B6CFF] hover:from-[#5b21b6] hover:to-[#a78bfa] text-white flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Continue &amp; Request OTP</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtpAndLogin} className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200">
                {otpNotice || 'Credentials verified. Please enter your verification code.'}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-medium text-slate-300">
                    6-Digit Verification Code
                  </label>
                  {cooldown > 0 ? (
                    <span className="text-[11px] font-mono text-slate-400">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleCredentialsSubmit(e)}
                      disabled={loading}
                      className="text-[11px] font-mono text-[#a78bfa] hover:underline cursor-pointer"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Shield className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white tracking-widest text-base font-mono outline-none"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !/^\d{6}$/.test(otp)}
                className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#6d28d9] to-[#8B6CFF] hover:from-[#5b21b6] hover:to-[#a78bfa] text-white flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Verify OTP &amp; Access Research Console</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setOtp('');
                  setDevOtp(null);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-white underline cursor-pointer pt-1"
              >
                Back to credentials
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <Link to="/signup/researcher" className="font-bold text-[#a78bfa] hover:underline ml-1">
                Create Researcher Account
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="ocean-glass border-t border-[#8B6CFF]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security • SIH 26176 (ISRO) • Server-Side Authentication
      </footer>
    </div>
  );
};

