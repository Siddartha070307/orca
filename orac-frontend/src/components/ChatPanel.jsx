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
              ? 'var(--marine-foam)'
              : gpsStatus === 'denied' || gpsStatus === 'error'
              ? 'var(--verdict-unsafe-bg)'
              : 'var(--bg-card)',
            border: `1px solid ${
              isSuccess
                ? 'var(--border-medium)'
                : gpsStatus === 'denied' || gpsStatus === 'error'
                ? 'var(--verdict-unsafe-border)'
                : 'var(--border-subtle)'
            }`,
            color: isSuccess
              ? 'var(--marine-cyan)'
              : gpsStatus === 'denied' || gpsStatus === 'error'
              ? 'var(--verdict-unsafe)'
              : 'var(--text-secondary)',
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
              color: 'var(--text-muted)',
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
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={16} color="var(--marine-cyan)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
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
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
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
            background: 'var(--verdict-unsafe-bg)',
            borderBottom: '1px solid var(--verdict-unsafe-border)',
            fontSize: '0.72rem',
            color: 'var(--verdict-unsafe)',
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
            style={{ background: 'transparent', border: 'none', color: 'var(--verdict-unsafe)', cursor: 'pointer', fontSize: '0.7rem' }}
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
              color: 'var(--text-muted)'
            }}
          >
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '16px',
                background: 'var(--marine-foam)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'var(--marine-cyan)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Compass size={30} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {t('chat.assistantTitle', 'ORCA Marine Intelligence Assistant')}
            </h3>
            <p style={{ fontSize: '0.82rem', maxWidth: '380px', lineHeight: '1.55', color: 'var(--text-muted)', marginBottom: '22px' }}>
              {t('chat.assistantDescription', 'Submit queries regarding sea state safety, wind & wave forecasts, INCOIS Potential Fishing Zones (PFZ), and maritime boundary clearance.')}
            </p>

            <div style={{ width: '100%', maxWidth: '400px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textAlign: 'left' }}>
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--marine-cyan)';
                      e.currentTarget.style.color = 'var(--marine-blue)';
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--marine-blue)', fontWeight: 600 }}>
                        {q.category}
                      </span>
                      <span>{q.text}</span>
                    </div>
                    <Sparkles size={13} color="var(--marine-cyan)" style={{ flexShrink: 0, marginLeft: '8px' }} />
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
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2.5px solid var(--border-subtle)',
                borderTopColor: 'var(--marine-cyan)',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0
              }}
            />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--marine-cyan)' }}>
                {t('chat.executingPipeline', 'Executing 9-Agent Marine Decision Pipeline...')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
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
              background: 'var(--verdict-unsafe-bg)',
              border: '1px solid var(--verdict-unsafe-border)',
              borderRadius: '8px',
              color: 'var(--verdict-unsafe)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px'
            }}
          >
            <AlertCircle size={18} color="var(--verdict-unsafe)" style={{ flexShrink: 0 }} />
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
            background: 'var(--bg-card-hover)',
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
                background: 'var(--marine-foam)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--marine-blue)',
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
            background: 'var(--verdict-unsafe-bg)',
            borderTop: '1px solid var(--verdict-unsafe-border)',
            color: 'var(--verdict-unsafe)',
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
                backgroundColor: 'var(--verdict-unsafe)'
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
              color: 'var(--verdict-unsafe)',
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
          background: 'var(--bg-surface)',
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
              background: 'var(--bg-card)',
              border: `1px solid ${isListening ? 'var(--verdict-unsafe)' : 'var(--border-medium)'}`,
              borderRadius: '10px',
              padding: '9px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              lineHeight: '1.45',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--marine-cyan)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = isListening ? 'var(--verdict-unsafe)' : 'var(--border-medium)';
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
            border: isListening ? '1px solid var(--verdict-unsafe)' : '1px solid var(--border-medium)',
            background: isListening ? 'var(--verdict-unsafe-bg)' : 'var(--marine-foam)',
            color: isListening ? 'var(--verdict-unsafe)' : 'var(--marine-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-sm)',
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
                ? 'var(--bg-card-hover)'
                : 'var(--marine-cyan)',
            color: loading || !inputText.trim() ? 'var(--text-dim)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || !inputText.trim() ? 'not-allowed' : 'pointer',
            boxShadow:
              loading || !inputText.trim() ? 'none' : 'var(--shadow-sm)',
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

