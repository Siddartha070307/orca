import React, { useEffect } from 'react';

export const DashboardPage: React.FC = () => {
  useEffect(() => {
    window.location.href = import.meta.env.VITE_ORAC_FRONTEND_URL || 'http://localhost:3000';
  }, []);

  return null;
};

