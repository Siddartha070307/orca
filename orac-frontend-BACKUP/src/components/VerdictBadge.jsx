import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Authoritative Safety Verdict Color Values
 * Exact hex values specified in the ORCA Frontend Handover:
 * SAFE -> #16a34a
 * CAUTION -> #d97706
 * UNSAFE -> #dc2626
 */
export const VERDICT_COLORS = {
  SAFE: '#16a34a',
  CAUTION: '#d97706',
  UNSAFE: '#dc2626',
  UNKNOWN: '#64748b'
};

export const VERDICT_BACKGROUNDS = {
  SAFE: 'rgba(22, 163, 74, 0.16)',
  CAUTION: 'rgba(217, 119, 6, 0.16)',
  UNSAFE: 'rgba(220, 38, 38, 0.16)',
  UNKNOWN: 'rgba(100, 116, 139, 0.16)'
};

export const VERDICT_BORDERS = {
  SAFE: 'rgba(22, 163, 74, 0.45)',
  CAUTION: 'rgba(217, 119, 6, 0.45)',
  UNSAFE: 'rgba(220, 38, 38, 0.45)',
  UNKNOWN: 'rgba(100, 116, 139, 0.45)'
};

export function getVerdictColor(verdict) {
  if (!verdict) return VERDICT_COLORS.UNKNOWN;
  const upper = String(verdict).toUpperCase().trim();
  return VERDICT_COLORS[upper] || VERDICT_COLORS.UNKNOWN;
}

export default function VerdictBadge({ verdict, size = 'md', showIcon = true }) {
  const { t } = useTranslation();
  const normVerdict = verdict ? String(verdict).toUpperCase().trim() : 'UNKNOWN';
  const color = getVerdictColor(normVerdict);
  const bg = VERDICT_BACKGROUNDS[normVerdict] || VERDICT_BACKGROUNDS.UNKNOWN;
  const border = VERDICT_BORDERS[normVerdict] || VERDICT_BORDERS.UNKNOWN;

  const getIcon = () => {
    const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
    switch (normVerdict) {
      case 'SAFE':
        return <ShieldCheck size={iconSize} strokeWidth={2.5} aria-hidden="true" />;
      case 'CAUTION':
        return <AlertTriangle size={iconSize} strokeWidth={2.5} aria-hidden="true" />;
      case 'UNSAFE':
        return <ShieldAlert size={iconSize} strokeWidth={2.5} aria-hidden="true" />;
      default:
        return <HelpCircle size={iconSize} strokeWidth={2.5} aria-hidden="true" />;
    }
  };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '0.7rem', gap: '4px' },
    md: { padding: '5px 12px', fontSize: '0.78rem', gap: '6px' },
    lg: { padding: '7px 16px', fontSize: '0.92rem', gap: '8px' }
  }[size] || { padding: '5px 12px', fontSize: '0.78rem', gap: '6px' };

  return (
    <span
      role="status"
      aria-label={`Safety Verdict: ${normVerdict}`}
      className={`verdict-badge verdict-${normVerdict.toLowerCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: color,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        boxShadow: `0 0 12px ${bg}`,
        ...sizeStyles
      }}
    >
      {showIcon && getIcon()}
      <span>{t(`verdict.${normVerdict}`, normVerdict)}</span>
    </span>
  );
}
