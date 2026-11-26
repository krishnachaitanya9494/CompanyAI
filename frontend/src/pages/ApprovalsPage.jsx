// Import React and hooks for full end-to-end Governance & Approvals workflow.
import React, { useState, useEffect, useMemo } from 'react';

// Import approvalApi client service and shared Modal wrapper.
import { approvalApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

// Import lucide-react icons.
import {
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Check,
  X,
  Search,
  MessageSquareWarning,
  Eye,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Default number of approval records rendered per tab before Show More expansion.
const APPROVALS_DEFAULT_VISIBLE = 10;

// Export ApprovalsPage managing pending approvals, reviewer roles, comments, request-changes, and audit trail.
export const ApprovalsPage = ({
  onApproveAction,
  onRejectAction,
  onRequestChangesAction,
  onNavigateCandidate,
  onNavigateJob,
}) => {
  // Complete list of approval records loaded from /api/approvals/all.
  const [allApprovals, setAllApprovals] = useState([]);
  // Active workflow sub-tab ('pending' | 'approved' | 'rejected' | 'changes_requested' | 'my_submitted' | 'all').
  const [activeTab, setActiveTab] = useState('pending');
  // Action type filter and keyword search.
  const [actionFilter, setActionFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Selected reviewer identity & governance role aligned with backend AUTHORIZED_REVIEWER_ROLES.
  const [reviewerName, setReviewerName] = useState('Krishna C. (Recruiter Admin)');
  const [reviewerRole, setReviewerRole] = useState('Recruiter Admin');
  // Selected approval item opened in Detail Inspection Modal.
  const [selectedItem, setSelectedItem] = useState(null);
  const [reviewerComment, setReviewerComment] = useState('');
  // Loading, progressive disclosure, and feedback states.
  const [isLoading, setIsLoading] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Load enriched approval records from backend /api/approvals/all.
  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const all = await approvalApi.getAll();
      setAllApprovals(Array.isArray(all) ? all : []);
    } catch (err) {
      setStatusNotice({ type: 'error', text: `Failed to retrieve approvals: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  // Load fresh single-item context when opening detail modal.
  const handleInspectItem = async (item) => {
    setReviewerComment(item.reviewerComment || '');
    setSelectedItem(item);
    try {
      const fresh = await approvalApi.getById(item.id);
      if (fresh) setSelectedItem(fresh);
    } catch (err) {
      console.warn('Could not refresh approval detail:', err.message);
    }
  };

  // Derive badge counts cleanly from persisted records.
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, changes_requested: 0, my_submitted: 0, all: allApprovals.length };
    allApprovals.forEach((a) => {
      const st = (a.status || 'pending').toLowerCase();
      if (st === 'pending') c.pending += 1;
      else if (st === 'approved') c.approved += 1;
      else if (st === 'rejected') c.rejected += 1;
      else if (st === 'changes_requested') c.changes_requested += 1;
      if ((a.requester || '').toLowerCase().includes('krishna') || (a.requester || '').toLowerCase().includes('recruiter')) {
        c.my_submitted += 1;
      }
    });
    return c;
  }, [allApprovals]);

  // Distinct action types present in database for dropdown filter.
  const actionTypeOptions = useMemo(() => {
    return ['All', ...Array.from(new Set(allApprovals.map((a) => a.actionType).filter(Boolean)))];
  }, [allApprovals]);

  // Filter rows by active tab, action type, and search term.
  const visibleApprovals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allApprovals.filter((a) => {
      const st = (a.status || 'pending').toLowerCase();
      if (activeTab === 'pending' && st !== 'pending') return false;
      if (activeTab === 'approved' && st !== 'approved') return false;
      if (activeTab === 'rejected' && st !== 'rejected') return false;
      if (activeTab === 'changes_requested' && st !== 'changes_requested') return false;
      if (
        activeTab === 'my_submitted' &&
        !(a.requester || '').toLowerCase().includes('krishna') &&
        !(a.requester || '').toLowerCase().includes('recruiter')
      ) {
        return false;
      }
      if (actionFilter !== 'All' && a.actionType !== actionFilter) return false;
      if (q) {
        const hay = `${a.id} ${a.actionType} ${a.description} ${a.requester} ${a.executionResult || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allApprovals, activeTab, actionFilter, searchQuery]);

  // Execute Approve, Reject, or Request Changes decision with reviewer comment & role validation.
  const executeDecision = async (decision, item, commentText = '') => {
    setIsActing(true);
    setStatusNotice(null);
    try {
      if (decision === 'approve') {
        if (onApproveAction) {
          await onApproveAction(item.id, commentText, reviewerName, reviewerRole);
        } else {
          await approvalApi.approve(item.id, reviewerName, reviewerRole, commentText);
        }
        setStatusNotice({ type: 'success', text: `Approval #${item.id} approved and executed.` });
      } else if (decision === 'reject') {
        if (onRejectAction) {
          await onRejectAction(item.id, commentText, reviewerName, reviewerRole);
        } else {
          await approvalApi.reject(item.id, reviewerName, reviewerRole, commentText);
        }
        setStatusNotice({ type: 'success', text: `Approval #${item.id} rejected.` });
      } else if (decision === 'request_changes') {
        if (onRequestChangesAction) {
          await onRequestChangesAction(item.id, commentText, reviewerName, reviewerRole);
        } else {
          await approvalApi.requestChanges(item.id, reviewerName, reviewerRole, commentText);
        }
        setStatusNotice({ type: 'success', text: `Changes requested on Approval #${item.id}.` });
      }
      setSelectedItem(null);
      setReviewerComment('');
      await fetchApprovals();
    } catch (err) {
      setStatusNotice({ type: 'error', text: err.message || 'Governance action failed.' });
    } finally {
      setIsActing(false);
    }
  };

  // Detect whether current active reviewer identity matches request submitter (self-approval guard preview).
  const isSelfReviewer = (item) => {
    return (item?.requester || '').trim().toLowerCase() === reviewerName.trim().toLowerCase();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Governance & Human Approvals</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {counts.pending} Pending
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enforce separation of duties, review linked entity context, and audit every decision ({counts.all} SQLite records)
          </p>
        </div>

        {/* Active Reviewer Context Switcher & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={reviewerRole}
            onChange={(e) => setReviewerRole(e.target.value)}
            title="Reviewer Governance Role"
            className="px-2.5 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-medium text-navy-900 dark:text-slate-100"
          >
            <option value="Recruiter Admin">Role: Recruiter Admin</option>
            <option value="Hiring Manager">Role: Hiring Manager</option>
            <option value="Talent Lead">Role: Talent Lead</option>
            <option value="Standard Recruiter">Role: Standard Recruiter (Read-Only)</option>
          </select>

          <button
            onClick={fetchApprovals}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-subtle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusNotice.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800 text-brand-900 dark:text-brand-200'
          }`}
        >
          <span>{statusNotice.text}</span>
          <button onClick={() => setStatusNotice(null)}>
            <X className="w-4 h-4 opacity-70" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-1 rounded-xl text-xs">
          {[
            { id: 'pending', label: `Pending (${counts.pending})` },
            { id: 'approved', label: `Approved (${counts.approved})` },
            { id: 'changes_requested', label: `Changes Requested (${counts.changes_requested})` },
            { id: 'rejected', label: `Rejected (${counts.rejected})` },
            { id: 'my_submitted', label: `My Submitted (${counts.my_submitted})` },
            { id: 'all', label: `All History (${counts.all})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                  : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, requester..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
          >
            {actionTypeOptions.map((act) => (
              <option key={act} value={act}>
                {act === 'All' ? 'All Operations' : act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Approvals List / Audit Table */}
      {visibleApprovals.length === 0 ? (
        <div className="p-12 bg-white dark:bg-surface-darkCard border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-navy-900 dark:text-white">No Approval Records Match View</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Requests proposed from Candidate Profiles, Pipeline Kanban, Jobs, Requisitions, or CompanyAI appear here for review.
          </p>
        </div>
      ) : activeTab === 'pending' || activeTab === 'changes_requested' ? (
        <div className="space-y-3">
          {(showAll ? visibleApprovals : visibleApprovals.slice(0, APPROVALS_DEFAULT_VISIBLE)).map((item) => {
            const selfBlocked = isSelfReviewer(item);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-surface-darkCard border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                      REQ #{item.id} • {item.actionType}
                    </span>
                    <Badge variant="neutral" size="xs">
                      By: {item.requester}
                    </Badge>
                    <Badge variant={item.status === 'changes_requested' ? 'amber' : 'brand'} size="xs">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-navy-900 dark:text-white">{item.description}</p>
                  {item.whyRequired && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{item.whyRequired}</p>
                  )}
                  {item.reviewerComment && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      Reviewer Note: {item.reviewerComment}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 font-mono">
                    Created: {item.createdAtDisplay || item.createdAt} • Reviewer Group: {item.assignedReviewer || 'Hiring Manager / Admin'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleInspectItem(item)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Details</span>
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => executeDecision('reject', item)}
                    className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    disabled={isActing || selfBlocked}
                    title={selfBlocked ? 'Self-approval blocked by governance policy' : 'Approve & execute action'}
                    onClick={() => executeDecision('approve', item)}
                    className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-subtle flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-surface-darkHover border-b border-slate-200/80 dark:border-surface-darkBorder text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Description & Result</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Resolved By</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                {(showAll ? visibleApprovals : visibleApprovals.slice(0, APPROVALS_DEFAULT_VISIBLE)).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-surface-darkHover/40">
                    <td className="py-3 px-4 font-mono text-slate-500">#{log.id}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-navy-900 dark:text-slate-200">
                      {log.actionType}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="font-medium text-navy-900 dark:text-white">{log.description}</p>
                      {log.executionResult && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Result: {log.executionResult}
                        </p>
                      )}
                      {log.reviewerComment && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5">
                          Comment: {log.reviewerComment}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{log.requester}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          log.status === 'approved'
                            ? 'success'
                            : log.status === 'rejected'
                            ? 'danger'
                            : log.status === 'changes_requested'
                            ? 'amber'
                            : 'brand'
                        }
                        size="xs"
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {log.resolvedBy || '—'}
                      {log.resolvedAt && <span className="block text-[10px]">{log.resolvedAt}</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleInspectItem(log)}
                        className="p-1.5 text-slate-400 hover:text-navy-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Inspect Approval Detail"
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
      )}

      {visibleApprovals.length > APPROVALS_DEFAULT_VISIBLE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {showAll ? visibleApprovals.length : APPROVALS_DEFAULT_VISIBLE} of {visibleApprovals.length} approval records
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                <span>Show More ({visibleApprovals.length - APPROVALS_DEFAULT_VISIBLE} more)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Rich Approval Inspection & Decision Modal */}
      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `Approval Request #${selectedItem.id}` : ''}
        subtitle={selectedItem?.actionType}
        maxWidth="max-w-2xl"
      >
        {selectedItem && (
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-slate-800/60 border border-slate-200 dark:border-surface-darkBorder space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-navy-900 dark:text-white text-sm">{selectedItem.description}</span>
                <Badge variant={selectedItem.status === 'approved' ? 'success' : selectedItem.status === 'rejected' ? 'danger' : 'brand'} size="xs">
                  {selectedItem.status}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Policy Rationale:</strong> {selectedItem.whyRequired || 'Governance authorization required before mutating hiring state.'}
              </p>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span><strong>Requester:</strong> {selectedItem.requester}</span>
                <span><strong>Assigned Reviewer:</strong> {selectedItem.assignedReviewer}</span>
                <span><strong>Submitted:</strong> {selectedItem.createdAtDisplay || selectedItem.createdAt}</span>
              </div>
            </div>

            {/* Linked Candidate / Job / Request Entity Card */}
            {selectedItem.relatedContext && Object.keys(selectedItem.relatedContext).length > 0 && (
              <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Live Related Record ({selectedItem.relatedContext.entityType})
                </span>
                {selectedItem.relatedContext.entityType === 'candidate' && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-navy-900 dark:text-white">{selectedItem.relatedContext.name}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Current Stage: {selectedItem.relatedContext.currentStage} • {selectedItem.relatedContext.location || 'Location N/A'}
                      </p>
                    </div>
                    {onNavigateCandidate && (
                      <button
                        onClick={() => {
                          setSelectedItem(null);
                          onNavigateCandidate(selectedItem.relatedContext.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800"
                      >
                        <span>Open Candidate</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                {selectedItem.relatedContext.entityType === 'job' && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-navy-900 dark:text-white">{selectedItem.relatedContext.title}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Status: {selectedItem.relatedContext.status} • Client: {selectedItem.relatedContext.client || 'Internal'}
                      </p>
                    </div>
                    {onNavigateJob && (
                      <button
                        onClick={() => {
                          setSelectedItem(null);
                          onNavigateJob(selectedItem.relatedContext.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800"
                      >
                        <span>Open Job</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                {selectedItem.relatedContext.entityType === 'request' && (
                  <div>
                    <p className="font-bold text-navy-900 dark:text-white">
                      {selectedItem.relatedContext.reqNumber} — {selectedItem.relatedContext.roleTitle}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Status: {selectedItem.relatedContext.status} • Priority: {selectedItem.relatedContext.priority}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Self-approval warning if reviewer name matches requester */}
            {isSelfReviewer(selectedItem) && selectedItem.status === 'pending' && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Self-approval notice: Requester identity matches active reviewer; backend separation-of-duties blocks self-approval.</span>
              </div>
            )}

            {/* Reviewer Decision Controls for Pending / Changes Requested items */}
            {(selectedItem.status === 'pending' || selectedItem.status === 'changes_requested') && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Reviewer Comment / Decision Rationale:
                  </label>
                  <textarea
                    rows={3}
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    placeholder="Enter feedback, conditions, or approval rationale..."
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    disabled={isActing}
                    onClick={() => executeDecision('reject', selectedItem, reviewerComment)}
                    className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => executeDecision('request_changes', selectedItem, reviewerComment)}
                    className="px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                  <button
                    disabled={isActing || isSelfReviewer(selectedItem)}
                    onClick={() => executeDecision('approve', selectedItem, reviewerComment)}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Execute</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
