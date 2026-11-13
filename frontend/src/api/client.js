// API base URL defaulting to local FastAPI development server port 8000 on IPv4 loopback.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

/**
 * Generic fetch wrapper with timeout, JSON parsing, and graceful error handling.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`API request to ${url} failed:`, error.message);
    throw error;
  }
}

/**
 * Candidate API service.
 */
export const candidateApi = {
  // Retrieve all candidates with optional query filters.
  getAll: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.location) searchParams.append('location', params.location);
    if (params.availability) searchParams.append('availability', params.availability);
    if (params.skill) searchParams.append('skill', params.skill);
    if (params.stage) searchParams.append('stage', params.stage);
    const qs = searchParams.toString();
    return apiRequest(`/candidates${qs ? `?${qs}` : ''}`);
  },

  // Retrieve candidate detail facts by ID.
  getById: (id) => apiRequest(`/candidates/${id}`),

  // Update candidate stage or availability.
  update: (id, payload) =>
    apiRequest(`/candidates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Schedule an interview round for candidate.
  scheduleInterview: (id, payload) =>
    apiRequest(`/candidates/${id}/interviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Retrieve all persisted interviews across candidates from SQLite.
  getInterviews: () => apiRequest('/candidates/interviews/all'),

  // Retrieve candidate full resume text and contact highlights, optionally targeting a specific resume version.
  getResumeText: (id, resumeId = null) => {
    // Append resume_id query parameter when viewing a multi-version or winning match resume.
    const qs = resumeId != null ? `?resume_id=${encodeURIComponent(resumeId)}` : '';
    return apiRequest(`/candidates/${id}/resume-text${qs}`);
  },

  // Build direct download URL for a persisted source resume document.
  getDownloadUrl: (resumeId) => `${API_BASE_URL}/resumes/${encodeURIComponent(resumeId)}/download`,

  // Upload a resume file, parse candidate facts, and persist to SQLite.
  uploadResume: async (file) => {
    // Construct standard multipart form data payload.
    const formData = new FormData();
    // Attach uploaded file binary.
    formData.append('file', file);
    // Send POST request directly without Content-Type header so browser sets multipart boundary.
    const response = await fetch(`${API_BASE_URL}/candidates/upload-resume`, {
      method: 'POST',
      body: formData,
    });
    // Validate response status.
    if (!response.ok) {
      // Parse validation error details if present.
      const err = await response.json().catch(() => ({}));
      // Throw descriptive error.
      throw new Error(err.detail || `Upload failed: ${response.statusText}`);
    }
    // Return parsed json candidate object.
    return await response.json();
  },
};

/**
 * Job Descriptions API service.
 */
