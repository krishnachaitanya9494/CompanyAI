// Import React for JSX structure.
import React from 'react';

// Import MetricCard for KPI stats displays.
import { MetricCard } from '../components/layout/MetricCard';

// Import PipelineFunnel for stage visualization.
import { PipelineFunnel } from '../components/dashboard/PipelineFunnel';

// Import Badge component for status tags.
import { Badge } from '../components/common/Badge';

// Import icons from lucide-react.
import { Users, FileText, Briefcase, GitPullRequest, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

// Export DashboardPage component presenting recruitment KPIs, pipeline stages, and active requisitions.
export const DashboardPage = ({
  candidates = [],
  jobs = [],
  requests = [],
  dashboard = null,
  onNavigateTab,
  onSelectCandidate,
  onSelectJob,
}) => {
  // Aggregate candidate counts across pipeline stages dynamically.
  const dynamicStages = [
    {
      stage: 'Screened',
      count: candidates.filter((c) => !c.status || c.status === 'Screened' || c.status === 'New').length,
      percentage: Math.round((candidates.filter((c) => !c.status || c.status === 'Screened' || c.status === 'New').length / Math.max(candidates.length, 1)) * 100),
      color: 'bg-blue-500',
    },
    {
      stage: 'Shortlisted',
      count: candidates.filter((c) => c.status === 'Shortlisted').length,
      percentage: Math.round((candidates.filter((c) => c.status === 'Shortlisted').length / Math.max(candidates.length, 1)) * 100),
      color: 'bg-indigo-500',
    },
    {
      stage: 'Technical Rounds',
      count: candidates.filter((c) => c.status && (c.status.includes('Technical') || c.status.includes('Round 1'))).length,
      percentage: Math.round((candidates.filter((c) => c.status && (c.status.includes('Technical') || c.status.includes('Round 1'))).length / Math.max(candidates.length, 1)) * 100),
      color: 'bg-amber-500',
    },
    {
      stage: 'Manager Round',
      count: candidates.filter((c) => c.status && (c.status.includes('Manager') || c.status.includes('Round 2'))).length,
      percentage: Math.round((candidates.filter((c) => c.status && (c.status.includes('Manager') || c.status.includes('Round 2'))).length / Math.max(candidates.length, 1)) * 100),
      color: 'bg-purple-500',
    },
    {
      stage: 'Offer Extended',
      count: candidates.filter((c) => c.status === 'Offer Extended').length,
      percentage: Math.round((candidates.filter((c) => c.status === 'Offer Extended').length / Math.max(candidates.length, 1)) * 100),
      color: 'bg-emerald-500',
    },
  ];

  // Render dashboard layout.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* KPI Metric Cards 4-Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Candidates KPI */}
        <MetricCard
          title="Total Candidates"
          value={candidates.length || 178}
          subvalue="Indexed talent profiles"
          icon={Users}
          badgeText="Verified"
          badgeVariant="brand"
          onClick={() => onNavigateTab('candidates')}
        />

        {/* Total Resumes KPI */}
        <MetricCard
          title="Resume Library"
          value={224}
          subvalue="Parsed & vector-indexed"
          icon={FileText}
          badgeText="2048-dim"
          badgeVariant="neutral"
          onClick={() => onNavigateTab('candidates')}
        />

        {/* Active Job Descriptions KPI */}
        <MetricCard
          title="Active Positions"
          value={jobs.length || 7}
          subvalue="Enterprise requisitions"
          icon={Briefcase}
          badgeText="Open"
          badgeVariant="brand"
          onClick={() => onNavigateTab('jobs')}
        />

        {/* Hiring Requisitions KPI */}
        <MetricCard
          title="Hiring Requisitions"
          value={requests.length || 5}
          subvalue="SLA tracked workflows"
          icon={GitPullRequest}
          badgeText="Active"
          badgeVariant="neutral"
          onClick={() => onNavigateTab('requests')}
        />
      </div>

      {/* Two-Column Layout: Pipeline Funnel & Active Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recruitment Pipeline Funnel */}
        <PipelineFunnel stages={dynamicStages} />

        {/* Active Job Requisitions Overview */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-navy-900 tracking-tight">
                Active Job Requisitions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Priority roles with candidate semantic matching and evidence verification
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('jobs')}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Job List Preview */}
          <div className="space-y-3">
            {jobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                onClick={() => onSelectJob && onSelectJob(job.id)}
                className="p-3.5 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-navy-950 group-hover:text-brand-700 transition-colors">
                      {job.title}
                    </h4>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                      {job.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {job.location} • {job.minYears ? `${job.minYears}+ Years` : '5+ Years'} • {(job.requiredSkills || []).slice(0, 3).join(', ')}
                  </p>
                </div>

                <div className="text-xs font-semibold text-slate-400 group-hover:text-navy-900 transition-colors flex items-center gap-1">
                  <span>Match</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>

          {/* Quick AI Assistant Card */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-brand-50/80 to-slate-50 border border-brand-200/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-subtle">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-navy-950">Nemotron Talent Intelligence</h5>
                <p className="text-[11px] text-slate-500">Query all 178+ candidates using natural language</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('assistant')}
              className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg shadow-subtle transition-all"
            >
              Ask AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
