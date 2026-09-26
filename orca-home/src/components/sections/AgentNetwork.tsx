import React, { useState } from 'react';
import { ORCA_COLLABORATIVE_AGENTS } from '../../data/agents';
import { OrcaAgent } from '../../types';
import {
  Cpu,
  Activity,
  ArrowRight,
  Database,
  Code2,
  Send,
  Radio,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export const AgentNetwork: React.FC = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('env_agent');

  const selectedAgent =
    ORCA_COLLABORATIVE_AGENTS.find(a => a.id === selectedAgentId) ||
    ORCA_COLLABORATIVE_AGENTS[0];

  // Calculate circular positions for 9 agents around a 320x320 SVG viewport
  const radius = 175;
  const centerX = 220;
  const centerY = 220;

  const agentPositions = ORCA_COLLABORATIVE_AGENTS.map((agent, index) => {
    // 9 agents spaced evenly: (index * 360 / 9) - 90 degrees so Agent 1 starts at top
    const angleDeg = (index * 360) / 9 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY + radius * Math.sin(angleRad);
    return { ...agent, x, y };
  });

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#8B6CFF]/10 text-[#8B6CFF] font-mono text-xs mb-3 border border-[#8B6CFF]/30">
          <Cpu className="w-3.5 h-3.5" />
          <span>AGENTIC AI ARCHITECTURE</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold text-white font-heading tracking-tight mb-4">
          NINE AGENTS. ONE MARINE INTELLIGENCE.
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          ORCA decomposes massive, fragmented satellite and hydrodynamic feeds into nine collaborative domain agents orchestrated through a Directed Acyclic Graph (DAG) for explainable marine decision support.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Interactive 9-Agent Circular Collaborative Network Graph */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[460px] aspect-square flex items-center justify-center select-none">
            <svg
              viewBox="0 0 440 440"
              className="w-full h-full overflow-visible"
            >
              <defs>
                <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#16C7C7" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#082A36" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#28D7E5" />
                  <stop offset="100%" stop-color="#8B6CFF" />
                </linearGradient>
              </defs>

              {/* Ambient Circular Guide Rings */}
              <circle
                cx={centerX}
                cy={centerY}
                r={radius}
                stroke="#16C7C7"
                strokeWidth="1"
                strokeDasharray="4 6"
                fill="none"
                opacity="0.25"
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={radius * 0.55}
                stroke="#8B6CFF"
                strokeWidth="0.75"
                strokeDasharray="2 4"
                fill="none"
                opacity="0.2"
              />

              {/* Dynamic Connection Lines between Center and Orbiting Agents */}
              {agentPositions.map(agent => {
                const isSelected = agent.id === selectedAgentId;
                const isCollaborator = selectedAgent.collaboratesWith.includes(agent.id);

                return (
                  <line
                    key={`line-${agent.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={agent.x}
                    y2={agent.y}
                    stroke={
                      isSelected
                        ? 'url(#activeLineGrad)'
                        : isCollaborator
                        ? '#16C7C7'
                        : 'rgba(255,255,255,0.08)'
                    }
                    strokeWidth={isSelected ? 2.5 : isCollaborator ? 1.5 : 0.75}
                    strokeDasharray={isSelected ? 'none' : '3 3'}
                    className={isSelected ? 'animate-pulse' : ''}
                    opacity={isSelected ? 1 : isCollaborator ? 0.8 : 0.3}
                  />
                );
              })}

              {/* Center Node: ORCA Collaborative Reasoning Engine */}
              <circle
                cx={centerX}
                cy={centerY}
                r="46"
                fill="#061F2C"
                stroke="#16C7C7"
                strokeWidth="2"
                className="shadow-2xl"
              />
              <circle
                cx={centerX}
                cy={centerY}
                r="38"
                fill="url(#centerGlow)"
              />
              <text
                x={centerX}
                y={centerY - 8}
                textAnchor="middle"
                fill="#28D7E5"
                fontSize="11"
                fontWeight="bold"
                fontFamily="Space Grotesk, sans-serif"
                letterSpacing="1"
              >
                ORCA
              </text>
              <text
                x={centerX}
                y={centerY + 6}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="7.5"
                fontFamily="JetBrains Mono, monospace"
              >
                COLLABORATIVE
              </text>
              <text
                x={centerX}
                y={centerY + 16}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="7.5"
                fontFamily="JetBrains Mono, monospace"
              >
                REASONING
              </text>

              {/* 9 Outer Agent Nodes */}
              {agentPositions.map(agent => {
                const isSelected = agent.id === selectedAgentId;
                const isCollaborator = selectedAgent.collaboratesWith.includes(agent.id);

                return (
                  <g
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing ring on active */}
                    {isSelected && (
                      <circle
                        cx={agent.x}
                        cy={agent.y}
                        r="24"
                        fill="none"
                        stroke="#28D7E5"
                        strokeWidth="1.5"
                        className="animate-ping"
                        opacity="0.4"
                      />
                    )}

                    {/* Agent Node Body */}
                    <circle
                      cx={agent.x}
                      cy={agent.y}
                      r="19"
                      fill={isSelected ? '#082A36' : isCollaborator ? '#061F2C' : '#03141F'}
                      stroke={
                        isSelected
                          ? '#28D7E5'
                          : isCollaborator
                          ? '#16C7C7'
                          : 'rgba(255,255,255,0.2)'
                      }
                      strokeWidth={isSelected ? '2.5' : '1.2'}
                      className="transition-all duration-200 group-hover:stroke-[#28D7E5]"
                    />

                    {/* Agent Number */}
                    <text
                      x={agent.x}
                      y={agent.y + 4}
                      textAnchor="middle"
                      fill={isSelected ? '#28D7E5' : '#E2E8F0'}
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="Space Grotesk, sans-serif"
                    >
                      A{agent.number}
                    </text>

                    {/* Agent Label */}
                    <text
                      x={agent.x}
                      y={agent.y + (agent.y > centerY ? 32 : -26)}
                      textAnchor="middle"
                      fill={isSelected ? '#28D7E5' : '#94A3B8'}
                      fontSize="9"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      fontFamily="Inter, sans-serif"
                      className="pointer-events-none"
                    >
                      {agent.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs text-slate-400 font-mono">
              Click any agent to inspect collaborative parameters & data flow
            </span>
          </div>
        </div>

        {/* Right: Selected Agent In-Depth Inspector Card */}
        <div className="lg:col-span-6">
          <div className="p-6 sm:p-8 rounded-3xl ocean-glass border border-[#16C7C7]/30 shadow-2xl space-y-6 animate-in fade-in duration-300">
            {/* Header: Agent Number, Name, Domain */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#16C7C7]/20 text-[#28D7E5] border border-[#16C7C7]/40">
                    AGENT 0{selectedAgent.number}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedAgent.domain}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white font-heading">
                  {selectedAgent.name}
                </h3>
                <p className="text-xs text-[#16C7C7] font-medium mt-0.5">
                  {selectedAgent.shortRole}
                </p>
              </div>

              {/* Status Pill */}
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-[#36D399]/15 text-[#36D399] border border-[#36D399]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#36D399] animate-pulse" />
                  <span>{selectedAgent.status}</span>
                </span>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  {selectedAgent.telemetryMetric.label}:{' '}
                  <span className="text-white font-medium">
                    {selectedAgent.telemetryMetric.value}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {selectedAgent.fullRole}
            </p>

            {/* Inputs & Algorithms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Input Streams */}
              <div className="p-3.5 rounded-xl bg-[#061F2C]/60 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200 font-heading">
                  <Database className="w-3.5 h-3.5 text-[#16C7C7]" />
                  <span>Input Data Streams</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300 font-mono">
                  {selectedAgent.inputs.map((inp, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#16C7C7] mt-0.5">›</span>
                      <span className="leading-tight">{inp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Algorithmic Analysis */}
              <div className="p-3.5 rounded-xl bg-[#061F2C]/60 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200 font-heading">
                  <Code2 className="w-3.5 h-3.5 text-[#8B6CFF]" />
                  <span>Analytical Algorithms</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-300 font-mono">
                  {selectedAgent.algorithms.map((alg, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#8B6CFF] mt-0.5">›</span>
                      <span className="leading-tight">{alg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Output Advisories */}
            <div className="p-3.5 rounded-xl bg-[#03141F]/80 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200 font-heading">
                <Send className="w-3.5 h-3.5 text-[#36D399]" />
                <span>Generated Operational Outputs</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedAgent.outputs.map((out, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#061F2C]/50 border border-slate-800/80 text-[10px] text-slate-300 font-mono"
                  >
                    {out}
                  </div>
                ))}
              </div>
            </div>

            {/* Collaborative Dependencies */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                Collaborates Directly With:
              </span>
              <div className="flex items-center space-x-1.5">
                {selectedAgent.collaboratesWith.map(collabId => {
                  const cAgent = ORCA_COLLABORATIVE_AGENTS.find(a => a.id === collabId);
                  if (!cAgent) return null;
                  return (
                    <button
                      key={collabId}
                      onClick={() => setSelectedAgentId(collabId)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#082A36] text-[#28D7E5] border border-slate-700 hover:border-[#16C7C7] transition-colors"
                      title={cAgent.name}
                    >
                      A0{cAgent.number}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
