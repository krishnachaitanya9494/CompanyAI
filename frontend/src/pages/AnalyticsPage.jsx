// Import React and hooks for complete enterprise Analytics & Intelligence visualization.
import React, { useState, useEffect, useMemo } from 'react';

// Import analyticsApi client, common Badge wrapper, AnimatedMetricValue, LatticeLoader & AnimatedContent.
import { analyticsApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { AnimatedMetricValue } from '../components/layout/MetricCard';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';
import { AnimatedContent } from '../components/reactbits/AnimatedContent';

// Import lucide-react icons for section clarity across Light & Dark themes.
import {
  BarChart3,
  Download,
  RefreshCw,
  Filter,
  TrendingUp,
  Briefcase,
  Cpu,
  FileText,
  Award,
  GitPullRequest,
  ShieldCheck,
} from 'lucide-react';

// Reusable Interactive SVG Donut Chart renderer with hover slice expansion, dynamic center readout, and readable legend.
const SvgDonutChart = ({ segments = [], centerLabel = '', centerSub = '' }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const palette = ['#4F46E5', '#10b981', '#f59e0b', '#64748b', '#0ea5e9', '#ef4444'];
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  const activeSeg = hoveredIdx !== null ? segments[hoveredIdx] : null;
  const activePct = activeSeg && total > 0 ? Math.round((activeSeg.value / total) * 100) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex-shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 overflow-visible">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="17"
          />
          {total > 0 &&
            segments.map((seg, idx) => {
              const frac = seg.value / total;
              const dashLen = frac * circumference;
              const dashOffset = -offsetAccum;
              offsetAccum += dashLen;
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;
              return (
                <circle
                  key={seg.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={seg.color || palette[idx % palette.length]}
                  strokeWidth={isHovered ? '22' : '17'}
                  strokeDasharray={`${dashLen} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    opacity: isDimmed ? 0.42 : 1,
                    filter: isHovered ? 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.35))' : 'none',
                  }}
                  className="cursor-pointer transition-all duration-200 ease-out"
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          <span className="text-2xl font-extrabold text-navy-900 dark:text-white font-mono leading-none transition-all duration-150">
            {activeSeg ? activeSeg.value : centerLabel || total}
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[100px]">
            {activeSeg ? `${activePct}% • ${activeSeg.label}` : centerSub}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2 text-sm">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={seg.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-150 ${
                isHovered
                  ? 'bg-slate-100/90 dark:bg-surface-darkHover translate-x-0.5'
                  : 'hover:bg-slate-50 dark:hover:bg-surface-darkHover/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-150 ${
                    isHovered ? 'scale-125' : ''
                  }`}
                  style={{ backgroundColor: seg.color || palette[idx % palette.length] }}
                />
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{seg.label}</span>
              </div>
              <span className="font-mono font-semibold text-navy-900 dark:text-white flex-shrink-0">
                {seg.value} <span className="text-slate-400 dark:text-slate-400 text-xs">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Export AnalyticsPage providing complete SQLite-grounded visualizations across 10 analytics modules.
export const AnalyticsPage = ({
  candidates = [],
  jobs = [],
  requests = [],
}) => {
  // Interactive filter state synchronized with GET /api/analytics/intelligence.
  const [daysFilter, setDaysFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');

  // Fetched analytics intelligence payload and loading/error state.
  const [intel, setIntel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Interactive chart hover states for velocity line chart and histogram bars.
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);
  const [hoveredBucket, setHoveredBucket] = useState(null);

  // Retrieve full aggregated visualizations from backend analytics intelligence endpoint.
  const fetchIntelligence = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await analyticsApi.getIntelligence({
        days: daysFilter,
        job_id: jobFilter || null,
        client: clientFilter,
        stage: stageFilter,
      });
      setIntel(data);
    } catch (err) {
      setErrorMsg(err.message || 'Could not load analytics intelligence.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [daysFilter, jobFilter, clientFilter, stageFilter]);

  // Export valid CSV report compiled directly from filtered SQLite candidate and pipeline metrics.
  const handleExportCSV = () => {
    const headers = ['Candidate ID', 'Name', 'Current Role', 'Stage', 'Experience Years', 'Location', 'Availability', 'Primary Skills'];
    const rows = candidates
      .filter((c) => stageFilter === 'All' || (c.status || c.stage) === stageFilter)
      .map((c) => [
        c.id,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.currentRole || '').replace(/"/g, '""')}"`,
        `"${c.status || c.stage || 'New'}"`,
        c.experienceYears ?? '',
        `"${c.location || ''}"`,
        `"${c.availability || ''}"`,
        `"${(c.primarySkills || []).join('; ')}"`,
      ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `companyai_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pipelineFunnel = intel?.pipelineFunnel || [];
  const funnelMax = Math.max(...pipelineFunnel.map((s) => s.count), 1);
  const trends = intel?.recruitmentTrends || [];
  const maxTrendVal = Math.max(
    ...trends.flatMap((t) => [t.activities || 0, t.candidates || 0, t.interviews || 0]),
    1
  );
  const jobStatuses = intel?.jobStatusDistribution || [];
  const skillsIntel = intel?.skillsIntelligence || [];
  const maxSkillVal = Math.max(...skillsIntel.flatMap((s) => [s.supplyCount || 0, s.demandCount || 0]), 1);
  const scoreDist = intel?.matchingScoreDistribution || { buckets: [] };
  const maxBucketCount = Math.max(...(scoreDist.buckets || []).map((b) => b.count), 1);
  const jobPerf = intel?.jobMatchingPerformance || [];
  const resumeFormats = intel?.resumeFormatDistribution || [];
  const embCov = intel?.embeddingCoverage || {};
  const reqStats = intel?.requestAnalytics || {};
  const offerStats = intel?.placementAndOfferStats || {};

  // Build SVG polyline points for Trends time-series chart safely.
  const buildPolyline = (key) => {
    if (trends.length === 0) return '';
    const w = 520;
    const h = 150;
    return trends
      .map((pt, idx) => {
        const x = trends.length === 1 ? w / 2 : (idx / (trends.length - 1)) * w;
        const y = h - ((pt[key] || 0) / maxTrendVal) * (h - 24) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Recruitment Analytics & Intelligence</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              Live SQLite Aggregations
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Interactive charts grounded strictly in persisted SQLite records across candidates, JDs, embeddings, and approvals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchIntelligence}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-subtle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Interactive Filter Toolbar */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Window:
          </span>
          {[
            { id: '7', label: '7d' },
            { id: '30', label: '30d' },
            { id: '90', label: '90d' },
            { id: 'all', label: 'All Time' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDaysFilter(opt.id)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                daysFilter === opt.id
                  ? 'bg-navy-900 dark:bg-brand-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-navy-900 dark:text-slate-100 max-w-[220px]"
          >
            <option value="">All Evaluated Jobs</option>
            {(intel?.availableFilters?.jobs || jobs.map((j) => ({ id: j.id, label: j.title }))).map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-navy-900 dark:text-slate-100"
          >
            <option value="All">All Clients</option>
            {(intel?.availableFilters?.clients || []).map((cl) => (
              <option key={cl} value={cl}>
                {cl}
              </option>
            ))}
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-navy-900 dark:text-slate-100"
          >
            <option value="All">All Stages</option>
            {(intel?.availableFilters?.stages || []).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {isLoading && !intel && (
        <div className="p-10 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card flex items-center justify-center">
          <LatticeLoader
            label="Aggregating live SQLite recruitment intelligence"
            pattern="pulse"
            grid={4}
            color="#059669"
            cellSize={5}
            fontSize={13}
            showTimer
          />
        </div>
      )}

      {/* Row 1: Panel 1 (Pipeline Funnel) & Panel 2 (Recruitment Velocity Trends SVG) */}
      <AnimatedContent distance={12} duration={0.34} delay={50}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" />
              <span>1. Recruitment Pipeline Funnel</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">All candidate stages from New through Hired / Rejected</p>
          </div>
          <div className="space-y-3">
            {pipelineFunnel.map((stg, idx) => {
              const pctWidth = Math.round((stg.count / funnelMax) * 100);
              return (
                <div key={stg.stage} className="group space-y-1.5 text-sm p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50/80 dark:hover:bg-surface-darkHover/60 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-navy-900 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">{stg.stage}</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{stg.count}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 dark:bg-brand-500 rounded-full animate-barGrow transition-all duration-300 group-hover:brightness-110"
                      style={{
                        width: `${stg.count > 0 ? Math.max(pctWidth, 3) : 0}%`,
                        animationDelay: `${Math.min(idx * 40, 200)}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>2. Recruitment Velocity Over Time</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Hover points to inspect daily Activity Events, Candidate Ingestions, and Scheduled Interviews
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-accent-600 dark:text-accent-400 font-semibold">● Activities</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">● Candidates</span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">● Interviews</span>
            </div>
          </div>

          {trends.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No timestamped events occurred inside the selected lookback window.
            </div>
          ) : (
            <div className="relative space-y-2">
              {hoveredTrendIdx !== null && trends[hoveredTrendIdx] && (
                <div className="p-2.5 rounded-xl bg-navy-950 dark:bg-slate-900 text-white text-xs shadow-dropdown border border-slate-700/60 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                  <span className="font-mono font-bold text-slate-200">{trends[hoveredTrendIdx].date}</span>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-accent-400">Activities: {trends[hoveredTrendIdx].activities || 0}</span>
                    <span className="text-emerald-400">Candidates: {trends[hoveredTrendIdx].candidates || 0}</span>
                    <span className="text-amber-400">Interviews: {trends[hoveredTrendIdx].interviews || 0}</span>
                  </div>
                </div>
              )}
              <svg viewBox="0 0 520 175" className="w-full h-56 overflow-visible">
                <line x1="0" y1="160" x2="520" y2="160" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                <line x1="0" y1="85" x2="520" y2="85" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" strokeWidth="1" />
                <polyline fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline('activities')} />
                <polyline fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline('candidates')} />
                <polyline fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline('interviews')} />
                {trends.map((pt, idx) => {
                  const x = trends.length === 1 ? 260 : (idx / (trends.length - 1)) * 520;
                  const yAct = 150 - ((pt.activities || 0) / maxTrendVal) * 126 - 10;
                  const yCand = 150 - ((pt.candidates || 0) / maxTrendVal) * 126 - 10;
                  const yInt = 150 - ((pt.interviews || 0) / maxTrendVal) * 126 - 10;
                  const isActive = hoveredTrendIdx === idx;
                  return (
                    <g
                      key={pt.date}
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onMouseLeave={() => setHoveredTrendIdx(null)}
                      className="cursor-pointer"
                    >
                      {isActive && (
                        <line x1={x} y1="6" x2={x} y2="160" stroke="#6366F1" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.65" />
                      )}
                      <rect x={x - 14} y="0" width="28" height="165" fill="transparent" />
                      <circle cx={x} cy={yAct} r={isActive ? '6' : '3.5'} fill="#4F46E5" stroke="#fff" strokeWidth={isActive ? '2' : '0'} className="transition-all duration-150" />
                      <circle cx={x} cy={yCand} r={isActive ? '5.5' : '3'} fill="#10b981" stroke="#fff" strokeWidth={isActive ? '1.5' : '0'} className="transition-all duration-150" />
                      <circle cx={x} cy={yInt} r={isActive ? '5.5' : '3'} fill="#f59e0b" stroke="#fff" strokeWidth={isActive ? '1.5' : '0'} className="transition-all duration-150" />
                    </g>
                  );
                })}
              </svg>
              <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                <span>{trends[0]?.date}</span>
                <span>{trends[Math.floor(trends.length / 2)]?.date}</span>
                <span>{trends[trends.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      </AnimatedContent>

      {/* Row 2: Panel 3 (Job Status Donut) & Panel 4 (Skills Intelligence Supply vs Demand) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-600" />
              <span>3. Job Status Distribution</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Case-normalized breakdown without double-counting</p>
          </div>
          <SvgDonutChart
            segments={jobStatuses.map((s, idx) => ({
              label: s.status,
              value: s.count,
              color: ['#10b981', '#4F46E5', '#f59e0b', '#64748b'][idx % 4],
            }))}
            centerSub="Total JDs"
          />
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-accent-600" />
                <span>4. Skills Intelligence: Supply vs JD Demand</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Candidate talent availability compared against open job skill requirements</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">■ Supply (Candidates)</span>
              <span className="text-accent-600 dark:text-accent-400 font-semibold">■ Demand (JDs)</span>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {skillsIntel.map((item) => (
              <div key={item.skill} className="group space-y-1.5 text-sm p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50/80 dark:hover:bg-surface-darkHover/60 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-navy-900 dark:text-slate-100">{item.skill}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {item.supplyCount} profiles • {item.demandCount} JDs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full animate-barGrow transition-all duration-300 group-hover:brightness-110"
                      style={{ width: `${Math.round((item.supplyCount / maxSkillVal) * 100)}%` }}
                    />
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full animate-barGrow transition-all duration-300 group-hover:brightness-110"
                      style={{ width: `${Math.round((item.demandCount / maxSkillVal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Panel 5 (Matching Score Histogram) & Panel 6 (Job-wise Matching Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white">5. Matching Score Distribution</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Scoped to: <strong>{scoreDist.scopedJobTitle || 'Primary Active Job'}</strong>
            </p>
          </div>
          <div className="h-56 flex items-end justify-between gap-2.5 pt-6 border-b border-slate-200 dark:border-slate-700 pb-2">
            {(scoreDist.buckets || []).map((b, idx) => {
              const barH = Math.round((b.count / maxBucketCount) * 100);
              const isHovered = hoveredBucket === b.bucket;
              return (
                <div
                  key={b.bucket}
                  onMouseEnter={() => setHoveredBucket(b.bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                >
                  <span className={`text-xs font-mono font-bold transition-all duration-150 ${
                    isHovered
                      ? 'text-accent-600 dark:text-accent-400 scale-110'
                      : 'text-navy-900 dark:text-white'
                  }`}>
                    {b.count}
                  </span>
                  <div className="w-full max-w-[44px] bg-slate-100 dark:bg-slate-800 rounded-t-xl h-full flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-xl animate-barGrowY transition-all duration-200 ${
                        isHovered
                          ? 'bg-accent-600 dark:bg-accent-400 shadow-glow-accent'
                          : 'bg-brand-600 dark:bg-brand-500'
                      }`}
                      style={{
                        height: `${b.count > 0 ? Math.max(barH, 6) : 0}%`,
                        animationDelay: `${Math.min(idx * 50, 250)}ms`,
                      }}
                    />
                  </div>
                  <span className={`text-xs font-mono transition-colors ${
                    isHovered ? 'text-navy-950 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {b.bucket}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white">6. Job-Wise Matching Performance</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic Phase 5C tier counts and average scores across evaluated active jobs
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-darkBorder text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3">Job Title</th>
                  <th className="py-2.5 px-2">Pool</th>
                  <th className="py-2.5 px-2">Avg %</th>
                  <th className="py-2.5 px-2">Strong</th>
                  <th className="py-2.5 px-2">Potential</th>
                  <th className="py-2.5 pl-2">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                {jobPerf.map((jp) => (
                  <tr key={jp.jobId} className="table-row-interactive">
                    <td className="py-3 pr-3 font-semibold text-navy-900 dark:text-white">{jp.title}</td>
                    <td className="py-3 px-2 font-mono">{jp.evaluatedCount}</td>
                    <td className="py-3 px-2 font-mono font-bold text-brand-700 dark:text-brand-400">{jp.avgScore}%</td>
                    <td className="py-3 px-2 font-mono text-emerald-700 dark:text-emerald-400">{jp.strongCount}</td>
                    <td className="py-3 px-2 font-mono text-amber-600 dark:text-amber-400">{jp.potentialCount}</td>
                    <td className="py-3 pl-2 font-mono text-slate-500">{jp.needsReviewCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 4: Panel 7 (Resume Format Donut), Panel 8 (Embedding Coverage), Panel 9 (Requests), Panel 10 (Offers vs Hired & Approvals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 7 */}
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-600" />
              <span>7. Resume File Format Distribution</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Stored extension mix across SQLite Resume rows</p>
          </div>
          <SvgDonutChart
            segments={resumeFormats.map((rf, idx) => ({
              label: rf.format,
              value: rf.count,
              color: ['#4F46E5', '#10b981', '#f59e0b', '#0ea5e9', '#64748b'][idx % 5],
            }))}
            centerSub="Resumes"
          />
        </div>

        {/* Panel 8 */}
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent-600" />
              <span>8. 2048-Dim Embedding Coverage</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Resume vector completeness and approved JD segmentation readiness</p>
          </div>
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-navy-900 dark:text-white">Resume Embeddings</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {embCov.embeddedResumes ?? 0} / {embCov.totalResumes ?? 0} ({embCov.resumeCoveragePercent ?? 0}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-barGrow" style={{ width: `${embCov.resumeCoveragePercent ?? 0}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-navy-900 dark:text-white">Jobs with JD Embeddings</span>
                <span className="font-mono font-bold text-accent-700 dark:text-accent-400">
                  {embCov.jobsWithEmbeddings ?? 0} / {embCov.totalJobs ?? 0} jobs
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-600 rounded-full animate-barGrow"
                  style={{ width: `${Math.round(((embCov.jobsWithEmbeddings || 0) / Math.max(embCov.totalJobs || 1, 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 block">Approved JD Segs</span>
                <span className="font-mono font-bold text-sm text-navy-900 dark:text-white">{embCov.jobsWithApprovedSegmentation ?? 0} jobs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                <span className="text-slate-500 dark:text-slate-400 block">JD Requirement Vectors</span>
                <span className="font-mono font-bold text-sm text-navy-900 dark:text-white">
                  {embCov.totalJobEmbeddings ?? 0} / {embCov.totalJobRequirements ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 9 */}
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-amber-600" />
              <span>9. Recruitment Requests Breakdown</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {reqStats.totalFilledPositions ?? 0} filled out of {reqStats.totalTargetPositions ?? 0} target openings across {reqStats.totalRequests ?? requests.length} requisitions
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">By Status</span>
              {(reqStats.byStatus || []).map((st) => (
                <div key={st.status} className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="text-navy-900 dark:text-slate-200">{st.status}</span>
                  <span className="font-mono font-bold">{st.count}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">By Priority</span>
              {(reqStats.byPriority || []).map((pr) => (
                <div key={pr.priority} className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="text-navy-900 dark:text-slate-200">{pr.priority}</span>
                  <span className="font-mono font-bold">{pr.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 10 */}
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-6 card-reflective space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>10. Offers, Placements & Governance Audit</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Strict separation between Offer Extended and finalized Hired status alongside approval outcomes
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 card-interactive">
              <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Offer Extended</span>
              <span className="text-xl font-extrabold font-mono text-emerald-900 dark:text-emerald-200">
                <AnimatedMetricValue value={offerStats.offerExtendedCount ?? 0} />
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 card-interactive">
              <span className="text-xs uppercase font-bold text-brand-700 dark:text-brand-300 block">Hired</span>
              <span className="text-xl font-extrabold font-mono text-brand-900 dark:text-brand-200">
                <AnimatedMetricValue value={offerStats.hiredCount ?? 0} />
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-accent-50 dark:bg-accent-950/40 border border-accent-200 dark:border-accent-800 card-interactive">
              <span className="text-xs uppercase font-bold text-accent-700 dark:text-accent-300 block">Interviews</span>
              <span className="text-xl font-extrabold font-mono text-accent-900 dark:text-accent-200">
                <AnimatedMetricValue value={offerStats.scheduledInterviewsCount ?? 0} />
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 card-interactive">
              <span className="text-xs uppercase font-bold text-slate-500 block">Rejected</span>
              <span className="text-xl font-extrabold font-mono text-navy-900 dark:text-white">
                <AnimatedMetricValue value={offerStats.rejectedCount ?? 0} />
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            <Badge variant="warning" size="sm">Approvals Pending: {offerStats.approvalsPending ?? 0}</Badge>
            <Badge variant="success" size="sm">Approved: {offerStats.approvalsApproved ?? 0}</Badge>
            <Badge variant="danger" size="sm">Rejected: {offerStats.approvalsRejected ?? 0}</Badge>
            <Badge variant="neutral" size="sm">Changes Requested: {offerStats.approvalsChangesRequested ?? 0}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
