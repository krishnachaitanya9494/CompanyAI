// Import React and hooks for tracking real offers, placements, and late-stage candidate progressions.
import React, { useMemo, useState } from 'react';

// Import common Badge component and AnimatedMetricValue.
import { Badge } from '../components/common/Badge';
import { AnimatedMetricValue } from '../components/layout/MetricCard';

// Import lucide-react icons.
import { Award, CheckCircle2, Briefcase, MapPin, Calendar, ArrowRight, UserCheck, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

// Export PlacementsPage rendering grounded offer and placement milestones from SQLite candidates.
export const PlacementsPage = ({
  candidates = [],
  jobs = [],
  onSelectCandidate,
  onUpdateCandidate,
}) => {
  // Tab state separating finalized offers/placements from active final-round pipeline candidates.
  const [viewFilter, setViewFilter] = useState('offers');
  // Progressive disclosure toggle for long placement/finalist lists.
  const [showAll, setShowAll] = useState(false);

  // Filter candidates holding formal Offers or Hired statuses.
  const offeredOrHired = useMemo(() => {
    return candidates.filter((c) =>
      ['Offer Extended', 'Offered', 'Hired'].includes(c.status || c.stage)
    );
  }, [candidates]);

  // Filter candidates in advanced final selection rounds nearing placement.
  const finalRoundPipeline = useMemo(() => {
    return candidates.filter((c) =>
      ['Shortlisted', 'Technical Round 1', 'Technical Round 2', 'Technical Rounds', 'Manager Round', 'HR Discussion'].includes(
        c.status || c.stage
      )
    );
  }, [candidates]);

  // Active display list matching selected filter tab.
  const displayList = viewFilter === 'offers' ? offeredOrHired : finalRoundPipeline;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Placements & Offers</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {offeredOrHired.length} Extended / Placed
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track formal offer approvals, onboarding readiness, and late-stage finalist progressions from SQLite
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-1 rounded-xl text-xs">
          <button
            onClick={() => setViewFilter('offers')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              viewFilter === 'offers'
                ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900'
            }`}
          >
            Offers & Hired ({offeredOrHired.length})
          </button>
          <button
            onClick={() => setViewFilter('finalists')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              viewFilter === 'finalists'
                ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900'
            }`}
          >
            Finalists Pipeline ({finalRoundPipeline.length})
          </button>
        </div>
      </div>

      {/* Placement Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-subtle card-interactive">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Active Offers / Hired
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
            <AnimatedMetricValue value={offeredOrHired.length} />
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Verified in SQLite pipeline</span>
        </div>

        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-subtle card-interactive">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Final Round Candidates
          </span>
          <span className="text-2xl font-extrabold text-brand-700 dark:text-brand-400 font-mono mt-1 block">
            <AnimatedMetricValue value={finalRoundPipeline.length} />
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Shortlisted / Technical / Manager</span>
        </div>

        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-subtle card-interactive">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Open Client Requisitions
          </span>
          <span className="text-2xl font-extrabold text-navy-900 dark:text-white font-mono mt-1 block">
            <AnimatedMetricValue value={jobs.filter((j) => (j.status || '').toLowerCase() === 'active' || (j.status || '').toLowerCase() === 'open').length} />
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Across {jobs.length} total JDs</span>
        </div>
      </div>

      {/* Candidate Placement Cards */}
      {displayList.length === 0 ? (
        <div className="p-12 bg-white dark:bg-surface-darkCard border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400">
          No candidate records currently match this placement stage in the database.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(showAll ? displayList : displayList.slice(0, 6)).map((cand) => (
              <div
                key={cand.id}
                className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card card-interactive flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold">
                        {(cand.name || 'C').charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-navy-900 dark:text-white">{cand.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{cand.currentRole}</p>
                      </div>
                    </div>

                    <Badge variant={viewFilter === 'offers' ? 'success' : 'brand'} size="sm">
                      {cand.status || cand.stage}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" /> {cand.experienceYears ?? '—'} Years
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {cand.location || 'Not specified'}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Availability: {cand.availability || 'Not specified'}
                    </span>
                  </div>

                {cand.scheduledInterview && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Latest Interview Milestone
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy-900 dark:text-white">
                        {cand.scheduledInterview.round}
                      </span>
                      <span className="text-[11px] text-slate-500">{cand.scheduledInterview.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Panelist: {cand.scheduledInterview.interviewer}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {(cand.primarySkills || []).slice(0, 4).map((sk, idx) => (
                    <Badge key={idx} variant="neutral" size="xs">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-surface-darkBorder">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Verified Resume Record
                </span>

                <button
                  onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                >
                  <span>Manage Record</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              </div>
            ))}
          </div>

          {displayList.length > 6 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {showAll ? displayList.length : Math.min(6, displayList.length)} of {displayList.length} candidates
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
                    <span>Show More ({displayList.length - 6} more)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
