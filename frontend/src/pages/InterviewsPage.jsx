// Import React and hooks for loading persisted interviews from SQLite.
import React, { useState, useEffect } from 'react';

// Import Badge component.
import { Badge } from '../components/common/Badge';

// Import candidate API service to fetch all persisted Interview rows.
import { candidateApi } from '../api/client';

// Import icons from lucide-react.
import { Calendar, User, Video, Clock, Eye, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

// Number of scheduled interviews shown before expanding.
const INTERVIEWS_DEFAULT_VISIBLE = 10;

// Export InterviewsPage component managing all scheduled rounds and interviewer assignments.
export const InterviewsPage = ({
  candidates = [],
  onSelectCandidate,
}) => {
  // Persisted interview rows returned directly from SQLite.
  const [interviews, setInterviews] = useState([]);
  // Loading and filter states.
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Load real interview rows from backend /api/candidates/interviews/all on mount.
  const loadInterviews = async () => {
    setIsLoading(true);
    try {
      const rows = await candidateApi.getInterviews();
      setInterviews(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn('Could not load interviews feed:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInterviews();
  }, [candidates.length]);

  // Normalize rows from SQLite without fabricating missing dates, interviewers, or meeting links.
  const interviewList = interviews.map((item) => ({
    id: item.id,
    candidateId: item.candidate_id,
    candidateName: item.candidate_name || 'Candidate',
    role: item.candidate_role || item.candidate_stage || 'Candidate Profile',
    round: item.round_name || 'Interview Round',
    status: item.status || 'Scheduled',
    interviewer: item.interviewer || 'Unassigned',
    date: item.scheduled_at ? item.scheduled_at.replace('T', ' ') : 'Date Not Set',
    meetingLink: item.meeting_link || '',
  }));

  // Apply status and keyword filters cleanly.
  const filteredInterviews = interviewList.filter((item) => {
    const matchesStatus = statusFilter === 'All' || item.status.toLowerCase() === statusFilter.toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.candidateName.toLowerCase().includes(q) ||
      item.round.toLowerCase().includes(q) ||
      item.interviewer.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  // Distinct interview statuses present in persisted SQLite records.
  const statusOptions = ['All', ...Array.from(new Set(interviewList.map((i) => i.status)))];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Interview Management</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {filteredInterviews.length} Scheduled
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Coordinate interview loops, view panel assignments, and inspect candidate evaluation rounds
          </p>
        </div>

        {/* Search, Filter & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, panel, round..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg text-navy-900 dark:text-slate-100"
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <button
            onClick={loadInterviews}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="w-full bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/70 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Candidate</th>
                <th className="py-3.5 px-4">Interview Round</th>
                <th className="py-3.5 px-4">Interviewer</th>
                <th className="py-3.5 px-4">Schedule Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder text-xs">
              {filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    {isLoading
                      ? 'Loading persisted interview records...'
                      : 'No interviews match the current filter. Open any candidate profile to schedule an interview.'}
                  </td>
                </tr>
              ) : (
                (showAll ? filteredInterviews : filteredInterviews.slice(0, INTERVIEWS_DEFAULT_VISIBLE)).map((item) => (
                  <tr key={item.id || `${item.candidateId}-${item.round}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Candidate */}
                    <td className="py-4 px-5">
                      <div className="font-semibold text-navy-900 dark:text-slate-100">{item.candidateName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">{item.role}</div>
                    </td>

                    {/* Round */}
                    <td className="py-4 px-4 font-medium text-navy-900 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.round}</span>
                      </div>
                    </td>

                    {/* Interviewer */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.interviewer}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.date}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <Badge variant="blue" size="xs">
                        {item.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.meetingLink ? (
                          <a
                            href={item.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Join</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 px-1.5">No link</span>
                        )}

                        <button
                          onClick={() => onSelectCandidate(item.candidateId)}
                          className="p-1.5 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Open Candidate Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredInterviews.length > INTERVIEWS_DEFAULT_VISIBLE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {showAll ? filteredInterviews.length : INTERVIEWS_DEFAULT_VISIBLE} of {filteredInterviews.length} interviews
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
                <span>Show More ({filteredInterviews.length - INTERVIEWS_DEFAULT_VISIBLE} more)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
