// Import React and hooks for progressive disclosure and client-side search/filter of JD collections.
import React, { useState, useMemo, useEffect } from 'react';

// Import icons from lucide-react.
import { Briefcase, MapPin, Sparkles, ChevronRight, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { CustomSelect } from '../common/CustomSelect';

// Number of job descriptions shown by default and added per expansion step.
const JOBS_DEFAULT_VISIBLE = 5;
const JOBS_STEP = 5;

// Export JobList component presenting JD cards with progressive disclosure, search/filter, and Dark mode support.
export const JobList = ({
  jobs = [],
  selectedJobId,
  onSelectJob,
  onAnalyzeJob,
  onUpdateJob,
}) => {
  // Progressive disclosure limit: starts at 5, increments by 5 per click.
  const [visibleLimit, setVisibleLimit] = useState(JOBS_DEFAULT_VISIBLE);
  // Local quick-filter search & status filter (never restricts backend collection).
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Reset limit back to initial 5 when user searches or filters.
  useEffect(() => {
    setVisibleLimit(JOBS_DEFAULT_VISIBLE);
  }, [searchQuery, statusFilter]);

  // Available status options including Open/Active case variants.
  const statusOptions = ['Active', 'Open', 'Under Review', 'Draft', 'On Hold', 'Closed'];

  // Filter jobs client-side while preserving full backend list order.
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== 'All' && (job.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (q) {
        const hay = `${job.title || ''} ${job.jdCode || ''} ${job.department || ''} ${job.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, searchQuery, statusFilter]);

  // Progressive slice calculation: reveals 5 more per click.
  const visibleJobs = filteredJobs.slice(0, visibleLimit);
  const hasMore = visibleLimit < filteredJobs.length;
  const remainingCount = Math.max(0, filteredJobs.length - visibleLimit);
  const nextStep = Math.min(JOBS_STEP, remainingCount);

  // Helper to style status badge with Light & Dark contrast.
  const getStatusStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
      case 'open':
        return 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800';
      case 'under review':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  // Render job listing container with search bar, 5-card default slice, and Show More/Less toggle.
  return (
    <div className="space-y-3">
      {/* Compact JD Search & Status Filter Strip */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-surface-darkCard p-2.5 rounded-2xl border border-slate-200/80 dark:border-surface-darkBorder shadow-subtle">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter JDs by title, code, city..."
            aria-label="Filter job descriptions"
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter jobs by status"
          size="sm"
          className="flex-shrink-0"
          buttonClassName="rounded-xl bg-slate-50 dark:bg-slate-800/80"
          options={[
            { value: 'All', label: `All Statuses (${jobs.length})` },
            ...statusOptions.map((opt) => ({ value: opt, label: opt })),
          ]}
        />
      </div>

      {/* Empty filter result notice */}
      {visibleJobs.length === 0 ? (
        <div className="p-8 bg-white dark:bg-surface-darkCard border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-2xl text-center text-xs text-slate-500 dark:text-slate-400">
          No job descriptions match the current filter.
        </div>
      ) : (
        visibleJobs.map((job, idx) => {
          // Check if current job is selected in master-detail view.
          const isSelected = selectedJobId === job.id;
          // Normalize status case for select dropdown binding.
          const normalizedStatus =
            statusOptions.find((opt) => opt.toLowerCase() === (job.status || '').toLowerCase()) || job.status || 'Active';

          return (
            <div
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className={`p-5 bg-white dark:bg-surface-darkCard rounded-2xl border card-interactive cursor-pointer shadow-subtle hover:shadow-card ${
                idx >= JOBS_DEFAULT_VISIBLE ? 'animate-fadeIn' : ''
              } ${
                isSelected
                  ? 'border-brand-500 ring-2 ring-brand-500/15 dark:border-brand-500'
                  : 'border-slate-200/80 dark:border-surface-darkBorder hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {/* Header: JD code badge, title, customizable status dropdown */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                      {job.jdCode}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      v{job.version || 1}
                    </span>
                    {job.department && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        {job.department}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white group-hover:text-brand-700 transition-colors">
                    {job.title}
                  </h3>
                </div>

                {/* Status dropdown */}
                <div onClick={(e) => e.stopPropagation()} className="relative inline-block flex-shrink-0">
                  <CustomSelect
                    value={normalizedStatus}
                    onChange={(nextStatus) => {
                      if (onUpdateJob) {
                        onUpdateJob({ ...job, status: nextStatus });
                      }
                    }}
                    ariaLabel={`Status for ${job.title}`}
                    size="sm"
                    buttonClassName={`!py-1 !px-2.5 !rounded-lg !text-[13px] !font-semibold ${getStatusStyle(
                      normalizedStatus
                    )}`}
                    menuClassName="right-0 left-auto"
                    options={statusOptions.map((opt) => ({ value: opt, label: opt }))}
                  />
                </div>
              </div>

              {/* Description excerpt */}
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                {job.description}
              </p>

              {/* Metadata and required skills pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-surface-darkBorder text-xs">
                <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {job.location || 'Not specified'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {job.experienceRequired || 'Experience N/A'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onAnalyzeJob(job)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800 rounded-xl text-xs font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Analyze JD</span>
                  </button>

                  <button
                    onClick={() => onSelectJob(job.id)}
                    aria-label={`Select ${job.title}`}
                    className="p-1 text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Progressive Disclosure Controls: Show More (+5 more) / Show Less */}
      {(hasMore || visibleLimit > JOBS_DEFAULT_VISIBLE) && (
        <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            Showing {visibleJobs.length} of {filteredJobs.length} positions
          </span>
          <div className="flex items-center gap-2">
            {visibleLimit > JOBS_DEFAULT_VISIBLE && (
              <button
                type="button"
                onClick={() => setVisibleLimit(JOBS_DEFAULT_VISIBLE)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-darkBg dark:hover:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-[0.99]"
              >
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Show Less</span>
              </button>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + JOBS_STEP)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 dark:hover:border-brand-600 text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle transition-all active:scale-[0.99]"
              >
                <ChevronDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Show More (+{nextStep} more)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
