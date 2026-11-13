// Import React and hooks for candidate card presentation and interactive state.
import React, { useState, useEffect } from 'react';

// Import Badge component and React Bits GlareHover for skills, tiers, and reflective candidate cards.
import { Badge } from '../common/Badge';
import { GlareHover } from '../reactbits/GlareHover';

// Import icons from lucide-react.
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Scale,
  FileText,
  UserCheck,
  Briefcase,
  MapPin,
  Clock,
} from 'lucide-react';

// Export MatchingCandidates component presenting qualified candidates with AI evidence and component score breakdowns.
export const MatchingCandidates = ({
  candidates = [],
  onSelectCandidate,
  selectedForCompare = [],
  onToggleCompare,
  onOpenWorkspace,
}) => {
  // Track expanded evidence cards by candidate ID.
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState(new Set());
  
  // Progressive disclosure: starts at 3 candidates, expands to 10 on click, with Show Less option.
  const DEFAULT_CANDIDATE_LIMIT = 3;
  const EXPANDED_STEP = 10;
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_CANDIDATE_LIMIT);

  // Reset visibleLimit whenever candidates list changes (e.g. user selects a different job).
  useEffect(() => {
    setVisibleLimit(DEFAULT_CANDIDATE_LIMIT);
  }, [candidates]);

  const visibleCandidates = candidates.slice(0, visibleLimit);
  const hasMore = visibleLimit < candidates.length;
  const nextTarget = visibleLimit === DEFAULT_CANDIDATE_LIMIT ? 10 : visibleLimit + EXPANDED_STEP;
  const nextCount = Math.min(candidates.length - visibleLimit, nextTarget - visibleLimit);

  // Toggle evidence drawer for a candidate card.
  const toggleEvidence = (candidateId) => {
    setExpandedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  // Helper to determine style variant based on candidate classification or score.
  const getTierBadge = (candidate) => {
    if (candidate.sourceTag || candidate.matchScore == null) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/60">
          ✦ Talent Pool
        </span>
      );
    }
    const classification = candidate.classification || (
      candidate.matchScore >= 88 ? 'Excellent Match' :
      candidate.matchScore >= 75 ? 'Strong Match' :
      candidate.matchScore >= 60 ? 'Potential Match' :
      candidate.matchScore >= 45 ? 'Partial Match' : 'Needs Review'
    );

    switch (classification) {
      case 'Excellent Match':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">★ Excellent</span>;
      case 'Strong Match':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 border border-brand-300 dark:border-brand-700/60">● Strong</span>;
      case 'Potential Match':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">▲ Potential</span>;
      case 'Partial Match':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-surface-darkBorder">○ Partial</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">! Review</span>;
    }
  };

  // If no candidates matched criteria, show informative empty state.
  if (candidates.length === 0) {
    return (
      <div className="p-8 bg-slate-50 dark:bg-surface-darkCard border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-2xl text-center space-y-2">
        <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-navy-900 dark:text-slate-100">No Matching Candidates</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No candidates in the talent pool satisfied the active criteria. Adjust filters or review job requirements.
        </p>
      </div>
    );
  }

  // Render matched candidate cards list.
  return (
    <div className="space-y-3.5">
      {visibleCandidates.map((cand) => {
        // Compute requirement satisfaction summary if requirements list exists.
        const reqs = cand.requirements || [];
        const satisfiedCount = reqs.filter((r) => r.status === 'SATISFIED').length;
        const gapCount = reqs.filter((r) => r.status === 'GAP').length;
        const unverifiedCount = reqs.filter((r) => r.status === 'UNVERIFIED').length;
        const isSelected = selectedForCompare.includes(cand.id);
        const isEvidenceOpen = expandedEvidenceIds.has(cand.id);

        return (
          <GlareHover
            key={cand.id}
            glareColor="rgba(16, 185, 129, 0.14)"
            className={`p-4 bg-white dark:bg-surface-darkCard border rounded-2xl card-reflective ${
              isSelected ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/20 dark:bg-brand-900/10' : 'border-slate-200/80 dark:border-surface-darkBorder hover:border-brand-300 dark:hover:border-brand-600/60'
            }`}
          >
            {/* Header row with candidate name, tier pill, and match score */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-navy-950 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer" onClick={() => onSelectCandidate(cand.id)}>
                    {cand.name}
                  </h4>
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-surface-darkBorder">
                    {cand.code || `cand-${cand.id}`}
                  </span>
                  {getTierBadge(cand)}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{cand.currentRole}</p>
              </div>

              {/* Match Score Badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {cand.matchScore != null ? (
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span className="text-lg font-extrabold text-navy-950 dark:text-slate-100">{cand.matchScore}%</span>
                    </div>
                    <span className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Overall Fit</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                      Talent Pool
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5">Keyword Match</span>
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Metadata Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-3">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {cand.experienceYears} Years Exp
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {cand.location}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-brand-700 dark:text-brand-400 font-semibold">
                <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                {cand.availability} Notice
              </span>
              <span>•</span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {cand.status || cand.stage || 'New'}
              </span>
            </div>

            {/* Requirement Alignment Summary Badges if structured requirements exist */}
            {reqs.length > 0 && (
              <div className="flex items-center gap-2 mb-3 text-xs sm:text-sm flex-wrap">
                <span className="font-semibold text-slate-500 dark:text-slate-400">JD Alignment:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-700/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {satisfiedCount} Satisfied
                </span>
                {gapCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-700/60">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {gapCount} Gaps
                  </span>
                )}
                {unverifiedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-700/60">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {unverifiedCount} Unverified
                  </span>
                )}
              </div>
            )}

            {/* Component Score Breakdown Mini-Bars if available */}
            {cand.componentScores && (
              <div className="p-3 bg-slate-50/80 dark:bg-surface-darkBg/60 rounded-xl border border-slate-100 dark:border-surface-darkBorder mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">Mandatory Skills</span>
                  <span className="font-bold text-navy-900 dark:text-slate-100">{cand.componentScores.mandatory_skills}%</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">Experience Fit</span>
                  <span className="font-bold text-navy-900 dark:text-slate-100">{cand.componentScores.relevant_experience}%</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">Domain &amp; Role</span>
                  <span className="font-bold text-navy-900 dark:text-slate-100">{cand.componentScores.domain_fit}%</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">Semantic Relevance</span>
                  <span className="font-bold text-brand-700 dark:text-brand-400">{cand.componentScores.semantic_relevance}%</span>
                </div>
              </div>
            )}

            {/* Primary Skill Pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(cand.primarySkills || []).map((sk, idx) => (
                <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  {sk}
                </span>
              ))}
              {(cand.secondarySkills || []).slice(0, 3).map((sk, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
                  {sk}
                </span>
              ))}
            </div>

            {/* Expandable Evidence Highlights & Recruiter Rationale */}
            {isEvidenceOpen && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-surface-darkBorder space-y-3 animate-fadeIn">
                {/* Executive Recruiter Summary Narrative */}
                {cand.explanations?.summary_narrative && (
                  <div className="p-3 bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/60 rounded-xl text-xs sm:text-sm text-brand-900 dark:text-brand-200">
                    <span className="font-bold block mb-1">AI Recruiter Briefing:</span>
                    <p className="leading-relaxed">{cand.explanations.summary_narrative}</p>
                  </div>
                )}

                {/* Evidence excerpts from candidate resume */}
                {cand.evidenceHighlights && cand.evidenceHighlights.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Verbatim Resume Evidence:
                    </span>
                    <div className="space-y-1.5">
                      {cand.evidenceHighlights.map((ev, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder rounded-lg text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                          {ev}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing requirements or gaps notice */}
                {cand.explanations?.missing_requirements && cand.explanations.missing_requirements.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      Identified Requirement Gaps:
                    </span>
                    <ul className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 list-disc list-inside space-y-1 bg-rose-50/60 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200/60 dark:border-rose-900/50">
                      {cand.explanations.missing_requirements.map((gap, idx) => (
                        <li key={idx}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-surface-darkBorder mt-2">
              {/* Compare Checkbox Trigger */}
              {onToggleCompare && (
                <button
                  type="button"
                  onClick={() => onToggleCompare(cand.id)}
                  className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 border-slate-200 dark:border-surface-darkBorder hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Selected' : 'Compare'}</span>
                </button>
              )}

              {/* Toggle Evidence Button */}
              <button
                type="button"
                onClick={() => toggleEvidence(cand.id)}
                className="flex items-center gap-1 py-1.5 px-2.5 bg-slate-100 dark:bg-surface-darkBg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium border border-transparent dark:border-surface-darkBorder transition-colors"
              >
                <span>{isEvidenceOpen ? 'Hide Evidence' : 'Show AI Evidence'}</span>
                {isEvidenceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {/* View Profile Action */}
              <button
                type="button"
                onClick={() => onSelectCandidate(cand.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-500 text-white rounded-xl text-xs font-semibold btn-interactive btn-glow shadow-sm"
              >
                <span>View Full Profile</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-white/80" />
              </button>
            </div>
          </GlareHover>
        );
      })}

      {/* Progressive Disclosure Controls: Show More (10 candidates) / Show Less */}
      {(hasMore || visibleLimit > DEFAULT_CANDIDATE_LIMIT) && (
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 px-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing {visibleCandidates.length} of {candidates.length} matching candidates
          </span>
          <div className="flex items-center gap-2">
            {visibleLimit > DEFAULT_CANDIDATE_LIMIT && (
              <button
                type="button"
                onClick={() => setVisibleLimit(DEFAULT_CANDIDATE_LIMIT)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-darkBg dark:hover:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all active:scale-[0.99]"
              >
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Show Less (Top 3)</span>
              </button>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() =>
                  setVisibleLimit((prev) =>
                    prev === DEFAULT_CANDIDATE_LIMIT ? 10 : prev + EXPANDED_STEP
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder hover:border-brand-500 dark:hover:border-brand-500 text-navy-900 dark:text-slate-100 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99]"
              >
                <ChevronDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>
                  {visibleLimit === DEFAULT_CANDIDATE_LIMIT
                    ? `Show More (View 10 candidates)`
                    : `Show More (+${nextCount} more)`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
