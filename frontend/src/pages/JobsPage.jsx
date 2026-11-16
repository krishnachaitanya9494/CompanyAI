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
// Import icons for the real job creation action and full page view toggle.
import { Plus, Upload, AlertCircle, X, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';

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
  onNavigateToComparison,
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
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Toggle full page view for Specification & Match Details pane.
  const [isFullPageView, setIsFullPageView] = useState(false);

  // Escape key handler to quickly exit full page view if open.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullPageView) {
        setIsFullPageView(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullPageView]);

  // Sync selectedJobId if jobs arrive after initial mount.
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(initialJobId || jobs[0]?.id);
    }
  }, [jobs, initialJobId, selectedJobId]);

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
    // Clear candidates & error if no job is selected.
    if (!currentJob) {
      setMatchingCandidates([]);
      setMatchError('');
      setIsLoadingMatches(false);
      return;
    }

    const controller = new AbortController();

    // Reset error state on new job selection.
    setMatchError('');
    setIsLoadingMatches(true);

    // Fetch Phase 5C matches for the currently active job using clean numeric id when available.
    const jobIdParam = currentJob.numeric_id || currentJob.id;
    apiRequest(`/jobs/${jobIdParam}/matches?limit=50`, {
      timeoutMs: 45000,
      signal: controller.signal,
    })
      .then((data) => {
        setIsLoadingMatches(false);
        // Clear any previous error on success
        setMatchError('');
        // Extract array whether returned as a flat list or nested object.
        const rows = Array.isArray(data) ? data : (data.matches || []);
        // Map rows preserving real evaluated backend values without fabricated fallback defaults.
        setMatchingCandidates(rows.map((row) => {
          const rowCandId = row.candidate_id || row.id;
          // Find matching local candidate if present using type-agnostic string comparison.
          const baseCand = candidates.find((c) =>
            String(c.numeric_id || c.id) === String(rowCandId) ||
            String(c.code || '').toLowerCase() === String(row.code || '').toLowerCase()
          ) || {};

          const mergedSkills = Array.from(new Set([
            ...(row.skills || []),
            ...(baseCand.skills || []),
            ...(row.primarySkills || []),
            ...(baseCand.primarySkills || []),
            ...(row.secondarySkills || []),
            ...(baseCand.secondarySkills || []),
          ]));

          return {
            ...baseCand,
            ...row,
            id: rowCandId,
            numeric_id: row.numeric_id || baseCand.numeric_id || rowCandId,
            name: row.name || row.candidate_name || baseCand.name || 'Candidate',
            matchScore: row.matchScore ?? row.match_score ?? null,
            primarySkills: row.primarySkills || baseCand.primarySkills || mergedSkills.slice(0, 4),
            secondarySkills: row.secondarySkills || baseCand.secondarySkills || mergedSkills.slice(4),
            skills: mergedSkills,
            currentRole: row.currentRole || baseCand.currentRole || row.title || baseCand.title || 'Candidate Profile',
            experienceYears: row.experienceYears ?? row.experience_years ?? baseCand.experienceYears ?? null,
            location: row.location || baseCand.location || '',
            availability: row.availability || baseCand.availability || '',
            status: row.status || row.stage || baseCand.status || 'New',
          };
        }));
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          return;
        }
        setIsLoadingMatches(false);
        setMatchingCandidates([]);
        // Only set error if it's a real failure message and not an intentional abort or 404
        if (error && error.message && !error.message.includes('404')) {
          setMatchError(String(error.message || '').trim());
        } else {
          setMatchError('');
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentJob?.id, currentJob?.numeric_id, candidates]);

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

  // Render jobs page with full Light/Dark contrast support and independent dual-column scrolling.
  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3 animate-fadeIn">
      {/* Sticky/Fixed Header Bar: Remains pinned at top of Jobs workspace */}
      <div className="flex-shrink-0 -mx-1 px-2 py-2 bg-surface-50/95 dark:bg-surface-darkCanvas/95 backdrop-blur-md border-b border-slate-200/70 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[24px] lg:text-[28px] font-bold font-display text-navy-950 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-2.5 leading-tight">
            <span>Job Descriptions &amp; AI Matching</span>
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {jobs.length} Positions
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ingested JD specifications with 15-category segmentation, vector readiness, and status controls
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors flex-shrink-0 self-start sm:self-auto"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Upload Job Description
        </button>
      </div>

      {matchError && typeof matchError === 'string' && matchError.trim().length > 0 && (
        <div
          role="alert"
          className="flex-shrink-0 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 shadow-subtle animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span>Unable to load job matches: {matchError}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setMatchError('');
                setIsLoadingMatches(true);
                const jobIdParam = currentJob?.numeric_id || currentJob?.id;
                if (jobIdParam) {
                  apiRequest(`/jobs/${jobIdParam}/matches?limit=50`, { timeoutMs: 35000 })
                    .then((data) => {
                      setIsLoadingMatches(false);
                      setMatchError('');
                      const rows = Array.isArray(data) ? data : (data.matches || []);
                      setMatchingCandidates(rows.map((row) => {
                        const rowCandId = row.candidate_id || row.id;
                        const baseCand = candidates.find((c) =>
                          String(c.numeric_id || c.id) === String(rowCandId) ||
                          String(c.code || '').toLowerCase() === String(row.code || '').toLowerCase()
                        ) || {};
                        return {
                          ...baseCand,
                          ...row,
                          id: rowCandId,
                          numeric_id: row.numeric_id || baseCand.numeric_id || rowCandId,
                          name: row.name || row.candidate_name || baseCand.name || 'Candidate',
                          matchScore: row.matchScore ?? row.match_score ?? null,
                          skills: row.skills || baseCand.skills || [],
                          currentRole: row.currentRole || baseCand.currentRole || row.title || 'Candidate Profile',
                          experienceYears: row.experienceYears ?? row.experience_years ?? baseCand.experienceYears ?? null,
                          location: row.location || baseCand.location || '',
                          status: row.status || row.stage || baseCand.status || 'New',
                        };
                      }));
                    })
                    .catch((err) => {
                      setIsLoadingMatches(false);
                      setMatchError(String(err?.message || 'Failed to load matches').trim());
                    });
                }
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 text-red-700 dark:text-red-300 transition-colors"
            >
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => setMatchError('')}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 text-red-700 dark:text-red-300 transition-colors"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* Two-Column Master-Detail Layout with Independent Scrolling and Full Page View Toggle */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:overflow-hidden pb-1">
        {/* Left Column: Job Description Cards List (5 columns wide) - Hidden when Full Page View is active */}
        {!isFullPageView && (
          <div className="lg:col-span-5 lg:h-full flex flex-col lg:min-h-0 animate-fadeIn">
            <div className="flex-shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 mb-2">
              Open Job Positions
            </div>
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar focus:outline-none">
              <JobList
                jobs={jobs}
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
                onAnalyzeJob={(job) => setAnalyzingJob(job)}
                onUpdateJob={onUpdateJob}
              />
            </div>
          </div>
        )}

        {/* Right Column: Selected Job Description Detail & Matched Candidates - Expands to 12 columns in Full Page View */}
        <div className={`${isFullPageView ? 'col-span-12 lg:col-span-12' : 'lg:col-span-7'} lg:h-full flex flex-col lg:min-h-0 transition-all duration-200`}>
          <div className="flex-shrink-0 flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Specification &amp; Match Details
              </span>
              {isFullPageView && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 animate-fadeIn">
                  Full Page View
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* In Full Page View, allow quick navigation between jobs without needing the left panel */}
              {isFullPageView && jobs.length > 1 && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = jobs.findIndex((j) => j.id === selectedJobId);
                      const prevIdx = idx > 0 ? idx - 1 : jobs.length - 1;
                      setSelectedJobId(jobs[prevIdx].id);
                    }}
                    title="Previous Job Position"
                    className="p-1 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-1 font-mono">
                    {jobs.findIndex((j) => j.id === selectedJobId) + 1} / {jobs.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = jobs.findIndex((j) => j.id === selectedJobId);
                      const nextIdx = idx < jobs.length - 1 ? idx + 1 : 0;
                      setSelectedJobId(jobs[nextIdx].id);
                    }}
                    title="Next Job Position"
                    className="p-1 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Full Page View / Split View Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFullPageView((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-all shadow-xs ${
                  isFullPageView
                    ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/80'
                    : 'bg-white dark:bg-surface-darkCard border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isFullPageView ? "Exit full page view (or press Esc to restore split view)" : "Expand specification & match details to full page view"}
              >
                {isFullPageView ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Split View</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Full Page View</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar focus:outline-none">
            <JobDetail
              job={currentJob}
              allJobs={jobs}
              allCandidates={candidates}
              isLoadingMatches={isLoadingMatches}
              onSelectJob={setSelectedJobId}
              matchingCandidates={matchingCandidates}
              onAnalyzeJob={(job) => setAnalyzingJob(job)}
              onOpenSegmentation={(job) => setSegmentingJob(job)}
              onSelectCandidate={handleSelectCandidate}
              onUpdateJob={onUpdateJob}
              onOpenMatrix={onNavigateToMatrix}
              onNavigateToJob={(targetJobId) => setSelectedJobId(targetJobId)}
              onCompareWithCandidate={(candId) => onNavigateToComparison && onNavigateToComparison(currentJob?.id, candId)}
              onOpenComparison={() => onNavigateToComparison && onNavigateToComparison(currentJob?.id, null)}
              onRefreshApprovals={onRefreshApprovals}
              isFullPageView={isFullPageView}
              onToggleFullPageView={() => setIsFullPageView((prev) => !prev)}
            />
          </div>
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
