// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import { Briefcase, MapPin, Sparkles, ChevronRight, ChevronDown } from 'lucide-react';

// Export JobList component presenting JD cards and metrics with customizable status options.
export const JobList = ({
  jobs = [],
  selectedJobId,
  onSelectJob,
  onAnalyzeJob,
  onUpdateJob,
}) => {
  // Available status options.
  const statusOptions = ['Active', 'Under Review', 'Draft', 'On Hold', 'Closed'];

  // Helper to style status badge.
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'Under Review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  // Render job listing list.
  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        // Check if current job is selected in master-detail view.
        const isSelected = selectedJobId === job.id;

        return (
          <div
            key={job.id}
            onClick={() => onSelectJob(job.id)}
            className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-subtle hover:shadow-card ${
              isSelected
                ? 'border-brand-500 ring-2 ring-brand-500/10'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            {/* Header: JD code badge, title, customizable status dropdown */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                    {job.jdCode}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{job.department}</span>
                </div>
                <h3 className="text-sm font-bold text-navy-900 group-hover:text-brand-700 transition-colors">
                  {job.title}
                </h3>
              </div>

              {/* Status dropdown */}
              <div onClick={(e) => e.stopPropagation()} className="relative inline-block">
                <select
                  value={job.status}
                  onChange={(e) => {
                    if (onUpdateJob) {
                      onUpdateJob({ ...job, status: e.target.value });
                    }
                  }}
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${getStatusStyle(
                    job.status
                  )}`}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt} className="bg-white text-navy-900 font-normal">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-1.5 top-1.5 pointer-events-none opacity-60" />
              </div>
            </div>

            {/* Description excerpt */}
            <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
              {job.description}
            </p>

            {/* Metadata and required skills pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {job.experienceRequired}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onAnalyzeJob(job)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 rounded-xl text-xs font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Analyze JD</span>
                </button>

                <button
                  onClick={() => onSelectJob(job.id)}
                  className="p-1 text-slate-400 hover:text-navy-900 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
