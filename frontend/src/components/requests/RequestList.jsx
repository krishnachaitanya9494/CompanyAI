// Import React and useState for progressive disclosure.
import React, { useState } from 'react';

// Import icons from lucide-react.
import { Clock, Eye, ChevronDown, ChevronUp } from 'lucide-react';

// Default number of requisitions shown before expanding.
const REQUESTS_DEFAULT_VISIBLE = 10;

// Export RequestList component displaying recruitment requisitions with customizable dropdowns.
export const RequestList = ({
  requests = [],
  onSelectRequest,
  onUpdateRequest,
}) => {
  const [showAll, setShowAll] = useState(false);
  // Available priority options for user customization.
  const priorityOptions = ['Urgent', 'High', 'Medium', 'Low'];

  // Available status options for user customization.
  const statusOptions = ['Open', 'In Progress', 'Under Review', 'Fulfilled', 'On Hold'];

  // Available recruiters list.
  const recruiterOptions = ['Ananya Sharma', 'Karthik Nair', 'Rohan Varma', 'Unassigned'];

  // Helper to map priority strings to styling classes with Light & Dark theme support.
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

  // Helper to map request status to styling classes with Light & Dark theme support.
  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Progress':
        return 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800';
      case 'Fulfilled':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Under Review':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'On Hold':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  // Render requests table.
  return (
    <div className="w-full bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table head */}
          <thead>
            <tr className="border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/70 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-5">Req Number</th>
              <th className="py-3.5 px-4">Role Title</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Assigned Recruiter</th>
              <th className="py-3.5 px-4">Positions</th>
              <th className="py-3.5 px-4">SLA Deadline</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder text-xs">
            {(showAll ? requests : requests.slice(0, REQUESTS_DEFAULT_VISIBLE)).map((req) => (
              <tr
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
              >
                {/* Requisition Number code */}
                <td className="py-4 px-5">
                  <span className="font-mono font-semibold text-navy-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/70 dark:border-slate-700">
                    {req.reqNumber}
                  </span>
                </td>

                {/* Role Title */}
                <td className="py-4 px-4 font-semibold text-navy-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                  {req.roleTitle}
                </td>

                {/* Department */}
                <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{req.department}</td>

                {/* Customizable Priority Dropdown */}
                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block">
                    <select
                      value={req.priority}
                      onChange={(e) => {
                        if (onUpdateRequest) {
                          onUpdateRequest({ ...req, priority: e.target.value });
                        }
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all ${getPriorityStyle(
                        req.priority
                      )}`}
                    >
                      {priorityOptions.map((opt) => (
                        <option key={opt} value={opt} className="bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 font-normal">
                          {opt} Priority
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 pointer-events-none opacity-60" />
                  </div>
                </td>

                {/* Customizable Status Dropdown */}
                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block">
                    <select
                      value={req.status}
                      onChange={(e) => {
                        if (onUpdateRequest) {
                          onUpdateRequest({ ...req, status: e.target.value });
                        }
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all ${getStatusStyle(
                        req.status
                      )}`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt} className="bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 font-normal">
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 pointer-events-none opacity-60" />
                  </div>
                </td>

                {/* Customizable Assigned Recruiter Dropdown */}
                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block">
                    <select
                      value={req.assignedRecruiter}
                      onChange={(e) => {
                        if (onUpdateRequest) {
                          onUpdateRequest({ ...req, assignedRecruiter: e.target.value });
                        }
                      }}
                      className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-surface-darkBorder rounded-lg px-2 py-1 appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      {recruiterOptions.map((rec) => (
                        <option key={rec} value={rec}>
                          {rec}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
                  </div>
                </td>

                {/* Target vs Filled Positions */}
                <td className="py-4 px-4">
                  <span className="font-semibold text-navy-900 dark:text-white">{req.filledPositions}</span>
                  <span className="text-slate-400"> / {req.targetPositions} filled</span>
                </td>

                {/* SLA Deadline */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{req.slaDeadline}</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectRequest(req)}
                    className="p-1.5 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="View Request Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {requests.length > REQUESTS_DEFAULT_VISIBLE && (
        <div className="p-3 border-t border-slate-100 dark:border-surface-darkBorder bg-surface-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Showing {showAll ? requests.length : REQUESTS_DEFAULT_VISIBLE} of {requests.length} requisitions
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 font-semibold text-navy-900 dark:text-slate-100 transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                <span>Show More ({requests.length - REQUESTS_DEFAULT_VISIBLE} more)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
