import React from 'react';
import { Smartphone, Radio, Satellite } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export default function UserTypeToggle({ selectedType, onSelectType }) {
  const { t } = useTranslation();

  const userTypes = [
    {
      id: 'app',
      label: t('userType.app', 'App Tier'),
      desc: t('userType.appDesc', 'Web / Mobile (Rich JSON)'),
      icon: Smartphone
    },
    {
      id: 'boat_near_shore',
      label: t('userType.nearShore', 'Near-Shore'),
      desc: t('userType.nearShoreDesc', 'Coastal 2G SMS (<160c)'),
      icon: Radio
    },
    {
      id: 'boat_open_sea',
      label: t('userType.deepSea', 'Deep Sea'),
      desc: t('userType.deepSeaDesc', 'ISRO NAVIC / Satellite'),
      icon: Satellite
    }
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '10px',
        padding: '3px',
        gap: '3px'
      }}
    >
      {userTypes.map((tItem) => {
        const Icon = tItem.icon;
        const isSelected = selectedType === tItem.id;
        return (
          <button
            key={tItem.id}
            onClick={() => onSelectType(tItem.id)}
            title={tItem.desc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '7px',
              border: 'none',
              background: isSelected ? 'var(--marine-cyan)' : 'transparent',
              color: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
              fontWeight: isSelected ? 600 : 500,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Icon size={14} strokeWidth={isSelected ? 2.2 : 1.8} />
            <span>{tItem.label}</span>
          </button>
        );
      })}
    </div>
  );
}
