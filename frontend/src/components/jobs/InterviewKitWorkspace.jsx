import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  CheckCircle2,
  X,
  Plus,
  RefreshCw,
  FileDown,
  FileText,
  SlidersHorizontal,
  Eye,
  EyeOff,
  User,
  Award,
  Layers,
  Edit3,
  Trash2,
  Save,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { interviewKitApi } from '../../api/client';

export function InterviewKitWorkspace({
  job,
  candidates = [],
  onCandidateSelect,
}) {
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [viewMode, setViewMode] = useState('interviewer'); // 'interviewer' | 'candidate'
  const [showCoverageMatrix, setShowCoverageMatrix] = useState(false);
  const [copiedKit, setCopiedKit] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

  // Question editing state
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [regeneratingQId, setRegeneratingQId] = useState(null);

  // New question form modal/inline state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionData, setNewQuestionData] = useState({
    category: 'Core Competency',
    skill: '',
    difficulty: 'Mid-level',
    question: '',
    why_it_matters: '',
    expected_answer: '',
    weight: 10,
  });

  // Scorecard state
  const [scores, setScores] = useState({});
  const [candidateNotes, setCandidateNotes] = useState('');
  const [recommendation, setRecommendation] = useState('Meets Expectations');
  const [savingScorecard, setSavingScorecard] = useState(false);
  const [scorecardSavedNotice, setScorecardSavedNotice] = useState(false);

  // Expanded questions state for details
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const jobId = job?.numeric_id || job?.id;

  // Load existing kit or generate when job changes
  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;

    const loadKit = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await interviewKitApi.get(jobId, selectedCandidateId);
        if (!isCancelled && data) {
          setKit(data);
          initializeScores(data);
        }
      } catch (err) {
        if (!isCancelled) {
          // If 404, trigger auto-generation
          handleGenerate(questionCount, selectedCandidateId);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadKit();
    return () => {
      isCancelled = true;
    };
  }, [jobId, selectedCandidateId]);

  const initializeScores = (kitData) => {
    if (!kitData) return;
    const initialScores = {};
    const existingScores = kitData.overall_scorecard?.question_scores || {};
    (kitData.questions || []).forEach((q) => {
      initialScores[q.id] = existingScores[q.id] || q.score || null;
    });
    setScores(initialScores);
    setCandidateNotes(kitData.overall_scorecard?.candidate_notes || '');
    setRecommendation(kitData.overall_scorecard?.overall_recommendation || 'Meets Expectations');
  };

  const handleGenerate = async (count = questionCount, candidateId = selectedCandidateId) => {
    if (!jobId) return;
    setGenerating(true);
    setError('');
    try {
      const generated = await interviewKitApi.generate(jobId, {
        question_count: count,
        candidate_id: candidateId ? Number(candidateId) : null,
        force_refresh: true,
      });
      setKit(generated);
      initializeScores(generated);
    } catch (err) {
      setError(err.message || 'Failed to generate interview kit.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleExpandQuestion = (qId) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleScoreChange = (qId, scoreVal) => {
    setScores((prev) => ({
      ...prev,
      [qId]: scoreVal,
    }));
  };

  // Compute live weighted score
  const computedScorecard = useMemo(() => {
    if (!kit || !kit.questions) return { overallPct: 0, scoredCount: 0, totalQuestions: 0 };
    let totalWeighted = 0;
    let totalWeight = 0;
    let scoredCount = 0;

    kit.questions.forEach((q) => {
      const score = scores[q.id];
      const weight = Number(q.weight || 10);
      if (score != null) {
        totalWeighted += Number(score) * weight;
        totalWeight += weight;
        scoredCount += 1;
      }
    });

    const overallPct = totalWeight > 0 ? Math.round((totalWeighted / (totalWeight * 5)) * 100) : 0;
    return {
      overallPct,
      scoredCount,
      totalQuestions: kit.questions.length,
    };
  }, [kit, scores]);

  const handleSaveScorecard = async () => {
    if (!kit?.id) return;
    setSavingScorecard(true);
    try {
      const cleanScores = {};
      Object.entries(scores).forEach(([k, v]) => {
        if (v != null) cleanScores[k] = Number(v);
      });
      const updated = await interviewKitApi.saveScorecard(kit.id, {
        scores: cleanScores,
        candidate_notes: candidateNotes,
        recommendation: recommendation,
      });
      setKit(updated);
      setScorecardSavedNotice(true);
      setTimeout(() => setScorecardSavedNotice(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save scorecard.');
    } finally {
      setSavingScorecard(false);
    }
  };

  const handleRegenerateQuestion = async (qId, targetSkill, difficulty) => {
    if (!kit?.id) return;
    setRegeneratingQId(qId);
    try {
      const updated = await interviewKitApi.regenerateQuestion(kit.id, {
        question_id: qId,
        target_skill: targetSkill,
        difficulty: difficulty,
      });
      setKit(updated);
    } catch (err) {
      setError(err.message || 'Failed to regenerate question.');
    } finally {
      setRegeneratingQId(null);
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!kit?.id) return;
    const remaining = (kit.questions || []).filter((q) => q.id !== qId);
    try {
      const updated = await interviewKitApi.update(kit.id, { questions: remaining });
      setKit(updated);
      setScores((prev) => {
        const copy = { ...prev };
        delete copy[qId];
        return copy;
      });
    } catch (err) {
      setError(err.message || 'Failed to delete question.');
    }
  };

  const handleStartEdit = (q) => {
    setEditingQuestionId(q.id);
    setEditFormData({ ...q });
  };

  const handleSaveEdit = async () => {
    if (!kit?.id || !editingQuestionId) return;
    const updatedQuestions = (kit.questions || []).map((q) =>
      q.id === editingQuestionId ? { ...q, ...editFormData } : q
    );
    try {
      const updated = await interviewKitApi.update(kit.id, { questions: updatedQuestions });
      setKit(updated);
      setEditingQuestionId(null);
    } catch (err) {
      setError(err.message || 'Failed to update question.');
    }
  };

  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    if (!kit?.id || !newQuestionData.question.trim()) return;
    const customQ = {
      id: `custom_${Date.now()}`,
      category: newQuestionData.category || 'Custom Recruiter Assessment',
      skill: newQuestionData.skill || 'Role Competency',
      difficulty: newQuestionData.difficulty || 'Mid-level',
      question: newQuestionData.question.trim(),
      why_it_matters: newQuestionData.why_it_matters || 'Assesses practical fit for target responsibilities.',
      expected_answer: newQuestionData.expected_answer || 'Candidate should articulate hands-on experience and key steps.',
      strong_signals: ['Concrete real-world examples', 'Clear technical articulation'],
      weak_signals: ['Vague or evasive answers', 'Lacks technical depth'],
      follow_ups: ['Can you provide an example from a recent project?'],
      weight: Number(newQuestionData.weight || 10),
      rubric: {
        '1_poor': 'Completely missing required skills or understanding.',
        '2_below': 'Superficial understanding; requires guidance.',
        '3_meets': 'Adequate proficiency; answers standard requirements cleanly.',
        '4_strong': 'High depth; demonstrates best practices and autonomy.',
        '5_excellent': 'Exceptional mastery, thought leadership, and optimization.',
      },
    };
    const updatedQuestions = [...(kit.questions || []), customQ];
    try {
      const updated = await interviewKitApi.update(kit.id, { questions: updatedQuestions });
      setKit(updated);
      setIsAddingQuestion(false);
      setNewQuestionData({
        category: 'Core Competency',
        skill: '',
        difficulty: 'Mid-level',
        question: '',
        why_it_matters: '',
        expected_answer: '',
        weight: 10,
      });
    } catch (err) {
      setError(err.message || 'Failed to add custom question.');
    }
  };

  const handleCopyKit = () => {
    if (!kit || !kit.questions) return;
    const isCand = viewMode === 'candidate';
    const lines = [
      `📋 COMPANYAI INTERVIEW KIT: ${kit.role_title}`,
      `Domain: ${kit.role_domain} | Seniority: ${kit.seniority} | Experience Target: ${kit.experience_level}`,
      `Mode: ${isCand ? 'Candidate Question List' : 'Interviewer Scorecard Guidance'}`,
      '----------------------------------------------------------------------',
    ];

    kit.questions.forEach((q, idx) => {
      lines.push(`\n[Question ${idx + 1}] (${q.category} • Skill: ${q.skill || 'Core'})`);
      lines.push(`Difficulty: ${q.difficulty || kit.seniority} | Score Weight: ${q.weight || 10}%`);
      lines.push(`"${q.question}"`);

      if (!isCand) {
        if (q.why_it_matters) lines.push(`Why It Matters: ${q.why_it_matters}`);
        if (q.expected_answer) lines.push(`Expected Signals: ${q.expected_answer}`);
        if (q.strong_signals?.length) {
          lines.push('Positive Signals (Green Flags):');
          q.strong_signals.forEach((s) => lines.push(`  • ${s}`));
        }
        if (q.weak_signals?.length) {
          lines.push('Watch-outs (Red Flags):');
          q.weak_signals.forEach((w) => lines.push(`  • ${w}`));
        }
        if (q.follow_ups?.length) {
          lines.push('Follow-up Probes:');
          q.follow_ups.forEach((fu) => lines.push(`  • ${fu}`));
        }
      }
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedKit(true);
    setTimeout(() => setCopiedKit(false), 2000);
  };

  const handleDownload = async (format) => {
    if (!kit?.id) return;
    setExportingFormat(format);
    try {
      const isCand = viewMode === 'candidate';
      const blob = await interviewKitApi.export(kit.id, format, isCand);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'word' ? 'docx' : format;
      const safeTitle = (kit.role_title || 'interview-kit').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeTitle}-interview-kit-${isCand ? 'candidate' : 'scorecard'}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const selectedCandidateObj = useMemo(() => {
    if (!selectedCandidateId || !candidates.length) return null;
    return candidates.find(
      (c) => String(c.numeric_id || c.id || c.candidate_id) === String(selectedCandidateId)
    );
  }, [selectedCandidateId, candidates]);

  return (
    <div className="space-y-4">
      {/* 1. Header & Configuration Bar */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-3">
        {/* Top line: Screening target metadata & Provenance */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Target Role:</span>
            <span className="font-bold text-navy-900 dark:text-slate-100 text-sm">{kit?.role_title || job?.title}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-100/70 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {kit?.role_domain?.replace('_', ' ').toUpperCase() || 'DOMAIN'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {kit?.seniority || 'Mid-level'} • {kit?.experience_level || '1-3 years'}
            </span>
            {kit?.candidate_id && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                <User className="w-3 h-3" />
                Candidate-Tailored
              </span>
            )}
          </div>

          {/* Model / Provenance Badge */}
          <div className="flex items-center gap-2 text-xs">
            {kit?.provenance === 'nemotron_ai' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Nemotron AI (v{kit?.kit_version || 1})
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium"
                title="Generated via dynamic JD rule engine calibrated to exact role skills and experience"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Dynamic JD Engine (v{kit?.kit_version || 1})
              </span>
            )}
          </div>
        </div>

        {/* Second Line: Recruiter Control Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder">
          {/* Left: View Mode Toggle & Candidate Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('interviewer')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'interviewer'
                    ? 'bg-white dark:bg-surface-darkCard text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  Interviewer Scorecard
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('candidate')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'candidate'
                    ? 'bg-white dark:bg-surface-darkCard text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Candidate-facing mode hides expected answers, red flags, and scoring rubrics"
              >
                <span className="flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" />
                  Candidate-Facing
                </span>
              </button>
            </div>

            {/* Candidate Selector for personalized mode */}
            {candidates.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <select
                  value={selectedCandidateId || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSelectedCandidateId(val);
                    if (onCandidateSelect) onCandidateSelect(val);
                  }}
                  className="bg-white dark:bg-surface-darkCard border border-slate-300 dark:border-surface-darkBorder rounded-lg px-2.5 py-1 text-navy-950 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Standard JD Interview Kit (General)</option>
                  {candidates.map((c) => {
                    const cid = c.numeric_id || c.id || c.candidate_id;
                    return (
                      <option key={cid} value={cid}>
                        Candidate: {c.name || `ID #${cid}`} ({(c.matchScore ?? c.match_score) == null ? 'Insufficient Evidence' : `${c.matchScore ?? c.match_score}% Match`})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Right: Question Count Selector & Regeneration */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Questions:</span>
              <select
                value={questionCount}
                onChange={(e) => {
                  const cnt = Number(e.target.value);
                  setQuestionCount(cnt);
                  handleGenerate(cnt, selectedCandidateId);
                }}
                disabled={generating}
                className="bg-white dark:bg-surface-darkCard border border-slate-300 dark:border-surface-darkBorder rounded-lg px-2 py-1 font-semibold text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value={5}>5 Questions (Screening)</option>
                <option value={8}>8 Questions (Standard)</option>
                <option value={10}>10 Questions (In-depth)</option>
                <option value={12}>12 Questions (Full Panel)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleGenerate(questionCount, selectedCandidateId)}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-surface-darkCard hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shadow-2xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCoverageMatrix((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showCoverageMatrix ? 'Hide Coverage' : 'Coverage Matrix'}</span>
            </button>
          </div>
        </div>

        {/* Global Export & Action Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAddingQuestion(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Question</span>
            </button>

            <button
              type="button"
              onClick={handleCopyKit}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-white dark:bg-surface-darkCard hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-surface-darkBorder shadow-2xs transition-all"
            >
              {copiedKit ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKit ? 'Copied Kit' : 'Copy'}</span>
            </button>
          </div>

          {/* Download Dropdowns / Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium">Download:</span>
            <button
              type="button"
              onClick={() => handleDownload('pdf')}
              disabled={exportingFormat === 'pdf'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold bg-white dark:bg-surface-darkCard hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-surface-darkBorder transition-all disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600" />
              <span>{exportingFormat === 'pdf' ? 'PDF...' : 'PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('docx')}
              disabled={exportingFormat === 'docx'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold bg-white dark:bg-surface-darkCard hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-surface-darkBorder transition-all disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{exportingFormat === 'docx' ? 'Word...' : 'Word'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('txt')}
              disabled={exportingFormat === 'txt'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold bg-white dark:bg-surface-darkCard hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-surface-darkBorder transition-all disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
              <span>{exportingFormat === 'txt' ? 'TXT...' : 'TXT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Coverage Matrix Table (Collapsible) */}
      {showCoverageMatrix && kit?.coverage_matrix && (
        <div className="p-4 rounded-xl bg-white dark:bg-surface-darkBg border border-teal-200/80 dark:border-teal-900/60 shadow-sm animate-fadeIn space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Dynamic JD Requirement Coverage Matrix</span>
            </h5>
            <span className="text-xs text-slate-500">
              Evaluated across {kit.questions?.length || 0} questions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-darkBorder text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-3 font-bold">JD Requirement / Skill</th>
                  <th className="py-2 px-3 font-bold">Type</th>
                  <th className="py-2 px-3 font-bold text-center">Questions Generated</th>
                  <th className="py-2 px-3 font-bold text-center">Coverage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-darkBorder">
                {(kit.coverage_matrix || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold text-navy-950 dark:text-slate-100">{row.requirement}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {row.type || 'Mandatory'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-teal-700 dark:text-teal-400">
                      {row.questions_generated}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {row.coverage || '100% Covered'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Add Custom Question Modal / Drawer */}
      {isAddingQuestion && (
        <form
          onSubmit={handleAddCustomQuestion}
          className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-300 dark:border-teal-800 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-xs sm:text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Add Custom Screening Question</span>
            </h5>
            <button
              type="button"
              onClick={() => setIsAddingQuestion(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Category</label>
              <input
                type="text"
                value={newQuestionData.category}
                onChange={(e) => setNewQuestionData({ ...newQuestionData, category: e.target.value })}
                placeholder="e.g. Hands-on Experience"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Target Skill / Tool</label>
              <input
                type="text"
                value={newQuestionData.skill}
                onChange={(e) => setNewQuestionData({ ...newQuestionData, skill: e.target.value })}
                placeholder="e.g. MicroStation / GST"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Difficulty</label>
              <select
                value={newQuestionData.difficulty}
                onChange={(e) => setNewQuestionData({ ...newQuestionData, difficulty: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium"
              >
                <option value="Entry-level">Entry-level</option>
                <option value="Junior">Junior</option>
                <option value="Mid-level">Mid-level</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Lead</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Question Prompt</label>
            <textarea
              rows={2}
              value={newQuestionData.question}
              onChange={(e) => setNewQuestionData({ ...newQuestionData, question: e.target.value })}
              placeholder="Enter the exact question prompt to be asked..."
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">Expected Answer Guidance</label>
            <textarea
              rows={2}
              value={newQuestionData.expected_answer}
              onChange={(e) => setNewQuestionData({ ...newQuestionData, expected_answer: e.target.value })}
              placeholder="What specific signals, technical steps, or methodology should the interviewer look for?"
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingQuestion(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
            >
              Save Question
            </button>
          </div>
        </form>
      )}

      {/* 4. Question Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600" />
            <p>Analyzing Job Description and calibrating tailored screening questions...</p>
          </div>
        ) : !kit?.questions?.length ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
            No questions generated yet. Click "Regenerate" to create a fresh kit.
          </div>
        ) : (
          kit.questions.map((q, idx) => {
            const isEditing = editingQuestionId === q.id;
            const isExpanded = expandedQuestions[q.id] ?? (idx === 0);
            const currentScore = scores[q.id];

            return (
              <div
                key={q.id || idx}
                className="p-4 rounded-xl bg-white dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-3 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Question Header & Badges */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-navy-900 dark:text-slate-100">
                      {q.category || 'Competency'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      {q.skill || 'Core'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {q.difficulty || kit.seniority}
                    </span>
                  </div>

                  {/* Recruiter Inline Actions */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      Weight: {q.weight || 10}%
                    </span>

                    {viewMode === 'interviewer' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRegenerateQuestion(q.id, q.skill, q.difficulty)}
                          disabled={regeneratingQId === q.id}
                          className="p-1 text-slate-400 hover:text-teal-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Regenerate this specific question"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${regeneratingQId === q.id ? 'animate-spin text-teal-600' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(q)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit question text and guidance"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Remove question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleExpandQuestion(q.id)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Question Prompt (Editable if in edit mode) */}
                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={editFormData.question || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, question: e.target.value })}
                      className="w-full text-xs sm:text-sm p-2 rounded-lg border border-teal-400 bg-white dark:bg-surface-darkCard font-semibold"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">Weight %:</label>
                        <input
                          type="number"
                          min={5}
                          max={40}
                          value={editFormData.weight || 10}
                          onChange={(e) => setEditFormData({ ...editFormData, weight: Number(e.target.value) })}
                          className="w-16 text-xs p-1 rounded border border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingQuestionId(null)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-3 py-1 text-xs rounded bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pl-8 space-y-2">
                    <p className="text-sm text-navy-950 dark:text-slate-100 font-semibold leading-relaxed">
                      "{q.question}"
                    </p>
                    {/* One-Line AI Expected Answer (Directly visible on card) */}
                    {viewMode === 'interviewer' && q.expected_answer && (
                      <div className="p-2.5 rounded-lg bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/90 dark:border-teal-900/60 flex items-start gap-2 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <span className="font-bold text-teal-900 dark:text-teal-200 mr-1.5">Expected Answer:</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{q.expected_answer}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Interviewer Deep Guidance (Only in Interviewer Mode & when expanded) */}
                {viewMode === 'interviewer' && isExpanded && (
                  <div className="pl-8 pt-2 space-y-3 border-t border-slate-100 dark:border-surface-darkBorder text-xs sm:text-sm animate-fadeIn">
                    {/* Why It Matters */}
                    {q.why_it_matters && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                        <strong className="text-slate-700 dark:text-slate-300 flex-shrink-0">Why It Matters:</strong>
                        <span>{q.why_it_matters}</span>
                      </div>
                    )}

                    {/* Expected Answer Guidance */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-darkBg border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                        <span>Expected Answer &amp; Assessment Guidance</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {q.expected_answer}
                      </p>
                    </div>

                    {/* Green Flags vs Red Flags */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Positive Signals */}
                      <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-1.5">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                          🟢 Positive Signals (Green Flags)
                        </span>
                        <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                          {(q.strong_signals || []).map((sf, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span>{sf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Red Flags */}
                      <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 space-y-1.5">
                        <span className="font-bold text-rose-800 dark:text-rose-300 block">
                          🔴 Watch-outs (Red Flags)
                        </span>
                        <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                          {(q.weak_signals || []).map((wf, wIdx) => (
                            <li key={wIdx} className="flex items-start gap-1.5">
                              <X className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                              <span>{wf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Follow-up Probes */}
                    {q.follow_ups?.length > 0 && (
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-indigo-800 dark:text-indigo-300">
                          Targeted Follow-up Questions:
                        </span>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-0.5 pl-1">
                          {q.follow_ups.map((fu, fIdx) => (
                            <li key={fIdx}>{fu}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 1–5 Scoring Rubric Bar */}
                    <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-navy-950 dark:text-slate-100">
                          Score Candidate (1–5 Scale):
                        </span>
                        {currentScore && (
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                            Current: {currentScore} / 5
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { val: 1, label: '1 - Poor', desc: q.rubric?.['1_poor'] || 'Missing foundational skills' },
                          { val: 2, label: '2 - Below', desc: q.rubric?.['2_below'] || 'Superficial depth' },
                          { val: 3, label: '3 - Meets', desc: q.rubric?.['3_meets'] || 'Solid competent execution' },
                          { val: 4, label: '4 - Strong', desc: q.rubric?.['4_strong'] || 'High autonomy & depth' },
                          { val: 5, label: '5 - Excellent', desc: q.rubric?.['5_excellent'] || 'Mastery & optimization' },
                        ].map((btn) => {
                          const isSelected = currentScore === btn.val;
                          return (
                            <button
                              key={btn.val}
                              type="button"
                              onClick={() => handleScoreChange(q.id, btn.val)}
                              className={`p-1.5 rounded-lg text-left transition-all border ${
                                isSelected
                                  ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                                  : 'bg-slate-50 dark:bg-surface-darkCard text-slate-700 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100'
                              }`}
                              title={btn.desc}
                            >
                              <span className="block text-[11px] font-bold leading-tight truncate">
                                {btn.label}
                              </span>
                              <span
                                className={`block text-[10px] leading-tight line-clamp-1 mt-0.5 ${
                                  isSelected ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {btn.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Overall Interview Scorecard Evaluation Panel (Interviewer Mode) */}
      {viewMode === 'interviewer' && kit?.questions?.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-teal-50/30 dark:from-surface-darkBg dark:to-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <div>
                <h5 className="text-sm font-bold text-navy-950 dark:text-slate-100">
                  Candidate Evaluation Scorecard Summary
                </h5>
                <span className="text-xs text-slate-500">
                  {computedScorecard.scoredCount} of {computedScorecard.totalQuestions} questions evaluated
                </span>
              </div>
            </div>

            {/* Score Percentage Pill */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Weighted Score</span>
                <span className="text-lg font-extrabold text-teal-700 dark:text-teal-300">
                  {computedScorecard.overallPct}%
                </span>
              </div>
              <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, computedScorecard.overallPct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Recommendation Select */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Overall Hiring Recommendation
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-semibold text-navy-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="Strong Hire">Strong Hire (Top 10%)</option>
                <option value="Hire">Hire (Meets All Critical Signals)</option>
                <option value="Leaning Hire">Leaning Hire (Minor Skill Ramp Needed)</option>
                <option value="Hold">Hold / Discuss with Panel</option>
                <option value="No Hire">No Hire (Critical Gaps Identified)</option>
              </select>
            </div>

            {/* Candidate Notes Textarea */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Interviewer Debrief Notes &amp; Evidence
              </label>
              <textarea
                rows={2}
                value={candidateNotes}
                onChange={(e) => setCandidateNotes(e.target.value)}
                placeholder="Log candidate specific project examples, strengths, red flags, or areas to probe in next rounds..."
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard font-medium text-navy-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Save Scorecard Button */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder">
            <div>
              {scorecardSavedNotice && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Scorecard saved successfully!
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveScorecard}
              disabled={savingScorecard}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingScorecard ? 'Saving...' : 'Save Scorecard Evaluation'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
