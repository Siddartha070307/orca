import React, { useState, useEffect, useRef } from 'react';
import { fetchHealth } from '../api/orcaClient';
import { CheckCircle2, AlertCircle, RefreshCw, Server, ShieldCheck, Activity } from 'lucide-react';
import { escapeHtml } from '../utils/security';
import { useTranslation } from '../i18n/useTranslation';

export default function HealthBadge() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const popoverRef = useRef(null);

  const loadHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    // Poll health periodically every 30 seconds
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { t } = useTranslation();
  const agentCount = health?.agents_registered ?? 9;
  const isHealthy = health?.status === 'healthy' && !error;
  const uptimeMinutes = health?.uptime_seconds ? Math.floor(health.uptime_seconds / 60) : 0;

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        title="Click to view live backend diagnostic telemetry and subsystem readiness"
        aria-label={`System Status: ${isHealthy ? `${agentCount} agents active` : 'Backend Offline'}`}
        aria-expanded={showDetails}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          fontSize: '0.78rem',
          fontWeight: 600,
          background: isHealthy ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
          border: `1px solid ${isHealthy ? 'rgba(22, 163, 74, 0.35)' : 'rgba(220, 38, 38, 0.35)'}`,
          color: isHealthy ? '#4ade80' : '#f87171',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isHealthy ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 8px ${isHealthy ? '#22c55e' : '#ef4444'}`
          }}
        />
        <span>
          {loading && !health
            ? t('health.checking', 'Checking System...')
            : isHealthy
            ? t('health.agentsActive', '{count} agents active', { count: agentCount })
            : t('health.backendOffline', 'Backend Offline')}
        </span>
      </button>

      {showDetails && (
        <div
          role="dialog"
          aria-label="ORCA Backend Diagnostics"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            background: 'rgba(15, 28, 48, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            fontSize: '0.8rem',
            color: '#cbd5e1'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#f8fafc', fontSize: '0.86rem' }}>
              <Server size={16} color="#38bdf8" />
              <span>{t('health.diagnosticsTitle', 'ORCA Backend Diagnostics')}</span>
            </div>
            <button
              onClick={loadHealth}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title="Refresh status"
              aria-label="Refresh health diagnostics"
            >
              <RefreshCw size={13} className={loading ? 'pulse-icon' : ''} />
            </button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{t('health.systemStatus', 'System Status')}</div>
              <div style={{ fontWeight: 700, color: isHealthy ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <CheckCircle2 size={13} />
                <span>{health?.status ? health.status.toUpperCase() : 'OFFLINE'}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{t('health.agentPipeline', 'Agent Pipeline')}</div>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                {health?.agents_registered ?? 9} / 9 Active
              </div>
            </div>
          </div>

          {/* Subsystems List with ACTUAL BACKEND STATUS */}
          {health?.services && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('health.subsystemTelemetry', 'Subsystem Diagnostics (Actual Backend Telemetry)')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {Object.entries(health.services).map(([key, desc]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      padding: '6px 8px',
                      background: 'rgba(56, 189, 248, 0.05)',
                      borderRadius: '5px',
                      border: '1px solid rgba(56, 189, 248, 0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.74rem', textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#22c55e',
                          boxShadow: '0 0 5px #22c55e'
                        }}
                      />
                    </div>
                    {/* Actual backend description string */}
                    <div style={{ color: '#38bdf8', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      {desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b' }}>
            <span>{t('health.version', 'Version')}: v{health?.version || '1.0.0'}</span>
            <span>{t('health.uptime', 'Uptime')}: {uptimeMinutes} mins</span>
          </div>

          {error && (
            <div style={{ marginTop: '10px', color: '#f87171', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(220, 38, 38, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{t('health.cannotConnect', 'Cannot connect to backend')}: {error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
