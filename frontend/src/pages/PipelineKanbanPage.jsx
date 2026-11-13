// Import React and hooks for managing local state and approval proposals.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

// Import Badge, CustomSelect, and React Bits GlareHover for sleek stage card polish.
import { Badge } from '../components/common/Badge';
import { CustomSelect } from '../components/common/CustomSelect';
import { GlareHover } from '../components/reactbits/GlareHover';

// Import approvalApi so gated stage changes submit real SQLite approval tickets.
import { approvalApi } from '../api/client';

// Import icons from lucide-react for board controls and indicators.
import {
  ShieldAlert,
  CheckCircle2,
  GripVertical,
} from 'lucide-react';

// Define full ordered recruitment pipeline stages matching persisted database candidate values.
const PIPELINE_STAGES = [
  { id: 'New', label: 'New / Sourced', accent: 'border-slate-200 bg-slate-50/40 text-slate-800' },
  { id: 'Screened', label: 'Screened', accent: 'border-blue-200 bg-blue-50/40 text-blue-800' },
  { id: 'Shortlisted', label: 'Shortlisted', accent: 'border-indigo-200 bg-indigo-50/40 text-indigo-800' },
  { id: 'Technical Rounds', label: 'Technical Rounds', accent: 'border-amber-200 bg-amber-50/40 text-amber-800' },
  { id: 'Manager Round', label: 'Manager Round', accent: 'border-purple-200 bg-purple-50/40 text-purple-800' },
  { id: 'HR Discussion', label: 'HR Discussion', accent: 'border-cyan-200 bg-cyan-50/40 text-cyan-800' },
  { id: 'Offer Extended', label: 'Offer Extended', accent: 'border-emerald-200 bg-emerald-50/40 text-emerald-800', isSensitive: true },
  { id: 'Hired', label: 'Hired', accent: 'border-brand-300 bg-brand-50/60 text-brand-900', isSensitive: true },
  { id: 'Rejected', label: 'Rejected', accent: 'border-red-200 bg-red-50/40 text-red-800', isSensitive: true },
];

