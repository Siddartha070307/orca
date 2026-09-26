import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VerdictBadge, { getVerdictColor } from './VerdictBadge';
import WhyExpandable from './WhyExpandable';
import AgentTraceList from './AgentTraceList';
import AudioNarrationPlayer from './AudioNarrationPlayer';
import { User, Compass, Clock, Globe, Shield, Sparkles, Languages, FileDown, AlertTriangle, Loader2 } from 'lucide-react';
import { exportPdf } from '../api/orcaClient';
import { useTranslation } from '../i18n/useTranslation';

export default function MessageBubble({ message, selectedLanguage }) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const { sender, data, text, timestamp } = message;

  // Render User Message
  if (sender === 'user') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '16px',
          padding: '0 8px'
        }}
      >
        <div
          style={{
            maxWidth: '85%',
            background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
            color: '#f8fafc',
            padding: '10px 14px',
            borderRadius: '16px 16px 2px 16px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            fontSize: '0.86rem',
            lineHeight: '1.45'
          }}
        >
          <div style={{ wordBreak: 'break-word' }}>{text}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              fontSize: '0.66rem',
              color: 'rgba(255, 255, 255, 0.75)',
              marginTop: '4px'
            }}
          >
            <Clock size={10} />
            <span>
              {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render ORCA Assistant Message
  const {
    verdict,
    safety_summary,
    report,
    detected_language,
    translated_query,
    original_query,
    time_range,
    agent_traces = [],
    query_id,
    translation_status
  } = data || {};

  const riskTrace = agent_traces.find((t) => t.agent === 'RiskAssessmentAgent');
  const isTranslated = detected_language && detected_language !== 'en' && translated_query;

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      await exportPdf({
        ...(data || {}),
        language: selectedLanguage || (data && data.language) || 'en'
      });
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF advisory. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '20px',
        padding: '0 8px'
      }}
    >
      <div
        style={{
          background: 'rgba(15, 28, 48, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '4px 18px 18px 18px',
          padding: '14px 16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          position: 'relative'
        }}
      >
        {/* Top Header: ORCA Branding + PDF Export Button + Verdict Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
            borderBottom: '1px solid rgba(56, 189, 248, 0.12)',
            paddingBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <Compass size={15} />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                {t('message.advisoryTitle', 'ORCA Intelligence Advisory')}
              </span>
              {query_id && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '0.66rem',
                    color: '#64748b',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  {query_id}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              title="Download official PDF advisory report"
              aria-label="Download PDF report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isExporting ? 0.7 : 1
              }}
            >
              {isExporting ? (
                <>
                  <Loader2 size={13} className="spin-icon" />
                  <span>{t('message.generatingPdf', 'Generating PDF...')}</span>
                </>
              ) : (
                <>
                  <FileDown size={13} />
                  <span>{t('message.downloadPdf', 'Download PDF')}</span>
                </>
              )}
            </button>

            <VerdictBadge verdict={verdict} size="md" />
          </div>
        </div>

        {/* Translation metadata callout if non-English query was received */}
        {isTranslated && (
          <div
            style={{
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={13} />
            <span>
              Detected <strong>{detected_language.toUpperCase()}</strong>: "{original_query}" → "{translated_query}"
            </span>
          </div>
        )}

        {/* Translation Fallback Notice (if translation failed and English advisory is shown) */}
        {translation_status === 'fallback_en' && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={13} />
            <span>{t('message.translationUnavailable', 'Translation unavailable, showing English advisory.')}</span>
          </div>
        )}

        {/* Safety Summary Headline */}
        {safety_summary && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderLeft: `4px solid ${getVerdictColor(verdict)}`,
              marginBottom: '12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#e2e8f0',
              lineHeight: '1.4'
            }}
          >
            {safety_summary}
          </div>
        )}

        {/* Temporal Window Badge */}
        {time_range?.label && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.7rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          >
            <Clock size={11} />
            <span>{t('message.evaluatedWindow', 'Evaluated Window:')} {time_range.label}</span>
          </div>
        )}

        {/* Audio Narration Bar */}
        <AudioNarrationPlayer data={data} selectedLanguage={selectedLanguage} />

        {/* Markdown Advisory Report */}
        {report ? (
          <div className="markdown-report">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
            {t('message.noReport', 'No textual advisory report returned.')}
          </div>
        )}

        {/* Expandable "Why?" Decision Section */}
        <WhyExpandable riskTrace={riskTrace} verdict={verdict} />

        {/* Expandable "Full Agent Trace" Section */}
        <AgentTraceList traces={agent_traces} />

        {/* Footer Timestamp */}
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: '0.66rem',
            color: '#64748b'
          }}
        >
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
}

