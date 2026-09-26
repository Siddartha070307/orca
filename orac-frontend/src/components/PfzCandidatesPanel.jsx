import React from 'react';
import { Star, ShieldAlert, ShieldCheck, Waves, Compass, Navigation, Fish, Thermometer, Wind, Play } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

/**
 * PfzCandidatesPanel
 * Displays all 4 INCOIS PFZ Candidates with full localization:
 * - Rank (1-4) & Recommended status for Rank 1
 * - Authoritative ORCA trip safety verdict
 * - Restricted marine zone / geofence status
 * - Distance, bearing, SST, chlorophyll-a
 * - Single source of truth Fish Density Index (0.0 - 10.0) with progress bar
 * - Target catch species
 * - "Simulate Route (3D)" action button
 */
export default function PfzCandidatesPanel({
  candidates = [],
  verdict = 'SAFE',
  onStartSimulation,
}) {
  const { t } = useTranslation();

  if (!candidates || candidates.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        background: 'var(--bg-deep)',
        borderRadius: '8px',
        border: '1px dashed var(--border-medium)',
        margin: '12px'
      }}>
        <Waves size={28} color="var(--marine-cyan)" style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.8 }} />
        <span>{t('pfz.noCandidates', 'No PFZ candidates available yet. Submit a query to inspect marine intelligence.')}</span>
      </div>
    );
  }

  const verdictUpper = (verdict || 'SAFE').toUpperCase();
  const isTripSafe = verdictUpper === 'SAFE';
  const isTripCaution = verdictUpper === 'CAUTION';
  const localizedVerdict = t(`verdict.${verdictUpper}`, verdictUpper);

  return (
    <div style={{ padding: '14px', overflowY: 'auto', height: '100%' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Waves size={16} color="var(--marine-cyan)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--marine-blue)' }}>
            {t('pfz.title', 'INCOIS Marine PFZ Candidates')} ({candidates.length})
          </span>
        </div>

        <div style={{
          fontSize: '0.72rem',
          padding: '3px 8px',
          borderRadius: '4px',
          fontWeight: 700,
          background: isTripSafe ? 'var(--verdict-safe-bg)' : isTripCaution ? 'var(--verdict-caution-bg)' : 'var(--verdict-unsafe-bg)',
          color: isTripSafe ? 'var(--verdict-safe)' : isTripCaution ? 'var(--verdict-caution)' : 'var(--verdict-unsafe)',
          border: isTripSafe ? 'var(--verdict-safe-border)' : isTripCaution ? 'var(--verdict-caution-border)' : 'var(--verdict-unsafe-border)'
        }}>
          {t('pfz.tripVerdict', 'Trip Verdict:')} {localizedVerdict}
        </div>
      </div>

      {/* Grid of 4 Candidates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
        paddingBottom: '16px'
      }}>
        {candidates.map((cand, index) => {
          const rank = cand.rank || (index + 1);
          const isRec = cand.is_recommended || rank === 1;
          const fdi = typeof cand.fish_density_index === 'number' ? cand.fish_density_index : 7.0;
          const fdiPct = Math.min(100, Math.max(0, (fdi / 10.0) * 100));
          const isRestricted = !!cand.is_in_restricted_zone;

          const fdiRating = fdi >= 7.5 ? t('pfz.highDensity', 'High Density Index') : fdi >= 5.0 ? t('pfz.modDensity', 'Moderate Density Index') : t('pfz.lowDensity', 'Low Density Index');
          const fdiColor = fdi >= 7.5 ? 'var(--verdict-safe)' : fdi >= 5.0 ? 'var(--marine-blue)' : 'var(--verdict-caution)';

          return (
            <div
              key={cand.id || `pfz-${rank}`}
              style={{
                background: isRec ? 'var(--bg-card-hover)' : 'var(--bg-surface)',
                border: isRec ? '1.5px solid var(--marine-cyan)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                boxShadow: isRec ? '0 4px 12px rgba(31, 122, 108, 0.12)' : '0 2px 6px rgba(22, 35, 46, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Card Top: Rank Badge & Recommendation */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: isRec ? 'var(--marine-cyan)' : 'var(--marine-foam)',
                      color: isRec ? '#ffffff' : 'var(--marine-blue)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isRec && <Star size={12} fill="#ffffff" />}
                      PFZ #{rank}
                    </span>
                    {isRec && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--marine-cyan)', fontWeight: 700 }}>
                        {t('pfz.topRecommended', 'Top Recommended')}
                      </span>
                    )}
                  </div>

                  {/* Geofence / Zone Status */}
                  <span style={{
                    fontSize: '0.66rem',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isRestricted ? 'var(--verdict-unsafe-bg)' : 'var(--verdict-safe-bg)',
                    color: isRestricted ? 'var(--verdict-unsafe)' : 'var(--verdict-safe)',
                    border: isRestricted ? 'var(--verdict-unsafe-border)' : 'var(--verdict-safe-border)'
                  }}>
                    {isRestricted ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
                    {isRestricted ? t('pfz.restricted', 'Restricted') : t('pfz.openWaters', 'Open Waters')}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 12px',
                  fontSize: '0.74rem',
                  margin: '8px 0'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{t('pfz.distance', 'Distance:')} </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(cand.distance_km || 0).toFixed(1)} km</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{t('pfz.bearing', 'Bearing:')} </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(cand.bearing_deg || 0).toFixed(0)}°</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{t('pfz.sst', 'SST:')} </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(cand.sst_celsius || 28.5).toFixed(1)} °C</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{t('pfz.chlorophyll', 'Chlorophyll:')} </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(cand.chlorophyll_mg_m3 || 1.8).toFixed(2)} mg/m³</span>
                  </div>
                </div>

                {/* Fish Density Index Bar */}
                <div style={{
                  background: 'var(--bg-deep)',
                  padding: '6px 8px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-subtle)',
                  margin: '6px 0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Fish size={12} color={fdiColor} />
                      {t('pfz.fishDensityIndex', 'Fish Density Index:')}
                    </span>
                    <span style={{ color: fdiColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {fdi.toFixed(1)} / 10.0 ({fdiRating})
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '5px',
                    background: 'var(--border-subtle)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginTop: '4px'
                  }}>
                    <div style={{
                      width: `${fdiPct}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, var(--marine-blue), ${fdiColor})`,
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>

                {/* Target Catch Species */}
                {Array.isArray(cand.target_species) && cand.target_species.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('pfz.catch', 'Catch:')} </span>
                    <span style={{ color: 'var(--marine-blue)', fontWeight: 600 }}>{cand.target_species.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Action Button: Simulate Route (3D) */}
              <button
                onClick={() => onStartSimulation && onStartSimulation(cand)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  background: isRec ? 'var(--marine-cyan)' : 'var(--marine-foam)',
                  border: `1px solid ${isRec ? 'var(--marine-cyan)' : 'var(--border-medium)'}`,
                  color: isRec ? '#ffffff' : 'var(--marine-blue)',
                  padding: '7px 0',
                  borderRadius: '5px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isRec ? '#186458' : 'var(--bg-card-hover)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(31, 122, 108, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isRec ? 'var(--marine-cyan)' : 'var(--marine-foam)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Play size={12} fill="currentColor" />
                {t('pfz.simulateRoute', 'Simulate Route (3D)')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