// Export PipelineKanbanPage component for click-to-move recruitment stages.
export const PipelineKanbanPage = ({
  candidates = [],
  onUpdateCandidate,
  onRefreshApprovals,
  onSelectCandidate,
}) => {
  // State for active stage change warning dialog when moving to sensitive stages (Offer/Hired/Rejected).
  const [sensitiveWarning, setSensitiveWarning] = useState(null);
  const [isSubmittingGate, setIsSubmittingGate] = useState(false);
  const [gateNotice, setGateNotice] = useState('');
  const [gateModalError, setGateModalError] = useState('');
  // HTML5 drag-and-drop state for moving candidate cards across pipeline stages.
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);

  // Group candidates into pipeline stages based on their status or stage property.
  const getStageCandidates = (stageId) => {
    return candidates.filter((c) => {
      const current = (c.stage || c.status || 'New').trim();
      const lower = current.toLowerCase();
      if (stageId === 'Technical Rounds') {
        return lower.includes('technical') || lower.includes('round 1') || lower === 'interviewing';
      }
      if (stageId === 'Manager Round') {
        return lower.includes('manager') || lower.includes('round 2');
      }
      if (stageId === 'Offer Extended') {
        return lower === 'offer extended' || lower === 'offered';
      }
      return lower === stageId.toLowerCase();
    });
  };

  // Handle stage transition request.
  const handleMoveCandidate = (candidate, targetStage) => {
    // Route gated moves (Offer Extended, Hired, Rejected) through human-in-the-loop approvals.
    const targetConfig = PIPELINE_STAGES.find((s) => s.id === targetStage);
    if (targetConfig && targetConfig.isSensitive) {
      setGateModalError('');
      setSensitiveWarning({
        candidate,
        targetStage,
        message: `Moving ${candidate.name} to "${targetStage}" submits a formal Approval Request to the Governance Queue before updating candidate eligibility.`,
      });
      return;
    }

    // Execute standard non-gated stage change directly.
    const mappedStage =
      targetStage === 'Technical Rounds' ? 'Technical Round 1' : targetStage;
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...candidate, status: mappedStage, stage: mappedStage },
        `Moved ${candidate.name} to ${mappedStage} stage.`
      );
    }
  };

  // Submit gated stage change as a pending ApprovalRequest in SQLite instead of bypassing approval.
  const confirmSensitiveMove = async () => {
    if (!sensitiveWarning) return;
    const { candidate, targetStage } = sensitiveWarning;
    setIsSubmittingGate(true);
    setGateModalError('');
    try {
      const actionType =
        targetStage === 'Offer Extended'
          ? 'offer_candidate'
          : targetStage === 'Rejected'
          ? 'reject_candidate'
          : 'update_candidate_stage';
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please verify the backend server is running.')), 10000)
      );
      await Promise.race([
        approvalApi.propose({
          action_type: actionType,
          description: `Request stage progression for ${candidate.name} to "${targetStage}"`,
          payload: {
            candidate_id: candidate.id,
            candidate_name: candidate.name,
            stage: targetStage,
          },
          requester: 'Krishna C. (Recruiter)',
        }),
        timeoutPromise,
      ]);
      setSensitiveWarning(null);
      setGateNotice(`Approval ticket created for ${candidate.name} → ${targetStage}. Review it in the Approvals queue.`);
      setTimeout(() => setGateNotice(''), 5000);
      if (onRefreshApprovals) {
        Promise.resolve(onRefreshApprovals()).catch(() => {});
      }
    } catch (err) {
      setGateModalError(err.message || 'Failed to submit approval ticket.');
    } finally {
      setIsSubmittingGate(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header with pipeline title and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Talent Pipeline Kanban</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {candidates.length} Active Applicants
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track applicant progression across every stage; gated moves create real Human-in-the-Loop approval tickets
          </p>
        </div>
      </div>

      {/* Confirmation Banner after Submitting Gated Approval */}
      {gateNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{gateNotice}</span>
        </div>
      )}

      {/* Sensitive Action Approval Modal (portaled to document.body so backdrop covers full viewport) */}
      {sensitiveWarning &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-950/45 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-surface-darkCard rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-surface-darkBorder space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy-950 dark:text-slate-100">Gated Stage Approval Required</h3>
                  <span className="text-[13px] text-slate-500 dark:text-slate-400">Human-in-the-Loop Governance</span>
                </div>
              </div>

              <p className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {sensitiveWarning.message}
              </p>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-surface-darkBorder text-[14px] text-navy-900 dark:text-slate-200 space-y-1">
                <div><strong>Candidate:</strong> {sensitiveWarning.candidate.name}</div>
                <div><strong>Target Stage:</strong> {sensitiveWarning.targetStage}</div>
                <div><strong>Requester:</strong> Krishna C. (Recruiter)</div>
              </div>

              {gateModalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[13px] text-rose-700 dark:text-rose-300">
                  {gateModalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmittingGate(false);
                    setGateModalError('');
                    setSensitiveWarning(null);
                  }}
                  className="px-4 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-navy-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingGate}
                  onClick={confirmSensitiveMove}
                  className="px-4 py-2 text-[15px] font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-xl transition-all shadow-subtle"
                >
                  {isSubmittingGate ? 'Submitting...' : 'Submit Approval Request'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Kanban Board Horizontal Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {PIPELINE_STAGES.map((col) => {
          const colCandidates = getStageCandidates(col.id);
          const isDropTarget = dragOverStageId === col.id && draggedItem?.sourceStageId !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                if (!draggedItem || draggedItem.sourceStageId === col.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStageId !== col.id) {
                  setDragOverStageId(col.id);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDragOverStageId((prev) => (prev === col.id ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedItem && draggedItem.sourceStageId !== col.id) {
                  handleMoveCandidate(draggedItem.candidate, col.id);
                }
                setDraggedItem(null);
                setDragOverStageId(null);
              }}
              className={`w-80 min-w-[20rem] flex-shrink-0 border rounded-2xl p-3.5 space-y-3 transition-all ${
                isDropTarget
                  ? col.isSensitive
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 ring-2 ring-amber-400/40'
                    : 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-400 ring-2 ring-brand-500/35'
                  : 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-surface-darkBorder'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-surface-darkBorder">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-950 dark:text-slate-100">{col.label}</span>
                  {col.isSensitive && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800">
                      Gated
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder">
                  {colCandidates.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 min-h-[300px] max-h-[65vh] overflow-y-auto pr-1">
                {colCandidates.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-xl text-center p-4">
                    <p className="text-xs text-slate-400">No candidates in this stage</p>
                  </div>
                ) : (
                  colCandidates.map((cand) => {
                    const isDragging = draggedItem?.candidate?.id === cand.id;
                    return (
                    <div
                      key={cand.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedItem({ candidate: cand, sourceStageId: col.id });
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(cand.id));
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverStageId(null);
                      }}
                      className={`cursor-grab active:cursor-grabbing transition-opacity ${
                        isDragging ? 'opacity-45' : 'opacity-100'
                      }`}
                    >
                    <GlareHover
                      glareColor="rgba(16, 185, 129, 0.14)"
                      className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder hover:border-brand-300 dark:hover:border-brand-600/60 rounded-xl p-3.5 shadow-subtle hover:shadow-card card-interactive transition-all space-y-2.5 group"
                    >
                      {/* Candidate Name, Drag Handle & Match Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <GripVertical
                            className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 mt-0.5 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                              className="text-[15px] font-bold text-navy-900 dark:text-slate-100 hover:text-brand-600 text-left transition-colors truncate block max-w-full"
                            >
                              {cand.name}
                            </button>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                              {cand.currentRole || 'Candidate Profile'}
                            </p>
                          </div>
                        </div>
                        {cand.matchScore != null && (
                          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/80 dark:border-brand-800 px-2 py-0.5 rounded-full flex-shrink-0">
                            {cand.matchScore}%
                          </span>
                        )}
                      </div>

                      {/* Location and Experience */}
                      <div className="text-[13px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{cand.location || 'Location not specified'}</span>
                        <span>•</span>
                        <span>{cand.experienceYears != null ? `${cand.experienceYears} yrs` : 'Exp not specified'}</span>
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
                      <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between gap-2 text-[13px]">
                        <button
                          onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                          className="text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white font-medium flex-shrink-0"
                        >
                          View Details
                        </button>

                        <CustomSelect
                          value=""
                          onChange={(targetStage) => {
                            if (targetStage) {
                              handleMoveCandidate(cand, targetStage);
                            }
                          }}
                          placeholder="Move to..."
                          ariaLabel={`Move ${cand.name} to stage`}
                          size="sm"
                          buttonClassName="!py-1 !px-2.5 !text-[13px] bg-slate-50 dark:bg-slate-800"
                          menuClassName="right-0 left-auto"
                          options={PIPELINE_STAGES.filter((s) => s.id !== col.id).map((target) => ({
                            value: target.id,
                            label: target.isSensitive ? `[Approve] ${target.label}` : `→ ${target.label}`,
                          }))}
                        />
                      </div>
                    </GlareHover>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
