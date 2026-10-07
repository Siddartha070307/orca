import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DevModeBanner } from '../../components/auth/DevModeBanner';
import {
  Anchor,
  Phone,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Ship,
  User,
  MapPin,
  Compass
} from 'lucide-react';

export const FishermanSignupPage: React.FC = () => {
  const navigate = useNavigate();

  // Verification State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [vesselReg, setVesselReg] = useState('');
  const [fishingType, setFishingType] = useState('Coastal Traditional');
  const [language, setLanguage] = useState('en');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Status & Modal State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setOtp(''); // a fresh OTP invalidates any previously entered code

    try {
      const res = await authService.sendFishermanOtp(phone.trim(), 'signup');
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 30);
      setDevOtp(res.dev_otp || null);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.verifyFishermanOtp(phone.trim(), otp.trim(), 'signup');
      setIsPhoneVerified(true);
    } catch (err: any) {
      setError(err.message || 'Failed to verify phone OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneVerified) {
      setError('Please verify your phone number via OTP first.');
      return;
    }

    if (!name.trim() || !age || !location.trim()) {
      setError('Name, age, and port location are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.signupFisherman({
        phone_number: phone.trim(),
        name: name.trim(),
        age: Number(age),
        location: location.trim(),
        vessel_name: vesselName.trim() || undefined,
        vessel_registration_number: vesselReg.trim() || undefined,
        fishing_type: fishingType || undefined,
        preferred_language: language,
        emergency_contact: emergencyContact.trim() || undefined
      });

      setSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration');
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
          to="/login/fisherman"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Already have account? Login</span>
        </Link>
      </header>

      {/* Main Registration Card */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col justify-center">
        <div className="rounded-2xl ocean-glass border border-[#16C7C7]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(22,199,199,0.15)] relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#16C7C7]/40 flex items-center justify-center mx-auto mb-3">
              <Anchor className="w-8 h-8 text-[#16C7C7]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Fisherman Registration
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Create an ORCA account for vessel tracking, safe routing, and Potential Fishing Zone advisories
            </p>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
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

          {/* Progress Indicators */}
          <div className="flex items-center justify-between mb-8 px-2 text-xs font-mono">
            <div className={`flex items-center space-x-2 ${isPhoneVerified ? 'text-[#36D399]' : 'text-[#28D7E5]'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isPhoneVerified ? 'bg-[#36D399] text-slate-950' : 'bg-[#16C7C7]/20 border border-[#16C7C7]'}`}>
                1
              </span>
              <span>Phone Verification</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-slate-800">
              <div className={`h-full ${isPhoneVerified ? 'bg-[#36D399]' : 'bg-transparent'} transition-all`} />
            </div>
            <div className={`flex items-center space-x-2 ${isPhoneVerified ? 'text-[#28D7E5]' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isPhoneVerified ? 'bg-[#16C7C7]/20 border border-[#16C7C7] text-[#28D7E5]' : 'bg-slate-800 text-slate-500'}`}>
                2
              </span>
              <span>Profile &amp; Vessel Details</span>
            </div>
          </div>

          {/* Step 1: Phone Verification */}
          {!isPhoneVerified ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Mobile Number (Required)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    disabled={otpSent}
                    className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-sm outline-none placeholder:text-slate-600 disabled:opacity-60"
                  />
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
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
                        setError(null);
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
                      Enter Verification OTP
                    </label>
                    {cooldown > 0 ? (
                      <span className="text-[11px] font-mono text-slate-400">
                        Resend in {cooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
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
                      placeholder="6-digit code"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white tracking-widest text-base font-mono outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || !/^\d{6}$/.test(otp)}
                    className="w-full mt-4 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-950 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Mobile Number'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Personal & Vessel Information Form */
            <form onSubmit={handleCompleteSignup} className="space-y-4">
              {/* Verified Phone Summary */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
                  <span>Verified Phone: <strong className="font-mono text-white">{phone}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPhoneVerified(false)}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ramesh Tandel"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Age <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 38"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                  Base Port / Landing Centre Location <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mangalore Bunder, Malpe, Cochin, Karwar"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>

              {/* Optional Vessel Details */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                  Vessel &amp; Advisory Preferences (Optional)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Vessel Name
                    </label>
                    <input
                      type="text"
                      value={vesselName}
                      onChange={(e) => setVesselName(e.target.value)}
                      placeholder="e.g. Matsya Raj"
                      className="w-full px-3 py-2 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Vessel Registration Number
                    </label>
                    <input
                      type="text"
                      value={vesselReg}
                      onChange={(e) => setVesselReg(e.target.value)}
                      placeholder="e.g. IND-KA-04-MM-552"
                      className="w-full px-3 py-2 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Fishing Type
                    </label>
                    <select
                      value={fishingType}
                      onChange={(e) => setFishingType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    >
                      <option value="Coastal Traditional">Coastal Traditional (Near-Shore)</option>
                      <option value="Gillnet Trawler">Gillnet Trawler</option>
                      <option value="Longliner (Tuna/Pelagic)">Longliner (Tuna/Pelagic)</option>
                      <option value="Purse Seine">Purse Seine</option>
                      <option value="Deep Sea Motorized">Deep Sea Motorized</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Emergency Contact Number
                    </label>
                    <input
                      type="tel"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="e.g. 9845012399"
                      className="w-full px-3 py-2 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#16C7C7] text-white text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#0d9488] to-[#16C7C7] hover:from-[#0f766e] hover:to-[#28D7E5] text-slate-950 flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Complete Registration & Sign Up'}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login/fisherman" className="font-bold text-[#28D7E5] hover:underline ml-1">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#061F2C] border border-[#16C7C7]/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#16C7C7]/20 border border-[#16C7C7]/40 flex items-center justify-center mx-auto mb-4 text-[#36D399]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white font-heading">
              🎉 Signed up successfully!
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Your ORCA fisherman account has been created.
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Please login with your mobile number to start accessing real-time marine advisories.
            </p>
            <button
              onClick={() => navigate('/login/fisherman')}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#16C7C7] text-slate-950 font-bold text-xs hover:bg-[#28D7E5] transition-all cursor-pointer"
            >
              Go to Fisherman Login
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="ocean-glass border-t border-[#16C7C7]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security • SIH 26176 (ISRO) • Server-Side Authentication
      </footer>
    </div>
  );
};

