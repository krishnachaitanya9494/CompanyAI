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
} from 'lucide-react';
// Import apiRequest helper for making backend HTTP requests.
import { apiRequest } from '../../api';

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

  // Return null if modal is closed.
  if (!isOpen) return null;

  // Handle file selection from file input.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractError(null);
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

  // Upload file to backend extraction endpoint.
  const handleExtractFile = async () => {
    if (!selectedFile) {
      setExtractError('Please select a file to upload.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Call POST /api/jobs/upload endpoint.
      const response = await fetch('http://127.0.0.1:8000/api/jobs/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Extraction failed');
      }

      setExtractedData(data);
      setEditedText(data.extracted_text || '');
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

    try {
      const data = await apiRequest('/jobs/preview-text', {
        method: 'POST',
        body: JSON.stringify({
          raw_text: pastedText,
          title: metadata.title || undefined,
        }),
      });

      setExtractedData(data);
      setEditedText(data.extracted_text || pastedText);
    } catch (err) {
      setExtractError(err.message || 'Failed to validate job description text.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Submit and save the manual job description.
  const handleSaveJob = async () => {
    // Validate title and description.
    if (!metadata.title.trim()) {
      setSaveError('Job title is required.');
      return;
    }

    const finalDescription = editedText.trim() || extractedData?.extracted_text || pastedText.trim();
    if (!finalDescription) {
      setSaveError('Job description text cannot be empty.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Parse skills from comma-separated strings.
      const reqSkills = metadata.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const prefSkills = metadata.preferred_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Build payload for POST /api/jobs/create-manual.
      const payload = {
        title: metadata.title.trim(),
        description: finalDescription,
        original_text: extractedData?.extracted_text || pastedText,
        client_name: metadata.client_name.trim() || null,
        job_code: metadata.job_code.trim() || null,
        work_mode: metadata.work_mode,
        employment_type: metadata.employment_type,
        location: metadata.location.trim() || null,
        min_experience_years: parseFloat(metadata.min_experience_years) || 0,
        max_experience_years: parseFloat(metadata.max_experience_years) || 10,
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
              <div className="border-2 border-dashed border-slate-300 dark:border-surface-darkBorder rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-500 transition-colors bg-slate-50/50 dark:bg-slate-800/40">
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
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste the complete job description text here, including requirements, responsibilities, and qualifications..."
                className="w-full text-xs p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded-lg focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500 font-mono resize-y"
              />
              <div className="flex justify-end">
                <button
                  onClick={handlePreviewPastedText}
                  disabled={isExtracting || pastedText.trim().length < 20}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-500 text-white rounded font-medium text-xs shadow-sm transition-colors disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Validate & Preview Text
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

              {/* Editable Extracted Text Review Area */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Extracted Text Review (Edit & Fine-tune before saving):
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Recruiter-approved text will be preserved separately from raw source text
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full text-xs p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded-lg focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500 font-mono resize-y"
                  placeholder="Extracted text will appear here for review and refinement..."
                />
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
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  placeholder="e.g. Senior Cloud Architect"
                  className="w-full p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-300 dark:border-surface-darkBorder rounded focus:ring-1 focus:ring-navy-900 dark:focus:ring-brand-500 focus:border-navy-900 dark:focus:border-brand-500"
                />
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
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-surface-darkBorder flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isRevision ? 'Creates incremental revision version without modifying previous records' : 'Creates new job and JobDescription record in SQLite'}
          </p>
          <div className="flex items-center gap-2">
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
