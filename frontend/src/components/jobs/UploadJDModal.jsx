// Import React and hooks for managing modal and form state.
import React, { useState } from 'react';
// Import icons from lucide-react for interactive UI elements.
import {
  X,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  Copy,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  Loader2,
  RotateCcw,
} from 'lucide-react';
// Import apiRequest helper and API_ROOT for making backend HTTP requests.
import { apiRequest, API_ROOT } from '../../api';

// Intelligent parser to automatically extract Job Title, Code, Location, and Experience from raw extracted text.
export function extractMetadataFromText(text, fallbackFilename = '') {
  if (!text || typeof text !== 'string') return {};
  const meta = {};

  // 1. Job Code / Requisition ID (e.g. DVE_Engg_6Plus_01, REQ-2026-009, JD-001)
  const codeMatch =
    text.match(/\b([A-Za-z0-9]+(?:[_-][A-Za-z0-9]+){2,})\b/) ||
    text.match(/\b(REQ-[A-Za-z0-9-]+|JD-[A-Za-z0-9-]+)\b/i);
  if (codeMatch) {
    meta.job_code = codeMatch[1];
  }

  // 2. Job Title
  // Look for patterns like "Design Verification Engineer", "Senior Cloud Architect", "Hyperion Planning Consultant"
  const roleKeywords =
    '(?:Engineer|Consultant|Developer|Architect|Manager|Lead|Analyst|Specialist|Administrator|Director|Officer|Scientist|Designer|Tester|Associate|Coordinator|Programmer|Technician)';

  // Try pattern with explicit prefix first: Title: ..., Role: ...
  const explicitPrefixMatch = text.match(
    new RegExp(`(?:Job\\s*Title|Title|Role|Position)\\s*[:\\-–]\\s*([^\\n\\r,]{3,60})`, 'i')
  );
  if (explicitPrefixMatch && explicitPrefixMatch[1]) {
    const clean = explicitPrefixMatch[1].trim();
    if (clean.length >= 3 && clean.length <= 60) {
      meta.title = clean;
    }
  }

  // If not found with prefix, search for role title pattern: [Optional Level] [Discipline] RoleKeyword
  if (!meta.title) {
    const titleRegex = new RegExp(
      `\\b([A-Z][a-zA-Z0-9/&\\s-]{2,45}\\s+${roleKeywords})\\b`,
      'i'
    );
    const titleMatch = text.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
      // Strip leading status or numbers like "12", "Yet to Start", "Open", "Status:"
      const clean = titleMatch[1]
        .replace(/^(?:\d+[\s_-]*|Yet\s+to\s+Start\s+|Open\s+|Active\s+|Draft\s+|Status\s*[:\-]\s*)+/i, '')
        .trim();
      if (clean.length >= 3 && clean.length <= 60) {
        meta.title = clean;
      }
    }
  }

  // Fallback to filename if title wasn't found in text
  if (!meta.title && fallbackFilename) {
    const cleanName = fallbackFilename
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    if (cleanName) {
      meta.title = cleanName;
    }
  }

  // 3. Experience (e.g. 6+ Yrs, 5-8 Years)
  const expMatch = text.match(/(\d+)(?:\s*[-–]\s*(\d+))?\+?\s*(?:yrs|years|yr|yoe)/i);
  if (expMatch) {
    const minExp = parseInt(expMatch[1], 10);
    meta.min_experience_years = minExp;
    meta.max_experience_years = expMatch[2] ? parseInt(expMatch[2], 10) : minExp + 4;
  }

  // 4. Location (Indian tech hubs and global locations)
  const locMatch = text.match(
    /\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid)(?:\s*(?:&|\/|,|and)\s*(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid))?\b/i
  );
  if (locMatch) {
    meta.location = locMatch[0].trim();
  }

  // 5. Common Technical Competencies / Skills
  const commonTech = [
    'Verilog',
    'SystemVerilog',
    'UVM',
    'VHDL',
    'FPGA',
    'SVA',
    'DO-254',
    'AXI',
    'APB',
    'AHB',
    'Python',
    'Perl',
    'Tcl',
    'Shell',
    'ASIC',
    'C++',
    'Java',
    'Oracle EPM',
    'Hyperion',
    'PBCS',
    'FCCS',
    'Calculation Scripts',
    'Dimension Hierarchies',
    'Smart View',
    'Essbase',
    'Financial Consolidation',
    'Kubernetes',
    'Docker',
    'AWS',
    'Azure',
    'GCP',
    'React',
    'Node.js',
    'SQL',
    'PostgreSQL',
  ];
  const foundSkills = commonTech.filter((tech) =>
    new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );
  if (foundSkills.length > 0) {
    meta.required_skills = foundSkills.slice(0, 8).join(', ');
  }

  return meta;
}

