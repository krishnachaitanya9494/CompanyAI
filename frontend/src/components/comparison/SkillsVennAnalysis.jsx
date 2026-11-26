// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import {
  Target,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

/**
 * SkillsVennAnalysis displays the Comparative Skills Matrix across:
 * 1. Matched Core Skills (Green)
 * 2. Missing Mandatory Skills & Gaps (Red)
 * 3. Transferable Adjacent Bonus Skills (Indigo)
 */
export const SkillsVennAnalysis = ({ compResult }) => {
  const skillsAnalysis = compResult?.skills_analysis;
  const partial = skillsAnalysis?.partial_mandatory || [];
  const unverified = skillsAnalysis?.unverified_mandatory || [];
  const missing = skillsAnalysis?.missing_mandatory || [];

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
            Skills Alignment, Gaps &amp; Transferable Competencies
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Comparative Skill Matrix
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Box 1: Matched Mandatory Skills */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Matched Core Skills
            </span>
            <span className="text-xs font-bold text-emerald-700 font-mono">
              {skillsAnalysis?.matched_mandatory?.length || 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {skillsAnalysis?.matched_mandatory?.length > 0 ? (
              skillsAnalysis.matched_mandatory.map((sk, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700"
                >
                  ✓ {sk}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No satisfied mandatory requirements are recorded.</span>
            )}
          </div>
        </div>

        {/* Box 2: Missing Skills & Gaps */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              Missing Skills &amp; Gaps
            </span>
            <span className="text-xs font-bold text-rose-700 font-mono">
              {missing.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {missing.length > 0 ? (
              missing.map((sk, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700"
                >
                  ✕ {sk}
                </span>
              ))
            ) : partial.length || unverified.length ? (
              <div className="space-y-1 text-xs text-amber-700 dark:text-amber-300 font-medium">
                <p>No confirmed missing evidence; unresolved requirements still need review.</p>
                {partial.map((item, idx) => <p key={`partial-${idx}`}>Partial: {item}</p>)}
                {unverified.map((item, idx) => <p key={`unverified-${idx}`}>Unverified: {item}</p>)}
              </div>
            ) : (
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                ✓ No mandatory skill gaps identified!
              </span>
            )}
          </div>
        </div>

        {/* Box 3: Candidate Adjacent / Transferable Bonus Skills */}
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Transferable Adjacent Skills
            </span>
            <span className="text-xs font-bold text-indigo-700 font-mono">
              {skillsAnalysis?.adjacent_skills?.length || 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {skillsAnalysis?.adjacent_skills?.length > 0 ? (
              skillsAnalysis.adjacent_skills.map((sk, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700"
                >
                  + {sk}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No secondary skills noted.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
