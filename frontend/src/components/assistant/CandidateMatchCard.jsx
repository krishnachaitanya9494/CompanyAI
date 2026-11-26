// Import React and hooks for candidate card presentation.
import React from 'react';
// Import icons from lucide-react.
import {
  User,
  ArrowRight,
  GitCompare,
  Sparkles,
  MapPin,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
// Import Badge component for standard badge tokens.
import { Badge } from '../common/Badge';

export const CandidateMatchCard = ({
  candidate,
  activeJobId = null,
  onSelectCandidate,
  onNavigateToComparison,
  onGenerateQuestions,
}) => {
  if (!candidate) return null;

  const candId = candidate.numeric_id || candidate.id || candidate.candidate_id;
  const name = candidate.name || 'Candidate';
  const role = candidate.currentRole || candidate.current_title || candidate.role || 'Enterprise Consultant';
  const score = candidate.matchScore ?? candidate.rawScore ?? null;
  const tier = candidate.eligibilityAdjustedTier || candidate.classification || null;
  const expYears = candidate.experienceYears ?? candidate.experience_years;
  const location = candidate.location || 'Location not specified';
  const skills = candidate.primarySkills || candidate.skills || [];
  const hasGap = candidate.hasCriticalGap || (candidate.mandatoryGapCount && candidate.mandatoryGapCount > 0);

  // Derive candidate initials for avatar.
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  // Determine score color theme.
  const getScoreTheme = (sc) => {
    if (sc == null) return { bg: 'bg-slate-100 text-slate-700', border: 'border-slate-300' };
    if (sc >= 75) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', bar: 'bg-emerald-500' };
    if (sc >= 50) return { bg: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800', bar: 'bg-amber-500' };
    return { bg: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800', bar: 'bg-rose-500' };
  };

  const theme = getScoreTheme(score);

  return (
    <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder hover:border-brand-300 dark:hover:border-brand-700/80 rounded-2xl shadow-subtle hover:shadow-card transition-all space-y-3">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar Initials Badge */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-subtle flex-shrink-0">
            {initials || <User className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-navy-900 dark:text-white hover:text-brand-600 transition-colors">
                {name}
              </h4>
              {tier && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-darkHover text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder">
                  {tier}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {role}
            </p>
          </div>
        </div>

        {/* Score Badge */}
        {score != null && (
          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
            <div className={`px-3 py-1 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 ${theme.bg}`}>
              <span>{score}%</span>
              <span className="text-[10px] uppercase font-sans font-semibold tracking-wider">Match</span>
            </div>
          </div>
        )}
      </div>

      {/* Experience, Location & Highlights */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        {expYears != null && (
          <span className="flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>{expYears} yrs experience</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{location}</span>
        </span>
        {hasGap && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Review required for unmet requirements</span>
          </span>
        )}
      </div>

      {/* Verified Skills Tags */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {skills.slice(0, 5).map((sk, idx) => (
            <span
              key={idx}
              className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-surface-darkHover text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-surface-darkBorder flex items-center gap-1"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              {sk}
            </span>
          ))}
          {skills.length > 5 && (
            <span className="text-[10px] text-slate-400 px-1 py-0.5">
              +{skills.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-surface-darkBorder flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {/* 1. Compare with JD Button */}
          {onNavigateToComparison && (
            <button
              type="button"
              onClick={() => onNavigateToComparison(activeJobId, candId)}
              className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-lg transition-all flex items-center gap-1.5 shadow-subtle"
              title="Open side-by-side JD & Resume Comparison"
            >
              <GitCompare className="w-3 h-3 text-brand-600 dark:text-brand-400" />
              <span>Compare with JD</span>
            </button>
          )}

          {/* 2. Generate Interview Kit */}
          {onGenerateQuestions && (
            <button
              type="button"
              onClick={() => onGenerateQuestions(name)}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-600 bg-slate-100 hover:bg-slate-200/80 dark:bg-surface-darkHover dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-surface-darkBorder transition-all flex items-center gap-1"
              title="Generate tailored interview screening questions"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Interview Questions</span>
            </button>
          )}
        </div>

        {/* 3. View Full Profile */}
        <button
          type="button"
          onClick={() => onSelectCandidate && onSelectCandidate(candId)}
          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-navy-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-surface-darkHover rounded-lg transition-all flex items-center gap-1"
        >
          <span>View Profile</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
