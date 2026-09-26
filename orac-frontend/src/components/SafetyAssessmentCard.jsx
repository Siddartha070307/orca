import React, { useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Anchor,
  Shield,
  Navigation,
  MapPin,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export default function SafetyAssessmentCard({ data, riskTrace, selectedLanguage }) {
  const { t } = useTranslation();

  // Deterministic source of truth: backend RiskAssessmentAgent
  const risk = useMemo(() => {
    const trace = riskTrace || data?.agent_traces?.find(t => t.agent === 'RiskAssessmentAgent');
    return trace?.result || {};
  }, [data, riskTrace]);

  const planningTrace = useMemo(() => {
    return data?.agent_traces?.find(t => t.agent === 'PlanningAgent');
  }, [data]);

  const weatherTrace = useMemo(() => {
    return data?.agent_traces?.find(t => t.agent === 'WeatherIntelligenceAgent');
  }, [data]);

  const geospatialTrace = useMemo(() => {
    return data?.agent_traces?.find(t => t.agent === 'GeospatialReasoningAgent');
  }, [data]);

  // Sole safety verdict authority from deterministic backend
  const verdict = (data?.verdict || risk.verdict || 'SAFE').toUpperCase();

  // Verdict presentation mapping
  const config = useMemo(() => {
    if (verdict === 'UNSAFE') {
      return {
        label: t('safety.verdictLabelUnsafe', 'DO NOT VENTURE'),
        riskLabel: t('safety.riskLabelHigh', 'HIGH'),
        color: 'var(--verdict-unsafe)',
        bg: 'var(--verdict-unsafe-bg)',
        border: '1px solid var(--verdict-unsafe-border)',
        badgeBg: 'var(--verdict-unsafe)',
        icon: <ShieldAlert size={18} color="#ffffff" />
      };
    }
    if (verdict === 'CAUTION') {
      return {
        label: t('safety.verdictLabelCaution', 'CAUTION'),
        riskLabel: t('safety.riskLabelModerate', 'MODERATE'),
        color: 'var(--verdict-caution)',
        bg: 'var(--verdict-caution-bg)',
        border: '1px solid var(--verdict-caution-border)',
        badgeBg: 'var(--verdict-caution)',
        icon: <AlertTriangle size={18} color="#ffffff" />
      };
    }
    return {
      label: t('safety.verdictLabelSafe', 'CONDITIONS ACCEPTABLE'),
      riskLabel: t('safety.riskLabelLow', 'LOW'),
      color: 'var(--verdict-safe)',
      bg: 'var(--verdict-safe-bg)',
      border: '1px solid var(--verdict-safe-border)',
      badgeBg: 'var(--verdict-safe)',
      icon: <CheckCircle2 size={18} color="#ffffff" />
    };
  }, [verdict, t]);

  // Operational Context (Strict data integrity: no invented locations or vessel defaults)
  const route = data?.location_name || planningTrace?.result?.location_name || data?.dispatched_payload?.metadata?.location_name || t('safety.notAvailable', 'Not available');
  
  const vesselType = useMemo(() => {
    if (data?.user_type === 'boat_near_shore') return t('safety.motorizedBoat', 'Motorized Nearshore Boat (< 12m)');
    if (data?.user_type === 'boat_open_sea') return t('safety.mechanizedCraft', 'Mechanized Deep-Sea Craft (> 12m)');
    
    const explicitVessel = planningTrace?.result?.vessel_type;
    if (explicitVessel && typeof explicitVessel === 'string' && !['unknown', 'app', 'none', 'null', 'mechanized'].includes(explicitVessel.toLowerCase())) {
      return explicitVessel.charAt(0).toUpperCase() + explicitVessel.slice(1);
    }
    
    return t('safety.notProvided', 'Not provided');
  }, [data, planningTrace, t]);

  const departureTime = planningTrace?.result?.target_time || data?.time_range?.label || t('safety.notAvailable', 'Not available');
  const temporalWindow = data?.time_range?.label || (data?.time_range?.start && data?.time_range?.end ? `${data.time_range.start} to ${data.time_range.end}` : t('safety.notAvailable', 'Not available'));

  // Evidence Extraction
  const weatherMetrics = risk.weather_summary?.metrics || weatherTrace?.result?.metrics || {};
  const waveHeight = weatherMetrics.wave_height_m != null ? `${weatherMetrics.wave_height_m} m` : t('safety.notAvailable', 'Not available');
  const windSpeed = weatherMetrics.wind_speed_kmh != null ? `${weatherMetrics.wind_speed_kmh} km/h` : t('safety.notAvailable', 'Not available');
  const windGust = weatherMetrics.wind_gust_kmh != null ? `${weatherMetrics.wind_gust_kmh} km/h` : t('safety.notAvailable', 'Not available');
  const condition = weatherMetrics.storm_description || weatherMetrics.condition || (weatherMetrics.has_storm_alert ? t('safety.stormAlert', 'Convective Storm Alert') : (weatherMetrics.wind_speed_kmh != null ? t('safety.normalAtmospheric', 'Normal Atmospheric') : null)) || t('safety.notAvailable', 'Not available');

  const geoRes = geospatialTrace?.result || {};
  const isInsideRestricted = risk.geospatial_summary?.is_restricted ?? geoRes.inside_geofence ?? geoRes.is_inside_restricted;
  const boundaryDist = geoRes.nearest_boundary_distance_km;
  const geofenceStatus = isInsideRestricted
    ? `${t('safety.insideRestricted', 'Inside Restricted Area')} (${geoRes.restricted_zone_name || t('safety.sanctuary', 'Protected Sanctuary')})`
    : boundaryDist != null
    ? `${boundaryDist} ${t('safety.kmToBoundary', 'km to boundary')} (${geoRes.status_description || t('safety.clear', 'Clear')})`
    : t('safety.clearWaters', 'Clear / Unrestricted waters');

  // Primary drivers
  const primaryDrivers = risk.primary_drivers || [];

  // Recommendation: Authoritative directive strictly from backend Risk Assessment
  const recommendation = risk.actionable_directive || (
    verdict === 'UNSAFE'
      ? t('safety.dirUnsafe', 'Sea conditions evaluated as unsafe. Follow coastal maritime safety authority instructions.')
      : verdict === 'CAUTION'
      ? t('safety.dirCaution', 'Marginal marine conditions observed. Exercise heightened vigilance.')
      : t('safety.dirSafe', 'Marine conditions evaluated as acceptable for normal operations.')
  );

  // Safer alternative derived strictly from actual deterministic failure causes and evidence
  const saferAlternative = useMemo(() => {
    if (verdict === 'UNSAFE') {
      if (weatherMetrics.has_storm_alert) {
        return t('safety.altStorm', 'Delay departure until active severe convective storm warnings in the sector have cleared.');
      }
      if (weatherMetrics.wave_height_m != null && weatherMetrics.wave_height_m >= 3.5) {
        return t('safety.altWave', 'Delay departure until significant wave heights subside below unsafe operating thresholds.');
      }
      if (weatherMetrics.wind_speed_kmh != null && weatherMetrics.wind_speed_kmh >= 50.0) {
        return t('safety.altWind', 'Postpone departure until sustained wind speeds subside below unsafe operating thresholds.');
      }
      if (isInsideRestricted) {
        return t('safety.altRestricted', 'Adjust navigational route to remain outside the restricted boundary perimeter before commencing operations.');
      }
      return t('safety.altHarbor', 'Delay departure and remain in harbor until updated coastal forecasts indicate safe conditions.');
    }
    if (verdict === 'CAUTION') {
      if (isInsideRestricted || (boundaryDist != null && boundaryDist <= 2.0)) {
        return t('safety.altBuffer', 'Maintain safe navigational distance outside the restricted boundary buffer.');
      }
      return t('safety.altMonitor', 'Monitor continuous marine meteorological broadcasts and exercise heightened vigilance.');
    }
    return t('safety.altAcceptable', 'Conditions are acceptable. Maintain standard navigational vigilance and monitor routine marine weather updates.');
  }, [verdict, weatherMetrics, isInsideRestricted, boundaryDist, t]);

  // Provenance / Sources (No fabricated timestamps)
  const sources = useMemo(() => {
    const rawSources = riskTrace?.sources || weatherTrace?.sources || [];
    if (rawSources.length > 0) return rawSources;
    return [
      { name: 'Deterministic Safety Hierarchy (safety_rules.py)', timestamp: data?.timestamp || null },
      { name: 'Open-Meteo Marine Forecast API', timestamp: data?.timestamp || null },
      { name: 'INCOIS Potential Fishing Zone Mission (Simulated)', timestamp: null }
    ];
  }, [riskTrace, weatherTrace, data]);

  return (
    <div
      className="orca-safety-assessment-card"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '12px',
        padding: '16px',
        margin: '14px 0',
        boxShadow: '0 4px 16px rgba(22, 35, 46, 0.08)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Title Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '10px',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'var(--marine-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield size={16} color="#ffffff" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--marine-blue)' }}>
              {t('safety.title', 'ORCA Safety Assessment')}
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('safety.subtitle', 'Deterministic Marine Safety Decision & Risk Evidence')}
            </span>
          </div>
        </div>

        {/* Risk Level Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'var(--marine-foam)',
            border: `1px solid ${config.color}`,
            fontSize: '0.74rem',
            fontWeight: 700,
            color: config.color
          }}
        >
          <span>{t('safety.risk', 'Risk:')}</span>
          <span>{config.riskLabel}</span>
        </div>
      </div>

      {/* Decision Banner */}
      <div
        style={{
          background: config.bg,
          border: config.border,
          borderRadius: '8px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: config.badgeBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {config.icon}
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
              {t('safety.authVerdict', 'Authoritative Verdict')}
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: config.color }}>
              {config.label}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <div>{t('safety.evalEngine', 'Evaluation Engine:')} <strong style={{ color: 'var(--marine-blue)' }}>{t('safety.detRiskEngine', 'Deterministic Risk Assessment')}</strong></div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{t('safety.indepBiomass', 'Independent of PFZ Biomass')}</div>
        </div>
      </div>

      {/* Operational Context Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '14px',
          background: 'var(--bg-card-hover)',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={11} color="var(--marine-cyan)" /> {t('safety.routeSector', 'Route / Sector:')}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {route}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Anchor size={11} color="var(--marine-cyan)" /> {t('safety.vesselProfile', 'Vessel Profile:')}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: vesselType === t('safety.notProvided', 'Not provided') ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {vesselType}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Navigation size={11} color="var(--marine-cyan)" /> {t('safety.departure', 'Departure:')}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {departureTime}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} color="var(--marine-cyan)" /> {t('safety.temporalWindow', 'Temporal Window:')}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {temporalWindow}
          </span>
        </div>
      </div>

      {/* WHY? Evidence Section */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--marine-blue)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <HelpCircle size={14} color="var(--marine-blue)" />
          <span>{t('safety.whyTitle', 'Why? Deterministic findings & evidence')}</span>
        </div>

        {/* Environmental Parameters Grid - Critical Data Integrity (No Fabrication) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '6px',
            marginBottom: '10px'
          }}
        >
          <div style={{ padding: '8px', background: 'var(--marine-foam)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.waveHeight', 'Significant Wave Height')}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: weatherMetrics.wave_height_m >= 3.5 ? 'var(--verdict-unsafe)' : weatherMetrics.wave_height_m >= 2.0 ? 'var(--verdict-caution)' : 'var(--text-primary)' }}>{waveHeight}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--marine-foam)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.windSpeed', 'Sustained Wind Speed')}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: weatherMetrics.wind_speed_kmh >= 50.0 ? 'var(--verdict-unsafe)' : weatherMetrics.wind_speed_kmh >= 35.0 ? 'var(--verdict-caution)' : 'var(--text-primary)' }}>{windSpeed}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--marine-foam)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.windGust', 'Max Forecast Gust')}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: weatherMetrics.wind_gust_kmh >= 70.0 ? 'var(--verdict-unsafe)' : weatherMetrics.wind_gust_kmh >= 55.0 ? 'var(--verdict-caution)' : 'var(--text-primary)' }}>{windGust}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--marine-foam)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.severeWeather', 'Severe Weather / WMO')}</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{condition}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--marine-foam)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.zoneStatus', 'Restricted-Zone Status')}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isInsideRestricted ? 'var(--verdict-unsafe)' : 'var(--verdict-safe)' }}>{geofenceStatus}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--bg-deep)', borderRadius: '6px', border: '1px dashed var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.swellHeight', 'Swell Height')}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('safety.notAvailable', 'Not available')}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--bg-deep)', borderRadius: '6px', border: '1px dashed var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.wavePeriod', 'Wave Period')}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('safety.notAvailable', 'Not available')}</div>
          </div>

          <div style={{ padding: '8px', background: 'var(--bg-deep)', borderRadius: '6px', border: '1px dashed var(--border-subtle)' }}>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{t('safety.currentVelocity', 'Ocean Current Velocity')}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('safety.notAvailable', 'Not available')}</div>
          </div>
        </div>

        {/* Primary Deterministic Drivers List */}
        {primaryDrivers.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {primaryDrivers.map((driver, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: '0.76rem',
                  lineHeight: '1.4',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card-hover)',
                  padding: '6px 10px',
                  borderRadius: '5px',
                  borderLeft: `3px solid ${config.color}`
                }}
              >
                • {driver}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RECOMMENDATION Section */}
      <div
        style={{
          background: 'var(--bg-card-hover)',
          borderLeft: `4px solid ${config.color}`,
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '10px'
        }}
      >
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: config.color, display: 'block', marginBottom: '2px' }}>
          {t('safety.recommendation', 'Recommendation')}
        </span>
        <span style={{ fontSize: '0.8rem', lineHeight: '1.45', color: 'var(--text-primary)', fontWeight: 600 }}>
          {recommendation}
        </span>
      </div>

      {/* SAFER ALTERNATIVE Section */}
      <div
        style={{
          background: 'var(--marine-foam)',
          borderLeft: '4px solid var(--marine-cyan)',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '12px'
        }}
      >
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--marine-cyan)', display: 'block', marginBottom: '2px' }}>
          {t('safety.saferAlternative', 'Safer Alternative')}
        </span>
        <span style={{ fontSize: '0.78rem', lineHeight: '1.45', color: 'var(--text-primary)' }}>
          {saferAlternative}
        </span>
      </div>

      {/* EVIDENCE & PROVENANCE Section (Strict timestamp integrity) */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          fontSize: '0.66rem',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={11} color="var(--text-muted)" />
            <span>{t('safety.evidenceSources', 'Evidence Sources:')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {sources.map(s => s.name).join(', ')}
            </span>
          </div>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
            {t('safety.timestamp', 'Timestamp:')} {(() => {
              if (!data?.timestamp) return t('safety.notAvailable', 'Not available');
              const parsed = new Date(data.timestamp);
              return isNaN(parsed.getTime()) ? t('safety.notAvailable', 'Not available') : parsed.toLocaleString();
            })()}
          </div>
        </div>

        <div>
          <span>{t('safety.scope', 'Scope:')} </span>
          <strong style={{ color: 'var(--text-primary)' }}>{temporalWindow}</strong>
        </div>
      </div>
    </div>
  );
}
