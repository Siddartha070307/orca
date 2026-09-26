import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VerdictBadge, { getVerdictColor } from './VerdictBadge';
import WhyExpandable from './WhyExpandable';
import SafetyAssessmentCard from './SafetyAssessmentCard';
import AgentTraceList from './AgentTraceList';
import AudioNarrationPlayer from './AudioNarrationPlayer';
import { User, Compass, Clock, Globe, Shield, Sparkles, Languages, FileDown, AlertTriangle, Loader2 } from 'lucide-react';
import { exportPdf } from '../api/orcaClient';
import { useTranslation } from '../i18n/useTranslation';
import { getLocalizedReport, getLocalizedSummary } from '../utils/localizedReport';

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
            background: 'var(--marine-blue)',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '16px 16px 2px 16px',
            boxShadow: 'var(--shadow-sm)',
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

  const currentLang = selectedLanguage || 'en';
  const displaySummary = useMemo(() => {
    return getLocalizedSummary(data, currentLang) || safety_summary;
  }, [data, currentLang, safety_summary]);

  const displayReport = useMemo(() => {
    return getLocalizedReport(data, currentLang) || report;
  }, [data, currentLang, report]);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      await exportPdf({
        ...(data || {}),
        language: currentLang
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
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '4px 18px 18px 18px',
          padding: '14px 16px',
          boxShadow: 'var(--shadow-md)',
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
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'var(--marine-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <Compass size={15} />
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {t('message.advisoryTitle', 'ORCA Intelligence Advisory')}
              </span>
              {query_id && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '0.66rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)'
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
                background: 'var(--marine-foam)',
                border: '1px solid var(--border-medium)',
                color: 'var(--marine-cyan)',
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
              background: 'var(--marine-foam)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: 'var(--marine-blue)',
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
              background: 'var(--verdict-caution-bg)',
              border: '1px solid var(--verdict-caution-border)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: 'var(--verdict-caution)',
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
        {displaySummary && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'var(--bg-card-hover)',
              borderLeft: `4px solid ${getVerdictColor(verdict)}`,
              marginBottom: '12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: '1.4'
            }}
          >
            {displaySummary}
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
              color: 'var(--marine-blue)',
              background: 'var(--marine-foam)',
              border: '1px solid var(--border-subtle)',
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
        <AudioNarrationPlayer
          data={data}
          selectedLanguage={currentLang}
          reportText={displayReport}
          summaryText={displaySummary}
        />

        {/* Markdown Advisory Report */}
        {displayReport ? (
          <div className="markdown-report">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayReport}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            {t('message.noReport', 'No textual advisory report returned.')}
          </div>
        )}

        {/* Dedicated ORCA Safety Assessment Card */}
        <SafetyAssessmentCard data={data} riskTrace={riskTrace} selectedLanguage={currentLang} />

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
            color: 'var(--text-muted)'
          }}
        >
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
}

