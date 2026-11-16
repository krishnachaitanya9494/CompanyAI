// Import React and hooks for routing, lazy code-splitting, and state management.
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';

// Import core layout shell components eagerly so initial shell paints immediately.
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ApprovalBanner } from './components/common/ApprovalBanner';
import { PageTransition } from './components/common/PageTransition';
import { LatticeLoader } from './components/reactbits/LatticeLoader';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Lazy-load page modules cleanly so initial bundle stays compact while preserving named exports.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage').then((m) => ({ default: m.AIAssistantPage })));
const CandidatesPage = lazy(() => import('./pages/CandidatesPage').then((m) => ({ default: m.CandidatesPage })));
const JobsPage = lazy(() => import('./pages/JobsPage').then((m) => ({ default: m.JobsPage })));
const RequestsPage = lazy(() => import('./pages/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage').then((m) => ({ default: m.InterviewsPage })));
const PipelineKanbanPage = lazy(() => import('./pages/PipelineKanbanPage').then((m) => ({ default: m.PipelineKanbanPage })));
const MatchingMatrixPage = lazy(() => import('./pages/MatchingMatrixPage').then((m) => ({ default: m.MatchingMatrixPage })));
const JDResumeComparisonPage = lazy(() => import('./pages/JDResumeComparisonPage').then((m) => ({ default: m.JDResumeComparisonPage })));
const TalentPoolPage = lazy(() => import('./pages/TalentPoolPage').then((m) => ({ default: m.TalentPoolPage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const PlacementsPage = lazy(() => import('./pages/PlacementsPage').then((m) => ({ default: m.PlacementsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const IntelligenceGraphPage = lazy(() => import('./pages/IntelligenceGraphPage').then((m) => ({ default: m.IntelligenceGraphPage })));
const MarketIntelligencePage = lazy(() => import('./pages/MarketIntelligencePage').then((m) => ({ default: m.MarketIntelligencePage })));
const SupplyDemandPage = lazy(() => import('./pages/SupplyDemandPage').then((m) => ({ default: m.SupplyDemandPage })));
const StrategicSourcingPage = lazy(() => import('./pages/StrategicSourcingPage').then((m) => ({ default: m.StrategicSourcingPage })));
const HiringDifficultyPage = lazy(() => import('./pages/HiringDifficultyPage').then((m) => ({ default: m.HiringDifficultyPage })));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })));
const AgentActivityPage = lazy(() => import('./pages/AgentActivityPage').then((m) => ({ default: m.AgentActivityPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

// Lazy-load heavy global inspection/search modals until opened.
const UnifiedSearchModal = lazy(() =>
  import('./components/layout/UnifiedSearchModal').then((m) => ({ default: m.UnifiedSearchModal }))
);
const CandidateDetail = lazy(() =>
  import('./components/candidates/CandidateDetail').then((m) => ({ default: m.CandidateDetail }))
);
const ResumePreview = lazy(() =>
  import('./components/candidates/ResumePreview').then((m) => ({ default: m.ResumePreview }))
);
const UploadJDModal = lazy(() =>
  import('./components/jobs/UploadJDModal').then((m) => ({ default: m.UploadJDModal }))
);

// Feature gate: Talent Intelligence (Phase 1 & Phase 2) is currently blocked/hidden while keeping all files intact.
const ENABLE_TALENT_INTELLIGENCE = false;

// Valid workspace tab keys shared with URL ?tab= synchronization and browser history.
const VALID_TABS = new Set([
  'dashboard', 'assistant', 'candidates', 'jobs', 'requests',
  'interviews', 'pipeline', 'matching', 'comparison', 'jd_resume_compare', 'talent_pool', 'clients',
  'placements', 'analytics', 'approvals', 'agent_activity', 'notifications', 'settings',
  ...(ENABLE_TALENT_INTELLIGENCE
    ? ['intelligence_graph', 'market_intelligence', 'supply_demand', 'strategic_sourcing', 'hiring_difficulty']
    : []),
]);

// Import local API access and adapters for persisted recruitment records.
import { apiRequest, toActivity, toCandidate, toJob, toRequest } from './api';

// Import API client services for candidate uploads and approval governance.
import { approvalApi, candidateApi } from './api/client';

// Export App root component managing application views, state, and interactive customizations.
export default function App() {
  // Active navigation tab state, supporting optional ?tab= URL parameter for direct linking & refresh persistence.
  const [activeTab, setActiveTabState] = useState(() => {
    const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    return urlTab && VALID_TABS.has(urlTab) ? urlTab : 'dashboard';
  });

  // Update active tab cleanly while synchronizing ?tab= URL query state for browser back/forward & refresh.
  const setActiveTab = useCallback((nextTab) => {
    if (!VALID_TABS.has(nextTab)) return;
    setActiveTabState(nextTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== nextTab) {
        url.searchParams.set('tab', nextTab);
        window.history.pushState({ tab: nextTab }, '', url.toString());
      }
    }
  }, []);

  // Listen to browser Back/Forward navigation events cleanly.
  useEffect(() => {
    const handlePopState = () => {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      setActiveTabState(urlTab && VALID_TABS.has(urlTab) ? urlTab : 'dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Theme state persisted in localStorage ('light' or 'dark'), with URL param override support.
  const [theme, setTheme] = useState(() => {
    // Check URL query parameters for explicit theme override (useful for testing and previews).
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const paramTheme = urlParams ? urlParams.get('theme') : null;
    if (paramTheme === 'dark' || paramTheme === 'light') return paramTheme;
    // Read persisted theme from localStorage or default to light.
    return localStorage.getItem('companyai-theme') || 'light';
  });

  // Track sidebar collapse state, defaulting to collapsed on mobile viewports (< 768px).
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Check initial window width to adapt responsive drawer state.
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  // Sync theme changes with document root element for Tailwind class-based dark mode.
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Persist choice in browser localStorage.
    localStorage.setItem('companyai-theme', theme);
  }, [theme]);

  // Display density state ('comfortable' default or 'compact'), persisted in localStorage.
  const [density, setDensity] = useState(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const paramDensity = urlParams ? urlParams.get('density') : null;
    if (paramDensity === 'compact' || paramDensity === 'comfortable') return paramDensity;
    return localStorage.getItem('companyai-density') || 'comfortable';
  });

  // Apply display density immediately via root data attribute and persist in localStorage.
  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('companyai-density', density);
  }, [density]);

  // Handler to toggle between light and dark themes.
  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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

  // Control visibility of global Upload Job Description modal accessible from any page.
  const [isUploadJDModalOpen, setIsUploadJDModalOpen] = useState(false);

  // Track real API loading and failure states instead of presenting mock content.
  const [apiState, setApiState] = useState({ loading: true, error: '', dashboard: null, discovery: null });

  // Targeted candidate ID for direct inspection across pages.
  const [focusedCandidateId, setFocusedCandidateId] = useState(null);

  // Resume preview candidate object.
  const [previewResumeCandidate, setPreviewResumeCandidate] = useState(null);

  // Targeted job for direct jump to jobs tab.
  const [focusedJobId, setFocusedJobId] = useState(null);

  // Normalize both numeric IDs and padded string slugs (e.g., 'cand-001' or 'job-004') to integer IDs.
  const parseNumericId = (rawId) => {
    if (typeof rawId === 'number' && !Number.isNaN(rawId)) return rawId;
    if (typeof rawId !== 'string') return rawId;
    const stripped = rawId.replace(/^(cand|job|req)-/i, '').replace(/^0+/, '') || '0';
    const parsed = Number.parseInt(stripped, 10);
    return Number.isNaN(parsed) ? rawId : parsed;
  };

  // Function to refresh pending approvals queue.
  const refreshApprovals = async () => {
    try {
      const pendingList = await approvalApi.getPending();
      // Map enriched backend approval schema fields into UI banner format.
      setPendingApprovals(
        (pendingList || []).map((p) => ({
          id: p.id,
          actionType: p.actionType || p.operation_type || 'governance_review',
          description: p.description || p.reason || `Approval requested (#${p.id})`,
          requester: p.requester || 'AI Agent',
        }))
      );
    } catch (err) {
      // Graceful offline fallback for approvals banner.
      console.warn('Approvals API offline:', err.message);
    }
  };

  // Central function to fetch all workspace collections from the FastAPI backend progressively.
  const fetchWorkspaceData = async () => {
    setApiState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      // Launch all 6 queries in parallel, but unblock UI as soon as core dashboard/jobs/requests resolve.
      const candidatesPromise = apiRequest('/candidates').then((rows) => {
        setCandidates((rows || []).map(toCandidate));
        return rows;
      });
      const discoveryPromise = apiRequest('/resumes/discovery').then((disc) => {
        setApiState((prev) => ({ ...prev, discovery: disc }));
        return disc;
      });

      const [jobRes, reqRes, dashRes, pendingRes] = await Promise.allSettled([
        apiRequest('/jobs'),
        apiRequest('/requests'),
        apiRequest('/dashboard'),
        approvalApi.getPending(),
      ]);

      if (jobRes.status === 'fulfilled') setJobs((jobRes.value || []).map(toJob));
      if (reqRes.status === 'fulfilled') setRequests((reqRes.value || []).map(toRequest));
      const dashboard = dashRes.status === 'fulfilled' ? dashRes.value : null;
      if (dashboard) {
        setActivities((dashboard.recent_activity || []).map(toActivity));
      }
      if (pendingRes.status === 'fulfilled') {
        setPendingApprovals(
          (pendingRes.value || []).map((p) => ({
            id: p.id,
            actionType: p.actionType || p.operation_type || 'governance_review',
            description: p.description || p.reason || `Approval requested (#${p.id})`,
            requester: p.requester || 'AI Agent',
          }))
        );
      }

      // Clear loading banner immediately once core workspace data is ready.
      const firstError = [jobRes, reqRes, dashRes].find((r) => r.status === 'rejected')?.reason?.message || '';
      setApiState((prev) => ({ ...prev, loading: false, error: firstError, dashboard }));

      // Let heavier candidate & resume discovery payloads settle without blocking initial paint.
      await Promise.allSettled([candidatesPromise, discoveryPromise]);
    } catch (error) {
      setApiState({ loading: false, error: error.message, dashboard: null, discovery: null });
    }
  };

  // Load each workspace collection on initial mount.
  useEffect(() => {
    fetchWorkspaceData();
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

  // Handler to approve a pending sensitive AI operation with optional reviewer role and comment.
  const handleApproveAction = async (approvalId, comment = '', approver = 'Krishna C. (Recruiter Admin)', reviewerRole = 'Recruiter Admin') => {
    // Execute approval transition via backend API and refresh dependent tables.
    await approvalApi.approve(approvalId, approver, reviewerRole, comment);
    await Promise.all([refreshApprovals(), fetchWorkspaceData()]);
  };

  // Handler to reject a pending sensitive AI operation with optional reviewer comment.
  const handleRejectAction = async (approvalId, comment = '', approver = 'Krishna C. (Recruiter Admin)', reviewerRole = 'Recruiter Admin') => {
    // Execute rejection transition via backend API and refresh pending banner.
    await approvalApi.reject(approvalId, approver, reviewerRole, comment);
    await refreshApprovals();
  };

  // Handler to request revisions on a pending approval item without executing or rejecting.
  const handleRequestChangesAction = async (approvalId, comment = '', approver = 'Krishna C. (Recruiter Admin)', reviewerRole = 'Recruiter Admin') => {
    // Persist changes_requested transition and keep audit history synchronized.
    await approvalApi.requestChanges(approvalId, approver, reviewerRole, comment);
    await refreshApprovals();
  };

  // Handler to update candidate details (stage, interview scheduling, availability).
  const handleUpdateCandidate = async (updatedCandidate, actionNotice) => {
    // Allow internal state sync callers (e.g., interview creation endpoint) to skip duplicate PATCH calls.
    let saved = updatedCandidate;
    if (!updatedCandidate._skipPatch) {
      saved = await apiRequest(`/candidates/${updatedCandidate.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: updatedCandidate.status || updatedCandidate.stage,
          availability: updatedCandidate.availability,
        }),
      });
    }
    // Clean temporary flag before storing candidate inside React state.
    const { _skipPatch, ...cleanUpdated } = updatedCandidate;
    setCandidates((prev) =>
      prev.map((c) => (c.id === updatedCandidate.id ? { ...cleanUpdated, ...toCandidate(saved) } : c))
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

  // Handler to create a new recruitment requisition through the FastAPI backend.
  const handleCreateRequest = async (payload) => {
    // Persist new requisition and reload live list so table IDs and formatting match SQLite rows.
    await requestApi.create(payload);
    const requestRows = await apiRequest('/requests');
    setRequests(requestRows.map(toRequest));
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        type: 'requisition_created',
        title: 'Requisition Created',
        description: `Created hiring requisition for ${payload.role_title}.`,
        time: 'Just now',
        accent: 'navy',
        actor: 'Krishna C. (Recruiter)',
      },
      ...prev,
    ]);
  };

  // Handler to update a recruitment request (priority, status, recruiter, and notes).
  const handleUpdateRequest = async (updatedRequest) => {
    // Persist recruiter customization including notes through the validated PATCH endpoint.
    const saved = await apiRequest(`/requests/${updatedRequest.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        priority: (updatedRequest.priority || 'Medium').toLowerCase(),
        status: (updatedRequest.status || 'Open').toLowerCase().replaceAll(' ', '_'),
        assigned_recruiter: updatedRequest.assignedRecruiter,
        notes: updatedRequest.notes,
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

  // Handler to refresh jobs list when a new job is created via manual upload or revision.
  const handleJobCreated = (newJob) => {
    // Format new job using toJob and prepend to state.
    const formatted = toJob(newJob);
    setJobs((prev) => [formatted, ...prev]);
    // Create activity event in local state.
    const newActivity = {
      id: `act-${Date.now()}`,
      type: 'job_created',
      title: 'Job Description Ingested',
      description: `${formatted.title} (${formatted.jobCode || formatted.code}) v${formatted.version} added to workspace.`,
      time: 'Just now',
      accent: 'navy',
      actor: formatted.recruiterOwner || 'Talent Acquisition',
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  // Handler to open candidate details modal by numeric or slug candidate ID from any view.
  const handleOpenCandidateModal = (candidateId) => {
    // Normalize string IDs like cand-001 to match numeric SQLite candidate IDs in state.
    setFocusedCandidateId(parseNumericId(candidateId));
  };

  // Handler to jump directly to a job inside Jobs tab using numeric or slug job ID.
  const handleJumpToJob = (jobId) => {
    // Normalize string IDs like job-004 so JobsPage selects the intended job cleanly.
    setFocusedJobId(parseNumericId(jobId));
    setActiveTab('jobs');
  };

  // Handler to navigate directly to JD & Resume Comparison with pre-selected job and/or candidate.
  const handleNavigateToComparison = (jobId = null, candidateId = null) => {
    if (jobId) setFocusedJobId(parseNumericId(jobId));
    if (candidateId) setFocusedCandidateId(parseNumericId(candidateId));
    setActiveTab('comparison');
  };

  // Derive topbar title and subtitle dynamically based on active tab.
  const getHeaderMeta = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          // Explicit dashboard title matching enterprise ATS requirements.
          title: 'Dashboard',
          subtitle: 'Talent metrics, dynamic pipeline status, and Nemotron AI activity',
        };
      case 'assistant':
        return {
          title: 'Nemotron AI Recruitment Assistant',
          subtitle: 'Natural language candidate search, tool calling, and grounded JD matching QA',
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
      case 'talent_pool':
        return {
          title: 'Talent Pool & Rediscovery',
          subtitle: 'Semantic candidate search across indexed resumes, skill facets, and curated bench collections',
        };
      case 'clients':
        return {
          title: 'Enterprise Client Accounts',
          subtitle: 'Grounded client accounts, linked job requisitions, and pipeline submissions',
        };
      case 'placements':
        return {
          title: 'Placements & Formal Offers',
          subtitle: 'Track formal offer approvals, onboarding readiness, and late-stage finalist progressions',
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
          title: 'Semantic Candidate-to-JD Matching Matrix',
          subtitle: 'Grounded semantic alignment, skills coverage, and verifiable resume citations',
        };
      case 'comparison':
      case 'jd_resume_compare':
        return {
          title: 'JD & Resume Intelligence Comparison',
          subtitle: 'Side-by-side semantic alignment, requirement verification, gap analysis, and tailored interview kit',
        };
      case 'intelligence_graph':
        return {
          title: 'Recruitment Intelligence Graph',
          subtitle: 'Interactive candidate, skill, job, client, and interview network with verified provenance',
        };
      case 'market_intelligence':
        return {
          title: 'Internal Talent Market Intelligence',
          subtitle: 'Skill distributions, technology categories, experience, locations, and co-occurrence insights',
        };
      case 'supply_demand':
        return {
          title: 'Talent Supply & Demand Intelligence',
          subtitle: 'Unique internal candidate supply compared against open requisition skill and headcount demand',
        };
      case 'strategic_sourcing':
        return {
          title: 'Strategic Sourcing Intelligence',
          subtitle: 'Advisory sourcing strategies, adjacent-skill alternatives, and underutilized internal talent',
        };
      case 'hiring_difficulty':
        return {
          title: 'Hiring Difficulty Predictor',
          subtitle: 'Evidence-based heuristic assessment of requisition fill difficulty and contributing factors',
        };
      case 'analytics':
        return {
          title: 'Recruitment Analytics & Reports',
          subtitle: 'Pipeline conversion metrics, vector embedding coverage, and CSV talent export',
        };
      case 'approvals':
        return {
          title: 'Governance & Action Approvals',
          subtitle: 'Human-in-the-Loop review queue and immutable SQLite audit log',
        };
      case 'agent_activity':
        return {
          title: 'AI Agent Observability & Traces',
          subtitle: 'Real-time Nemotron tool execution steps, latency metrics, and audit traces',
        };
      case 'notifications':
        return {
          title: 'Notifications & Activity Timeline',
          subtitle: 'Chronological audit trail of SQLite recruitment activity and governance alerts',
        };
      case 'settings':
        return {
          title: 'Workspace Settings & Telemetry',
          subtitle: 'Theme appearance, Nemotron vector engine status, and SQLite database health',
        };
      default:
        return { title: 'CompanyAI Workspace', subtitle: '' };
    }
  };

  // Header meta object.
  const headerMeta = getHeaderMeta();

  // Render application shell with hybrid enterprise SaaS styling and responsive layout.
  return (
    <div
      className={`h-screen flex overflow-hidden ${
        theme === 'dark' ? 'dark bg-surface-darkCanvas text-slate-100' : 'bg-surface-50 text-navy-900'
      } font-sans selection:bg-brand-100 selection:text-brand-700 transition-colors duration-200`}
    >
      {/* Sticky Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          candidates: candidates.length,
          jobs: jobs.length,
          requests: requests.length,
          interviews: candidates.filter((c) => c.scheduledInterview).length,
          pendingApprovals: pendingApprovals.length,
          resumes: apiState.discovery?.total_resumes || 240,
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Sticky Top Header Bar */}
        <Topbar
          title={headerMeta.title}
          subtitle={headerMeta.subtitle}
          onOpenAI={() => setActiveTab('assistant')}
          onOpenSearch={() => setIsSearchOpen(true)}
          onUploadJD={() => setIsUploadJDModalOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          pendingApprovalsCount={pendingApprovals.length}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Scrollable Page Body */}
        <main
          className={`flex-1 min-h-0 ${
            activeTab === 'jobs'
              ? 'overflow-y-auto lg:overflow-hidden p-3 sm:p-4 lg:p-6 flex flex-col'
              : 'overflow-y-auto p-4 sm:p-6 md:p-8'
          } ${
            theme === 'dark' ? 'bg-surface-darkCanvas' : 'bg-surface-50'
          } transition-colors`}
        >
          {/* Human-in-the-Loop Sensitive Action Approval Banner */}
          <ApprovalBanner
            pendingApprovals={pendingApprovals}
            onApprove={handleApproveAction}
            onReject={handleRejectAction}
          />

          {/* Loading Indicator using React Bits LatticeLoader */}
          {apiState.loading && (
            <div className="mb-4 rounded-xl bg-white dark:bg-surface-darkCard p-4 text-sm text-slate-600 dark:text-slate-300 shadow-subtle border border-slate-200/80 dark:border-surface-darkBorder flex items-center justify-between">
              <LatticeLoader
                label="Loading CompanyAI 2.0 workspace records"
                pattern="orbit"
                grid={3}
                color="#059669"
                cellSize={5}
                fontSize={13}
                showTimer
              />
            </div>
          )}

          {/* Error Notice (pinned above sticky page headers so it is never covered) */}
          {apiState.error && (
            <div
              role="alert"
              className="sticky top-16 z-30 mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/95 dark:bg-red-950/90 backdrop-blur-md px-4 py-3 text-sm text-red-700 dark:text-red-200 shadow-card flex flex-wrap items-center justify-between gap-3"
            >
              <span>
                <strong>Backend unavailable:</strong> {apiState.error}. Start the FastAPI server (<code>uvicorn app.main:app</code>) and retry.
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={fetchWorkspaceData}
                  className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setApiState((prev) => ({ ...prev, error: '' }))}
                  className="px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/60 hover:bg-red-200 dark:hover:bg-red-900 text-red-800 dark:text-red-200 text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Subtle PageTransition + Suspense boundary keying on activeTab */}
          <PageTransition transitionKey={activeTab} className={activeTab === 'jobs' ? 'flex-1 min-h-0 flex flex-col' : ''}>
            <ErrorBoundary title="Workspace Tab Error" message="A problem occurred while loading this workspace view. You can retry or switch tabs.">
              <Suspense
                fallback={
                  <div className="p-8 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder flex items-center justify-center shadow-subtle">
                    <LatticeLoader label="Loading workspace module" pattern="orbit" grid={3} color="#059669" cellSize={5} fontSize={12} />
                  </div>
                }
              >
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
              onRefresh={fetchWorkspaceData}
              isLoading={apiState.loading}
            />
          )}

          {/* Talent Intelligence routes (blocked when ENABLE_TALENT_INTELLIGENCE is false) */}
          {ENABLE_TALENT_INTELLIGENCE && activeTab === 'intelligence_graph' && (
            <IntelligenceGraphPage
              onSelectCandidate={handleOpenCandidateModal}
              onSelectJob={handleJumpToJob}
            />
          )}

          {ENABLE_TALENT_INTELLIGENCE && activeTab === 'market_intelligence' && <MarketIntelligencePage />}

          {ENABLE_TALENT_INTELLIGENCE && activeTab === 'supply_demand' && <SupplyDemandPage />}

          {ENABLE_TALENT_INTELLIGENCE && activeTab === 'strategic_sourcing' && (
            <StrategicSourcingPage
              jobs={jobs}
              onSelectCandidate={handleOpenCandidateModal}
            />
          )}

          {ENABLE_TALENT_INTELLIGENCE && activeTab === 'hiring_difficulty' && <HiringDifficultyPage />}

          {/* Nemotron AI Assistant Tab */}
          {activeTab === 'assistant' && (
            <AIAssistantPage
              jobs={jobs}
              candidates={candidates}
              requests={requests}
              onSelectCandidate={handleOpenCandidateModal}
              onSelectJob={handleJumpToJob}
            />
          )}

          {/* Candidates Tab */}
          {activeTab === 'candidates' && (
            <CandidatesPage
              candidates={candidates}
              jobs={jobs}
              onUpdateCandidate={handleUpdateCandidate}
              onUploadResume={handleUploadResume}
              initialCandidateId={focusedCandidateId}
              onClearInitialCandidate={() => setFocusedCandidateId(null)}
              resumeDiscovery={apiState.discovery}
              onNavigateToComparison={handleNavigateToComparison}
            />
          )}

          {/* Job Descriptions Tab */}
          {activeTab === 'jobs' && (
            <JobsPage
              jobs={jobs}
              candidates={candidates}
              onUpdateJob={handleUpdateJob}
              onUpdateCandidate={handleUpdateCandidate}
              onCreateJob={handleJobCreated}
              onRefreshApprovals={refreshApprovals}
              initialJobId={focusedJobId}
              onSelectCandidateDirect={handleOpenCandidateModal}
              onNavigateToComparison={handleNavigateToComparison}
              onNavigateToMatrix={(job) => {
                // Set focused job ID for matrix workspace.
                setFocusedJobId(job?.id || null);
                // Switch navigation to matching matrix tab.
                setActiveTab('matching');
              }}
            />
          )}

          {/* Recruitment Requests Tab */}
          {activeTab === 'requests' && (
            <RequestsPage
              requests={requests}
              jobs={jobs}
              onCreateRequest={handleCreateRequest}
              onUpdateRequest={handleUpdateRequest}
              onRefreshApprovals={refreshApprovals}
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
              onRefreshApprovals={refreshApprovals}
              onSelectCandidate={handleOpenCandidateModal}
            />
          )}

          {/* Matching Matrix Tab */}
          {activeTab === 'matching' && (
            <MatchingMatrixPage
              jobs={jobs}
              candidates={candidates}
              initialJobId={focusedJobId}
              onSelectCandidate={handleOpenCandidateModal}
              onUpdateCandidateStage={handleUpdateCandidate}
              onRefreshApprovals={refreshApprovals}
              onScheduleInterview={(item) => handleOpenCandidateModal(item.candidate_id)}
              onNavigateToComparison={handleNavigateToComparison}
            />
          )}

          {/* JD & Resume Intelligence Comparison Tab */}
          {(activeTab === 'comparison' || activeTab === 'jd_resume_compare') && (
            <JDResumeComparisonPage
              jobs={jobs}
              candidates={candidates}
              initialJobId={focusedJobId}
              initialCandidateId={focusedCandidateId}
              onSelectCandidate={handleOpenCandidateModal}
              onSelectJob={handleJumpToJob}
              onUpdateCandidateStage={handleUpdateCandidate}
            />
          )}

          {/* Talent Pool Rediscovery Tab */}
          {activeTab === 'talent_pool' && (
            <TalentPoolPage
              candidates={candidates}
              jobs={jobs}
              onSelectCandidate={handleOpenCandidateModal}
              onNavigateToMatching={(jobId) => {
                setFocusedJobId(jobId || null);
                setActiveTab('matching');
              }}
            />
          )}

          {/* Enterprise Client Accounts Tab */}
          {activeTab === 'clients' && (
            <ClientsPage
              jobs={jobs}
              requests={requests}
              candidates={candidates}
              onSelectJob={handleJumpToJob}
            />
          )}

          {/* Placements & Formal Offers Tab */}
          {activeTab === 'placements' && (
            <PlacementsPage
              candidates={candidates}
              jobs={jobs}
              onSelectCandidate={handleOpenCandidateModal}
              onUpdateCandidate={handleUpdateCandidate}
            />
          )}

          {/* Analytics & Reporting Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsPage
              candidates={candidates}
              jobs={jobs}
              requests={requests}
              resumeDiscovery={apiState.discovery}
            />
          )}

          {/* Governance & Action Approvals Tab */}
          {activeTab === 'approvals' && (
            <ApprovalsPage
              onApproveAction={handleApproveAction}
              onRejectAction={handleRejectAction}
              onRequestChangesAction={handleRequestChangesAction}
              onNavigateCandidate={handleOpenCandidateModal}
              onNavigateJob={handleJumpToJob}
            />
          )}

          {/* Agent Activity Observability Tab */}
          {activeTab === 'agent_activity' && <AgentActivityPage />}

          {/* Notifications & Activity Timeline Tab */}
          {activeTab === 'notifications' && (
            <NotificationsPage
              pendingApprovals={pendingApprovals}
              onNavigateTab={setActiveTab}
              onSelectCandidate={handleOpenCandidateModal}
              onSelectJob={handleJumpToJob}
            />
          )}

          {/* Settings & Administration Tab */}
          {activeTab === 'settings' && (
            <SettingsPage
              theme={theme}
              onToggleTheme={handleToggleTheme}
              density={density}
              onChangeDensity={setDensity}
              resumeDiscovery={apiState.discovery}
            />
          )}
              </Suspense>
            </ErrorBoundary>
          </PageTransition>
        </main>
      </div>

      {/* Lazy-loaded global modals */}
      <Suspense fallback={null}>
        {/* Glean-Style Unified Enterprise Search Modal */}
        {isSearchOpen && (
          <UnifiedSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectCandidate={(cand) => {
              // Pass integer primary key when returned so modal opens candidate profile directly.
              handleOpenCandidateModal(cand.numeric_id || cand.id);
              setIsSearchOpen(false);
            }}
            onSelectJob={(job) => {
              // Pass integer primary key when returned so Jobs tab resolves target role.
              handleJumpToJob(job.numeric_id || job.id);
              setIsSearchOpen(false);
            }}
            onSelectRequest={(req) => {
              setActiveTab('requests');
              setIsSearchOpen(false);
            }}
          />
        )}

        {/* Global Candidate Profile Details Modal */}
        {focusedCandidate && (
          <CandidateDetail
            candidate={focusedCandidate}
            isOpen={Boolean(focusedCandidate)}
            onClose={() => setFocusedCandidateId(null)}
            onPreviewResume={(cand) => setPreviewResumeCandidate(cand)}
            onUpdateCandidate={handleUpdateCandidate}
            onRefreshApprovals={refreshApprovals}
          />
        )}

        {/* Global Resume Preview Modal */}
        {previewResumeCandidate && (
          <ResumePreview
            candidate={previewResumeCandidate}
            isOpen={Boolean(previewResumeCandidate)}
            onClose={() => setPreviewResumeCandidate(null)}
          />
        )}

        {/* Global Upload Job Description Modal accessible from Topbar on every page */}
        {isUploadJDModalOpen && (
          <UploadJDModal
            isOpen={isUploadJDModalOpen}
            onClose={() => setIsUploadJDModalOpen(false)}
            existingJobs={jobs}
            onJobCreated={(newJob) => {
              fetchWorkspaceData();
              if (newJob?.id) {
                setFocusedJobId(newJob.id);
              }
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
