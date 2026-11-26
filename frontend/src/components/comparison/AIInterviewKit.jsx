// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

/**
 * AIInterviewKit displays the AI Technical & Behavioral interview questions
 * tailored directly to the candidate's discovered skill gaps and strengths.
 */
export const AIInterviewKit = ({ compResult }) => {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
            Targeted Interview Screening Kit
          </h3>
        </div>
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
          Based on unresolved evidence and responsibilities
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Candidate Strengths */}
        <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Key Candidate Strengths
          </span>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            {(compResult?.strengths || []).map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Right: Risks & Gaps to Probe */}
        <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Risks &amp; Areas to Probe in Interview
          </span>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            {(compResult?.risks_and_gaps || []).map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Targeted Interview Questions */}
      <div className="mt-4 space-y-2.5">
        <span className="text-xs font-bold text-navy-950 dark:text-slate-100 block">
            Targeted Screening Questions
        </span>
        {(compResult?.interview_kit || []).map((qItem, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-surface-darkBorder space-y-1.5"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                Focus Area: {qItem.focus_skill}
              </span>
              <span className="px-2 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                {qItem.type}
              </span>
            </div>

            <p className="text-xs font-medium text-navy-950 dark:text-slate-100 italic">
              &ldquo;{qItem.question}&rdquo;
            </p>

            <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Expected Signal:
              </span>{' '}
              {qItem.expected_signal || qItem.what_to_look_for || 'Evidence and examples that address the focus area.'}
            </div>
          </div>
        ))}
        {(compResult?.interview_kit || []).length === 0 && (
          <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-surface-darkBorder text-xs text-slate-600 dark:text-slate-300">
            No unresolved requirements or responsibility probes were returned for this comparison.
          </p>
        )}
      </div>
    </div>
  );
};
