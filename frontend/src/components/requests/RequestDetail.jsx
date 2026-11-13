// Import React hooks for notes drafting and governance approval requests.
import React, { useState, useEffect } from 'react';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import approvalApi to allow requisition sign-off requests.
import { approvalApi } from '../../api/client';

// Import icons from lucide-react.
import { User, Calendar, Clock, FileText, ChevronDown, ShieldCheck, Save } from 'lucide-react';

// Export RequestDetail component presenting requisition information with customizable controls.
export const RequestDetail = ({
  request,
  isOpen,
  onClose,
  onViewJob,
  onUpdateRequest,
  onRefreshApprovals,
}) => {
  // Maintain local draft for notes so typing does not spam PATCH calls on every keystroke.
  const [notesDraft, setNotesDraft] = useState(request?.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState('');

  useEffect(() => {
    setNotesDraft(request?.notes || '');
    setNotesSaved(false);
    setApprovalFeedback('');
  }, [request?.id, request?.notes]);

  // If request is null, do not render after hooks.
  if (!request) return null;

  // Available priorities list for user customization.
  const priorityOptions = ['Urgent', 'High', 'Medium', 'Low'];

  // Available requisition statuses.
  const statusOptions = ['Open', 'In Progress', 'Under Review', 'Fulfilled', 'On Hold'];

  // Available recruiters list.
  const recruiterOptions = ['Ananya Sharma', 'Karthik Nair', 'Rohan Varma', 'Priya Sundaram', 'Unassigned'];

  // Helper to map priority strings to styling classes.
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'High':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Medium':
        return 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  // Persist notes cleanly on explicit Save button click.
  const handleSaveNotes = async () => {
    if (!onUpdateRequest) return;
    await onUpdateRequest({ ...request, notes: notesDraft });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  };

  // Propose human-in-the-loop requisition sign-off in Governance Approvals.
  const handleProposeRequisitionApproval = async () => {
    setApprovalFeedback('');
    try {
      await approvalApi.propose({
        action_type: 'approve_requisition',
        description: `Approve requisition ${request.reqNumber} (${request.roleTitle})`,
        payload: {
          request_id: request.id,
          req_number: request.reqNumber,
          role_title: request.roleTitle,
        },
        requester: 'Krishna C. (Recruiter)',
      });
      setApprovalFeedback('Requisition approval request queued in Approvals tab.');
      if (onRefreshApprovals) {
        await onRefreshApprovals();
      }
    } catch (err) {
      setApprovalFeedback(`Failed to propose approval: ${err.message}`);
    }
  };

  // Render modal drawer.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={request.roleTitle}
      subtitle={`Requisition ID: ${request.reqNumber}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Top requisition metadata card */}
        <div className="p-4 bg-surface-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Department
            </span>
            <div className="text-xs font-semibold text-navy-900 dark:text-slate-100">{request.department || 'Not specified'}</div>
          </div>

          {/* Interactive Priority Dropdown Selector */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Priority (Customize)
            </span>
            <div className="relative inline-block">
              <select
                value={request.priority}
                onChange={(e) => {
                  if (onUpdateRequest) {
                    onUpdateRequest({ ...request, priority: e.target.value });
                  }
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${getPriorityStyle(
                  request.priority
                )}`}
              >
                {priorityOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 font-normal">
                    {opt} Priority
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 pointer-events-none opacity-60" />
            </div>
          </div>

          {/* Interactive Status Dropdown Selector */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Requisition Status
            </span>
            <div className="relative inline-block">
              <select
                value={request.status}
                onChange={(e) => {
                  if (onUpdateRequest) {
                    onUpdateRequest({ ...request, status: e.target.value });
                  }
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 pointer-events-none text-slate-400" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Fulfillment Target
            </span>
            <div className="text-xs font-bold text-navy-900 dark:text-slate-100">
              {request.filledPositions} of {request.targetPositions} positions filled
            </div>
          </div>
        </div>

        {/* Stakeholders & Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Hiring Manager
            </span>
            <div className="flex items-center gap-2 font-medium text-navy-900 dark:text-slate-100">
              <User className="w-4 h-4 text-slate-400" />
              <span>{request.hiringManager || 'Unassigned'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Assigned Talent Partner (Change)
            </span>
            <div className="relative">
              <select
                value={request.assignedRecruiter}
                onChange={(e) => {
                  if (onUpdateRequest) {
                    onUpdateRequest({ ...request, assignedRecruiter: e.target.value });
                  }
                }}
                className="w-full text-xs font-medium text-navy-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg px-2.5 py-1.5 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {recruiterOptions.map((rec) => (
                  <option key={rec} value={rec}>
                    {rec}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Initiated On
            </span>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{request.createdAt || 'Not recorded'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Target SLA Deadline
            </span>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold font-mono text-[11px]">
              <Clock className="w-4 h-4 text-rose-500" />
              <span>{request.slaDeadline || 'No deadline set'}</span>
            </div>
          </div>
        </div>

        {/* Notes & Recruiter Strategy with Save button */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sourcing Strategy & Requisition Notes
            </h4>
            <button
              type="button"
              onClick={handleSaveNotes}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-navy-900 dark:text-slate-200 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{notesSaved ? 'Saved!' : 'Save Notes'}</span>
            </button>
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            className="w-full text-xs text-navy-900 dark:text-slate-100 leading-relaxed bg-white dark:bg-surface-darkCard p-3 border border-slate-200 dark:border-surface-darkBorder rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
            placeholder="Add requisition notes..."
          />
        </div>

        {/* Footer Actions: Linked JD + Submit Approval */}
        <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder flex flex-wrap items-center gap-2">
          {(request.jobNumericId || request.jobId) && onViewJob && (
            <button
              onClick={() => {
                onClose();
                onViewJob(request.jobNumericId || request.jobId);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 text-white rounded-xl text-xs font-medium shadow-subtle transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Open Linked Job Description</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleProposeRequisitionApproval}
            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit for Approval</span>
          </button>
        </div>

        {approvalFeedback && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
            {approvalFeedback}
          </div>
        )}
      </div>
    </Modal>
  );
};
