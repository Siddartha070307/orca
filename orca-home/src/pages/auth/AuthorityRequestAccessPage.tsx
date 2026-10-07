import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DevModeBanner } from '../../components/auth/DevModeBanner';
import {
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  Phone,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  BadgeCheck
} from 'lucide-react';

export const AuthorityRequestAccessPage: React.FC = () => {
  const navigate = useNavigate();

  // Verification states
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailDevOtp, setEmailDevOtp] = useState<string | null>(null);

  const [mobile, setMobile] = useState('');
  const [verifiedMobile, setVerifiedMobile] = useState<string | null>(null);
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileCooldown, setMobileCooldown] = useState(0);
  const [mobileDevOtp, setMobileDevOtp] = useState<string | null>(null);

  const isEmailVerified = Boolean(verifiedEmail && verifiedEmail.toLowerCase() === email.trim().toLowerCase());
  const isMobileVerified = Boolean(verifiedMobile && verifiedMobile === mobile.trim());

  // Form fields
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Indian Coast Guard');
  const [employeeId, setEmployeeId] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [areaOfResponsibility, setAreaOfResponsibility] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & modal
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingModal, setPendingModal] = useState(false);

  useEffect(() => {
    let t1: NodeJS.Timeout;
    if (emailCooldown > 0) {
      t1 = setTimeout(() => setEmailCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(t1);
  }, [emailCooldown]);

  useEffect(() => {
    let t2: NodeJS.Timeout;
    if (mobileCooldown > 0) {
      t2 = setTimeout(() => setMobileCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(t2);
  }, [mobileCooldown]);

  const handleSendEmailOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid official email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setEmailOtp(''); // a fresh OTP invalidates any previously entered code
    try {
      const res = await authService.sendAuthoritySignupOtp('email', email.trim());
      setEmailOtpSent(true);
      setEmailCooldown(res.cooldown_seconds || 30);
      setEmailDevOtp(res.dev_otp || null);
    } catch (err: any) {
      setError(err.message || 'Failed to send email verification OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || !/^\d{6}$/.test(emailOtp.trim())) {
      setError('Please enter the 6-digit email OTP code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.verifyAuthoritySignupOtp('email', email.trim(), emailOtp.trim());
      setVerifiedEmail(email.trim());
      setEmailOtp('');
      setEmailDevOtp(null);
    } catch (err: any) {
      setError(err.message || 'Failed to verify email OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMobileOtp = async () => {
    if (!mobile || mobile.length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    setError(null);
    setMobileOtp(''); // a fresh OTP invalidates any previously entered code
    try {
      const res = await authService.sendAuthoritySignupOtp('mobile', mobile.trim());
      setMobileOtpSent(true);
      setMobileCooldown(res.cooldown_seconds || 30);
      setMobileDevOtp(res.dev_otp || null);
    } catch (err: any) {
      setError(err.message || 'Failed to send mobile verification OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp || !/^\d{6}$/.test(mobileOtp.trim())) {
      setError('Please enter the 6-digit mobile OTP code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.verifyAuthoritySignupOtp('mobile', mobile.trim(), mobileOtp.trim());
      setVerifiedMobile(mobile.trim());
      setMobileOtp('');
      setMobileDevOtp(null);
    } catch (err: any) {
      setError(err.message || 'Failed to verify mobile OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailVerified || !isMobileVerified) {
      setError('Both official email and mobile number must be verified via OTP.');
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
      await authService.requestAuthorityAccess({
        full_name: fullName.trim(),
        designation: designation.trim(),
        department: department.trim(),
        official_email: email.trim(),
        mobile_number: mobile.trim(),
        employee_id: employeeId.trim(),
        state_region: stateRegion.trim(),
        area_of_responsibility: areaOfResponsibility.trim(),
        password,
        confirm_password: confirmPassword
      });

      setPendingModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit official access request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#F5B942]/30 selection:text-[#F5B942]">
      {/* Header */}
      <header className="ocean-glass border-b border-[#F5B942]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#F5B942]/40 shadow-lg">
            <img src="/orca-logo.svg" alt="ORCA" className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#36D399] border-2 border-[#03141F]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-widest text-white font-heading">
                ORCA
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                ISRO • SIH 26176
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
              Marine Ecosystem Reasoning with Collaborative Agents
            </p>
          </div>
        </Link>

        <Link
          to="/login/authority"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Already have access? Login</span>
        </Link>
      </header>

      {/* Main Request Form */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col justify-center">
        <div className="rounded-2xl ocean-glass border border-[#F5B942]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(245,185,66,0.15)] relative">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#F5B942]/40 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-8 h-8 text-[#F5B942]" />
            </div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Request Official Access
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto">
              Restricted portal for Port Authority, Coast Guard, Fisheries Department, and Maritime Police personnel.
              All credentials require verified official contact and administrator approval.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Dev Mode Banners */}
          {emailDevOtp && !isEmailVerified && (
            <DevModeBanner
              devOtp={emailDevOtp}
              onUseOtp={(code) => setEmailOtp(code)}
              message="Development Official Email OTP"
            />
          )}

          {mobileDevOtp && !isMobileVerified && (
            <DevModeBanner
              devOtp={mobileDevOtp}
              onUseOtp={(code) => setMobileOtp(code)}
              message="Development Official Mobile OTP"
            />
          )}

          <form onSubmit={handleSubmitAccessRequest} className="space-y-6">
            {/* Section 1: Dual Verification */}
            <div className="p-4 rounded-xl bg-[#03141F]/80 border border-slate-700/80 space-y-4">
              <span className="text-xs font-mono font-semibold text-[#F5B942] uppercase tracking-wider block">
                1. Official Contact Verification
              </span>

              {/* Official Email */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Official Government / Agency Email <span className="text-red-400">*</span>
                </label>
                {!isEmailVerified ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (verifiedEmail && e.target.value.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
                            setVerifiedEmail(null);
                          }
                        }}
                        placeholder="e.g. officer.sharma@coastguard.gov.in"
                        disabled={emailOtpSent}
                        className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#061F2C] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none disabled:opacity-60"
                      />
                      {!emailOtpSent ? (
                        <button
                          type="button"
                          onClick={handleSendEmailOtp}
                          disabled={loading || !email}
                          className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[#F5B942] text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Send Code
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailOtpSent(false);
                            setEmailOtp('');
                            setEmailDevOtp(null);
                            setEmailCooldown(0);
                          }}
                          className="absolute right-2 top-2 text-xs text-[#F5B942] hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>

                    {emailOtpSent && (
                      <div className="flex gap-2 items-center pt-1">
                        <input
                          type="text"
                          maxLength={6}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="Email OTP"
                          className="w-36 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700 focus:border-[#F5B942] text-white font-mono tracking-widest text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          disabled={loading || !/^\d{6}$/.test(emailOtp.trim())}
                          className="px-3 py-1.5 rounded-lg bg-[#F5B942] text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Verify Email
                        </button>
                        {emailCooldown > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Resend in {emailCooldown}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
                      <span>Verified: <strong className="text-white font-mono">{email}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedEmail(null);
                        setEmailOtpSent(false);
                        setEmailOtp('');
                        setEmailDevOtp(null);
                        setEmailCooldown(0);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Official Mobile */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Official Mobile Number <span className="text-red-400">*</span>
                </label>
                {!isMobileVerified ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => {
                          setMobile(e.target.value);
                          if (verifiedMobile && e.target.value.trim() !== verifiedMobile) {
                            setVerifiedMobile(null);
                          }
                        }}
                        placeholder="e.g. 9820054321"
                        disabled={mobileOtpSent}
                        className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-[#061F2C] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none disabled:opacity-60"
                      />
                      {!mobileOtpSent ? (
                        <button
                          type="button"
                          onClick={handleSendMobileOtp}
                          disabled={loading || !mobile}
                          className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-[#F5B942] text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Send Code
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOtpSent(false);
                            setMobileOtp('');
                            setMobileDevOtp(null);
                            setMobileCooldown(0);
                          }}
                          className="absolute right-2 top-2 text-xs text-[#F5B942] hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>

                    {mobileOtpSent && (
                      <div className="flex gap-2 items-center pt-1">
                        <input
                          type="text"
                          maxLength={6}
                          value={mobileOtp}
                          onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="Mobile OTP"
                          className="w-36 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700 focus:border-[#F5B942] text-white font-mono tracking-widest text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyMobileOtp}
                          disabled={loading || !/^\d{6}$/.test(mobileOtp.trim())}
                          className="px-3 py-1.5 rounded-lg bg-[#F5B942] text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Verify Mobile
                        </button>
                        {mobileCooldown > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Resend in {mobileCooldown}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
                      <span>Verified: <strong className="text-white font-mono">{mobile}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedMobile(null);
                        setMobileOtpSent(false);
                        setMobileOtp('');
                        setMobileDevOtp(null);
                        setMobileCooldown(0);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Official Identity Information */}
            <div className="space-y-4">
              <span className="text-xs font-mono font-semibold text-[#F5B942] uppercase tracking-wider block">
                2. Official Identity &amp; Agency Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Cdr. Vikram Singh"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Designation / Rank <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Operations Officer, Harbor Master"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Department / Agency <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Indian Coast Guard, Port Trust, Fisheries Dept"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Employee / Government ID Number <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <BadgeCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. ICG-SURV-4091"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none uppercase font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    State / Coastal Region <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={stateRegion}
                    onChange={(e) => setStateRegion(e.target.value)}
                    placeholder="e.g. Karnataka / Goa / Tamil Nadu"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Area of Responsibility <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={areaOfResponsibility}
                    onChange={(e) => setAreaOfResponsibility(e.target.value)}
                    placeholder="e.g. Karwar Naval Perimeter &amp; Malpe Sector"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Password */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <span className="text-xs font-mono font-semibold text-[#F5B942] uppercase tracking-wider block">
                3. Create Official Access Password
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isEmailVerified || !isMobileVerified}
              className="w-full py-3.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#d97706] to-[#F5B942] hover:from-[#b45309] hover:to-[#fbbf24] text-slate-950 flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit Access Request (Pending Review)'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an approved account?{' '}
              <Link to="/login/authority" className="font-bold text-[#F5B942] hover:underline ml-1">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Pending Approval Modal */}
      {pendingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#061F2C] border border-[#F5B942]/40 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#F5B942]/20 border border-[#F5B942]/40 flex items-center justify-center mx-auto mb-4 text-[#F5B942]">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-[#F5B942] text-xs font-mono font-bold mb-3 border border-amber-500/30">
              STATUS: PENDING APPROVAL
            </div>
            <h2 className="text-xl font-bold text-white font-heading">
              Official Access Request Submitted
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Your official access request has been submitted and is pending administrative review.
            </p>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              Per strict security protocol, direct access to the Authority Surveillance Console is withheld until official verification is approved.
            </p>

            <div className="mt-6">
              <button
                onClick={() => navigate('/login/authority')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F5B942] hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
              >
                Return to Authority Login
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="ocean-glass border-t border-[#F5B942]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security • SIH 26176 (ISRO) • Server-Side Authentication
      </footer>
    </div>
  );
};

