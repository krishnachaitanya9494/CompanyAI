// Import React and hooks for Talent Pool search, skill facets, and curated lists.
import React, { useState, useMemo } from 'react';

// Import common Badge component for skills and status tags.
import { Badge } from '../components/common/Badge';

// Import searchApi for natural-language semantic rediscovery across resumes.
import { searchApi } from '../api/client';

// Import lucide-react icons.
import {
  UserCheck,
  Search,
  Sparkles,
  Bookmark,
  Briefcase,
  MapPin,
  Clock,
  Filter,
  ArrowRight,
  Plus,
  Check,
  FolderOpen,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Export TalentPoolPage enabling semantic rediscovery and curated candidate shortlists without record duplication.
export const TalentPoolPage = ({
  candidates = [],
  jobs = [],
  onSelectCandidate,
  onNavigateToMatching,
}) => {
  // Natural language search query string.
  const [queryText, setQueryText] = useState('');

  // Selected skill facet filter tag.
  const [selectedSkill, setSelectedSkill] = useState('');

  // Minimum years experience filter.
  const [minExp, setMinExp] = useState(0);

  // Availability filter.
  const [availabilityFilter, setAvailabilityFilter] = useState('');

  // Active view filter ('all' or saved collection name).
  const [activeCollection, setActiveCollection] = useState('all');

  // Saved candidate collections stored locally referencing unique candidate IDs (preventing duplicate profiles).
  const [savedCollections, setSavedCollections] = useState(() => {
    try {
      const raw = localStorage.getItem('companyai-talent-collections');
      return raw
        ? JSON.parse(raw)
        : [
            { id: 'col-priority', name: 'Priority Bench (Immediate)', candidateIds: [] },
            { id: 'col-epm', name: 'Oracle EPM & Cloud Leads', candidateIds: [] },
          ];
    } catch {
      return [{ id: 'col-priority', name: 'Priority Bench (Immediate)', candidateIds: [] }];
    }
  });

  // Semantic rediscovery backend matches if search executed.
  const [semanticIds, setSemanticIds] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  // Inline new saved list input replacing blocking window.prompt dialog.
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  // Progressive disclosure for large Talent Pool candidate grids (8 default vs all).
  const [showAllPool, setShowAllPool] = useState(false);

  // Persist collections to browser storage cleanly.
  const persistCollections = (nextCols) => {
    setSavedCollections(nextCols);
    try {
      localStorage.setItem('companyai-talent-collections', JSON.stringify(nextCols));
    } catch (e) {
      console.warn('Collection storage unavailable:', e.message);
    }
  };

  // Trigger natural language semantic rediscovery against /api/search.
  const handleSemanticRediscovery = async (e) => {
    e?.preventDefault();
    if (!queryText.trim()) {
      setSemanticIds(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchApi.search(queryText.trim(), 25);
      const matchedCands = res?.candidates || [];
      // Map backend numeric_id/candidate_id consistently to match integer React candidate IDs.
      setSemanticIds(
        new Set(
          matchedCands.map((c) => {
            const raw = c.numeric_id ?? c.candidate_id ?? c.id;
            return typeof raw === 'string' ? Number.parseInt(raw.replace(/^cand-/i, ''), 10) || raw : raw;
          })
        )
      );
    } catch {
      // Clear semantic constraint if API fails so local client filter continues gracefully.
      setSemanticIds(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle candidate membership inside target collection without duplicating candidate record.
  const handleToggleInCollection = (colId, candidateId) => {
    const updated = savedCollections.map((col) => {
      if (col.id !== colId) return col;
      const exists = col.candidateIds.includes(candidateId);
      return {
        ...col,
        candidateIds: exists
          ? col.candidateIds.filter((id) => id !== candidateId)
          : [...col.candidateIds, candidateId],
      };
    });
    persistCollections(updated);
  };

  // Submit new named talent pool collection cleanly via inline UI state.
  const handleCreateCollection = (e) => {
    e?.preventDefault();
    if (!newCollectionName.trim()) return;
    persistCollections([
      ...savedCollections,
      { id: `col-${Date.now()}`, name: newCollectionName.trim(), candidateIds: [] },
    ]);
    setNewCollectionName('');
    setIsAddingCollection(false);
  };

  // Derive top skills across candidate pool for faceted rediscovery chips.
  const topSkills = useMemo(() => {
    const counts = {};
    candidates.forEach((c) => {
      (c.skills || c.primarySkills || []).forEach((s) => {
        if (s) counts[s] = (counts[s] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([skill]) => skill);
  }, [candidates]);

  // Filter de-duplicated candidates according to active collection, semantic hit set, skill, experience, and availability.
  const filteredPool = useMemo(() => {
    const activeColObj = savedCollections.find((c) => c.id === activeCollection);

    return candidates.filter((c) => {
      if (activeColObj && !activeColObj.candidateIds.includes(c.id)) {
        return false;
      }
      if (semanticIds && !semanticIds.has(c.id)) {
        // Also allow substring match if user typed exact skill/name.
        const q = queryText.toLowerCase();
        const hay = `${c.name} ${c.currentRole} ${(c.skills || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedSkill) {
        const cSkills = (c.skills || [...(c.primarySkills || []), ...(c.secondarySkills || [])]).map((s) =>
          s.toLowerCase()
        );
        if (!cSkills.includes(selectedSkill.toLowerCase())) return false;
      }
      if ((c.experienceYears || 0) < minExp) {
        return false;
      }
      if (availabilityFilter && !(c.availability || '').toLowerCase().includes(availabilityFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [candidates, savedCollections, activeCollection, semanticIds, queryText, selectedSkill, minExp, availabilityFilter]);

  // Calculate best matching open jobs for a given candidate based on real skill overlap.
  const getMatchingJobsForCandidate = (cand) => {
    const cSkills = new Set((cand.skills || cand.primarySkills || []).map((s) => s.toLowerCase()));
    if (cSkills.size === 0) return [];
    const scored = jobs
      .map((j) => {
        const jSkills = (j.requiredSkills || []).map((s) => s.toLowerCase());
        const hits = jSkills.filter((sk) => cSkills.has(sk)).length;
        return { job: j, hits };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 2);
    return scored;
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Talent Pool & Semantic Rediscovery</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/60">
              {candidates.length} Verified Profiles
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Rediscover applicants across {candidates.length} indexed talent profiles and organize saved shortlists without duplication
          </p>
        </div>

        <button
          onClick={() => setIsAddingCollection((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Saved List</span>
        </button>
      </div>

      {/* Inline Saved Collection Form */}
      {isAddingCollection && (
        <form
          onSubmit={handleCreateCollection}
          className="p-3.5 bg-white dark:bg-surface-darkCard border border-brand-200 dark:border-brand-800 rounded-2xl flex flex-wrap items-center gap-2 shadow-subtle"
        >
          <input
            type="text"
            required
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Enter new Talent Pool collection name..."
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
          >
            Create List
          </button>
          <button
            type="button"
            onClick={() => setIsAddingCollection(false)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder text-xs text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Main Split: Collections Left Sidebar + Rediscovery Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Saved Talent Collections & Quick Filters */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-card space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Talent Collections
            </span>
            <button
              onClick={() => setActiveCollection('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeCollection === 'all'
                  ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/60'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-darkHover'
              }`}
            >
              <span className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5" />
                <span>All Candidates</span>
              </span>
              <span className="font-mono text-[11px]">{candidates.length}</span>
            </button>

            {savedCollections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeCollection === col.id
                    ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/60'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{col.name}</span>
                </span>
                <span className="font-mono text-[11px]">{col.candidateIds.length}</span>
              </button>
            ))}
          </div>

          {/* Faceted Filters Card */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-card space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Rediscovery Criteria
            </span>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Min Experience: {minExp}+ Years
              </label>
              <input
                type="range"
                min={0}
                max={15}
                value={minExp}
                onChange={(e) => setMinExp(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Notice / Availability
              </label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-navy-900 dark:text-white"
              >
                <option value="">Any Availability</option>
                <option value="Immediate">Immediate</option>
                <option value="15 Days">15 Days</option>
                <option value="30 Days">30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Semantic Search Bar & De-duplicated Candidate Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* Semantic Rediscovery Search Box */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-card space-y-3">
            <form onSubmit={handleSemanticRediscovery} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => {
                    setQueryText(e.target.value);
                    if (!e.target.value.trim()) setSemanticIds(null);
                  }}
                  placeholder="Semantic rediscovery: e.g. 'Teamcenter BMIDE customization' or 'Oracle FCCS consolidation'..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 rounded-xl text-navy-900 dark:text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Searching...' : 'Rediscover'}</span>
              </button>
            </form>

            {/* Skill Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedSkill('')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  !selectedSkill
                    ? 'bg-navy-900 dark:bg-brand-600 text-white border-navy-900 dark:border-brand-600'
                    : 'bg-slate-50 dark:bg-surface-darkHover text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                All Skills
              </button>
              {topSkills.map((sk) => (
                <button
                  key={sk}
                  onClick={() => setSelectedSkill(selectedSkill === sk ? '' : sk)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                    selectedSkill === sk
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-50 dark:bg-surface-darkHover text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                  }`}
                >
                  {sk}
                </button>
              ))}
            </div>
          </div>

          {/* Results Count Header */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing <strong className="text-navy-900 dark:text-white">{filteredPool.length}</strong> unique candidate profiles
            </span>
          </div>

          {/* Candidate Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(showAllPool ? filteredPool : filteredPool.slice(0, 8)).map((cand) => {
              const matchingJobs = getMatchingJobsForCandidate(cand);
              const firstColId = savedCollections[0]?.id;
              const isSaved = firstColId && savedCollections[0].candidateIds.includes(cand.id);

              return (
                <div
                  key={cand.id}
                  className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-subtle hover:shadow-card card-interactive transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white truncate">{cand.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{cand.currentRole}</p>
                      </div>
                      {firstColId && (
                        <button
                          onClick={() => handleToggleInCollection(firstColId, cand.id)}
                          title={isSaved ? 'Remove from saved list' : `Save to ${savedCollections[0].name}`}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isSaved
                              ? 'bg-brand-50 dark:bg-brand-900/40 border-brand-300 text-brand-700 dark:text-brand-300'
                              : 'bg-slate-50 dark:bg-surface-darkHover border-slate-200 dark:border-slate-700 text-slate-400 hover:text-navy-900'
                          }`}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {cand.experienceYears != null ? `${cand.experienceYears} yrs` : 'Exp N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {cand.location || 'Location N/A'}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {cand.availability || 'Availability N/A'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(cand.primarySkills || []).slice(0, 4).map((sk, idx) => (
                        <Badge key={idx} variant="neutral" size="xs">
                          {sk}
                        </Badge>
                      ))}
                    </div>

                    {/* Multi-Job Alignment Discovery Pill */}
                    {matchingJobs.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Potential Job Matches
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {matchingJobs.map(({ job, hits }) => (
                            <button
                              key={job.id}
                              onClick={() => onNavigateToMatching && onNavigateToMatching(job)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-800/60 text-[10px] font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-colors"
                            >
                              <span>{job.title}</span>
                              <span className="opacity-70">({hits} skills)</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                    <Badge variant="brand" size="xs">
                      {cand.status || 'Screened'}
                    </Badge>
                    <button
                      onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progressive Disclosure Toggle for Talent Pool */}
          {filteredPool.length > 8 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {showAllPool ? filteredPool.length : Math.min(8, filteredPool.length)} of {filteredPool.length} profiles
              </span>
              <button
                type="button"
                onClick={() => setShowAllPool((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 text-xs font-semibold text-navy-900 dark:text-slate-100 shadow-subtle transition-colors"
              >
                {showAllPool ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
                    <span>Show More ({filteredPool.length - 8} more)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