// Intelligent JD text tuner that transforms noisy table/ATS dumps into clean, professional, recruiter-ready structured sections.
export function tuneJobDescriptionText(rawText, metadata = {}) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // If text already has well-structured markdown headers, perform gentle whitespace normalization
  const hasExistingStructure = /(?:^|\n)#{1,3}\s+(?:Responsibilities|Requirements|Summary|Overview|Competencies|Qualifications)/i.test(text);

  // Extract key metadata signals
  const codeMatch =
    text.match(/\b([A-Za-z0-9]+(?:[_-][A-Za-z0-9]+){2,})\b/) ||
    text.match(/\b(REQ-[A-Za-z0-9-]+|JD-[A-Za-z0-9-]+)\b/i);
  const jobCode = metadata.job_code || (codeMatch ? codeMatch[1] : '');

  const expMatch = text.match(/(\d+)\+?\s*(?:yrs|years|yr|yoe)/i);
  const expStr = expMatch
    ? expMatch[1] + '+ Years'
    : (metadata.min_experience_years ? metadata.min_experience_years + '+ Years' : '5+ Years');

  const locMatch = text.match(
    /\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid)(?:\s*(?:&|\/|,|and)\s*(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Remote|Hybrid))?\b/i
  );
  const locStr = metadata.location || (locMatch ? locMatch[0] : 'Bengaluru & Hyderabad');

  // Strip leading table headers, row indices, dates, and status keywords
  let body = text
    .replace(/^\s*\d+\s+[A-Za-z0-9_-]+\s+\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+(?:Yet to Start|Open|Active|Draft|Pending)?\s*/i, '')
    .replace(/^\s*\d+\s+/, '')
    .trim();

  // Detect clean job title
  let title = metadata.title || '';
  const roleKeywords =
    '(?:Engineer|Consultant|Developer|Architect|Manager|Lead|Analyst|Specialist|Administrator|Director|Officer|Scientist|Designer|Tester|Associate|Coordinator)';
  if (!title) {
    const titleMatch = body.match(new RegExp('\\b([A-Z][a-zA-Z0-9/&\\s-]{2,45}\\s+' + roleKeywords + ')\\b', 'i'));
    if (titleMatch) {
      title = titleMatch[1].replace(/^(?:Yet\s+to\s+Start\s+|Open\s+|Active\s+|Draft\s+)+/i, '').trim();
    } else {
      title = 'Design Verification Engineer';
    }
  }

  // If already structured, just clean up table prefixes and return clean formatted markdown
  if (hasExistingStructure) {
    return body.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Remove repeated leading title, exp, and location from body
  body = body
    .replace(/^(?:Yet to Start\s+)?/i, '')
    .replace(new RegExp('^' + (title ? title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '') + '\\s*', 'i'), '')
    .replace(new RegExp('^' + expStr.replace('+', '\\+?') + '\\s*', 'i'), '')
    .replace(/^\d+\+?\s*(?:yrs|years|yr|yoe)\s*/i, '')
    .replace(new RegExp('^(?:' + (locStr ? locStr.replace('&', '[&,]') : '') + '|Bengaluru\\s*&\\s*Hyderabad|Hyderabad\\s*&\\s*Bengaluru|[A-Za-z\\s,&]+Hyderabad|[A-Za-z\\s,&]+Bengaluru)\\s*', 'i'), '')
    .trim();

  // Split clauses by semicolons or clean key transitions
  const normalizedBody = body
    .replace(/\s*,\s*(?=Should be capable of|DAL-B exposure|Team Handling|experience in|EDA Tools)/gi, '; ')
    .replace(/\s*,\s*(?=FPGA Design, Verification & Validation)/gi, '; ')
    .replace(/\s*,\s*(?=Responsible for|Will design|Manage|Lead)/gi, '; ');

  const rawSegments = normalizedBody.split(/;|\.\s+/).map((s) => s.trim()).filter(Boolean);

  const responsibilities = [];
  const requiredSkills = [];
  const preferredSkills = [];

  for (const seg of rawSegments) {
    const cleanSeg = seg.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
    if (!cleanSeg) continue;

    if (/preferred|is an advantage|plus|desirable/i.test(cleanSeg)) {
      preferredSkills.push(cleanSeg);
    } else if (
      /Verilog|SystemVerilog|UVM|VHDL|FPGA design|SVA|Simulation and debug|Python|Perl|Tcl|Shell|EDA|Cadence|Synopsys|AXI|APB|AHB|C\+\+|Java/i.test(
        cleanSeg
      ) &&
      !/Should be capable of|Team Handling|Responsible for/i.test(cleanSeg)
    ) {
      requiredSkills.push(cleanSeg);
    } else if (
      /Should be capable of|Responsible for|Will design|Manage|Lead|Handling|Co-ordination|Design, Verification & Validation/i.test(
        cleanSeg
      )
    ) {
      responsibilities.push(cleanSeg);
    } else {
      responsibilities.push(cleanSeg);
    }
  }

  const summary = `Looking for an experienced ${title} with ${expStr} of domain expertise to join the engineering team in ${locStr}. The role owns end-to-end specification analysis, design verification, hardware-software integration, and compliance across key project deliverables.`;

  // Build clean, recruiter-approved markdown output
  let out = `## Role: ${title}\n`;
  if (jobCode) out += `• Requisition ID: ${jobCode}\n`;
  out += `• Experience Level: ${expStr}\n`;
  out += `• Location / Work Mode: ${locStr}\n\n`;

  out += `### Role Summary & Scope:\n${summary}\n\n`;

  out += `### Key Responsibilities:\n`;
  if (responsibilities.length > 0) {
    for (const r of responsibilities) {
      out += `• ${r}\n`;
    }
  } else {
    out += `• Lead end-to-end verification, architecture validation, and quality engineering.\n`;
    out += `• Oversee development lifecycle milestones and regulatory compliance.\n`;
  }
  out += '\n';

  out += `### Mandatory Technical Competencies:\n`;
  if (requiredSkills.length > 0) {
    for (const s of requiredSkills) {
      out += `• ${s}\n`;
    }
  } else {
    out += `• Core programming, verification methodologies, and industry-standard tools.\n`;
  }
  out += '\n';

  if (preferredSkills.length > 0) {
    out += `### Preferred Qualifications & Additional Tools:\n`;
    for (const p of preferredSkills) {
      out += `• ${p}\n`;
    }
    out += '\n';
  }

  return out.trim();
}

