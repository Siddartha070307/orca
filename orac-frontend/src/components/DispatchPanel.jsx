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
          color: 'var(--text-muted)',
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
        color: 'var(--text-primary)'
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
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isApp && <Smartphone size={16} color="var(--marine-blue)" />}
          {isSms && <Radio size={16} color="var(--marine-cyan)" />}
          {isSat && <Satellite size={16} color="var(--verdict-caution)" />}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--marine-blue)', fontSize: '0.9rem' }}>
            {t('dispatch.route', 'Dissemination Route:')}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: isApp
                ? 'var(--marine-foam)'
                : isSms
                ? 'var(--verdict-safe-bg)'
                : 'var(--verdict-caution-bg)',
              color: isApp ? 'var(--marine-blue)' : isSms ? 'var(--verdict-safe)' : 'var(--verdict-caution)',
              border: `1px solid ${
                isApp
                  ? 'var(--border-medium)'
                  : isSms
                  ? 'var(--verdict-safe-border)'
                  : 'var(--verdict-caution-border)'
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
                color: 'var(--verdict-caution)',
                background: 'var(--verdict-caution-bg)',
                border: '1px solid var(--verdict-caution-border)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              {t('dispatch.simulatedBadge', 'Simulated broadcast stand-in')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <CheckCircle size={14} color="var(--verdict-safe)" />
          <span>{t('dispatch.status', 'Status:')} {status || 'DISPATCHED'}</span>
        </div>
      </div>

      {/* Tier 1: App */}
      {isApp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '12px 14px'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--marine-blue)', marginBottom: '4px' }}>
              {t('dispatch.appTierTitle', 'Live Web & Mobile Interactive Tier (Direct HTTPS Response)')}
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.45', fontSize: '0.78rem' }}>
              {t('dispatch.appTierDesc', 'Full uncompressed payload delivered in active HTTP turn: interactive RFC 7946 GeoJSON layers, hourly time-series chart telemetry arrays, and 9-agent pipeline execution traces.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
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
              background: 'var(--verdict-caution-bg)',
              border: '1px solid var(--verdict-caution-border)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.74rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} color="var(--verdict-caution)" style={{ flexShrink: 0 }} />
            <span>
              {t('dispatch.smsNotice', "Simulation Notice: This terminal demonstrates ORCA's simulated GSM SMS gateway. It formats and delivers the advisory within strict 2G cellular constraints without hardware modems.")}
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(22, 35, 46, 0.06)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                borderBottom: '1px dashed var(--border-subtle)',
                paddingBottom: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--marine-cyan)', fontWeight: 600 }}>
                <MessageSquare size={15} />
                <span>{t('dispatch.smsTitle', 'Simulated Coastal GSM SMS Output')}</span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: (content.char_count || 0) <= 160 ? 'var(--marine-cyan)' : 'var(--verdict-unsafe)',
                  background: 'var(--marine-foam)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {t('dispatch.charsCount', '{count} / 160 chars', { count: content.char_count || (content.text ? content.text.length : 0) })}
              </div>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.84rem',
                lineHeight: '1.5',
                color: 'var(--text-primary)',
                background: 'var(--bg-card-hover)',
                padding: '12px',
                borderRadius: '6px',
                borderLeft: '3px solid var(--marine-cyan)'
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
                color: 'var(--text-muted)',
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
              background: 'var(--verdict-caution-bg)',
              border: '1px solid var(--verdict-caution-border)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.74rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} color="var(--verdict-caution)" style={{ flexShrink: 0 }} />
            <span>
              {t('dispatch.satNotice', 'Simulation Stand-In: Simulates an ISRO NAVIC / MSS S-Band satellite telegram broadcast for offshore vessels beyond cellular range. Real satellite transponders are stand-ins.')}
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(22, 35, 46, 0.06)'
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--verdict-caution)', fontWeight: 600 }}>
                <Terminal size={15} />
                <span>{t('dispatch.satTitle', 'Simulated ISRO NAVIC / MSS Telegram Frame')}</span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--verdict-caution-bg)',
                  color: 'var(--verdict-caution)',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--verdict-caution-border)'
                }}
              >
                {content.frequency_band || 'S-Band 2.5 GHz MSS'}
              </span>
            </div>

            {/* Raw Telegram String with Checksum */}
            {content.raw_telegram && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-deep)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
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
                      background: 'var(--bg-card-hover)',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}:
                    </span>{' '}
                    <strong style={{ color: 'var(--marine-blue)', fontFamily: 'var(--font-mono)' }}>
                      {String(v)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Constellation: {content.satellite_constellation || 'NavIC / IRNSS-1I'}</span>
              <span>Coverage: Indian EEZ (IOR)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
