// Import React for functional component structure.
import React from 'react';

// Import icons from lucide-react.
import { AlertTriangle, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

// Export ApprovalBanner component displaying pending sensitive AI operations requiring human confirmation.
export const ApprovalBanner = ({
  pendingApprovals = [],
  onApprove,
  onReject,
}) => {
  // If there are no pending approvals, render nothing.
  if (!pendingApprovals || pendingApprovals.length === 0) return null;

  // Render urgent banner for the most recent pending approval.
  const topApproval = pendingApprovals[0];

  return (
    <div className="mb-6 p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
      {/* Left side: alert badge and operation description */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700 flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 stroke-[2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-navy-950 uppercase tracking-wider">
              Human-in-the-Loop Confirmation Required
            </span>
            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-amber-200 font-semibold text-amber-800">
              {pendingApprovals.length} Pending
            </span>
          </div>
          <p className="text-xs text-navy-900 mt-0.5 font-medium">
            {topApproval.description}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">
            Requested by {topApproval.requester} • Action: {topApproval.actionType}
          </span>
        </div>
      </div>

      {/* Right side: Approve & Reject actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onApprove(topApproval.id)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-semibold shadow-subtle transition-all"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
          <span>Approve & Execute</span>
        </button>

        <button
          onClick={() => onReject(topApproval.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all"
        >
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
};
