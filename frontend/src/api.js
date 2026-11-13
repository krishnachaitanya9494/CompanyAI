// Keep every browser request pointed at the local FastAPI service.
const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:8000/api';

// Decode JSON responses and turn backend validation messages into readable UI errors.
export async function apiRequest(path, options = {}) {
  const { timeoutMs = 12000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Send only caller-provided headers and JSON content types when a body exists.
    const response = await fetch(`${API_ROOT}${path}`, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...fetchOptions.headers,
      },
    });
    // Parse a response body only when the server returned content.
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    // Stop callers from treating HTTP failures as successful data.
    if (!response.ok) throw new Error(body?.detail || `Request failed (${response.status})`);
    // Return the decoded endpoint response to the caller.
    return body;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out (${path})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Adapt persisted candidate fields to the existing presentation components' property names.
export function toCandidate(row) {
  // Aggregate all skills from either skills array or combined primary/secondary skills.
  const allSkills = row.skills && row.skills.length > 0
    ? row.skills
    : (row.primarySkills ? [...row.primarySkills, ...(row.secondarySkills || [])] : []);
  // Derive primary skills prioritizing first 4 stored elements without fabricating missing skills.
  const primarySkills = row.primarySkills && row.primarySkills.length > 0
    ? row.primarySkills
    : (allSkills.length > 0 ? allSkills.slice(0, 4) : []);
  // Derive secondary tools and technologies from remaining skills.
  const secondarySkills = row.secondarySkills && row.secondarySkills.length > 0
    ? row.secondarySkills
    : (allSkills.length > 4 ? allSkills.slice(4) : []);
  // Extract clean role from stored currentRole or summary headline without inventing generic titles.
  const roleTitle = row.currentRole || (row.summary ? row.summary.split('\n')[0].split(' with ')[0].replace(/^Senior\s+/, '') : 'Candidate Profile');

  // Return formatted candidate object preserving true database values or explicit missing states.
  return {
    id: row.id,
    numeric_id: row.numeric_id || row.id,
    code: row.code || `cand-${row.id}`,
    name: row.name || 'Candidate',
    email: row.email || '',
    phone: row.phone || '',
    currentRole: roleTitle,
    // Keep null when experience years are unavailable rather than fabricating 5.0 years.
    experienceYears: row.experienceYears ?? row.experience_years ?? null,
    // Keep empty string when location is not extracted rather than defaulting to India.
    location: row.location || '',
    // Keep empty string when availability is unknown rather than defaulting to Immediate.
    availability: row.availability || '',
    status: row.status || row.stage || 'New',
    // Preserve authentic evaluated match score or remain null when candidate is not evaluated for a job.
    matchScore: row.matchScore != null ? Math.round(row.matchScore) : (row.match_score != null ? Math.round(row.match_score) : null),
    skills: allSkills,
    primarySkills: primarySkills,
    secondarySkills: secondarySkills,
    summary: row.summary || '',
    // Leave resumeFilename empty when no file row exists instead of inventing resume.pdf.
    resumeFilename: row.resumeFilename || '',
    evidenceHighlights: row.evidenceHighlights || [],
    componentScores: row.componentScores || row.component_scores || null,
    classification: row.classification || null,
    requirements: row.requirements || [],
    explanations: row.explanations || null,
    winningResumeId: row.winningResumeId || row.resume_id || null,
    winningResumeFilename: row.winningResumeFilename || row.resumeFilename || '',
    employmentHistory: row.employmentHistory || [],
    education: row.education || null,
    scheduledInterview: row.scheduledInterview || null,
    // Keep exact resume count returned by backend bulk query.
    resumeCount: row.resumeCount ?? row.resume_count ?? (row.resumeFilename ? 1 : 0),
  };
}

// Adapt real job rows to the current job list and detail component contract with Phase 2 metadata.
export function toJob(row) {
  // Preserve stored requirements, provenance arrays, versioning, and document lineage without fabricated placeholders.
  return {
    id: row.id,
    numeric_id: row.numeric_id || row.id,
    code: row.code || `job-${row.id}`,
    jdCode: row.jdCode || `JOB-${row.id}`,
    title: row.title || 'Untitled Role',
    // Keep empty clientName when unlinked instead of defaulting to Enterprise Client.
    clientName: row.clientName || '',
    jobCode: row.jobCode || `REQ-${row.id}`,
    workMode: row.workMode || '',
    employmentType: row.employmentType || '',
    // Avoid fabricating salary ranges when none are stored on the Job record.
    salaryRange: row.salaryRange || '',
    openingsCount: row.openingsCount || 1,
    recruiterOwner: row.recruiterOwner || '',
    priority: row.priority || 'Medium',
    source: row.source || 'manual_upload',
    version: row.version || 1,
    jobDescriptionId: row.jobDescriptionId,
    ocrNeeded: Boolean(row.ocrNeeded),
    department: row.department || '',
    location: row.location || '',
    experienceRequired: row.experienceRequired || (row.min_experience_years == null ? 'Not specified' : `${row.min_experience_years}+ Years`),
    minYears: row.minYears ?? row.min_experience_years,
    maxYears: row.maxYears ?? row.max_experience_years,
    status: row.status || 'Active',
    requiredSkills: row.requiredSkills || row.required_skills || [],
    preferredSkills: row.preferredSkills || row.preferred_skills || [],
    // Preserve JD-synced skill provenance arrays for Workspace and Semantic Match UI separation.
    syncedMandatorySkills: row.syncedMandatorySkills || row.synced_mandatory_skills || [],
    syncedPreferredSkills: row.syncedPreferredSkills || row.synced_preferred_skills || [],
    segmentationApproved: Boolean(row.segmentationApproved),
    description: row.description || '',
    sourceFilename: row.sourceFilename || '',
    matchedCandidateIds: row.matchedCandidateIds || [],
    analysis: row.analysis || null,
  };
}

// Adapt persisted requisition data to the existing request display component contract.
export function toRequest(row) {
  // Null-guard priority and status formatting before capitalizing labels.
  const rawPriority = row.priority || 'Medium';
  const rawStatus = row.status || 'Open';
  // Keep recruiter fields as stored and preserve real integer jobNumericId alongside jobId slug.
  return {
    id: row.id,
    reqNumber: row.reqNumber || row.req_number,
    roleTitle: row.roleTitle || row.role_title,
    jobId: row.jobId || row.job_id || null,
    jobNumericId: row.jobNumericId ?? row.job_id ?? null,
    department: row.department || '',
    hiringManager: row.hiringManager || row.hiring_manager || '',
    assignedRecruiter: row.assignedRecruiter || row.assigned_recruiter || '',
    priority: rawPriority[0].toUpperCase() + rawPriority.slice(1),
    status: rawStatus.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    targetPositions: row.targetPositions ?? row.target_positions ?? 1,
    filledPositions: row.filledPositions ?? row.filled_positions ?? 0,
    createdAt: row.createdAt || row.created_at || '',
    slaDeadline: row.slaDeadline || row.sla_deadline || '',
    location: row.location || '',
    notes: row.notes || '',
  };
}

// Normalize dashboard events to the existing activity card property names.
export function toActivity(row) {
  // Use the backend's safe fixed summary rather than deriving a mock narrative.
  return { id: row.id, type: row.event_type, title: row.summary, description: row.summary, time: new Date(row.created_at).toLocaleString(), accent: 'brand', actor: 'CompanyAI' };
}
