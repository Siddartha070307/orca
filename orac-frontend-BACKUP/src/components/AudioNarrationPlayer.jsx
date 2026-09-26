import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Sparkles,
  RotateCcw,
  Languages,
  Radio
} from 'lucide-react';
import {
  generateAudioScript,
  findBestVoice,
  isSpeechSupported,
  GTTS_SUPPORTED_LANGUAGES,
  INDIC_BCP47_MAP
} from '../utils/audioNarration';
import { getTtsAudioUrl } from '../api/orcaClient';
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

export default function AudioNarrationPlayer({ data, selectedLanguage = 'en' }) {
  const { t } = useTranslation();
  const [audioLang, setAudioLang] = useState(selectedLanguage || 'en');
  const [playbackState, setPlaybackState] = useState('idle'); // 'idle' | 'playing' | 'paused'
  const [voiceNotice, setVoiceNotice] = useState(null);

  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const supported = isSpeechSupported() || typeof Audio !== 'undefined';

  // Sync with parent language selector
  useEffect(() => {
    if (selectedLanguage && selectedLanguage !== audioLang) {
      setAudioLang(selectedLanguage);
      handleStop();
    }
  }, [selectedLanguage]);

  // Clean up audio on unmount or data changes
  useEffect(() => {
    return () => {
      handleStop();
    };
  }, [data]);

  // Notice for Odia / Assamese or missing voices
  useEffect(() => {
    if (!GTTS_SUPPORTED_LANGUAGES.includes(audioLang)) {
      setVoiceNotice(t('message.fallbackNotice', 'High-quality voice unavailable for this language — using system voice.'));
    } else {
      setVoiceNotice(null);
    }
  }, [audioLang, t]);

  if (!supported) {
    return null;
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaybackState('idle');
  };

  const speakWithBrowser = (script, targetLang) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPlaybackState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utteranceRef.current = utterance;

    const bcp47 = INDIC_BCP47_MAP[targetLang] || 'en-IN';
    utterance.lang = bcp47;
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    const voice = findBestVoice(targetLang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setPlaybackState('playing');
    utterance.onend = () => setPlaybackState('idle');
    utterance.onerror = (e) => {
      console.warn('Browser speech synthesis error:', e);
      setPlaybackState('idle');
    };

    window.speechSynthesis.speak(utterance);
    setPlaybackState('playing');
  };

  const startSpeaking = (targetLang) => {
    handleStop();

    const script = generateAudioScript(data, targetLang);
    if (!script) return;

    // Check if gTTS is supported for this language
    if (GTTS_SUPPORTED_LANGUAGES.includes(targetLang)) {
      try {
        const url = getTtsAudioUrl(script, targetLang);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => setPlaybackState('playing');
        audio.onpause = () => {
          if (playbackState === 'playing') setPlaybackState('paused');
        };
        audio.onended = () => setPlaybackState('idle');
        audio.onerror = (e) => {
          console.warn('Backend TTS stream failed, falling back to browser synthesis:', e);
          speakWithBrowser(script, targetLang);
        };

        audio.play().catch((e) => {
          console.warn('Audio play rejected, falling back to browser synthesis:', e);
          speakWithBrowser(script, targetLang);
        });
        setPlaybackState('playing');
      } catch (err) {
        console.warn('Audio construction error:', err);
        speakWithBrowser(script, targetLang);
      }
    } else {
      // Fallback directly to browser SpeechSynthesis for Odia ('or') and Assamese ('as')
      speakWithBrowser(script, targetLang);
    }
  };

  const handleTogglePlay = () => {
    if (playbackState === 'playing') {
      if (audioRef.current) {
        audioRef.current.pause();
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      setPlaybackState('playing');
    } else {
      startSpeaking(audioLang);
    }
  };

  const handleSelectLanguage = (newLang) => {
    if (newLang === audioLang) return;
    setAudioLang(newLang);
    if (playbackState === 'playing' || playbackState === 'paused') {
      startSpeaking(newLang);
    }
  };

  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isActive = isPlaying || isPaused;

  // Available language pills: Selected Language + English (if not English)
  const availableLangs = audioLang === 'en' ? ['en'] : [audioLang, 'en'];

  return (
    <div
      className="audio-narration-bar"
      role="region"
      aria-label="Audio narration player for advisory report"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(7, 24, 48, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        borderRadius: '10px',
        padding: '8px 12px',
        marginBottom: '12px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
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
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'linear-gradient(135deg, #0284c7, #06b6d4)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.78rem',
              boxShadow: isPlaying
                ? '0 0 10px rgba(245, 158, 11, 0.4)'
                : '0 0 10px rgba(6, 182, 212, 0.35)',
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
                background: 'rgba(239, 68, 68, 0.18)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.74rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Square size={12} fill="#f87171" />
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
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '2px 4px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.15)'
          }}
        >
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Radio size={11} color="#38bdf8" /> {t('message.audioLang', 'Audio Lang:')}
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
                border: audioLang === langCode ? '1px solid #0284c7' : '1px solid transparent',
                background: audioLang === langCode ? 'rgba(2, 132, 199, 0.35)' : 'transparent',
                color: audioLang === langCode ? '#38bdf8' : '#64748b',
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
            color: '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingTop: '2px'
          }}
        >
          <Sparkles size={12} color="#38bdf8" />
          <span>
            {isPlaying
              ? t('message.speakingNotice', 'Narrating advisory report...')
              : t('message.pausedNotice', 'Audio paused.')}
          </span>
        </div>
      )}

      {voiceNotice && (
        <div style={{ fontSize: '0.66rem', color: '#fbbf24', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>ℹ️</span> {voiceNotice}
        </div>
      )}
    </div>
  );
}

