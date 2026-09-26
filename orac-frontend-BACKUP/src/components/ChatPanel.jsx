import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import {
  Send,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Compass,
  Navigation,
  CheckCircle2,
  XCircle,
  MapPin,
  LocateFixed,
  HelpCircle,
  Mic,
  MicOff
} from 'lucide-react';
import { INDIC_BCP47_MAP } from '../utils/audioNarration';
import { useTranslation } from '../i18n/useTranslation';

export default function ChatPanel({
  messages,
  onSendMessage,
  loading,
  error,
  sessionId,
  onResetSession,
  userLocation,
  gpsStatus,
  onRequestGps,
  onClearGps,
  selectedLanguage = 'en'
}) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const SUGGESTED_QUERIES = [
    {
      text: t('chat.coastalSafety', 'Is it safe to fish near Mangalore tomorrow morning?'),
      category: t('chat.coastalSafetyCategory', 'Coastal Safety')
    },
    {
      text: t('chat.multiTurn', 'What about tomorrow evening?'),
      category: t('chat.multiTurnCategory', 'Multi-Turn')
    },
    {
      text: t('chat.departureCheck', 'Can I sail from Kochi today?'),
      category: t('chat.departureCheckCategory', 'Departure Check')
    },
    {
      text: t('chat.deepSeaPfz', 'Current conditions 40km offshore Goa'),
      category: t('chat.deepSeaPfzCategory', 'Deep-Sea PFZ')
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (queryText) => {
    if (loading) return;
    onSendMessage(queryText);
  };

  // Speech-to-text (Voice Input) Handler
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('chat.micUnsupported', 'Voice input is not supported in this browser for this language. Please type your query.'));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const bcp47 = INDIC_BCP47_MAP[selectedLanguage] || 'en-IN';
      recognition.lang = bcp47;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition event error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start error:', err);
      setIsListening(false);
    }
  };

  // Helper to render GPS control button label and icon
  const renderGpsControl = () => {
    const isRequesting = gpsStatus === 'requesting';
    const isSuccess = gpsStatus === 'success' && userLocation;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={onRequestGps}
          disabled={isRequesting || loading}
          title={
            isSuccess
              ? `GPS Acquired: ${userLocation.lat.toFixed(3)}°N, ${userLocation.lon.toFixed(3)}°E`
              : t('chat.useMyLocation', 'Use My Location')
          }
          aria-label="Acquire my browser location"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: isRequesting ? 'wait' : 'pointer',
            background: isSuccess
              ? 'rgba(6, 182, 212, 0.16)'
              : gpsStatus === 'denied' || gpsStatus === 'error'
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(56, 189, 248, 0.08)',
            border: `1px solid ${
              isSuccess
                ? 'rgba(6, 182, 212, 0.45)'
                : gpsStatus === 'denied' || gpsStatus === 'error'
                ? 'rgba(239, 68, 68, 0.35)'
                : 'rgba(56, 189, 248, 0.2)'
            }`,
            color: isSuccess
              ? '#38bdf8'
              : gpsStatus === 'denied' || gpsStatus === 'error'
              ? '#fca5a5'
              : '#cbd5e1',
            transition: 'all 0.2s ease'
          }}
        >
          <LocateFixed size={12} className={isRequesting ? 'pulse-icon' : ''} />
          <span>
            {isRequesting
              ? t('chat.acquiringGps', 'Acquiring GPS...')
              : isSuccess
              ? t('chat.gpsActive', 'GPS Active')
              : gpsStatus === 'denied'
              ? t('chat.gpsDenied', 'GPS Denied')
              : gpsStatus === 'unavailable'
              ? t('chat.gpsUnavailable', 'GPS Unavailable')
              : t('chat.useMyLocation', 'Use My Location')}
          </span>
        </button>

        {isSuccess && (
          <button
            type="button"
            onClick={onClearGps}
            title="Clear stored GPS coordinate"
            aria-label="Clear active GPS"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            <XCircle size={13} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chat-pane" role="region" aria-label="Marine Advisory Chat">
      {/* Chat Header Bar */}
      <div
        style={{
          height: '48px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'rgba(15, 28, 48, 0.95)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={16} color="#38bdf8" />
          <span style={{ fontWeight: 700, color: '#f8fafc' }}>
            {t('chat.title', 'Conversational Intelligence')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* User GPS Action Button */}
          {renderGpsControl()}

          {/* New Session Button */}
          <button
            onClick={onResetSession}
            title="Reset conversation and start a clean session context"
            aria-label="Start new session"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#94a3b8',
              padding: '4px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RotateCcw size={12} />
            <span>{t('chat.newSession', 'New Session')}</span>
          </button>
        </div>
      </div>

      {/* GPS Status Banner if Denied or Error */}
      {(gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'error') && (
        <div
          style={{
            padding: '6px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
            fontSize: '0.72rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>
            {gpsStatus === 'denied'
              ? t('chat.gpsPermissionDeniedMsg', 'Location permission was denied in your browser. Natural language port extraction will be used instead.')
              : t('chat.gpsUnavailableMsg', 'Location is unavailable on this device. You can still type any port or coastal coordinates.')}
          </span>
          <button
            onClick={onClearGps}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.7rem' }}
          >
            {t('chat.dismiss', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Message Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '24px 16px',
              color: '#94a3b8'
            }}
          >
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(6, 182, 212, 0.25))',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#38bdf8',
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)'
              }}
            >
              <Compass size={30} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginBottom: '8px', letterSpacing: '0.02em' }}>
              {t('chat.assistantTitle', 'ORCA Marine Intelligence Assistant')}
            </h3>
            <p style={{ fontSize: '0.82rem', maxWidth: '380px', lineHeight: '1.55', color: '#94a3b8', marginBottom: '22px' }}>
              {t('chat.assistantDescription', 'Submit queries regarding sea state safety, wind & wave forecasts, INCOIS Potential Fishing Zones (PFZ), and maritime boundary clearance.')}
            </p>

            <div style={{ width: '100%', maxWidth: '400px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.06em', textAlign: 'left' }}>
                {t('chat.recommendedInquiries', 'Recommended Operational Inquiries')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {SUGGESTED_QUERIES.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSuggestionClick(q.text)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 28, 48, 0.85)',
                      border: '1px solid rgba(56, 189, 248, 0.16)',
                      color: '#cbd5e1',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)';
                      e.currentTarget.style.color = '#38bdf8';
                      e.currentTarget.style.background = 'rgba(15, 28, 48, 0.98)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.16)';
                      e.currentTarget.style.color = '#cbd5e1';
                      e.currentTarget.style.background = 'rgba(15, 28, 48, 0.85)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.66rem', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
                        {q.category}
                      </span>
                      <span>{q.text}</span>
                    </div>
                    <Sparkles size={13} color="#06b6d4" style={{ flexShrink: 0, marginLeft: '8px' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              selectedLanguage={selectedLanguage}
            />
          ))
        )}

        {/* Loading / Multi-Agent Reasoning Banner */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '14px 18px',
              background: 'rgba(15, 28, 48, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2.5px solid rgba(56, 189, 248, 0.2)',
                borderTopColor: '#38bdf8',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0
              }}
            />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                {t('chat.executingPipeline', 'Executing 9-Agent Marine Decision Pipeline...')}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                {t('chat.executingSub', 'Open-Meteo telemetry • INCOIS PFZ bulletins • Geofencing • Deterministic safety hierarchy')}
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              background: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px'
            }}
          >
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <strong>{t('chat.communicationError', 'Communication Error:')}</strong> {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Follow-up Bar (if active conversation) */}
      {messages.length > 0 && (
        <div
          style={{
            padding: '6px 12px 6px',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            background: 'rgba(10, 19, 34, 0.8)',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          {SUGGESTED_QUERIES.slice(1, 3).map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestionClick(q.text)}
              disabled={loading}
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.72rem',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.18)',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              + {q.text}
            </button>
          ))}
        </div>
      )}

      {/* Active Voice Listening Banner */}
      {isListening && (
        <div
          style={{
            padding: '6px 14px',
            background: 'rgba(239, 68, 68, 0.15)',
            borderTop: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'pulse 1.5s infinite ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 8px #ef4444'
              }}
            />
            <span>{t('chat.micListening', 'Listening... Speak now')} ({selectedLanguage.toUpperCase()})</span>
          </div>
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: '0.72rem',
              textDecoration: 'underline'
            }}
          >
            {t('chat.micStop', 'Stop recording')}
          </button>
        </div>
      )}

      {/* Query Input Area */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px 14px',
          background: 'rgba(15, 28, 48, 0.98)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end'
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              userLocation
                ? t('chat.inputPlaceholderGps', 'Ask ORCA near current GPS ({lat}°N, {lon}°E)...', {
                    lat: userLocation.lat.toFixed(2),
                    lon: userLocation.lon.toFixed(2)
                  })
                : t('chat.inputPlaceholder', 'Ask in natural language (e.g. Can I fish near Mangalore tomorrow morning?)...')
            }
            rows={2}
            disabled={loading}
            aria-label="Natural language marine query input"
            style={{
              width: '100%',
              background: 'rgba(10, 19, 34, 0.85)',
              border: `1px solid ${isListening ? '#ef4444' : 'rgba(56, 189, 248, 0.24)'}`,
              borderRadius: '10px',
              padding: '9px 12px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              lineHeight: '1.45',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#38bdf8';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = isListening ? '#ef4444' : 'rgba(56, 189, 248, 0.24)';
            }}
          />
        </div>

        {/* Speech-to-Text Microphone Button */}
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          disabled={loading}
          aria-label={isListening ? t('chat.micStop', 'Stop recording') : t('chat.micStart', 'Click to speak in your language')}
          title={isListening ? t('chat.micStop', 'Stop recording') : t('chat.micStart', 'Click to speak in your language')}
          style={{
            height: '44px',
            width: '44px',
            borderRadius: '10px',
            border: isListening ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.3)',
            background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.1)',
            color: isListening ? '#ef4444' : '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: isListening ? '0 0 14px rgba(239, 68, 68, 0.6)' : 'none',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          aria-label={t('chat.sendTitle', 'Send Query (Press Enter)')}
          style={{
            height: '44px',
            width: '44px',
            borderRadius: '10px',
            border: 'none',
            background:
              loading || !inputText.trim()
                ? 'rgba(56, 189, 248, 0.15)'
                : 'linear-gradient(135deg, #0284c7, #06b6d4)',
            color: loading || !inputText.trim() ? '#64748b' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || !inputText.trim() ? 'not-allowed' : 'pointer',
            boxShadow:
              loading || !inputText.trim() ? 'none' : '0 0 16px rgba(6, 182, 212, 0.45)',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title={t('chat.sendTitle', 'Send Query (Press Enter)')}
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

