import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getStoredLanguage, setStoredLanguage, DEFAULT_LANGUAGE, VALID_LANGUAGE_CODES } from '../components/LanguageSelector';
import { parseLanguageSyncMessage, readLanguageFromUrl } from './languageSync';

// Import all 12 pre-generated locale dictionaries
import en from './locales/en.json';
import te from './locales/te.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ta from './locales/ta.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import or_lang from './locales/or.json';
import pa from './locales/pa.json';
import as_lang from './locales/as.json';

const LOCALES = {
  en,
  te,
  hi,
  kn,
  ta,
  ml,
  mr,
  bn,
  gu,
  or: or_lang,
  pa,
  as: as_lang
};

const I18nContext = createContext(null);

/**
 * Resolves a dot-delimited key from an object, e.g. 'chat.assistantTitle'
 */
function resolveKey(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'string' ? curr : undefined;
}

/**
 * Replaces {param} placeholders with provided values
 */
function interpolate(template, params) {
  if (!template || !params || typeof params !== 'object') return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return key in params && params[key] !== undefined ? String(params[key]) : match;
  });
}

export function I18nProvider({ children, initialLanguage }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // 1. `?lang=` from the orca-home shell wins on direct loads (new tab /
    //    cross-app redirect) so the embedded and standalone views agree.
    const urlLanguage = readLanguageFromUrl();
    if (urlLanguage) {
      setStoredLanguage(urlLanguage);
      return urlLanguage;
    }
    // 2. Explicit prop, 3. persisted choice, 4. default.
    if (initialLanguage && VALID_LANGUAGE_CODES.has(initialLanguage)) {
      return initialLanguage;
    }
    return getStoredLanguage();
  });

  const changeLanguage = useCallback((code) => {
    const validated = setStoredLanguage(code);
    setCurrentLanguage(validated);
  }, []);

  // Listen for validated language sync messages from the orca-home shell.
  // The listener only ever *applies* a language — this app never posts back,
  // so there is no possibility of a message loop between the two apps.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleMessage = (event) => {
      const language = parseLanguageSyncMessage(event);
      if (!language) return;
      changeLanguage(language);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [changeLanguage]);

  const t = useCallback(
    (keyPath, defaultText = '', params = {}) => {
      const activeDict = LOCALES[currentLanguage] || LOCALES.en;
      const fallbackDict = LOCALES.en;

      let text = resolveKey(activeDict, keyPath);
      if (text === undefined && currentLanguage !== 'en') {
        text = resolveKey(fallbackDict, keyPath);
      }
      if (text === undefined) {
        text = defaultText || keyPath;
      }
      return interpolate(text, params);
    },
    [currentLanguage]
  );

  const value = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    t
  }), [currentLanguage, changeLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context) {
    return context;
  }

  // Standalone fallback if used outside provider
  const lang = getStoredLanguage();
  const t = (keyPath, defaultText = '', params = {}) => {
    const activeDict = LOCALES[lang] || LOCALES.en;
    const fallbackDict = LOCALES.en;

    let text = resolveKey(activeDict, keyPath);
    if (text === undefined && lang !== 'en') {
      text = resolveKey(fallbackDict, keyPath);
    }
    if (text === undefined) {
      text = defaultText || keyPath;
    }
    return interpolate(text, params);
  };

  return {
    currentLanguage: lang,
    changeLanguage: setStoredLanguage,
    t
  };
}

export default useTranslation;
