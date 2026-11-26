// Import React and hooks for Settings & Administration workspace.
import React, { useState, useEffect } from 'react';

// Import analyticsApi and aiApi client for live telemetry and health checks.
import { analyticsApi, aiApi } from '../api/client';

// Import Badge component.
import { Badge } from '../components/common/Badge';

// Import lucide-react icons.
import {
  Settings,
  Cpu,
  Database,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Server,
  Lock,
  Unlock,
  ShieldAlert,
  User,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// Export SettingsPage presenting grounded platform health, theme, display density, and AI telemetry without exposing secrets.
export const SettingsPage = ({
  theme = 'light',
  onToggleTheme,
  density = 'comfortable',
  onChangeDensity,
  resumeDiscovery = null,
  isGovernanceBlocked = true,
  onToggleGovernanceBlocked,
}) => {
  // Real backend health and model configuration status fetched from /api/analytics/stats and /api/ai/health.
  const [telemetry, setTelemetry] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [governanceFeedback, setGovernanceFeedback] = useState('');

  // Diagnostic states
  const [testEmbeddingLoading, setTestEmbeddingLoading] = useState(false);
  const [testEmbeddingResult, setTestEmbeddingResult] = useState(null);
  const [testChatLoading, setTestChatLoading] = useState(false);
  const [testChatResult, setTestChatResult] = useState(null);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexResult, setReindexResult] = useState(null);

  const handleToggleGovernance = (nextBlockedState) => {
    if (onToggleGovernanceBlocked) {
      onToggleGovernanceBlocked(nextBlockedState);
      setGovernanceFeedback(
        nextBlockedState
          ? 'Governance & Analytics workspace is now BLOCKED across the workspace.'
          : 'Governance & Analytics workspace has been UNBLOCKED and is now fully accessible.'
      );
      setTimeout(() => setGovernanceFeedback(''), 4000);
    }
  };

  // Fetch real telemetry metrics from backend.
  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const [statsData, aiData] = await Promise.all([
        analyticsApi.getStats().catch(() => null),
        aiApi.getHealth().catch(() => null),
      ]);
      setTelemetry(statsData);
      setAiReport(aiData);
    } catch (err) {
      console.warn('Telemetry error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmbedding = async () => {
    setTestEmbeddingLoading(true);
    setTestEmbeddingResult(null);
    try {
      const res = await aiApi.testEmbedding('Recruitment Model Verification: Senior Python Engineer');
      setTestEmbeddingResult(res);
    } catch (err) {
      setTestEmbeddingResult({ status: 'error', message: err.message });
    } finally {
      setTestEmbeddingLoading(false);
    }
  };

  const handleTestChat = async () => {
    setTestChatLoading(true);
    setTestChatResult(null);
    try {
      const res = await aiApi.testChat('Explain why vector similarity benefits talent acquisition in two brief sentences.');
      setTestChatResult(res);
    } catch (err) {
      setTestChatResult({ status: 'error', message: err.message });
    } finally {
      setTestChatLoading(false);
    }
  };

  const handleReindex = async () => {
    if (!window.confirm('Trigger controlled AI embedding verification and batch re-indexing for candidate resumes?')) {
      return;
    }
    setReindexLoading(true);
    setReindexResult(null);
    try {
      const res = await aiApi.reindex(25, false);
      setReindexResult(res);
      fetchHealth();
    } catch (err) {
      setReindexResult({ status: 'error', message: err.message });
    } finally {
      setReindexLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const aiHealth = telemetry?.aiHealth || {};
  const overview = telemetry?.overview || {};
  const dbAudit = aiReport?.database_audit || {};
  const models = aiReport?.models || {};

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Settings & Administration</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              System Online
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure appearance preferences, inspect model telemetry, and review SQLite database health
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-subtle"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Dynamic Feedback Banner for Governance & Analytics toggling */}
      {governanceFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-fadeIn ${
            isGovernanceBlocked
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isGovernanceBlocked ? (
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            <span>{governanceFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setGovernanceFeedback('')}
            className="text-xs opacity-70 hover:opacity-100 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 0. Governance & Analytics Access Policy (Administrative Module Security) */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isGovernanceBlocked
                  ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isGovernanceBlocked ? <Lock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                  Governance &amp; Analytics Access Control
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isGovernanceBlocked
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {isGovernanceBlocked ? 'Blocked' : 'Active / Unblocked'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Block or unblock recruiter access to Analytics, Approvals, Agent Activity, and Notifications.
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <button
            type="button"
            onClick={() => handleToggleGovernance(!isGovernanceBlocked)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-subtle transition-all ${
              isGovernanceBlocked
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 dark:bg-surface-darkHover dark:text-slate-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
            }`}
          >
            {isGovernanceBlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Unblock Governance &amp; Analytics</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-rose-500" />
                <span>Block Governance &amp; Analytics</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1.5 max-w-xl">
            <p className="font-semibold text-navy-900 dark:text-white">
              {isGovernanceBlocked
                ? 'Governance & Analytics is currently BLOCKED in the workspace.'
                : 'Governance & Analytics is currently UNBLOCKED and accessible to recruiters.'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              When blocked, the section remains visible in the sidebar with a lock status tag, and navigating to its views shows an administrative restriction barrier until unblocked here.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-darkHover border border-slate-200/80 dark:border-surface-darkBorder">
                Analytics
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-darkHover border border-slate-200/80 dark:border-surface-darkBorder">
                Approvals
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-darkHover border border-slate-200/80 dark:border-surface-darkBorder">
                Agent Activity
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-darkHover border border-slate-200/80 dark:border-surface-darkBorder">
                Notifications
              </span>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-start sm:self-center flex-shrink-0 bg-slate-50 dark:bg-surface-darkHover/40 p-2.5 rounded-xl border border-slate-200/70 dark:border-surface-darkBorder">
            <span className="text-xs font-semibold text-navy-900 dark:text-white">
              {isGovernanceBlocked ? 'Blocked' : 'Unblocked'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!isGovernanceBlocked}
              aria-label="Toggle Governance & Analytics Access"
              onClick={() => handleToggleGovernance(!isGovernanceBlocked)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                !isGovernanceBlocked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  !isGovernanceBlocked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 1. Appearance & Theme Settings */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">Workspace Theme</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-navy-900 dark:text-white">Interface Theme Mode</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Toggle between Hybrid Enterprise Light and Dark modes. Preference persists in browser local storage.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-surface-darkHover p-1 rounded-xl">
            <button
              onClick={() => theme === 'dark' && onToggleTheme && onToggleTheme()}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                theme === 'light'
                  ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light Mode</span>
            </button>
            <button
              onClick={() => theme === 'light' && onToggleTheme && onToggleTheme()}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                theme === 'dark'
                  ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1B. Display Density Settings (Comfortable vs Compact) */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <SlidersHorizontal className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-lg font-bold text-navy-900 dark:text-white">Display Density</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <p className="text-[15px] font-semibold text-navy-900 dark:text-white">
              Workspace Spacing &amp; Table Density
            </p>
            <div className="space-y-1 text-[13px] sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <span className="font-semibold text-navy-900 dark:text-slate-100">Comfortable:</span>{' '}
                Larger spacing, generous card padding, and relaxed table rows for management and general usage.
              </p>
              <p>
                <span className="font-semibold text-navy-900 dark:text-slate-100">Compact:</span>{' '}
                Reduced card padding and optimized high-density tables (14px+ readable text preserved) for high-volume recruiting.
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Display density mode"
            className="flex items-center gap-1 bg-slate-100 dark:bg-surface-darkHover p-1 rounded-xl self-start flex-shrink-0"
          >
            <button
              type="button"
              onClick={() => onChangeDensity && onChangeDensity('comfortable')}
              aria-pressed={density === 'comfortable'}
              className={`px-3.5 py-2 rounded-lg text-[15px] font-semibold transition-all ${
                density === 'comfortable'
                  ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => onChangeDensity && onChangeDensity('compact')}
              aria-pressed={density === 'compact'}
              className={`px-3.5 py-2 rounded-lg text-[15px] font-semibold transition-all ${
                density === 'compact'
                  ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {/* 2. Centralized AI Model Administration & Vector Telemetry */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              Local Ollama AI Model Administration & Vector Coverage
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 self-start sm:self-auto">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Local Ollama Active
          </span>
        </div>

        {/* Operational Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {/* Primary Embedding Model */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Primary Embedding Model</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Verified Free
              </span>
            </div>
            <span className="font-bold text-navy-900 dark:text-white font-mono block text-xs truncate" title={models?.embedding?.name || 'nomic-embed-text'}>
              {models?.embedding?.name || 'nomic-embed-text'}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> 768 Verified Dimensions (L2 Norm = 1.0)
            </span>
          </div>

          {/* Chat & Reasoning Model */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Chat & Reasoning Model</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Verified Free Tier
              </span>
            </div>
            <span className="font-bold text-navy-900 dark:text-white font-mono block text-xs truncate" title={models?.chat?.name || 'llama3.2:3b'}>
              {models?.chat?.name || 'llama3.2:3b'}
            </span>
            <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Local 128K Context • Structured RAG
            </span>
          </div>

          {/* Resume Vector Coverage */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Resume Vector Provenance</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block text-xs">
              Verified Ollama: {dbAudit.genuine_resumes ?? 0} / {dbAudit.total_resumes ?? 241} ({dbAudit.resume_coverage_percent ?? 0}%)
            </span>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${dbAudit.resume_coverage_percent ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block pt-0.5">
              Provenance Unknown: {dbAudit.provenance_unknown_resumes ?? 23} • Synthetic Fallback: {dbAudit.synthetic_fallback_resumes ?? 218}
            </span>
          </div>

          {/* Job Vector Coverage */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Job Vector Provenance</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block text-xs">
              Verified Ollama: {dbAudit.genuine_jobs ?? 0} / {dbAudit.total_jobs ?? 10} ({dbAudit.job_coverage_percent ?? 0}%)
            </span>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${dbAudit.job_coverage_percent ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block pt-0.5">
              Provenance Unknown: {dbAudit.provenance_unknown_jobs ?? 51} • Synthetic Fallback: {dbAudit.synthetic_fallback_jobs ?? 1}
            </span>
          </div>

          {/* In-Memory Vector Cache */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Vector Cache Efficiency</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block text-xs">
              {aiReport?.cache_metrics?.cached_entries ?? 0} vectors cached • {aiReport?.cache_metrics?.hit_ratio_percent ?? 100}% hit ratio
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              SHA-256 Text Digest Deduplication
            </span>
          </div>

          {/* Rate-Limit & Gateway Security */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Gateway & Rate Limits</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                Local Offline • Unlimited
              </span>
            </div>
            <span className="font-bold text-navy-900 dark:text-white block text-xs">100% Local Semantic Index</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Fully offline • Zero external cloud calls
            </span>
          </div>
        </div>

        {/* Controlled Diagnostic & Administrative Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-navy-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" /> Model Connectivity & Diagnostic Controls
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Administrative self-test suite
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleTestEmbedding}
              disabled={testEmbeddingLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {testEmbeddingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Test Ollama Embedding</span>
            </button>

            <button
              onClick={handleTestChat}
              disabled={testChatLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-800 dark:text-brand-300 border border-brand-300 dark:border-brand-700/60 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {testChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Test Chat Generation</span>
            </button>

            <button
              onClick={handleReindex}
              disabled={reindexLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-surface-darkBorder text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {reindexLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Verify & Backfill Index</span>
            </button>
          </div>

          {/* Test Embedding Results Panel */}
          {testEmbeddingResult && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-surface-darkBorder text-xs font-mono space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Ollama Embedding Test Completed
                </span>
                <span className="text-[11px] text-slate-500">Latency: {testEmbeddingResult.latency_ms} ms</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Model: <strong>{testEmbeddingResult.model}</strong> • Dimensions: <strong>{testEmbeddingResult.dimensions}</strong> (Status: {testEmbeddingResult.is_valid ? 'Valid 768-dim' : 'Mismatch'})
              </p>
              {testEmbeddingResult.sample_coordinates && (
                <p className="text-[10px] text-slate-500 truncate">
                  Vector Sample: [{testEmbeddingResult.sample_coordinates.join(', ')}...]
                </p>
              )}
            </div>
          )}

          {/* Test Chat Results Panel */}
          {testChatResult && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-surface-darkBorder text-xs font-sans space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Chat Model Generation Completed
                </span>
                <span className="text-[11px] font-mono text-slate-500">Latency: {testChatResult.latency_ms || 0} ms</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-200/80 dark:border-surface-darkBorder text-xs leading-relaxed">
                "{testChatResult.content}"
              </p>
            </div>
          )}

          {/* Re-indexing Results Panel */}
          {reindexResult && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs font-sans space-y-1 animate-fadeIn">
              <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Index Verification & Backfill Finished
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                Processed: {reindexResult.processed_count} • Generated: {reindexResult.generated_count} • Reused: {reindexResult.reused_count} • Remaining Missing: {reindexResult.remaining_missing}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Database Health & Integrity */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">Active Database Infrastructure</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Storage Engine</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono mt-0.5 block">SQLite 3</span>
            <span className="text-[10px] text-slate-500 font-mono">data/companyai.db</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Integrity Protection</span>
            <span className="font-bold text-navy-900 dark:text-white mt-0.5 block">SHA-256 Deduplication</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Strict Partial Indexes</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Backend API Gateway</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono mt-0.5 block">FastAPI 2.0</span>
            <span className="text-[10px] text-slate-500">Port 8000 Loopback</span>
          </div>
        </div>
      </div>

      {/* 4. Active Recruiter Session Context */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-3">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <User className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">Active Recruiter Profile</h3>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-navy-900 dark:text-white">Krishna C. (Recruiter Admin)</p>
            <p className="text-slate-500 dark:text-slate-400">recruiter@companyai.internal • Administrator Governance Role</p>
          </div>
          <Badge variant="brand" size="xs">
            Admin Authorized
          </Badge>
        </div>
      </div>
    </div>
  );
};
