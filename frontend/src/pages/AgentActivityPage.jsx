// Import React and hooks for managing trace data and polling.
import React, { useState, useEffect } from 'react';

// Import Badge component.
import { Badge } from '../components/common/Badge';

// Import icons from lucide-react.
import { Activity, Clock, Cpu, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Terminal, RefreshCw } from 'lucide-react';

// Import agent API client.
import { agentApi } from '../api/client';

// Export AgentActivityPage presenting real-time agent execution traces and tool calls.
export const AgentActivityPage = () => {
  const [traces, setTraces] = useState([]);
  const [expandedTraceId, setExpandedTraceId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load traces from API.
  const fetchTraces = async () => {
    setIsLoading(true);
    try {
      const data = await agentApi.getTraces(15);
      setTraces(data);
    } catch (err) {
      console.warn('Trace API offline, showing initial traces');
      // Fallback sample trace.
      setTraces([
        {
          traceId: 'trace-8a9b2c3d',
          prompt: 'Find Teamcenter PLM consultants with 5+ years experience in Hyderabad',
          modelName: 'nvidia/nemotron-4-340b-instruct',
          toolsCalled: [
            {
              tool_name: 'search_candidates_tool',
              arguments: { query: 'Siemens Teamcenter PLM', limit: 3 },
              latency_ms: 180,
              status: 'success',
            },
          ],
          latencyMs: 340,
          tokensUsed: 260,
          status: 'success',
          createdAt: 'Just now',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header with live refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <span>AI Agent Observability & Traces</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Langfuse-Compatible
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect real-time execution steps, tool arguments, model token usage, and latency metrics
          </p>
        </div>

        <button
          onClick={fetchTraces}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium shadow-subtle transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Traces</span>
        </button>
      </div>

      {/* Traces List */}
      <div className="space-y-3">
        {traces.length === 0 ? (
          <div className="p-12 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
            No agent traces recorded yet. Ask a question in the AI Assistant to generate execution traces!
          </div>
        ) : (
          traces.map((trace) => {
            const isExpanded = expandedTraceId === trace.traceId;

            return (
              <div
                key={trace.traceId}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-subtle overflow-hidden transition-all"
              >
                {/* Trace header row */}
                <div
                  onClick={() => setExpandedTraceId(isExpanded ? null : trace.traceId)}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-surface-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-700">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-navy-900 line-clamp-1">
                          "{trace.prompt}"
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5">
                        <span>ID: {trace.traceId.slice(0, 12)}...</span>
                        <span>•</span>
                        <span>{trace.modelName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata metrics pills */}
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 rounded-md text-slate-700 font-medium text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {trace.latencyMs}ms
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-brand-50 rounded-md text-brand-700 font-medium text-[11px] border border-brand-200/60">
                      <Cpu className="w-3 h-3 text-brand-600" />
                      {trace.toolsCalled?.length || 0} Tools
                    </span>

                    <span className="text-slate-400 text-[11px]">
                      {trace.createdAt}
                    </span>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Trace Details */}
                {isExpanded && (
                  <div className="p-4 bg-surface-50/60 border-t border-slate-100 space-y-3 text-xs">
                    <div className="font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                      Tool Execution Timeline & Parameters
                    </div>

                    {(!trace.toolsCalled || trace.toolsCalled.length === 0) ? (
                      <p className="text-slate-400 italic">No external tool calls invoked for this query.</p>
                    ) : (
                      <div className="space-y-2">
                        {trace.toolsCalled.map((tool, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-navy-900 text-xs">
                                Step {idx + 1}: {tool.tool_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded font-mono">
                                  {tool.status.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {tool.latency_ms}ms
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                              {JSON.stringify(tool.arguments, null, 2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
