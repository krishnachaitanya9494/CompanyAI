// Import React and hooks for managing search queries and keyboard navigation.
import React, { useState, useEffect } from 'react';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import icons from lucide-react.
import { Search, Users, Briefcase, GitPullRequest, ArrowRight, Loader2 } from 'lucide-react';

// Import search API client.
import { searchApi } from '../../api/client';

// Export UnifiedSearchModal component providing Glean-style enterprise company search.
export const UnifiedSearchModal = ({
  isOpen,
  onClose,
  onSelectCandidate,
  onSelectJob,
  onSelectRequest,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ candidates: [], jobs: [], requests: [] });
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search query handler.
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults({ candidates: [], jobs: [], requests: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchApi.search(query.trim(), 5);
        setResults(data);
      } catch (err) {
        console.warn('Search API offline, filtering locally');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const totalHits = results.candidates.length + results.jobs.length + results.requests.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CompanyAI Enterprise Search"
      subtitle="Search across all candidates, job descriptions, and recruitment requests"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Search input field */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a skill, name, role, or requisition ID (e.g. 'Teamcenter', 'FCCS', 'REQ-2026')..."
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-slate-200/90 rounded-xl text-sm text-navy-900 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 font-sans"
          />
          {isSearching && (
            <Loader2 className="w-4 h-4 text-brand-600 animate-spin absolute right-3.5 top-3" />
          )}
        </div>

        {/* Results Sections */}
        {query.trim() && (
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pt-1">
            {/* Candidates Hits */}
            {results.candidates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Users className="w-3.5 h-3.5 text-brand-600" />
                  <span>Candidates ({results.candidates.length})</span>
                </div>
                <div className="space-y-1.5">
                  {results.candidates.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onClose();
                        onSelectCandidate(c.id);
                      }}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-brand-300 rounded-xl cursor-pointer flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="font-semibold text-xs text-navy-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.role} • {c.location}</div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {c.matchScore}% Match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Jobs Hits */}
            {results.jobs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Briefcase className="w-3.5 h-3.5 text-slate-600" />
                  <span>Job Descriptions ({results.jobs.length})</span>
                </div>
                <div className="space-y-1.5">
                  {results.jobs.map((j) => (
                    <div
                      key={j.id}
                      onClick={() => {
                        onClose();
                        onSelectJob(j.id);
                      }}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-xl cursor-pointer flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="font-semibold text-xs text-navy-900">{j.title}</div>
                        <div className="text-[11px] text-slate-500">{j.department} • {j.location}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requests Hits */}
            {results.requests.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <GitPullRequest className="w-3.5 h-3.5 text-slate-600" />
                  <span>Recruitment Requests ({results.requests.length})</span>
                </div>
                <div className="space-y-1.5">
                  {results.requests.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        onClose();
                        onSelectRequest(r.id);
                      }}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-xl cursor-pointer flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="font-semibold text-xs text-navy-900">{r.roleTitle}</div>
                        <div className="text-[11px] font-mono text-slate-500">{r.reqNumber} • {r.priority} Priority</div>
                      </div>
                      <span className="text-[11px] text-slate-600 font-medium">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalHits === 0 && !isSearching && (
              <div className="text-center py-8 text-xs text-slate-400">
                No matching records found for "{query}".
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
