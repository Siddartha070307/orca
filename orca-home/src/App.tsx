import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { RoleProvider, useAuth } from './context/RoleContext';
import { I18nProvider } from './utils/i18n';
import { RoleSelectScreen } from './components/auth/RoleSelectScreen';
import { FishermanEmbedPage } from './pages/FishermanEmbedPage';
import { AuthorityConsole } from './pages/AuthorityConsole';
import { ResearcherConsole } from './pages/ResearcherConsole';
import { HomePage } from './pages/HomePage';
import { SimulationPage } from './pages/SimulationPage';

// Authentication Pages
import { FishermanLoginPage } from './pages/auth/FishermanLoginPage';
import { FishermanSignupPage } from './pages/auth/FishermanSignupPage';
import { ResearcherLoginPage } from './pages/auth/ResearcherLoginPage';
import { ResearcherSignupPage } from './pages/auth/ResearcherSignupPage';
import { AuthorityLoginPage } from './pages/auth/AuthorityLoginPage';
import { AuthorityRequestAccessPage } from './pages/auth/AuthorityRequestAccessPage';
import { AuthorityAdminConsole } from './pages/auth/AuthorityAdminConsole';

/**
 * Root role-gated router:
 * If user is authenticated, directs to their assigned operational console.
 * If not authenticated, renders the Role Selection Gateway.
 */
function RoleGatedHome() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03141F] flex items-center justify-center text-slate-300">
        <div className="w-8 h-8 border-2 border-[#16C7C7]/30 border-t-[#16C7C7] rounded-full animate-spin mr-3" />
        <span className="font-mono text-xs text-slate-400">Verifying ORCA session credentials...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    switch (user.role) {
      case 'fisherman':
        return <FishermanEmbedPage />;
      case 'authority':
        return <AuthorityConsole />;
      case 'researcher':
        return <ResearcherConsole />;
      default:
        return <RoleSelectScreen />;
    }
  }

  return <RoleSelectScreen />;
}

/**
 * Role-Based Access Control Protected Route Wrapper
 */
interface ProtectedRouteProps {
  requiredRole: 'fisherman' | 'researcher' | 'authority';
  children: React.ReactNode;
}

function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03141F] flex items-center justify-center text-slate-300">
        <div className="w-8 h-8 border-2 border-[#16C7C7]/30 border-t-[#16C7C7] rounded-full animate-spin mr-3" />
        <span className="font-mono text-xs text-slate-400">Authorizing access...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login/${requiredRole}`} replace />;
  }

  if (user.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-[#03141F] flex flex-col items-center justify-center p-6 text-center text-slate-300">
        <div className="p-6 rounded-2xl bg-[#061F2C] border border-red-500/40 max-w-md w-full shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center justify-center mx-auto mb-3 text-red-400 font-bold text-lg font-mono">
            403
          </div>
          <h2 className="text-lg font-bold text-white mb-2 font-heading">Role Access Forbidden</h2>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Your authenticated role is <strong className="text-white uppercase font-mono">{user.role}</strong>,
            which does not have authorization to view the <strong className="text-white uppercase font-mono">{requiredRole}</strong> console.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to={`/${user.role}`}
              className="flex-1 px-4 py-2 rounded-xl bg-[#16C7C7] text-slate-950 font-bold text-xs text-center"
            >
              Go to Your Console
            </Link>
            <Link
              to="/"
              className="flex-1 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs text-center"
            >
              Role Selection
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <I18nProvider>
      <RoleProvider>
        <Router>
          <Routes>
            {/* Root: Role-Gated Entrypoint */}
            <Route path="/" element={<RoleGatedHome />} />

            {/* Authentication Routes - Fisherman */}
            <Route path="/login/fisherman" element={<FishermanLoginPage />} />
            <Route path="/signup/fisherman" element={<FishermanSignupPage />} />

            {/* Authentication Routes - Researcher */}
            <Route path="/login/researcher" element={<ResearcherLoginPage />} />
            <Route path="/signup/researcher" element={<ResearcherSignupPage />} />

            {/* Authentication Routes - Government Authority */}
            <Route path="/login/authority" element={<AuthorityLoginPage />} />
            <Route path="/signup/authority" element={<AuthorityRequestAccessPage />} />
            <Route path="/request-access/authority" element={<AuthorityRequestAccessPage />} />
            <Route path="/admin/authority" element={<AuthorityAdminConsole />} />

            {/* Role-Protected Consoles */}
            <Route
              path="/fisherman"
              element={
                <ProtectedRoute requiredRole="fisherman">
                  <FishermanEmbedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="fisherman">
                  <FishermanEmbedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/authority"
              element={
                <ProtectedRoute requiredRole="authority">
                  <AuthorityConsole />
                </ProtectedRoute>
              }
            />
            <Route
              path="/researcher"
              element={
                <ProtectedRoute requiredRole="researcher">
                  <ResearcherConsole />
                </ProtectedRoute>
              }
            />

            {/* Public Overview, About & 3D Simulation */}
            <Route path="/overview" element={<HomePage />} />
            <Route path="/about" element={<HomePage />} />
            <Route path="/3d" element={<SimulationPage />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </RoleProvider>
    </I18nProvider>
  );
}

export default App;
