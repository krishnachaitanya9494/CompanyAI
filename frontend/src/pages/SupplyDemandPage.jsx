import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Briefcase,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { intelligenceApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';

const CLASSIFICATION_BADGE = {
  'Critical Shortage': 'danger',
  'Low Supply': 'warning',
  'Balanced Supply': 'brand',
  'High Supply': 'info',
  'Insufficient Data': 'neutral',
};

export const SupplyDemandPage = () => {
  const [overview, setOverview] = useState(null);
  const [skillsList, setSkillsList] = useState([]);
  const [selectedClassification, setSelectedClassification] = useState('');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, sk] = await Promise.all([
        intelligenceApi.getSupplyDemandOverview(),
        intelligenceApi.getSupplyDemandSkills({
          classification: selectedClassification || undefined,
          limit: 60,
        }),
      ]);
      setOverview(ov);
      setSkillsList(sk?.items || []);
      const firstJobId = ov?.job_coverage_summary?.[0]?.job_id;
      if (firstJobId && !selectedJobId) {
        setSelectedJobId(firstJobId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Talent Supply & Demand Intelligence.');
    } finally {
      setLoading(false);
    }
  }, [selectedClassification, selectedJobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null);
      return;
    }
    let active = true;
    setJobLoading(true);
    intelligenceApi
      .getJobSupplyDemand(selectedJobId)
      .then((res) => {
        if (active) setJobDetail(res);
      })
      .catch(() => {
        if (active) setJobDetail(null);
      })
      .finally(() => {
        if (active) setJobLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedJobId]);

  const summary = overview?.summary || {};
  const methodology = overview?.methodology || {};

  return (
    <div className="space-y-6">
      {/* Methodology & Thresholds Banner */}
      <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 max-w-4xl">
          <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-950 dark:text-slate-100">
              Talent Supply & Demand Intelligence
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {methodology.methodology ||
                'Compares unique internal candidate supply against open job skill, experience, and location demand.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder flex justify-center">
          <LatticeLoader label="Calculating supply vs demand" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && overview && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle">
              <div className="text-[11px] font-semibold text-slate-500">Skills in Demand</div>
              <div className="text-2xl font-bold text-navy-950 dark:text-slate-100 mt-1">{summary.skills_in_demand_count ?? 0}</div>
              <div className="text-[11px] text-slate-500">{summary.open_jobs_count ?? 0} open jobs · {summary.total_openings ?? 0} openings</div>
            </div>
            <div className="rounded-2xl bg-red-50/70 dark:bg-red-950/20 border border-red-200/80 dark:border-red-800/60 p-4">
              <div className="text-[11px] font-semibold text-red-700 dark:text-red-300">Critical Shortage</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{summary.critical_shortage_count ?? 0}</div>
              <div className="text-[11px] text-red-600/80 dark:text-red-400">Ratio &lt; {methodology.low_supply_min_ratio ?? 1.0}x</div>
            </div>
            <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 p-4">
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Low Supply</div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.low_supply_count ?? 0}</div>
              <div className="text-[11px] text-amber-600/80 dark:text-amber-400">Ratio 1.0x – 1.99x</div>
            </div>
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 p-4">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Balanced Supply</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.balanced_supply_count ?? 0}</div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400">Ratio 2.0x – 4.99x</div>
            </div>
            <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 p-4">
              <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">High Supply</div>
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{summary.high_supply_count ?? 0}</div>
              <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400">Ratio &ge; {methodology.high_supply_min_ratio ?? 5.0}x</div>
            </div>
          </div>

          {/* Skill Shortage Matrix Table */}
          <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Skill Supply vs Demand Matrix (Unique Candidates)
              </h3>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                aria-label="Filter by supply classification"
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs text-navy-900 dark:text-slate-100"
              >
                <option value="">All Classifications</option>
                <option value="Critical Shortage">Critical Shortage</option>
                <option value="Low Supply">Low Supply</option>
                <option value="Balanced Supply">Balanced Supply</option>
                <option value="High Supply">High Supply</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-surface-darkBorder text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-3 font-semibold">Skill</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unique Supply</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Exp Matched</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Loc Matched</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Available</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Openings (Jobs)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ratio</th>
                    <th className="py-2.5 pl-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {skillsList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        No demand skills match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    skillsList.map((row) => (
                      <tr
                        key={row.skill}
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2.5 pr-3 font-bold text-navy-900 dark:text-slate-100">{row.skill}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.category}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">{row.total_candidates}</td>
                        <td className="py-2.5 px-3 text-right">{row.experience_matched_candidates}</td>
                        <td className="py-2.5 px-3 text-right">{row.location_matched_candidates}</td>
                        <td className="py-2.5 px-3 text-right">{row.available_candidates}</td>
                        <td className="py-2.5 px-3 text-right">
                          {row.total_openings} ({row.open_jobs_requiring})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {row.supply_to_demand_ratio != null ? `${row.supply_to_demand_ratio}x` : '—'}
                        </td>
                        <td className="py-2.5 pl-3">
                          <Badge variant={CLASSIFICATION_BADGE[row.classification] || 'neutral'} size="sm">
                            {row.classification}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Job-Wise Coverage & Interactive Drill-Down */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-brand-600" />
                Job-Wise Skill Coverage (Click to Drill Down)
              </h3>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {(overview.job_coverage_summary || []).map((j) => (
                  <button
                    key={j.job_id}
                    type="button"
                    onClick={() => setSelectedJobId(j.job_id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      selectedJobId === j.job_id
                        ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-400 dark:border-brand-700'
                        : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-surface-darkBorder hover:border-brand-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-navy-950 dark:text-slate-100 truncate">{j.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {j.client_name || 'Internal'} · {j.location} · {j.openings_count} opening(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          j.critical_shortage_skills?.length > 0
                            ? 'danger'
                            : j.overall_skill_coverage_pct >= 80
                            ? 'brand'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {j.overall_skill_coverage_pct != null ? `${j.overall_skill_coverage_pct}%` : 'No Skills'}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-indigo-600" />
                Job Requirement Supply Drill-Down
              </h3>
              {jobLoading && <p className="text-xs text-slate-500 py-6">Loading job supply breakdown...</p>}
              {!jobLoading && !jobDetail && (
                <p className="text-xs text-slate-500 py-6">Select an open job on the left to inspect requirement-level supply.</p>
              )}
              {!jobLoading && jobDetail && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-navy-950 dark:text-slate-100">{jobDetail.job.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {jobDetail.job.location} · Min Exp: {jobDetail.job.min_experience_years ?? 'Not specified'} yrs · {jobDetail.job.openings_count} opening(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-brand-700 dark:text-brand-300">
                        {jobDetail.fully_qualified_candidates ?? 0} Fully Qualified
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {jobDetail.skill_qualified_candidates ?? 0} Skill-Matched (All Locations/Exp)
                      </div>
                    </div>
                  </div>

                  {jobDetail.data_status === 'Insufficient Data' ? (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-800 dark:text-amber-200">
                      Insufficient Data: No structured mandatory or preferred skills recorded for this job.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...jobDetail.mandatory_skill_supply, ...jobDetail.preferred_skill_supply].map((req) => (
                        <div
                          key={`${req.requirement_type}-${req.skill}`}
                          className="p-3 rounded-xl border border-slate-200/80 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-navy-900 dark:text-slate-100">{req.skill}</span>
                              <Badge variant={req.requirement_type === 'mandatory' ? 'info' : 'neutral'} size="sm">
                                {req.requirement_type}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Total: {req.total_candidates} · Exp OK: {req.experience_matched_candidates} · Loc OK: {req.location_matched_candidates} · Eligible: {req.eligible_candidates}
                            </div>
                          </div>
                          <Badge variant={CLASSIFICATION_BADGE[req.classification] || 'neutral'} size="sm">
                            {req.classification} ({req.supply_to_demand_ratio != null ? `${req.supply_to_demand_ratio}x` : '—'})
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
