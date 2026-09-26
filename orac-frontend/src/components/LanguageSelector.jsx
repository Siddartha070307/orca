import React from 'react';
import { Languages } from 'lucide-react';

export const LANGUAGE_STORAGE_KEY = 'orca_language';
export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', display: 'English' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', display: 'తెలుగు (Telugu)' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', display: 'हिन्दी (Hindi)' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', display: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', display: 'தமிழ் (Tamil)' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', display: 'മലയാളം (Malayalam)' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी', display: 'मराठी (Marathi)' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', display: 'বাংলা (Bengali)' },
  { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', display: 'ગુજરાતી (Gujarati)' },
  { code: 'or', label: 'Odia', nativeName: 'ଓଡ଼ିଆ', display: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', display: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'as', label: 'Assamese', nativeName: 'অসমীয়া', display: 'অসমীয়া (Assamese)' }
];

export const VALID_LANGUAGE_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

/**
 * Reads and validates language selection from localStorage.
 * Falls back to DEFAULT_LANGUAGE ('en') if missing, invalid, or inaccessible.
 */
export function getStoredLanguage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && VALID_LANGUAGE_CODES.has(stored)) {
        return stored;
      }
    }
  } catch (err) {
    console.warn('Unable to read orca_language from localStorage:', err);
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Persists valid language code to localStorage.
 * Always normalizes to a valid code before writing.
 */
export function setStoredLanguage(code) {
  const validCode = VALID_LANGUAGE_CODES.has(code) ? code : DEFAULT_LANGUAGE;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, validCode);
    }
  } catch (err) {
    console.warn('Unable to write orca_language to localStorage:', err);
  }
  return validCode;
}

export default function LanguageSelector({ selectedLanguage, onSelectLanguage }) {
  const currentLang = VALID_LANGUAGE_CODES.has(selectedLanguage) ? selectedLanguage : DEFAULT_LANGUAGE;

  const handleChange = (e) => {
    const newLang = e.target.value;
    const validated = setStoredLanguage(newLang);
    if (onSelectLanguage) {
      onSelectLanguage(validated);
    }
  };

  return (
    <div
      className="language-selector-container"
      title="Select Interface and Response Language"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '10px',
        padding: '3px 8px'
      }}
    >
      <Languages size={14} color="var(--marine-foam)" aria-hidden="true" />
      <select
        id="orca-language-select"
        aria-label="Select Preferred Advisory Language"
        value={currentLang}
        onChange={handleChange}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffffff',
          fontSize: '0.75rem',
          fontWeight: 500,
          outline: 'none',
          cursor: 'pointer',
          padding: '4px 0'
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            style={{ background: 'var(--header-bg)', color: '#ffffff' }}
          >
            {lang.display}
          </option>
        ))}
      </select>
    </div>
  );
}
