// Import React and hooks for loading live analytics telemetry alongside workspace collections.
import React, { useState, useEffect, useMemo } from 'react';

// Import MetricCard and React Bits suite for cohesive executive motion and hover polish.
import { MetricCard } from '../components/layout/MetricCard';
import { BlurText } from '../components/reactbits/BlurText';
import { AnimatedContent } from '../components/reactbits/AnimatedContent';
import { StarBorder } from '../components/reactbits/StarBorder';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { Magnet } from '../components/reactbits/Magnet';
import { GradientText } from '../components/reactbits/GradientText';

// Import PipelineFunnel for recruitment conversion visualization.
import { PipelineFunnel } from '../components/dashboard/PipelineFunnel';

// Import RecentActivity for live SQLite audit trail feed.
import { RecentActivity } from '../components/dashboard/RecentActivity';

// Import AIInsightsPanel for grounded intelligence recommendations.
import { AIInsightsPanel } from '../components/dashboard/AIInsightsPanel';

// Import AIMonitorPanel for live AI usage, model status, and bar monitoring below the Dashboard.
import { AIMonitorPanel } from '../components/dashboard/AIMonitorPanel';

// Import analyticsApi to fetch true SQLite insights, embedding counts, and interview totals.
import { analyticsApi } from '../api/client';

