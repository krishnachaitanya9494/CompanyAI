// Import React and hooks for fetching full candidate detail, interviews, and approvals.
import React, { useState, useEffect } from 'react';

// Import Badge and ExpandableSection components for skills, status pills, and progressive disclosure.
import { Badge } from '../common/Badge';
import { ExpandableSection } from '../common/ExpandableSection';

// Import ResumeSelector for multi-version candidate resume dropdown switching.
import { ResumeSelector } from './ResumeSelector';

// Import Phase 1 Candidate Intelligence sub-tabs (Digital Twin, Resume Evolution, Potential & Mobility, Network).
import { CandidateIntelligenceTabs } from './CandidateIntelligenceTabs';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import candidate and approval API clients so scheduling and governance proposals persist to SQLite.
import { candidateApi, approvalApi } from '../../api/client';

// Import icons from lucide-react.
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Briefcase,
  GraduationCap,
  GitCompare,
  FileText,
  Building,
  Calendar,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Video,
  Send,
  Wrench,
  Layers,
  Award
} from 'lucide-react';

// Export CandidateDetail modal view presenting candidate profile facts and interactive interview stage management.
export const CandidateDetail = ({
  candidate,
  isOpen,
  onClose,
  onPreviewResume,
  onUpdateCandidate,
  onRefreshApprovals,
  onCompareWithJD,
}) => {
  // Available candidate stages aligned with backend SQLite stage definitions.
  const stageOptions = [
    'New',
    'Screened',
    'Shortlisted',
    'Technical Round 1',
    'Technical Round 2',
    'Manager Round',
    'HR Discussion',
    'Offer Extended',
    'Hired',
    'Rejected'
  ];

  // Available availability notice options.
  const availabilityOptions = [
    'Immediate',
    '15 Days',
    '30 Days',
    '60 Days',
    'Serving Notice'
  ];

  // Available interview rounds for dropdown selection.
  const interviewRoundOptions = [
    'Screening Round',
    'Technical Round 1 (Problem Solving & Coding)',
    'Technical Round 2 (System Architecture & Domain)',
    'Hiring Manager Discussion',
    'Executive / Culture Fit Round',
    'HR & Compensation Discussion'
  ];

  // Available interview status options for customization.
  const interviewStatusOptions = [
    'Scheduled',
    'Completed - Recommended',
    'Completed - Needs Discussion',
    'Passed',
    'Rescheduled',
    'Cancelled'
  ];

  // Available interviewer suggestions.
  const interviewerOptions = [
    'Rahul Deshmukh (Director, PLM)',
    'Vikram Malhotra (VP Engineering)',
    'Suresh Pillai (Lead Architect)',
    'Priya Sundaram (Operations Head)',
    'Ananya Sharma (Talent Lead)'
  ];

  // Declare all hooks unconditionally before returning when modal is closed.
  const [detailData, setDetailData] = useState(null);
  // Track selected resume version ID strictly scoped to the currently active candidate.
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [interviewRound, setInterviewRound] = useState(interviewRoundOptions[1]);
  const [interviewStatus, setInterviewStatus] = useState('Scheduled');
  const [interviewer, setInterviewer] = useState(interviewerOptions[0]);
  const [interviewDate, setInterviewDate] = useState('2026-11-12T14:00');
  const [interviewMeetingLink, setInterviewMeetingLink] = useState('');
  const [saveConfirmation, setSaveConfirmation] = useState('');
  const [isSavingInterview, setIsSavingInterview] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');

  // Load enriched candidate record (resumes, timeline, evidence highlights, interviews) on open.
  useEffect(() => {
    if (!isOpen || !candidate?.id) {
      setDetailData(null);
      setSelectedResumeId(null);
      setDetailTab('overview');
      return;
    }
    let active = true;
    // Reset selected resume and active tab whenever candidate changes so versions never bleed across profiles.
    setDetailTab('overview');
    setSelectedResumeId(candidate?.selectedResumeId || candidate?.winningResumeId || null);
    candidateApi
      .getById(candidate.id)
      .then((full) => {
        if (!active) return;
        setDetailData(full);
        setSelectedResumeId((prev) => {
          const list = full?.resumes || [];
          if (prev && list.some((r) => String(r.id) === String(prev))) return prev;
          return candidate?.winningResumeId || list[0]?.id || null;
        });
        if (full?.scheduledInterview) {
          setInterviewRound(full.scheduledInterview.round || interviewRoundOptions[1]);
          setInterviewStatus(full.scheduledInterview.status || 'Scheduled');
          setInterviewer(full.scheduledInterview.interviewer || interviewerOptions[0]);
          setInterviewDate(full.scheduledInterview.date || '2026-11-12T14:00');
          setInterviewMeetingLink(full.scheduledInterview.meetingLink || '');
        }
      })
      .catch((err) => {
        console.warn('Could not load extended candidate profile:', err.message);
      });
    return () => {
      active = false;
    };
  }, [isOpen, candidate?.id]);

  // Safely exit after hooks when no candidate is active.
  if (!candidate) return null;

  // Merge lightweight row prop with freshly fetched SQLite details.
  const activeCandidate = detailData ? { ...candidate, ...detailData } : candidate;

  // Handle stage change dropdown.
  const handleStageChange = (newStage) => {
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...activeCandidate, status: newStage },
        `Candidate ${activeCandidate.name} status updated to: ${newStage}`
      );
    }
  };

  // Handle availability change dropdown.
  const handleAvailabilityChange = (newAvailability) => {
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...activeCandidate, availability: newAvailability },
        `Candidate ${activeCandidate.name} availability updated to: ${newAvailability}`
      );
    }
  };

  // Persist interview round into SQLite via POST /api/candidates/{id}/interviews.
  const handleSaveInterview = async (e) => {
    e.preventDefault();
    setIsSavingInterview(true);
    setSaveConfirmation('');
    try {
      const result = await candidateApi.scheduleInterview(activeCandidate.id, {
        round_name: interviewRound,
        status: interviewStatus,
        interviewer,
        scheduled_at: interviewDate,
        meeting_link: interviewMeetingLink,
      });

      const updatedStage = result?.candidate_stage || activeCandidate.status;
      const persistedSchedule = {
        round: interviewRound,
        status: interviewStatus,
        interviewer,
        date: interviewDate,
        meetingLink: interviewMeetingLink,
      };

      setDetailData((prev) => ({ ...(prev || {}), status: updatedStage, scheduledInterview: persistedSchedule }));
      if (onUpdateCandidate) {
        await onUpdateCandidate(
          { ...activeCandidate, _skipPatch: true, status: updatedStage, scheduledInterview: persistedSchedule },
          `Interview persisted for ${activeCandidate.name}: ${interviewRound} with ${interviewer}`
        );
      }
      setSaveConfirmation('Persisted to SQLite!');
      setTimeout(() => setSaveConfirmation(''), 3000);
    } catch (err) {
      setSaveConfirmation(`Error: ${err.message}`);
    } finally {
      setIsSavingInterview(false);
    }
  };

  // Propose a human-in-the-loop governance approval from the candidate profile.
  const handleProposeApproval = async (actionType, label, extraPayload = {}) => {
    setIsSubmittingApproval(true);
    setApprovalFeedback('');
    try {
      await approvalApi.propose({
        action_type: actionType,
        description: `${label} for ${activeCandidate.name}`,
        payload: {
          candidate_id: activeCandidate.id,
          candidate_name: activeCandidate.name,
          ...extraPayload,
        },
        requester: 'Krishna C. (Recruiter)',
      });
      setApprovalFeedback(`${label} submitted to Approvals Queue for review.`);
      if (onRefreshApprovals) {
        await onRefreshApprovals();
      }
    } catch (err) {
      setApprovalFeedback(`Failed to submit approval: ${err.message}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Extract skills safely.
  const primarySkills = activeCandidate.primarySkills && activeCandidate.primarySkills.length > 0
    ? activeCandidate.primarySkills
    : (activeCandidate.skills || []).slice(0, 4);
  const secondarySkills = activeCandidate.secondarySkills && activeCandidate.secondarySkills.length > 0
    ? activeCandidate.secondarySkills
    : (activeCandidate.skills || []).slice(4);

  // Use only persisted employment history records; avoid inventing generic companies.
  const employmentHistory = Array.isArray(activeCandidate.employmentHistory)
    ? activeCandidate.employmentHistory
    : [];

  // Resolve candidate's persisted resume versions and active selected version cleanly.
  const candidateResumes = Array.isArray(activeCandidate.resumes) ? activeCandidate.resumes : [];
  const activeResumeObj =
    candidateResumes.find((r) => String(r.id) === String(selectedResumeId)) ||
    candidateResumes[0] ||
    null;
  const primaryResumeId =
    activeResumeObj?.id ||
    selectedResumeId ||
    activeCandidate.winningResumeId ||
    null;

  // Render modal drawer.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeCandidate.name}
      subtitle={activeCandidate.currentRole}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top summary facts header with interactive dropdowns */}
        <div className="p-4 bg-surface-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl space-y-3">
          {/* Contact facts row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5 font-medium text-navy-950 dark:text-slate-100">
                <Mail className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                {activeCandidate.email || 'Email not extracted'}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-navy-950 dark:text-slate-100 font-mono">
                <Phone className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                {activeCandidate.phone || 'Phone not extracted'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {activeCandidate.location || 'Location not specified'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ResumeSelector
                resumes={candidateResumes}
                selectedResumeId={primaryResumeId}
                compact
                onSelectResume={(res) => setSelectedResumeId(res.id)}
              />
              <button
                onClick={() =>
                  onPreviewResume &&
                  onPreviewResume({
                    ...activeCandidate,
                    resumes: candidateResumes,
                    selectedResumeId: primaryResumeId,
                    resumeFilename: activeResumeObj?.filename || activeCandidate.resumeFilename,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-surface-darkCard border border-brand-300 dark:border-brand-700 hover:border-brand-500 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-semibold shadow-subtle transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Preview Resume</span>
              </button>
              {primaryResumeId && (
                <a
                  href={candidateApi.getDownloadUrl(primaryResumeId)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder hover:border-slate-400 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-subtle transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              )}
              {onCompareWithJD && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCompareWithJD(null, activeCandidate.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold shadow-subtle transition-all"
                  title="Open JD & Resume Intelligence Comparison"
                >
                  <GitCompare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Compare with JD</span>
                </button>
              )}
              {activeCandidate.matchScore != null ? (
                <Badge variant="brand" size="md">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  {activeCandidate.matchScore}% Match Fit
                </Badge>
              ) : (
                <Badge variant="neutral" size="md">
                  Stage: {activeCandidate.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Interactive Candidate Stage & Availability Dropdowns Row */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-surface-darkBorder flex flex-wrap items-center gap-4 text-xs">
            {/* Candidate Stage Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Candidate Stage:</span>
              <div className="relative">
                <select
                  value={activeCandidate.status || 'New'}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder font-semibold text-navy-900 dark:text-slate-100 rounded-lg px-2.5 py-1 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {stageOptions.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>
            </div>

            {/* Candidate Availability Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Availability:</span>
              <div className="relative">
                <select
                  value={activeCandidate.availability || ''}
                  onChange={(e) => handleAvailabilityChange(e.target.value)}
                  className="bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder font-semibold text-navy-900 dark:text-slate-100 rounded-lg px-2.5 py-1 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Not specified</option>
                  {availabilityOptions.map((avail) => (
                    <option key={avail} value={avail}>
                      {avail}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Governance Approval Submission Actions */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Submit Governance Approval:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isSubmittingApproval}
                onClick={() => handleProposeApproval('shortlist_candidate', 'Shortlist approval', { stage: 'Shortlisted' })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                Request Shortlist
              </button>
              <button
                type="button"
                disabled={isSubmittingApproval}
                onClick={() => handleProposeApproval('offer_candidate', 'Offer approval', { stage: 'Offer Extended' })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                Request Offer
              </button>
              <button
                type="button"
                disabled={isSubmittingApproval}
                onClick={() => handleProposeApproval('reject_candidate', 'Rejection approval', { stage: 'Rejected' })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors"
              >
                Request Rejection
              </button>
            </div>
            {approvalFeedback && (
              <div className="w-full text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-1">
                {approvalFeedback}
              </div>
            )}
          </div>
        </div>

        {/* Phase 1 Intelligence Sub-Navigation Tabs (currently hidden/blocked) */}
        {false && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-surface-darkBorder rounded-xl">
          {[
            { id: 'overview', label: 'Overview & Resumes' },
            { id: 'digital_twin', label: 'Digital Twin 360°' },
            { id: 'evolution', label: 'Resume Evolution' },
            { id: 'mobility', label: 'Potential & Mobility' },
            { id: 'network', label: 'Candidate Network' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                detailTab === tab.id
                  ? 'bg-white dark:bg-surface-darkCard text-brand-700 dark:text-brand-300 shadow-subtle border border-slate-200/80 dark:border-surface-darkBorder'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        )}

        {detailTab !== 'overview' ? (
          <CandidateIntelligenceTabs candidateId={activeCandidate.id} activeTab={detailTab} />
        ) : (
          <>
        {/* Grounded Profile Summary from SQLite */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            Parsed Profile Summary
          </h4>
          <div className="bg-white dark:bg-surface-darkCard p-4 border border-slate-200/90 dark:border-surface-darkBorder rounded-2xl shadow-subtle space-y-2.5 text-xs text-navy-900 dark:text-slate-200 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 mt-0.5 flex-shrink-0">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-navy-950 dark:text-slate-100 block mb-0.5">
                  Experience & Overview ({activeCandidate.experienceYears != null ? `${activeCandidate.experienceYears} years recorded` : 'Experience not specified'})
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  {activeCandidate.summary || 'No executive summary extracted from resume. Open Preview Resume to read the source file.'}
                </p>
              </div>
            </div>

            {primarySkills.length > 0 && (
              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 mt-0.5 flex-shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-navy-950 dark:text-slate-100">Extracted Core Skills: </span>
                  <span className="text-slate-600 dark:text-slate-300">{primarySkills.join(', ')}</span>
                </div>
              </div>
            )}

            {secondarySkills.length > 0 && (
              <div className="flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 mt-0.5 flex-shrink-0">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-navy-950 dark:text-slate-100">Additional Indexed Skills: </span>
                  <span className="text-slate-600 dark:text-slate-300">{secondarySkills.join(', ')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Skills Inventory Section (open by default) */}
        <ExpandableSection
          title="Skills Inventory"
          badge={(activeCandidate.skills || []).length}
          icon={Award}
          defaultExpanded
        >
          <div className="space-y-3 pt-2">
            {primarySkills.length === 0 ? (
              <p className="text-xs text-slate-400">No structured skill tags extracted for this profile.</p>
            ) : (
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                  Primary Core Skills ({primarySkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {primarySkills.map((sk, idx) => (
                    <Badge key={idx} variant="brand" size="sm">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {secondarySkills.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-surface-darkBorder">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                  Tools, Frameworks & Technologies ({secondarySkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {secondarySkills.map((sk, idx) => (
                    <Badge key={idx} variant="neutral" size="sm">
                      {sk}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ExpandableSection>

        {/* Expandable Employment History & Education Sections */}
        <ExpandableSection
          title="Employment History"
          badge={employmentHistory.length > 0 ? employmentHistory.length : 'Parsed Text'}
          icon={Building}
          defaultExpanded={employmentHistory.length > 0}
        >
          <div className="pt-2">
            {employmentHistory.length > 0 ? (
              <div className="space-y-2.5">
                {employmentHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-surface-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-navy-950 dark:text-slate-100">{item.role}</span>
                      <span className="text-[11px] font-mono text-slate-400">{item.period}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.company}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5 leading-relaxed">{item.achievements}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-surface-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-xl text-xs text-slate-500 dark:text-slate-400">
                Structured employment entries were not separately extracted into database rows. Use Preview Resume to inspect original work history.
              </div>
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Education & Academic Credentials"
          icon={GraduationCap}
          defaultExpanded={Boolean(activeCandidate.education && (activeCandidate.education.degree || activeCandidate.education.institution))}
        >
          <div className="pt-2">
            {activeCandidate.education && (activeCandidate.education.degree || activeCandidate.education.institution) ? (
              <div className="p-3 bg-surface-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-surface-darkBorder rounded-xl text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-navy-950 dark:text-slate-100">
                    {activeCandidate.education.degree}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {activeCandidate.education.institution}
                  </div>
                </div>
                {activeCandidate.education.year && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    {activeCandidate.education.year}
                  </span>
                )}
              </div>
            ) : (
              <div className="p-3 bg-surface-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-surface-darkBorder rounded-xl text-xs text-slate-500 dark:text-slate-400">
                No structured education credentials stored in SQLite; refer to source resume text for academic details.
              </div>
            )}
          </div>
        </ExpandableSection>

        {/* Expandable Verifiable Resume Evidence Quotes */}
        {activeCandidate.evidenceHighlights && activeCandidate.evidenceHighlights.length > 0 && (
          <ExpandableSection
            title="Verifiable Resume Evidence Quotes"
            badge={activeCandidate.evidenceHighlights.length}
            icon={ShieldCheck}
          >
            <div className="space-y-2 pt-2">
              {activeCandidate.evidenceHighlights.map((ev, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-brand-50/40 dark:bg-brand-950/30 border border-brand-200/60 dark:border-brand-800 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-700 dark:text-brand-300">{ev.field}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Evidence Stored
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 italic">"{ev.quote}"</p>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}

        {/* Expandable Multi-Version Resume Documents List */}
        {candidateResumes.length > 0 && (
          <ExpandableSection
            title="Resume Documents & Version History"
            badge={`${candidateResumes.length} ${candidateResumes.length === 1 ? 'File' : 'Versions'}`}
            icon={FileText}
            defaultExpanded={candidateResumes.length > 1}
          >
            <div className="space-y-1.5 pt-2">
              {candidateResumes.map((res, i) => {
                const isSelectedVersion = String(res.id) === String(primaryResumeId);
                return (
                  <div
                    key={res.id || i}
                    className={`p-3 border rounded-xl text-xs flex items-center justify-between shadow-subtle gap-2 transition-colors ${
                      isSelectedVersion
                        ? 'bg-brand-50/50 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700'
                        : 'bg-surface-50/60 dark:bg-slate-800/50 border-slate-200/80 dark:border-surface-darkBorder'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[10px] font-mono font-bold text-navy-900 dark:text-slate-200 flex-shrink-0">
                        v{i + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-navy-900 dark:text-slate-100 block truncate">{res.filename}</span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          SHA: {(res.sha256 || '').slice(0, 12)}... • Uploaded: {res.uploadedAt}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSelectedResumeId(res.id);
                          onPreviewResume &&
                            onPreviewResume({
                              ...activeCandidate,
                              resumes: candidateResumes,
                              selectedResumeId: res.id,
                              resumeFilename: res.filename,
                            });
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 border border-brand-200 dark:border-brand-800 rounded-lg transition-colors"
                      >
                        Preview
                      </button>
                      {res.id && (
                        <a
                          href={candidateApi.getDownloadUrl(res.id)}
                          download
                          className="px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-surface-darkBorder rounded-lg transition-colors"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ExpandableSection>
        )}

        {/* Expandable Candidate Activity Timeline */}
        {activeCandidate.timeline && activeCandidate.timeline.length > 0 && (
          <ExpandableSection
            title="Candidate Activity Timeline"
            badge={activeCandidate.timeline.length}
            icon={Clock}
          >
            <div className="pt-2 space-y-2.5 text-xs max-h-48 overflow-y-auto">
              {activeCandidate.timeline.map((ev, i) => (
                <div key={ev.id || i} className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100 dark:border-surface-darkBorder last:border-0 last:pb-0">
                  <div>
                    <span className="font-bold text-navy-950 dark:text-slate-100 block">{ev.title}</span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{ev.summary}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{ev.time}</span>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}

        {/* INTERVIEW SCHEDULING & STAGE MANAGER */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-surface-darkBorder">
          <button
            type="button"
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="w-full py-2.5 px-4 bg-surface-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-xl flex items-center justify-between text-xs font-bold text-navy-900 dark:text-slate-100 transition-colors shadow-subtle"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 rounded-lg border border-brand-200/80 dark:border-brand-800">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span>Interview Scheduling & Stage Manager</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 block">
                  {showScheduleForm ? 'Click to collapse scheduling controls' : 'Click to schedule an interview round or manage interviewer'}
                </span>
              </div>
            </div>

            {showScheduleForm ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {showScheduleForm && (
            <div className="mt-3 p-4 bg-white dark:bg-surface-darkCard border border-brand-200 dark:border-brand-800 rounded-2xl shadow-card space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-darkBorder pb-2">
                <h5 className="text-xs font-bold text-navy-900 dark:text-slate-100 uppercase tracking-wider">
                  Schedule Round & Assign Interviewer
                </h5>
                {saveConfirmation && (
                  <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-md flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                    {saveConfirmation}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveInterview} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Interview Round Dropdown */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Interview Round:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewRound}
                        onChange={(e) => setInterviewRound(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      >
                        {interviewRoundOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Interview Status Dropdown */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Interview Status:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewStatus}
                        onChange={(e) => setInterviewStatus(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      >
                        {interviewStatusOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Interviewer Selector Dropdown */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Assigned Interviewer:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewer}
                        onChange={(e) => setInterviewer(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      >
                        {interviewerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Date & Time Picker */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                      Interview Date & Time:
                    </label>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg px-2.5 py-1.5 text-navy-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                {/* Meeting Link input */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                    Video Meeting Link / Room:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Video className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={interviewMeetingLink}
                        onChange={(e) => setInterviewMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-surface-darkBorder rounded-lg pl-8 pr-3 py-1.5 text-navy-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingInterview}
                      className="px-4 py-1.5 bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 text-white rounded-lg font-medium text-xs shadow-subtle transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSavingInterview ? 'Saving...' : 'Confirm Schedule'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </Modal>
  );
};
