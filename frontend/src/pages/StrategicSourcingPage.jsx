import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  ShieldCheck,
  Sparkles,
  Users,
  RefreshCw,
  AlertCircle,
  GitBranch,
} from 'lucide-react';
import { intelligenceApi } from '../api/client';
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';

const PRIORITY_BADGE = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

export const StrategicSourcingPage = ({ jobs = [], onSelectCandidate }) => {
  const openJobs = jobs.filter((j) =>
    ['open', 'active', 'in progress', 'sourcing'].includes((j.status || '').toLowerCase())
  );
  const selectableJobs = openJobs.length > 0 ? openJobs : jobs;

  const [selectedJobId, setSelectedJobId] = useState(selectableJobs[0]?.id || null);
  const [recsData, setRecsData] = useState(null);
  const [altsData, setAltsData] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedJobId && selectableJobs[0]?.id) {
      setSelectedJobId(selectableJobs[0].id);
    }
  }, [selectableJobs, selectedJobId]);

  const loadSourcingData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const oppPromise = intelligenceApi.getCandidateSourcingOpportunities(20);
      if (selectedJobId) {
        const [recs, alts, opp] = await Promise.all([
          intelligenceApi.getJobSourcingRecommendations(selectedJobId),
          intelligenceApi.getJobSourcingAlternatives(selectedJobId),
          oppPromise,
        ]);
        setRecsData(recs);
        setAltsData(alts);
        setOpportunities(opp?.items || []);
      } else {
        const opp = await oppPromise;
        setOpportunities(opp?.items || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Strategic Sourcing Intelligence.');
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    loadSourcingData();
  }, [loadSourcingData]);

  return (
    <div className="space-y-6">
      {/* Advisory Notice & Job Selector */}
      <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                Strategic Sourcing Intelligence
              </h2>
              <Badge variant="warning" size="sm">Advisory Only · Recruiter Review Required</Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Recommendations never modify job requirements, matching scores, or candidate records automatically.
              Adjacent skills are strictly separated from exact matches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedJobId || ''}
            onChange={(e) => setSelectedJobId(Number(e.target.value))}
            aria-label="Select job for strategic sourcing"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 max-w-xs"
          >
            {selectableJobs.length === 0 && <option value="">No jobs available</option>}
            {selectableJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.client || j.client_name || 'Internal'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadSourcingData}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-navy-900 dark:text-slate-100 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-10 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder flex justify-center">
          <LatticeLoader label="Generating sourcing strategies" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Advisory Recommendations */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Sourcing Recommendations ({recsData?.recommendations_count ?? 0})
            </h3>
            {(recsData?.recommendations || []).map((rec) => (
              <div
                key={rec.id}
                className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-4 shadow-subtle space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-bold text-navy-950 dark:text-slate-100">{rec.title}</div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant={PRIORITY_BADGE[rec.sourcing_priority] || 'neutral'} size="sm">
                      {rec.sourcing_priority} Priority
                    </Badge>
                    <Badge variant="neutral" size="sm">Confidence: {rec.confidence}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{rec.reason}</p>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-surface-darkBorder text-[11px] text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Supporting Evidence: </span>
                  {rec.supporting_evidence}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(rec.relevant_requirements || []).map((sk) => (
                      <Badge key={`req-${sk}`} variant="info" size="sm">Req: {sk}</Badge>
                    ))}
                    {(rec.related_skills || []).map((sk) => (
                      <Badge key={`rel-${sk}`} variant="brand" size="sm">Related: {sk}</Badge>
                    ))}
                  </div>
                  <span className="text-slate-500">{rec.information_type}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Alternative / Adjacent Candidates & Underutilized Talent */}
          <div className="lg:col-span-5 space-y-6">
            {/* Adjacent & Partial-Fit Alternatives */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-1">
                <GitBranch className="w-4 h-4 text-indigo-600" />
                Transferable & Adjacent-Skill Candidates
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Distinguishes exact verified matches from related adjacent skills ({altsData?.total_alternative_candidates ?? 0} found).
              </p>
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {(altsData?.candidates || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No adjacent-skill candidates found for this role.</p>
                ) : (
                  altsData.candidates.slice(0, 12).map((cand) => (
                    <div
                      key={cand.candidate_id}
                      onClick={() => onSelectCandidate && onSelectCandidate({ id: cand.candidate_id, name: cand.name })}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder hover:border-brand-400 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-navy-900 dark:text-slate-100">{cand.name}</span>
                        <Badge variant="info" size="sm">{cand.transferability_indicator}% Transferability</Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {cand.stage} · {cand.location} · {cand.experience_years ?? 'N/A'} yrs
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cand.exact_skills_matched.map((s) => (
                          <Badge key={`ex-${s}`} variant="brand" size="sm">Exact: {s}</Badge>
                        ))}
                        {cand.adjacent_skills_matched.map((a) => (
                          <Badge key={`adj-${a.skill}`} variant="warning" size="sm">Adjacent: {a.skill}</Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Underutilized Database Candidates */}
            <div className="rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder p-5 shadow-subtle">
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-emerald-600" />
                Underutilized Internal Candidates
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Early-stage candidates (&ge;50% skill overlap) across open requisitions.
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {opportunities.slice(0, 10).map((opp) => (
                  <div
                    key={opp.candidate_id}
                    onClick={() => onSelectCandidate && onSelectCandidate({ id: opp.candidate_id, name: opp.name })}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-surface-darkBorder hover:border-brand-400 cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate">{opp.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {opp.stage} · Top fit: {opp.top_matching_jobs?.[0]?.title} ({opp.top_matching_jobs?.[0]?.mandatory_coverage_pct}%)
                      </div>
                    </div>
                    <Badge variant="brand" size="sm">{opp.matching_open_jobs_count} job(s)</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
