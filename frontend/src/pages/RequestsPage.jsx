// Import React and hooks for managing recruitment requisitions.
import React, { useState, useMemo } from 'react';

// Import requests subcomponents and accessible Modal wrapper.
import { RequestList } from '../components/requests/RequestList';
import { RequestDetail } from '../components/requests/RequestDetail';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';

// Import icons from lucide-react.
import { GitPullRequest, Plus, CheckCircle2 } from 'lucide-react';

// Export RequestsPage component managing requisitions, priorities, and recruiters with customizable dropdowns.
export const RequestsPage = ({
  requests = [],
  jobs = [],
  onUpdateRequest,
  onCreateRequest,
  onRefreshApprovals,
  onNavigateJob,
}) => {
  // Active priority filter ('All', 'Urgent', 'High', 'Medium', 'Low').
  const [selectedPriority, setSelectedPriority] = useState('All');
  // Active status filter ('All', 'Open', 'In Progress', 'Fulfilled').
  const [selectedStatus, setSelectedStatus] = useState('All');
  // Selected request id for detail view modal.
  const [activeRequestId, setActiveRequestId] = useState(null);
  // Structured modal visibility and form inputs replacing browser window.prompt.
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newHiringManager, setNewHiringManager] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newTargetPositions, setNewTargetPositions] = useState(1);
  const [newLinkedJobId, setNewLinkedJobId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createNotice, setCreateNotice] = useState('');

  // Lookup active request dynamically so priority or recruiter updates immediately reflect in the modal.
  const activeRequest = useMemo(() => {
    return requests.find((r) => r.id === activeRequestId) || null;
  }, [requests, activeRequestId]);

  // Filter requests based on priority and status.
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedPriority !== 'All' && (r.priority || '').toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'All' && (r.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [requests, selectedPriority, selectedStatus]);

  // Submit structured Create Requisition modal form cleanly to FastAPI backend.
  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;
    setIsSubmittingCreate(true);
    try {
      await onCreateRequest?.({
        role_title: newRoleTitle.trim(),
        department: newDepartment.trim() || 'Engineering',
        hiring_manager: newHiringManager.trim() || 'Hiring Manager',
        priority: newPriority,
        target_positions: Number(newTargetPositions) || 1,
        job_id: newLinkedJobId ? Number(newLinkedJobId) : null,
        notes: newNotes.trim(),
      });
      setCreateNotice(`Requisition "${newRoleTitle.trim()}" created.`);
      setIsCreateOpen(false);
      setNewRoleTitle('');
      setNewNotes('');
      setTimeout(() => setCreateNotice(''), 4000);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Render requests page.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Recruitment Requisitions</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {filteredRequests.length} Requisitions
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track hiring priorities, recruiter assignments, and SLA milestones with customizable dropdown controls
          </p>
        </div>

        {/* Create button & quick priority filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-subtle transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Requisition</span>
          </button>
          <div className="flex items-center gap-1.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-1 rounded-xl text-xs">
            {['All', 'Urgent', 'High', 'Medium'].map((prio) => (
              <button
                key={prio}
                onClick={() => setSelectedPriority(prio)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedPriority === prio
                    ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                    : 'text-slate-500 dark:text-slate-300 hover:text-navy-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {prio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Notice */}
      {createNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{createNotice}</span>
        </div>
      )}

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

      {/* Requisition Detail Modal with Customizable Priority, Status, Notes & Approval Trigger */}
      <RequestDetail
        request={activeRequest}
        isOpen={Boolean(activeRequest)}
        onClose={() => setActiveRequestId(null)}
        onViewJob={onNavigateJob}
        onUpdateRequest={onUpdateRequest}
        onRefreshApprovals={onRefreshApprovals}
      />

      {/* Structured Create Requisition Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Hiring Requisition"
        subtitle="Create a tracked recruitment requisition in SQLite"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Role Title *</label>
            <input
              type="text"
              required
              value={newRoleTitle}
              onChange={(e) => setNewRoleTitle(e.target.value)}
              placeholder="e.g., Senior Oracle EPM Consultant"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">Department</label>
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">Hiring Manager</label>
              <input
                type="text"
                value={newHiringManager}
                onChange={(e) => setNewHiringManager(e.target.value)}
                placeholder="Manager name"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
              >
                {['Urgent', 'High', 'Medium', 'Low'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">Positions</label>
              <input
                type="number"
                min={1}
                value={newTargetPositions}
                onChange={(e) => setNewTargetPositions(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">Link Job Description</label>
              <select
                value={newLinkedJobId}
                onChange={(e) => setNewLinkedJobId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
              >
                <option value="">Unlinked</option>
                {jobs.slice(0, 35).map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Sourcing Notes</label>
            <textarea
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional sourcing notes or hiring SLA constraints..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-surface-darkBorder text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold"
            >
              {isSubmittingCreate ? 'Creating...' : 'Create Requisition'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
