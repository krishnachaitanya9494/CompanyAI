// Import React for JSX structure.
import React from 'react';

// Import Badge component for skills and status pills.
import { Badge } from '../common/Badge';

// Import MatchingCandidates subcomponent.
import { MatchingCandidates } from './MatchingCandidates';

// Import icons from lucide-react.
import {
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  FileText,
  CheckCircle2,
  ListOrdered,
  Users,
  ChevronDown
} from 'lucide-react';

// Export JobDetail component for displaying deep specifications and matched applicants with customizable status.
export const JobDetail = ({
  job,
  matchingCandidates = [],
  onAnalyzeJob,
  onSelectCandidate,
  onUpdateJob,
}) => {
  // If no job is selected, show placeholder instruction.
  if (!job) {
    return (
      <div className="p-12 bg-white border border-slate-200/80 rounded-2xl shadow-card text-center text-slate-400">
        <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
        <p className="text-sm font-medium text-navy-900">Select a Job Description</p>
        <p className="text-xs text-slate-500 mt-1">
          Click any job on the left to inspect requirements, AI analysis, and matched applicants.
        </p>
      </div>
    );
  }

  // Available job status options.
  const jobStatusOptions = ['Active', 'Under Review', 'Draft', 'On Hold', 'Closed'];

  // Helper to style job status badge dropdown.
  const getJobStatusStyle = (status) => {
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

  // Render job detail view.
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-card p-6 space-y-6">
      {/* Header section with title, customizable status dropdown, and analyze trigger */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
              {job.jdCode}
            </span>
            <span className="text-xs text-slate-500 font-medium">{job.department}</span>

            {/* Interactive Job Status Dropdown */}
            <div className="relative inline-block ml-2">
              <select
                value={job.status}
                onChange={(e) => {
                  if (onUpdateJob) {
                    onUpdateJob({ ...job, status: e.target.value });
                  }
                }}
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${getJobStatusStyle(
                  job.status
                )}`}
              >
                {jobStatusOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-white text-navy-900 font-normal">
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1.5 pointer-events-none opacity-60" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-navy-900 tracking-tight">{job.title}</h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              {job.experienceRequired}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {job.sourceFilename}
            </span>
          </div>
        </div>

        {/* AI Analyze JD Button */}
        <button
          onClick={() => onAnalyzeJob(job)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/90 rounded-xl text-xs font-semibold shadow-subtle transition-all flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-brand-600" />
          <span>Analyze JD with Nemotron</span>
        </button>
      </div>

      {/* Structured Job Description Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Job Summary & Scope
        </h4>
        <p className="text-xs text-navy-900 leading-relaxed bg-surface-50/50 p-4 border border-slate-100 rounded-xl">
          {job.description}
        </p>
      </div>

      {/* Skills requirements breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Required Competencies
        </h4>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-slate-500 font-medium block mb-1.5">Mandatory Skills:</span>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map((sk, idx) => (
                <Badge key={idx} variant="brand" size="sm">
                  {sk}
                </Badge>
              ))}
            </div>
          </div>

          {job.preferredSkills && (
            <div className="pt-1">
              <span className="text-slate-500 font-medium block mb-1.5">Preferred Skills:</span>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredSkills.map((sk, idx) => (
                  <Badge key={idx} variant="neutral" size="sm">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nemotron LLM Analysis card */}
      {job.analysis && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Nemotron Analysis & Extracted Criteria
            </h4>
            <span className="text-[11px] font-mono text-slate-400">{job.analysis.analyzedAt}</span>
          </div>

          <div className="p-4 bg-brand-50/40 border border-brand-200/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-brand-700 font-semibold">
                Confidence Rating: {job.analysis.confidenceScore}%
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Model: {job.analysis.modelUsed}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-navy-900 block">
                Extracted Core Responsibilities:
              </span>
              <ul className="space-y-1 text-xs text-slate-700">
                {job.analysis.extractedResponsibilities.map((resp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Matching Candidates Section */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-navy-900" />
            Matching Qualified Candidates ({matchingCandidates.length})
          </h4>
        </div>

        <MatchingCandidates
          candidates={matchingCandidates}
          onSelectCandidate={onSelectCandidate}
        />
      </div>
    </div>
  );
};