export const jobApi = {
  // Retrieve all job descriptions.
  getAll: (status) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiRequest(`/jobs${qs}`);
  },

  // Retrieve single job detail.
  getById: (id) => apiRequest(`/jobs/${id}`),

  // Update job status or description.
  update: (id, payload) =>
    apiRequest(`/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Trigger Nemotron analysis on job description.
  analyze: (id) =>
    apiRequest(`/jobs/${id}/analyze`, {
      method: 'POST',
    }),

  // Retrieve ranked matching candidates for job using Phase 5C matching engine with optional filters and format.
  getMatches: (id, params = {}) => {
    // Construct search query parameters.
    const searchParams = new URLSearchParams();
    // Append parameters if specified.
    if (params.min_experience != null) searchParams.append('min_experience', params.min_experience);
    if (params.max_experience != null) searchParams.append('max_experience', params.max_experience);
    if (params.location) searchParams.append('location', params.location);
    if (params.availability) searchParams.append('availability', params.availability);
    if (params.stage) searchParams.append('stage', params.stage);
    if (params.min_score != null) searchParams.append('min_score', params.min_score);
    if (params.search) searchParams.append('search', params.search);
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    if (params.page != null) searchParams.append('page', params.page);
    if (params.limit != null) searchParams.append('limit', params.limit);
    if (params.as_object) searchParams.append('as_object', 'true');
    // Format query string.
    const qs = searchParams.toString();
    // Send request to matches endpoint.
    return apiRequest(`/jobs/${id}/matches${qs ? `?${qs}` : ''}`);
  },

  // Retrieve aggregate match KPI metrics and tier distributions for job.
  getMatchSummary: (id) => apiRequest(`/jobs/${id}/matches/summary`),

  // Compare multiple candidates side-by-side against job requirements.
  compareCandidates: (id, candidateIds) =>
    apiRequest(`/jobs/${id}/compare-candidates`, {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds }),
    }),

  // Retrieve candidate pool filter options (locations, stages, experience range).
  getMatchFilters: (id) => apiRequest(`/jobs/${id}/match-filters`),

  // Retrieve JD segmentation details for a job.
  getSegmentation: (id) => apiRequest(`/jobs/${id}/segmentation`),

  // Retrieve 2048-dim JD vector embedding readiness and status.
  getEmbeddingStatus: (id) => apiRequest(`/jobs/${id}/embeddings/status`),

  // Generate 2048-dim vectors for the active approved JD segmentation.
  generateEmbeddings: (id, payload = {}) =>
    apiRequest(`/jobs/${id}/embeddings/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/**
 * Recruitment Requests API service.
 */
export const requestApi = {
  // Retrieve all requests.
  getAll: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.priority) searchParams.append('priority', params.priority);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return apiRequest(`/requests${qs ? `?${qs}` : ''}`);
  },

  // Retrieve single request.
  getById: (id) => apiRequest(`/requests/${id}`),

  // Create new recruitment request.
  create: (payload) =>
    apiRequest('/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Update request priority, status, or recruiter.
  update: (id, payload) =>
    apiRequest(`/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

/**
 * Analytics API service.
 */
export const analyticsApi = {
  // Retrieve dashboard KPIs, dynamic pipeline stages, and activities.
  getDashboard: () => apiRequest('/analytics/dashboard'),

  // Retrieve comprehensive audit log of recruitment activity events.
  getActivities: (params = {}) => {
    // Construct query parameters for entity or event type filters.
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.entity_type) searchParams.append('entity_type', params.entity_type);
    if (params.entity_id) searchParams.append('entity_id', params.entity_id);
    if (params.event_type) searchParams.append('event_type', params.event_type);
    const qs = searchParams.toString();
    return apiRequest(`/analytics/activities${qs ? `?${qs}` : ''}`);
  },

  // Retrieve extended recruitment telemetry, pipeline distribution, and AI health status.
  getStats: () => apiRequest('/analytics/stats'),

  // Retrieve full filtered analytics datasets for enterprise visualizations.
  getIntelligence: (params = {}) => {
    // Construct optional lookback window, job, client, and stage query params.
    const searchParams = new URLSearchParams();
    if (params.days != null && params.days !== 'all') searchParams.append('days', params.days);
    if (params.job_id != null && params.job_id !== '') searchParams.append('job_id', params.job_id);
    if (params.client && params.client !== 'All') searchParams.append('client', params.client);
    if (params.stage && params.stage !== 'All') searchParams.append('stage', params.stage);
    const qs = searchParams.toString();
    return apiRequest(`/analytics/intelligence${qs ? `?${qs}` : ''}`);
  },
};

/**
 * Unified Search API service.
 */
export const searchApi = {
  // Execute unified natural language search.
  search: (query, limit = 10) =>
    apiRequest(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};

/**
 * AI Agent & Observability API service.
 */
export const agentApi = {
  // Send message to Nemotron AI agent along with active UI page context.
  chat: (query, sessionId = 'web-session', context = null) =>
    apiRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query, session_id: sessionId, ...(context ? { context } : {}) }),
    }),

  // Retrieve Langfuse-style execution traces.
  getTraces: (limit = 10) => apiRequest(`/ai/traces?limit=${limit}`),
};

/**
 * Human Approval API service.
 */
export const approvalApi = {
  // Retrieve pending approvals awaiting human confirmation.
  getPending: () => apiRequest('/approvals/pending'),

  // Retrieve all approval audit logs with optional status, action_type, or requester filters.
  getAll: (params = {}) => {
    // Encode query parameters only when non-empty values are supplied.
    const searchParams = new URLSearchParams();
    if (params.status && params.status !== 'All') searchParams.append('status', params.status);
    if (params.action_type && params.action_type !== 'All') searchParams.append('action_type', params.action_type);
    if (params.requester) searchParams.append('requester', params.requester);
    const qs = searchParams.toString();
    return apiRequest(`/approvals/all${qs ? `?${qs}` : ''}`);
  },

  // Retrieve full enriched context for one approval item.
  getById: (id) => apiRequest(`/approvals/${id}`),

  // Propose a sensitive operation.
  propose: (payload) =>
    apiRequest('/approvals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Approve and execute operation with optional role and reviewer comment.
  approve: (id, approver = 'Recruiter Admin', reviewerRole = 'recruiter_admin', comment = '') =>
    apiRequest(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approver, reviewer_role: reviewerRole, comment }),
    }),

  // Reject operation with mandatory or optional rationale comment.
  reject: (id, approver = 'Recruiter Admin', reviewerRole = 'recruiter_admin', comment = '') =>
    apiRequest(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ approver, reviewer_role: reviewerRole, comment }),
    }),

  // Request revisions on a pending approval item without executing or rejecting.
  requestChanges: (id, approver = 'Recruiter Admin', reviewerRole = 'recruiter_admin', comment = '') =>
    apiRequest(`/approvals/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ approver, reviewer_role: reviewerRole, comment }),
    }),
};

/**
 * Phase 1 Core Talent Intelligence API service.
 */
