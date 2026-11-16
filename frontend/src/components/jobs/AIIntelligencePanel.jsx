// AI-powered intelligence panel for a single Job Description.
// Wires live backend Phase 2C/2D intelligence: hiring difficulty, supply/demand,
// strategic sourcing recommendations, adjacent-skill alternatives, and vector-similar jobs.
import React, { useState, useEffect, useMemo } from 'react';

import { MetricCard, AnimatedMetricValue } from '../layout/MetricCard';
import {
  intelligenceApi,
  aiApi,
} from '../../api/client';

import {
  BarChart3,
  Users,
  TrendingUp,
  AlertTriangle,
  Target,
  Sparkles,
  Network,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Database,
  Lightbulb,
} from 'lucide-react';

const DIFFICULTY_COLORS = {
  Low: 'bg-emerald-500 text-emerald-900',
  Moderate: 'bg-amber-500 text-amber-900',
  High: 'bg-orange-500 text-orange-900',
  Critical: 'bg-rose-500 text-rose-900',
  'Insufficient Data': 'bg-slate-500 text-slate-900',
};

const PRIORITY_COLORS = {
  Critical: 'bg-rose-600 text-rose-100 border-rose-500',
  High: 'bg-orange-600 text-orange-100 border-orange-500',
  Medium: 'bg-amber-500 text-amber-900 border-amber-400',
  Low: 'bg-emerald-500 text-emerald-900 border-emerald-400',
};

const DIFFICULTY_LABEL = {
  Low: 'Low Difficulty',
  Moderate: 'Moderate Difficulty',
  High: 'High Difficulty',
  Critical: 'Critical Difficulty',
  'Insufficient Data': 'Insufficient Data',
};

const formatPct = (v) => (v == null ? '—' : `${Number(v).toFixed(0)}%`);