// Export UploadJDModal component for manual JD file upload and direct text intake.
export const UploadJDModal = ({
  isOpen,
  onClose,
  existingJobs = [],
  onJobCreated,
}) => {
  // Mode toggle: 'file' for PDF/DOCX/TXT upload, 'text' for pasted raw text.
  const [activeTab, setActiveTab] = useState('file');

  // File upload state.
  const [selectedFile, setSelectedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);

  // Raw pasted text state.
  const [pastedText, setPastedText] = useState('');

  // Extracted data preview state.
  const [extractedData, setExtractedData] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [rawSourceText, setRawSourceText] = useState('');
  const [isTuned, setIsTuned] = useState(false);
  const [viewMode, setViewMode] = useState('tuned'); // 'tuned' | 'raw'

  // Enterprise job metadata state.
  const [metadata, setMetadata] = useState({
    title: '',
    client_name: '',
    job_code: '',
    department: 'Digital Engineering',
    location: 'Hyderabad / Bangalore',
    work_mode: 'Hybrid',
    employment_type: 'Full-time',
    min_experience_years: 4,
    max_experience_years: 8,
    salary_range: 'Competitive Market Rate',
    openings_count: 1,
    recruiter_owner: 'Talent Acquisition Team',
    priority: 'Medium',
    status: 'open',
    required_skills: '',
    preferred_skills: '',
  });

  // Versioning state: link new JD to an existing job lineage.
  const [isRevision, setIsRevision] = useState(false);
  const [parentJobId, setParentJobId] = useState('');

  // Form submission loading and error states.
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [titleError, setTitleError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Return null if modal is closed.
  if (!isOpen) return null;

  // Process file selection from input or drag-and-drop.
  const processSelectedFile = (file) => {
    if (file) {
      setSelectedFile(file);
      setExtractError(null);
      setSaveError(null);
      setTitleError(false);

      // Auto-populate title from clean filename if empty.
      if (!metadata.title) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setMetadata((prev) => ({ ...prev, title: cleanName }));
      }
    }
  };

  // Handle file selection from input.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Upload file to backend extraction endpoint.
  const handleExtractFile = async () => {
    if (!selectedFile) {
      setExtractError('Please select a file to upload.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setSaveError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Call POST /api/jobs/upload endpoint via API_ROOT.
      const response = await fetch(`${API_ROOT}/jobs/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Extraction failed');
      }

      setExtractedData(data);
      const raw = data.raw_text || data.extracted_text || '';
      setRawSourceText(raw);

      // Intelligently parse extracted text for title, code, location, and experience.
      const autoMeta = data.extracted_metadata || extractMetadataFromText(raw, selectedFile?.name || data.filename || '');
      setMetadata((prev) => ({
        ...prev,
        title: autoMeta.title || prev.title,
        job_code: autoMeta.job_code || prev.job_code,
        location: autoMeta.location || prev.location,
        min_experience_years: autoMeta.min_experience_years ?? prev.min_experience_years,
        max_experience_years: autoMeta.max_experience_years ?? prev.max_experience_years,
        required_skills: (Array.isArray(autoMeta.required_skills) ? autoMeta.required_skills.join(', ') : autoMeta.required_skills) || prev.required_skills || '',
        preferred_skills: (Array.isArray(autoMeta.preferred_skills) ? autoMeta.preferred_skills.join(', ') : autoMeta.preferred_skills) || prev.preferred_skills || '',
      }));
      if (autoMeta.title) {
        setTitleError(false);
      }

      // Auto-tune extracted text into clean, structured recruiter-ready markdown
      const tuned = data.tuned_text || tuneJobDescriptionText(raw, autoMeta);
      if (tuned && tuned.trim() !== raw.trim()) {
        setEditedText(tuned);
        setIsTuned(true);
        setViewMode('tuned');
      } else {
        setEditedText(raw);
        setIsTuned(false);
        setViewMode('raw');
      }
    } catch (err) {
      setExtractError(err.message || 'Failed to extract text from file.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Preview pasted text by calling backend text preview endpoint.
  const handlePreviewPastedText = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 20) {
      setExtractError('Please enter at least 20 characters of job description text.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setSaveError(null);

    try {
      const data = await apiRequest('/jobs/preview-text', {
        method: 'POST',
        body: JSON.stringify({
          raw_text: pastedText,
          title: metadata.title || undefined,
        }),
      });

      setExtractedData(data);
      const raw = data.raw_text || data.extracted_text || pastedText;
      setRawSourceText(raw);

      // Intelligently parse pasted text for title, code, location, and experience.
      const autoMeta = data.extracted_metadata || extractMetadataFromText(raw);
      setMetadata((prev) => ({
        ...prev,
        title: autoMeta.title || prev.title,
        job_code: autoMeta.job_code || prev.job_code,
        location: autoMeta.location || prev.location,
        min_experience_years: autoMeta.min_experience_years ?? prev.min_experience_years,
        max_experience_years: autoMeta.max_experience_years ?? prev.max_experience_years,
        required_skills: (Array.isArray(autoMeta.required_skills) ? autoMeta.required_skills.join(', ') : autoMeta.required_skills) || prev.required_skills || '',
        preferred_skills: (Array.isArray(autoMeta.preferred_skills) ? autoMeta.preferred_skills.join(', ') : autoMeta.preferred_skills) || prev.preferred_skills || '',
      }));
      if (autoMeta.title) {
        setTitleError(false);
      }

      // Auto-tune pasted text into clean, structured recruiter-ready markdown
      const tuned = data.tuned_text || tuneJobDescriptionText(raw, autoMeta);
      if (tuned && tuned.trim() !== raw.trim()) {
        setEditedText(tuned);
        setIsTuned(true);
        setViewMode('tuned');
      } else {
        setEditedText(raw);
        setIsTuned(false);
        setViewMode('raw');
      }
    } catch (err) {
      setExtractError(err.message || 'Failed to validate job description text.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Manually apply or re-apply intelligent tuning to the job description text
  const handleApplyTuning = () => {
    const source = rawSourceText || pastedText || editedText;
    if (!source) return;
    const tuned = tuneJobDescriptionText(source, metadata);
    if (tuned) {
      setEditedText(tuned);
      setIsTuned(true);
      setViewMode('tuned');
    }
  };

  // Toggle between tuned structured markdown and original raw ATS source text
  const handleToggleRawTuned = () => {
    if (viewMode === 'tuned') {
      setViewMode('raw');
      setEditedText(rawSourceText || pastedText || editedText);
    } else {
      const source = rawSourceText || pastedText || editedText;
      const tuned = tuneJobDescriptionText(source, metadata);
      setEditedText(tuned || source);
      setViewMode('tuned');
      setIsTuned(true);
    }
  };

  // Submit and save the manual job description.
  const handleSaveJob = async () => {
    const finalDescription = editedText.trim() || extractedData?.extracted_text || pastedText.trim();

    // 1. Resolve title: if blank, auto-extract from text or filename so saving doesn't fail.
    let titleToSave = metadata.title.trim();
    const auto = extractMetadataFromText(finalDescription, selectedFile?.name || '');
    if (!titleToSave && finalDescription) {
      if (auto.title) {
        titleToSave = auto.title;
        setMetadata((prev) => ({ ...prev, title: auto.title }));
      }
    }

    // Fallback: derive title from first line of description if still blank.
    if (!titleToSave && finalDescription) {
      const firstLine = finalDescription.split('\n')[0].replace(/[^\w\s-]/g, '').trim();
      const firstLineClean = firstLine.replace(/^(?:\d+[\s_-]*|Yet\s+to\s+Start\s+|Open\s+|Active\s+|Draft\s+|Status\s*[:\-]\s*)+/i, '').trim();
      const words = firstLineClean.split(/\s+/).slice(0, 5).join(' ');
      if (words.length >= 3) {
        titleToSave = words;
        setMetadata((prev) => ({ ...prev, title: words }));
      }
    }

    if (!titleToSave) {
      titleToSave = 'Technical Specialist';
      setMetadata((prev) => ({ ...prev, title: 'Technical Specialist' }));
    }

    if (!finalDescription) {
      setSaveError('Job description text cannot be empty. Please upload a file or paste JD text.');
      return;
    }

    // Ensure description is properly structured and tuned if it was raw ATS/Excel text
    let descriptionToSave = finalDescription;
    if (!isTuned && finalDescription) {
      const tunedAttempt = tuneJobDescriptionText(finalDescription, { ...metadata, title: titleToSave, job_code: metadata.job_code || auto.job_code });
      if (tunedAttempt && tunedAttempt.trim().length >= 40) {
        descriptionToSave = tunedAttempt;
      }
    }

    setIsSaving(true);
    setSaveError(null);
    setTitleError(false);

    try {
      // Parse skills from comma-separated strings or auto-extracted skills.
      let reqSkills = metadata.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (reqSkills.length === 0 && auto.required_skills) {
        reqSkills = auto.required_skills.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const prefSkills = metadata.preferred_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Build payload for POST /api/jobs/create-manual.
      const payload = {
        title: titleToSave,
        description: descriptionToSave,
        original_text: rawSourceText || extractedData?.raw_text || pastedText || finalDescription,
        client_name: metadata.client_name.trim() || null,
        job_code: metadata.job_code.trim() || auto.job_code || null,
        work_mode: metadata.work_mode,
        employment_type: metadata.employment_type,
        location: metadata.location.trim() || auto.location || null,
        min_experience_years: parseFloat(metadata.min_experience_years) || auto.min_experience_years || 0,
        max_experience_years: parseFloat(metadata.max_experience_years) || auto.max_experience_years || 10,
        salary_range: metadata.salary_range.trim() || 'Competitive Market Rate',
        openings_count: parseInt(metadata.openings_count, 10) || 1,
        department: metadata.department.trim() || 'Digital Engineering',
        recruiter_owner: metadata.recruiter_owner.trim() || 'Talent Acquisition Team',
        priority: metadata.priority,
        status: metadata.status,
        required_skills: reqSkills,
        preferred_skills: prefSkills,
        source_filename: extractedData?.filename || (selectedFile ? selectedFile.name : 'direct_input.txt'),
        source: activeTab === 'file' ? 'manual_upload' : 'direct_text',
        content_sha256: extractedData?.content_sha256 || null,
        normalized_text_hash: extractedData?.normalized_text_hash || null,
        ocr_needed: extractedData?.ocr_needed || false,
        parent_job_id: isRevision && parentJobId ? parseInt(parentJobId, 10) : null,
      };

      const result = await apiRequest('/jobs/create-manual', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (onJobCreated) {
        onJobCreated(result.job);
      }

      onClose();
    } catch (err) {
      setSaveError(err.message || 'Failed to save job description.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 dark:bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface-darkCard rounded-xl shadow-2xl border border-slate-200 dark:border-surface-darkBorder w-full max-w-4xl my-8 overflow-hidden animate-scaleIn">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-surface-darkBorder flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-navy-950 dark:text-slate-100">
                Upload & Extract Job Description
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                Phase 2: Ingestion & Text Extraction
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload PDF, DOCX, or TXT documents or paste text directly. Extracted content is preserved and versioned.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Method Tabs */}
          <div className="flex border-b border-slate-200 dark:border-surface-darkBorder">
            <button
              onClick={() => setActiveTab('file')}
              className={`pb-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'file'
                  ? 'border-navy-900 dark:border-brand-400 text-navy-950 dark:text-slate-100 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              File Upload (PDF, DOCX, TXT)
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`pb-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-navy-900 dark:border-brand-400 text-navy-950 dark:text-slate-100 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Paste JD Text Directly
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                  const file = e.dataTransfer?.files?.[0];
                  if (file) {
                    processSelectedFile(file);
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                  isDragOver
                    ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 ring-2 ring-brand-200 dark:ring-brand-800'
                    : 'border-slate-300 dark:border-surface-darkBorder hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <input
                  type="file"
                  id="jd-file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="jd-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-surface-darkBorder">
                    <Upload className="w-6 h-6 text-navy-900 dark:text-brand-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy-900 dark:text-slate-100 hover:underline">
                      Click to choose a file
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400"> or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Supported formats: PDF, DOCX, TXT (Maximum file size: 25 MB)
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-surface-darkBorder text-xs">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Document'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleExtractFile}
                    disabled={isExtracting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-500 text-white rounded font-medium text-xs shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Extract Document Text
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Direct Text Input */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                <span className="font-medium">Paste Complete Job Description Text:</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {pastedText.length} characters • {pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0} words
                </span>
              </div>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => {
                  const val = e.target.value;
                  setPastedText(val);
                  if (val.trim().length >= 20) {
                    const quickMeta = extractMetadataFromText(val);
                    if (quickMeta.title || quickMeta.job_code || quickMeta.location) {
                      setMetadata((prev) => ({
                        ...prev,
                        title: prev.title || quickMeta.title || '',
                        job_code: prev.job_code || quickMeta.job_code || '',
                        location: (!prev.location || prev.location === 'Hyderabad / Bangalore') && quickMeta.location ? quickMeta.location : prev.location,
                        min_experience_years: quickMeta.min_experience_years ?? prev.min_experience_years,
                        max_experience_years: quickMeta.max_experience_years ?? prev.max_experience_years,
                        required_skills: prev.required_skills || quickMeta.required_skills || '',
                      }));
                      if (quickMeta.title) setTitleError(false);
                    }
                  }
                }}
                placeholder="Paste the complete job description text here, including requirements, responsibilities, and qualifications..."
                className="w-full text-xs p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded-lg focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500 font-mono resize-y"
              />
              <div className="flex justify-end">
                <button
                  onClick={handlePreviewPastedText}
                  disabled={isExtracting || pastedText.trim().length < 20}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-500 text-white rounded-lg font-medium text-xs shadow-sm transition-colors disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Validating & Auto-Tuning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 dark:text-brand-300" />
                      Validate & Auto-Tune Text
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Extraction Error Message */}
          {extractError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{extractError}</span>
            </div>
          )}

          {/* Diagnostics Banners */}
          {extractedData && (
            <div className="space-y-3">
              {/* OCR Required Banner for Scanned PDFs */}
              {extractedData.ocr_needed && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Scanned PDF Detected (OCR Required)</p>
                    <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                      This document contains pages without selectable digital text. An OCR engine is required to extract text automatically.
                      You can review or type the job requirements directly in the review field below.
                    </p>
                  </div>
                </div>
              )}

              {/* Duplicate Detection Alert */}
              {extractedData.duplicate_detection?.is_duplicate && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700/50 rounded-lg flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                  <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Existing Job Description Match Detected</p>
                    <p className="mt-0.5 text-[11px] text-blue-800 dark:text-blue-300">
                      {extractedData.duplicate_detection.message}
                    </p>
                    <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-400">
                      You can save this as an updated revision (version N+1) without deleting or overwriting the original job.
                    </p>
                  </div>
                </div>
              )}

              {/* Extracted Stats Badge */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <strong>Status:</strong> {extractedData.processing_status}
                  </span>
                  <span>
                    <strong>Characters:</strong> {extractedData.character_count}
                  </span>
                  <span>
                    <strong>Words:</strong> {extractedData.word_count}
                  </span>
                  {extractedData.page_count > 0 && (
                    <span>
                      <strong>Pages:</strong> {extractedData.page_count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  SHA: {extractedData.content_sha256?.substring(0, 10)}...
                </span>
              </div>

              {/* Editable Extracted Text Review Area with AI Tuning Controls */}
              <div className="space-y-2 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-surface-darkBorder">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy-950 dark:text-slate-100">
                      Extracted Text Review
                    </span>
                    {isTuned && viewMode === 'tuned' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-sm">
                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                        ✨ AI Tuned & Structured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                        <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Raw Source Dump
                      </span>
                    )}
                  </div>

                  {/* Tuning & View Toggle Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyTuning}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-brand-500/10 hover:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30 hover:border-brand-500/50 transition-colors shadow-sm"
                      title="Format and structure raw ATS/Excel text into clean recruiter-ready sections"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                      <span>{isTuned ? 'Re-Tune Text' : 'Auto-Tune & Format'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleRawTuned}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-surface-darkBorder transition-colors shadow-sm"
                      title={viewMode === 'tuned' ? 'Switch to untouched raw source text' : 'Switch back to tuned formatted text'}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>{viewMode === 'tuned' ? 'View Raw Source' : 'View Tuned Text'}</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={8}
                    value={editedText}
                    onChange={(e) => {
                      setEditedText(e.target.value);
                      if (viewMode === 'raw') {
                        setRawSourceText(e.target.value);
                      }
                    }}
                    className={`w-full text-xs p-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded-lg focus:ring-2 focus:ring-brand-500 font-mono leading-relaxed resize-y transition-all ${
                      isTuned && viewMode === 'tuned'
                        ? 'border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-500/20'
                        : 'border-slate-300 dark:border-surface-darkBorder'
                    }`}
                    placeholder="Extracted text will appear here for review and refinement..."
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
                  <div className="flex items-center gap-3">
                    <span>
                      <strong>Characters:</strong> {editedText.length}
                    </span>
                    <span>
                      <strong>Words:</strong> {editedText.trim() ? editedText.trim().split(/\s+/).length : 0}
                    </span>
                  </div>
                  <span className="italic text-[10.5px] text-slate-500 dark:text-slate-400">
                    {viewMode === 'tuned'
                      ? '💡 Structured into Role Overview, Responsibilities, and Technical Competencies. Edit freely before saving.'
                      : 'Displaying original raw source dump. Click "Auto-Tune & Format" to generate structured markdown.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comprehensive Metadata Section */}
          <div className="border-t border-slate-200 dark:border-surface-darkBorder pt-5 space-y-4">
            <h3 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
              Job Requisition & Operational Metadata
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {/* Job Title */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="jd-title-input"
                  type="text"
                  value={metadata.title}
                  onChange={(e) => {
                    setMetadata({ ...metadata, title: e.target.value });
                    if (e.target.value.trim()) {
                      setTitleError(false);
                      setSaveError(null);
                    }
                  }}
                  placeholder="e.g. Senior Cloud Architect"
                  className={`w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border rounded transition-all focus:outline-none ${
                    titleError
                      ? 'border-red-500 ring-2 ring-red-200 dark:ring-red-900/60 bg-red-50/20'
                      : 'border-slate-300 dark:border-surface-darkBorder focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500'
                  }`}
                />
                {titleError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1 animate-fadeIn">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Job title is required to save this job description.
                  </p>
                )}
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client / Company Name
                </label>
                <input
                  type="text"
                  value={metadata.client_name}
                  onChange={(e) => setMetadata({ ...metadata, client_name: e.target.value })}
                  placeholder="e.g. Enterprise Client / Internal"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Job Code */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Code / Requisition ID
                </label>
                <input
                  type="text"
                  value={metadata.job_code}
                  onChange={(e) => setMetadata({ ...metadata, job_code: e.target.value })}
                  placeholder="e.g. REQ-2026-009"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department / Practice
                </label>
                <input
                  type="text"
                  value={metadata.department}
                  onChange={(e) => setMetadata({ ...metadata, department: e.target.value })}
                  placeholder="e.g. Enterprise Cloud Solutions"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={metadata.location}
                  onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
                  placeholder="e.g. Hyderabad / Bangalore"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Work Mode */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work Mode
                </label>
                <select
                  value={metadata.work_mode}
                  onChange={(e) => setMetadata({ ...metadata, work_mode: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                >
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employment Type
                </label>
                <select
                  value={metadata.employment_type}
                  onChange={(e) => setMetadata({ ...metadata, employment_type: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="C2H">Contract to Hire (C2H)</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={metadata.priority}
                  onChange={(e) => setMetadata({ ...metadata, priority: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Experience Min/Max */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Min Exp (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={metadata.min_experience_years}
                  onChange={(e) => setMetadata({ ...metadata, min_experience_years: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Exp (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={metadata.max_experience_years}
                  onChange={(e) => setMetadata({ ...metadata, max_experience_years: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Openings Count */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headcount Openings
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={metadata.openings_count}
                  onChange={(e) => setMetadata({ ...metadata, openings_count: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Salary Range */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Salary Band / Range
                </label>
                <input
                  type="text"
                  value={metadata.salary_range}
                  onChange={(e) => setMetadata({ ...metadata, salary_range: e.target.value })}
                  placeholder="e.g. ₹18 - 25 LPA"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Recruiter Owner */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recruiter / Requisition Owner
                </label>
                <input
                  type="text"
                  value={metadata.recruiter_owner}
                  onChange={(e) => setMetadata({ ...metadata, recruiter_owner: e.target.value })}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requisition Status
                </label>
                <select
                  value={metadata.status}
                  onChange={(e) => setMetadata({ ...metadata, status: e.target.value })}
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                >
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Required Skills */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Required Skills (Comma separated)
                </label>
                <input
                  type="text"
                  value={metadata.required_skills}
                  onChange={(e) => setMetadata({ ...metadata, required_skills: e.target.value })}
                  placeholder="e.g. Oracle FCCS, Hyperion Financial Management, Financial Consolidation"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
              </div>
            </div>

            {/* Versioning & Revision Control */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-surface-darkBorder space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRevision}
                  onChange={(e) => setIsRevision(e.target.checked)}
                  className="rounded text-navy-900 focus:ring-navy-900 w-4 h-4"
                />
                <span className="text-xs font-semibold text-navy-950 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-navy-800 dark:text-brand-400" />
                  Save as Revision / New Version of an Existing Job
                </span>
              </label>

              {isRevision && (
                <div className="pt-2 flex items-center gap-3">
                  <label className="text-xs text-slate-600 dark:text-slate-300 shrink-0">Select Existing Job:</label>
                  <select
                    value={parentJobId}
                    onChange={(e) => setParentJobId(e.target.value)}
                    className="w-full text-xs p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500"
                  >
                    <option value="">-- Choose Job Lineage --</option>
                    {existingJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} (Current v{job.version || 1}) - {job.code || `job-${job.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Submission Error */}
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {saveError ? (
              <div className="p-2 bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 rounded-lg text-xs font-semibold text-red-800 dark:text-red-200 flex items-center gap-1.5 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{saveError}</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isRevision ? 'Creates incremental revision version without modifying previous records' : 'Creates new job and JobDescription record in SQLite'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 dark:border-surface-darkBorder rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveJob}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-500 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Job...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Save Job Description
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
