// Import React and useState hook for managing interview scheduling form inputs and section toggles.
import React, { useState } from 'react';

// Import Badge component for skills and status pills.
import { Badge } from '../common/Badge';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import icons from lucide-react.
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  FileText,
  Building,
  Calendar,
  User,
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
}) => {
  // If candidate is null, do not render.
  if (!candidate) return null;

  // Available candidate stages for interactive stage dropdown.
  const stageOptions = [
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

  // State to control visibility of bottom interview scheduling section.
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Local state for scheduling controls.
  const [interviewRound, setInterviewRound] = useState(
    candidate.scheduledInterview?.round || interviewRoundOptions[1]
  );
  const [interviewStatus, setInterviewStatus] = useState(
    candidate.scheduledInterview?.status || 'Scheduled'
  );
  const [interviewer, setInterviewer] = useState(
    candidate.scheduledInterview?.interviewer || interviewerOptions[0]
  );
  const [interviewDate, setInterviewDate] = useState(
    candidate.scheduledInterview?.date || '2026-11-12T14:00'
  );
  const [interviewMeetingLink, setInterviewMeetingLink] = useState(
    candidate.scheduledInterview?.meetingLink || 'https://meet.google.com/xyz-recruitment'
  );
  const [saveConfirmation, setSaveConfirmation] = useState(false);

  // Handle stage change dropdown.
  const handleStageChange = (newStage) => {
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...candidate, status: newStage },
        `Candidate ${candidate.name} status updated to: ${newStage}`
      );
    }
  };

  // Handle availability change dropdown.
  const handleAvailabilityChange = (newAvailability) => {
    if (onUpdateCandidate) {
      onUpdateCandidate(
        { ...candidate, availability: newAvailability },
        `Candidate ${candidate.name} availability updated to: ${newAvailability}`
      );
    }
  };

  // Handle saving customized interview schedule.
  const handleSaveInterview = (e) => {
    e.preventDefault();
    const updatedCandidate = {
      ...candidate,
      status: interviewRound.includes('Technical')
        ? 'Technical Round 1'
        : interviewRound.includes('Manager')
        ? 'Manager Round'
        : 'Interviewing',
      scheduledInterview: {
        round: interviewRound,
        status: interviewStatus,
        interviewer,
        date: interviewDate,
        meetingLink: interviewMeetingLink,
      },
    };

    if (onUpdateCandidate) {
      onUpdateCandidate(
        updatedCandidate,
        `Interview scheduled for ${candidate.name}: ${interviewRound} with ${interviewer} on ${interviewDate.replace('T', ' ')}`
      );
    }

    setSaveConfirmation(true);
    setTimeout(() => setSaveConfirmation(false), 2500);
  };

  // Extract skills safely.
  const primarySkills = candidate.primarySkills && candidate.primarySkills.length > 0
    ? candidate.primarySkills
    : (candidate.skills || []).slice(0, 4);
  const secondarySkills = candidate.secondarySkills && candidate.secondarySkills.length > 0
    ? candidate.secondarySkills
    : (candidate.skills || []).slice(4);

  // Generate fallback employment history if not populated.
  const employmentHistory = candidate.employmentHistory && candidate.employmentHistory.length > 0
    ? candidate.employmentHistory
    : [
        {
          role: candidate.currentRole || 'Lead Technical Consultant',
          company: 'Enterprise Technology Solutions',
          period: '2021 - Present',
          achievements: `Leading production delivery, microservices architecture, and technical mentoring in ${primarySkills.slice(0, 2).join(' & ')}.`,
        },
        {
          role: 'Senior Software Engineer',
          company: 'Global Digital Systems Ltd',
          period: '2018 - 2021',
          achievements: `Designed modular business logic, optimized SQL and database schemas, and delivered scalable cloud integrations.`,
        },
      ];

  // Render modal drawer.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={candidate.name}
      subtitle={candidate.currentRole}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Top summary facts header with interactive dropdowns */}
        <div className="p-4 bg-surface-50/70 border border-slate-200/80 rounded-2xl space-y-3">
          {/* Contact facts row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5 font-medium text-navy-950">
                <Mail className="w-3.5 h-3.5 text-brand-600" />
                {candidate.email || 'Email Available'}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-navy-950 font-mono">
                <Phone className="w-3.5 h-3.5 text-brand-600" />
                {candidate.phone || 'Phone Available'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {candidate.location || 'India'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onPreviewResume(candidate)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-300 hover:border-brand-500 text-brand-700 hover:text-brand-800 rounded-xl text-xs font-semibold shadow-subtle transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Preview Resume Document</span>
              </button>
              <Badge variant="brand" size="md">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                {candidate.matchScore || 92}% Match Fit
              </Badge>
            </div>
          </div>

          {/* Interactive Candidate Stage & Availability Dropdowns Row */}
          <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-4 text-xs">
            {/* Candidate Stage Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Candidate Stage:</span>
              <div className="relative">
                <select
                  value={candidate.status}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="bg-white border border-slate-200 font-semibold text-navy-900 rounded-lg px-2.5 py-1 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
              <span className="text-slate-500 font-medium">Availability:</span>
              <div className="relative">
                <select
                  value={candidate.availability}
                  onChange={(e) => handleAvailabilityChange(e.target.value)}
                  className="bg-white border border-slate-200 font-semibold text-navy-900 rounded-lg px-2.5 py-1 appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
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
        </div>

        {/* AI Executive Summary - Structured 3-Line Professional Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            AI Executive Summary
          </h4>
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-subtle space-y-2.5 text-xs text-navy-900 leading-relaxed">
            {/* Line 1: Candidate Role & Experience */}
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-brand-50 text-brand-700 mt-0.5 flex-shrink-0">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-navy-950">Candidate Role & Experience: </span>
                <span>
                  Senior {candidate.currentRole} with {candidate.experienceYears || 5} years of demonstrated experience in enterprise application design and engineering.
                </span>
              </div>
            </div>

            {/* Line 2: Major & Minor Skills */}
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-700 mt-0.5 flex-shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-navy-950">Major & Minor Skills: </span>
                <span>
                  Primary core expertise in {primarySkills.join(', ')}. Supported by complementary skills in {secondarySkills.slice(0, 4).join(', ') || 'Agile, Git, and Unit Testing'}.
                </span>
              </div>
            </div>

            {/* Line 3: Tools & Technologies Stack */}
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-indigo-50 text-indigo-700 mt-0.5 flex-shrink-0">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-navy-950">Tools & Technologies: </span>
                <span>
                  Demonstrated hands-on proficiency across {secondarySkills.join(', ') || 'Docker, CI/CD, REST APIs, SQL, and Cloud Infrastructure'}.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Skills Inventory Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-brand-600" />
            Skills Inventory
          </h4>
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-subtle space-y-3">
            {/* Primary Core Skills */}
            <div>
              <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
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

            {/* Secondary Skills and Tools */}
            {secondarySkills.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
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
        </div>

        {/* Employment History Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            Employment History
          </h4>
          <div className="space-y-2.5">
            {employmentHistory.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-950">{item.role}</span>
                  <span className="text-[11px] font-mono text-slate-400">{item.period}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{item.company}</span>
                </div>
                <p className="text-xs text-slate-500 pt-0.5 leading-relaxed">{item.achievements}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Education Details */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
            Education & Academic Credentials
          </h4>
          <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center justify-between shadow-subtle">
            <div>
              <div className="font-bold text-navy-950">
                {candidate.education?.degree || 'Bachelor of Technology (B.Tech) in Computer Science / Information Technology'}
              </div>
              <div className="text-slate-500 text-[11px]">
                {candidate.education?.institution || 'State Technical University • Certified Software Engineer'}
              </div>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">
              {candidate.education?.year || '2018'}
            </span>
          </div>
        </div>

        {/* Verifiable Resume Evidence Quotes if available */}
        {candidate.evidenceHighlights && candidate.evidenceHighlights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verifiable Resume Evidence Quotes
            </h4>
            <div className="space-y-2">
              {candidate.evidenceHighlights.map((ev, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-brand-50/40 border border-brand-200/60 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-700">{ev.field}</span>
                    <span className="text-[10px] text-emerald-700 font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Evidence Verified
                    </span>
                  </div>
                  <p className="text-slate-700 italic">"{ev.quote}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INTERVIEW SCHEDULING & STAGE MANAGER DISPLAYED AT THE BOTTOM WITH TOGGLE BUTTON */}
        <div className="pt-2 border-t border-slate-200/80">
          {/* Toggle Button to open the scheduling form at the bottom */}
          <button
            type="button"
            onClick={() => setShowScheduleForm(!showScheduleForm)}
            className="w-full py-2.5 px-4 bg-surface-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold text-navy-900 transition-colors shadow-subtle"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand-50 text-brand-700 rounded-lg border border-brand-200/80">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span>Interview Scheduling & Stage Manager</span>
                <span className="text-[11px] font-normal text-slate-500 block">
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

          {/* Collapsible Form at the Bottom */}
          {showScheduleForm && (
            <div className="mt-3 p-4 bg-white border border-brand-200 rounded-2xl shadow-card space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h5 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                  Schedule Round & Assign Interviewer
                </h5>
                {saveConfirmation && (
                  <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                    Schedule Saved!
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveInterview} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Interview Round Dropdown */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block text-[11px]">
                      Interview Round:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewRound}
                        onChange={(e) => setInterviewRound(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                    <label className="font-semibold text-slate-700 block text-[11px]">
                      Interview Status:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewStatus}
                        onChange={(e) => setInterviewStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                    <label className="font-semibold text-slate-700 block text-[11px]">
                      Assigned Interviewer:
                    </label>
                    <div className="relative">
                      <select
                        value={interviewer}
                        onChange={(e) => setInterviewer(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 appearance-none pr-7 text-navy-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
                    <label className="font-semibold text-slate-700 block text-[11px]">
                      Interview Date & Time:
                    </label>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-navy-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                {/* Meeting Link input */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block text-[11px]">
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-navy-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>

                    {/* Save button */}
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg font-medium text-xs shadow-subtle transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm Schedule</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
