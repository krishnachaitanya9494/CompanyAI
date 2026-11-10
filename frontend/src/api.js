// Keep every browser request pointed at the local FastAPI service.
const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:8000/api';

// Decode JSON responses and turn backend validation messages into readable UI errors.
export async function apiRequest(path, options = {}) {
  // Send only caller-provided headers and JSON content types when a body exists.
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  // Parse a response body only when the server returned content.
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  // Stop callers from treating HTTP failures as successful data.
  if (!response.ok) throw new Error(body?.detail || `Request failed (${response.status})`);
  // Return the decoded endpoint response to the caller.
  return body;
}

// Adapt persisted candidate fields to the existing presentation components' property names.
export function toCandidate(row) {
  // Aggregate all skills from either skills array or combined primary/secondary skills.
  const allSkills = row.skills && row.skills.length > 0
    ? row.skills
    : (row.primarySkills ? [...row.primarySkills, ...(row.secondarySkills || [])] : []);
  // Derive primary skills prioritizing first 4 elements.
  const primarySkills = row.primarySkills && row.primarySkills.length > 0
    ? row.primarySkills
    : (allSkills.length > 0 ? allSkills.slice(0, 4) : ['Technical Delivery', 'Problem Solving']);
  // Derive secondary tools and technologies from remaining skills.
  const secondarySkills = row.secondarySkills && row.secondarySkills.length > 0
    ? row.secondarySkills
    : (allSkills.length > 4 ? allSkills.slice(4) : []);
  // Extract clean role from row currentRole or summary header.
  const roleTitle = row.currentRole || (row.summary ? row.summary.split('\n')[0].split(' with ')[0].replace(/^Senior\s+/, '') : 'Software Professional');

  // Return formatted candidate object ensuring no empty fields.
  return {
    id: row.id,
    numeric_id: row.numeric_id || row.id,
    code: row.code || `cand-${row.id}`,
    name: row.name || 'Candidate',
    email: row.email || '',
    phone: row.phone || '',
    currentRole: roleTitle,
    experienceYears: row.experienceYears ?? row.experience_years ?? 5.0,
    location: row.location || 'India',
    availability: row.availability || 'Immediate',
    status: row.status || row.stage || 'Screened',
    matchScore: row.matchScore ?? 92,
    skills: allSkills,
    primarySkills: primarySkills,
    secondarySkills: secondarySkills,
    summary: row.summary || '',
    resumeFilename: row.resumeFilename || 'resume.pdf',
    evidenceHighlights: row.evidenceHighlights || [],
    employmentHistory: row.employmentHistory || [],
    education: row.education || null,
    scheduledInterview: row.scheduledInterview || null,
    resumeCount: row.resume_count || (row.resumeFilename ? 1 : 0),
  };
}

// Adapt real job rows to the current job list and detail component contract.
export function toJob(row) {
  // Preserve stored requirements and avoid fabricated analysis or match snapshots.
  return { id: row.id, jdCode: `JOB-${row.id}`, title: row.title, department: '', location: row.location || '', experienceRequired: row.min_experience_years == null ? 'Not specified' : `${row.min_experience_years}+ Years`, minYears: row.min_experience_years, maxYears: row.max_experience_years, status: row.status, requiredSkills: row.required_skills || [], preferredSkills: row.preferred_skills || [], description: row.description, matchedCandidateIds: [], analysis: null };
}

// Adapt persisted requisition data to the existing request display component contract.
export function toRequest(row) {
  // Keep recruiter fields as stored and use the database key for linked jobs.
  return { id: row.id, reqNumber: row.req_number, roleTitle: row.role_title, jobId: row.job_id, department: row.department || '', hiringManager: row.hiring_manager || '', assignedRecruiter: row.assigned_recruiter || '', priority: row.priority[0].toUpperCase() + row.priority.slice(1), status: row.status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), targetPositions: row.target_positions, filledPositions: row.filled_positions, createdAt: row.created_at, slaDeadline: row.sla_deadline, location: row.location || '', notes: row.notes || '' };
}

// Normalize dashboard events to the existing activity card property names.
export function toActivity(row) {
  // Use the backend's safe fixed summary rather than deriving a mock narrative.
  return { id: row.id, type: row.event_type, title: row.summary, description: row.summary, time: new Date(row.created_at).toLocaleString(), accent: 'brand', actor: 'CompanyAI' };
}
