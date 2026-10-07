import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/RoleContext';
import { authService, AuthResponse } from '../../services/authService';
import { DevModeBanner } from '../../components/auth/DevModeBanner';
import { Anchor, Phone, Shield, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const FishermanLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setAccountNotFound(false);
    setOtp(''); // a fresh OTP invalidates any previously entered code

    try {
      const res = await authService.sendFishermanOtp(phone.trim(), 'login');
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 30);
      setDevOtp(res.dev_otp || null);
    } catch (err: any) {
      const msg = err.message || 'Failed to send OTP';
      setError(msg);
      if (msg.includes('No ORCA fisherman account was found')) {
        setAccountNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = (await authService.verifyFishermanOtp(phone.trim(), otp.trim(), 'login')) as AuthResponse;
      login(res.user, res.welcome_message);
      navigate('/fisherman');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#16C7C7]/30 selection:text-[#28D7E5]">
      {/* Top Header */}
      <header className="ocean-glass border-b border-[#16C7C7]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
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

      {/* Main Login Card */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-12 flex flex-col justify-center">
        <div className="rounded-2xl ocean-glass border border-[#16C7C7]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(22,199,199,0.15)] relative">
          {/* Card Title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#16C7C7]/40 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Anchor className="w-8 h-8 text-[#16C7C7]" />
            </div>
            <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-[#16C7C7]/15 text-[#28D7E5] border-[#16C7C7]/30 uppercase">
              Operational Tier
            </span>
            <h1 className="text-2xl font-bold text-white font-heading mt-2">
              Fisherman Login
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Secure mobile OTP authentication for sea-state and PFZ advisories
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="leading-relaxed">{error}</p>
                {accountNotFound && (
                  <Link
                    to="/signup/fisherman"
                    className="inline-flex items-center space-x-1 font-semibold text-[#28D7E5] underline mt-1.5 hover:text-white"
                  >
                    <span>Create a Fisherman Account now</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Dev Mode Banner */}
          {devOtp && (
            <DevModeBanner
              devOtp={devOtp}
              onUseOtp={(code) => setOtp(code)}
              message="Development Authentication Mode (SMS not configured)"
            />
          )}

          {/* Form */}
          <form onSubmit={otpSent ? handleVerifyAndLogin : (e) => handleSendOtp(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (otpSent) {
                      setOtpSent(false);
                      setOtp('');
                      setDevOtp(null);
                      setCooldown(0);
                    }
                  }}
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  disabled={otpSent}
                  className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-sm outline-none transition-all placeholder:text-slate-600 disabled:opacity-60"
                  required
                />
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading || !phone}
                    className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[#16C7C7] text-slate-950 font-bold text-xs hover:bg-[#28D7E5] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Send OTP'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setDevOtp(null);
                      setCooldown(0);
                    }}
                    className="absolute right-2 top-2 text-xs text-[#28D7E5] hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>

            {otpSent && (
              <div className="pt-2 animate-fadeIn">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-medium text-slate-300">
                    6-Digit Verification Code (OTP)
                  </label>
                  {cooldown > 0 ? (
                    <span className="text-[11px] font-mono text-slate-400">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="text-[11px] font-mono text-[#28D7E5] hover:underline cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white tracking-widest text-base font-mono outline-none transition-all placeholder:tracking-normal placeholder:text-slate-600"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !/^\d{6}$/.test(otp.trim())}
                  className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0d9488] to-[#16C7C7] hover:from-[#0f766e] hover:to-[#28D7E5] text-slate-950 flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify OTP &amp; Login</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/signup/fisherman"
                className="font-bold text-[#28D7E5] hover:underline ml-1"
              >
                Create Fisherman Account
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="ocean-glass border-t border-[#16C7C7]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security • SIH 26176 (ISRO) • Server-Side Authentication
      </footer>
    </div>
  );
};