export const intelligenceApi = {
  normalizeSkills: (skills = []) =>
    apiRequest(`/intelligence/skills/normalize?skills=${encodeURIComponent(skills.join(','))}`),
  getDigitalTwin: (candidateId) =>
    apiRequest(`/intelligence/candidates/${candidateId}/digital-twin`),
  getResumeEvolution: (candidateId) =>
    apiRequest(`/intelligence/candidates/${candidateId}/resume-evolution`),
  getPotentialMobility: (candidateId) =>
    apiRequest(`/intelligence/candidates/${candidateId}/potential-mobility`),
  getCandidateNetwork: (candidateId, limit = 12) =>
    apiRequest(`/intelligence/candidates/${candidateId}/network?limit=${limit}`),
  getGraph: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.skill) sp.append('skill', params.skill);
    if (params.client) sp.append('client', params.client);
    if (params.candidate_id) sp.append('candidate_id', String(params.candidate_id));
    if (params.job_id) sp.append('job_id', String(params.job_id));
    if (params.limit_candidates) sp.append('limit_candidates', String(params.limit_candidates));
    const qs = sp.toString();
    return apiRequest(`/intelligence/graph${qs ? `?${qs}` : ''}`);
  },
  // Phase 2A: Internal Talent Market Intelligence
  getMarketOverview: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.skill) sp.append('skill', params.skill);
    if (params.category) sp.append('category', params.category);
    if (params.experience_band) sp.append('experience_band', params.experience_band);
    if (params.location) sp.append('location', params.location);
    if (params.availability) sp.append('availability', params.availability);
    const qs = sp.toString();
    return apiRequest(`/intelligence/market/overview${qs ? `?${qs}` : ''}`);
  },
  getMarketSkillCombinations: (minCooccurrence = 2, limit = 20) =>
    apiRequest(`/intelligence/market/skill-combinations?min_cooccurrence=${minCooccurrence}&limit=${limit}`),
  // Phase 2B: Talent Supply & Demand Intelligence
  getSupplyDemandOverview: () => apiRequest('/intelligence/supply-demand/overview'),
  getSupplyDemandSkills: (params = {}) => {
    const sp = new URLSearchParams();
    if (params.classification) sp.append('classification', params.classification);
    if (params.category) sp.append('category', params.category);
    if (params.limit) sp.append('limit', String(params.limit));
    const qs = sp.toString();
    return apiRequest(`/intelligence/supply-demand/skills${qs ? `?${qs}` : ''}`);
  },
  getSupplyDemandShortages: () => apiRequest('/intelligence/supply-demand/shortages'),
  getJobSupplyDemand: (jobId) => apiRequest(`/intelligence/supply-demand/jobs/${jobId}`),
  // Phase 2C: Strategic Sourcing Intelligence
  getJobSourcingRecommendations: (jobId) =>
    apiRequest(`/intelligence/sourcing/jobs/${jobId}/recommendations`),
  getJobSourcingAlternatives: (jobId) =>
    apiRequest(`/intelligence/sourcing/jobs/${jobId}/alternatives`),
  getCandidateSourcingOpportunities: (limit = 25) =>
    apiRequest(`/intelligence/sourcing/candidate-opportunities?limit=${limit}`),
  // Phase 2D: Hiring Difficulty Predictor (Evidence-Based Heuristic)
  getHiringDifficultyOverview: (includeClosed = false) =>
    apiRequest(`/intelligence/hiring-difficulty/overview?include_closed=${includeClosed}`),
  getJobHiringDifficulty: (jobId) =>
    apiRequest(`/intelligence/hiring-difficulty/jobs/${jobId}`),
};

/**
 * AI Intelligence & Model Administration API client.
 */
export const aiApi = {
  // Retrieve AI models, 2048-dim verification, vector coverage, and cache status
  getHealth: () => apiRequest('/ai/health'),

  // Execute live embedding generation test
  testEmbedding: (text = 'Recruitment test') =>
    apiRequest('/ai/test-embedding', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // Execute live chat completion test
  testChat: (prompt = 'CompanyAI Diagnostic') =>
    apiRequest('/ai/test-chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  // Natural language recruitment Q&A grounded in retrieved candidates and JDs
  ragQuery: (question, jobId = null, topK = 5) =>
    apiRequest('/ai/rag/query', {
      method: 'POST',
      body: JSON.stringify({ question, job_id: jobId, top_k: topK }),
    }),

  // Discover similar candidates by vector cosine proximity
  getSimilarCandidates: (candidateId, limit = 5) =>
    apiRequest(`/ai/similar-candidates/${candidateId}?limit=${limit}`),

  // Discover similar jobs by full JD vector embeddings
  getSimilarJobs: (jobId, limit = 5) =>
    apiRequest(`/ai/similar-jobs/${jobId}?limit=${limit}`),

  // Trigger batch re-indexing of missing or selected records
  reindex: (batchSize = 20, force = false) =>
    apiRequest('/ai/reindex', {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, force }),
    }),
};
