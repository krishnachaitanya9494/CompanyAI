// Import React and hooks for managing recruitment requisitions.
import React, { useState, useMemo } from 'react';

// Import requests subcomponents.
import { RequestList } from '../components/requests/RequestList';
import { RequestDetail } from '../components/requests/RequestDetail';
import { EmptyState } from '../components/common/EmptyState';

// Import icons from lucide-react.
import { GitPullRequest, Filter, Plus, CheckCircle2 } from 'lucide-react';

// Export RequestsPage component managing requisitions, priorities, and recruiters with customizable dropdowns.
export const RequestsPage = ({
  requests = [],
  onUpdateRequest,
  onCreateRequest,
  onNavigateJob,
}) => {
  // Active priority filter ('All', 'Urgent', 'High', 'Medium', 'Low').
  const [selectedPriority, setSelectedPriority] = useState('All');
  // Active status filter ('All', 'Open', 'In Progress', 'Fulfilled').
  const [selectedStatus, setSelectedStatus] = useState('All');
  // Selected request id for detail view modal.
  const [activeRequestId, setActiveRequestId] = useState(null);

  // Lookup active request dynamically so priority or recruiter updates immediately reflect in the modal.
  const activeRequest = useMemo(() => {
    return requests.find((r) => r.id === activeRequestId) || null;
  }, [requests, activeRequestId]);

  // Filter requests based on priority and status.
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedPriority !== 'All' && r.priority !== selectedPriority) {
        return false;
      }
      if (selectedStatus !== 'All' && r.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [requests, selectedPriority, selectedStatus]);

  // Render requests page.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <span>Recruitment Requisitions</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {filteredRequests.length} Active Requests
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track hiring priorities, recruiter assignments, and SLA milestones with customizable dropdown controls
          </p>
        </div>

        {/* Keep request creation connected to the SQLite API and quick status filters. */}
        <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white" onClick={async () => { const role = window.prompt('Role title'); if (role) await onCreateRequest?.({ role_title: role }); }}><Plus className="h-4 w-4" />New request</button>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 p-1 rounded-xl text-xs">
          {['All', 'Urgent', 'High', 'Medium'].map((prio) => (
            <button
              key={prio}
              onClick={() => setSelectedPriority(prio)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                selectedPriority === prio
                  ? 'bg-navy-900 text-white shadow-subtle'
                  : 'text-slate-500 hover:text-navy-900 hover:bg-slate-50'
              }`}
            >
              {prio}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Requests Table with Customizable Priority & Status Dropdowns */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={GitPullRequest}
          title="No requests match your filter"
          description="Try resetting priority or status filter."
          actionLabel="Show All Requests"
          onAction={() => {
            setSelectedPriority('All');
            setSelectedStatus('All');
          }}
        />
      ) : (
        <RequestList
          requests={filteredRequests}
          onSelectRequest={(req) => setActiveRequestId(req.id)}
          onUpdateRequest={onUpdateRequest}
        />
      )}

      {/* Requisition Detail Modal with Customizable Priority & Status Controls */}
      <RequestDetail
        request={activeRequest}
        isOpen={Boolean(activeRequest)}
        onClose={() => setActiveRequestId(null)}
        onViewJob={onNavigateJob}
        onUpdateRequest={onUpdateRequest}
      />
    </div>
  );
};
