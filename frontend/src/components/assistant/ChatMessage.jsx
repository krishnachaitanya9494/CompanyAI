// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import { Sparkles, User, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

// Import Badge component for candidate card tags.
import { Badge } from '../common/Badge';

// Export ChatMessage component rendering dialogue bubbles and candidate cards.
export const ChatMessage = ({ message, onSelectCandidate }) => {
  // Determine if sender is assistant or human recruiter.
  const isAssistant = message.sender === 'assistant';

  // Render message row.
  return (
    <div className={`flex gap-3.5 ${isAssistant ? 'justify-start' : 'justify-end'} animate-fadeIn`}>
      {/* Assistant avatar on the left */}
      {isAssistant && (
        <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5 shadow-subtle">
          <Sparkles className="w-4 h-4" />
        </div>
      )}

      {/* Message content container */}
      <div className={`max-w-2xl space-y-3 ${isAssistant ? 'items-start' : 'items-end'}`}>
        {/* Text bubble */}
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed ${
            isAssistant
              ? 'bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder text-navy-900 dark:text-slate-100 shadow-card'
              : 'bg-navy-900 dark:bg-brand-600 text-white rounded-br-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>

          {/* Timestamp indicator */}
          <div
            className={`text-[10px] mt-2 font-mono ${
              isAssistant ? 'text-slate-400 dark:text-slate-400' : 'text-slate-300 text-right'
            }`}
          >
            {message.timestamp}
          </div>
        </div>

        {/* Embedded candidate search results cards if present in the assistant message */}
        {isAssistant && message.candidates && message.candidates.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-400 px-1">
              {message.candidates.some((candidate) => candidate.matchScore != null) ? 'Top Matched Candidates' : 'Retrieved Candidates'} ({message.candidates.length})
            </div>

            {message.candidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder hover:border-brand-200 dark:hover:border-brand-700/60 rounded-xl shadow-subtle hover:shadow-card transition-all"
              >
                {/* Header row: name, role, and match score badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">{cand.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{cand.currentRole || `Candidate ${cand.id}`}</p>
                  </div>

                  {cand.matchScore != null && (
                    <Badge variant="brand" size="sm">
                      {cand.matchScore}% Match
                    </Badge>
                  )}
                </div>

                {/* Candidate details: exp, location, availability */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                  <span>Exp: {cand.experienceYears != null ? `${cand.experienceYears} Years` : '5+ Years'}</span>
                  <span>•</span>
                  <span>{cand.location || 'India'}</span>
                  <span>•</span>
                  <span className="text-brand-700 dark:text-brand-400 font-medium">Available: {cand.availability || 'Immediate'}</span>
                </div>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(cand.primarySkills || []).slice(0, 4).map((skill, idx) => (
                    <Badge key={idx} variant="neutral" size="xs">
                      {skill}
                    </Badge>
                  ))}
                </div>

                {/* Direct action to open candidate detail modal */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={() => onSelectCandidate(cand.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 hover:underline transition-all"
                  >
                    <span>View Candidate Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recruiter avatar on the right */}
      {!isAssistant && (
        <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 shadow-subtle">
          KC
        </div>
      )}
    </div>
  );
};
