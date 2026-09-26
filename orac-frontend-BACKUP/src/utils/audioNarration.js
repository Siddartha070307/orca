/**
 * ORCA Audio Narration Utility
 * Provides text-to-speech synthesis and script formulation for ORCA Marine Intelligence advisories
 * across all 12 supported Indian coastal languages.
 */

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
    // Remove markdown table divider rows |---|---|
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
 * Formulates the audio narration script directly from translated report and summary.
 */
export function generateAudioScript(data, language = 'en') {
  if (!data) return '';

  const summary = data.safety_summary || data.final_summary || '';
  const report = data.report || data.final_report || '';

  const cleanSummary = stripMarkdownForSpeech(summary);
  const cleanReport = stripMarkdownForSpeech(report);

  if (cleanSummary && cleanReport) {
    // If the clean report already starts with the summary, avoid redundancy
    if (cleanReport.startsWith(cleanSummary)) {
      return cleanReport.slice(0, 500);
    }
    return `${cleanSummary}. ${cleanReport.slice(0, 350)}`;
  }

  if (cleanSummary) {
    return cleanSummary;
  }

  if (cleanReport) {
    return cleanReport.slice(0, 500);
  }

  return '';
}

/**
 * Searches available browser voices for the requested language code.
 */
export function findBestVoice(language = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const bcp47 = INDIC_BCP47_MAP[language] || language;
  const langPrefix = language.toLowerCase();

  // 1. Exact BCP-47 match (e.g. "te-IN", "hi-IN")
  const exactMatch = voices.find(v => v.lang === bcp47);
  if (exactMatch) return exactMatch;

  // 2. Starts with language code prefix (e.g. "te", "hi")
  const prefixMatch = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (prefixMatch) return prefixMatch;

  // 3. Fallback to English (en-IN or general en)
  const enInVoice = voices.find(v => v.lang === 'en-IN' || v.lang.startsWith('en-IN'));
  if (enInVoice) return enInVoice;

  const anyEn = voices.find(v => v.lang.startsWith('en'));
  if (anyEn) return anyEn;

  return voices[0] || null;
}

/**
 * Checks if browser supports speech synthesis.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

