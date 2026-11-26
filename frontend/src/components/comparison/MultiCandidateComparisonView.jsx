// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import { Users } from 'lucide-react';

// Import Badge component.
import { Badge } from '../common/Badge';

/**
 * MultiCandidateComparisonView renders the side-by-side comparison matrix for 2-5 candidates,
 * showcasing comparative ranking, recommendation highlights, and individual scorecards.
 */
export const MultiCandidateComparisonView = ({
  multiComparisonData,
  getScoreTheme,
  setSelectedCandidateId,
  setComparisonMode,
}) => {
  if (!multiComparisonData) return null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Multi Compare Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
          <div>
            <h3 className="text-base font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Multi-Candidate Side-by-Side Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evaluating {multiComparisonData?.candidates?.length} candidates against {multiComparisonData?.job_title}
            </p>
          </div>

          {/* Recommended Pick Badge */}
          {multiComparisonData?.recommendation && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                ★ AI Shortlist Recommendation:
              </span>
              <span className="text-emerald-900 dark:text-emerald-200 font-semibold">
                {multiComparisonData.recommendation.recommendation_rationale}
              </span>
            </div>
          )}
        </div>

        {/* Candidate Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
          {multiComparisonData.candidates.map((cand) => {
            const cTheme = getScoreTheme(cand.match_score);
            const isWinner =
              multiComparisonData.recommendation?.recommended_candidate_id === cand.candidate_id;

            return (
              <div
                key={cand.candidate_id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isWinner
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-white dark:bg-surface-darkBg border-slate-200 dark:border-surface-darkBorder'
                }`}
              >
                {isWinner && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                    Top Recommendation
                  </span>
                )}

                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xl font-black ${cTheme.text}`}>
                    {cand.match_score}%
                  </span>
                  <Badge variant={cTheme.badge} size="xs">
                    {cand.eligibility_adjusted_tier}
                  </Badge>
                </div>

                <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  {cand.name}
                </h4>
                <span className="text-xs text-slate-500 block truncate">
                  {cand.current_role}
                </span>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-surface-darkBorder text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Experience:</span>
                    <span className="font-semibold">{cand.experience_years} yrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mandatory Gaps:</span>
                    <span
                      className={`font-semibold ${
                        cand.mandatory_gap_count > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {cand.mandatory_gap_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-semibold truncate">{cand.location || 'Anywhere'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCandidateId(cand.candidate_id);
                    setComparisonMode('single');
                  }}
                  className="w-full mt-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-xs font-semibold transition-colors"
                >
                  Deep 1-on-1 Compare →
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
