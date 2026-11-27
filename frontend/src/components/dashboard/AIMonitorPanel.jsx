// Live AI Usage & Bar Monitoring Panel displayed below the Dashboard.
// Shows which local AI models are active, where AI is used across CompanyAI,
// live readings (calls, latency, tokens, success rate), and bar charts.
import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Cpu,
  Database,
  RefreshCw,
  ServerOff,
  Zap,
} from 'lucide-react';
import { aiApi } from '../../api/client';

const AI_USE_PLACES = [
  {
    tab: 'assistant',
    title: 'AI Recruiter Assistant',
    model: 'llama3.2:3b',
    description: 'Ask natural-language hiring questions, shortlist candidates, and run RAG Q&A.',
  },
  {
    tab: 'jobs',
    title: 'Boolean Search Customizer',
    model: 'llama3.2:3b',
    description: 'Type recruiter instructions in any Job to build Naukri, LinkedIn & X-Ray strings.',
  },
  {
    tab: 'jobs',
    title: 'Target Companies & Market Report',
    model: 'llama3.2:3b',
    description: 'Generate Tier 1/2/3 target employers and Market Intelligence PDF/Word reports.',
  },
  {
    tab: 'jobs',
    title: 'JD Scope & Interview Kit',
    model: 'llama3.2:3b',
    description: 'Extract structured 12-dimension JD scope, skills, and tailored interview questions.',
  },
  {
    tab: 'matching',
    title: 'Candidate Matches (Smart Fit)',
    model: 'nomic-embed-text',
    description: '768-dim semantic vector matching between open requisitions and candidate resumes.',
  },
  {
    tab: 'comparison',
    title: 'Compare Resume to Job',
    model: 'nomic-embed-text + llama3.2:3b',
    description: '1-on-1 resume-to-JD fit analysis, skill gaps, and semantic similarity.',
  },
];

export const AIMonitorPanel = ({ onNavigateTab }) => {
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMonitor = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await aiApi.getMonitor();
      setMonitor(data);
    } catch (err) {
      setError(err?.message || 'Unable to load AI monitor readings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitor();
  }, []);

  const telemetry = monitor?.telemetry || {};
  const audit = monitor?.database_audit || {};
  const cache = monitor?.cache_metrics || {};
  const whereUsed = monitor?.where_ai_is_used || [];
  const recentCalls = telemetry.recent_calls || [];
  const maxFeatureCalls = Math.max(1, ...whereUsed.map((w) => w.calls || 0));

  const resumeCov = Number(audit.resume_coverage_percent ?? 0);
  const jobCov = Number(audit.job_coverage_percent ?? 0);
  const cacheHitRate = Number(cache.hit_rate_percent ?? cache.hit_rate ?? 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard p-5 shadow-card space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <span>AI Usage &amp; Runtime Monitor</span>
              {monitor && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    monitor.ollama_online
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${monitor.ollama_online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {monitor.ollama_online ? 'Ollama Online' : 'Ollama Offline (Fallback Active)'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active models: <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{monitor?.chat_model || 'llama3.2:3b'}</span> (Reasoning) &amp;{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{monitor?.embedding_model || 'nomic-embed-text'}</span> ({monitor?.embedding_dimensions || 768}-dim Vectors)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadMonitor}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-surface-darkHover hover:bg-slate-200/80 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-surface-darkBorder transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Readings</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <ServerOff className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Readings Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total AI Calls</span>
          <p className="text-xl font-bold text-navy-900 dark:text-white mt-0.5 font-mono">{telemetry.total_calls ?? 0}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {telemetry.success_rate_pct ?? 100}% success ({telemetry.total_errors ?? 0} errors)
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Avg AI Latency</span>
          <p className="text-xl font-bold text-navy-900 dark:text-white mt-0.5 font-mono">{telemetry.avg_latency_ms ?? 0} ms</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Local Ollama response time</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tokens Processed</span>
          <p className="text-xl font-bold text-navy-900 dark:text-white mt-0.5 font-mono">
            {(telemetry.total_tokens ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Zero cloud API cost</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Vector Coverage</span>
          <p className="text-xl font-bold text-navy-900 dark:text-white mt-0.5 font-mono">{resumeCov}%</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Resumes: {audit.genuine_resumes ?? 0}/{audit.total_resumes ?? 0} | Jobs: {audit.genuine_jobs ?? 0}/{audit.total_jobs ?? 0}
          </span>
        </div>
      </div>

      {/* Bar Monitoring Grid: Where AI is Used + Vector/Cache Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Where AI is Being Used (Horizontal Bar Chart) */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-slate-50/70 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Where AI Is Used &amp; Call Volume</span>
            </h4>
            <span className="text-[11px] text-slate-500">Live session readings</span>
          </div>

          <div className="space-y-2.5">
            {whereUsed.map((item) => {
              const barWidth = item.calls > 0 ? Math.max(8, Math.round((item.calls / maxFeatureCalls) * 100)) : 0;
              return (
                <div key={item.feature} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.active_now ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <span className="font-semibold text-navy-900 dark:text-slate-100 truncate">{item.feature}</span>
                      <span className="text-slate-400 hidden sm:inline">({item.location})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder">
                        {item.model}
                      </span>
                      <span className="font-bold">{item.calls} calls</span>
                      {item.calls > 0 && <span className="text-slate-400">{item.avg_latency_ms}ms</span>}
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.errors > 0 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-blue-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: System Bar Meters + Recent AI Readings */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-500" />
              <span>AI Coverage &amp; Cache Meters</span>
            </h4>

            {[
              { label: 'Resume Vector Coverage', pct: resumeCov, color: 'bg-emerald-500' },
              { label: 'Job Description Coverage', pct: jobCov, color: 'bg-blue-500' },
              { label: 'Embedding Cache Hit Rate', pct: cacheHitRate, color: 'bg-indigo-500' },
            ].map((meter) => (
              <div key={meter.label} className="space-y-1 text-[11px]">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-700 dark:text-slate-300">{meter.label}</span>
                  <span className="font-mono font-bold text-navy-900 dark:text-white">{meter.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${meter.color} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, meter.pct))}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder space-y-2 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Recent AI Readings</span>
            </h4>
            {recentCalls.length > 0 ? (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-[11px]">
                {recentCalls.map((call, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900 dark:text-slate-100 truncate">{call.feature}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{call.model} • {call.operation}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[10px]">
                      <span className={`inline-flex items-center gap-0.5 font-bold ${call.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {call.latency_ms}ms
                      </span>
                      {call.tokens > 0 && <p className="text-slate-400">{call.tokens} tok</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic py-3 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>No live AI calls recorded in this server session yet. Use AI Assistant, Boolean Search, or Target Companies to see live readings.</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Where You Can Use the AI Models */}
      <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-500" />
            <span>Where You Can Use These AI Models</span>
          </h4>
          <span className="text-[11px] text-slate-500">Click any card to open</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AI_USE_PLACES.map((place) => (
            <button
              key={place.title}
              type="button"
              onClick={() => onNavigateTab && onNavigateTab(place.tab)}
              className="text-left p-3 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-2xs group cursor-pointer flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-navy-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {place.title}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {place.description}
                </p>
              </div>
              <span className="inline-block self-start text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                {place.model}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
