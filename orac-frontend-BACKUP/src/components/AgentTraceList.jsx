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
        background: 'rgba(15, 28, 48, 0.6)',
        border: '1px solid rgba(56, 189, 248, 0.16)',
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
          background: isOpen ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
          border: 'none',
          color: '#cbd5e1',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          outline: 'none',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={15} color="#38bdf8" />
          <span style={{ color: '#f8fafc' }}>Collaborative Agent Pipeline ({traces.length} Traces)</span>
          <span
            style={{
              fontSize: '0.68rem',
              color: '#34d399',
              background: 'rgba(34, 197, 94, 0.14)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: '2px 7px',
              borderRadius: '9999px',
              fontWeight: 700
            }}
          >
            {avgConfidence}% Avg Confidence
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
          <span style={{ fontSize: '0.72rem' }}>{isOpen ? 'Collapse Pipeline' : 'Inspect Pipeline'}</span>
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(56, 189, 248, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Visual 6-Stage Pipeline Lifecycle Stepper */}
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(10, 19, 34, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.14)',
              borderRadius: '8px',
              marginBottom: '4px'
            }}
          >
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
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
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.08)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(56, 189, 248, 0.2)'
                    }}
                  >
                    <CheckCircle2 size={11} color="#22c55e" />
                    <span>{stage.label}</span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight size={11} color="#64748b" style={{ flexShrink: 0 }} />
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
