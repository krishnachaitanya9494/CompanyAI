// Import React and hooks for managing local state and drag/drop interactions.
import React, { useState } from 'react';

// Import Badge component for skills and status pills.
import { Badge } from '../components/common/Badge';

// Import icons from lucide-react for board controls and indicators.
import {
  Users,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react';

// Define standard recruitment pipeline stages.
const PIPELINE_STAGES = [
  { id: 'Screened', label: 'Screened', accent: 'border-blue-200 bg-blue-50/40 text-blue-800' },
  { id: 'Shortlisted', label: 'Shortlisted', accent: 'border-indigo-200 bg-indigo-50/40 text-indigo-800' },
  { id: 'Technical Rounds', label: 'Technical Rounds', accent: 'border-amber-200 bg-amber-50/40 text-amber-800' },
  { id: 'Manager Round', label: 'Manager Round', accent: 'border-purple-200 bg-purple-50/40 text-purple-800' },
  { id: 'Offer Extended', label: 'Offer Extended', accent: 'border-emerald-200 bg-emerald-50/40 text-emerald-800', isSensitive: true },
  { id: 'Hired', label: 'Hired', accent: 'border-brand-300 bg-brand-50/60 text-brand-900', isSensitive: true },
];

// Export PipelineKanbanPage component for drag-and-drop / click-to-move recruitment stages.
export const PipelineKanbanPage = ({
  candidates = [],
  onUpdateCandidate,
  onSelectCandidate,
}) => {
  // State for active stage change warning dialog when moving to sensitive stages (Offer/Hired).
  const [sensitiveWarning, setSensitiveWarning] = useState(null);

  // Group candidates into pipeline stages based on their status or stage property.
  const getStageCandidates = (stageId) => {
    return candidates.filter((c) => {
      // Direct stage matching or normalized status check.
      const current = c.stage || c.status || 'Screened';
      if (stageId === 'Technical Rounds') {
        return current.includes('Technical') || current.includes('Round 1');
      }
      if (stageId === 'Manager Round') {
        return current.includes('Manager') || current.includes('Round 2');
      }
      return current.toLowerCase() === stageId.toLowerCase();
    });
  };

  // Handle stage transition request.
  const handleMoveCandidate = (candidate, targetStage) => {
    // Check if target stage is sensitive (requires Human-in-the-Loop approval per security policy).
    const targetConfig = PIPELINE_STAGES.find((s) => s.id === targetStage);
    if (targetConfig && targetConfig.isSensitive) {
      setSensitiveWarning({
        candidate,
        targetStage,
        message: `Moving candidate ${candidate.name} to "${targetStage}" triggers automated offer/hiring workflows and requires recruiter authorization.`,
      });
      return;
    }

    // Execute standard stage change.
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...candidate, status: targetStage, stage: targetStage },
        `Moved ${candidate.name} to ${targetStage} stage.`
      );
    }
  };

  // Confirm sensitive stage transition.
  const confirmSensitiveMove = () => {
    if (!sensitiveWarning) return;
    const { candidate, targetStage } = sensitiveWarning;
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...candidate, status: targetStage, stage: targetStage },
        `Sensitive action executed: ${candidate.name} advanced to ${targetStage} by authorized recruiter.`
      );
    }
    setSensitiveWarning(null);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header with pipeline title and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <span>Talent Pipeline Kanban</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {candidates.length} Active Applicants
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track applicant progress across recruitment stages from screening to hiring
          </p>
        </div>
      </div>

      {/* Sensitive Action Approval Modal */}
      {sensitiveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-950">Sensitive Action Confirmation</h3>
                <span className="text-xs text-slate-500">Human-in-the-Loop Governance</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {sensitiveWarning.message}
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-navy-900 space-y-1">
              <div><strong>Candidate:</strong> {sensitiveWarning.candidate.name}</div>
              <div><strong>Target Stage:</strong> {sensitiveWarning.targetStage}</div>
              <div><strong>Audit Requester:</strong> Krishna C. (Recruiter Admin)</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSensitiveWarning(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSensitiveMove}
                className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-subtle"
              >
                Approve & Advance Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board Horizontal Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {PIPELINE_STAGES.map((col) => {
          const colCandidates = getStageCandidates(col.id);

          return (
            <div
              key={col.id}
              className="w-80 min-w-[20rem] flex-shrink-0 bg-slate-100/60 border border-slate-200/80 rounded-2xl p-3.5 space-y-3"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-950">{col.label}</span>
                  {col.isSensitive && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                      Gated
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                  {colCandidates.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 min-h-[300px]">
                {colCandidates.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl text-center p-4">
                    <p className="text-xs text-slate-400">No candidates in this stage</p>
                  </div>
                ) : (
                  colCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="bg-white border border-slate-200/80 hover:border-brand-300 rounded-xl p-3.5 shadow-subtle hover:shadow-card transition-all space-y-2.5 group"
                    >
                      {/* Candidate Name & Match Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                            className="text-xs font-bold text-navy-900 hover:text-brand-600 text-left transition-colors"
                          >
                            {cand.name}
                          </button>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {cand.currentRole || 'Candidate'}
                          </p>
                        </div>
                        {cand.matchScore && (
                          <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200/80 px-1.5 py-0.5 rounded-full">
                            {cand.matchScore}%
                          </span>
                        )}
                      </div>

                      {/* Location and Experience */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{cand.location || 'India'}</span>
                        <span>•</span>
                        <span>{cand.experienceYears ? `${cand.experienceYears} yrs` : '5+ yrs'}</span>
                      </div>

                      {/* Top Skills Tags */}
                      <div className="flex flex-wrap gap-1">
                        {(cand.primarySkills || []).slice(0, 3).map((skill, sIdx) => (
                          <Badge key={sIdx} variant="neutral" size="xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>

                      {/* Quick Stage Controls */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <button
                          onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                          className="text-slate-500 hover:text-navy-900 font-medium"
                        >
                          View Details
                        </button>

                        {/* Move forward dropdown / button */}
                        <div className="flex items-center gap-1">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleMoveCandidate(cand, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className="text-[10px] py-1 px-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 hover:bg-white focus:outline-none focus:border-brand-500"
                          >
                            <option value="" disabled>Move to...</option>
                            {PIPELINE_STAGES.filter((s) => s.id !== col.id).map((target) => (
                              <option key={target.id} value={target.id}>
                                → {target.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
