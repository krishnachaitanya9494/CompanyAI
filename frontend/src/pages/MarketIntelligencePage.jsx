import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe2,
  Filter,
  RefreshCw,
  AlertCircle,
  Info,
  Layers,
  MapPin,
  Clock,
  Briefcase,
  Sparkles,
  GitMerge,
} from 'lucide-react';
import { intelligenceApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';

export const MarketIntelligencePage = () => {
  const [data, setData] = useState(null);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter controls
  const [skillFilter, setSkillFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');

  const loadMarketData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, combosRes] = await Promise.all([
        intelligenceApi.getMarketOverview({
          skill: skillFilter || undefined,
          category: categoryFilter || undefined,
          experience_band: expFilter || undefined,
          location: locFilter || undefined,
          availability: availFilter || undefined,
        }),
        intelligenceApi.getMarketSkillCombinations(2, 12),
      ]);
      setData(overviewRes);
      setCombos(combosRes?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load Internal Talent Market Intelligence.');
    } finally {
      setLoading(false);
    }
  }, [skillFilter, categoryFilter, expFilter, locFilter, availFilter]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  const resetFilters = () => {
    setSkillFilter('');
    setCategoryFilter('');
    setExpFilter('');
    setLocFilter('');
    setAvailFilter('');
  };

  const summary = data?.summary || {};
  const filterOpts = data?.available_filter_options || {};
  const maxSkillCount = Math.max(1, ...(data?.top_skills || []).map((s) => s.candidate_count || 0));
  const maxCatCount = Math.max(1, ...(data?.technology_categories || []).map((c) => c.unique_candidates || 0));

  return (
    <div className="space-y-6">
      {/* Explicit Scope Banner: Internal Talent Market Intelligence */}
      <div className="rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                {data?.scope_label || 'Internal Talent Market Intelligence'}
              </h2>
              <Badge variant="info" size="sm">Internal SQLite Pool Only</Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {data?.scope_notice ||
                'Derived strictly from internal candidate, resume, and job records. External market benchmarks and salary data are not connected.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadMarketData}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 hover:bg-slate-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle">
        <div className="flex items-center gap-2 text-xs font-bold text-navy-900 dark:text-slate-100 mb-3">
          <Filter className="w-4 h-4 text-brand-600" />
          <span>Filter Internal Talent Pool</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="text"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="Skill (e.g. Java, React)..."
            aria-label="Filter by skill"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by technology category"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100"
          >
            <option value="">All Categories</option>
            {(filterOpts.categories || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={expFilter}
            onChange={(e) => setExpFilter(e.target.value)}
            aria-label="Filter by experience band"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100"
          >
            <option value="">All Experience Bands</option>
            {(filterOpts.experience_bands || []).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
            aria-label="Filter by location"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100"
          >
            <option value="">All Locations</option>
            {(filterOpts.locations || []).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            aria-label="Filter by availability"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100"
          >
            <option value="">All Availability</option>
            {(filterOpts.availabilities || []).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder flex justify-center">
          <LatticeLoader label="Analyzing internal talent market" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Filtered Candidates</div>
              <div className="text-2xl font-bold text-navy-950 dark:text-slate-100 mt-1">
                {summary.filtered_candidates ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                of {summary.total_database_candidates ?? 0} total in SQLite
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Unique Canonical Skills</div>
              <div className="text-2xl font-bold text-navy-950 dark:text-slate-100 mt-1">
                {summary.unique_skills_represented ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Deduplicated via taxonomy</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Open Jobs / Openings</div>
              <div className="text-2xl font-bold text-navy-950 dark:text-slate-100 mt-1">
                {summary.open_jobs_count ?? 0} <span className="text-sm font-medium text-slate-500">/ {summary.total_openings ?? 0} pos</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Active requisitions</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle" title="Filtered candidates divided by total open positions">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Candidate-to-Opening Ratio</div>
              <div className="text-2xl font-bold text-brand-700 dark:text-brand-400 mt-1">
                {summary.candidate_to_opening_ratio != null ? `${summary.candidate_to_opening_ratio}x` : 'Insufficient Data'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Internal supply indicator</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle" title="Percentage of open-job required/preferred skills present in the filtered candidate pool">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Demand Skill Overlap</div>
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">
                {summary.demand_skill_overlap_pct != null ? `${summary.demand_skill_overlap_pct}%` : 'Insufficient Data'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {data.skill_overlap?.overlapping_skills_count ?? 0} of {data.skill_overlap?.total_open_job_skills ?? 0} demand skills
              </div>
            </div>
          </div>

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Skills Distribution */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  Most Represented Skills (Unique Candidates)
                </h3>
                <span className="text-[11px] text-slate-500">Top {data.top_skills?.length || 0}</span>
              </div>
              {(data.top_skills || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No skills match the selected filters.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.top_skills.map((item) => (
                    <div key={item.skill} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-navy-900 dark:text-slate-100 truncate">{item.skill}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex-shrink-0">
                          {item.candidate_count} ({item.pool_share_pct}%) · {item.open_jobs_requiring} job(s)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500 group-hover:brightness-110"
                          style={{ width: `${Math.max(4, (item.candidate_count / maxSkillCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Technology Categories & Experience */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Technology Category Breakdown
                </h3>
                {(data.technology_categories || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No category data for current filters.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.technology_categories.map((cat) => (
                      <div key={cat.category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-navy-900 dark:text-slate-100">{cat.category}</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {cat.unique_candidates} candidates ({cat.share_pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${Math.max(4, (cat.unique_candidates / maxCatCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  Experience Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(data.experience_distribution || []).map((band) => (
                    <div
                      key={band.band}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{band.band}</div>
                      <div className="text-lg font-bold text-navy-950 dark:text-slate-100 mt-0.5">
                        {band.candidate_count}
                        <span className="text-[11px] font-normal text-slate-500 ml-1">({band.share_pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Location, Availability, Skill Combinations & Emerging Skills */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Location Distribution */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-rose-600" />
                Location Distribution
              </h3>
              <div className="space-y-2">
                {(data.location_distribution || []).map((loc) => (
                  <div key={loc.location} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-medium text-navy-900 dark:text-slate-100">{loc.location}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {loc.candidate_count} ({loc.share_pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Availability Distribution */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-emerald-600" />
                Talent Availability Overview
              </h3>
              <div className="space-y-2">
                {(data.availability_distribution || []).map((av) => (
                  <div key={av.availability} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-medium text-navy-900 dark:text-slate-100">{av.availability}</span>
                    <Badge variant={av.availability === 'Not Recorded' ? 'neutral' : 'brand'} size="sm">
                      {av.candidate_count} ({av.share_pct}%)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Emerging Skills Across Resume Versions */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-brand-600" />
                Emerging Skills Across Resume Versions
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{data.emerging_skills?.note}</p>
              {data.emerging_skills?.status === 'Insufficient Data' || (data.emerging_skills?.emerging_skills || []).length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                  Status: <span className="font-semibold">{data.emerging_skills?.status || 'Insufficient Data'}</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.emerging_skills.emerging_skills.map((es) => (
                    <Badge key={es.skill} variant="brand" size="sm">
                      {es.skill} (+{es.new_appearances_in_latest_resumes})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Skill Combinations */}
          <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
            <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
              <GitMerge className="w-4 h-4 text-indigo-600" />
              Common Technology Skill Combinations
            </h3>
            {combos.length === 0 ? (
              <p className="text-xs text-slate-500">Insufficient co-occurring skill combinations found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {combos.map((pair) => (
                  <div
                    key={`${pair.skill_a}-${pair.skill_b}`}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate">
                        {pair.skill_a} + {pair.skill_b}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{pair.category_a}</div>
                    </div>
                    <Badge variant="info" size="sm">{pair.candidate_count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
