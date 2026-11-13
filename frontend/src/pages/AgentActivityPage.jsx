// Import React and hooks for managing persisted AI agent trace logs.
import React, { useState, useEffect } from 'react';

// Import icons from lucide-react.
import { Clock, Cpu, ChevronDown, ChevronRight, ChevronUp, Terminal, RefreshCw, AlertCircle } from 'lucide-react';

// Import agent API client and React Bits AnimatedList.
import { agentApi } from '../api/client';
import { AnimatedList } from '../components/reactbits/AnimatedList';

// Default number of trace rows rendered before expanding.
const TRACES_DEFAULT_VISIBLE = 8;

// Export AgentActivityPage presenting real-time agent execution traces with Light & Dark theme support.
export const AgentActivityPage = () => {
  const [traces, setTraces] = useState([]);
  const [expandedTraceId, setExpandedTraceId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Load real execution traces from SQLite backend without fabricating fallback traces.
  const fetchTraces = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await agentApi.getTraces(25);
      setTraces(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load agent execution traces from backend.');
      setTraces([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  const visibleTraces = showAll ? traces : traces.slice(0, TRACES_DEFAULT_VISIBLE);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header with live refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-white tracking-tight flex items-center gap-2">
            <span>AI Agent Observability & Traces</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              Langfuse-Compatible
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Inspect real-time execution steps, tool arguments, model token usage, and latency metrics
          </p>
        </div>

        <button
          onClick={fetchTraces}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-surface-darkCard hover:bg-slate-50 dark:hover:bg-surface-darkHover border border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium shadow-subtle transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Traces</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Traces List */}
      <div>
        {visibleTraces.length === 0 ? (
          <div className="p-12 bg-white dark:bg-surface-darkCard border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-2xl text-center text-xs text-slate-400 dark:text-slate-500">
            No agent traces recorded yet. Ask a question in Nemotron AI to generate execution traces.
          </div>
        ) : (
          <AnimatedList
            items={visibleTraces}
            getItemKey={(trace) => trace.traceId}
            listClassName="space-y-3"
            staggerMs={35}
            renderItem={(trace) => {
              const isExpanded = expandedTraceId === trace.traceId;
              return (
                <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-subtle card-interactive overflow-hidden transition-all">
                  {/* Trace header row */}
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedTraceId(isExpanded ? null : trace.traceId)}
                    className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-surface-50/50 dark:hover:bg-surface-darkHover/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800 text-brand-700 dark:text-brand-300 flex-shrink-0">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-900 dark:text-slate-100 line-clamp-1">
                            "{trace.prompt}"
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          <span>ID: {(trace.traceId || '').slice(0, 12)}...</span>
                          <span>•</span>
                          <span>{trace.modelName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata metrics pills */}
                    <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-200 font-medium text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {trace.latencyMs}ms
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-brand-50 dark:bg-brand-950/50 rounded-md text-brand-700 dark:text-brand-300 font-medium text-[11px] border border-brand-200/60 dark:border-brand-800">
                        <Cpu className="w-3 h-3 text-brand-600 dark:text-brand-400" />
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
                  </button>

                  {/* Smooth Expandable Trace Details */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="p-4 bg-surface-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-surface-darkBorder space-y-3 text-xs">
                        <div className="font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                          Tool Execution Timeline & Parameters
                        </div>

                        {(!trace.toolsCalled || trace.toolsCalled.length === 0) ? (
                          <p className="text-slate-400 italic">No external tool calls invoked for this query.</p>
                        ) : (
                          <div className="space-y-2">
                            {trace.toolsCalled.map((tool, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-xl space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-navy-900 dark:text-slate-100 text-xs">
                                    Step {idx + 1}: {tool.tool_name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded font-mono">
                                      {(tool.status || 'ok').toUpperCase()}
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
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Show More / Show Less Toggle */}
      {traces.length > TRACES_DEFAULT_VISIBLE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {visibleTraces.length} of {traces.length} traces
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle hover:border-brand-400 transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                <span>Show More ({traces.length - TRACES_DEFAULT_VISIBLE} more)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
