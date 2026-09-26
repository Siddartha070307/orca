import React from 'react';
import HealthBadge from './HealthBadge';
import UserTypeToggle from './UserTypeToggle';
import LanguageSelector from './LanguageSelector';
import { useTranslation } from '../i18n/useTranslation';

export default function Header({
  userType,
  onSelectUserType,
  selectedLanguage,
  onSelectLanguage
}) {
  const { t } = useTranslation();

  return (
    <header className="app-header" role="banner">
      {/* Brand Section */}
      <div className="brand-section">
        <div className="brand-logo-badge" title="ORCA — Marine Intelligence Platform">
          <img
            src="/orca-logo.svg"
            alt="ORCA Logo"
            style={{ width: '28px', height: '28px' }}
          />
        </div>
        <div className="brand-title-wrap">
          <div className="brand-title">
            <span>{t('header.brandTitle', 'ORCA')}</span>
            <span className="brand-sih-tag">{t('header.sihTag', 'ISRO • SIH26176')}</span>
          </div>
          <span className="brand-subtitle">
            {t('header.brandSubtitle', 'Marine Ecosystem Reasoning with Collaborative Agents')}
          </span>
        </div>
      </div>

      {/* Center & Right Controls */}
      <div className="header-controls">
        {/* User Type Dissemination Tier Toggle */}
        <UserTypeToggle selectedType={userType} onSelectType={onSelectUserType} />

        {/* Indic Language Selector */}
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onSelectLanguage={onSelectLanguage}
        />

        {/* Backend Health Badge (9 agents active) */}
        <HealthBadge />
      </div>
    </header>
  );
}
