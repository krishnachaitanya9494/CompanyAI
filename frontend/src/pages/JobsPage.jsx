// Import React and hooks for job state management.
import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';

// Import primary list & detail subcomponents.
import { JobList } from '../components/jobs/JobList';
import { JobDetail } from '../components/jobs/JobDetail';
// Lazy-load heavy modals and workspaces to keep JobsPage route bundle compact.
const AnalyzeModal = lazy(() =>
  import('../components/jobs/AnalyzeModal').then((m) => ({ default: m.AnalyzeModal }))
);
const CandidateDetail = lazy(() =>
  import('../components/candidates/CandidateDetail').then((m) => ({ default: m.CandidateDetail }))
);
const ResumePreview = lazy(() =>
  import('../components/candidates/ResumePreview').then((m) => ({ default: m.ResumePreview }))
);
const UploadJDModal = lazy(() =>
  import('../components/jobs/UploadJDModal').then((m) => ({ default: m.UploadJDModal }))
);
const JDSegmentationWorkspace = lazy(() =>
  import('../components/jobs/JDSegmentationWorkspace').then((m) => ({ default: m.JDSegmentationWorkspace }))
);
// Query the existing Phase 3 job-to-candidate semantic matching endpoint.
import { apiRequest } from '../api';
// Import icons for the real job creation action.
import { Plus, Upload } from 'lucide-react';

// Export JobsPage component presenting job descriptions and applicant matching with customizable status.
export const JobsPage = ({
  jobs = [],
  candidates = [],
  onUpdateJob,
  onUpdateCandidate,
  onRefreshApprovals,
  initialJobId = null,
  onSelectCandidateDirect,
  onCreateJob,
  onNavigateToMatrix,
}) => {
  // Selected job id for master-detail layout (default to initial or first job).
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || jobs[0]?.id);
  // Job object to analyze inside AnalyzeModal.
  const [analyzingJob, setAnalyzingJob] = useState(null);
  // Manual Job Description upload modal state.
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  // Job object to open in JD 15-category Segmentation Workspace.
  const [segmentingJob, setSegmentingJob] = useState(null);

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
    // Clear candidates if no job is selected.
    if (!currentJob) { setMatchingCandidates([]); return; }
    // Fetch Phase 5C matches for the currently active job.
    apiRequest(`/jobs/${currentJob.id}/matches?limit=25`)
      .then((data) => {
        // Extract array whether returned as a flat list or nested object.
        const rows = Array.isArray(data) ? data : (data.matches || []);
        // Map rows preserving real evaluated backend values without fabricated fallback defaults.
        setMatchingCandidates(rows.map((row) => {
          // Find matching local candidate if present.
          const baseCand = candidates.find((c) => c.id === (row.candidate_id || row.id)) || {};
          return {
            ...baseCand,
            ...row,
            id: row.candidate_id || row.id,
            matchScore: row.matchScore ?? row.match_score ?? null,
            primarySkills: row.primarySkills || baseCand.primarySkills || (row.skills || []).slice(0, 4),
            secondarySkills: row.secondarySkills || baseCand.secondarySkills || (row.skills || []).slice(4),
            currentRole: row.currentRole || baseCand.currentRole || 'Candidate Profile',
            experienceYears: row.experienceYears ?? row.experience_years ?? baseCand.experienceYears ?? null,
            location: row.location || baseCand.location || '',
            availability: row.availability || baseCand.availability || '',
            status: row.status || row.stage || baseCand.status || 'New',
          };
        }));
      })
      .catch((error) => { setMatchingCandidates([]); setMatchError(error.message); });
  }, [currentJob, candidates]);

  // Sync real returned Nemotron analysis data into Job state when AnalyzeModal finishes.
  const handleAnalysisComplete = (jobId, analysisPayload = null) => {
    if (onUpdateJob && analysisPayload) {
      const targetJob = jobs.find((j) => j.id === jobId);
      if (targetJob) {
        onUpdateJob({
          ...targetJob,
          analysis: analysisPayload,
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

  // Render jobs page with full Light/Dark contrast support.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Sticky Top Header Bar so "Upload Job Description" remains fixed & visible while scrolling */}
      <div className="sticky top-16 z-10 -mx-2 px-2 py-3 bg-surface-50/95 dark:bg-surface-darkCanvas/95 backdrop-blur-md border-b border-slate-200/70 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[28px] lg:text-[32px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-2.5 leading-tight">
            <span>Job Descriptions &amp; AI Matching</span>
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {jobs.length} Positions
            </span>
          </h2>
          <p className="text-sm sm:text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Ingested JD specifications with 15-category segmentation, vector readiness, and status controls
          </p>
        </div>

        {/* Fixed / Always-Visible Upload Job Description Action Button */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-700 px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors flex-shrink-0 self-start sm:self-auto"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Upload Job Description
        </button>
      </div>

      {/* Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {matchError && (
          <div
            role="alert"
            className="lg:col-span-12 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
          >
            <span>Unable to load job matches: {matchError}</span>
            <button
              type="button"
              onClick={() => setMatchError('')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 transition-colors flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Left Column: Job Description Cards List (5 columns wide) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Open Job Positions
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
            onOpenSegmentation={(job) => setSegmentingJob(job)}
            onSelectCandidate={handleSelectCandidate}
            onUpdateJob={onUpdateJob}
            onOpenMatrix={onNavigateToMatrix}
            onRefreshApprovals={onRefreshApprovals}
          />
        </div>
      </div>

      {/* Lazy-loaded modals and workspaces when triggered by user interaction */}
      <Suspense fallback={null}>
        {/* Interactive Nemotron Analyze JD Modal */}
        {analyzingJob && (
          <AnalyzeModal
            job={analyzingJob}
            isOpen={Boolean(analyzingJob)}
            onClose={() => setAnalyzingJob(null)}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}

        {/* Candidate Profile Details Drawer/Modal */}
        {activeCandidate && (
          <CandidateDetail
            candidate={activeCandidate}
            isOpen={Boolean(activeCandidate)}
            onClose={() => setActiveCandidateId(null)}
            onPreviewResume={(cand) => setPreviewCandidate(cand)}
            onUpdateCandidate={onUpdateCandidate}
            onRefreshApprovals={onRefreshApprovals}
          />
        )}

        {/* Resume Document Preview Modal */}
        {previewCandidate && (
          <ResumePreview
            candidate={previewCandidate}
            isOpen={Boolean(previewCandidate)}
            onClose={() => setPreviewCandidate(null)}
          />
        )}

        {/* Manual Job Description Upload and Text Extraction Modal */}
        {isUploadModalOpen && (
          <UploadJDModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            existingJobs={jobs}
            onJobCreated={(newJob) => {
              if (onCreateJob) {
                onCreateJob(newJob);
              }
              if (newJob?.id) {
                setSelectedJobId(newJob.id);
              }
            }}
          />
        )}

        {/* Interactive 15-Category JD Segmentation Workspace */}
        {segmentingJob && (
          <JDSegmentationWorkspace
            job={segmentingJob}
            isOpen={Boolean(segmentingJob)}
            onClose={() => setSegmentingJob(null)}
            onNavigateToMatrix={(targetJob) => {
              setSegmentingJob(null);
              if (onNavigateToMatrix) onNavigateToMatrix(targetJob);
            }}
            onSegmentationUpdated={(updatedSeg) => {
              if (onUpdateJob && segmentingJob) {
                onUpdateJob({ ...segmentingJob });
              }
            }}
          />
        )}
      </Suspense>
    </div>
  );
};
