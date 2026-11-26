// Import React and hooks for recruiter matching matrix workspace state and lifecycle.
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';

// Import Badge, CustomSelect, AnimatedMetricValue, SpotlightCard, and LatticeLoader for modern Matching Workspace UX.
import { Badge } from '../components/common/Badge';
import { CustomSelect } from '../components/common/CustomSelect';
import { AnimatedMetricValue } from '../components/layout/MetricCard';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';

// Lazy-load dedicated Semantic JD Matching Details Page to trim initial route chunk size.
const SemanticMatchingDetailPage = lazy(() =>
  import('./SemanticMatchingDetailPage').then((m) => ({ default: m.SemanticMatchingDetailPage }))
);

// Import jobApi client service for Phase 5C endpoints.
import { jobApi } from '../api/client';

// Import icons from lucide-react.
import {
  Sparkles,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  // Import ChevronLeft icon for pagination previous navigation button.
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  Layers,
  Scale,
  Search,
  Filter,
  X,
  FileText,
  Check,
  ArrowUpDown,
  RefreshCw,
  Award,
  Users,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

// Export MatchingMatrixPage component implementing complete Recruiter Matching Workspace.
export const MatchingMatrixPage = ({
  jobs = [],
  candidates = [],
  onSelectCandidate,
  onScheduleInterview,
  onUpdateCandidateStage,
  onRefreshApprovals,
  initialJobId = null,
}) => {
  // Currently selected job description ID.
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || jobs[0]?.id || null);

  // Active view mode: 'list' (rankings table) or 'matrix' (requirement grid).
  const [viewMode, setViewMode] = useState('list');

  // Candidate match records returned from Phase 5C matching engine.
  const [matches, setMatches] = useState([]);

  // Aggregate summary statistics for active job.
  const [summary, setSummary] = useState(null);

  // Loading state during API retrieval.
  const [isLoading, setIsLoading] = useState(false);

  // Available filter options fetched from backend.
  const [filterOptions, setFilterOptions] = useState({
    locations: [],
    stages: [],
    availabilities: [],
    experience_range: { min: 0, max: 20 },
  });

  // Current pagination page index (1-based).
  const [currentPage, setCurrentPage] = useState(1);
  // Number of candidate records displayed per page.
  const [pageSize, setPageSize] = useState(25);
  // Total calculated pagination pages from matching engine.
  const [totalPages, setTotalPages] = useState(1);
  // Total count of evaluated candidate records meeting filter criteria.
  const [totalEvaluated, setTotalEvaluated] = useState(0);

  // Recruiter filter criteria state with debounced search query to avoid hammering API per keystroke.
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [minExp, setMinExp] = useState('');
  const [minScore, setMinScore] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('match_score');
  const [sortOrder, setSortOrder] = useState('desc');

  // Debounce text search input cleanly by 300ms before triggering backend re-evaluation.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Multi-candidate comparison selection state (array of candidate IDs, max 5).
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  // Comparison modal state.
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState('');

  // Selected candidate for deep evidence inspection drawer.
  const [inspectCandidate, setInspectCandidate] = useState(null);

  // Dedicated full-page Semantic JD Matching Details candidate state.
  const [detailedMatchCandidate, setDetailedMatchCandidate] = useState(null);

  // Track which candidate matching result cards currently have their evidence drawer expanded.
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState([]);

  // Toggle inline expandable evidence drawer for a specific candidate card.
  const toggleEvidenceExpand = (candidateId) => {
    setExpandedEvidenceIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  // Update selected job if initialJobId changes or jobs array updates.
  useEffect(() => {
    if (initialJobId && jobs.some((j) => j.id === initialJobId)) {
      setSelectedJobId(initialJobId);
    } else if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, initialJobId, selectedJobId]);

  // Lookup active job record.
  const activeJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || jobs[0];
  }, [jobs, selectedJobId]);

  // Load filter options on mount or job change.
  useEffect(() => {
    if (!activeJob) return;
    jobApi
      .getMatchFilters(activeJob.id)
      .then((opts) => {
        if (opts) setFilterOptions(opts);
      })
      .catch((err) => console.warn('Could not load match filter options:', err.message));
  }, [activeJob]);

  // Fetch candidate rankings and summary when active job or filters change.
  const fetchMatches = () => {
    // Abort if no active job is selected.
    if (!activeJob) return;
    // Set loading indicator.
    setIsLoading(true);

    // Build parameter payload including active pagination bounds.
    const params = {
      // Request structured object containing summary metrics and pagination metadata.
      as_object: true,
      // Target sort field.
      sort_by: sortBy,
      // Sort direction.
      sort_order: sortOrder,
      // Target page index.
      page: currentPage,
      // Page size limit.
      limit: pageSize,
    };
    // Append optional filter values if set.
    if (selectedLocation) params.location = selectedLocation;
    // Append stage filter.
    if (selectedStage) params.stage = selectedStage;
    // Append min experience.
    if (minExp !== '') params.min_experience = parseFloat(minExp);
    // Append min score.
    if (minScore !== '') params.min_score = parseFloat(minScore);
    // Append debounced query search string cleanly.
    if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim();

    // Call Phase 5C matching engine endpoint.
    jobApi
      .getMatches(activeJob.id, params)
      .then((data) => {
        // Check for structured response format.
        if (data && data.matches) {
          // Set matches for current page slice.
          setMatches(data.matches);
          // Set aggregate summary statistics.
          setSummary(data.summary || null);
          // Set total pages from backend.
          setTotalPages(data.total_pages || 1);
          // Set total evaluated count across entire pool.
          setTotalEvaluated(data.total_evaluated || data.summary?.total_evaluated || data.matches.length);
        } else if (Array.isArray(data)) {
          // Fallback array handling.
          setMatches(data);
          // Single page fallback.
          setTotalPages(1);
          // Total evaluated is list length.
          setTotalEvaluated(data.length);
        }
        // Dismiss loading spinner.
        setIsLoading(false);
      })
      .catch((err) => {
        // Log API fetch failure.
        console.warn('Failed to fetch matches from API:', err.message);
        // Dismiss loading spinner on error.
        setIsLoading(false);
      });
  };

  // Re-fetch matches whenever job, filter criteria, debounced search, or pagination parameters change.
  useEffect(() => {
    // Trigger candidate matching query.
    fetchMatches();
  }, [activeJob, selectedLocation, selectedStage, minExp, minScore, debouncedSearchQuery, sortBy, sortOrder, currentPage, pageSize]);

  // Toggle candidate selection for comparison.
  const toggleSelectCandidate = (candidateId) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId);
      }
      if (prev.length >= 5) {
        alert('You can compare a maximum of 5 candidates simultaneously.');
        return prev;
      }
      return [...prev, candidateId];
    });
  };

  // Open side-by-side comparison modal and trigger API call.
  const handleOpenComparison = async () => {
    if (selectedForCompare.length < 2) {
      alert('Please select at least 2 candidates to compare.');
      return;
    }
    setIsCompareModalOpen(true);
    setIsComparing(true);
    setCompareError('');
    try {
      const data = await jobApi.compareCandidates(activeJob.id, selectedForCompare);
      setComparisonData(data);
    } catch (err) {
      setCompareError(err.message || 'Failed to compare candidates');
    } finally {
      setIsComparing(false);
    }
  };

  // Reset all filters to default state.
  const handleResetFilters = () => {
    // Clear location filter.
    setSelectedLocation('');
    // Clear stage filter.
    setSelectedStage('');
    // Clear minimum experience filter.
    setMinExp('');
    // Clear minimum score filter.
    setMinScore('');
    // Clear text search query.
    setSearchQuery('');
    // Reset sort field.
    setSortBy('match_score');
    // Reset sort order to descending.
    setSortOrder('desc');
    // Reset to first page.
    setCurrentPage(1);
  };

  // Distinct requirements collected across matches for matrix view.
  const matrixRequirements = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    const firstWithReqs = matches.find((m) => m.requirements && m.requirements.length > 0);
    return firstWithReqs ? firstWithReqs.requirements : [];
  }, [matches]);

  // Helper for tier color styling supporting both Light and Dark themes.
  const getTierColor = (classification) => {
    switch (classification) {
      case 'Excellent Match':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Strong Match':
        return 'bg-brand-100 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 border-brand-300 dark:border-brand-800';
      case 'Potential Match':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Partial Match':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
      default:
        return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    }
  };

  // Render dedicated Semantic JD Matching Details Page when a candidate match is inspected in full detail.
  if (detailedMatchCandidate && activeJob) {
    return (
      <Suspense
        fallback={
          <div className="p-10 flex justify-center">
            <LatticeLoader label="Loading Semantic Matching Details" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
          </div>
        }
      >
        <SemanticMatchingDetailPage
          job={activeJob}
          candidateMatch={detailedMatchCandidate}
          allMatches={matches}
          onBack={() => setDetailedMatchCandidate(null)}
          onSelectMatch={(nextCand) => setDetailedMatchCandidate(nextCand)}
          onCompareCandidate={(candId) => {
            setDetailedMatchCandidate(null);
            setSelectedForCompare([candId]);
          }}
          onOpenResume={(cand) => onSelectCandidate && onSelectCandidate(cand.candidate_id || cand.id)}
          onOpenCandidateProfile={(cid) => onSelectCandidate && onSelectCandidate(cid)}
          onUpdateCandidateStage={onUpdateCandidateStage}
          onRefreshApprovals={onRefreshApprovals}
        />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Candidate Matching Hub</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              Smart Fit Ranking
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluate and compare candidate fit against job requirements, verified skills, and experience.
          </p>
        </div>

        {/* Job Selection Dropdown */}
        <div className="flex items-center gap-3 min-w-0">
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Job Position:</label>
          <CustomSelect
            value={selectedJobId || ''}
            onChange={(nextVal) => {
              setSelectedJobId(Number(nextVal) || nextVal);
              setSelectedForCompare([]);
              setExpandedEvidenceIds([]);
              setCurrentPage(1);
            }}
            ariaLabel="Select Job Position"
            className="w-64 sm:w-80 lg:w-96"
            menuClassName="!max-w-md right-0 left-auto"
            options={jobs.map((j) => ({
              value: j.id,
              label: `${j.title} (${j.department || 'General'})`,
            }))}
          />
        </div>
      </div>

      {/* KPI Overview Summary Banner: spacious, responsive 1->2->3->6 column layout with React Bits Counter & SpotlightCard */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 items-stretch">
          {[
            {
              label: 'Evaluated Pool',
              value: summary.total_evaluated ?? 0,
              desc: 'Total candidates scored',
              accent: 'text-navy-950 dark:text-white',
              dot: 'bg-slate-400',
              tint: 'border-slate-200/80 dark:border-surface-darkBorder',
              spotlight: '#64748b',
            },
            {
              label: 'Strong',
              value: summary.strong_matches ?? 0,
              desc: 'Score 80% or higher',
              accent: 'text-emerald-700 dark:text-emerald-400',
              dot: 'bg-emerald-500',
              tint: 'border-emerald-200/80 dark:border-emerald-900/70',
              spotlight: '#10b981',
            },
            {
              label: 'Good Fit',
              value: summary.good_matches ?? summary.potential_matches ?? 0,
              desc: 'Score 60–79%',
              accent: 'text-brand-700 dark:text-brand-400',
              dot: 'bg-brand-500',
              tint: 'border-brand-200/80 dark:border-brand-900/70',
              spotlight: '#059669',
            },
            {
              label: 'Partial',
              value: summary.partial_matches ?? 0,
              desc: 'Score 40–59%',
              accent: 'text-amber-700 dark:text-amber-400',
              dot: 'bg-amber-500',
              tint: 'border-amber-200/80 dark:border-amber-900/70',
              spotlight: '#f59e0b',
            },
            {
              label: 'Weak / Unscored',
              value: (summary.weak_matches || 0) + (summary.needs_review || 0),
              desc: 'Below 40% or insufficient evidence',
              accent: 'text-slate-700 dark:text-slate-300',
              dot: 'bg-slate-400',
              tint: 'border-slate-200/80 dark:border-surface-darkBorder',
              spotlight: '#94a3b8',
            },
            {
              label: 'Average Score',
              value: summary.average_score == null ? 'N/A' : `${summary.average_score}%`,
              desc: 'Deterministic pool mean',
              accent: 'text-sky-700 dark:text-sky-400',
              dot: 'bg-sky-500',
              tint: 'border-sky-200/80 dark:border-sky-900/70',
              spotlight: '#0ea5e9',
            },
          ].map((card) => (
            <SpotlightCard
              key={card.label}
              spotlightColor={card.spotlight}
              intensity={0.18}
              borderGlow={0.38}
              spotlightSize={180}
              className={`p-5 bg-white dark:bg-surface-darkCard border ${card.tint} rounded-2xl shadow-card card-interactive flex flex-col justify-between min-h-[118px]`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  {card.label}
                </span>
                <span className={`w-2 h-2 rounded-full ${card.dot} flex-shrink-0`} />
              </div>
              <div className={`text-3xl font-extrabold font-mono tracking-tight my-1.5 ${card.accent}`}>
                <AnimatedMetricValue value={card.value} />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{card.desc}</span>
            </SpotlightCard>
          ))}
        </div>
      )}

      {/* Recruiter Filters & Toolbar */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">Filter & Rank Candidates</h3>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Candidate Cards
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'matrix' ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Requirements Matrix
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Free Text Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, skills..."
              value={searchQuery}
              onChange={(e) => {
                // Set query string.
                setSearchQuery(e.target.value);
                // Reset page on search filter change.
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Location Filter */}
          <div>
            <CustomSelect
              value={selectedLocation}
              onChange={(val) => {
                setSelectedLocation(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by location"
              size="sm"
              className="w-full"
              buttonClassName="bg-slate-50 dark:bg-slate-800/80"
              options={[
                { value: '', label: 'All Locations' },
                ...filterOptions.locations.map((loc) => ({ value: loc, label: loc })),
              ]}
            />
          </div>

          {/* Pipeline Stage Filter */}
          <div>
            <CustomSelect
              value={selectedStage}
              onChange={(val) => {
                setSelectedStage(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by pipeline stage"
              size="sm"
              className="w-full"
              buttonClassName="bg-slate-50 dark:bg-slate-800/80"
              options={[
                { value: '', label: 'All Stages' },
                ...filterOptions.stages.map((stg) => ({ value: stg, label: stg })),
              ]}
            />
          </div>

          {/* Minimum Experience */}
          <div>
            <CustomSelect
              value={minExp}
              onChange={(val) => {
                setMinExp(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by minimum experience"
              size="sm"
              className="w-full"
              buttonClassName="bg-slate-50 dark:bg-slate-800/80"
              options={[
                { value: '', label: 'Any Experience' },
                { value: '3', label: '3+ Years' },
                { value: '5', label: '5+ Years' },
                { value: '8', label: '8+ Years' },
                { value: '10', label: '10+ Years' },
              ]}
            />
          </div>

          {/* Minimum Match Score */}
          <div>
            <CustomSelect
              value={minScore}
              onChange={(val) => {
                setMinScore(val);
                setCurrentPage(1);
              }}
              ariaLabel="Filter by minimum match score"
              size="sm"
              className="w-full"
              buttonClassName="bg-slate-50 dark:bg-slate-800/80"
              options={[
                { value: '', label: 'Any Score' },
                { value: '88', label: 'Excellent Only (88%+)' },
                { value: '75', label: 'Strong & Above (75%+)' },
                { value: '60', label: 'Potential & Above (60%+)' },
                { value: '50', label: '50%+ Match' },
              ]}
            />
          </div>

          {/* Sort By Field */}
          <div>
            <CustomSelect
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
              ariaLabel="Sort candidates by"
              size="sm"
              className="w-full"
              buttonClassName="bg-slate-50 dark:bg-slate-800/80"
              menuClassName="right-0 left-auto"
              options={[
                { value: 'match_score', label: 'Sort: Match Score' },
                { value: 'similarity', label: 'Sort: Vector Similarity' },
                { value: 'experience', label: 'Sort: Experience' },
                { value: 'name', label: 'Sort: Candidate Name' },
              ]}
            />
          </div>
        </div>

        {/* Active Filter Badges & Reset */}
        {(selectedLocation || selectedStage || minExp || minScore || searchQuery) && (
          <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Location: {selectedLocation}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedLocation('')} />
              </span>
            )}
            {selectedStage && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Stage: {selectedStage}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedStage('')} />
              </span>
            )}
            {minExp && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Exp &ge; {minExp} yrs
                <X className="w-3 h-3 cursor-pointer" onClick={() => setMinExp('')} />
              </span>
            )}
            {minScore && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Score &ge; {minScore}%
                <X className="w-3 h-3 cursor-pointer" onClick={() => setMinScore('')} />
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Query: "{searchQuery}"
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold ml-auto"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Floating Comparison Action Bar when candidates are selected */}
      {selectedForCompare.length > 0 && (
        <div className="sticky top-4 z-20 p-3 bg-navy-950 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-slideDown">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-300" />
            <span className="text-xs font-semibold">
              {selectedForCompare.length} candidate{selectedForCompare.length > 1 ? 's' : ''} selected for comparison
            </span>
            <span className="text-[11px] text-slate-400">(select 2 to 5 candidates)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedForCompare([])}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleOpenComparison}
              disabled={selectedForCompare.length < 2}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <span>Compare Candidates</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Candidate Result Cards View or Requirements Matrix View */}
      {isLoading ? (
        <div className="p-14 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card flex flex-col items-center justify-center space-y-3">
          <LatticeLoader
            label="Evaluating candidates against JD requirements"
            pattern="orbit"
            grid={3}
            color="#059669"
            cellSize={7}
            fontSize={14}
            showTimer
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Checking approved JD segmentation, mandatory requirement rules, and 2,048-dim resume embeddings.
          </span>
        </div>
      ) : viewMode === 'list' ? (
        /* Structured Candidate Matching Result Cards Workspace */
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/60 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h4 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
                {/* Display total evaluated candidates across entire active pool */}
                Ranked Candidate Matches ({totalEvaluated})
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Model: nvidia/nemotron-3-embed-1b:free • 2048 dims
            </span>
          </div>

          <div className="p-4 space-y-3">
            {matches.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No matching candidates found satisfying the active filter criteria.
              </div>
            ) : (
              matches.map((item, idx) => {
                const candKey = item.candidate_id || idx;
                const isChecked = selectedForCompare.includes(item.candidate_id);
                const isExpanded = expandedEvidenceIds.includes(candKey);
                const reqs = item.requirements || [];
                const evidenceStatus = (r) => r.evidence_status || (r.status === 'SATISFIED' ? 'DIRECT_MATCH' : r.status === 'PARTIAL' ? 'PARTIAL_MATCH' : r.status === 'GAP' ? 'MISSING' : 'UNVERIFIED');
                const satisfied = reqs.filter((r) => ['DIRECT_MATCH', 'EQUIVALENT_MATCH'].includes(evidenceStatus(r))).length;
                const partial = reqs.filter((r) => evidenceStatus(r) === 'PARTIAL_MATCH').length;
                const gaps = reqs.filter((r) => evidenceStatus(r) === 'MISSING').length;
                const unverified = reqs.filter((r) => evidenceStatus(r) === 'UNVERIFIED').length;
                const mandatoryReqs = reqs.filter((r) => (r.classification || '').toLowerCase() === 'mandatory');
                const preferredReqs = reqs.filter((r) => (r.classification || '').toLowerCase() === 'preferred');
                const mandatoryMet = mandatoryReqs.filter((r) => ['DIRECT_MATCH', 'EQUIVALENT_MATCH'].includes(evidenceStatus(r))).length;
                const preferredMet = preferredReqs.filter((r) => ['DIRECT_MATCH', 'EQUIVALENT_MATCH'].includes(evidenceStatus(r))).length;
                const rawScore = item.rawScore ?? item.matchScore ?? item.match_score ?? null;
                const displayTier = item.eligibilityAdjustedTier || item.classification || 'Fit';
                const semSim =
                  item.semanticSimilarity != null
                    ? item.semanticSimilarity.toFixed(2)
                    : item.semantic_similarity === null || item.semanticSimilarity === null
                    ? 'Unavailable'
                    : item.similarity != null
                    ? item.similarity.toFixed(2)
                    : 'Unavailable';
                const primaryEvidence =
                  item.evidenceHighlights?.[0] ||
                  (item.evidence_citation && item.evidence_citation !== 'Evidence unavailable.'
                    ? item.evidence_citation
                    : null);

                return (
                  <div
                    key={candKey}
                    className={`rounded-2xl border p-4 sm:p-5 card-interactive transition-all ${
                      isChecked
                        ? 'bg-brand-50/35 dark:bg-brand-950/25 border-brand-400 dark:border-brand-700 ring-1 ring-brand-500/20'
                        : 'bg-surface-50/40 dark:bg-slate-900/40 border-slate-200/80 dark:border-surface-darkBorder hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Card Top Row: Identity + Metadata on Left, Score + Eligibility Tier on Right */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.name || item.candidate_name} for comparison`}
                          checked={isChecked}
                          onChange={() => toggleSelectCandidate(item.candidate_id)}
                          className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer flex-shrink-0"
                        />
                        <span className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-navy-900 dark:text-slate-100 font-bold text-xs font-mono flex items-center justify-center flex-shrink-0 shadow-subtle">
                          #{(currentPage - 1) * pageSize + idx + 1}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => onSelectCandidate && onSelectCandidate(item.candidate_id)}
                              className="text-sm sm:text-base font-bold text-navy-950 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 text-left transition-colors"
                            >
                              {item.name || item.candidate_name}
                            </button>
                            <Badge variant="navy" size="xs">
                              {item.stage || item.status || 'New'}
                            </Badge>
                          </div>

                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {item.currentRole || item.current_role || 'Candidate Profile'}
                          </p>

                          {/* Compact single metadata strip: Experience, Location, Notice/Availability, Resume source */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>
                              Exp: <strong className="text-navy-900 dark:text-slate-200">{item.experienceYears ?? '—'} yrs</strong>
                            </span>
                            <span>•</span>
                            <span>{item.location || 'Location not specified'}</span>
                            <span>•</span>
                            <span>
                              Notice: <strong className="text-navy-900 dark:text-slate-200">{item.availability || 'Not specified'}</strong>
                            </span>
                            {item.winningResumeFilename && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                                  <FileText className="w-3 h-3 text-slate-400" />
                                  {item.winningResumeFilename}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score, Eligibility-Adjusted Tier, Mandatory Gap Protection Alert */}
                      <div className="flex flex-col lg:items-end gap-1.5 flex-shrink-0 pl-9 lg:pl-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="px-3 py-1 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-slate-700 shadow-subtle flex items-baseline gap-1">
                            <span className="text-lg font-extrabold font-mono text-navy-950 dark:text-white">
                              {rawScore == null ? 'Insufficient Evidence' : `${rawScore}%`}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">Score</span>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getTierColor(displayTier)}`}
                            title={item.criticalGapExplanation || displayTier}
                          >
                            {displayTier}
                          </span>

                          {(item.hasCriticalGap || item.has_critical_gap || (item.mandatoryGapCount || 0) > 0) && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1"
                              title={item.criticalGapExplanation || `${item.mandatoryGapCount || 1} mandatory gap(s)`}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Mandatory Gap ({item.mandatoryGapCount || item.mandatory_gap_count || 1})
                            </span>
                          )}
                        </div>

                        {item.scoreBasedTier && item.eligibilityAdjustedTier && item.scoreBasedTier !== item.eligibilityAdjustedTier && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Score Tier: <span className="text-slate-700 dark:text-slate-200 font-semibold">{item.scoreBasedTier}</span> (capped by mandatory gap)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Strip: Mandatory/Preferred Alignment + Component Breakdown (Semantic Sim clearly separated) */}
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-surface-darkBorder flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {reqs.length > 0 ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              {satisfied} Met
                            </span>
                            {gaps > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800">
                                <AlertCircle className="w-3 h-3" />
                                {gaps} Gap
                              </span>
                            )}
                            {partial > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">{partial} Partial</span>}
                            {unverified > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                                <HelpCircle className="w-3 h-3" />
                                {unverified} Verify
                              </span>
                            )}
                            {mandatoryReqs.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-rose-200/80 dark:border-rose-900/60 text-slate-700 dark:text-slate-200 font-medium">
                                Mandatory: <strong className="font-mono">{mandatoryMet}/{mandatoryReqs.length}</strong>
                              </span>
                            )}
                            {preferredReqs.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-900/60 text-slate-700 dark:text-slate-200 font-medium">
                                Preferred: <strong className="font-mono">{preferredMet}/{preferredReqs.length}</strong>
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">Standard skills fit</span>
                        )}
                      </div>

                      {/* Experience, Domain & Separated Semantic Relevance Breakdown */}
                      {item.componentScores && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>Mand Skills: <strong className="text-navy-900 dark:text-slate-200">{item.componentScores.mandatory_skills}%</strong></span>
                          <span>•</span>
                          <span>Exp: <strong className="text-navy-900 dark:text-slate-200">{item.componentScores.relevant_experience}%</strong></span>
                          {item.componentScores.domain_relevance != null && (
                            <>
                              <span>•</span>
                              <span>Domain: <strong className="text-navy-900 dark:text-slate-200">{item.componentScores.domain_relevance}%</strong></span>
                            </>
                          )}
                          <span>•</span>
                          <span title="AI Requirement Alignment Score">
                            Skill Alignment: <strong className="text-sky-700 dark:text-sky-400">{semSim}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Row: Collapsible Evidence Trigger on Left, Action Buttons on Right */}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleEvidenceExpand(candKey)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {isExpanded
                            ? 'Hide Resume Evidence & Breakdown'
                            : `Inspect Resume Evidence (${item.evidenceHighlights?.length || (primaryEvidence ? 1 : 0)} highlight${(item.evidenceHighlights?.length || 1) === 1 ? '' : 's'})`}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 motion-reduce:transition-none ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setDetailedMatchCandidate(item)}
                          title="Open Semantic JD Matching Details Workspace"
                          className="px-3 py-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800 rounded-xl transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Match Details</span>
                        </button>
                        <button
                          onClick={() => onSelectCandidate && onSelectCandidate(item.candidate_id)}
                          className="px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100 dark:hover:bg-surface-darkHover rounded-xl transition-colors"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => onScheduleInterview && onScheduleInterview(item)}
                          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 rounded-xl transition-all shadow-subtle flex items-center gap-1"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Schedule</span>
                        </button>
                      </div>
                    </div>

                    {/* Smooth Expandable Evidence Drawer (collapsed by default) */}
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                        isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-3 text-xs">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Grounded Resume Evidence Excerpts
                            </span>
                            {item.evidenceHighlights && item.evidenceHighlights.length > 0 ? (
                              <ul className="space-y-1.5">
                                {item.evidenceHighlights.slice(0, 3).map((quote, qIdx) => (
                                  <li
                                    key={qIdx}
                                    className="p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-2"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <span>"{quote}"</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-slate-500 dark:text-slate-400 italic">
                                {primaryEvidence || 'Evidence unavailable in indexed profile.'}
                              </p>
                            )}
                          </div>

                          {reqs.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Key Requirement Alignment Preview ({reqs.length} total)
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {reqs.slice(0, 6).map((req, rIdx) => {
                                  const isMandatory = (req.classification || '').toLowerCase() === 'mandatory';
                                  return (
                                    <div
                                      key={rIdx}
                                      className={`p-2 rounded-lg border text-[11px] flex items-start justify-between gap-2 ${
                                        isMandatory
                                          ? 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                                          : 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <span className="font-semibold text-navy-900 dark:text-slate-100 block line-clamp-1">
                                          {req.original_text}
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                          {req.classification}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                                          req.status === 'SATISFIED'
                                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                            : req.status === 'GAP'
                                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                        }`}
                                      >
                                        {req.status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rankings List Pagination Bar */}
          <div className="p-4 border-t border-slate-100 dark:border-surface-darkBorder bg-surface-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range status text */}
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-navy-950 dark:text-white">{totalEvaluated === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-navy-950 dark:text-white">{Math.min(currentPage * pageSize, totalEvaluated)}</span> of{' '}
              <span className="font-bold text-navy-950 dark:text-white">{totalEvaluated}</span> candidates
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    // Update page size limit.
                    setPageSize(Number(e.target.value));
                    // Reset to first page.
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg text-navy-900 dark:text-slate-100 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>

              {/* Prev / Page / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-darkHover disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-3 py-1 font-semibold text-navy-950 dark:text-slate-100 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-darkHover disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Requirements Matrix Grid View */
        <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/60 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
                Requirement-by-Requirement Candidate Matrix
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Displays SATISFIED (green), GAP (red), and UNVERIFIED (amber) status across candidate pool.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Satisfied
              </span>
              <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> Gap
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                <HelpCircle className="w-3.5 h-3.5" /> Unverified
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/40 dark:bg-slate-900/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[200px] sticky left-0 bg-surface-50/95 dark:bg-surface-darkCard backdrop-blur z-10">
                    Candidate
                  </th>
                  <th className="py-3 px-3 text-center">Score</th>
                  {matrixRequirements.map((req, rIdx) => (
                    <th key={rIdx} className="py-3 px-3 min-w-[160px] max-w-[220px]">
                      <div className="line-clamp-2" title={req.original_text}>
                        {req.original_text}
                      </div>
                      <span className="text-[9px] font-normal text-slate-400 block mt-0.5 uppercase">
                        {req.classification}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                {/* Render paginated matches in matrix grid */}
                {matches.map((cand, cIdx) => {
                  // Index evaluations by requirement ID for rapid cell lookup.
                  const candReqMap = {};
                  // Populate evaluation map.
                  (cand.requirements || []).forEach((r) => {
                    candReqMap[r.requirement_id] = r;
                  });

                  return (
                    <tr key={cand.candidate_id || cIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Sticky Candidate Identity Cell */}
                      <td className="py-3 px-4 sticky left-0 bg-white dark:bg-surface-darkCard hover:bg-slate-50/80 dark:hover:bg-slate-800/60 z-10 border-r border-slate-100 dark:border-surface-darkBorder">
                        <button
                          onClick={() => onSelectCandidate && onSelectCandidate(cand.candidate_id)}
                          className="font-bold text-navy-950 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 text-left block"
                        >
                          {cand.name}
                        </button>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{cand.currentRole}</span>
                      </td>

                      {/* Score Cell */}
                      <td className="py-3 px-3 text-center font-bold font-mono text-navy-950 dark:text-white">
                        {cand.matchScore}%
                      </td>

                      {/* Requirement Evaluation Status Cells */}
                      {matrixRequirements.map((req, rIdx) => {
                        const evalItem = candReqMap[req.requirement_id];
                        const status = evalItem?.status || 'UNVERIFIED';

                        return (
                          <td key={rIdx} className="py-3 px-3 text-center">
                            {status === 'SATISFIED' ? (
                              <button
                                onClick={() => setInspectCandidate(cand)}
                                title={evalItem?.evidence || 'Satisfied'}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            ) : status === 'GAP' ? (
                              <button
                                onClick={() => setInspectCandidate(cand)}
                                title="Requirement Gap"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 hover:bg-rose-200 transition-colors"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setInspectCandidate(cand)}
                                title={evalItem?.notes || 'Unverified'}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 transition-colors"
                              >
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Requirements Matrix View Pagination Bar */}
          <div className="p-4 border-t border-slate-100 dark:border-surface-darkBorder bg-surface-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range status text */}
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-navy-950 dark:text-white">{totalEvaluated === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-navy-950 dark:text-white">{Math.min(currentPage * pageSize, totalEvaluated)}</span> of{' '}
              <span className="font-bold text-navy-950 dark:text-white">{totalEvaluated}</span> candidates
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-3">
              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    // Update page size limit.
                    setPageSize(Number(e.target.value));
                    // Reset to first page.
                    setCurrentPage(1);
                  }}
                  className="py-1 px-2 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg text-navy-900 dark:text-slate-100 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>

              {/* Prev / Page / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-darkHover disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-3 py-1 font-semibold text-navy-950 dark:text-slate-100 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-lg">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-darkHover disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Multi-Candidate Comparison Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-surface-darkCard rounded-3xl shadow-2xl border border-slate-200/80 dark:border-surface-darkBorder max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-surface-darkBorder flex items-center justify-between bg-surface-50 dark:bg-slate-900/60">
              <div>
                <h3 className="text-base font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span>Candidate Head-to-Head Comparison</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Side-by-side evaluation against {activeJob?.title} requirements.
                </p>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isComparing ? (
                <div className="p-16 flex flex-col items-center justify-center space-y-2">
                  <LatticeLoader
                    label="Comparing candidate credentials"
                    pattern="pulse"
                    grid={4}
                    color="#059669"
                    cellSize={5}
                    fontSize={13}
                    showTimer
                  />
                </div>
              ) : compareError ? (
                <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300">
                  {compareError}
                </div>
              ) : comparisonData ? (
                <>
                  {/* AI Recommendation Banner */}
                  {comparisonData.recommendation && (
                    <div className="p-4 bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-950/50 dark:to-emerald-950/40 border border-brand-200/80 dark:border-brand-800 rounded-2xl flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs uppercase font-extrabold text-brand-800 dark:text-brand-300 tracking-wider block">
                          AI Recommended Shortlist Pick
                        </span>
                        <h4 className="text-sm font-bold text-navy-950 dark:text-white mt-0.5">
                          {comparisonData.recommendation.recommended_candidate_name}
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                          {comparisonData.recommendation.recommendation_rationale}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Side-by-Side Candidate Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {comparisonData.candidates.map((c) => (
                      <div
                        key={c.candidate_id}
                        className={`p-3.5 rounded-2xl border ${
                          c.candidate_id === comparisonData.recommendation?.recommended_candidate_id
                            ? 'bg-brand-50/40 dark:bg-brand-950/30 border-brand-500 ring-2 ring-brand-500/20'
                            : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-surface-darkBorder'
                        }`}
                      >
                        <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 truncate">{c.name}</h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.current_role}</p>

                        <div className="mt-2 text-base font-extrabold text-navy-950 dark:text-white flex items-center justify-between">
                          {/* Raw and final deterministic score */}
                          <span>{c.match_score == null ? 'Insufficient Evidence' : `${c.match_score}%`}</span>
                          {/* Eligibility-adjusted classification tier badge */}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${getTierColor(
                              c.eligibility_adjusted_tier || c.classification
                            )}`}
                            title={c.critical_gap_explanation || c.classification}
                          >
                            {c.eligibility_adjusted_tier || c.classification}
                          </span>
                        </div>

                        {/* Critical mandatory gap alert in comparison card */}
                        {(c.has_critical_gap || (c.mandatory_gap_count || 0) > 0) && (
                          <div className="mt-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[9px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />
                            <span>Mandatory Gap ({c.mandatory_gap_count || 1})</span>
                          </div>
                        )}

                        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                          <div>Exp: {c.experience_years} yrs</div>
                          <div>Loc: {c.location}</div>
                          <div>Notice: {c.availability}</div>
                          <div>Semantic Sim: {c.semantic_similarity != null ? c.semantic_similarity.toFixed(2) : (c.similarity != null ? c.similarity.toFixed(2) : '0.00')}</div>
                        </div>

                        <button
                          onClick={() => {
                            setIsCompareModalOpen(false);
                            onSelectCandidate && onSelectCandidate(c.candidate_id);
                          }}
                          className="w-full mt-3 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                        >
                          View Profile
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Head-to-Head Requirements Matrix */}
                  <div className="border border-slate-200 dark:border-surface-darkBorder rounded-2xl overflow-hidden">
                    <div className="p-3 bg-surface-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-surface-darkBorder font-bold text-xs text-navy-950 dark:text-slate-100">
                      Requirement-by-Requirement Comparison
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-surface-darkBorder bg-surface-50/40 dark:bg-slate-900/40 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                            <th className="py-2.5 px-3 min-w-[200px]">Requirement</th>
                            {comparisonData.candidates.map((c) => (
                              <th key={c.candidate_id} className="py-2.5 px-3 min-w-[140px] text-center">
                                {c.name.split(' ')[0]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                          {comparisonData.matrix_rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-navy-950 dark:text-slate-100 block">{row.original_text}</span>
                                <span className="text-[10px] text-slate-400">{row.classification}</span>
                              </td>
                              {comparisonData.candidates.map((c) => {
                                const evalItem = row.evaluations[c.candidate_id];
                                const status = evalItem?.status || 'UNVERIFIED';

                                return (
                                  <td key={c.candidate_id} className="py-2.5 px-3 text-center">
                                    {status === 'SATISFIED' ? (
                                      <span
                                        title={evalItem?.evidence && evalItem.evidence !== 'Evidence unavailable.' ? `Evidence: ${evalItem.evidence}` : 'Satisfied'}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 cursor-help"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Met
                                      </span>
                                    ) : status === 'GAP' ? (
                                      <span
                                        title={evalItem?.notes || 'Requirement Gap'}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 cursor-help"
                                      >
                                        <AlertCircle className="w-3 h-3" />
                                        Gap
                                      </span>
                                    ) : (
                                      <span
                                        title={evalItem?.notes || 'Requires verification'}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 cursor-help"
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                        Verify
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Candidate Deep Evidence Inspection Drawer / Modal */}
      {inspectCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-surface-darkCard rounded-3xl shadow-2xl border border-slate-200/80 dark:border-surface-darkBorder max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-surface-darkBorder flex items-center justify-between bg-surface-50 dark:bg-slate-900/60">
              <div>
                <h3 className="text-base font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>{inspectCandidate.name} – Match Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Detailed AI evidence citations and requirement verification notes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Direct jump from quick inspection modal into dedicated full-page Semantic Match Details */}
                <button
                  onClick={() => {
                    setDetailedMatchCandidate(inspectCandidate);
                    setInspectCandidate(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle transition-all"
                >
                  Open Full Match Details
                </button>
                <button
                  onClick={() => setInspectCandidate(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Executive Briefing */}
              {inspectCandidate.explanations?.summary_narrative && (
                <div className="p-3 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 rounded-xl text-brand-950 dark:text-brand-200 leading-relaxed">
                  <span className="font-bold block mb-1">AI Executive Briefing:</span>
                  {inspectCandidate.explanations.summary_narrative}
                </div>
              )}

              {/* Score and Eligibility Breakdown Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy-950 dark:text-slate-100 text-sm">
                    Match Score: {inspectCandidate.rawScore || inspectCandidate.matchScore}%
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Eligibility Tier:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTierColor(
                        inspectCandidate.eligibilityAdjustedTier || inspectCandidate.classification
                      )}`}
                    >
                      {inspectCandidate.eligibilityAdjustedTier || inspectCandidate.classification}
                    </span>
                  </div>
                </div>

                {/* Score vs Eligibility Detail */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder">
                  <span>
                    Raw Score Tier: <strong className="text-slate-700 dark:text-slate-200">{inspectCandidate.scoreBasedTier || inspectCandidate.classification}</strong>
                  </span>
                  <span>
                    Semantic Similarity: <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {inspectCandidate.semanticSimilarity != null
                        ? inspectCandidate.semanticSimilarity.toFixed(4)
                        : (inspectCandidate.similarity != null ? inspectCandidate.similarity.toFixed(4) : '0.0000')}
                    </strong>
                  </span>
                </div>

                {/* Mandatory Gap Warning Banner */}
                {(inspectCandidate.hasCriticalGap || (inspectCandidate.mandatoryGapCount || 0) > 0) && (
                  <div className="mt-2 p-2.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-900 dark:text-rose-200 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[11px] block">Mandatory Requirement Protection Alert:</span>
                      <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                        {inspectCandidate.criticalGapExplanation || inspectCandidate.explanations?.summary_narrative}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Evaluated Requirements List */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                  Requirement Verifications ({inspectCandidate.requirements?.length || 0})
                </span>
                <div className="space-y-2">
                  {/* Map through each evaluated JD requirement */}
                  {(inspectCandidate.requirements || []).map((req, idx) => {
                    // Extract verification status classification.
                    const evidenceStatus = req.evidence_status || (req.status === 'SATISFIED' ? 'DIRECT_MATCH' : req.status === 'PARTIAL' ? 'PARTIAL_MATCH' : req.status === 'GAP' ? 'MISSING' : 'UNVERIFIED');
                    const isMatched = evidenceStatus === 'DIRECT_MATCH' || evidenceStatus === 'EQUIVALENT_MATCH';
                    const vStatus = evidenceStatus;

                    // Determine verification badge styling.
                    const getVBadge = (status) => {
                      // Switch on status token.
                      switch (status) {
                        // Fully corroborated evidence.
                        case 'DIRECT_MATCH':
                        case 'EQUIVALENT_MATCH':
                          return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
                        // Partial skill or title match.
                        case 'PARTIAL_MATCH':
                          return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
                        // Requires human recruiter interview.
                        case 'UNVERIFIED':
                          return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
                        // Absent or negative evidence.
                        case 'MISSING':
                        default:
                          return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
                      }
                    };

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          isMatched
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                          : evidenceStatus === 'MISSING'
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {/* Requirement text and category */}
                          <div>
                            {/* Requirement title */}
                            <span className="font-bold text-navy-950 dark:text-slate-100">{req.original_text}</span>
                            {/* Category classification */}
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {req.classification} • {req.category_label || req.category}
                            </span>
                          </div>
                          {/* Verification and Met badges */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Verifiable status badge */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getVBadge(vStatus)}`}>
                              {vStatus}
                            </span>
                            {/* Evaluated outcome badge */}
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                isMatched
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : evidenceStatus === 'MISSING'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {evidenceStatus}
                            </span>
                          </div>
                        </div>

                        {/* Verbatim quote or genuine evidence note */}
                        <div className="mt-2 text-[11px] text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-lg border border-slate-200/60 dark:border-surface-darkBorder">
                          {/* Provenance source */}
                          <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">
                            {req.evidence_source ? `Source: ${req.evidence_source}` : 'Resume Evidence'}
                          </span>
                          {/* Verbatim excerpt */}
                          <p className="italic leading-relaxed">
                            {req.evidence && req.evidence !== 'Evidence unavailable.'
                              ? `"${req.evidence}"`
                              : req.notes || 'Evidence unavailable in indexed profile.'}
                          </p>
                        </div>
                        <span className="block mt-1 text-[10px] text-slate-500">{req.score_contribution == null ? 'No score contribution' : `Contribution: ${req.score_contribution}%`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
