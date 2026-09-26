import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Bot,
  User,
  Minus,
  Maximize2,
  Minimize2,
  Layers,
  Thermometer,
  Wind,
  Waves
} from 'lucide-react';
import { sendQuery, QueryResponse, AgentTrace } from '../api/orcaClient';

export interface ChatWidgetProps {
  role: 'authority' | 'researcher';
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  data?: QueryResponse;
  error?: boolean;
}

// Generate unique session identifier per chat instance
function generateSessionId(role: string): string {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).substring(2, 14);
  return `orca_${role}_${token}`;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  role,
  title,
  defaultOpen = false,
  className = ''
}) => {
  // Session ID management
  const [sessionId, setSessionId] = useState<string>(() => generateSessionId(role));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Role-specific config
  const roleConfig = useMemo(() => {
    if (role === 'authority') {
      return {
        defaultTitle: 'ORCA Maritime Authority Assistant',
        subtitle: 'Enforcement Grid & Sector Security Telemetry',
        placeholder: 'Ask about any sector, vessel, or advisory...',
        welcome:
          'ORCA Authority Assistant active. You can query real-time sector surveillance, restricted defense perimeters, vessel alerts, and safety advisories across Indian waters.',
        suggestedQueries: [
          'What is the current status near Kakinada?',
          'Show active restricted zone conflicts',
          'What is the alert status at Karwar / INS Kadamba?',
          'List active high-risk sectors'
        ]
      };
    }
    return {
      defaultTitle: 'ORCA Oceanographic Research Assistant',
      subtitle: 'Bio-Physical Telemetry & Inversion Models',
      placeholder: 'Ask about ocean parameters, trends, or comparisons...',
      welcome:
        'ORCA Scientific Assistant active. You can query multi-sensor satellite parameters (SST, Chlorophyll-a), potential fishing zones, bio-thermal ocean fronts, and 72-hour forecast trends.',
      suggestedQueries: [
        'Compare SST and Chlorophyll in Mangalore vs Veraval',
        'Explain bio-thermal front detections today',
        'What are the wave and wind trends along the Konkan coast?',
        'Verify satellite telemetry sources for current PFZs'
      ]
    };
  }, [role]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome_msg',
          sender: 'assistant',
          text: roleConfig.welcome,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [roleConfig.welcome]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isExpanded]);

  // Focus input when opened
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || loading) return;

    setErrorMessage(null);
    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await sendQuery({
        text: textToSend,
        user_type: 'app',
        session_id: sessionId
      });

      // Synchronize session ID if updated by backend
      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
      }

      // Extract response text (check multiple fields returned by agent pipeline)
      const replyText =
        response.advisory ||
        response.response ||
        response.text ||
        'Query processed successfully by the 9-agent pipeline.';

      const assistantMessage: ChatMessage = {
        id: response.query_id || `asst_${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: response
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorText = err?.message || 'Failed to communicate with ORCA intelligence backend.';
      setErrorMessage(errorText);

      const errorMessageObj: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `Error: ${errorText}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true
      };
      setMessages((prev) => [...prev, errorMessageObj]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    const newId = generateSessionId(role);
    setSessionId(newId);
    setErrorMessage(null);
    setMessages([
      {
        id: `reset_${Date.now()}`,
        sender: 'assistant',
        text: `Session context refreshed. Ready for new ${role === 'authority' ? 'authority' : 'oceanographic'} queries.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Verdict presentation helper (Strict adherence to green/amber/red semantic colors)
  const renderVerdictBadge = (verdict?: string) => {
    if (!verdict) return null;
    const v = verdict.toUpperCase();
    if (v === 'UNSAFE') {
      return (
        <span
          style={{
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            borderColor: '#FCA5A5'
          }}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono tracking-wide"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>UNSAFE</span>
        </span>
      );
    }
    if (v === 'CAUTION') {
      return (
        <span
          style={{
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            borderColor: '#FDE68A'
          }}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono tracking-wide"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>CAUTION</span>
        </span>
      );
    }
    return (
      <span
        style={{
          backgroundColor: '#DCFCE7',
          color: '#15803D',
          borderColor: '#86EFAC'
        }}
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono tracking-wide"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>SAFE</span>
      </span>
    );
  };

  // Scoped Light-Blue "Water" theme constants
  const theme = {
    // Water gradient background
    panelBg: 'linear-gradient(145deg, #EAF6FB 0%, #DCEEF7 60%, #CDEBF6 100%)',
    headerBg: 'linear-gradient(90deg, #E2F2FA 0%, #D4EBF6 100%)',
    headerBorder: '#BCE2F1',
    // Text colors
    textPrimary: '#1A2E3A',
    textSecondary: '#4A6B7C',
    textMuted: '#688C9E',
    // Message bubbles
    assistantBubbleBg: '#FFFFFF',
    assistantBubbleBorder: '#A9D8EA',
    assistantBubbleShadow: '0 2px 8px rgba(18, 56, 74, 0.06)',
    userBubbleBg: '#8FCFE8',
    userBubbleText: '#12384A',
    userBubbleBorder: '#76BDD9',
    // Input chrome
    inputBg: '#FFFFFF',
    inputBorder: '#BFE0EE',
    inputFocusBorder: '#3BA3CB',
    buttonBg: '#2B8BB8',
    buttonHoverBg: '#207297',
    chipBg: '#FFFFFF',
    chipBorder: '#BDE0EF',
    chipHoverBg: '#E1F2FA',
    chipText: '#1C4A5E'
  };

  return (
    <div
      className={`chat-widget-root fixed z-50 transition-all duration-300 select-none ${className}`}
      style={{
        bottom: '20px',
        right: '20px'
      }}
    >
      {/* Minimized Docked Launcher Pill */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            background: 'linear-gradient(135deg, #EAF6FB 0%, #CDEBF6 100%)',
            borderColor: '#A9D8EA',
            color: '#1A2E3A',
            boxShadow: '0 8px 24px rgba(18, 56, 74, 0.18)'
          }}
          className="flex items-center space-x-2.5 px-4 py-3 rounded-2xl border cursor-pointer hover:scale-105 active:scale-95 transition-all text-xs font-semibold"
          aria-label="Open ORCA Intelligence Chat"
        >
          <div
            style={{ backgroundColor: '#2B8BB8' }}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-bold flex items-center gap-1.5 leading-tight">
              <span>{role === 'authority' ? 'Authority Query' : 'Scientific Query'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div style={{ color: theme.textMuted }} className="text-[10px] font-mono leading-tight">
              9-Agent Pipeline Ready
            </div>
          </div>
        </button>
      )}

      {/* Expanded Chat Window */}
      {isExpanded && (
        <div
          style={{
            background: theme.panelBg,
            borderColor: '#98D0E5',
            boxShadow: '0 16px 40px rgba(18, 56, 74, 0.22)',
            color: theme.textPrimary,
            width: isFullScreen ? 'calc(100vw - 40px)' : '420px',
            maxWidth: isFullScreen ? '900px' : 'calc(100vw - 32px)',
            height: isFullScreen ? 'calc(100vh - 80px)' : '580px',
            maxHeight: 'calc(100vh - 40px)'
          }}
          className="rounded-2xl border flex flex-col overflow-hidden shadow-2xl transition-all duration-200"
        >
          {/* Header */}
          <div
            style={{
              background: theme.headerBg,
              borderBottom: `1px solid ${theme.headerBorder}`
            }}
            className="px-4 py-3 flex items-center justify-between shrink-0"
          >
            <div className="flex items-center space-x-2.5">
              <div
                style={{ backgroundColor: theme.buttonBg }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm"
              >
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight" style={{ color: theme.textPrimary }}>
                  {title || roleConfig.defaultTitle}
                </h3>
                <p className="text-[10px] font-mono leading-tight" style={{ color: theme.textSecondary }}>
                  {roleConfig.subtitle}
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleResetSession}
                title="Reset session / clear conversation"
                style={{ color: theme.textSecondary }}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? 'Restore standard size' : 'Expand window'}
                style={{ color: theme.textSecondary }}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                {isFullScreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={() => setIsExpanded(false)}
                title="Minimize panel"
                style={{ color: theme.textSecondary }}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Session Banner */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
              borderBottom: `1px solid ${theme.headerBorder}`,
              color: theme.textMuted
            }}
            className="px-4 py-1.5 text-[10px] font-mono flex items-center justify-between shrink-0"
          >
            <span>Session: {sessionId.slice(0, 16)}...</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Multi-turn context preserved</span>
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs select-text">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const queryData = msg.data;
              const verdict = queryData?.verdict;
              const weatherMetrics = queryData?.weather_summary?.metrics;
              const agentTraces = queryData?.agent_traces;
              const isEvidenceOpen = openEvidenceId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Sender & Timestamp */}
                  <div
                    style={{ color: theme.textMuted }}
                    className="flex items-center space-x-1 text-[10px] font-mono px-1"
                  >
                    <span>{isUser ? 'You' : 'ORCA Intelligence'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      backgroundColor: isUser ? theme.userBubbleBg : theme.assistantBubbleBg,
                      color: isUser ? theme.userBubbleText : theme.textPrimary,
                      borderColor: isUser ? theme.userBubbleBorder : theme.assistantBubbleBorder,
                      boxShadow: isUser ? '0 1px 4px rgba(18, 56, 74, 0.1)' : theme.assistantBubbleShadow,
                      maxWidth: '88%'
                    }}
                    className="p-3 rounded-2xl border text-xs leading-relaxed break-words"
                  >
                    {/* Assistant Verdict Badge if present */}
                    {!isUser && verdict && (
                      <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1.5 border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: theme.textMuted }} className="text-[10px] font-mono font-semibold">
                            SAFETY VERDICT:
                          </span>
                          {renderVerdictBadge(verdict)}
                        </div>
                        {queryData?.location_name && (
                          <span style={{ color: theme.textSecondary }} className="text-[10px] font-mono">
                            {queryData.location_name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Text content with clean paragraph line breaks */}
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {/* Weather/Ocean Indicators if present in response */}
                    {!isUser && weatherMetrics && (
                      <div
                        style={{
                          backgroundColor: '#F3FAFD',
                          borderColor: '#C8E6F5'
                        }}
                        className="mt-2.5 p-2 rounded-xl border grid grid-cols-2 gap-2 text-[10px] font-mono"
                      >
                        {weatherMetrics.wave_height_m != null && (
                          <div className="flex items-center space-x-1.5" style={{ color: theme.textPrimary }}>
                            <Waves className="w-3.5 h-3.5 text-[#2B8BB8]" />
                            <span>Wave: {weatherMetrics.wave_height_m}m</span>
                          </div>
                        )}
                        {weatherMetrics.wind_speed_kmh != null && (
                          <div className="flex items-center space-x-1.5" style={{ color: theme.textPrimary }}>
                            <Wind className="w-3.5 h-3.5 text-[#2B8BB8]" />
                            <span>Wind: {weatherMetrics.wind_speed_kmh} km/h</span>
                          </div>
                        )}
                        {weatherMetrics.sst_c != null && (
                          <div className="flex items-center space-x-1.5" style={{ color: theme.textPrimary }}>
                            <Thermometer className="w-3.5 h-3.5 text-[#2B8BB8]" />
                            <span>SST: {weatherMetrics.sst_c}°C</span>
                          </div>
                        )}
                        {weatherMetrics.condition && (
                          <div className="flex items-center space-x-1.5 col-span-2" style={{ color: theme.textSecondary }}>
                            <span>Condition: {weatherMetrics.condition}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Evidence / Agent Traces */}
                    {!isUser && agentTraces && agentTraces.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setOpenEvidenceId(isEvidenceOpen ? null : msg.id)}
                          style={{ color: theme.textSecondary }}
                          className="flex items-center space-x-1 text-[10px] font-mono hover:underline cursor-pointer"
                        >
                          <Layers className="w-3 h-3 text-[#2B8BB8]" />
                          <span>
                            {agentTraces.length} Agent Pipeline Traces &amp; Evidence
                          </span>
                          {isEvidenceOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {isEvidenceOpen && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {agentTraces.map((trace: AgentTrace, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  backgroundColor: '#F3FAFD',
                                  borderColor: '#D4EBF6'
                                }}
                                className="p-2 rounded-lg border text-[10px] font-mono flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between font-bold" style={{ color: theme.textPrimary }}>
                                  <span>{trace.agent || trace.agent_name || `Agent ${idx + 1}`}</span>
                                  {trace.confidence != null && (
                                    <span className="text-emerald-700">
                                      {Math.round(trace.confidence * 100)}% Conf
                                    </span>
                                  )}
                                </div>
                                {trace.details && (
                                  <p style={{ color: theme.textSecondary }} className="text-[10px] leading-tight">
                                    {trace.details}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex flex-col items-start space-y-1">
                <div style={{ color: theme.textMuted }} className="text-[10px] font-mono px-1">
                  ORCA 9-Agent Pipeline Evaluating...
                </div>
                <div
                  style={{
                    backgroundColor: theme.assistantBubbleBg,
                    borderColor: theme.assistantBubbleBorder,
                    boxShadow: theme.assistantBubbleShadow
                  }}
                  className="p-3 rounded-2xl border flex items-center space-x-2"
                >
                  <div className="w-2 h-2 rounded-full bg-[#2B8BB8] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#2B8BB8] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#2B8BB8] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span style={{ color: theme.textSecondary }} className="text-xs font-mono pl-1.5">
                    Synthesizing intelligence...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Prompt Suggestions (Only show when conversation has <= 2 messages) */}
          {messages.length <= 2 && !loading && (
            <div
              style={{
                borderTop: `1px solid ${theme.headerBorder}`,
                backgroundColor: 'rgba(255, 255, 255, 0.4)'
              }}
              className="px-3.5 py-2 shrink-0"
            >
              <div className="flex items-center space-x-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-[#2B8BB8]" />
                <span style={{ color: theme.textSecondary }} className="text-[10px] font-semibold uppercase tracking-wider font-mono">
                  Suggested Inquiries
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roleConfig.suggestedQueries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(q)}
                    style={{
                      backgroundColor: theme.chipBg,
                      borderColor: theme.chipBorder,
                      color: theme.chipText
                    }}
                    className="text-[10.5px] px-2.5 py-1 rounded-full border hover:bg-[#E1F2FA] transition-all cursor-pointer font-medium text-left line-clamp-1"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Box Bar */}
          <div
            style={{
              background: theme.headerBg,
              borderTop: `1px solid ${theme.headerBorder}`
            }}
            className="p-3 shrink-0"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={roleConfig.placeholder}
                disabled={loading}
                style={{
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.textPrimary
                }}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs border outline-none transition-all placeholder:text-[#7A98A8] focus:border-[#3BA3CB] focus:ring-2 focus:ring-[#C1E6F5]"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                style={{
                  backgroundColor: !inputText.trim() || loading ? '#9ECADF' : theme.buttonBg
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer hover:opacity-95 active:scale-95 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
