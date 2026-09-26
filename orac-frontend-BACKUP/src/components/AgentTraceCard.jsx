import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  CloudSun,
  Compass,
  MapPin,
  Bot,
  Layers,
  Database,
  Send,
  AlertTriangle,
  Code
} from 'lucide-react';
import { escapeHtml } from '../utils/security';

const AGENT_ICONS = {
  UserInteractionAgent: Bot,
  PlanningAgent: Compass,
  MarineDataDiscoveryAgent: Database,
  WeatherIntelligenceAgent: CloudSun,
  OceanAnalyticsAgent: Layers,
  GeospatialReasoningAgent: MapPin,
  RiskAssessmentAgent: ShieldCheck,
  VisualizationAgent: Layers,
  ReportingAgent: Send
};

export default function AgentTraceCard({ trace }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);

  if (!trace) return null;

  const { agent, status, confidence, result, sources = [], warnings = [] } = trace;
  const Icon = AGENT_ICONS[agent] || Bot;
  const confidencePct = Math.round((confidence ?? 1.0) * 100);

  const getStatusBadge = () => {
    const isOk = status === 'success' || status === 'completed';
    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          padding: '2px 8px',
          borderRadius: '4px',
          background: isOk ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
          color: isOk ? '#4ade80' : '#fde047',
          border: `1px solid ${isOk ? 'rgba(34, 197, 94, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`
        }}
      >
        {status || 'OK'}
      </span>
    );
  };

  // Agent-specific highlight renderer
  const renderAgentHighlights = () => {
    if (!result) return null;

    if (agent === 'WeatherIntelligenceAgent' && result.metrics) {
      const m = result.metrics;
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginTop: '10px' }}>
          {m.wind_speed_kmh !== undefined && (
            <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Wind Speed</div>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.84rem' }}>{m.wind_speed_kmh} km/h</div>
            </div>
          )}
          {m.wave_height_m !== undefined && (
            <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Wave Height</div>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.84rem' }}>{m.wave_height_m} m</div>
            </div>
          )}
          {m.wind_gusts_kmh !== undefined && (
            <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Peak Gusts</div>
              <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.84rem' }}>{m.wind_gusts_kmh} km/h</div>
            </div>
          )}
        </div>
      );
    }

    if (agent === 'GeospatialReasoningAgent') {
      return (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem' }}>
          {result.nearest_zone_name && (
            <div style={{ color: '#cbd5e1' }}>
              <strong style={{ color: '#38bdf8' }}>Nearest Restricted Zone:</strong> {result.nearest_zone_name}
            </div>
          )}
          {result.min_distance_to_boundary_km !== undefined && (
            <div style={{ color: '#cbd5e1' }}>
              <strong style={{ color: '#38bdf8' }}>Distance to Boundary:</strong> {result.min_distance_to_boundary_km} km
              {result.safe_buffer_km && ` (Safe Buffer: ${result.safe_buffer_km} km)`}
            </div>
          )}
        </div>
      );
    }

    if (agent === 'OceanAnalyticsAgent' && result.recommended_pfz) {
      const pfz = result.recommended_pfz;
      return (
        <div style={{ marginTop: '8px', fontSize: '0.76rem', background: 'rgba(5, 150, 105, 0.08)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(5, 150, 105, 0.25)' }}>
          <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '3px' }}>
            Recommended Fishing Zone: {pfz.id || 'Optimal Bulletin'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
            {pfz.distance_km !== undefined && `Distance: ${pfz.distance_km} km | `}
            {pfz.bearing_deg !== undefined && `Bearing: ${pfz.bearing_deg}° | `}
            {pfz.sst_celsius !== undefined && `SST: ${pfz.sst_celsius}°C | `}
            {pfz.chlorophyll_mg_m3 !== undefined && `Chl-a: ${pfz.chlorophyll_mg_m3} mg/m³`}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        background: 'rgba(15, 28, 48, 0.55)',
        border: '1px solid rgba(56, 189, 248, 0.14)',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          background: expanded ? 'rgba(56, 189, 248, 0.06)' : 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}
          >
            <Icon size={15} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
            {agent}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Confidence Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`Agent Confidence Rating: ${confidencePct}%`}>
            <div
              style={{
                width: '40px',
                height: '5px',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${confidencePct}%`,
                  height: '100%',
                  background: confidencePct > 80 ? '#22c55e' : confidencePct > 50 ? '#eab308' : '#ef4444'
                }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
              {confidencePct}%
            </span>
          </div>

          {getStatusBadge()}

          {warnings.length > 0 && (
            <span title={`${warnings.length} warning(s)`} style={{ color: '#f59e0b', display: 'flex' }}>
              <AlertTriangle size={14} />
            </span>
          )}

          {expanded ? <ChevronDown size={15} color="#94a3b8" /> : <ChevronRight size={15} color="#94a3b8" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(56, 189, 248, 0.08)', fontSize: '0.78rem' }}>
          {/* Render highlights */}
          {renderAgentHighlights()}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ marginTop: '10px', background: 'rgba(245, 158, 11, 0.1)', padding: '8px 10px', borderRadius: '5px', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d' }}>
              {warnings.map((w, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sources Provenance */}
          {sources.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
                Data Provenance / Sources
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {sources.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      color: '#cbd5e1',
                      fontFamily: 'JetBrains Mono, monospace',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON toggle */}
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowJson(!showJson);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600
              }}
            >
              <Code size={12} />
              <span>{showJson ? 'Hide Raw JSON' : 'Inspect Raw Trace JSON'}</span>
            </button>
          </div>

          {showJson && (
            <pre
              style={{
                marginTop: '8px',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '0.7rem',
                overflowX: 'auto',
                color: '#a5f3fc',
                fontFamily: 'JetBrains Mono, monospace',
                maxHeight: '200px'
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
