import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Users,
  Info,
  ChevronRight,
} from 'lucide-react';
import { intelligenceApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';

const TIER_BADGE = {
  'Very High Difficulty': 'danger',
  'High Difficulty': 'warning',
  'Moderate Difficulty': 'info',
  'Low Difficulty': 'brand',
  'Insufficient Data': 'neutral',
};

export const HiringDifficultyPage = () => {
  const [overview, setOverview] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await intelligenceApi.getHiringDifficultyOverview(false);
      setOverview(res);
      const firstId = res?.items?.[0]?.job_id;
      if (firstId && !selectedJobId) {
        setSelectedJobId(firstId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Hiring Difficulty assessments.');
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    intelligenceApi
      .getJobHiringDifficulty(selectedJobId)
      .then((res) => {
        if (active) setJobDetail(res);
      })
      .catch(() => {
        if (active) setJobDetail(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedJobId]);

  return (
    <div className="space-y-6">
      {/* Heuristic Methodology Notice */}
      <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                Hiring Difficulty Predictor
              </h2>
              <Badge variant="info" size="sm">
                {overview?.assessment_type || 'Evidence-based heuristic assessment (not an ML model)'}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Scores 0–100 using transparent weights: Mandatory Skill Scarcity (35), Qualified Supply Depth (20),
              Experience &amp; Location Constraints (20), Openings &amp; Complexity (15), Availability &amp; Interviews (10).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder flex justify-center">
          <LatticeLoader label="Evaluating hiring difficulty heuristics" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
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
          {/* Tier Distribution Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(overview.tier_distribution || []).map((t) => (
              <div
                key={t.tier}
                className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle"
              >
                <div className="text-[11px] font-semibold text-slate-500">{t.tier}</div>
                <div className="text-2xl font-bold text-navy-950 dark:text-slate-100 mt-1">{t.count}</div>
              </div>
            ))}
          </div>

          {/* Jobs List + Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 mb-3">
                Open Requisitions Ranked by Difficulty ({overview.total_jobs_assessed})
              </h3>
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {(overview.items || []).map((item) => (
                  <button
                    key={item.job_id}
                    type="button"
                    onClick={() => setSelectedJobId(item.job_id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      selectedJobId === item.job_id
                        ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-400 dark:border-brand-700'
                        : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-surface-darkBorder hover:border-brand-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-navy-950 dark:text-slate-100 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.client_name || 'Internal'} · {item.location} · {item.fully_qualified_candidates ?? 0} qualified
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={TIER_BADGE[item.difficulty_classification] || 'neutral'} size="sm">
                        {item.difficulty_score != null ? `${item.difficulty_score}/100` : 'N/A'} · {item.difficulty_classification}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle space-y-5">
              {detailLoading && <p className="text-xs text-slate-500 py-8">Loading job difficulty breakdown...</p>}
              {!detailLoading && !jobDetail && (
                <p className="text-xs text-slate-500 py-8">Select a job on the left to inspect contributing difficulty factors.</p>
              )}
              {!detailLoading && jobDetail && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-surface-darkBorder">
                    <div>
                      <h3 className="text-base font-bold text-navy-950 dark:text-slate-100">{jobDetail.job.title}</h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {jobDetail.job.client_name || 'Internal'} · {jobDetail.job.location} · {jobDetail.job.openings_count} opening(s) · Priority: {jobDetail.job.priority}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={TIER_BADGE[jobDetail.difficulty_classification] || 'neutral'} size="md">
                        {jobDetail.difficulty_classification}
                        {jobDetail.difficulty_score != null ? ` (${jobDetail.difficulty_score}/100)` : ''}
                      </Badge>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Data Confidence: <span className="font-semibold">{jobDetail.data_coverage?.confidence}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contributing Factors */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Contributing Heuristic Factors
                    </h4>
                    {(jobDetail.contributing_factors || []).map((f) => (
                      <div
                        key={f.factor}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-navy-900 dark:text-slate-100">{f.factor}</span>
                          <span className="font-mono font-semibold text-navy-900 dark:text-slate-100">
                            {f.impact_points} / {f.max_points} pts ({f.severity})
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              f.severity === 'High'
                                ? 'bg-red-500'
                                : f.severity === 'Moderate'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${f.max_points ? (f.impact_points / f.max_points) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{f.evidence}</p>
                        <div className="text-[10px] text-slate-400">{f.information_type}</div>
                      </div>
                    ))}
                  </div>

                  {/* Supply & Location Constraints */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-slate-200/80 dark:border-surface-darkBorder">
                      <div className="font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                        <Users className="w-3.5 h-3.5 text-brand-600" />
                        Internal Candidate Supply
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                        <div>Fully Qualified: {jobDetail.candidate_supply?.fully_qualified_candidates ?? 0}</div>
                        <div>Skill-Qualified (All Loc/Exp): {jobDetail.candidate_supply?.skill_qualified_candidates ?? 0}</div>
                        <div>Ready &le;30 Days (Recorded): {jobDetail.candidate_supply?.available_ready_candidates ?? 0}</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200/80 dark:border-surface-darkBorder">
                      <div className="font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        Location &amp; Data Coverage
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                        <div>Location: {jobDetail.location_constraints?.job_location}</div>
                        <div>Restricted: {jobDetail.location_constraints?.location_restricted ? 'Yes' : 'No'}</div>
                        <div>Missing Fields: {(jobDetail.data_coverage?.missing_fields || []).join(', ') || 'None'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Recruiter Actions */}
                  <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200/80 dark:border-brand-800/50">
                    <div className="text-xs font-bold text-brand-800 dark:text-brand-300 flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Suggested Recruiter Actions
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {(jobDetail.suggested_recruiter_actions || []).map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
