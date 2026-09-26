import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  Sparkles,
  Radio
} from 'lucide-react';
import {
  generateAudioScript,
  findBestVoice,
  isSpeechSupported,
  INDIC_BCP47_MAP
} from '../utils/audioNarration';
import { useTranslation } from '../i18n/useTranslation';

const LANG_LABELS = {
  en: '🇬🇧 English',
  te: '🇮🇳 తెలుగు',
  hi: '🇮🇳 हिन्दी',
  kn: '🇮🇳 ಕನ್ನಡ',
  ta: '🇮🇳 தமிழ்',
  ml: '🇮🇳 മലയാളം',
  mr: '🇮🇳 मराठी',
  bn: '🇮🇳 বাংলা',
  gu: '🇮🇳 ગુજરાતી',
  or: '🇮🇳 ଓଡ଼ିଆ',
  pa: '🇮🇳 ਪੰਜਾਬੀ',
  as: '🇮🇳 অসমীয়া'
};

// Module-level singleton registry: ensures only ONE active narration player speaks at any time
let activePlayerInstance = null;

export function stopAllNarration() {
  if (activePlayerInstance && typeof activePlayerInstance.stop === 'function') {
    try {
      activePlayerInstance.stop();
    } catch {}
  }
  activePlayerInstance = null;
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {}
  }
}

