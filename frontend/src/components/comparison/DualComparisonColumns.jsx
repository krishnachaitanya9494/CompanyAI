// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import {
  Briefcase,
  User,
  Target,
  Award,
} from 'lucide-react';

/**
 * DualComparisonColumns renders the side-by-side split comparison columns:
 * Left: Target Job Description Specification (Mandatory stack, preferred traits, overview)
 * Right: Candidate Grounded Profile & Verbatim Resume (Structured attributes or raw text)
 */
export const DualComparisonColumns = ({
  compJob,
  compCand,
  candidateViewTab,
  setCandidateViewTab,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT COLUMN: Target Job Description Specification */}
      <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs flex flex-col justify-between space-y-4">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Briefcase className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  {compJob?.title}
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  {compJob?.job_code || `REQ-${compJob?.id}`} • {compJob?.department}
                </span>
              </div>
            </div>

            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {compJob?.location}
            </span>
          </div>

          {/* Role Narrative Scope */}
          <div className="mt-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Position Architecture &amp; Overview
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-surface-darkBorder">
              {compJob?.role_summary || compJob?.job_overview || 'Comprehensive engineering requisition.'}
            </p>
          </div>

          {/* Mandatory Technical Stack */}
          <div className="mt-3 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block flex items-center justify-between">
              <span>Mandatory Technical Requirements</span>
              <span className="text-rose-600 font-semibold">{compJob?.required_skills?.length || 0} Required</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(compJob?.required_skills || []).map((sk, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                >
                  <Target className="w-3 h-3 text-rose-500" />
                  <span>{sk}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Preferred Qualifications */}
          {compJob?.preferred_skills?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Preferred Qualifications &amp; Differentiators
              </span>
              <div className="flex flex-wrap gap-1.5">
                {compJob.preferred_skills.map((sk, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    <Award className="w-3 h-3 text-emerald-500" />
                    <span>{sk}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Job Metadata Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between text-[11px] text-slate-500">
          <span>Total Specifications: {compJob?.requirements_count || 15} Domains</span>
          <span>Experience: {compJob?.min_experience_years}–{compJob?.max_experience_years || 99} yrs</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Candidate Resume & Grounded Profile */}
      <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs flex flex-col justify-between space-y-4">
        <div>
          {/* Header & View Mode Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <User className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  {compCand?.name}
                </h4>
                <span className="text-[11px] text-slate-500">
                  {compCand?.current_role || 'Candidate Profile'} • {compCand?.experience_years} yrs exp
                </span>
              </div>
            </div>

            {/* Profile vs Raw Resume Text Tab Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder">
              <button
                type="button"
                onClick={() => setCandidateViewTab('structured')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  candidateViewTab === 'structured'
                    ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => setCandidateViewTab('resume_text')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  candidateViewTab === 'resume_text'
                    ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Raw Resume
              </button>
            </div>
          </div>

          {/* Candidate Content Tab 1: Structured Profile */}
          {candidateViewTab === 'structured' && (
            <div className="mt-3 space-y-3">
              {/* Summary */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Professional Summary
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-surface-darkBorder">
                  {compCand?.summary || 'Candidate summary indexed from verified document.'}
                </p>
              </div>

              {/* Discovered Candidate Skills */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Discovered Candidate Skills ({compCand?.skills?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {(compCand?.skills || []).map((sk, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
                {(compCand?.skill_evidence || []).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {compCand.skill_evidence.map((item, idx) => (
                      <li key={`${item.skill}-${idx}`} className="text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{item.skill}:</span> {item.evidence}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Candidate Content Tab 2: Raw Document Text */}
          {candidateViewTab === 'resume_text' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-slate-500">
                  {compCand?.winning_resume_filename || 'source_document.txt'}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  Verbatim Disk Provenance
                </span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar">
                {compCand?.resume_text_excerpt || compCand?.summary || 'No raw document text available.'}
              </pre>
            </div>
          )}
        </div>

        {/* Candidate Metadata Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between text-[11px] text-slate-500">
          <span>Location: {compCand?.location}</span>
          <span>Availability: {compCand?.availability}</span>
        </div>
      </div>
    </div>
  );
};