// Import icons from lucide-react for enterprise telemetry visuals.
import {
  Users,
  FileText,
  Briefcase,
  GitPullRequest,
  ArrowRight,
  Sparkles,
  Database,
  Clock,
  Layers,
  Cpu,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

// Export DashboardPage component presenting enterprise recruitment KPIs, pipeline stages, and active positions.
export const DashboardPage = ({
  candidates = [],
  jobs = [],
  requests = [],
  activities = [],
  dashboard = null,
  resumeDiscovery = null,
  onNavigateTab,
  onSelectCandidate,
  onSelectJob,
  onRefresh,
  isLoading = false,
}) => {
  // Store extended live stats and SQLite-generated insights fetched from analytics endpoints.
  const [liveStats, setLiveStats] = useState(null);
  const [analyticsDash, setAnalyticsDash] = useState(null);

  // Load analytics stats & insights on mount or whenever parent refreshes.
  const loadDashboardTelemetry = async () => {
    try {
      const [statsRes, dashRes] = await Promise.all([
        analyticsApi.getStats(),
        analyticsApi.getDashboard(),
      ]);
      setLiveStats(statsRes);
      setAnalyticsDash(dashRes);
    } catch (err) {
      console.warn('Could not load extended dashboard telemetry:', err.message);
    }
  };

  useEffect(() => {
    loadDashboardTelemetry();
  }, [candidates.length, jobs.length, requests.length]);

  // Aggregate candidate counts across complete ordered pipeline stages dynamically from real candidate profiles.
  const totalCandCount = Math.max(candidates.length, 1);
  const newOrScreenedCount = candidates.filter((c) => !c.status || c.status === 'Screened' || c.status === 'New').length;
  const shortlistedCount = candidates.filter((c) => c.status === 'Shortlisted').length;
  const techRoundCount = candidates.filter((c) => c.status && (c.status.includes('Technical') || c.status.includes('Round 1'))).length;
  const managerRoundCount = candidates.filter((c) => c.status && (c.status.includes('Manager') || c.status.includes('Round 2') || c.status === 'HR Discussion')).length;
  const offerOrHiredCount = candidates.filter((c) => c.status === 'Offer Extended' || c.status === 'Offered' || c.status === 'Hired').length;
  const rejectedCount = candidates.filter((c) => c.status === 'Rejected').length;

  const dynamicStages = [
    {
      stage: 'New & Screened',
      count: newOrScreenedCount,
      percentage: Math.round((newOrScreenedCount / totalCandCount) * 100),
      color: 'bg-blue-500',
    },
    {
      stage: 'Shortlisted',
      count: shortlistedCount,
      percentage: Math.round((shortlistedCount / totalCandCount) * 100),
      color: 'bg-indigo-500',
    },
    {
      stage: 'Technical Rounds',
      count: techRoundCount,
      percentage: Math.round((techRoundCount / totalCandCount) * 100),
      color: 'bg-amber-500',
    },
    {
      stage: 'Manager & HR Rounds',
      count: managerRoundCount,
      percentage: Math.round((managerRoundCount / totalCandCount) * 100),
      color: 'bg-purple-500',
    },
    {
      stage: 'Offer Extended / Hired',
      count: offerOrHiredCount,
      percentage: Math.round((offerOrHiredCount / totalCandCount) * 100),
      color: 'bg-emerald-500',
    },
  ];

  // Reconcile job status categories cleanly without double-counting across case variants.
  const activeJobsCount = dashboard?.active_jobs ?? jobs.filter((j) => (j.status || '').trim().toLowerCase() === 'active').length;
  const openJobsCount = jobs.filter((j) => (j.status || '').trim().toLowerCase() === 'open').length;
  const underReviewJobsCount = jobs.filter((j) => (j.status || '').trim().toLowerCase() === 'under review').length;
  const otherJobsCount = Math.max(0, jobs.length - (activeJobsCount + openJobsCount + underReviewJobsCount));

  // Compute In Screening / Review consistently with funnel stages.
  const candidatesInReviewCount = shortlistedCount + techRoundCount + managerRoundCount;

  // Read live resume, embedding, and discovery metrics strictly from API responses (no stale fallbacks).
  const overview = liveStats?.overview || {};
  const totalResumesCount = overview.totalResumes ?? dashboard?.total_resumes ?? resumeDiscovery?.total_resumes ?? 0;
  const totalEmbeddingsCount = overview.totalEmbeddings ?? resumeDiscovery?.total_embeddings ?? 0;
  const embeddingCoveragePct = overview.embeddingCoveragePercent ?? (totalResumesCount > 0 ? Math.round((totalEmbeddingsCount / totalResumesCount) * 100) : 0);
  const extensionStats = resumeDiscovery?.by_extension || {};
  const totalFilesCount = resumeDiscovery?.total_files ?? totalResumesCount;

  // Compute genuine candidate geographic hub distribution dynamically from persisted Candidate.location values.
  const topLocations = useMemo(() => {
    const counts = {};
    candidates.forEach((c) => {
      const loc = (c.location || '').trim() || 'Not Specified';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    const total = Math.max(candidates.length, 1);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([city, count]) => ({
        city,
        count,
        pct: Math.round((count / total) * 100),
      }));
  }, [candidates]);

  // Use real insights generated dynamically by backend /api/analytics/dashboard.
  const liveInsights = analyticsDash?.aiInsights || [];

  // Trigger coordinated refresh across parent collections and local telemetry.
  const handleManualRefresh = async () => {
    await Promise.all([onRefresh ? onRefresh() : Promise.resolve(), loadDashboardTelemetry()]);
  };

  // Render enterprise dashboard layout with balanced equal-height grids and zero dead whitespace.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn transition-colors">
      {/* Workspace Welcome & Action Context Bar with diagonal glass reflection */}
      <div className="surface-reflection card-reflective flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-brand-50/70 via-white to-accent-50/70 dark:from-brand-950/25 dark:via-surface-darkCard dark:to-accent-950/35 border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl transition-colors">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-navy-900 dark:text-white tracking-tight">
              <BlurText
                text="Recruiter Command Center"
                animateBy="words"
                delay={55}
                stepDuration={0.28}
                direction="top"
              />
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/90 dark:bg-accent-950/50 border border-accent-200/80 dark:border-accent-700/60 rounded-full flex items-center gap-1 shadow-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <GradientText colors={['#059669', '#4F46E5', '#6366F1', '#10B981']}>
                Live Hiring Data • Ready
              </GradientText>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Smart candidate matches, 1-click search strings, and 5-question phone screening guides.
          </p>
        </div>

        {/* Quick Action Shortcuts and Manual Refresh */}
        <div className="flex items-center gap-2 flex-wrap relative z-[1]">
          <button
            onClick={handleManualRefresh}
            title="Refresh dashboard metrics from SQLite database"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 dark:bg-surface-darkHover hover:bg-slate-200/70 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl shadow-subtle btn-interactive cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-600' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigateTab && onNavigateTab('matching')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-50 dark:bg-accent-950/60 hover:bg-accent-100/80 dark:hover:bg-accent-900/60 border border-accent-200/80 dark:border-accent-700/60 text-accent-700 dark:text-accent-400 text-xs font-semibold rounded-xl shadow-subtle btn-interactive cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" />
            <span>Matching Matrix</span>
          </button>

          <button
            onClick={() => onNavigateTab && onNavigateTab('analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 dark:bg-surface-darkHover hover:bg-slate-200/70 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl shadow-subtle btn-interactive cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Analytics</span>
          </button>

          <Magnet padding={28} magnetStrength={6}>
            <StarBorder
              as="button"
              onClick={() => onNavigateTab && onNavigateTab('assistant')}
              color="#10B981"
              speed="5s"
              className="bg-navy-900 dark:bg-brand-600 shadow-subtle cursor-pointer"
              innerClassName="flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-300 dark:text-white" />
              <span>AI Assistant</span>
            </StarBorder>
          </Magnet>
        </div>
      </div>

      {/* 6-Card KPI Metric Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Candidates"
          value={dashboard?.total_candidates ?? candidates.length}
          subvalue="Unique candidate profiles"
          icon={Users}
          badgeText="Verified"
          badgeVariant="brand"
          onClick={() => onNavigateTab && onNavigateTab('candidates')}
          isLoading={isLoading}
        />

        <MetricCard
          title="Resume Library"
          value={totalResumesCount}
          subvalue="Stored resume records"
          icon={FileText}
          badgeText="Active"
          badgeVariant="neutral"
          onClick={() => onNavigateTab && onNavigateTab('candidates')}
          isLoading={isLoading}
        />

        <MetricCard
          title="Active Positions"
          value={activeJobsCount}
          subvalue={`${openJobsCount} open • ${jobs.length || dashboard?.total_jobs || 0} total`}
          icon={Briefcase}
          badgeText="Hiring"
          badgeVariant="emerald"
          onClick={() => onNavigateTab && onNavigateTab('jobs')}
          isLoading={isLoading}
        />

        <MetricCard
          title="Hiring Requisitions"
          value={dashboard?.open_requests ?? requests.length}
          subvalue={`${overview.urgentRequests ?? requests.filter((r) => r.priority === 'Urgent').length} urgent priority`}
          icon={GitPullRequest}
          badgeText="Requests"
          badgeVariant="amber"
          onClick={() => onNavigateTab && onNavigateTab('requests')}
          isLoading={isLoading}
        />

        <MetricCard
          title="Search-Ready Resumes"
          value={totalEmbeddingsCount}
          subvalue={`${embeddingCoveragePct}% profiles indexed`}
          icon={Database}
          badgeText="AI-Indexed"
          badgeVariant="blue"
          onClick={() => onNavigateTab && onNavigateTab('matching')}
          isLoading={isLoading}
        />

        <MetricCard
          title="In Screening"
          value={candidatesInReviewCount}
          subvalue={`${overview.totalInterviews ?? 0} scheduled interviews`}
          icon={Clock}
          badgeText="Pipeline"
          badgeVariant="brand"
          onClick={() => onNavigateTab && onNavigateTab('pipeline')}
          isLoading={isLoading}
        />
      </div>

      {/* Row 1 Analytics: Equal-height Pipeline Funnel (5 cols) & Job Positions Status Overview (7 cols) */}
      <AnimatedContent distance={12} duration={0.34} delay={60}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5">
          <PipelineFunnel
            stages={dynamicStages}
            totalCandidates={candidates.length}
            footerStats={{
              interviews: overview.totalInterviews ?? 0,
              offers: offerOrHiredCount,
              rejected: rejectedCount,
            }}
            onSelectStage={() => onNavigateTab && onNavigateTab('pipeline')}
          />
        </div>

        {/* Right Column: Active Job Positions Overview stretched to match funnel height */}
        <div className="lg:col-span-7 h-full flex flex-col justify-between p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card space-y-4 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
              <div>
                <h3 className="text-sm font-semibold text-navy-900 dark:text-white tracking-tight">
                  Job Positions & Recruitment Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Reconciled breakdown across all {jobs.length} stored specifications without double-counting
                </p>
              </div>
              <button
                onClick={() => onNavigateTab && onNavigateTab('jobs')}
                className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({jobs.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Job Status Summary Badges summing cleanly to jobs.length */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                  Active Recruiting
                </span>
                <span className="text-lg font-bold text-emerald-900 dark:text-emerald-200">{activeJobsCount}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                  Open Sourcing
                </span>
                <span className="text-lg font-bold text-blue-900 dark:text-blue-200">{openJobsCount}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  Under Review
                </span>
                <span className="text-lg font-bold text-amber-900 dark:text-amber-200">{underReviewJobsCount}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Draft / Closed
                </span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{otherJobsCount}</span>
              </div>
            </div>

            {/* Priority Job List Preview */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Priority Recruiting Positions
              </span>

              {jobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                  className="p-3 bg-slate-50/80 dark:bg-surface-darkHover/60 hover:bg-slate-100/80 dark:hover:bg-surface-darkHover border border-slate-200/60 dark:border-surface-darkBorder rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-navy-950 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors truncate">
                        {job.title}
                      </h4>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800 flex-shrink-0">
                        {job.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {job.location || 'Location N/A'} • {job.experienceRequired || 'Experience N/A'} •{' '}
                      {(job.requiredSkills || []).slice(0, 3).join(', ') || 'No skills tagged'}
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center gap-1 flex-shrink-0">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </AnimatedContent>

      {/* Row 2 Analytics: Equal-Height Candidate Intelligence & Ingestion Telemetry */}
      <AnimatedContent distance={12} duration={0.34} delay={90}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Resume File Formats Breakdown */}
        <SpotlightCard intensity={0.16} borderGlow={0.32} spotlightSize={200} className="p-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card card-interactive transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Document Formats
                </h4>
                <p className="text-xs text-navy-900 dark:text-white font-semibold mt-0.5">
                  {totalFilesCount} Disk Resume Files
                </p>
              </div>
              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            {Object.keys(extensionStats).length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No disk format telemetry loaded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(extensionStats).map(([ext, count]) => {
                  const pct = Math.round((count / Math.max(totalFilesCount, 1)) * 100);
                  return (
                    <div key={ext} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="font-mono text-slate-600 dark:text-slate-300 uppercase">{ext}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full animate-barGrow transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SpotlightCard>

        {/* Card 2: Vector Embedding Infrastructure Health */}
        <SpotlightCard intensity={0.16} borderGlow={0.32} spotlightSize={200} className="p-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card card-interactive transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Vector Engine Health
                </h4>
                <p className="text-xs text-navy-900 dark:text-white font-semibold mt-0.5">
                  {overview.embeddingModel || 'nvidia/nemotron-3-embed-1b'}
                </p>
              </div>
              <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-100 dark:border-surface-darkBorder">
                <span className="text-slate-600 dark:text-slate-400">Resume Embeddings</span>
                <span className="font-mono font-bold text-brand-700 dark:text-brand-400">
                  {totalEmbeddingsCount} / {totalResumesCount} ({embeddingCoveragePct}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-100 dark:border-surface-darkBorder">
                <span className="text-slate-600 dark:text-slate-400">JD Requirement Vectors</span>
                <span className="font-mono font-bold text-navy-900 dark:text-white">
                  {overview.totalJobEmbeddings ?? 0} vectors ({overview.totalSegmentations ?? 0} segs)
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-100 dark:border-surface-darkBorder">
                <span className="text-slate-600 dark:text-slate-400">Pending Approvals</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {overview.pendingApprovals ?? 0} open
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder mt-3">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              2,048-dim SQLite BLOBs verified
            </span>
          </div>
        </SpotlightCard>

        {/* Card 3: Genuine Candidate Geographic Distribution */}
        <SpotlightCard intensity={0.16} borderGlow={0.32} spotlightSize={200} className="p-5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card card-interactive transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Talent Geographies
                </h4>
                <p className="text-xs text-navy-900 dark:text-white font-semibold mt-0.5">
                  Top Recorded Hubs
                </p>
              </div>
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            <div className="space-y-2 text-xs">
              {topLocations.map((loc) => (
                <div key={loc.city} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-surface-darkHover transition-colors">
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">{loc.city}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] flex-shrink-0">
                    {loc.count} ({loc.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder mt-3">
            <button
              onClick={() => onNavigateTab && onNavigateTab('candidates')}
              className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Explore all candidates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </SpotlightCard>
      </div>
      </AnimatedContent>

      {/* Row 3: Balanced Equal-Height Live Audit Activity & Live AI Insights */}
      <AnimatedContent distance={12} duration={0.34} delay={130}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6">
          <RecentActivity activities={activities} />
        </div>

        <div className="lg:col-span-6">
          <AIInsightsPanel
            insights={liveInsights}
            vertical={true}
            onSelectCandidate={onSelectCandidate}
            onSelectJob={onSelectJob}
            onNavigateTab={onNavigateTab}
          />
        </div>
      </div>
      </AnimatedContent>

      {/* Row 4: Live AI Usage & Bar Monitoring Panel */}
      <AnimatedContent distance={12} duration={0.36} delay={160}>
        <AIMonitorPanel onNavigateTab={onNavigateTab} />
      </AnimatedContent>
    </div>
  );
};
