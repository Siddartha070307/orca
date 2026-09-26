/**
 * ORCA Audio Narration Utility
 * Provides text-to-speech synthesis and script formulation for ORCA Marine Intelligence advisories
 * across all 12 supported Indian coastal languages.
 */

import { getLocalizedReport, getLocalizedSummary, hasScriptForLanguage } from './localizedReport';

export const INDIC_BCP47_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  or: 'or-IN',
  pa: 'pa-IN',
  as: 'as-IN'
};

export const GTTS_SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa'];

/**
 * Strips markdown formatting, tables, code blocks, and symbols for natural speech synthesis.
 */
export function stripMarkdownForSpeech(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown images ![alt](url) -> ''
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove markdown headers #, ##, ###
    .replace(/^#{1,6}\s+(.+)$/gm, '$1. ')
    // Remove markdown bold / italics **text** or *text*
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove markdown table divider rows |--|--|
    .replace(/\|[\s:\-]+\|[\s:\-|]*/g, '')
    // Replace markdown table pipes with pauses
    .replace(/\|/g, ', ')
    // Replace bullet points with brief pauses
    .replace(/^[\s*+\-]+\s+/gm, '. ')
    // Expand metric symbols and common maritime abbreviations for natural speech
    .replace(/(\d+)\s*km\/h/gi, '$1 km/h')
    .replace(/(\d+)\s*°C/gi, '$1 degrees Celsius')
    // Collapse consecutive periods, commas, and whitespace
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,/g, ',')
    .trim();
}

/**
 * Formulates the audio narration script directly from translated report and summary in the selected language.
 * Strictly verifies that the spoken text matches the target language script before synthesizing.
 */
export function generateAudioScript(data, language = 'en', customReport = null, customSummary = null) {
  if (!data && !customReport && !customSummary) return '';

  const targetLang = INDIC_BCP47_MAP[language] ? language : 'en';

  // Strictly validate customSummary against target language script
  let summary = '';
  if (customSummary && typeof customSummary === 'string' && hasScriptForLanguage(customSummary, targetLang)) {
    summary = customSummary;
  } else {
    summary = getLocalizedSummary(data, targetLang) || (targetLang === 'en' ? (data?.safety_summary || data?.final_summary || '') : '');
  }

  // Strictly validate customReport against target language script
  let report = '';
  if (customReport && typeof customReport === 'string' && hasScriptForLanguage(customReport, targetLang)) {
    report = customReport;
  } else {
    report = getLocalizedReport(data, targetLang) || (targetLang === 'en' ? (data?.report || data?.final_report || '') : '');
  }

  const cleanSummary = stripMarkdownForSpeech(summary);
  const cleanReport = stripMarkdownForSpeech(report);

  if (cleanSummary && cleanReport) {
    // If the clean report already contains the summary, avoid repeating it
    if (cleanReport.toLowerCase().startsWith(cleanSummary.toLowerCase())) {
      return cleanReport;
    }
    return `${cleanSummary}. ${cleanReport}`;
  }

  if (cleanSummary) {
    return cleanSummary;
  }

  if (cleanReport) {
    return cleanReport;
  }

  return '';
}

/**
 * Searches available browser voices for the requested language code.
 * Ensures the selected voice is compatible with the selected language.
 * When no matching voice is available for a non-English language, returns null
 * so utterance.voice is not forced to an English voice, allowing the browser's
 * default compatible voice to handle utterance.lang.
 */
export function findBestVoice(language = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const bcp47 = INDIC_BCP47_MAP[language] || language;
  const langPrefix = language.toLowerCase();

  // 1. Exact BCP-47 match (e.g. "te-IN", "hi-IN", "ta-IN", "en-IN")
  const exactMatch = voices.find(v => {
    const vLang = (v.lang || '').replace('_', '-').toLowerCase();
    return vLang === bcp47.toLowerCase();
  });
  if (exactMatch) return exactMatch;

  // 2. Starts with language code prefix (e.g. "te", "te-", "hi", "hi-")
  const prefixMatch = voices.find(v => {
    const vLang = (v.lang || '').replace('_', '-').toLowerCase();
    return vLang === langPrefix || vLang.startsWith(`${langPrefix}-`);
  });
  if (prefixMatch) return prefixMatch;

  // 3. For English specifically, match any English voice
  if (langPrefix === 'en') {
    const enVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
    if (enVoice) return enVoice;
  }

  // Strictly avoid falling back to English for non-English languages
  return null;
}

/**
 * Checks whether a native client voice exists for a specific language code.
 */
export function hasNativeVoice(language = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const voices = window.speechSynthesis.getVoices() || [];
  const bcp47 = INDIC_BCP47_MAP[language] || language;
  const langPrefix = language.toLowerCase();
  return voices.some(v => v.lang === bcp47 || v.lang.toLowerCase().startsWith(langPrefix));
}

/**
 * Checks if browser supports speech synthesis.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}