export const AIIntelligencePanel = ({
  jobId,
  job,
  onOpenSourcingTab,
  onNavigateToJob,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [difficulty, setDifficulty] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [alternatives, setAlternatives] = useState(null);
  const [similarJobs, setSimilarJobs] = useState([]);

  useEffect(() => {
    if (!jobId) return;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();

    const loadDifficulty = intelligenceApi
      .getJobHiringDifficulty(jobId)
      .then(setDifficulty)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn('hiring difficulty failed:', err.message);
      });

    const loadRecommendations = intelligenceApi
      .getJobSourcingRecommendations(jobId)
      .then(setRecommendations)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn('sourcing recommendations failed:', err.message);
      });

    const loadAlternatives = intelligenceApi
      .getJobSourcingAlternatives(jobId)
      .then(setAlternatives)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn('sourcing alternatives failed:', err.message);
      });

    const loadSimilarJobs = aiApi
      .getSimilarJobs(jobId, 5)
      .then(setSimilarJobs)
      .catch((err) => {
        if (!controller.signal.aborted) console.warn('similar jobs failed:', err.message);
      });

    Promise.all([loadDifficulty, loadRecommendations, loadAlternatives, loadSimilarJobs])
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));

    return () => controller.abort();
  }, [jobId]);

  const difficultyScore = difficulty?.difficulty_score ?? null;
  const difficultyClass = difficulty?.difficulty_classification ?? 'Insufficient Data';
  const difficultyColor = DIFFICULTY_COLORS[difficultyClass] || DIFFICULTY_COLORS['Insufficient Data'];
  const contributingFactors = difficulty?.contributing_factors || [];
  const skillScarcity = difficulty?.skill_scarcity_breakdown || [];
  const candidateSupply = difficulty?.candidate_supply || {};
  const locationConstraints = difficulty?.location_constraints || {};
  const suggestedActions = difficulty?.suggested_recruiter_actions || [];
  const dataCoverage = difficulty?.data_coverage || {};

  const totalPoints = useMemo(() => {
    if (!contributingFactors.length) return 0;
    return contributingFactors.reduce((sum, f) => sum + (f.impact_points || 0), 0);
  }, [contributingFactors]);

  const maxPoints = useMemo(() => {
    if (!contributingFactors.length) return 0;
    return contributingFactors.reduce((sum, f) => sum + (f.max_points || 0), 0);
  }, [contributingFactors]);

  const severityColor = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/40 border border-brand-200/80 dark:border-brand-700/60 text-brand-600 dark:text-brand-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white tracking-tight">AI Talent Intelligence</h3>
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <MetricCard key={i} title={`Metric ${i}`} value="—" isLoading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/40 border border-brand-200/80 dark:border-brand-700/60 text-brand-600 dark:text-brand-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900 dark:text-white tracking-tight">
              AI Talent Intelligence
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evidence-based hiring difficulty, supply & demand, and strategic sourcing
            </p>
          </div>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${difficultyColor}`}
        >
          {DIFFICULTY_LABEL[difficultyClass] || difficultyClass}
        </span>
      </div>

      {/* Difficulty Score & Supply KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Hiring Difficulty Score"
          value={difficultyScore == null ? '—' : Math.round(difficultyScore)}
          subvalue={dataCoverage.confidence ? `${dataCoverage.confidence} confidence` : ''}
          icon={AlertTriangle}
          badgeText={DIFFICULTY_LABEL[difficultyClass] || difficultyClass}
          badgeVariant="amber"
          trend={totalPoints && maxPoints ? `${totalPoints}/${maxPoints} pts` : null}
        />
        <MetricCard
          title="Fully Qualified"
          value={candidateSupply.fully_qualified_candidates ?? '—'}
          subvalue="meet all mandatory skills + exp + location"
          icon={Users}
          badgeText="internal supply"
          badgeVariant="brand"
        />
        <MetricCard
          title="Skill-Qualified"
          value={candidateSupply.skill_qualified_candidates ?? '—'}
          subvalue="meet mandatory skills only"
          icon={Target}
          badgeText="talent pool"
          badgeVariant="blue"
        />
        <MetricCard
          title="Available ≤30 Days"
          value={candidateSupply.available_ready_candidates ?? '—'}
          subvalue="immediate / short notice"
          icon={Clock}
          badgeText="hire-ready"
          badgeVariant="emerald"
        />
      </div>

      {/* Contributing Factors */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Difficulty Breakdown
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {difficultyScore == null ? 'N/A' : `${Math.round(difficultyScore)}/100`}
          </span>
        </div>
        {contributingFactors.length > 0 ? (
          <div className="space-y-2">
            {contributingFactors.map((factor) => {
              const pct = factor.max_points ? Math.round(((factor.impact_points || 0) / factor.max_points) * 100) : 0;
              return (
                <div key={factor.factor} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {factor.factor}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${severityColor(factor.severity)}`}>
                      {factor.severity}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${difficultyColor.replace('text-', '').replace('bg-', 'bg-')}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>{factor.impact_points || 0} / {factor.max_points} pts</span>
                    <span className="text-slate-400 italic">{factor.information_type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder text-center text-xs text-slate-500 dark:text-slate-400">
            No contributing factor data available.
          </div>
        )}
      </div>

      {/* Supply & Demand Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
            Candidate Supply
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Fully Qualified</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{candidateSupply.fully_qualified_candidates ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Skill-Qualified</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{candidateSupply.skill_qualified_candidates ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Available ≤30 Days</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{candidateSupply.available_ready_candidates ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Total in Database</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{candidateSupply.total_database_candidates ?? '—'}</span>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
            Location Constraints
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Job Location</span>
              <span className="font-medium text-navy-900 dark:text-slate-100 truncate max-w-[120px]">{locationConstraints.job_location ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Work Mode</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{locationConstraints.work_mode ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Location Restricted</span>
              <span className={`font-medium ${locationConstraints.location_restricted ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {String(locationConstraints.location_restricted === true ? 'Yes' : 'No')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Non-Local Skill-Matched</span>
              <span className="font-medium text-navy-900 dark:text-slate-100">{locationConstraints.non_local_skill_matched_candidates ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Scarcity */}
      {skillScarcity.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
            Mandatory Skill Scarcity
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {skillScarcity.slice(0, 6).map((skill) => {
              const cls = skill.classification || 'Balanced';
              const colorMap = {
                'Critical Shortage': 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300',
                'Low Supply': 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300',
                Balanced: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
                'High Supply': 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
              };
              return (
                <span
                  key={skill.skill}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${colorMap[cls] || colorMap.Balanced}`}
                >
                  {skill.skill}
                  <span className="ml-1 opacity-80">({skill.total_candidates ?? 0})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Sourcing Recommendations */}
      <div className="mb-6 border-t border-slate-100 dark:border-surface-darkBorder pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            AI Sourcing Recommendations
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">{recommendations.length} strategies</span>
        </div>
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const prioColor = PRIORITY_COLORS[rec.sourcing_priority] || PRIORITY_COLORS.Medium;
              return (
                <div key={rec.rec_id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-sm hover:border-brand-300/60 dark:hover:border-brand-700/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${prioColor}`}>
                        {rec.sourcing_priority}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{rec.action_type}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{rec.confidence} confidence</span>
                  </div>
                  <h5 className="text-sm font-semibold text-navy-900 dark:text-slate-100 mb-1">{rec.title}</h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{rec.reason}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Evidence:</span>
                    <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[200px]">{rec.supporting_evidence}</span>
                  </div>
                  {rec.related_skills && rec.related_skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Related skills:</span>
                      {rec.related_skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder text-center text-xs text-slate-500 dark:text-slate-400">
            No AI sourcing recommendations available for this job.
          </div>
        )}
      </div>

      {/* Similar Jobs */}
      {similarJobs.length > 0 && (
        <div className="border-t border-slate-100 dark:border-surface-darkBorder pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-indigo-500" />
              Similar Jobs (Vector Match)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">nemotron-3-embed-1b</span>
          </div>
          <div className="space-y-2.5">
            {similarJobs.map((sj) => (
              <div
                key={sj.job_id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-navy-900 dark:text-slate-100 truncate">
                    {sj.title || `Job #${sj.job_id}`}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>{sj.department ?? '—'}</span>
                    <span>•</span>
                    <span>{sj.location ?? '—'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {formatPct(sj.overlap_percent ?? sj.similarity)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToJob?.(sj.job_id)}
                    className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-semibold px-1.5 py-0.5 rounded hover:bg-brand-50/50"
                  >
                    Open <ChevronRight className="w-3 h-3 inline ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Recruiter Actions */}
      {suggestedActions.length > 0 && (
        <div className="mt-6 border-t border-slate-100 dark:border-surface-darkBorder pt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
            Suggested Recruiter Actions
          </h4>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
            {suggestedActions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-brand-500 mt-0.5 flex-shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Sourcing Action Bar */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Powered by Nemotron Intelligence Engine
        </span>
        {onOpenSourcingTab && (
          <button
            type="button"
            onClick={onOpenSourcingTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-semibold text-white shadow-sm transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            Open Talent Sourcing
          </button>
        )}
      </div>
    </div>
  );
};