export default function AudioNarrationPlayer({
  data,
  selectedLanguage = 'en',
  reportText = null,
  summaryText = null
}) {
  const { currentLanguage, t } = useTranslation();
  const effectiveLanguage = selectedLanguage || currentLanguage || 'en';
  const [audioLang, setAudioLang] = useState(effectiveLanguage);
  const [playbackState, setPlaybackState] = useState('idle'); // 'idle' | 'playing' | 'paused'
  const [voiceNotice, setVoiceNotice] = useState(null);

  // Reference for active utterance and generation token
  const utteranceRef = useRef(null);
  const generationRef = useRef(0);
  const instanceIdRef = useRef(Math.random().toString(36).substring(2, 9));

  const supported = isSpeechSupported();

  /**
   * Centralized idempotent cleanup routine
   * Resumes any paused speech engine, cancels utterance, clears handlers and references.
   */
  const cleanup = (resetState = true) => {
    generationRef.current += 1;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
      } catch {}
    }

    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current.onpause = null;
      utteranceRef.current.onresume = null;
      utteranceRef.current = null;
    }

    if (resetState) {
      setPlaybackState('idle');
    }

    if (activePlayerInstance && activePlayerInstance.id === instanceIdRef.current) {
      activePlayerInstance = null;
    }
  };

  const handleStop = () => {
    cleanup(true);
  };

  // Lifecycle cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup(true);
    };
  }, []);

  // Invalidate narration when report data or text changes
  useEffect(() => {
    cleanup(true);
  }, [data, reportText, summaryText]);

  // Sync with parent selectedLanguage or context language changes
  useEffect(() => {
    if (effectiveLanguage && effectiveLanguage !== audioLang) {
      setAudioLang(effectiveLanguage);
      cleanup(true);
    }
  }, [effectiveLanguage]);

  // Notice for Odia / Assamese if native voice is unavailable
  useEffect(() => {
    if (audioLang === 'or' || audioLang === 'as') {
      const voice = findBestVoice(audioLang);
      if (!voice) {
        setVoiceNotice(t('message.speechUnavailable', 'Voice output is not available for this language on this device.'));
      } else {
        setVoiceNotice(null);
      }
    } else {
      setVoiceNotice(null);
    }
  }, [audioLang, t]);

  if (!supported) {
    return null;
  }

  /**
   * Initiates speech synthesis immediately for the requested language.
   * Follows the exact required 8-step lifecycle:
   * 1. Cleanly cancel any previous utterance
   * 2. Obtain current displayed report text
   * 3. Create NEW SpeechSynthesisUtterance
   * 4. Set text
   * 5. Set lang to corresponding BCP-47 locale
   * 6. Register onstart/onend/onpause/onresume/onerror handlers
   * 7. Call speechSynthesis.speak(utterance) immediately
   * 8. Update audio state so controls change immediately
   */
  const startSpeaking = (targetLang) => {
    // 1. Stop / cancel any previous utterance cleanly across app and local instance
    stopAllNarration();
    cleanup(false);
    const gen = ++generationRef.current;

    activePlayerInstance = {
      stop: () => cleanup(true),
      id: instanceIdRef.current
    };

    const langToSpeak = targetLang || audioLang || effectiveLanguage || 'en';

    // 2. Obtain CURRENT displayed report text (strictly formulated in langToSpeak)
    const script = generateAudioScript(data, langToSpeak, reportText, summaryText);
    if (!script || !script.trim()) {
      setPlaybackState('idle');
      return;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setPlaybackState('idle');
      setVoiceNotice(t('message.speechUnsupported', 'Speech synthesis is not supported on this browser.'));
      return;
    }

    // Ensure speech synthesis is unblocked
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {}

    // 3. Create a NEW SpeechSynthesisUtterance
    const utterance = new SpeechSynthesisUtterance(script);
    utteranceRef.current = utterance;

    // 4. Set text
    utterance.text = script;

    // 5. Set lang to selected language BCP-47 locale
    const bcp47 = INDIC_BCP47_MAP[langToSpeak] || 'en-IN';
    utterance.lang = bcp47;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Select compatible voice if available; otherwise allow browser default voice for locale
    const voice = findBestVoice(langToSpeak);
    if (voice) {
      utterance.voice = voice;
    }

    // 6. Register lifecycle event handlers
    utterance.onstart = () => {
      if (generationRef.current === gen) {
        setPlaybackState('playing');
      }
    };

    utterance.onpause = () => {
      if (generationRef.current === gen) {
        setPlaybackState('paused');
      }
    };

    utterance.onresume = () => {
      if (generationRef.current === gen) {
        setPlaybackState('playing');
      }
    };

    utterance.onend = () => {
      if (generationRef.current === gen) {
        utteranceRef.current = null;
        setPlaybackState('idle');
        if (activePlayerInstance && activePlayerInstance.id === instanceIdRef.current) {
          activePlayerInstance = null;
        }
      }
    };

    utterance.onerror = (e) => {
      if (generationRef.current !== gen) return;
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.warn('SpeechSynthesis utterance error:', e);
      utteranceRef.current = null;
      setPlaybackState('idle');
      if (activePlayerInstance && activePlayerInstance.id === instanceIdRef.current) {
        activePlayerInstance = null;
      }
    };

    // 7. Call speechSynthesis.speak(utterance) immediately
    try {
      window.speechSynthesis.speak(utterance);
      // 8. Update ORCA audio state so controls change immediately to Pause/Stop
      setPlaybackState('playing');
    } catch (err) {
      console.warn('SpeechSynthesis speak invocation failed:', err);
      utteranceRef.current = null;
      setPlaybackState('idle');
    }
  };

  /**
   * Pause / Resume / Start toggle handler
   */
  const handleTogglePlay = () => {
    if (playbackState === 'playing') {
      // Clean pause
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.pause();
        } catch {}
      }
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      // Clean resume
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
      setPlaybackState('playing');
    } else {
      // Start narration
      startSpeaking(audioLang || effectiveLanguage);
    }
  };

  /**
   * Audio language pill toggle: switches language with clean invalidation
   */
  const handleSelectLanguage = (newLang) => {
    if (newLang === audioLang) return;
    const wasPlaying = playbackState === 'playing';
    cleanup(true);
    setAudioLang(newLang);
    if (wasPlaying) {
      startSpeaking(newLang);
    }
  };

  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isActive = isPlaying || isPaused;

  // Available language pills: Selected Language + English (if not English)
  const availableLangs = effectiveLanguage === 'en' ? ['en'] : [effectiveLanguage, 'en'];

  return (
    <div
      className="audio-narration-bar"
      role="region"
      aria-label="Audio narration player for advisory report"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'var(--bg-card-hover)',
        border: '1px solid var(--border-medium)',
        borderRadius: '10px',
        padding: '8px 12px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(22, 35, 46, 0.06)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        {/* Left Side: Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleTogglePlay}
            className="audio-play-btn"
            title={isPlaying ? t('message.pauseAudio', 'Pause') : isPaused ? t('message.resumeAudio', 'Resume') : t('message.listenReport', 'Listen to Report')}
            aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: isPlaying
                ? 'var(--verdict-caution)'
                : 'var(--marine-cyan)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.78rem',
              boxShadow: isPlaying
                ? '0 2px 8px rgba(180, 83, 9, 0.25)'
                : '0 2px 8px rgba(31, 122, 108, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {isPlaying ? (
              <>
                <Pause size={14} />
                <span>{t('message.pauseAudio', 'Pause')}</span>
              </>
            ) : isPaused ? (
              <>
                <Play size={14} />
                <span>{t('message.resumeAudio', 'Resume')}</span>
              </>
            ) : (
              <>
                <Volume2 size={15} />
                <span>{t('message.listenReport', 'Listen to Report')}</span>
              </>
            )}
          </button>

          {isActive && (
            <button
              type="button"
              onClick={handleStop}
              className="audio-stop-btn"
              title="Stop audio playback"
              aria-label="Stop audio"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: 'var(--verdict-unsafe-bg)',
                color: 'var(--verdict-unsafe)',
                border: '1px solid var(--verdict-unsafe-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.74rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Square size={12} fill="var(--verdict-unsafe)" />
              <span>{t('message.stopAudio', 'Stop')}</span>
            </button>
          )}

          {/* Active Audio Waveform Animation */}
          {isPlaying && (
            <div
              className="audio-wave-bars"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '3px',
                height: '16px',
                marginLeft: '4px'
              }}
            >
              <span className="bar bar-1" />
              <span className="bar bar-2" />
              <span className="bar bar-3" />
              <span className="bar bar-4" />
            </div>
          )}
        </div>

        {/* Right Side: Language Toggle Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--bg-surface)',
            padding: '2px 4px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Radio size={11} color="var(--marine-cyan)" /> {t('message.audioLang', 'Audio Lang:')}
          </span>

          {availableLangs.map((langCode) => (
            <button
              key={langCode}
              type="button"
              onClick={() => handleSelectLanguage(langCode)}
              className={`audio-lang-pill ${audioLang === langCode ? 'active' : ''}`}
              aria-pressed={audioLang === langCode}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: audioLang === langCode ? '1px solid var(--marine-cyan)' : '1px solid transparent',
                background: audioLang === langCode ? 'var(--marine-foam)' : 'transparent',
                color: audioLang === langCode ? 'var(--marine-cyan)' : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: audioLang === langCode ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {LANG_LABELS[langCode] || langCode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Spoken Status or Voice Note */}
      {isActive && (
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--marine-blue)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingTop: '2px'
          }}
        >
          <Sparkles size={12} color="var(--marine-cyan)" />
          <span>
            {isPlaying
              ? t('message.speakingNotice', 'Narrating advisory report...')
              : t('message.pausedNotice', 'Audio paused.')}
          </span>
        </div>
      )}

      {voiceNotice && (
        <div style={{ fontSize: '0.66rem', color: 'var(--verdict-caution)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>ℹ️</span> {voiceNotice}
        </div>
      )}
    </div>
  );
}
