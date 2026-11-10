// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import { GitPullRequest, Calendar, User, Eye, AlertCircle, Clock, ChevronDown } from 'lucide-react';

// Export RequestList component displaying recruitment requisitions with customizable dropdowns.
export const RequestList = ({
  requests = [],
  onSelectRequest,
  onUpdateRequest,
}) => {
  // Available priority options for user customization.
  const priorityOptions = ['Urgent', 'High', 'Medium', 'Low'];

  // Available status options for user customization.
  const statusOptions = ['Open', 'In Progress', 'Under Review', 'Fulfilled', 'On Hold'];

  // Available recruiters list.
  const recruiterOptions = ['Ananya Sharma', 'Karthik Nair', 'Rohan Varma', 'Unassigned'];

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

  // Helper to map request status to styling classes.
  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Progress':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'Fulfilled':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Under Review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'On Hold':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  // Render requests table.
  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table head */}
          <thead>
            <tr className="border-b border-slate-100 bg-surface-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-5">Req Number</th>
              <th className="py-3.5 px-4">Role Title</th>
              <th className="py-3.5 px-4">Department</th>
              <th className="py-3.5 px-4">Priority (Customizable)</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Assigned Recruiter</th>
              <th className="py-3.5 px-4">Positions</th>
              <th className="py-3.5 px-4">SLA Deadline</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {requests.map((req) => (
              <tr
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
              >
                {/* Requisition Number code */}
                <td className="py-4 px-5">
                  <span className="font-mono font-semibold text-navy-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                    {req.reqNumber}
                  </span>
                </td>

                {/* Role Title */}
                <td className="py-4 px-4 font-semibold text-navy-900 group-hover:text-brand-700 transition-colors">
                  {req.roleTitle}
                </td>

                {/* Department */}
                <td className="py-4 px-4 text-slate-500">{req.department}</td>

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
                        <option key={opt} value={opt} className="bg-white text-navy-900 font-normal">
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
                        <option key={opt} value={opt} className="bg-white text-navy-900 font-normal">
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
                      className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg px-2 py-1 appearance-none pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                  <span className="font-semibold text-navy-900">{req.filledPositions}</span>
                  <span className="text-slate-400"> / {req.targetPositions} filled</span>
                </td>

                {/* SLA Deadline */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{req.slaDeadline}</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectRequest(req)}
                    className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
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
    </div>
  );
};
