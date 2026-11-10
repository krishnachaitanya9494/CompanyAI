// Import React for JSX structure.
import React from 'react';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import icons from lucide-react.
import { GitPullRequest, User, Building, Calendar, Clock, AlertCircle, FileText, CheckCircle2, ChevronDown } from 'lucide-react';

// Export RequestDetail component presenting requisition information with customizable controls.
export const RequestDetail = ({
  request,
  isOpen,
  onClose,
  onViewJob,
  onUpdateRequest,
}) => {
  // If request is null, do not render.
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
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Medium':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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
        <div className="p-4 bg-surface-50 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Department
            </span>
            <div className="text-xs font-semibold text-navy-900">{request.department}</div>
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
                  <option key={opt} value={opt} className="bg-white text-navy-900 font-normal">
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
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-navy-900 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
            <div className="text-xs font-bold text-navy-900">
              {request.filledPositions} of {request.targetPositions} positions filled
            </div>
          </div>
        </div>

        {/* Stakeholders & Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Hiring Manager info */}
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Hiring Manager
            </span>
            <div className="flex items-center gap-2 font-medium text-navy-900">
              <User className="w-4 h-4 text-slate-400" />
              <span>{request.hiringManager}</span>
            </div>
          </div>

          {/* Customizable Assigned Recruiter info */}
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
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
                className="w-full text-xs font-medium text-navy-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

          {/* Creation date */}
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Initiated On
            </span>
            <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{request.createdAt}</span>
            </div>
          </div>

          {/* SLA Deadline */}
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Target SLA Deadline
            </span>
            <div className="flex items-center gap-2 text-rose-600 font-semibold font-mono text-[11px]">
              <Clock className="w-4 h-4 text-rose-500" />
              <span>{request.slaDeadline}</span>
            </div>
          </div>
        </div>

        {/* Notes & Recruiter Strategy */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sourcing Strategy & Requisition Notes
          </h4>
          <textarea
            value={request.notes}
            onChange={(e) => {
              if (onUpdateRequest) {
                onUpdateRequest({ ...request, notes: e.target.value });
              }
            }}
            rows={3}
            className="w-full text-xs text-navy-900 leading-relaxed bg-white p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
            placeholder="Add requisition notes..."
          />
        </div>

        {/* Action button to view corresponding Job Description */}
        {request.jobId && onViewJob && (
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                onClose();
                onViewJob(request.jobId);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-medium shadow-subtle transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Open Linked Job Description & Candidate Matches</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
