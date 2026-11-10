// Import React for JSX structure.
import React from 'react';

// Import Badge component for skills and status.
import { Badge } from '../common/Badge';

// Import icons from lucide-react.
import { Sparkles, ArrowRight, ShieldCheck, Clock, UserCheck } from 'lucide-react';

// Export MatchingCandidates component presenting qualified candidates for a selected JD.
export const MatchingCandidates = ({
  candidates = [],
  onSelectCandidate,
}) => {
  // If no matching candidates, display empty notice.
  if (candidates.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        No directly matching candidates found in the current pool for this JD criteria.
      </div>
    );
  }

  // Render matched candidate cards.
  return (
    <div className="space-y-3">
      {candidates.map((cand) => (
        <div
          key={cand.id}
          className="p-4 bg-white border border-slate-200/80 hover:border-brand-300 rounded-2xl shadow-subtle hover:shadow-card transition-all"
        >
          {/* Header row with candidate info and match score */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-navy-900">{cand.name}</h4>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" title="Verifiable Evidence" />
              </div>
              <p className="text-xs text-slate-500">{cand.currentRole}</p>
            </div>

            <Badge variant="brand" size="sm">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              {cand.matchScore}% Fit
            </Badge>
          </div>

          {/* Quick info row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-2.5">
            <span>{cand.experienceYears} Years Exp</span>
            <span>•</span>
            <span>{cand.location}</span>
            <span>•</span>
            <span className="text-brand-700 font-medium">{cand.availability} Notice</span>
          </div>

          {/* Skill pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {cand.primarySkills.map((sk, idx) => (
              <Badge key={idx} variant="neutral" size="xs">
                {sk}
              </Badge>
            ))}
          </div>

          {/* Action trigger button */}
          <button
            onClick={() => onSelectCandidate(cand.id)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-surface-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-medium text-navy-900 transition-colors"
          >
            <span>View Candidate Profile & Evidence</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ))}
    </div>
  );
};
