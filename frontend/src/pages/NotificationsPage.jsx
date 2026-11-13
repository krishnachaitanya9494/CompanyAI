// Import React and hooks for unified Notifications & SQLite Activity Timeline workspace.
import React, { useState, useEffect, useMemo } from 'react';

// Import analyticsApi for querying real SQLite ActivityEvent logs.
import { analyticsApi } from '../api/client';

// Import Badge component and React Bits AnimatedList.
import { Badge } from '../components/common/Badge';
import { AnimatedList } from '../components/reactbits/AnimatedList';

// Import lucide-react icons.
import {
  Bell,
  Clock,
  ShieldCheck,
  Briefcase,
  User,
  Sparkles,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Number of notification events shown by default before expanding.
const EVENTS_DEFAULT_VISIBLE = 12;

// Export NotificationsPage displaying chronological workspace activity and alert acknowledgments.
export const NotificationsPage = ({
  pendingApprovals = [],
  onNavigateTab,
  onSelectCandidate,
  onSelectJob,
}) => {
  // Real SQLite activity event records fetched from /api/analytics/activities.
  const [events, setEvents] = useState([]);
  // Loading state.
  const [isLoading, setIsLoading] = useState(false);
  // Active entity filter ('all', 'candidate', 'job', 'approval').
  const [entityFilter, setEntityFilter] = useState('all');
  // Progressive disclosure toggle for long chronological activity feeds.
  const [showAll, setShowAll] = useState(false);

  // Track acknowledged/read event IDs in browser storage.
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('companyai-read-notifications');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Load real timeline events from backend SQLite database.
  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const params = { limit: 100 };
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      const list = await analyticsApi.getActivities(params);
      setEvents(list || []);
    } catch (err) {
      console.warn('Activities API error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [entityFilter]);

  // Mark individual notification as read.
  const handleMarkRead = (id) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    try {
      localStorage.setItem('companyai-read-notifications', JSON.stringify(Array.from(next)));
    } catch {}
  };

  // Mark all visible notifications as read.
  const handleMarkAllRead = () => {
    const next = new Set(readIds);
    events.forEach((e) => next.add(e.id));
    setReadIds(next);
    try {
      localStorage.setItem('companyai-read-notifications', JSON.stringify(Array.from(next)));
    } catch {}
  };

  // Count unread visible events.
  const unreadCount = useMemo(() => {
    return events.filter((e) => !readIds.has(e.id)).length;
  }, [events, readIds]);

  // Helper to return contextual icon per event type.
  const getEventIcon = (ev) => {
    if (ev.entityType === 'candidate') return User;
    if (ev.entityType === 'job') return Briefcase;
    if (ev.eventType?.includes('approval')) return ShieldCheck;
    return Sparkles;
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Notifications & Activity Timeline</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/60">
              {unreadCount} Unread
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Unified chronological feed of candidate updates, JD segmentations, matching evaluations, and approvals
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-brand-700 dark:text-brand-400 hover:bg-brand-50 shadow-subtle"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
          <button
            onClick={fetchActivities}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-subtle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Pending Approval Alerts Banner if Any Exist */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {pendingApprovals.length} Pending Approval(s) Awaiting Human Review
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Review sensitive state changes before candidate or requisition records are modified.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('approvals')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex-shrink-0"
          >
            Open Approvals
          </button>
        </div>
      )}

      {/* Entity Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-1.5 rounded-xl text-xs w-fit">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'candidate', label: 'Candidates' },
          { id: 'job', label: 'Jobs & JD Intel' },
          // Align tab filter value with backend SQLite recruitment_request / request activity mapping.
          { id: 'request', label: 'Requisitions' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setEntityFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              entityFilter === tab.id
                ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline Feed */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No timeline events found matching this category.
          </div>
        ) : (
          <AnimatedList
            items={showAll ? events : events.slice(0, EVENTS_DEFAULT_VISIBLE)}
            getItemKey={(ev) => ev.id}
            listClassName="divide-y divide-slate-100 dark:divide-surface-darkBorder"
            staggerMs={30}
            renderItem={(ev) => {
              const IconComp = getEventIcon(ev);
              const isRead = readIds.has(ev.id);
              return (
                <div
                  onClick={() => handleMarkRead(ev.id)}
                  className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                    !isRead
                      ? 'bg-brand-50/30 dark:bg-brand-950/20 hover:bg-brand-50/50'
                      : 'hover:bg-slate-50/70 dark:hover:bg-surface-darkHover/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        !isRead
                          ? 'bg-brand-50 dark:bg-brand-900/40 border-brand-200 dark:border-brand-700 text-brand-600 dark:text-brand-400'
                          : 'bg-slate-50 dark:bg-surface-darkHover border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isRead && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                        <span className="text-xs font-bold text-navy-900 dark:text-white">{ev.title}</span>
                        <Badge variant="neutral" size="xs">
                          {ev.entityType} #{ev.entityId}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ev.summary}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ev.formattedTime}
                    </span>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {events.length > EVENTS_DEFAULT_VISIBLE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {showAll ? events.length : EVENTS_DEFAULT_VISIBLE} of {events.length} activity events
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
                <span>Show More ({events.length - EVENTS_DEFAULT_VISIBLE} more)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
