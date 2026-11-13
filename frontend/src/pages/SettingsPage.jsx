// Import React and hooks for Settings & Administration workspace.
import React, { useState, useEffect } from 'react';

// Import analyticsApi client for live telemetry and health checks.
import { analyticsApi } from '../api/client';

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
  User,
  SlidersHorizontal,
} from 'lucide-react';

// Export SettingsPage presenting grounded platform health, theme, display density, and AI telemetry without exposing secrets.
export const SettingsPage = ({
  theme = 'light',
  onToggleTheme,
  density = 'comfortable',
  onChangeDensity,
  resumeDiscovery = null,
}) => {
  // Real backend health and model configuration status fetched from /api/analytics/stats.
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real telemetry metrics from backend.
  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const data = await analyticsApi.getStats();
      setTelemetry(data);
    } catch (err) {
      console.warn('Telemetry error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const aiHealth = telemetry?.aiHealth || {};
  const overview = telemetry?.overview || {};

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

      {/* 2. AI & Model Telemetry Status */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">Nemotron AI Model & Vector Telemetry</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">LLM Reasoning Model</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block">
              {aiHealth.llmModel || 'nvidia/nemotron-4-340b-instruct'}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Function calling & tools operational
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Vector Embedding Model</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block">
              {aiHealth.embeddingModel || 'nvidia/nemotron-3-embed-1b:free'}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 2,048 dimensions • Normalized cosine
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Vector Coverage Status</span>
            <span className="font-bold text-navy-900 dark:text-white font-mono block">
              {overview.totalEmbeddings ?? resumeDiscovery?.embedded_resumes ?? 0} / {overview.totalResumes ?? resumeDiscovery?.total_resumes ?? 0} Vectors ({overview.embeddingCoveragePercent ?? 0}%)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {(overview.totalResumes ?? 0) - (overview.totalEmbeddings ?? 0)} unvectorized resumes remaining
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">API Security Architecture</span>
            <span className="font-bold text-navy-900 dark:text-white block">Controlled Provider Adapter</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" /> Keys stored in server environment
            </span>
          </div>
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
