// Import React and hooks for grouping grounded enterprise client accounts from real job and request records.
import React, { useState, useMemo } from 'react';

// Import common Badge component.
import { Badge } from '../components/common/Badge';

// Import lucide-react icons.
import { Building, ArrowRight, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

// Number of client accounts and client-linked jobs shown before "Show More".
const CLIENTS_DEFAULT_VISIBLE = 5;
const CLIENT_JOBS_DEFAULT_VISIBLE = 5;

// Export ClientsPage displaying actual client organizations extracted from SQLite job records.
export const ClientsPage = ({
  jobs = [],
  requests = [],
  candidates = [],
  onSelectJob,
}) => {
  // Selected client key for detail inspection.
  const [selectedClientName, setSelectedClientName] = useState(null);
  // Progressive disclosure toggles for large client lists and client job specifications.
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Group jobs and requisitions strictly by database clientName without flattening Acme Global into generic buckets.
  const clientGroups = useMemo(() => {
    const map = {};
    jobs.forEach((j) => {
      // Read clientName emitted by toJob() or fallback to raw client field before internal default.
      const rawClient = j.clientName || j.client || '';
      const cName = rawClient.trim() ? rawClient.trim() : 'Internal Unassigned Practice';
      if (!map[cName]) {
        map[cName] = {
          name: cName,
          jobs: [],
          activeCount: 0,
          locations: new Set(),
        };
      }
      map[cName].jobs.push(j);
      // Normalize case when counting Active and Open roles.
      const st = (j.status || '').trim().toLowerCase();
      if (st === 'active' || st === 'open') {
        map[cName].activeCount += 1;
      }
      if (j.location) map[cName].locations.add(j.location);
    });

    return Object.values(map).sort((a, b) => b.jobs.length - a.jobs.length);
  }, [jobs]);

  // Active client object (defaults to primary client).
  const activeClient = useMemo(() => {
    return clientGroups.find((c) => c.name === selectedClientName) || clientGroups[0] || null;
  }, [clientGroups, selectedClientName]);

  // Associate recruitment requests linked via integer jobNumericId to the active client's jobs.
  const clientRequests = useMemo(() => {
    if (!activeClient) return [];
    const clientJobIds = new Set(activeClient.jobs.map((j) => Number(j.numeric_id || j.id)));
    return requests.filter((r) => {
      const linkedNumeric = r.jobNumericId ?? (typeof r.jobId === 'string' ? Number.parseInt(r.jobId.replace(/^job-/i, ''), 10) : r.job_id);
      return linkedNumeric != null && !Number.isNaN(linkedNumeric) && clientJobIds.has(Number(linkedNumeric));
    });
  }, [activeClient, requests]);

  // Compute candidate submission counts grounded in active pipeline stages.
  const submissionCount = useMemo(() => {
    return candidates.filter((c) =>
      ['Shortlisted', 'Technical Round 1', 'Technical Round 2', 'Technical Rounds', 'Manager Round', 'Offer Extended', 'Hired'].includes(
        c.status || c.stage
      )
    ).length;
  }, [candidates]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Clients & Accounts</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-surface-darkHover text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {clientGroups.length} Active Accounts
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Client organizations derived directly from SQLite job descriptions and associated hiring requisitions
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SQLite Grounded Client Directory</span>
        </div>
      </div>

      {/* Two-Column Client List & Account Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Client Directory Cards with Show More / Show Less */}
        <div className="space-y-3">
          {(showAllClients ? clientGroups : clientGroups.slice(0, CLIENTS_DEFAULT_VISIBLE)).map((client) => {
            const isSelected = activeClient && activeClient.name === client.name;
            return (
              <button
                key={client.name}
                onClick={() => {
                  setSelectedClientName(client.name);
                  setShowAllJobs(false);
                }}
                className={`w-full text-left p-4 rounded-2xl border card-interactive transition-all ${
                  isSelected
                    ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 shadow-card'
                    : 'bg-white dark:bg-surface-darkCard border-slate-200/80 dark:border-surface-darkBorder hover:border-slate-300 shadow-subtle'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 flex items-center justify-center text-navy-900 dark:text-white shadow-subtle">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy-900 dark:text-white">{client.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {client.jobs.length} Total Roles • {client.activeCount} Active
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {clientGroups.length > CLIENTS_DEFAULT_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAllClients((prev) => !prev)}
              className="w-full py-2 px-3 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle flex items-center justify-center gap-1.5 transition-colors"
            >
              {showAllClients ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                  <span>Show Fewer Accounts</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                  <span>Show All Accounts ({clientGroups.length - CLIENTS_DEFAULT_VISIBLE} more)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Active Client Details, Jobs & Requisitions */}
        {activeClient && (
          <div className="lg:col-span-2 space-y-6">
            {/* Client Summary Header */}
            <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-surface-darkBorder">
                <div>
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white">{activeClient.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Locations: {Array.from(activeClient.locations).slice(0, 4).join(', ') || 'Multiple Locations'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Total Jobs</span>
                    <span className="text-sm font-extrabold text-navy-900 dark:text-white font-mono">
                      {activeClient.jobs.length}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Active Pipeline</span>
                    <span className="text-sm font-extrabold text-brand-700 dark:text-brand-400 font-mono">
                      {submissionCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Associated Jobs List with Show More / Show Less Progressive Disclosure */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Associated Job Descriptions ({activeClient.jobs.length})
                  </h4>
                  {activeClient.jobs.length > CLIENT_JOBS_DEFAULT_VISIBLE && (
                    <span className="text-[11px] text-slate-400">
                      Showing {showAllJobs ? activeClient.jobs.length : CLIENT_JOBS_DEFAULT_VISIBLE} of {activeClient.jobs.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {(showAllJobs ? activeClient.jobs : activeClient.jobs.slice(0, CLIENT_JOBS_DEFAULT_VISIBLE)).map((job) => (
                    <div
                      key={job.id}
                      className="p-3 rounded-xl bg-slate-50/70 dark:bg-surface-darkHover/50 border border-slate-200/70 dark:border-surface-darkBorder card-interactive flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-900 dark:text-white truncate">
                            {job.title}
                          </span>
                          <Badge variant={(job.status || '').toLowerCase() === 'active' ? 'success' : 'neutral'} size="xs">
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {job.location || 'Location not specified'} • Exp: {job.experienceRequired || 'Not specified'}
                        </p>
                      </div>
                      <button
                        onClick={() => onSelectJob && onSelectJob(job.id)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-slate-700 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 flex items-center gap-1 flex-shrink-0"
                      >
                        <span>Open Job</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {activeClient.jobs.length > CLIENT_JOBS_DEFAULT_VISIBLE && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAllJobs((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 text-xs font-semibold text-navy-900 dark:text-slate-100 transition-colors"
                    >
                      {showAllJobs ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                          <span>Show Less</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                          <span>Show More ({activeClient.jobs.length - CLIENT_JOBS_DEFAULT_VISIBLE} more)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Associated Recruitment Requests */}
              {clientRequests.length > 0 && (
                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-surface-darkBorder space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Linked Recruitment Requisitions ({clientRequests.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {clientRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-brand-700 dark:text-brand-400">
                            {req.reqNumber || req.req_number}
                          </span>
                          <Badge variant={req.priority === 'Urgent' ? 'danger' : 'brand'} size="xs">
                            {req.priority}
                          </Badge>
                        </div>
                        <p className="font-semibold text-navy-900 dark:text-white mt-1">
                          {req.roleTitle || req.role_title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Owner: {req.assignedRecruiter || req.assigned_recruiter || 'Talent Team'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
