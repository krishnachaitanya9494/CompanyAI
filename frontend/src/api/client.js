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

  // Retrieve candidate full resume text and contact highlights.
  getResumeText: (id) => apiRequest(`/candidates/${id}/resume-text`),

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

  // Retrieve ranked matching candidates for job using semantic search.
  getMatches: (id) => apiRequest(`/jobs/${id}/matches`),
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
  // Send message to Nemotron AI agent with tool execution.
  chat: (query, sessionId = 'web-session') =>
    apiRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query, session_id: sessionId }),
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

  // Retrieve all approval audit logs.
  getAll: () => apiRequest('/approvals/all'),

  // Propose a sensitive operation.
  propose: (payload) =>
    apiRequest('/approvals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Approve and execute operation.
  approve: (id, approver = 'Recruiter Admin') =>
    apiRequest(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approver }),
    }),

  // Reject operation.
  reject: (id, approver = 'Recruiter Admin') =>
    apiRequest(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ approver }),
    }),
};
