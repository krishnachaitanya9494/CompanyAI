// Import React and hooks for state management and interactive comparison.
import React, { useState, useEffect, useMemo } from 'react';

// Import jobApi for data retrieval.
import { jobApi } from '../../api/client';

// Import modular components from comparison folder.
import { ComparisonHeader } from './ComparisonHeader';
import { SingleComparisonOverview } from './SingleComparisonOverview';
import { DualComparisonColumns } from './DualComparisonColumns';
import { SkillsVennAnalysis } from './SkillsVennAnalysis';
import { RequirementsAlignmentTable } from './RequirementsAlignmentTable';
import { AIInterviewKit } from './AIInterviewKit';
import { MultiCandidateComparisonView } from './MultiCandidateComparisonView';

// Import lucide icons for status feedback.
import { RotateCcw, AlertTriangle } from 'lucide-react';

/**
 * Enterprise JD and Resume Intelligence Comparison Page.
 * Modularized into the comparison folder with dedicated subcomponents for
 * header controls, overview scorecards, dual-column specs, skills Venn,
 * requirements alignment, interview kit, and multi-candidate matrix.
 */
export const JDResumeComparisonPage = ({
  jobs = [],
  candidates = [],
  initialJobId = null,
  initialCandidateId = null,
  onSelectCandidate,
  onSelectJob,
  onUpdateCandidateStage,
}) => {
  // This page opens directly on pasted/uploaded comparison; other matching workflows remain elsewhere.
  const [comparisonMode, setComparisonMode] = useState('adhoc');

  // Selected Job and Candidate IDs
  const [selectedJobId, setSelectedJobId] = useState(
    initialJobId || (jobs.length > 0 ? jobs[0].id : null)
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    initialCandidateId || (candidates.length > 0 ? candidates[0].id : null)
  );

  // Multi-Candidate comparison selection (array of candidate IDs, max 5)
  const [selectedMultiCandidateIds, setSelectedMultiCandidateIds] = useState(
    initialCandidateId ? [initialCandidateId] : candidates.slice(0, 3).map((c) => c.id)
  );

  // Ad-hoc text comparison inputs
  const [adhocJdText, setAdhocJdText] = useState('');
  const [adhocResumeText, setAdhocResumeText] = useState('');

  // Comparison result data state
  const [comparisonData, setComparisonData] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [matchHistoryError, setMatchHistoryError] = useState('');
  const [multiComparisonData, setMultiComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // UI view toggles
  const [requirementFilter, setRequirementFilter] = useState('all'); // 'all' | 'satisfied' | 'mandatory_gap' | 'preferred_gap'
  const [candidateViewTab, setCandidateViewTab] = useState('structured'); // 'structured' | 'resume_text'
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Sync initial props if changed from parent navigation
  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId);
  }, [initialJobId]);

  useEffect(() => {
    if (initialCandidateId) setSelectedCandidateId(initialCandidateId);
  }, [initialCandidateId]);

  // Active Job object from props or data
  const currentJob = useMemo(() => {
    return jobs.find((j) => String(j.id) === String(selectedJobId)) || jobs[0] || null;
  }, [jobs, selectedJobId]);

  // Active Candidate object from props or data
  const currentCandidate = useMemo(() => {
    return candidates.find((c) => String(c.id) === String(selectedCandidateId)) || candidates[0] || null;
  }, [candidates, selectedCandidateId]);

  // Load 1-on-1 comparison whenever selected job or candidate changes
  useEffect(() => {
    if (comparisonMode !== 'single') return;
    if (!selectedJobId || !selectedCandidateId) return;

    let isSubscribed = true;
    setIsLoading(true);
    setErrorMessage('');

    jobApi
      .compareWithCandidate(selectedJobId, selectedCandidateId)
      .then((data) => {
        if (isSubscribed) {
          setComparisonData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setErrorMessage(err.message || 'Failed to generate JD and Resume comparison.');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedJobId, selectedCandidateId, comparisonMode]);

  // Load append-only history only for persisted candidate comparisons; pasted text has no stored identity.
  useEffect(() => {
    const comparison = comparisonData?.comparison;
    if (comparisonMode !== 'single' || comparison?.comparison_mode !== 'persisted_candidate'
        || String(comparisonData?.job?.id) !== String(selectedJobId)
        || String(comparisonData?.candidate?.id) !== String(selectedCandidateId)) {
      setMatchHistory([]);
      setMatchHistoryError('');
      return undefined;
    }
    let isSubscribed = true;
    setMatchHistory([]);
    setMatchHistoryError('');
    jobApi.getMatchHistory(selectedJobId, selectedCandidateId)
      .then((data) => { if (isSubscribed) setMatchHistory(data.results || []); })
      .catch((error) => { if (isSubscribed) setMatchHistoryError(error.message || 'Match history unavailable.'); });
    return () => { isSubscribed = false; };
  }, [comparisonData, comparisonMode, selectedJobId, selectedCandidateId]);

  // Load Multi-Candidate comparison when in 'multi' mode
  useEffect(() => {
    if (comparisonMode !== 'multi') return;
    if (!selectedJobId || selectedMultiCandidateIds.length < 2) return;

    let isSubscribed = true;
    setIsLoading(true);
    setErrorMessage('');

    jobApi
      .compareCandidates(selectedJobId, selectedMultiCandidateIds)
      .then((data) => {
        if (isSubscribed) {
          setMultiComparisonData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setErrorMessage(err.message || 'Failed to compare multiple candidates.');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedJobId, selectedMultiCandidateIds, comparisonMode]);

  // Handler for Ad-hoc comparison execution
  const handleRunAdhocComparison = () => {
    if (!adhocJdText.trim() || !adhocResumeText.trim()) {
      setErrorMessage('Please provide both Job Description and Resume text.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');

    jobApi
      .compareAdhoc({
        jd_text: adhocJdText,
        resume_text: adhocResumeText,
      })
      .then((data) => {
        setComparisonData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to execute custom comparison.');
        setIsLoading(false);
      });
  };

  // Reuse the existing non-persisting document extractor for either uploaded source.
  const handleUploadText = async (source, file) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const text = await jobApi.extractDocumentText(file);
      if (source === 'jd') setAdhocJdText(text);
      else setAdhocResumeText(text);
    } catch (error) {
      setErrorMessage(error.message || 'Could not extract text from this file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Pick Top Candidate for selected job
  const handleQuickPickTopMatch = async () => {
    if (!selectedJobId) return;
    setIsLoading(true);
    try {
      const matchRes = await jobApi.getMatches(selectedJobId, { limit: 1 });
      const topMatch = Array.isArray(matchRes) ? matchRes[0] : matchRes.matches?.[0] || null;
      if (topMatch) {
        const topId = topMatch.candidate_id || topMatch.id;
        setSelectedCandidateId(topId);
      } else {
        setErrorMessage('No ranked matches found for this job position.');
      }
    } catch (err) {
      setErrorMessage('Could not determine top match for this position.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter requirements alignment rows based on active filter tab
  const filteredRequirements = useMemo(() => {
    if (!comparisonData?.comparison?.requirements_alignment) return [];
    const all = comparisonData.comparison.requirements_alignment;
    const evidenceStatus = (r) => r.evidence_status || (r.verification_status === 'UNVERIFIED' || r.status === 'UNVERIFIED' ? 'UNVERIFIED' : r.status === 'SATISFIED' ? 'DIRECT_MATCH' : r.status === 'PARTIAL' ? 'PARTIAL_MATCH' : 'MISSING');

    if (requirementFilter === 'satisfied') {
      return all.filter((r) => ['DIRECT_MATCH', 'EQUIVALENT_MATCH'].includes(evidenceStatus(r)));
    }
    if (requirementFilter === 'partial') {
      return all.filter((r) => evidenceStatus(r) === 'PARTIAL_MATCH');
    }
    if (requirementFilter === 'mandatory_gap') {
      return all.filter((r) => r.classification === 'Mandatory' && evidenceStatus(r) === 'MISSING');
    }
    if (requirementFilter === 'preferred_gap') {
      return all.filter((r) => r.classification === 'Preferred' && evidenceStatus(r) === 'MISSING');
    }
    if (requirementFilter === 'unverified') {
      return all.filter((r) => evidenceStatus(r) === 'UNVERIFIED');
    }
    if (requirementFilter === 'responsibility') {
      return all.filter((r) => r.classification === 'Responsibility');
    }
    return all;
  }, [comparisonData, requirementFilter]);

  // Copy structured comparison brief
  const handleCopySummary = () => {
    if (!comparisonData) return;
    const { job, candidate, comparison } = comparisonData;
    const text = [
      `=== COMPANYAI JD & RESUME COMPARISON REPORT ===`,
      `Position: ${job.title} (${job.job_code}) - ${job.department}`,
      `Candidate: ${candidate.name} | Role: ${candidate.current_role} | Exp: ${candidate.experience_years} yrs`,
      `------------------------------------------------`,
      comparison.comparison_mode === 'pasted_text'
        ? `Text JD Match: ${comparison.match_score == null ? 'Insufficient Evidence' : `${comparison.match_score}%`} (${comparison.classification})`
        : `Overall Match Score: ${comparison.match_score == null ? 'Insufficient Evidence' : `${comparison.match_score}%`} (${comparison.classification})`,
      `Eligibility Tier: ${comparison.eligibility_adjusted_tier}`,
      `Semantic Relevance: ${comparison.semantic_similarity == null ? 'Unavailable (not used)' : `${Math.round(comparison.semantic_similarity * 100)}%`}`,
      `Critical Gap Status: ${comparison.has_critical_gap ? comparison.critical_gap_explanation : 'All mandatory criteria satisfied'}`,
      `\n[EXPERIENCE FIT]`,
      `${comparison.experience_fit.note}`,
      `\n[CORE SKILLS MATCHED]`,
      `${comparison.skills_analysis.matched_mandatory.join(', ') || 'None'}`,
      `\n[CRITICAL MANDATORY GAPS]`,
      `${comparison.skills_analysis.missing_mandatory.join(', ') || 'None - 100% Mandatory Coverage'}`,
      `\n[ADJACENT / BONUS TALENT]`,
      `${comparison.skills_analysis.adjacent_skills.join(', ') || 'None'}`,
      `\n[MATCH SUMMARY]`,
      `${comparison.recruiter_verdict}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Score styling helper
  const getScoreTheme = (score) => {
    if (score == null) {
      return {
        text: 'text-slate-700 dark:text-slate-300',
        bg: 'bg-slate-50 dark:bg-slate-900/40',
        border: 'border-slate-300 dark:border-slate-700',
        bar: 'bg-slate-500',
        badge: 'neutral',
      };
    }
    if (score >= 80) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-300 dark:border-emerald-800',
        bar: 'bg-emerald-600',
        badge: 'brand',
      };
    }
    if (score >= 60) {
      return {
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-300 dark:border-blue-800',
        bar: 'bg-blue-600',
        badge: 'info',
      };
    }
    if (score >= 40) {
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-300 dark:border-amber-800',
        bar: 'bg-amber-500',
        badge: 'warning',
      };
    }
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-300 dark:border-rose-800',
      bar: 'bg-rose-600',
      badge: 'danger',
    };
  };

  const compResult = comparisonData?.comparison;
  const compJob = comparisonData?.job || currentJob;
  const compCand = comparisonData?.candidate || currentCandidate;
  const scoreTheme = getScoreTheme(compResult?.match_score);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto w-full space-y-5 animate-fadeIn">
      {/* Keep this screen limited to the requested paste and upload workflow. */}
      <ComparisonHeader
        adhocJdText={adhocJdText}
        setAdhocJdText={setAdhocJdText}
        adhocResumeText={adhocResumeText}
        setAdhocResumeText={setAdhocResumeText}
        handleRunAdhocComparison={handleRunAdhocComparison}
        isLoading={isLoading}
        onUploadText={handleUploadText}
      />

      {/* Loading State Skeleton */}
      {isLoading && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-3 animate-spin">
            <RotateCcw className="w-6 h-6" />
          </div>
        <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
            Comparing job requirements and resume evidence…
          </h4>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && !isLoading && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-600 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================================
          MODE 1 & 3: SINGLE 1-ON-1 DEEP COMPARISON WORKSPACE
         ========================================================================= */}
      {comparisonMode !== 'multi' && comparisonData && !isLoading && (
        <div className="space-y-4 animate-fadeIn">
          {/* Executive Verdict & Scorecard Card */}
          <SingleComparisonOverview
            compResult={compResult}
            compJob={compJob}
            compCand={compCand}
            scoreTheme={scoreTheme}
            copiedSummary={copiedSummary}
            handleCopySummary={handleCopySummary}
            onSelectCandidate={onSelectCandidate}
            matchHistory={matchHistory}
            matchHistoryError={matchHistoryError}
          />

          <DualComparisonColumns
            compJob={compJob}
            compCand={compCand}
            candidateViewTab={candidateViewTab}
            setCandidateViewTab={setCandidateViewTab}
          />

          {/* Keep the evidence table directly below the job and candidate context. */}
          <RequirementsAlignmentTable
            filteredRequirements={filteredRequirements}
            requirementFilter={requirementFilter}
            setRequirementFilter={setRequirementFilter}
          />

          {/* Skills Venn Matrix */}
          <SkillsVennAnalysis compResult={compResult} />

          {/* AI Interview Kit */}
          <AIInterviewKit compResult={compResult} />
        </div>
      )}

      {/* =========================================================================
          MODE 2: MULTI-CANDIDATE COMPARISON MATRIX VIEW
         ========================================================================= */}
      {comparisonMode === 'multi' && multiComparisonData && !isLoading && (
        <MultiCandidateComparisonView
          multiComparisonData={multiComparisonData}
          getScoreTheme={getScoreTheme}
          setSelectedCandidateId={setSelectedCandidateId}
          setComparisonMode={setComparisonMode}
        />
      )}
    </div>
  );
};

export default JDResumeComparisonPage;
