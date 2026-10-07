import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DevModeBanner } from '../../components/auth/DevModeBanner';
import {
  Compass,
  Mail,
  Lock,
  Phone,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Building,
  GraduationCap,
  User
} from 'lucide-react';

export const ResearcherSignupPage: React.FC = () => {
  const navigate = useNavigate();

  // Verification State
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [areaOfResearch, setAreaOfResearch] = useState('');
  const [institution, setInstitution] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status
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

  const handleSendEmailOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setEmailOtp(''); // a fresh OTP invalidates any previously entered code

    try {
      const res = await authService.sendResearcherSignupOtp(email.trim());
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 30);
      setDevOtp(res.dev_otp || null);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || !/^\d{6}$/.test(emailOtp.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.verifyResearcherSignupOtp(email.trim(), emailOtp.trim());
      setIsEmailVerified(true);
    } catch (err: any) {
      setError(err.message || 'Failed to verify email code');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailVerified) {
      setError('Please verify your email address via OTP first.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.signupResearcher({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile_number: mobileNumber.trim(),
        area_of_research: areaOfResearch.trim(),
        institution: institution.trim() || undefined,
        research_specialization: specialization.trim() || undefined,
        password,
        confirm_password: confirmPassword
      });

      setSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          to="/login/researcher"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Already have account? Login</span>
        </Link>
      </header>

      {/* Main Registration Form */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col justify-center">
        <div className="rounded-2xl ocean-glass border border-[#8B6CFF]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(139,108,255,0.15)] relative">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#8B6CFF]/40 flex items-center justify-center mx-auto mb-3">
              <Compass className="w-8 h-8 text-[#8B6CFF]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Researcher Registration
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Join the ORCA scientific research suite for authoritative multi-source oceanographic data analysis
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
              onUseOtp={(code) => setEmailOtp(code)}
              message="Development Authentication Mode (Email not configured)"
            />
          )}

          {/* Progress bar */}
          <div className="flex items-center justify-between mb-8 px-2 text-xs font-mono">
            <div className={`flex items-center space-x-2 ${isEmailVerified ? 'text-[#36D399]' : 'text-[#a78bfa]'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isEmailVerified ? 'bg-[#36D399] text-slate-950' : 'bg-[#8B6CFF]/20 border border-[#8B6CFF]'}`}>
                1
              </span>
              <span>Email Verification</span>
            </div>
            <div className="flex-1 h-0.5 mx-3 bg-slate-800">
              <div className={`h-full ${isEmailVerified ? 'bg-[#36D399]' : 'bg-transparent'} transition-all`} />
            </div>
            <div className={`flex items-center space-x-2 ${isEmailVerified ? 'text-[#a78bfa]' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isEmailVerified ? 'bg-[#8B6CFF]/20 border border-[#8B6CFF] text-[#a78bfa]' : 'bg-slate-800 text-slate-500'}`}>
                2
              </span>
              <span>Profile &amp; Credentials</span>
            </div>
          </div>

          {!isEmailVerified ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Institutional / Researcher Email (Required)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. scientist@incois.gov.in"
                    disabled={otpSent}
                    className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-sm outline-none placeholder:text-slate-600 disabled:opacity-60"
                  />
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={loading || !email}
                      className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[#8B6CFF] text-white font-bold text-xs hover:bg-[#a78bfa] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verify Email'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setEmailOtp('');
                        setDevOtp(null);
                        setCooldown(0);
                        setError(null);
                      }}
                      className="absolute right-2 top-2 text-xs text-[#a78bfa] hover:underline cursor-pointer"
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
                      Enter Email Verification Code
                    </label>
                    {cooldown > 0 ? (
                      <span className="text-[11px] font-mono text-slate-400">
                        Resend in {cooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={loading}
                        className="text-[11px] font-mono text-[#a78bfa] hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Shield className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit code"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white tracking-widest text-base font-mono outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={loading || !/^\d{6}$/.test(emailOtp)}
                    className="w-full mt-4 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#8B6CFF] hover:bg-[#a78bfa] text-white flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Email Verification'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCompleteSignup} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
                  <span>Verified Email: <strong className="font-mono text-white">{email}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEmailVerified(false)}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Dr. / Prof. / First Name"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Surname"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>

              {/* Mobile & Area of Research */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 9845012345"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Area of Research <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={areaOfResearch}
                    onChange={(e) => setAreaOfResearch(e.target.value)}
                    placeholder="e.g. Marine Biogeochemistry, Coral Reefs"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>

              {/* Institution & Specialization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Institution / University / Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. NIO, INCOIS, IISc Bangalore"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Research Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Remote Sensing, SST Modeling"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                  />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Create Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#8B6CFF] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#6d28d9] to-[#8B6CFF] hover:from-[#5b21b6] hover:to-[#a78bfa] text-white flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Register Researcher Account'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login/researcher" className="font-bold text-[#a78bfa] hover:underline ml-1">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#061F2C] border border-[#8B6CFF]/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#8B6CFF]/20 border border-[#8B6CFF]/40 flex items-center justify-center mx-auto mb-4 text-[#a78bfa]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white font-heading">
              🎉 Registration successful!
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Welcome to ORCA.
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Your researcher account has been created. A welcome email has been generated. Please login to continue.
            </p>
            <button
              onClick={() => navigate('/login/researcher')}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#8B6CFF] text-white font-bold text-xs hover:bg-[#a78bfa] transition-all cursor-pointer"
            >
              Go to Researcher Login
            </button>
          </div>
        </div>
      )}

      <footer className="ocean-glass border-t border-[#8B6CFF]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security • SIH 26176 (ISRO) • Server-Side Authentication
      </footer>
    </div>
  );
};

