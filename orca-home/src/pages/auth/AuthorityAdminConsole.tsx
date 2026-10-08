import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/RoleContext';
import { authService, AuthorityRequestItem } from '../../services/authService';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Building2,
  Clock,
  Lock,
  LogOut,
  Mail,
  AlertCircle,
  Users,
  BellRing
} from 'lucide-react';
import { FishermenAdminPanel } from './FishermenAdminPanel';
import { FishermenAlertsPanel } from './FishermenAlertsPanel';

export const AuthorityAdminConsole: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  // Admin login form states (shown if unauthenticated)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin console states
  const [requests, setRequests] = useState<AuthorityRequestItem[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safe Action Confirmation Modal (Parts 17 & 18)
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    action: 'approve' | 'reject' | 'suspend';
    fullName: string;
    email: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState<string>('');

  // Management sections: authority access reviews, fisherman registry, alert sending
  const [activeTab, setActiveTab] = useState<'requests' | 'fishermen' | 'alerts'>('requests');

  const fetchRequests = async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await authService.listAuthorityRequests(filter || undefined);
      setRequests(data.requests);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load authority requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchRequests();
    }
  }, [filter, isAuthenticated, user]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setLoginError('Please enter administrator email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await authService.loginAdmin(adminEmail.trim(), adminPassword);
      login(res.user, res.welcome_message);
    } catch (err: any) {
      setLoginError(err.message || 'Administrator authentication failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const openActionModal = (
    userId: string,
    action: 'approve' | 'reject' | 'suspend',
    fullName: string,
    email: string
  ) => {
    setPendingAction({ userId, action, fullName, email });
    setActionReason(action === 'reject' ? 'Credentials could not be verified by administrator.' : '');
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setActionLoading(pendingAction.userId);
    setErrorMessage(null);
    try {
      const res = await authService.approveAuthorityRequest(
        pendingAction.userId,
        pendingAction.action,
        actionReason.trim() || undefined
      );
      setMessage(res.message);
      setPendingAction(null);
      setActionReason('');
      await fetchRequests();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Administrative action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // 1. Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03141F] flex items-center justify-center text-slate-300">
        <div className="w-8 h-8 border-2 border-[#F5B942]/30 border-t-[#F5B942] rounded-full animate-spin mr-3" />
        <span className="font-mono text-xs text-slate-400">Verifying administrator clearance...</span>
      </div>
    );
  }

  // 2. Unauthenticated: Render Administrator Login Gate (Part 2)
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#F5B942]/30 selection:text-[#F5B942]">
        <header className="ocean-glass border-b border-[#F5B942]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#F5B942]/40 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#F5B942]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold text-white font-heading">ORCA ADMIN</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                  PRIVILEGED GATE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Restricted Administrator Authentication Gateway</p>
            </div>
          </Link>
          <Link
            to="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#061F2C] border border-slate-700 text-xs text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Role Selection</span>
          </Link>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 sm:px-6 py-12 flex flex-col justify-center">
          <div className="rounded-2xl ocean-glass border border-[#F5B942]/40 p-6 sm:p-8 shadow-[0_0_35px_rgba(245,185,66,0.15)]">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#03141F] border border-[#F5B942]/40 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-8 h-8 text-[#F5B942]" />
              </div>
              <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30 uppercase">
                Administrator Access Only
              </span>
              <h1 className="text-2xl font-bold text-white font-heading mt-2">
                Admin Console Sign In
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Enter your configured administrator credentials to access the Authority Review Console.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3.5 rounded-xl border bg-red-950/60 border-red-500/40 text-red-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed font-semibold">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@orca-marine.gov.in"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-sm outline-none placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Master Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-sm outline-none placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d97706] to-[#F5B942] hover:from-[#b45309] hover:to-[#fbbf24] text-slate-950 font-bold text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loginLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <>
                    <span>Authenticate as Administrator</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="ocean-glass border-t border-[#F5B942]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
          ORCA Security • SIH 26176 (ISRO) • Restricted Administrator Endpoint
        </footer>
      </div>
    );
  }

  // 3. Authenticated but NOT admin: 403 Forbidden Screen (Part 2)
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 rounded-2xl bg-[#061F2C] border border-red-500/40 max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-center mx-auto mb-3 text-red-400 font-bold text-xl font-mono">
            403
          </div>
          <h2 className="text-xl font-bold text-white mb-2 font-heading">Administrator Clearance Required</h2>
          <p className="text-xs text-slate-300 mb-6 leading-relaxed">
            Your authenticated session role is <strong className="text-white uppercase font-mono">{user.role}</strong>.
            Ordinary {user.role} accounts do not hold administrative review privileges.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/${user.role}`}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#16C7C7] text-slate-950 font-bold text-xs text-center"
            >
              Go to Your Console
            </Link>
            <button
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs text-center cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated Administrator: Render Full Management Console
  return (
    <div className="min-h-screen bg-[#03141F] text-slate-100 flex flex-col justify-between selection:bg-[#F5B942]/30 selection:text-[#F5B942]">
      {/* Header */}
      <header className="ocean-glass border-b border-[#F5B942]/20 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#082A36] to-[#03141F] border border-[#F5B942]/40 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-[#F5B942]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold text-white font-heading">
                ORCA ADMIN CONSOLE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                ACTIVE ADMIN: {user.full_name}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Review and authorize Government Port Authority &amp; Coast Guard access credentials
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300 hover:text-white hover:bg-red-900/60 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Admin Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner notification */}
        {message && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#36D399]" />
            <span>{message}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section tabs: authority access reviews vs fisherman registry */}
        <div className="flex items-end gap-1.5 mb-6 border-b border-slate-800" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'requests'}
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2.5 text-xs font-mono font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
              activeTab === 'requests'
                ? 'border-[#F5B942] text-[#F5B942] bg-[#061F2C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" />
              Authority Access Requests
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'fishermen'}
            onClick={() => setActiveTab('fishermen')}
            className={`px-4 py-2.5 text-xs font-mono font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
              activeTab === 'fishermen'
                ? 'border-[#16C7C7] text-[#28D7E5] bg-[#061F2C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Fishermen Registry
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'alerts'}
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2.5 text-xs font-mono font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'border-[#F5B942] text-[#F5B942] bg-[#061F2C]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <BellRing className="w-3.5 h-3.5" />
              Alert Sending
            </span>
          </button>
        </div>

        {activeTab === 'fishermen' ? (
          <FishermenAdminPanel />
        ) : activeTab === 'alerts' ? (
          <FishermenAlertsPanel />
        ) : (
          <>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-400">Filter Status:</span>
            {['', 'pending', 'approved', 'rejected', 'suspended'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  filter === s
                    ? 'bg-[#F5B942] text-slate-950 font-bold'
                    : 'bg-[#061F2C] border border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {s ? s.toUpperCase() : 'ALL'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRequests}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] text-xs font-mono cursor-pointer hover:bg-[#16C7C7]/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Request Cards / Table */}
        {loading && requests.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#F5B942]" />
            <p className="text-xs font-mono">Loading authority records...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl ocean-glass border border-slate-800 p-12 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-semibold text-slate-300">No authority requests matching filter</p>
            <p className="text-xs font-mono mt-1 text-slate-500">
              New submissions will appear here for administrative verification.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.map((r) => {
              const isPending = r.status === 'pending';
              const isApproved = r.status === 'approved';
              const isRejected = r.status === 'rejected';
              const isSuspended = r.status === 'suspended';

              return (
                <div
                  key={r.user_id}
                  className="rounded-2xl ocean-glass border border-slate-700/80 p-5 flex flex-col justify-between hover:border-[#F5B942]/60 transition-all shadow-lg"
                >
                  <div>
                    {/* Top status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-slate-900 text-slate-300 border-slate-700">
                        {r.employee_id}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                          isPending
                            ? 'bg-amber-500/20 text-[#F5B942] border-amber-500/40'
                            : isApproved
                            ? 'bg-emerald-500/20 text-[#36D399] border-emerald-500/40'
                            : isRejected
                            ? 'bg-red-500/20 text-[#FF4D5A] border-red-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white font-heading">
                      {r.full_name}
                    </h3>
                    <p className="text-xs font-semibold text-[#F5B942] mt-0.5">
                      {r.designation} • {r.department}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-300 font-mono">
                      <div>
                        <span className="text-slate-500">Official Email: </span>
                        <span>{r.official_email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Region: </span>
                        <span>{r.state_region}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Responsibility: </span>
                        <span className="text-slate-200">{r.area_of_responsibility}</span>
                      </div>
                      {r.rejection_reason && (
                        <div className="text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50 mt-2">
                          <span className="text-red-400 font-bold">Rejection Reason: </span>
                          <span>{r.rejection_reason}</span>
                        </div>
                      )}
                      {r.reviewed_by && (
                        <div className="text-slate-500 text-[10px] pt-1">
                          Reviewed by: {r.reviewed_by}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions (Part 16 & 18) */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-2">
                    {isPending && (
                      <>
                        <button
                          onClick={() => openActionModal(r.user_id, 'approve', r.full_name, r.official_email)}
                          disabled={actionLoading === r.user_id}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => openActionModal(r.user_id, 'reject', r.full_name, r.official_email)}
                          disabled={actionLoading === r.user_id}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-red-950/80 border border-red-500 text-red-300 hover:bg-red-900 font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => openActionModal(r.user_id, 'suspend', r.full_name, r.official_email)}
                        disabled={actionLoading === r.user_id}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-mono text-xs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Suspend Access</span>
                      </button>
                    )}

                    {(isRejected || isSuspended) && (
                      <button
                        onClick={() => openActionModal(r.user_id, 'approve', r.full_name, r.official_email)}
                        disabled={actionLoading === r.user_id}
                        className="w-full py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Restore / Re-Approve</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation Modal (Parts 17 & 18) */}
        {pendingAction && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-[#061F2C] border border-[#F5B942]/40 p-6 shadow-2xl animate-fadeIn">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`p-2.5 rounded-xl border ${
                  pendingAction.action === 'approve'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-[#36D399]'
                    : pendingAction.action === 'reject'
                    ? 'bg-red-950/60 border-red-500/50 text-red-400'
                    : 'bg-amber-950/60 border-amber-500/50 text-[#F5B942]'
                }`}>
                  {pendingAction.action === 'approve' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : pendingAction.action === 'reject' ? (
                    <XCircle className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-heading capitalize">
                    Confirm Action: {pendingAction.action.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Applicant: {pendingAction.fullName} ({pendingAction.email})
                  </p>
                </div>
              </div>

              {pendingAction.action === 'reject' && (
                <div className="my-4">
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                    Administrative Rejection Reason (Stored in audit record):
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    className="w-full p-3 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                    required
                  />
                </div>
              )}

              {pendingAction.action === 'suspend' && (
                <div className="my-4">
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                    Reason for Suspension (Optional):
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. Investigation pending / credential expiration"
                    className="w-full p-3 rounded-xl bg-[#03141F] border border-slate-700 focus:border-[#F5B942] text-white text-xs outline-none"
                  />
                </div>
              )}

              {pendingAction.action === 'approve' && (
                <p className="text-xs text-slate-300 my-4 leading-relaxed">
                  Approving this request will permit this government officer to authenticate and access the restricted ORCA Authority Surveillance Console.
                </p>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAction}
                  disabled={actionLoading !== null}
                  className={`px-4 py-2 rounded-xl font-bold text-xs text-slate-950 cursor-pointer flex items-center space-x-1.5 ${
                    pendingAction.action === 'approve'
                      ? 'bg-[#36D399] hover:bg-emerald-400'
                      : pendingAction.action === 'reject'
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-[#F5B942] hover:bg-amber-400'
                  }`}
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Confirm {pendingAction.action.toUpperCase()}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
      </main>

      <footer className="ocean-glass border-t border-[#F5B942]/20 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        ORCA Security Administration • SIH 26176 (ISRO) • Server-Side Authorization
      </footer>
    </div>
  );
};
