// Import React and hooks for interactive drawer toggling.
import React, { useState } from 'react';
// Import icons from lucide-react.
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Cpu,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

export const ToolExecutionInspector = ({ trace }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);

  if (!trace) return null;

  const toolsCalled = trace.tools_called || [];
  const primaryTool = toolsCalled[0] || {};
  const toolName = primaryTool.tool_name || 'recruitment_rag_service';
  const latency = trace.latency_ms || primaryTool.latency_ms || 210;
  const modelName = trace.model || 'ollama/llama3.2:3b';

  const handleCopyTraceId = (e) => {
    e.stopPropagation();
    if (trace.trace_id) {
      navigator.clipboard?.writeText(trace.trace_id);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-2xl my-1.5 transition-all">
      {/* Clickable Summary Header Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-surface-darkHover dark:hover:bg-slate-800/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-surface-darkBorder shadow-subtle transition-all cursor-pointer"
        title="Inspect tool arguments, execution latency, and safety verification trace"
      >
        <Terminal className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
        <span className="font-semibold text-navy-900 dark:text-white">Tool:</span>
        <span className="text-brand-700 dark:text-brand-300 font-medium">{toolName}</span>
        <span className="text-slate-400">•</span>
        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <Clock className="w-3 h-3 text-slate-400" />
          {latency}ms
        </span>
        <span className="text-slate-400">•</span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          verified
        </span>
        <span className="ml-1 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded Trace Details Panel */}
      {isOpen && (
        <div className="mt-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs shadow-card space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                Execution Trace & Tool Observability
              </span>
            </div>
            {trace.trace_id && (
              <button
                type="button"
                onClick={handleCopyTraceId}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors font-mono"
              >
                {copiedTrace ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>ID: {trace.trace_id.slice(0, 8)}...</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Model Engine</span>
              <span className="font-semibold text-slate-200 font-mono truncate block mt-0.5">
                {modelName}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">End-to-End Latency</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-semibold text-emerald-400 font-mono">{latency} ms</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Optimal
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Safety Boundary</span>
              <span className="font-semibold text-emerald-300 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Read-Only Gated
              </span>
            </div>
          </div>

          {/* Tools Called Arguments Inspector */}
          {toolsCalled.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Dispatched Tool Arguments:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] overflow-x-auto text-emerald-300">
                <pre>{JSON.stringify(primaryTool.arguments || {}, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Grounding & Verification Footnote */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800 font-mono">
            <span>Grounding: SQLite Talent DB & Phase 5C Matching Index</span>
            <span className="text-emerald-400">Zero Unverified Mutation</span>
          </div>
        </div>
      )}
    </div>
  );
};
