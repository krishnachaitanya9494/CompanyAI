// Import React and hooks for state management and interactive comparison.
import React, { useState, useEffect, useMemo, useRef } from 'react';

// Import Badge and CustomSelect common components.
import { Badge } from '../components/common/Badge';
import { CustomSelect } from '../components/common/CustomSelect';

// Import jobApi and candidateApi for data retrieval.
import { jobApi, candidateApi } from '../api/client';

// Import Lucide icons for enterprise visual clarity.
import {
  GitCompare,
  Briefcase,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  Award,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  Calendar,
  MapPin,
  Clock,
  Target,
  ShieldAlert,
  HelpCircle,
  Zap,
  BookOpen,
  ArrowLeftRight,
  Scale,
  Users,
  Eye,
  Plus,
  X,
} from 'lucide-react';

/**
 * Enterprise JD and Resume Intelligence Comparison Page.
 * Provides deep side-by-side semantic alignment, requirement verification,
 * gap analysis, skills overlap, and AI-tailored interview kits.
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
  // Active Comparison Mode: 'single' (1-on-1) | 'multi' (2-5 Candidates) | 'adhoc' (Pasted Text)
  const [comparisonMode, setComparisonMode] = useState('single');

  // Selected Job and Candidate IDs
  const [selectedJobId, setSelectedJobId] = useState(
    initialJobId || (jobs.length > 0 ? jobs[0].id : null)
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    initialCandidateId || (candidates.length > 0 ? candidates[0].id : null)
  );

  // Multi-Candidate comparison selection (array of candidate IDs, max 5)
  const [selectedMultiCandidateIds, setSelectedMultiCandidateIds] = useState(
    initialCandidateId ? [initialCandidateId] : (candidates.slice(0, 3).map((c) => c.id))
  );

  // Ad-hoc text comparison inputs
  const [adhocJdText, setAdhocJdText] = useState('');
  const [adhocResumeText, setAdhocResumeText] = useState('');
  const [adhocJobTitle, setAdhocJobTitle] = useState('Senior Technical Lead');
  const [adhocCandidateName, setAdhocCandidateName] = useState('Candidate Profile');

  // Comparison result data state
  const [comparisonData, setComparisonData] = useState(null);
  const [multiComparisonData, setMultiComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // UI view toggles
  const [requirementFilter, setRequirementFilter] = useState('all'); // 'all' | 'satisfied' | 'mandatory_gap' | 'preferred_gap'
  const [candidateViewTab, setCandidateViewTab] = useState('structured'); // 'structured' | 'resume_text'
  const [resumeSearchTerm, setResumeSearchTerm] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savedNotes, setSavedNotes] = useState(false);

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
        role_title: adhocJobTitle,
        candidate_name: adhocCandidateName,
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

  // Quick Pick Top Candidate for selected job
  const handleQuickPickTopMatch = async () => {
    if (!selectedJobId) return;
    setIsLoading(true);
    try {
      const matchRes = await jobApi.getMatches(selectedJobId, { limit: 1 });
      const topMatch = Array.isArray(matchRes) ? matchRes[0] : (matchRes.matches?.[0] || null);
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

    if (requirementFilter === 'satisfied') {
      return all.filter((r) => r.status === 'SATISFIED');
    }
    if (requirementFilter === 'mandatory_gap') {
      return all.filter((r) => r.classification === 'Mandatory' && r.status !== 'SATISFIED');
    }
    if (requirementFilter === 'preferred_gap') {
      return all.filter((r) => r.classification === 'Preferred' && r.status !== 'SATISFIED');
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
      `Overall Match Score: ${comparison.match_score}% (${comparison.classification})`,
      `Eligibility Tier: ${comparison.eligibility_adjusted_tier}`,
      `Semantic Relevance: ${Math.round(comparison.semantic_similarity * 100)}%`,
      `Critical Gap Status: ${comparison.has_critical_gap ? comparison.critical_gap_explanation : 'All mandatory criteria satisfied'}`,
      `\n[EXPERIENCE FIT]`,
      `${comparison.experience_fit.note}`,
      `\n[CORE SKILLS MATCHED]`,
      `${comparison.skills_analysis.matched_mandatory.join(', ') || 'None'}`,
      `\n[CRITICAL MANDATORY GAPS]`,
      `${comparison.skills_analysis.missing_mandatory.join(', ') || 'None - 100% Mandatory Coverage'}`,
      `\n[ADJACENT / BONUS TALENT]`,
      `${comparison.skills_analysis.adjacent_skills.join(', ') || 'None'}`,
      `\n[AI VERDICT]`,
      `${comparison.recruiter_verdict}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Score styling helper
  const getScoreTheme = (score) => {
    if (score >= 85) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-300 dark:border-emerald-800',
        bar: 'bg-emerald-600',
        badge: 'brand',
      };
    }
    if (score >= 70) {
      return {
        text: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-300 dark:border-blue-800',
        bar: 'bg-blue-600',
        badge: 'info',
      };
    }
    if (score >= 50) {
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
  const scoreTheme = getScoreTheme(compResult?.match_score || 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto w-full space-y-5 animate-fadeIn">
      {/* Top Header & Mode Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1 border-b border-slate-200 dark:border-surface-darkBorder">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 shadow-xs">
              <GitCompare className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                JD &amp; Resume Intelligence Comparison
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                  Dual AI Verification
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Side-by-side semantic alignment, requirement verification, gap analysis, and tailored interview kit.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setComparisonMode('single')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              comparisonMode === 'single'
                ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>1-on-1 Deep Compare</span>
          </button>

          <button
            type="button"
            onClick={() => setComparisonMode('multi')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              comparisonMode === 'multi'
                ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multi-Candidate ({selectedMultiCandidateIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setComparisonMode('adhoc')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              comparisonMode === 'adhoc'
                ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste / Upload Text</span>
          </button>
        </div>
      </div>

      {/* Primary Selector Control Toolbar (Single & Multi Modes) */}
      {comparisonMode !== 'adhoc' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            {/* Job Requisition Selector (5 cols) */}
            <div className="lg:col-span-5 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                Select Target Job Requisition
              </label>
              <CustomSelect
                value={selectedJobId}
                onChange={(val) => setSelectedJobId(Number(val))}
                options={jobs.map((j) => ({
                  value: j.id,
                  label: `${j.title} (${j.job_code || `REQ-${j.id}`})`,
                  badge: `${j.experience_level || `${j.min_experience_years || 3}+ yrs`}`,
                }))}
                icon={Briefcase}
                size="md"
                placeholder="Choose a Job Requisition..."
                ariaLabel="Select Job Requisition for comparison"
              />
            </div>

            {/* Comparison Divider / Switcher Icon (2 cols) */}
            <div className="lg:col-span-2 flex items-center justify-center pt-2 lg:pt-5">
              <span className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-surface-darkBorder">
                <ArrowLeftRight className="w-4 h-4" />
              </span>
            </div>

            {/* Candidate / Resume Selector (5 cols) */}
            <div className="lg:col-span-5 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Select Candidate Resume
                </label>
                {comparisonMode === 'single' && (
                  <button
                    type="button"
                    onClick={handleQuickPickTopMatch}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    title="Automatically select #1 ranked candidate for this job"
                  >
                    <Zap className="w-3 h-3 text-amber-500" />
                    Quick Pick Top Match
                  </button>
                )}
              </div>

              {comparisonMode === 'single' ? (
                <CustomSelect
                  value={selectedCandidateId}
                  onChange={(val) => setSelectedCandidateId(Number(val))}
                  options={candidates.map((c) => ({
                    value: c.id,
                    label: `${c.name} — ${c.current_role || c.title || 'Candidate'}`,
                    badge: `${c.experience_years || 0} yrs`,
                  }))}
                  icon={User}
                  size="md"
                  placeholder="Choose Candidate Resume..."
                  ariaLabel="Select Candidate Resume for comparison"
                />
              ) : (
                /* Multi Candidate Checkbox Pills */
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-surface-darkBorder max-h-28 overflow-y-auto space-y-1.5">
                  <div className="text-[11px] text-slate-500 mb-1">
                    Select 2 to 5 candidates for side-by-side comparison:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.slice(0, 15).map((cand) => {
                      const isChecked = selectedMultiCandidateIds.includes(cand.id);
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              if (selectedMultiCandidateIds.length > 2) {
                                setSelectedMultiCandidateIds((prev) => prev.filter((id) => id !== cand.id));
                              }
                            } else {
                              if (selectedMultiCandidateIds.length < 5) {
                                setSelectedMultiCandidateIds((prev) => [...prev, cand.id]);
                              }
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                          <span>{cand.name}</span>
                          <span className="text-[10px] opacity-75 font-mono">({cand.experience_years}y)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ad-Hoc Text Input Drawer */}
      {comparisonMode === 'adhoc' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                On-the-Fly Job Description &amp; Resume Text Comparison
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdhocJdText(
                  'ServiceNow FSO Software Engineer – Complaint Management\nExperience: 5+ years\nLocation: Bengaluru or Hyderabad\nMandatory Skills: ServiceNow, Financial Services Operations (FSO), Complaint Management, Flow Designer, Integration Hub, JavaScript.\nPreferred Skills: ITIL Certification, Banking Domain Knowledge, Microservices architecture.'
                );
                setAdhocResumeText(
                  'Experienced Senior Software Engineer with 6.5 years in enterprise digital workflows. Proven background delivering ServiceNow solutions including Incident, Complaint Workflows, Flow Designer, and Integration Hub. Proficient in JavaScript, REST APIs, and core banking complaints handling. Led multiple offshore client deliveries across APAC and North America.'
                );
                setAdhocJobTitle('ServiceNow FSO Software Engineer');
                setAdhocCandidateName('Priya Sharma');
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" />
              Load Sample Text
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Custom JD Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Job Description Text *
                </label>
                <input
                  type="text"
                  value={adhocJobTitle}
                  onChange={(e) => setAdhocJobTitle(e.target.value)}
                  placeholder="Role Title (e.g. Senior Java Dev)"
                  className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-darkBg text-navy-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={8}
                value={adhocJdText}
                onChange={(e) => setAdhocJdText(e.target.value)}
                placeholder="Paste Job Description, specifications, mandatory requirements, and preferred qualifications..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-slate-50 dark:bg-surface-darkBg text-xs text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Right: Custom Resume Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Candidate Resume Text *
                </label>
                <input
                  type="text"
                  value={adhocCandidateName}
                  onChange={(e) => setAdhocCandidateName(e.target.value)}
                  placeholder="Candidate Name"
                  className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-darkBg text-navy-900 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={8}
                value={adhocResumeText}
                onChange={(e) => setAdhocResumeText(e.target.value)}
                placeholder="Paste candidate resume text, project history, core competencies, and profile background..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-slate-50 dark:bg-surface-darkBg text-xs text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={handleRunAdhocComparison}
              disabled={isLoading || !adhocJdText.trim() || !adhocResumeText.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Run Deep AI Comparison</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State Skeleton */}
      {isLoading && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-3 animate-spin">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
            Evaluating Semantic Alignment &amp; Requirement Provenance...
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Grounded against 2048-dimensional Nemotron vector coordinates, mandatory requirement verification, and verbatim resume citations.
          </p>
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
        <div className="space-y-5 animate-fadeIn">
          {/* Executive Verdict & Scorecard Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 pb-4 border-b border-slate-100 dark:border-surface-darkBorder">
              {/* Scorecard Hero */}
              <div className="flex items-center gap-4">
                {/* Large Radial Score Box */}
                <div
                  className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border shadow-xs ${scoreTheme.bg} ${scoreTheme.border}`}
                >
                  <span className={`text-2xl font-black ${scoreTheme.text}`}>
                    {compResult?.match_score}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Match
                  </span>
                </div>

                {/* Score Details & Tiers */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-navy-950 dark:text-slate-100">
                      {compResult?.classification || 'Evaluated Fit'}
                    </h3>
                    <Badge variant={scoreTheme.badge} size="sm">
                      {compResult?.eligibility_adjusted_tier}
                    </Badge>
                    {compResult?.has_critical_gap ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <ShieldAlert className="w-3 h-3" />
                        Critical Gaps
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Mandatory Protected
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    {compResult?.recruiter_verdict}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs transition-colors"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Brief</span>
                    </>
                  )}
                </button>

                {onSelectCandidate && compCand?.id > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectCandidate(compCand.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Profile</span>
                  </button>
                )}
              </div>
            </div>

            {/* Component Breakdown Mini Meters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Mandatory Stack Coverage */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Mandatory Stack Fit
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-navy-950 dark:text-slate-100">
                    {compResult?.skills_analysis?.mandatory_coverage_pct ?? 0}%
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {compResult?.skills_analysis?.matched_mandatory?.length || 0} /{' '}
                    {(compResult?.skills_analysis?.matched_mandatory?.length || 0) +
                      (compResult?.skills_analysis?.missing_mandatory?.length || 0)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${compResult?.skills_analysis?.mandatory_coverage_pct ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Semantic Vector Cosine Relevance */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Semantic Cosine Fit
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-navy-950 dark:text-slate-100">
                    {Math.round((compResult?.semantic_similarity || 0) * 100)}%
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    Nemotron
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.round((compResult?.semantic_similarity || 0) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Experience Tenured Fit */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Experience Alignment
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-navy-950 dark:text-slate-100">
                    {compResult?.experience_fit?.candidate_years} yrs
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Req: {compResult?.experience_fit?.required_min}–{compResult?.experience_fit?.required_max}y
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      compResult?.experience_fit?.status === 'Qualified' ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.round(((compResult?.experience_fit?.candidate_years || 0) / Math.max(1, compResult?.experience_fit?.required_min || 1)) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Location Compatibility */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-surface-darkBorder">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Location Compatibility
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-navy-950 dark:text-slate-100 truncate">
                    {compResult?.location_fit?.candidate_location || 'Unspecified'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      compResult?.location_fit?.is_match
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {compResult?.location_fit?.is_match ? 'Compatible' : 'Relocation'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-2">
                  Job: {compResult?.location_fit?.job_location || 'Anywhere'}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DUAL SIDE-BY-SIDE SPLIT COMPARISON COLUMNS
             ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT COLUMN: Target Job Description Specification */}
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs flex flex-col justify-between space-y-4">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                        {compJob?.title}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-500">
                        {compJob?.job_code || `REQ-${compJob?.id}`} • {compJob?.department}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {compJob?.location}
                  </span>
                </div>

                {/* Role Narrative Scope */}
                <div className="mt-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Position Architecture &amp; Overview
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-surface-darkBorder">
                    {compJob?.role_summary || compJob?.job_overview || 'Comprehensive engineering requisition.'}
                  </p>
                </div>

                {/* Mandatory Technical Stack */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block flex items-center justify-between">
                    <span>Mandatory Technical Requirements</span>
                    <span className="text-rose-600 font-semibold">{compJob?.required_skills?.length || 0} Required</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(compJob?.required_skills || []).map((sk, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      >
                        <Target className="w-3 h-3 text-rose-500" />
                        <span>{sk}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Preferred Qualifications */}
                {compJob?.preferred_skills?.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Preferred Qualifications &amp; Differentiators
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {compJob.preferred_skills.map((sk, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        >
                          <Award className="w-3 h-3 text-emerald-500" />
                          <span>{sk}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Metadata Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Specifications: {compJob?.requirements_count || 15} Domains</span>
                <span>Experience: {compJob?.min_experience_years}–{compJob?.max_experience_years || 99} yrs</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Candidate Resume & Extracted Facts */}
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs flex flex-col justify-between space-y-4">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                      <User className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                        {compCand?.name}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {compCand?.current_role} • {compCand?.experience_years} Years Experience
                      </span>
                    </div>
                  </div>

                  {/* Structured vs Raw Resume Text Toggle */}
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder">
                    <button
                      type="button"
                      onClick={() => setCandidateViewTab('structured')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                        candidateViewTab === 'structured'
                          ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidateViewTab('resume_text')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                        candidateViewTab === 'resume_text'
                          ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Raw Resume
                    </button>
                  </div>
                </div>

                {/* Candidate Content Tab 1: Structured Profile */}
                {candidateViewTab === 'structured' && (
                  <div className="mt-3 space-y-3">
                    {/* Summary */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Professional Summary
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-surface-darkBorder">
                        {compCand?.summary || 'Candidate summary indexed from verified document.'}
                      </p>
                    </div>

                    {/* Discovered Candidate Skills */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Discovered Candidate Skills ({compCand?.skills?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {(compCand?.skills || []).map((sk, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Content Tab 2: Raw Document Text */}
                {candidateViewTab === 'resume_text' && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-500">
                        {compCand?.winning_resume_filename || 'source_document.txt'}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        Verbatim Disk Provenance
                      </span>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap select-text custom-scrollbar">
                      {compCand?.resume_text_excerpt || compCand?.summary || 'No raw document text available.'}
                    </pre>
                  </div>
                )}
              </div>

              {/* Candidate Metadata Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder flex items-center justify-between text-[11px] text-slate-500">
                <span>Location: {compCand?.location}</span>
                <span>Availability: {compCand?.availability}</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SKILLS VENN ANALYSIS: MATCHED, GAPS & ADJACENT TALENT
             ========================================================================= */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  Skills Alignment, Gaps &amp; Transferable Competencies
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Comparative Skill Matrix
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: Matched Mandatory Skills */}
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Matched Core Skills
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {compResult?.skills_analysis?.matched_mandatory?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {compResult?.skills_analysis?.matched_mandatory?.length > 0 ? (
                    compResult.skills_analysis.matched_mandatory.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700"
                      >
                        ✓ {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No direct mandatory skill overlap detected.</span>
                  )}
                </div>
              </div>

              {/* Box 2: Missing Skills & Gaps */}
              <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Missing Skills &amp; Gaps
                  </span>
                  <span className="text-xs font-bold text-rose-700 font-mono">
                    {compResult?.skills_analysis?.missing_mandatory?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {compResult?.skills_analysis?.missing_mandatory?.length > 0 ? (
                    compResult.skills_analysis.missing_mandatory.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700"
                      >
                        ✕ {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      ✓ No mandatory skill gaps identified!
                    </span>
                  )}
                </div>
              </div>

              {/* Box 3: Candidate Adjacent / Transferable Bonus Skills */}
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Transferable Adjacent Skills
                  </span>
                  <span className="text-xs font-bold text-indigo-700 font-mono">
                    {compResult?.skills_analysis?.adjacent_skills?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {compResult?.skills_analysis?.adjacent_skills?.length > 0 ? (
                    compResult.skills_analysis.adjacent_skills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700"
                      >
                        + {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No non-requisition adjacent skills.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DETAILED REQUIREMENTS ALIGNMENT & EVIDENCE AUDIT TABLE
             ========================================================================= */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
              <div>
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Requirement-by-Requirement Grounded Alignment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Every JD specification audited against the candidate's verified resume document citations.
                </p>
              </div>

              {/* Requirement Filter Tabs */}
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder">
                <button
                  type="button"
                  onClick={() => setRequirementFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    requirementFilter === 'all'
                      ? 'bg-white dark:bg-surface-darkBg text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({compResult?.requirements_alignment?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRequirementFilter('satisfied')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    requirementFilter === 'satisfied'
                      ? 'bg-white dark:bg-surface-darkBg text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Satisfied
                </button>
                <button
                  type="button"
                  onClick={() => setRequirementFilter('mandatory_gap')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    requirementFilter === 'mandatory_gap'
                      ? 'bg-white dark:bg-surface-darkBg text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Mandatory Gaps
                </button>
                <button
                  type="button"
                  onClick={() => setRequirementFilter('preferred_gap')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    requirementFilter === 'preferred_gap'
                      ? 'bg-white dark:bg-surface-darkBg text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Preferred Gaps
                </button>
              </div>
            </div>

            {/* Alignment Cards List */}
            <div className="space-y-2.5">
              {filteredRequirements.map((req, idx) => {
                const isSatisfied = req.status === 'SATISFIED';
                const isMandatory = req.classification === 'Mandatory';

                return (
                  <div
                    key={req.requirement_id || idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSatisfied
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-800/60'
                        : isMandatory
                        ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200/80 dark:border-rose-800/60'
                        : 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/80 dark:border-amber-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              isMandatory
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-200'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200'
                            }`}
                          >
                            {req.classification}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {req.category_label || req.category}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-navy-950 dark:text-slate-100">
                          {req.original_text}
                        </p>

                        {/* Verbatim Grounded Resume Evidence */}
                        <div className="mt-2 text-xs">
                          {isSatisfied ? (
                            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 leading-relaxed font-sans">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                                Verbatim Resume Citation ({req.evidence_source}):
                              </span>
                              &ldquo;{req.evidence}&rdquo;
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[11px] italic">
                              No explicit verifiable evidence found in candidate document.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className="shrink-0">
                        {isSatisfied ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            SATISFIED
                          </span>
                        ) : isMandatory ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <XCircle className="w-3.5 h-3.5" />
                            MANDATORY GAP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            PREFERRED GAP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              AI TECHNICAL INTERVIEW SCREENING KIT TAILORED TO GAPS
             ========================================================================= */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  AI Technical Interview Screening Kit (Tailored to Candidate Gaps)
                </h3>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                Auto-Generated for Recruiter Round
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Candidate Strengths */}
              <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Key Candidate Strengths
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {(compResult?.strengths || []).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Right: Risks & Gaps to Probe */}
              <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Risks &amp; Areas to Probe in Interview
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-4">
                  {(compResult?.risks_and_gaps || []).map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Targeted Interview Questions */}
            <div className="mt-4 space-y-2.5">
              <span className="text-xs font-bold text-navy-950 dark:text-slate-100 block">
                Targeted Screening Questions Formulation:
              </span>
              {(compResult?.interview_kit || []).map((qItem, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-surface-darkBorder space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      Focus Area: {qItem.focus_skill}
                    </span>
                    <span className="px-2 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                      {qItem.type}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-navy-950 dark:text-slate-100">
                    &ldquo;{qItem.question}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">What to evaluate: </span>
                    {qItem.what_to_look_for}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 2: MULTI-CANDIDATE COMPARISON MATRIX VIEW
         ========================================================================= */}
      {comparisonMode === 'multi' && multiComparisonData && !isLoading && (
        <div className="space-y-5 animate-fadeIn">
          {/* Multi Compare Header Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder">
              <div>
                <h3 className="text-base font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  Multi-Candidate Side-by-Side Comparison Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Evaluating {multiComparisonData?.candidates?.length} candidates against {multiComparisonData?.job_title}
                </p>
              </div>

              {/* Recommended Pick Badge */}
              {multiComparisonData?.recommendation && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                    ⭐ AI Shortlist Recommendation:
                  </span>
                  <span className="text-emerald-900 dark:text-emerald-200 font-semibold">
                    {multiComparisonData.recommendation.recommendation_rationale}
                  </span>
                </div>
              )}
            </div>

            {/* Candidate Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
              {multiComparisonData.candidates.map((cand) => {
                const cTheme = getScoreTheme(cand.match_score);
                const isWinner =
                  multiComparisonData.recommendation?.recommended_candidate_id === cand.candidate_id;

                return (
                  <div
                    key={cand.candidate_id}
                    className={`relative p-4 rounded-xl border transition-all ${
                      isWinner
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-white dark:bg-surface-darkBg border-slate-200 dark:border-surface-darkBorder'
                    }`}
                  >
                    {isWinner && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                        Top Recommendation
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl font-black ${cTheme.text}`}>
                        {cand.match_score}%
                      </span>
                      <Badge variant={cTheme.badge} size="xs">
                        {cand.eligibility_adjusted_tier}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                      {cand.name}
                    </h4>
                    <span className="text-xs text-slate-500 block truncate">
                      {cand.current_role}
                    </span>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-surface-darkBorder text-[11px] text-slate-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Experience:</span>
                        <span className="font-semibold">{cand.experience_years} yrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mandatory Gaps:</span>
                        <span
                          className={`font-semibold ${
                            cand.mandatory_gap_count > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {cand.mandatory_gap_count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Location:</span>
                        <span className="font-semibold truncate">{cand.location || 'Anywhere'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCandidateId(cand.candidate_id);
                        setComparisonMode('single');
                      }}
                      className="w-full mt-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-xs font-semibold transition-colors"
                    >
                      Deep 1-on-1 Compare →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Matrix Table: Requirements vs Multiple Candidates */}
          <div className="p-5 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder shadow-xs space-y-3 overflow-hidden">
            <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100">
              Requirements Evaluation Matrix Across Candidates
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-surface-darkBorder bg-slate-50 dark:bg-slate-900/50">
                    <th className="p-3 font-bold text-slate-700 dark:text-slate-300 w-1/3">
                      Job Requirement Specification
                    </th>
                    {multiComparisonData.candidates.map((cand) => (
                      <th
                        key={cand.candidate_id}
                        className="p-3 font-bold text-slate-700 dark:text-slate-300 text-center"
                      >
                        {cand.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                  {multiComparisonData.matrix_rows.map((row) => (
                    <tr key={row.requirement_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              row.classification === 'Mandatory'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                            }`}
                          >
                            {row.classification}
                          </span>
                          <span className="text-[10px] text-slate-400">{row.category_label}</span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.original_text}
                        </span>
                      </td>
                      {multiComparisonData.candidates.map((cand) => {
                        const evalData = row.evaluations[cand.candidate_id];
                        const isOk = evalData?.status === 'SATISFIED';
                        return (
                          <td key={cand.candidate_id} className="p-3 text-center">
                            {isOk ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                title={evalData?.evidence}
                              >
                                ✓ Satisfied
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                ✕ Gap
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
        </div>
      )}
    </div>
  );
};
