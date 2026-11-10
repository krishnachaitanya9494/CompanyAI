// Import React and hooks for routing and state management.
import React, { useState, useEffect } from 'react';

// Import layout components.
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { UnifiedSearchModal } from './components/layout/UnifiedSearchModal';
import { ApprovalBanner } from './components/common/ApprovalBanner';

// Import page views for CompanyAI 2.0 workspace.
import { DashboardPage } from './pages/DashboardPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { JobsPage } from './pages/JobsPage';
import { RequestsPage } from './pages/RequestsPage';
import { InterviewsPage } from './pages/InterviewsPage';
import { PipelineKanbanPage } from './pages/PipelineKanbanPage';
import { MatchingMatrixPage } from './pages/MatchingMatrixPage';

// Import CandidateDetail modal for global candidate inspection from any page.
import { CandidateDetail } from './components/candidates/CandidateDetail';
import { ResumePreview } from './components/candidates/ResumePreview';

// Import local API access and adapters for persisted recruitment records.
import { apiRequest, toActivity, toCandidate, toJob, toRequest } from './api';

// Import API client services for candidate uploads and approval governance.
import { approvalApi, candidateApi } from './api/client';

// Export App root component managing application views, state, and interactive customizations.
export default function App() {
  // Active navigation tab state ('dashboard', 'assistant', 'activity', 'candidates', 'jobs', 'requests', 'interviews', 'pipeline', 'matching').
  const [activeTab, setActiveTab] = useState('dashboard');

  // Central state for candidates allowing real-time stage and interview customization.
  const [candidates, setCandidates] = useState([]);

  // Central state for job descriptions allowing status customization.
  const [jobs, setJobs] = useState([]);

  // Central state for recruitment requests allowing priority and recruiter customization.
  const [requests, setRequests] = useState([]);

  // Central state for activities feed populated with clean milestones and real user actions.
  const [activities, setActivities] = useState([]);

  // Track pending approvals requiring Human-in-the-Loop review.
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Control visibility of Glean-style unified search modal.
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Track real API loading and failure states instead of presenting mock content.
  const [apiState, setApiState] = useState({ loading: true, error: '', dashboard: null, discovery: null });

  // Targeted candidate ID for direct inspection across pages.
  const [focusedCandidateId, setFocusedCandidateId] = useState(null);

  // Resume preview candidate object.
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);

  // Targeted job for direct jump to jobs tab.
  const [focusedJobId, setFocusedJobId] = useState(null);

  // Function to refresh pending approvals queue.
  const refreshApprovals = async () => {
    try {
      const pendingList = await approvalApi.getPending();
      // Map pending records to banner format.
      setPendingApprovals(
        (pendingList || []).map((p) => ({
          id: p.id,
          actionType: p.operation_type,
          description: p.reason || `Sensitive operation on ${p.entity_type} #${p.entity_id}`,
          requester: p.requester || 'AI Agent',
        }))
      );
    } catch (err) {
      // Graceful offline fallback for approvals banner.
      console.warn('Approvals API offline:', err.message);
    }
  };

  // Load each workspace collection from SQLite through the local FastAPI service.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest('/candidates'),
      apiRequest('/jobs'),
      apiRequest('/requests'),
      apiRequest('/dashboard'),
      apiRequest('/resumes/discovery'),
      approvalApi.getPending().catch(() => []),
    ])
      .then(([candidateRows, jobRows, requestRows, dashboard, discovery, pendingList]) => {
        if (!mounted) return;
        setCandidates(candidateRows.map(toCandidate));
        setJobs(jobRows.map(toJob));
        setRequests(requestRows.map(toRequest));
        setActivities((dashboard.recent_activity || []).map(toActivity));
        setPendingApprovals(
          (pendingList || []).map((p) => ({
            id: p.id,
            actionType: p.operation_type,
            description: p.reason || `Sensitive operation on ${p.entity_type} #${p.entity_id}`,
            requester: p.requester || 'AI Agent',
          }))
        );
        setApiState({ loading: false, error: '', dashboard, discovery });
      })
      .catch((error) => mounted && setApiState({ loading: false, error: error.message, dashboard: null, discovery: null }));

    return () => {
      mounted = false;
    };
  }, []);

  // Lookup currently focused candidate dynamically from live state.
  const focusedCandidate = candidates.find((c) => c.id === focusedCandidateId) || null;

  // Global keyboard shortcut listener for ⌘K / Ctrl+K to open Glean unified search.
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Check for Cmd+K on Mac or Ctrl+K on Windows.
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Handler to approve a pending sensitive AI operation.
  const handleApproveAction = async (approvalId) => {
    try {
      await approvalApi.approve(approvalId, 'Krishna C. (Recruiter Admin)');
      // Refresh pending queue.
      await refreshApprovals();
      // Also refresh candidates and requests to reflect executed action.
      const candidateRows = await apiRequest('/candidates');
      setCandidates(candidateRows.map(toCandidate));
    } catch (err) {
      console.error('Approval failed:', err.message);
    }
  };

  // Handler to reject a pending sensitive AI operation.
  const handleRejectAction = async (approvalId) => {
    try {
      await approvalApi.reject(approvalId, 'Krishna C. (Recruiter Admin)');
      // Refresh pending queue.
      await refreshApprovals();
    } catch (err) {
      console.error('Rejection failed:', err.message);
    }
  };

  // Handler to update candidate details (stage, interview scheduling, availability).
  const handleUpdateCandidate = async (updatedCandidate, actionNotice) => {
    // Persist only editable recruiter fields before updating the visible state.
    const saved = await apiRequest(`/candidates/${updatedCandidate.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        stage: updatedCandidate.status || updatedCandidate.stage,
        availability: updatedCandidate.availability,
      }),
    });
    // Update candidate in central array.
    setCandidates((prev) =>
      prev.map((c) => (c.id === updatedCandidate.id ? { ...updatedCandidate, ...toCandidate(saved) } : c))
    );

    // If an action notice was provided, append a live event to activities feed.
    if (actionNotice) {
      const newActivity = {
        id: `act-${Date.now()}`,
        type: 'interview',
        title: 'Stage / Schedule Updated',
        description: actionNotice,
        time: 'Just now',
        accent: 'brand',
        actor: 'Krishna C. (Recruiter)',
      };
      setActivities((prev) => [newActivity, ...prev]);
    }
  };

  // Handler to upload a resume file, persist to SQLite, and immediately reflect in candidate list.
  const handleUploadResume = async (file) => {
    // Call candidateApi service to upload file to backend.
    const result = await candidateApi.uploadResume(file);
    // Convert returned candidate payload to frontend model.
    const newCand = toCandidate(result.candidate);
    // Prepend new candidate to active state so it appears at top of candidate table.
    setCandidates((prev) => [newCand, ...prev]);
    // Record activity feed entry for the upload.
    const uploadActivity = {
      id: `act-${Date.now()}`,
      type: 'resume_uploaded',
      title: 'Resume Uploaded & Profile Created',
      description: `Ingested ${file.name} for ${newCand.name}`,
      time: 'Just now',
      accent: 'brand',
      actor: 'Krishna C. (Recruiter)',
    };
    // Append upload activity to recent events.
    setActivities((prev) => [uploadActivity, ...prev]);
    // Return confirmation string.
    return result.message || `Resume ${file.name} successfully uploaded!`;
  };

  // Handler to update a recruitment request (priority, status, recruiter).
  const handleUpdateRequest = async (updatedRequest) => {
    // Store request workflow changes through the validated backend endpoint.
    const saved = await apiRequest(`/requests/${updatedRequest.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        priority: updatedRequest.priority.toLowerCase(),
        status: updatedRequest.status.toLowerCase().replaceAll(' ', '_'),
        assigned_recruiter: updatedRequest.assignedRecruiter,
      }),
    });
    setRequests((prev) =>
      prev.map((r) => (r.id === updatedRequest.id ? toRequest(saved) : r))
    );

    // Add activity log event for request customization.
    const newActivity = {
      id: `act-${Date.now()}`,
      type: 'jd_analyzed',
      title: 'Requisition Priority / Status Updated',
      description: `${updatedRequest.reqNumber} (${updatedRequest.roleTitle}) priority set to ${updatedRequest.priority}, status: ${updatedRequest.status}.`,
      time: 'Just now',
      accent: 'navy',
      actor: 'Krishna C. (Recruiter)',
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  // Handler to update a job description (status, description).
  const handleUpdateJob = async (updatedJob) => {
    // Persist supported job fields before refreshing the corresponding UI item.
    const saved = await apiRequest(`/jobs/${updatedJob.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: updatedJob.status.toLowerCase(),
        description: updatedJob.description,
      }),
    });
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? toJob(saved) : j))
    );
  };

  // Handler to open candidate details modal by candidate ID from any view.
  const handleOpenCandidateModal = (candidateId) => {
    setFocusedCandidateId(candidateId);
  };

  // Handler to jump directly to a job inside Jobs tab.
  const handleJumpToJob = (jobId) => {
    setFocusedJobId(jobId);
    setActiveTab('jobs');
  };

  // Derive topbar title and subtitle dynamically based on active tab.
  const getHeaderMeta = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Workspace Overview',
          subtitle: 'Talent metrics, dynamic pipeline status, and Nemotron AI activity',
        };
      case 'assistant':
        return {
          title: 'AI Recruitment Assistant',
          subtitle: 'Natural language candidate search, tool calling, and grounded QA',
        };
      case 'candidates':
        return {
          title: 'Candidate Directory',
          subtitle: 'Structured talent profiles, customizable hiring stages, and interview scheduler',
        };
      case 'jobs':
        return {
          title: 'Job Descriptions & Sourcing',
          subtitle: 'Evidence-linked requirements, status controls, and candidate ranking',
        };
      case 'requests':
        return {
          title: 'Hiring Requisitions',
          subtitle: 'Active recruitment requests with customizable priorities and recruiter assignments',
        };
      case 'interviews':
        return {
          title: 'Interview Management',
          subtitle: 'Coordinate technical rounds, assign interviewers, and track evaluation status',
        };
      case 'pipeline':
        return {
          title: 'Talent Pipeline Kanban',
          subtitle: 'Visual applicant progression across hiring stages with human-in-the-loop gates',
        };
      case 'matching':
        return {
          title: 'Candidate-to-JD Matching Matrix',
          subtitle: 'Grounded semantic alignment, skills coverage, and verifiable resume citations',
        };
      default:
        return { title: 'CompanyAI Workspace', subtitle: '' };
    }
  };

  // Header meta object.
  const headerMeta = getHeaderMeta();

  // Render application shell.
  return (
    <div className="min-h-screen flex bg-surface-50 text-navy-900 font-sans selection:bg-brand-100 selection:text-brand-700">
      {/* Sticky Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          candidates: candidates.length,
          jobs: jobs.length,
          requests: requests.length,
          interviews: candidates.filter((c) => c.scheduledInterview).length,
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header Bar */}
        <Topbar
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
          onOpenAI={() => setActiveTab('assistant')}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* Human-in-the-Loop Sensitive Action Approval Banner */}
          <ApprovalBanner
            pendingApprovals={pendingApprovals}
            onApprove={handleApproveAction}
            onReject={handleRejectAction}
          />

          {/* Loading Indicator */}
          {apiState.loading && (
            <div className="mb-4 rounded-xl bg-white p-4 text-sm text-slate-600 shadow-subtle border border-slate-200/80">
              Loading CompanyAI 2.0 workspace records…
            </div>
          )}

          {/* Error Notice */}
          {apiState.error && (
            <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-subtle">
              Backend unavailable: {apiState.error}. Start the FastAPI server (uvicorn app.main:app) and refresh.
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <DashboardPage
              candidates={candidates}
              jobs={jobs}
              requests={requests}
              activities={activities}
              dashboard={apiState.dashboard}
              resumeDiscovery={apiState.discovery}
              onNavigateTab={setActiveTab}
              onSelectCandidate={handleOpenCandidateModal}
              onSelectJob={handleJumpToJob}
            />
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'assistant' && (
            <AIAssistantPage
              onSelectCandidate={handleOpenCandidateModal}
            />
          )}

          {/* Candidates Tab */}
          {activeTab === 'candidates' && (
            <CandidatesPage
              candidates={candidates}
              onUpdateCandidate={handleUpdateCandidate}
              onUploadResume={handleUploadResume}
              initialCandidateId={focusedCandidateId}
              onClearInitialCandidate={() => setFocusedCandidateId(null)}
              resumeDiscovery={apiState.discovery}
            />
          )}

          {/* Job Descriptions Tab */}
          {activeTab === 'jobs' && (
            <JobsPage
              jobs={jobs}
              candidates={candidates}
              onUpdateJob={handleUpdateJob}
              onUpdateCandidate={handleUpdateCandidate}
              initialJobId={focusedJobId}
              onSelectCandidateDirect={handleOpenCandidateModal}
            />
          )}

          {/* Recruitment Requests Tab */}
          {activeTab === 'requests' && (
            <RequestsPage
              requests={requests}
              onUpdateRequest={handleUpdateRequest}
              onNavigateJob={handleJumpToJob}
            />
          )}

          {/* Interview Management Tab */}
          {activeTab === 'interviews' && (
            <InterviewsPage
              candidates={candidates}
              onSelectCandidate={handleOpenCandidateModal}
            />
          )}

          {/* Talent Pipeline Kanban Tab */}
          {activeTab === 'pipeline' && (
            <PipelineKanbanPage
              candidates={candidates}
              onUpdateCandidate={handleUpdateCandidate}
              onSelectCandidate={handleOpenCandidateModal}
            />
          )}

          {/* Matching Matrix Tab */}
          {activeTab === 'matching' && (
            <MatchingMatrixPage
              jobs={jobs}
              candidates={candidates}
              onSelectCandidate={handleOpenCandidateModal}
              onScheduleInterview={(item) => handleOpenCandidateModal(item.candidate_id)}
            />
          )}
        </main>
      </div>

      {/* Glean-Style Unified Enterprise Search Modal */}
      <UnifiedSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCandidate={(cand) => {
          handleOpenCandidateModal(cand.id);
          setIsSearchOpen(false);
        }}
        onSelectJob={(job) => {
          handleJumpToJob(job.id);
          setIsSearchOpen(false);
        }}
        onSelectRequest={(req) => {
          setActiveTab('requests');
          setIsSearchOpen(false);
        }}
      />

      {/* Global Candidate Profile Details Modal */}
      <CandidateDetail
        candidate={focusedCandidate}
        isOpen={Boolean(focusedCandidate)}
        onClose={() => setFocusedCandidateId(null)}
        onPreviewResume={(cand) => setPreviewResumeCandidate(cand)}
        onUpdateCandidate={handleUpdateCandidate}
      />

      {/* Global Resume Preview Modal */}
      <ResumePreview
        candidate={previewResumeCandidate}
        isOpen={Boolean(previewResumeCandidate)}
        onClose={() => setPreviewResumeCandidate(null)}
      />
    </div>
  );
}
