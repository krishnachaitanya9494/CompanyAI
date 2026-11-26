// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import {
  CheckCircle2,
  ShieldAlert,
  Copy,
  Check,
  Eye,
} from 'lucide-react';

// Import Badge component.
import { Badge } from '../common/Badge';

/**
 * SingleComparisonOverview displays the executive scorecard, overall match gauge,
 * critical gap status, recruiter verdict, and component breakdown mini meters.
 */
export const SingleComparisonOverview = ({
  compResult,
  compJob,
  compCand,
  scoreTheme,
  copiedSummary,
  handleCopySummary,
  onSelectCandidate,
  matchHistory = [],
  matchHistoryError = '',
}) => {
  // Pasted text uses deterministic requirement coverage and has no semantic model score.
  const isTextComparison = compResult?.comparison_mode === 'pasted_text';
  const scoreAvailable = compResult?.match_score != null;
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 pb-4 border-b border-slate-100 dark:border-surface-darkBorder">
        {/* Scorecard Hero */}
        <div className="flex items-center gap-4">
          {/* Large Radial Score Box */}
          <div
            className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border shadow-xs ${scoreTheme.bg} ${scoreTheme.border}`}
          >
            <span className={`text-2xl font-black ${scoreTheme.text}`}>
              {scoreAvailable ? `${compResult.match_score}%` : 'N/A'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isTextComparison ? 'Text JD match' : 'JD match'}
            </span>
          </div>

          {/* Score Details & Tiers */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-navy-950 dark:text-slate-100">
                {compResult?.classification || 'Evaluated Fit'}
              </h3>
              <Badge variant={scoreTheme.badge} size="sm">
                {compResult?.eligibility_adjusted_tier}
              </Badge>
              {compResult?.has_critical_gap ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <ShieldAlert className="w-3 h-3" />
                  Critical Gaps
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Mandatory Protected
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            {compResult?.recruiter_verdict || (scoreAvailable ? '' : 'Insufficient Evidence to calculate an overall match score.')}
            {scoreAvailable && <p className="text-xs text-slate-600 dark:text-slate-300">Evidence coverage {compResult?.evidence_coverage_pct ?? 'Unavailable'}% · Score confidence {compResult?.score_confidence || 'Low'} · {compResult?.unverified_requirement_count ?? 0} unverified</p>}
            </div>
            {compResult?.resume_warning && <p className="text-xs text-amber-700 dark:text-amber-300">{compResult.resume_warning}</p>}
            {compResult?.match_provenance && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Job {compResult.match_provenance.job_id} · JD v{compResult.match_provenance.jd_version_id} · Resume {compResult.match_provenance.resume_id ?? 'profile'} · Calculated {new Date(compResult.match_provenance.calculated_at).toLocaleString()}
              </p>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isTextComparison
                ? 'Deterministic requirement coverage from the pasted text; partial matches need recruiter review.'
                : 'Estimated requirement alignment; this is not a verified hiring outcome.'}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs transition-colors"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Brief</span>
              </>
            )}
          </button>

          {onSelectCandidate && compCand?.id > 0 && (
            <button
              type="button"
              onClick={() => onSelectCandidate(compCand.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold shadow-xs transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Profile</span>
            </button>
          )}
        </div>
      </div>

      {(matchHistoryError || matchHistory.length > 0) && (
        <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-3" aria-label="Match score history">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-xs font-bold text-navy-950 dark:text-slate-100">Score history</h4>
            {matchHistory.some((item) => !item.is_current) && <span className="text-[10px] text-amber-700 dark:text-amber-300">Older source versions retained</span>}
          </div>
          {matchHistoryError ? <p className="text-xs text-slate-500">{matchHistoryError}</p> : (
            <div className="space-y-1.5">
              {matchHistory.slice(0, 5).map((item) => (
                <div key={item.history_id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-navy-900 dark:text-slate-200">
                    {item.score_available && item.overall_score != null ? `${item.overall_score}%` : 'Insufficient Evidence'}
                    <span className="ml-2 text-[10px] font-normal text-slate-500">JD v{item.provenance?.jd_version_id ?? '—'} · Resume {item.provenance?.resume_version_id ?? 'profile'}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.is_current ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                    {item.is_current ? 'Current' : 'Historical / stale'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Component Breakdown Mini Meters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        {/* Mandatory Stack Coverage */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            {isTextComparison ? 'JD Requirement Coverage' : 'Mandatory Stack Fit'}
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-navy-950 dark:text-slate-100">
              {compResult?.skills_analysis?.mandatory_coverage_pct == null ? 'Unavailable' : `${compResult.skills_analysis.mandatory_coverage_pct}%`}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {compResult?.skills_analysis?.matched_mandatory?.length || 0} /{' '}
              {(compResult?.skills_analysis?.matched_mandatory?.length || 0) +
                (compResult?.skills_analysis?.partial_mandatory?.length || 0) +
                (compResult?.skills_analysis?.missing_mandatory?.length || 0)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${compResult?.skills_analysis?.mandatory_coverage_pct ?? 0}%` }}
            />
          </div>
        </div>

        {/* Semantic Vector Cosine Relevance */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Semantic Fit
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-navy-950 dark:text-slate-100">
              {compResult?.semantic_similarity == null ? 'Unavailable' : `${Math.round(compResult.semantic_similarity * 100)}%`}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              {compResult?.semantic_similarity == null ? (compResult?.scoring_mode === 'lexical-only' ? 'Lexical-only' : 'Unavailable') : (compResult?.semantic_model || 'Semantic')}
            </span>
          </div>
          {compResult?.scoring_mode === 'lexical-only' && <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">Low confidence: {compResult?.semantic_unavailable_reason || 'semantic comparison unavailable'}.</p>}
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${compResult?.semantic_similarity == null ? 0 : Math.max(0, Math.round(compResult.semantic_similarity * 100))}%` }}
            />
          </div>
        </div>

        {/* Experience Tenured Fit */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Experience Alignment
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-navy-950 dark:text-slate-100">
              {compResult?.experience_fit?.candidate_years == null ? 'Unverified' : `${compResult.experience_fit.candidate_years} yrs`}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {compResult?.experience_fit?.required_min == null
                ? 'Req: Unverified'
                : compResult.experience_fit.required_max == null
                ? `Req: ${compResult.experience_fit.required_min}+ yrs`
                : `Req: ${compResult.experience_fit.required_min}–${compResult.experience_fit.required_max} yrs`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                compResult?.experience_fit?.status === 'Qualified' ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((compResult?.experience_fit?.candidate_years || 0) /
                      Math.max(1, compResult?.experience_fit?.required_min || 1)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Location Compatibility */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Location Compatibility
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-navy-950 dark:text-slate-100 truncate">
              {compResult?.location_fit?.candidate_location || 'Unspecified'}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                compResult?.location_fit?.is_match
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {compResult?.location_fit?.is_match == null ? 'Unverified' : compResult.location_fit.is_match ? 'Compatible' : 'Relocation'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-2">
            Job: {compResult?.location_fit?.job_location || 'Anywhere'}
          </div>
        </div>
      </div>
    </div>
  );
};
