import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider, useRole } from './context/RoleContext';
import { I18nProvider } from './utils/i18n';
import { RoleSelectScreen } from './components/auth/RoleSelectScreen';
import { FishermanEmbedPage } from './pages/FishermanEmbedPage';
import { AuthorityConsole } from './pages/AuthorityConsole';
import { ResearcherConsole } from './pages/ResearcherConsole';
import { HomePage } from './pages/HomePage';
import { SimulationPage } from './pages/SimulationPage';

/**
 * Root role-gated router:
 * Renders the role selection gate if no role is stored in RoleContext/localStorage.
 * Once a role is selected, routes immediately to that role's dedicated experience.
 */
function RoleGatedHome() {
  const { role } = useRole();

  if (!role) {
    return <RoleSelectScreen />;
  }

  switch (role) {
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

export function App() {
  return (
    <I18nProvider>
      <RoleProvider>
        <Router>
          <Routes>
            {/* Root: Role-Gated Entrypoint */}
            <Route path="/" element={<RoleGatedHome />} />

            {/* Direct Deep-Links for Roles */}
            <Route path="/fisherman" element={<FishermanEmbedPage />} />
            <Route path="/authority" element={<AuthorityConsole />} />
            <Route path="/researcher" element={<ResearcherConsole />} />
            <Route path="/dashboard" element={<FishermanEmbedPage />} />

            {/* Optional Marketing Landing Page & 3D Simulation */}
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
