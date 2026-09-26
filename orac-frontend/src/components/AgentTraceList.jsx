import React, { useState } from 'react';
import AgentTraceCard from './AgentTraceCard';
import { Cpu, ChevronDown, ChevronRight, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'query', label: '1. User Query' },
  { id: 'agents', label: '2. Multi-Agent Pipeline' },
  { id: 'evidence', label: '3. Evidence Synthesis' },
  { id: 'risk', label: '4. Deterministic Rules' },
  { id: 'verdict', label: '5. Safety Verdict' },
  { id: 'dispatch', label: '6. Dissemination' }
];

export default function AgentTraceList({ traces = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!traces || traces.length === 0) {
    return null;
  }

  const avgConfidence = Math.round(
    (traces.reduce((acc, t) => acc + (t.confidence ?? 1.0), 0) / traces.length) * 100
  );

  return (
    <div
      style={{
        marginTop: '10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: isOpen ? 'var(--marine-foam)' : 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          outline: 'none',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={15} color="var(--marine-cyan)" />
          <span style={{ color: 'var(--text-primary)' }}>Collaborative Agent Pipeline ({traces.length} Traces)</span>
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--verdict-safe)',
              background: 'var(--verdict-safe-bg)',
              border: '1px solid var(--verdict-safe-border)',
              padding: '2px 7px',
              borderRadius: '9999px',
              fontWeight: 700
            }}
          >
            {avgConfidence}% Avg Confidence
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '0.72rem' }}>{isOpen ? 'Collapse Pipeline' : 'Inspect Pipeline'}</span>
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Visual 6-Stage Pipeline Lifecycle Stepper */}
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              marginBottom: '4px'
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--marine-blue)', marginBottom: '8px' }}>
              Execution Lifecycle Progression
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '4px'
              }}
            >
              {PIPELINE_STAGES.map((stage, idx) => (
                <React.Fragment key={stage.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--marine-blue)',
                      background: 'var(--marine-foam)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <CheckCircle2 size={11} color="var(--verdict-safe)" />
                    <span>{stage.label}</span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight size={11} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Individual Agent Trace Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {traces.map((trace, idx) => (
              <AgentTraceCard key={trace.agent || idx} trace={trace} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
