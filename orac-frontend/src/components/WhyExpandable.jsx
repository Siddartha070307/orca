import React, { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, ShieldAlert, ListChecks, CheckCircle2, AlertOctagon } from 'lucide-react';
import { getVerdictColor } from './VerdictBadge';
import { useTranslation } from '../i18n/useTranslation';

export default function WhyExpandable({ riskTrace, verdict }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const primaryDrivers = riskTrace?.result?.primary_drivers || [];
  const evaluatedHierarchy = riskTrace?.result?.evaluated_hierarchy || [];
  const verdictColor = getVerdictColor(verdict);

  if (primaryDrivers.length === 0 && evaluatedHierarchy.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'all 0.25s ease'
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="why-verdict-details"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: isOpen ? 'var(--marine-foam)' : 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          outline: 'none',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={15} color={verdictColor} />
          <span>{t('message.whyVerdict', 'Why this verdict? (Deterministic Safety Decision Hierarchy)')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '0.72rem' }}>{isOpen ? t('message.collapse', 'Collapse') : t('message.explainDecision', 'Explain Decision')}</span>
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {isOpen && (
        <div id="why-verdict-details" style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Primary Decision Drivers */}
          {primaryDrivers.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--marine-blue)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ShieldAlert size={14} />
                <span>{t('message.primaryDrivers', 'Primary Decision Drivers (Deterministic Findings)')}</span>
              </div>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {primaryDrivers.map((driver, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: '0.8rem',
                      lineHeight: '1.45',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      background: 'var(--bg-card-hover)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${verdictColor}`
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '1px' }}>•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluated Safety Hierarchy */}
          {evaluatedHierarchy.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--marine-blue)',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ListChecks size={14} />
                <span>{t('message.evaluatedConstraints', 'Evaluated Hard Constraints & Advisories')}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {evaluatedHierarchy.map((step, idx) => {
                  const isHardConstraint = step.toLowerCase().includes('hard constraint');
                  const isAdvisory = step.toLowerCase().includes('advisory');
                  const isDecision = step.toLowerCase().includes('decision');

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '5px',
                        fontSize: '0.76rem',
                        lineHeight: '1.4',
                        background: isDecision
                          ? 'var(--marine-foam)'
                          : 'var(--bg-card-hover)',
                        borderLeft: `2px solid ${
                          isDecision ? 'var(--marine-blue)' : isHardConstraint ? 'var(--verdict-unsafe)' : 'var(--verdict-caution)'
                        }`,
                        color: isDecision ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
