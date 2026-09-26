import React from 'react';
import { Smartphone, Radio, Satellite, CheckCircle, Terminal, MessageSquare, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export default function DispatchPanel({ dispatchedPayload, disseminationChannel }) {
  const { t } = useTranslation();
  if (!dispatchedPayload) {
    return (
      <div
        style={{
          padding: '24px',
          color: '#64748b',
          fontSize: '0.8rem',
          textAlign: 'center',
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <Info size={16} />
        <span>Awaiting query response to inspect multi-tier dissemination routing telemetry...</span>
      </div>
    );
  }

  const { channel, status, content = {}, metadata = {} } = dispatchedPayload;
  const activeChannel = disseminationChannel || channel;

  const isSms = activeChannel === 'boat_sms' || activeChannel === 'boat_near_shore';
  const isSat = activeChannel === 'boat_satellite' || activeChannel === 'boat_open_sea';
  const isApp = !isSms && !isSat;

  return (
    <div
      style={{
        padding: '14px 18px',
        height: '100%',
        overflowY: 'auto',
        fontSize: '0.8rem',
        color: '#cbd5e1'
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.12)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isApp && <Smartphone size={16} color="#38bdf8" />}
          {isSms && <Radio size={16} color="#34d399" />}
          {isSat && <Satellite size={16} color="#fbbf24" />}
          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>
            {t('dispatch.route', 'Dissemination Route:')}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.72rem',
              letterSpacing: '0.05em',
              background: isApp
                ? 'rgba(56, 189, 248, 0.15)'
                : isSms
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(251, 191, 36, 0.15)',
              color: isApp ? '#38bdf8' : isSms ? '#34d399' : '#fbbf24',
              border: `1px solid ${
                isApp
                  ? 'rgba(56, 189, 248, 0.3)'
                  : isSms
                  ? 'rgba(52, 211, 153, 0.3)'
                  : 'rgba(251, 191, 36, 0.3)'
              }`
            }}
          >
            {activeChannel ? activeChannel.toUpperCase().replace(/_/g, ' ') : 'APP'}
          </span>

          {/* Explicit Simulation Indicator Badge (Constraint 9) */}
          {(isSms || isSat) && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.06em'
              }}
            >
              {t('dispatch.simulatedBadge', 'SIMULATED BROADCAST STAND-IN')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94a3b8' }}>
          <CheckCircle size={14} color="#34d399" />
          <span>{t('dispatch.status', 'Status:')} {status || 'DISPATCHED'}</span>
        </div>
      </div>

      {/* Tier 1: App */}
      {isApp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              borderRadius: '8px',
              padding: '12px 14px'
            }}
          >
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
              {t('dispatch.appTierTitle', 'Live Web & Mobile Interactive Tier (Direct HTTPS Response)')}
            </div>
            <div style={{ color: '#94a3b8', lineHeight: '1.45', fontSize: '0.78rem' }}>
              {t('dispatch.appTierDesc', 'Full uncompressed payload delivered in active HTTP turn: interactive RFC 7946 GeoJSON layers, hourly time-series chart telemetry arrays, and 9-agent pipeline execution traces.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: '#64748b' }}>
            <span>Target Client: {content.target_ui || 'ORCA Web/Mobile Client'}</span>
            <span>•</span>
            <span>Protocol: {content.protocol || 'HTTPS_REST_API'}</span>
          </div>
        </div>
      )}

      {/* Tier 2: Near-Shore Coastal GSM SMS */}
      {isSms && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Prominent Simulation Callout */}
          <div
            style={{
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.25)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.74rem',
              color: '#fef08a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span>
              {t('dispatch.smsNotice', "Simulation Notice: This terminal demonstrates ORCA's simulated GSM SMS gateway. It formats and delivers the advisory within strict 2G cellular constraints without hardware modems.")}
            </span>
          </div>

          <div
            style={{
              background: '#091321',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: '10px',
              padding: '14px 16px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px dashed rgba(52, 211, 153, 0.2)',
                paddingBottom: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 600 }}>
                <MessageSquare size={15} />
                <span>{t('dispatch.smsTitle', 'Simulated Coastal GSM SMS Output')}</span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: (content.char_count || 0) <= 160 ? '#34d399' : '#f87171',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(52, 211, 153, 0.3)'
                }}
              >
                {t('dispatch.charsCount', '{count} / 160 chars', { count: content.char_count || (content.text ? content.text.length : 0) })}
              </div>
            </div>

            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.84rem',
                lineHeight: '1.5',
                color: '#f8fafc',
                background: 'rgba(52, 211, 153, 0.05)',
                padding: '12px',
                borderRadius: '6px',
                borderLeft: '3px solid #34d399'
              }}
            >
              {content.text || content.text_summary || metadata.raw_sms || 'SMS payload generated.'}
            </div>

            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#94a3b8',
                flexWrap: 'wrap',
                gap: '6px'
              }}
            >
              <span>Gateway: {content.gateway || 'ORCA-MockSMSGateway'}</span>
              <span>Recipient: {content.recipient || '+91-COMMUNITY-BROADCAST'}</span>
              <span>Network: 2G/3G Cellular GSM</span>
            </div>
          </div>
        </div>
      )}

      {/* Tier 3: Deep-Sea ISRO NAVIC / MSS Satellite Broadcast */}
      {isSat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Prominent Simulation Callout */}
          <div
            style={{
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.25)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.74rem',
              color: '#fef08a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span>
              {t('dispatch.satNotice', 'Simulation Stand-In: Simulates an ISRO NAVIC / MSS S-Band satellite telegram broadcast for offshore vessels beyond cellular range. Real satellite transponders are stand-ins.')}
            </span>
          </div>

          <div
            style={{
              background: '#091321',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '10px',
              padding: '14px 16px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontWeight: 600 }}>
                <Terminal size={15} />
                <span>{t('dispatch.satTitle', 'Simulated ISRO NAVIC / MSS Telegram Frame')}</span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24',
                  fontFamily: 'JetBrains Mono, monospace',
                  border: '1px solid rgba(251, 191, 36, 0.3)'
                }}
              >
                {content.frequency_band || 'S-Band 2.5 GHz MSS'}
              </span>
            </div>

            {/* Raw Telegram String with Checksum */}
            {content.raw_telegram && (
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.82rem',
                  color: '#fef08a',
                  background: 'rgba(0, 0, 0, 0.6)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(251, 191, 36, 0.25)',
                  marginBottom: '10px',
                  wordBreak: 'break-all'
                }}
              >
                {content.raw_telegram}
              </div>
            )}

            {/* Decoded Telemetry Fields */}
            {content.decoded_telemetry && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '6px',
                  fontSize: '0.72rem'
                }}
              >
                {Object.entries(content.decoded_telemetry).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}:
                    </span>{' '}
                    <strong style={{ color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                      {String(v)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Constellation: {content.satellite_constellation || 'NavIC / IRNSS-1I'}</span>
              <span>Coverage: Indian EEZ (IOR)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
