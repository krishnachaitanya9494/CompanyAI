// Import React and hooks for semantic matching detail state and UI interactions.
import React, { useState, useMemo, useEffect } from 'react';

// Import common Badge component for skill and verification tags.
import { Badge } from '../components/common/Badge';

// Import jobApi and approvalApi for real-time JD segmentation provenance and recruiter actions.
import { jobApi, approvalApi } from '../api/client';

// Import lucide-react icons for enterprise visual clarity across Light and Dark modes.
import {
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  FileText,
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  UserCheck,
  Scale,
  Eye,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
  Info,
  Send,
  User,
  Check,
  X,
} from 'lucide-react';

// Export dedicated Semantic JD Matching Details Page fulfilling Section 7 A-H requirements.
export const SemanticMatchingDetailPage = ({
  job,
  candidateMatch,
  allMatches = [],
  onBack,
  onSelectMatch,
  onCompareCandidate,
  onOpenResume,
  onOpenCandidateProfile,
  onUpdateCandidateStage,
  onRefreshApprovals,
}) => {
  // Toggle state for score calculation methodology guide.
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);

  // Filter tab state for Skills Coverage breakdown ('all', 'matched', 'partial', 'unverified', 'gap').
  const [skillFilter, setSkillFilter] = useState('all');

  // Toggle state for JD description provenance panel ('original', 'segmented').
  const [jdViewMode, setJdViewMode] = useState('segmented');

  // Confirmation modal state for record-mutating recruiter actions.
  const [confirmAction, setConfirmAction] = useState(null);

  // Processing state during API mutation calls.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status feedback notification banner after executing or proposing an action.
  const [actionBanner, setActionBanner] = useState(null);

  // Detailed JD segmentation metadata fetched from Job Intelligence backend.
  const [segmentationData, setSegmentationData] = useState(null);

  // Fetch active JD segmentation provenance using shared jobApi helper and unwrap segmentation payload.
  useEffect(() => {
    // Abort fetch if no valid job ID exists.
    if (!job?.id) return;
    // Retrieve JD intelligence segmentation details to distinguish AI-extracted vs recruiter-approved text.
    jobApi
      .getSegmentation(job.id)
      .then((data) => {
        // Unwrap nested segmentation dictionary returned by /api/jobs/{id}/segmentation.
        const seg = data?.segmentation || data;
        if (seg) setSegmentationData(seg);
      })
      .catch(() => setSegmentationData(null));
  }, [job?.id]);

  // Guard rendering if required match payload is absent.
  if (!candidateMatch || !job) {
    return null;
  }

  // Extract backend score and eligibility properties preserving raw values without frontend overrides.
  const overallScore = candidateMatch.rawScore ?? candidateMatch.matchScore ?? 0;
  const rawScoreTier = candidateMatch.scoreBasedTier || candidateMatch.classification || 'Unclassified';
  const eligibilityTier = candidateMatch.eligibilityAdjustedTier || candidateMatch.classification || 'Unclassified';
  const semanticSim =
    candidateMatch.semanticSimilarity != null
      ? candidateMatch.semanticSimilarity
      : candidateMatch.rawCosineSimilarity != null
      ? candidateMatch.rawCosineSimilarity
      : candidateMatch.similarity || 0;
  const hasCriticalGap = Boolean(candidateMatch.hasCriticalGap || (candidateMatch.mandatoryGapCount || 0) > 0);
  const requirements = candidateMatch.requirements || [];
  const componentScores = candidateMatch.componentScores || candidateMatch.component_scores || {};

  // Read the same effective weights used by the backend after unavailable inputs are excluded.
  const effectiveWeights = candidateMatch.match_provenance?.effective_weights_percent || {};
  const weightDefinitions = [
    {
      key: 'mandatory_skills',
      label: 'Mandatory Requirements',
      weight: effectiveWeights.mandatory_skills ?? 0,
      score: componentScores.mandatory_skills,
      desc: 'Deterministic coverage of mandatory skills and critical JD prerequisites.',
      barColor: 'bg-brand-600 dark:bg-brand-500',
    },
    {
      key: 'preferred_skills',
      label: 'Preferred Requirements',
      weight: effectiveWeights.preferred_skills ?? 0,
      score: componentScores.preferred_skills,
      desc: 'Evaluation of desirable or nice-to-have technical competencies.',
      barColor: 'bg-blue-600 dark:bg-blue-500',
    },
    {
      key: 'relevant_experience',
      label: 'Experience Alignment',
      weight: effectiveWeights.relevant_experience ?? 0,
      score: componentScores.relevant_experience,
      desc: 'Years of hands-on industry experience compared against JD bounds.',
      barColor: 'bg-emerald-600 dark:bg-emerald-500',
    },
    {
      key: 'domain_fit',
      label: 'Domain Knowledge',
      weight: effectiveWeights.domain_fit ?? 0,
      score: componentScores.domain_fit,
      desc: 'Contextual alignment across business domain and functional responsibilities.',
      barColor: 'bg-purple-600 dark:bg-purple-500',
    },
    {
      key: 'semantic_relevance',
      label: 'Semantic Retrieval Fit',
      weight: effectiveWeights.semantic_relevance ?? 0,
      score: componentScores.semantic_relevance,
      desc: 'Vector cosine similarity is included only when compatible vectors are available.',
      barColor: 'bg-amber-600 dark:bg-amber-500',
    },
  ];

  // Helper to resolve tier badge styling classes cleanly across Light and Dark modes.
  const getTierBadgeStyle = (tier) => {
    const t = String(tier || '').toLowerCase();
    if (t.includes('excellent')) return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    if (t.includes('strong')) return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    if (t.includes('potential')) return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  // Partition evaluated requirements into Evidence Coverage buckets for Section C & F.
  const coverageBuckets = useMemo(() => {
    const satisfied = [];
    const partial = [];
    const unverified = [];
    const gaps = [];

    requirements.forEach((req) => {
      const vStatus = req.verification_status || '';
      // Classify partially supported profile/skill evidence BEFORE checking req.status so skill tags are never labeled VERIFIED SATISFIED.
      if (vStatus === 'PARTIALLY_SUPPORTED') {
        partial.push(req);
      } else if (vStatus === 'VERIFIED' || (req.status === 'SATISFIED' && vStatus !== 'UNVERIFIED')) {
        satisfied.push(req);
      } else if (req.status === 'GAP' || vStatus === 'NO_EVIDENCE') {
        gaps.push(req);
      } else {
        unverified.push(req);
      }
    });

    return { satisfied, partial, unverified, gaps };
  }, [requirements]);

  // Filter requirements matrix rows based on active Skills Coverage filter pill.
  const visibleRequirements = useMemo(() => {
    if (skillFilter === 'matched') return coverageBuckets.satisfied;
    if (skillFilter === 'partial') return coverageBuckets.partial;
    if (skillFilter === 'unverified') return coverageBuckets.unverified;
    if (skillFilter === 'gap') return coverageBuckets.gaps;
    return requirements;
  }, [requirements, skillFilter, coverageBuckets]);

  // Compute unique similar candidates from same job excluding current candidate (de-duplicated).
  const similarCandidates = useMemo(() => {
    const seen = new Set([candidateMatch.candidate_id || candidateMatch.id]);
    const list = [];
    for (const item of allMatches) {
      const cid = item.candidate_id || item.id;
      if (!seen.has(cid)) {
        seen.add(cid);
        list.push(item);
      }
      if (list.length >= 5) break;
    }
    return list;
  }, [allMatches, candidateMatch]);

  // Handler executing confirmed recruiter workflow mutations (Shortlist, Pipeline, Approval Review).
  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setIsSubmitting(true);
    setActionBanner(null);

    try {
      const candId = candidateMatch.candidate_id || candidateMatch.id;
      if (confirmAction.type === 'shortlist' || confirmAction.type === 'pipeline') {
        // Trigger stage update through central handler backed by PATCH /api/candidates/{id}.
        const targetStage = confirmAction.type === 'shortlist' ? 'Shortlisted' : confirmAction.targetStage;
        if (onUpdateCandidateStage) {
          await onUpdateCandidateStage(
            { id: candId, name: candidateMatch.name, status: targetStage, stage: targetStage },
            `${candidateMatch.name} moved to ${targetStage} for ${job.title}`
          );
        }
        setActionBanner({
          type: 'success',
          text: `${candidateMatch.name} successfully updated to "${targetStage}".`,
        });
      } else if (confirmAction.type === 'approval') {
        // Submit request to Human-in-the-Loop Approvals Queue.
        const resp = await approvalApi.propose({
          action_type: 'update_candidate_stage',
          description: `Request hiring manager review to shortlist ${candidateMatch.name} (${overallScore}% match) for ${job.title}`,
          payload: { candidate_id: candId, new_stage: 'Shortlisted', job_id: job.id },
          requester: 'Recruiter Workspace',
        });
        if (onRefreshApprovals) onRefreshApprovals();
        setActionBanner({
          type: 'success',
          text: `Approval Request #${resp.approval_id} submitted to Human-in-the-Loop queue.`,
        });
      }
    } catch (err) {
      setActionBanner({
        type: 'error',
        text: `Action failed: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6 pb-14 animate-fadeIn">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-darkHover shadow-subtle transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Matching Matrix</span>
        </button>

        {/* Grounded Verification Indicator Pill */}
        <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Phase 5C Explainable Semantic Engine • 2,048-dim Vectors</span>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            actionBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionBanner.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{actionBanner.text}</span>
          </div>
          <button onClick={() => setActionBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION A: MATCH OVERVIEW HERO HEADER */}
      <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 md:p-6 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Candidate Profile Identity & Target Role Context */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/60 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-base">
                {(candidateMatch.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-navy-900 dark:text-white tracking-tight">
                    {candidateMatch.name}
                  </h2>
                  <Badge variant="neutral" size="xs">
                    {candidateMatch.stage || candidateMatch.status || 'Screened'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {candidateMatch.currentRole || 'Software Consultant'} • Target: <strong className="text-navy-900 dark:text-slate-200">{job.title}</strong>
                </p>
              </div>
            </div>

            {/* Metadata Row: Experience, Location, Resume Version, Timestamp */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {candidateMatch.experienceYears != null ? `${candidateMatch.experienceYears} Years Experience` : 'Experience not stated'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {candidateMatch.location || 'Location not specified'}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Resume Version: <span className="font-mono text-[11px] text-navy-900 dark:text-slate-200">{candidateMatch.winningResumeFilename || 'Verified Profile'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {candidateMatch.match_provenance ? `JD v${candidateMatch.match_provenance.jd_version_id} · Calculated ${new Date(candidateMatch.match_provenance.calculated_at).toLocaleString()}` : 'Current evaluation'}
              </span>
            </div>
          </div>

          {/* Match Score Gauge, Eligibility Tier & Separate Semantic Similarity Metric */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-surface-darkHover/60 p-4 rounded-2xl border border-slate-200/70 dark:border-surface-darkBorder">
            {/* Overall Match Score */}
            <div className="pr-4 border-r border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Composite Match Score
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-extrabold text-navy-900 dark:text-white font-mono">
                  {overallScore}%
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Raw Tier: <strong>{rawScoreTier}</strong>
              </span>
            </div>

            {/* Eligibility Adjusted Tier */}
            <div className="pr-4 border-r border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Eligibility Tier
              </span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getTierBadgeStyle(eligibilityTier)}`}>
                {eligibilityTier}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                {hasCriticalGap ? `${candidateMatch.mandatoryGapCount || 1} Mandatory Gap(s)` : 'All Mandatory Criteria Met'}
              </span>
            </div>

            {/* Semantic Similarity (Displayed Strictly Separately) */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Semantic Similarity
              </span>
              <div className="text-xl font-bold text-brand-700 dark:text-brand-400 font-mono mt-0.5">
                {typeof semanticSim === 'number' ? semanticSim.toFixed(4) : '0.0000'}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Retrieval Signal (Not Suitability %)
              </span>
            </div>
          </div>
        </div>

        {/* Mandatory Requirement Protection Warning if Critical Gap Exists */}
        {hasCriticalGap && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Mandatory Requirement Protection Policy Triggered</span>
              <p className="mt-0.5 opacity-90">
                {candidateMatch.criticalGapExplanation ||
                  'One or more mandatory JD skills lack verified evidence. Final eligibility tier is capped regardless of raw weighted score.'}
              </p>
            </div>
          </div>
        )}

        {/* SECTION H: RECRUITER ACTION TOOLBAR */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'shortlist',
                  title: 'Confirm Candidate Shortlist',
                  message: `Move ${candidateMatch.name} to the Shortlisted stage for "${job.title}"?`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Add to Shortlist</span>
            </button>

            <button
              onClick={() =>
                setConfirmAction({
                  type: 'pipeline',
                  targetStage: 'Technical Round 1',
                  title: 'Advance to Technical Pipeline',
                  message: `Advance ${candidateMatch.name} to "Technical Round 1" stage?`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 dark:bg-slate-700 hover:bg-navy-800 dark:hover:bg-slate-600 text-white text-xs font-semibold shadow-subtle transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Advance Pipeline</span>
            </button>

            <button
              onClick={() =>
                setConfirmAction({
                  type: 'approval',
                  title: 'Request Recruiter Lead Review',
                  message: `Submit an approval review request for ${candidateMatch.name} into the Human-in-the-Loop queue?`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Review</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onCompareCandidate && (
              <button
                onClick={() => onCompareCandidate(candidateMatch.candidate_id || candidateMatch.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-all"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Candidates</span>
              </button>
            )}

            {onOpenResume && (
              <button
                onClick={() => onOpenResume(candidateMatch)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Full Resume</span>
              </button>
            )}

            {onOpenCandidateProfile && (
              <button
                onClick={() => onOpenCandidateProfile(candidateMatch.candidate_id || candidateMatch.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Open Profile</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Two-Column Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT 2 COLUMNS: Score Breakdown, Why Candidate Matches, Matrix & Skills Coverage */}
        <div className="xl:col-span-2 space-y-6">
          {/* SECTION B: SCORE BREAKDOWN */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                  <span>Weighted Score Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configured deterministic component weights and individual scores
                </p>
              </div>
              <button
                onClick={() => setShowFormulaHelp(!showFormulaHelp)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showFormulaHelp ? 'Hide Formula' : 'How Score is Calculated'}</span>
              </button>
            </div>

            {/* Expandable Calculation Formula Explanation */}
            {showFormulaHelp && (
              <div className="mb-4 p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <p className="font-semibold text-navy-900 dark:text-white">Composite Scoring Methodology:</p>
                <p>
                  Composite score uses the configured weights for available components, renormalized to 100%; unavailable inputs are excluded.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Note: Semantic similarity contributes only when compatible embeddings exist; mandatory gaps independently cap the classification.
                </p>
              </div>
            )}

            <div className="space-y-3.5">
              {weightDefinitions.map((comp) => {
                const numericScore = comp.score == null ? null : Math.min(100, Math.max(0, Math.round(Number(comp.score) || 0)));
                return (
                  <div key={comp.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy-900 dark:text-white">{comp.label}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Weight: {comp.weight}%
                        </span>
                      </div>
                      <span className="font-bold font-mono text-navy-900 dark:text-white">{numericScore == null ? 'Unavailable' : `${numericScore}%`}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${comp.barColor}`}
                        style={{ width: `${numericScore ?? 0}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{comp.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION C: WHY THIS CANDIDATE MATCHES */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>Why This Candidate Matches (Evidence-Backed)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifiable quotes extracted directly from indexed resume documents
                </p>
              </div>
              <Badge variant="success" size="xs">
                {coverageBuckets.satisfied.length} Verified Matches
              </Badge>
            </div>

            {candidateMatch.explanations?.summary_narrative && (
              <div className="mb-4 p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/30 border border-brand-200/80 dark:border-brand-800/60 text-xs text-brand-950 dark:text-brand-100 leading-relaxed">
                <strong className="block mb-1">CompanyAI Executive Narrative:</strong>
                {candidateMatch.explanations.summary_narrative}
              </div>
            )}

            {coverageBuckets.satisfied.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                No direct requirement quotes matched verbatim. Review the Detailed Matrix below for semantic or unverified requirements.
              </div>
            ) : (
              <div className="space-y-3">
                {coverageBuckets.satisfied.map((req, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-navy-900 dark:text-white">
                          {req.original_text}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          {req.classification} • {req.category_label || req.category} • Confidence: {Math.round((req.confidence || 0.9) * 100)}%
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                        VERIFIED SATISFIED
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Source: {req.evidence_source || 'Indexed Resume Excerpt'}
                      </span>
                      <p className="italic leading-relaxed">
                        "{req.evidence && req.evidence !== 'Evidence unavailable.' ? req.evidence : 'Matched against indexed candidate competency tags.'}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION F & E: SKILLS COVERAGE FILTERS + DETAILED SCORE BREAKDOWN MATRIX */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                  Detailed Requirement Breakdown & Skills Coverage Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Note: UNVERIFIED indicates missing indexed text rather than confirmed lack of skill
                </p>
              </div>
            </div>

            {/* Section F: Skills Coverage Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: `All Requirements (${requirements.length})` },
                { id: 'matched', label: `Matched (${coverageBuckets.satisfied.length})` },
                { id: 'partial', label: `Partially Supported (${coverageBuckets.partial.length})` },
                { id: 'unverified', label: `Unverified (${coverageBuckets.unverified.length})` },
                { id: 'gap', label: `No Evidence / Gap (${coverageBuckets.gaps.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSkillFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    skillFilter === tab.id
                      ? 'bg-navy-900 dark:bg-brand-600 text-white border-navy-900 dark:border-brand-600'
                      : 'bg-slate-50 dark:bg-surface-darkHover text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Section E: Requirement-Level Table */}
            <div className="overflow-x-auto border border-slate-200/80 dark:border-surface-darkBorder rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-surface-darkHover border-b border-slate-200/80 dark:border-surface-darkBorder text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Job Requirement</th>
                    <th className="py-3 px-4">Candidate Evidence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                  {visibleRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No requirements match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    visibleRequirements.map((req, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-surface-darkHover/40 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <span className="font-semibold text-navy-900 dark:text-slate-200 block">
                            {req.category_label || req.category}
                          </span>
                          <span className="text-[10px] text-slate-400">{req.classification}</span>
                        </td>
                        <td className="py-3 px-4 align-top font-medium text-navy-900 dark:text-white max-w-xs">
                          {req.original_text}
                        </td>
                        <td className="py-3 px-4 align-top text-slate-600 dark:text-slate-300 max-w-sm">
                          {req.evidence && req.evidence !== 'Evidence unavailable.'
                            ? `"${req.evidence}"`
                            : req.notes || 'Not detected in indexed profile; verify during technical screening.'}
                        </td>
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'SATISFIED'
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                : req.status === 'GAP'
                                ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top text-[11px] text-slate-500 dark:text-slate-400">
                          {req.evidence_source || 'Profile Index'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Section D (JD Description Panel) + Section G (Similar Candidates) */}
        <div className="space-y-6">
          {/* SECTION D: JD DESCRIPTION & PROVENANCE PANEL */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                Target JD Specifications
              </h3>
              <div className="flex bg-slate-100 dark:bg-surface-darkHover p-0.5 rounded-lg text-[11px]">
                <button
                  onClick={() => setJdViewMode('segmented')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    jdViewMode === 'segmented'
                      ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  AI & Recruiter Skills
                </button>
                <button
                  onClick={() => setJdViewMode('original')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    jdViewMode === 'original'
                      ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Original JD
                </button>
              </div>
            </div>

            {/* Metadata pills derived strictly from backend Job fields */}
            <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 dark:bg-surface-darkHover/50 p-3 rounded-xl border border-slate-200/60 dark:border-surface-darkBorder">
              <div>
                <span className="text-[10px] text-slate-400 block">Location</span>
                <span className="font-semibold text-navy-900 dark:text-white">{job.location || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Experience Bounds</span>
                <span className="font-semibold text-navy-900 dark:text-white">{job.experienceRequired || 'Not specified'}</span>
              </div>
              {segmentationData && (
                <div className="col-span-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">JD Intelligence Status:</span>
                  <Badge variant="brand" size="xs">
                    v{segmentationData.version || 1} ({segmentationData.status || 'pending'})
                  </Badge>
                </div>
              )}
            </div>

            {jdViewMode === 'segmented' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Mandatory Skills (JD-Derived vs Recruiter-Added)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.requiredSkills || []).map((sk, idx) => {
                      const syncedMandatory = new Set(job.syncedMandatorySkills || job.synced_mandatory_skills || []);
                      const isJdDerived = syncedMandatory.size === 0 || syncedMandatory.has(sk);
                      return (
                        <Badge key={idx} variant={isJdDerived ? 'brand' : 'blue'} size="xs">
                          {sk}
                          {syncedMandatory.size > 0 && (
                            <span className="ml-1 opacity-75 text-[9px]">
                              ({isJdDerived ? 'JD' : 'Recruiter'})
                            </span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Preferred / Secondary Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(job.preferredSkills || job.syncedPreferredSkills || []).length > 0 ? (
                      (job.preferredSkills || job.syncedPreferredSkills).map((sk, idx) => (
                        <Badge key={idx} variant="neutral" size="xs">
                          {sk}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">None specified separately</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {job.description || 'Original job description text unavailable.'}
              </div>
            )}
          </div>

          {/* SECTION G: SIMILAR CANDIDATES FOR SAME JOB */}
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-5 shadow-card space-y-4">
            <div>
              <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                Similar Candidates for This Role
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                De-duplicated ranked candidates evaluated against the same JD
              </p>
            </div>

            {similarCandidates.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No other ranked candidates currently loaded for this role.
              </p>
            ) : (
              <div className="space-y-3">
                {similarCandidates.map((sim) => {
                  const simScore = sim.rawScore ?? sim.matchScore ?? 0;
                  const simTier = sim.eligibilityAdjustedTier || sim.classification || 'Candidate';
                  return (
                    <div
                      key={sim.candidate_id || sim.id}
                      className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder hover:border-brand-300 dark:hover:border-brand-700 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-navy-900 dark:text-white truncate">
                            {sim.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {sim.experienceYears || 0} yrs • {sim.location || 'India'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-extrabold font-mono text-brand-700 dark:text-brand-400">
                            {simScore}%
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {(sim.primarySkills || []).slice(0, 3).map((sk, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTierBadgeStyle(simTier)}`}>
                          {simTier}
                        </span>
                        <button
                          onClick={() => onSelectMatch && onSelectMatch(sim)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Record-Changing Recruiter Actions */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-navy-900 dark:text-white">{confirmAction.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{confirmAction.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-darkHover"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Processing...' : 'Confirm Action'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
