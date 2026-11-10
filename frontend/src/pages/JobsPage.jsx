// Import React and hooks for job state management.
import React, { useState, useMemo, useEffect } from 'react';

// Import jobs subcomponents.
import { JobList } from '../components/jobs/JobList';
import { JobDetail } from '../components/jobs/JobDetail';
import { AnalyzeModal } from '../components/jobs/AnalyzeModal';
import { CandidateDetail } from '../components/candidates/CandidateDetail';
import { ResumePreview } from '../components/candidates/ResumePreview';
// Query the existing Phase 3 job-to-candidate semantic matching endpoint.
import { apiRequest } from '../api';
// Import a plus icon for the real job creation action.
import { Plus } from 'lucide-react';

// Export JobsPage component presenting job descriptions and applicant matching with customizable status.
export const JobsPage = ({
  jobs = [],
  candidates = [],
  onUpdateJob,
  onUpdateCandidate,
  initialJobId = null,
  onSelectCandidateDirect,
  onCreateJob,
}) => {
  // Selected job id for master-detail layout (default to initial or first job).
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || jobs[0]?.id);
  // Job object to analyze inside AnalyzeModal.
  const [analyzingJob, setAnalyzingJob] = useState(null);

  // Candidate detail modal state if clicked from matching candidates list.
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  // Candidate resume preview modal state.
  const [previewCandidate, setPreviewCandidate] = useState(null);
  // Track API-derived resume matches and service state for the selected job.
  const [matchingCandidates, setMatchingCandidates] = useState([]);
  const [matchError, setMatchError] = useState('');

  // Lookup active candidate dynamically.
  const activeCandidate = useMemo(() => {
    return candidates.find((c) => c.id === activeCandidateId) || null;
  }, [candidates, activeCandidateId]);

  // Retrieve currently selected job object.
  const currentJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || jobs[0];
  }, [jobs, selectedJobId]);

  // Retrieve actual ranked resume records whenever the selected stored job changes.
  useEffect(() => {
    if (!currentJob) { setMatchingCandidates([]); return; }
    apiRequest(`/jobs/${currentJob.id}/matches?limit=20`)
      .then((rows) => setMatchingCandidates(rows.map((row) => ({ ...(candidates.find((candidate) => candidate.id === row.candidate_id) || {}), id: row.candidate_id, name: row.candidate_name || 'Unnamed candidate', currentRole: `Resume ${row.resume_id}`, primarySkills: row.skills || [], matchScore: Math.round((row.similarity || 0) * 100) }))))
      .catch((error) => { setMatchingCandidates([]); setMatchError(error.message); });
  }, [currentJob, candidates]);

  // Handle analysis completion simulation.
  const handleAnalysisComplete = (jobId) => {
    if (onUpdateJob) {
      const targetJob = jobs.find((j) => j.id === jobId);
      if (targetJob) {
        onUpdateJob({
          ...targetJob,
          analysis: {
            ...targetJob.analysis,
            analyzedAt: 'Just now',
            confidenceScore: 98,
          },
        });
      }
    }
  };

  // Open candidate details modal by candidate ID.
  const handleSelectCandidate = (candidateId) => {
    if (onSelectCandidateDirect) {
      onSelectCandidateDirect(candidateId);
    } else {
      setActiveCandidateId(candidateId);
    }
  };

  // Render jobs page.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <span>Job Descriptions & AI Matching</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {jobs.length} Positions
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingested from data/jds directory with Nemotron LLM criteria extraction & customizable status
          </p>
        </div>

        {/* Info label */}
        <button className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white" onClick={async () => { const title = window.prompt('Job title'); if (!title) return; const description = window.prompt('Job description') || ''; await onCreateJob?.({ title, description, required_skills: [] }); }}><Plus className="h-4 w-4" />Add job</button>
      </div>

      {/* Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {matchError && <div role="alert" className="lg:col-span-12 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{matchError}</div>}
        {/* Left Column: Job Description Cards List (5 columns wide) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Open Job Requisitions
          </div>
          <JobList
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onAnalyzeJob={(job) => setAnalyzingJob(job)}
            onUpdateJob={onUpdateJob}
          />
        </div>

        {/* Right Column: Selected Job Description Detail & Matched Candidates (7 columns wide) */}
        <div className="lg:col-span-7">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 mb-4">
            Specification & Match Details
          </div>
          <JobDetail
            job={currentJob}
            matchingCandidates={matchingCandidates}
            onAnalyzeJob={(job) => setAnalyzingJob(job)}
            onSelectCandidate={handleSelectCandidate}
            onUpdateJob={onUpdateJob}
          />
        </div>
      </div>

      {/* Interactive Nemotron Analyze JD Simulator Modal */}
      <AnalyzeModal
        job={analyzingJob}
        isOpen={Boolean(analyzingJob)}
        onClose={() => setAnalyzingJob(null)}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Candidate Profile Details Drawer/Modal */}
      <CandidateDetail
        candidate={activeCandidate}
        isOpen={Boolean(activeCandidate)}
        onClose={() => setActiveCandidateId(null)}
        onPreviewResume={(cand) => setPreviewCandidate(cand)}
        onUpdateCandidate={onUpdateCandidate}
      />

      {/* Resume Document Preview Modal */}
      <ResumePreview
        candidate={previewCandidate}
        isOpen={Boolean(previewCandidate)}
        onClose={() => setPreviewCandidate(null)}
      />
    </div>
  );
};
