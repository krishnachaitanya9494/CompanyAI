// Import React and hooks for managing state and effects in the workspace.
import React, { useState, useEffect, useRef } from 'react';
// Import icons including Cpu and Users for embedding readiness & direct matching navigation.
import {
  X,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Layers,
  Edit2,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Check,
  Search,
  FileText,
  Quote,
  Sliders,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Eye,
  CheckSquare,
  HelpCircle,
  Clock,
  Filter,
  ExternalLink,
  History,
  Cpu,
  Users,
} from 'lucide-react';
// Import apiRequest and jobApi embedding helpers.
import { apiRequest } from '../../api';
import { jobApi } from '../../api/client';

// Export enhanced JDSegmentationWorkspace component presenting interactive 15-category requirement review.
export const JDSegmentationWorkspace = ({
  job,
  isOpen,
  onClose,
  onSegmentationUpdated,
  onNavigateToMatrix,
}) => {
  // Segmentation data retrieved from backend.
  const [segmentation, setSegmentation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResegmenting, setIsResegmenting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filter criteria: category, classification/review status, provenance source, and requirement text search.
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [provenanceFilter, setProvenanceFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');

  // Track deleted persisted numeric requirement IDs so PUT /segmentation removes them cleanly from SQLite.
  const [deletedIds, setDeletedIds] = useState([]);

  // Track 2048-dim JD embedding readiness status & generation action.
  const [embeddingStatus, setEmbeddingStatus] = useState(null);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  // Search filter for source JD text and highlighted quote locator.
  const [sourceSearch, setSourceSearch] = useState('');
  const [highlightedQuote, setHighlightedQuote] = useState('');
  const sourceTextRef = useRef(null);

  // Editable requirements state (clone of categorized requirements for local editing).
  const [editableReqs, setEditableReqs] = useState([]);
  const [overviewText, setOverviewText] = useState('');
  const [roleSummaryText, setRoleSummaryText] = useState('');

  // Track ID of requirement currently in inline edit mode.
  const [editingItemId, setEditingItemId] = useState(null);
  const [inlineEditValues, setInlineEditValues] = useState({});

  // Add new requirement modal state.
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState('mandatory_skills');
  const [newItemText, setNewItemText] = useState('');
  const [newItemClassification, setNewItemClassification] = useState('Mandatory');
  const [newItemSkill, setNewItemSkill] = useState('');
  const [newItemEvidence, setNewItemEvidence] = useState('');

  // Version management state.
  const [availableVersions, setAvailableVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);

  // Confirmation modals state.
  const [showResegmentConfirm, setShowResegmentConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  // Helper to flatten categorized requirement blocks from backend segmentation payload cleanly.
  const flattenSegmentationCategories = (segObj) => {
    const flat = [];
    if (segObj?.categories) {
      Object.entries(segObj.categories).forEach(([catCode, items]) => {
        items.forEach((item) => {
          flat.push({ ...item, category: catCode });
        });
      });
    }
    return flat;
  };

  // Fetch available versions, segmentation details, and embedding readiness for current job.
  const loadSegmentationData = async (versionNumber = null) => {
    if (!job?.id) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [versions, segRes, embStat] = await Promise.all([
        apiRequest(`/jobs/${job.id}/segmentation/versions`).catch(() => []),
        apiRequest(
          versionNumber
            ? `/jobs/${job.id}/segmentation?version=${versionNumber}`
            : `/jobs/${job.id}/segmentation`
        ),
        jobApi.getEmbeddingStatus(job.id).catch(() => null),
      ]);

      setAvailableVersions(versions || []);
      setEmbeddingStatus(embStat);

      const seg = segRes.segmentation;
      setSegmentation(seg);
      setSelectedVersion(seg.version);
      setOverviewText(seg.job_overview || '');
      setRoleSummaryText(seg.role_summary || '');
      setEditableReqs(flattenSegmentationCategories(seg));
      setDeletedIds([]);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load segmentation');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger load on modal opening or job change.
  useEffect(() => {
    if (isOpen && job?.id) {
      loadSegmentationData();
    }
  }, [isOpen, job?.id]);

  if (!isOpen || !job) return null;

  // Toggle Mandatory vs Preferred classification for an item.
  const handleToggleClassification = (itemId) => {
    setEditableReqs((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const nextClassification = item.classification === 'Mandatory' ? 'Preferred' : 'Mandatory';
          return {
            ...item,
            classification: nextClassification,
            is_approved: true,
            source_origin: 'recruiter_edited',
          };
        }
        return item;
      })
    );
  };

  // Toggle Recruiter Verification state for an item.
  const handleToggleVerification = (itemId) => {
    setEditableReqs((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            is_approved: !item.is_approved,
            source_origin: !item.is_approved ? 'recruiter_edited' : item.source_origin,
          };
        }
        return item;
      })
    );
  };

  // Begin inline editing of an existing requirement.
  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setInlineEditValues({
      original_text: item.original_text,
      normalized_skill: item.normalized_skill || '',
      category: item.category,
      classification: item.classification,
      evidence: item.evidence || '',
    });
  };

  // Save inline edits to local requirement item.
  const handleSaveInlineEdit = (itemId) => {
    setEditableReqs((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            original_text: inlineEditValues.original_text,
            normalized_skill: inlineEditValues.normalized_skill || null,
            category: inlineEditValues.category,
            classification: inlineEditValues.classification,
            evidence: inlineEditValues.evidence || item.evidence,
            is_approved: true,
            source_origin: 'recruiter_edited',
          };
        }
        return item;
      })
    );
    setEditingItemId(null);
  };

  // Delete a requirement item locally and record persisted numeric IDs for backend deletion on save.
  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    if (typeof itemToDelete.id === 'number') {
      setDeletedIds((prev) => (prev.includes(itemToDelete.id) ? prev : [...prev, itemToDelete.id]));
    }
    setEditableReqs((prev) => prev.filter((item) => item.id !== itemToDelete.id));
    setItemToDelete(null);
  };

  // Add a newly created requirement to local list.
  const handleAddNewItem = () => {
    if (!newItemText.trim()) return;

    const newReq = {
      id: `new-${Date.now()}`,
      category: newItemCategory,
      category_label: segmentation?.available_categories?.find((c) => c.code === newItemCategory)?.label || newItemCategory,
      original_text: newItemText.trim(),
      classification: newItemClassification,
      normalized_skill: newItemSkill.trim() || null,
      evidence: newItemEvidence.trim() || 'Recruiter-specified requirement',
      confidence: 1.0,
      is_approved: true,
      source_origin: 'recruiter_added',
      evidence_verification: { is_verified: true, match_type: 'recruiter_verified' },
      order_index: editableReqs.length,
    };

    setEditableReqs((prev) => [...prev, newReq]);
    setIsAddingNew(false);
    setNewItemText('');
    setNewItemSkill('');
    setNewItemEvidence('');
  };

  // Locate evidence in source document panel by highlighting and scrolling.
  const handleLocateEvidence = (quote) => {
    if (!quote) return;
    setHighlightedQuote(quote);
    setSourceSearch(quote.slice(0, 30));
  };

  // Persist all edits, additions, and tracked deletions to PUT /api/jobs/{id}/segmentation.
  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const deletedEntries = deletedIds.map((id) => ({
        id,
        category: 'technical_skills',
        original_text: '',
        classification: 'Preferred',
        is_deleted: true,
      }));

      const payload = {
        job_overview: overviewText,
        role_summary: roleSummaryText,
        requirements: [
          ...editableReqs.map((req) => ({
            id: typeof req.id === 'number' ? req.id : null,
            category: req.category,
            original_text: req.original_text,
            classification: req.classification,
            normalized_skill: req.normalized_skill,
            experience_years: req.experience_years,
            evidence: req.evidence,
            confidence: req.confidence,
            is_approved: req.is_approved,
            is_deleted: false,
          })),
          ...deletedEntries,
        ],
      };

      const res = await apiRequest(`/jobs/${job.id}/segmentation`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const updated = res.segmentation;
      setSegmentation(updated);
      // Sync newly generated numeric IDs from SQLite so repeat saves never duplicate added items.
      setEditableReqs(flattenSegmentationCategories(updated));
      setDeletedIds([]);
      setSuccessMessage('Segmentation changes and deletions saved to SQLite.');
      if (onSegmentationUpdated) {
        onSegmentationUpdated(updated);
      }
      return updated;
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save changes.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Approve final segmentation via POST /api/jobs/{id}/approve-segmentation and refresh embedding readiness.
  const handleApproveSegmentation = async () => {
    setShowApproveConfirm(false);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await handleSaveAllChanges();

      const res = await apiRequest(`/jobs/${job.id}/approve-segmentation`, {
        method: 'POST',
        body: JSON.stringify({ approver: 'Lead Recruiter' }),
      });

      const approved = res.segmentation;
      setSegmentation(approved);
      setEditableReqs(flattenSegmentationCategories(approved));
      const embStat = await jobApi.getEmbeddingStatus(job.id).catch(() => null);
      setEmbeddingStatus(embStat);
      setSuccessMessage('Segmentation approved! Mandatory & preferred skills synchronized with candidate matching.');
      if (onSegmentationUpdated) {
        onSegmentationUpdated(approved);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to approve segmentation.');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate 2048-dim JD embeddings for the active approved segmentation.
  const handleGenerateEmbeddings = async () => {
    setIsGeneratingEmbeddings(true);
    setErrorMessage(null);
    try {
      const result = await jobApi.generateEmbeddings(job.id, {
        segmentation_id: segmentation?.id,
        force: false,
      });
      const embStat = await jobApi.getEmbeddingStatus(job.id).catch(() => null);
      setEmbeddingStatus(embStat);
      setSuccessMessage(
        `JD Embeddings ready: ${result?.generated_count ?? 0} generated, ${result?.reused_count ?? 0} reused.`
      );
    } catch (err) {
      setErrorMessage(err.message || 'Failed to generate JD embeddings.');
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  // Re-run AI segmentation via POST /api/jobs/{id}/segment?force=true.
  const handleResegment = async () => {
    setShowResegmentConfirm(false);
    setIsResegmenting(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest(`/jobs/${job.id}/segment?force=true`, {
        method: 'POST',
      });

      const reseg = res.segmentation;
      setSegmentation(reseg);
      setOverviewText(reseg.job_overview || '');
      setRoleSummaryText(reseg.role_summary || '');

      const flat = [];
      if (reseg.categories) {
        Object.entries(reseg.categories).forEach(([catCode, items]) => {
          items.forEach((item) => {
            flat.push({ ...item, category: catCode });
          });
        });
      }
      setEditableReqs(flat);
      setSuccessMessage('AI Segmentation re-executed successfully across 15 categories.');
      if (onSegmentationUpdated) {
        onSegmentationUpdated(reseg);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to re-run segmentation.');
    } finally {
      setIsResegmenting(false);
    }
  };

  // Switch displayed historical version.
  const handleSwitchVersion = (versionNum) => {
    if (versionNum === selectedVersion) return;
    loadSegmentationData(versionNum);
  };

  // Determine if currently viewed version is the latest active version.
  const latestVersionNumber = availableVersions.length > 0 ? availableVersions[0].version : (segmentation?.version || 1);
  const isLatestVersion = selectedVersion === null || selectedVersion === latestVersionNumber;

  // Compute live metrics from editable state.
  const totalCount = editableReqs.length;
  const mandatoryCount = editableReqs.filter((r) => r.classification === 'Mandatory').length;
  const preferredCount = editableReqs.filter((r) => r.classification === 'Preferred').length;
  const verifiedCount = editableReqs.filter((r) => r.is_approved).length;
  const unreviewedCount = totalCount - verifiedCount;
  const groundedCount = editableReqs.filter((r) => r.evidence_verification?.is_verified !== false).length;

  // Filter requirements across category, classification, provenance origin, and search keyword.
  const filteredRequirements = editableReqs.filter((r) => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (statusFilter === 'mandatory' && r.classification !== 'Mandatory') return false;
    if (statusFilter === 'preferred' && r.classification !== 'Preferred') return false;
    if (statusFilter === 'unreviewed' && r.is_approved) return false;
    if (statusFilter === 'verified' && !r.is_approved) return false;
    if (provenanceFilter !== 'all' && (r.source_origin || 'ai_model') !== provenanceFilter) return false;
    if (reqSearch.trim()) {
      const q = reqSearch.trim().toLowerCase();
      const hay = `${r.original_text || ''} ${r.normalized_skill || ''} ${r.evidence || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Calculate empty categories to highlight gaps.
  const emptyCategoryCodes = (segmentation?.available_categories || [])
    .filter((cat) => !editableReqs.some((r) => r.category === cat.code))
    .map((cat) => cat.code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 backdrop-blur-sm p-3 md:p-6 overflow-hidden">
      <div className="bg-white dark:bg-surface-darkCard rounded-2xl shadow-2xl border border-slate-200 dark:border-surface-darkBorder w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden animate-scaleIn">
        {/* Workspace Top Header */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                JD Intelligence & Requirements Workspace
              </h2>

              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                {job.jobCode || job.code}
              </span>

              {/* Version Selector Dropdown */}
              <div className="relative inline-flex items-center">
                <select
                  value={selectedVersion || 1}
                  onChange={(e) => handleSwitchVersion(parseInt(e.target.value, 10))}
                  className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 cursor-pointer appearance-none pr-5 focus:outline-none"
                >
                  {availableVersions.length > 0 ? (
                    availableVersions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version} {v.is_approved ? '• Approved' : '• Draft'} {v.is_current ? '(Latest)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value={1}>v1 (Latest)</option>
                  )}
                </select>
                <ChevronDown className="w-3 h-3 text-blue-700 dark:text-blue-300 absolute right-1.5 pointer-events-none" />
              </div>

              {segmentation?.status === 'approved' ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  Approved by {segmentation.approved_by || 'Recruiter'}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Review Pending
                </span>
              )}

              {/* Embedding Readiness Pill */}
              {embeddingStatus && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Vectors: {embeddingStatus.embeddings_count ?? 0}/{embeddingStatus.total_requirements ?? totalCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {job.title} • Mandatory ({mandatoryCount}) • Preferred ({preferredCount}) • Grounded 15-Category Extraction
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {segmentation?.status === 'approved' && (
              <button
                type="button"
                onClick={handleGenerateEmbeddings}
                disabled={isGeneratingEmbeddings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors"
              >
                <Cpu className={`w-3.5 h-3.5 ${isGeneratingEmbeddings ? 'animate-spin' : ''}`} />
                <span>{isGeneratingEmbeddings ? 'Embedding...' : 'Sync JD Vectors'}</span>
              </button>
            )}

            {onNavigateToMatrix && (
              <button
                type="button"
                onClick={() => onNavigateToMatrix(job)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>View Matching Candidates</span>
              </button>
            )}
            <button
              onClick={() => {
                if (segmentation?.is_approved) {
                  setShowResegmentConfirm(true);
                } else {
                  handleResegment();
                }
              }}
              disabled={isResegmenting || !isLatestVersion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isLatestVersion ? "Re-run AI segmentation from original document" : "Historical revisions cannot be re-segmented"}
            >
              {isResegmenting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Re-segmenting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Re-run AI
                </>
              )}
            </button>

            <button
              onClick={handleSaveAllChanges}
              disabled={isSaving || !isLatestVersion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isLatestVersion ? "Save progress" : "Historical versions are read-only"}
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              Save Progress
            </button>

            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={isSaving || !isLatestVersion}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                segmentation?.status === 'approved'
                  ? 'bg-slate-700 hover:bg-slate-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={isLatestVersion ? "Approve final segmentation" : "Historical versions are read-only"}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {segmentation?.status === 'approved' ? 'Re-Approve & Sync' : 'Approve Final Segmentation'}
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Read-Only Historical Version Banner */}
        {!isLatestVersion && (
          <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between shrink-0 animate-fadeIn">
            <span className="flex items-center gap-2 font-medium">
              <History className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              Viewing Historical Version <strong>v{selectedVersion}</strong> (Read-only mode). Editing and approval are disabled for historical revisions.
            </span>
            <button
              onClick={() => handleSwitchVersion(latestVersionNumber)}
              className="text-xs font-bold text-blue-800 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-900 px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Switch to Latest (v{latestVersionNumber})
            </button>
          </div>
        )}

        {/* Status Notification Banners */}
        {errorMessage && (
          <div className="px-6 py-2 bg-red-50 dark:bg-rose-950/40 border-b border-red-200 dark:border-rose-900/50 text-xs text-red-700 dark:text-rose-200 flex items-center justify-between shrink-0">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {successMessage && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between shrink-0">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Confirmation Modal for Overwriting Approved Segmentation */}
        {showResegmentConfirm && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Warning:</strong> This segmentation version was approved by recruiter. Re-running AI will generate a fresh revision version. Proceed?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowResegmentConfirm(false)}
                className="px-2.5 py-1 border border-slate-300 dark:border-surface-darkBorder rounded bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResegment}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold"
              >
                Yes, Re-segment
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-300 text-xs text-rose-900 flex items-center justify-between shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Are you sure you want to delete requirement: <em>"{itemToDelete.original_text.slice(0, 50)}..."</em>?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteItem}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Approval Confirmation Modal */}
        {showApproveConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-navy-950/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-scaleIn">
              <div className="flex items-center gap-2.5 text-navy-950 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Confirm Final Segmentation Approval</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Approving will lock this version as the verified recruitment baseline and synchronize approved skills to the operational Job profile:
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="font-semibold text-rose-700">Mandatory Skills to sync:</span>
                  <strong className="text-slate-800">{mandatoryCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-700">Preferred Skills to sync:</span>
                  <strong className="text-slate-800">{preferredCount}</strong>
                </div>
                <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
                  <span>Recruiter Verified Items:</span>
                  <strong>{verifiedCount} of {totalCount}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Candidate semantic search and vector matching will reference these approved requirements.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Review More
                </button>
                <button
                  onClick={handleApproveSegmentation}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Approve & Synchronize Skills
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive KPI Metrics Ribbon & Provenance Filter Controls with Dark Mode */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-surface-darkBorder flex items-center gap-2.5 overflow-x-auto text-xs shrink-0 scrollbar-none">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Filter:</span>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors shrink-0 ${
              statusFilter === 'all'
                ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-50'
            }`}
          >
            All Items ({totalCount})
          </button>

          <button
            onClick={() => setStatusFilter('mandatory')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'mandatory'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Mandatory ({mandatoryCount})
          </button>

          <button
            onClick={() => setStatusFilter('preferred')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'preferred'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Preferred ({preferredCount})
          </button>

          <button
            onClick={() => setStatusFilter('unreviewed')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'unreviewed'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Unreviewed ({unreviewedCount})
          </button>

          <button
            onClick={() => setStatusFilter('verified')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'verified'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50'
            }`}
          >
            <Check className="w-3 h-3" />
            Verified ({verifiedCount})
          </button>

          {/* Provenance origin dropdown */}
          <select
            value={provenanceFilter}
            onChange={(e) => setProvenanceFilter(e.target.value)}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-200 text-xs shrink-0"
          >
            <option value="all">All Sources</option>
            <option value="ai_model">AI Model Extracted</option>
            <option value="heuristic_fallback">Heuristic Fallback</option>
            <option value="recruiter_edited">Recruiter Edited</option>
            <option value="recruiter_added">Recruiter Added</option>
          </select>

          {/* Requirement search filter input */}
          <div className="relative shrink-0">
            <input
              type="text"
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
              placeholder="Filter requirements..."
              className="pl-7 pr-2 py-1 text-xs rounded-md border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 w-36"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Grounding: <strong>{totalCount > 0 ? Math.round((groundedCount / totalCount) * 100) : 100}%</strong>
            </span>
          </div>
        </div>

        {/* Workspace Body: Split Screen View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* Left Panel: Original JD Source Text (38% width) */}
          <div className="lg:col-span-5 border-r border-slate-200 dark:border-surface-darkBorder flex flex-col bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden">
            <div className="p-3 border-b border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-navy-950 dark:text-slate-100">
                <FileText className="w-4 h-4 text-slate-500" />
                Original Source Document
              </div>
              <div className="relative w-44">
                <input
                  type="text"
                  placeholder="Find phrase in JD..."
                  value={sourceSearch}
                  onChange={(e) => {
                    setSourceSearch(e.target.value);
                    setHighlightedQuote(e.target.value);
                  }}
                  className="w-full pl-7 pr-2 py-1 text-xs border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-slate-800 text-navy-900 dark:text-slate-100 rounded focus:ring-1 focus:ring-navy-900"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
              </div>
            </div>

            <div
              ref={sourceTextRef}
              className="p-4 flex-1 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text bg-white dark:bg-surface-darkCanvas"
            >
              {highlightedQuote && sourceSearch ? (
                // Highlight search matches
                job.description
                  ?.split(new RegExp(`(${sourceSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                  .map((chunk, idx) =>
                    chunk.toLowerCase() === sourceSearch.toLowerCase() ? (
                      <mark key={idx} className="bg-amber-200 text-amber-900 font-bold px-0.5 rounded">
                        {chunk}
                      </mark>
                    ) : (
                      chunk
                    )
                  )
              ) : (
                job.description || 'No source text available for this job description.'
              )}
            </div>

            {highlightedQuote && (
              <div className="p-2.5 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-900 flex items-center justify-between shrink-0">
                <span className="truncate">Active Quote: "{highlightedQuote.slice(0, 45)}..."</span>
                <button
                  onClick={() => {
                    setHighlightedQuote('');
                    setSourceSearch('');
                  }}
                  className="text-amber-800 hover:underline font-semibold ml-2 shrink-0"
                >
                  Clear Highlight
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Structured 15-Category Requirements Workspace (62% width) */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-surface-darkCard overflow-hidden">
            {/* Category Filter Navigation Bar */}
            <div className="p-2.5 border-b border-slate-200 dark:border-surface-darkBorder bg-slate-50/70 dark:bg-slate-900/40 overflow-x-auto shrink-0 flex items-center gap-1.5 scrollbar-thin">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-xs'
                    : 'bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100'
                }`}
              >
                All 15 Categories ({editableReqs.length})
              </button>

              {segmentation?.available_categories?.map((cat) => {
                const count = editableReqs.filter((r) => r.category === cat.code).length;
                const isCatEmpty = count === 0;

                return (
                  <button
                    key={cat.code}
                    onClick={() => setSelectedCategory(cat.code)}
                    className={`px-2.5 py-1.5 rounded-full text-xs shrink-0 transition-colors flex items-center gap-1.5 ${
                      selectedCategory === cat.code
                        ? 'bg-navy-900 dark:bg-brand-600 text-white font-semibold shadow-xs'
                        : isCatEmpty
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/60'
                        : 'bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedCategory === cat.code
                          ? 'bg-white/20 text-white'
                          : isCatEmpty
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Structured Content Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-5">
              {/* Executive Overview & Role Summary Cards */}
              {(selectedCategory === 'all' || selectedCategory === 'job_overview' || selectedCategory === 'role_summary') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                      Job Overview
                    </label>
                    <textarea
                      rows={3}
                      value={overviewText}
                      onChange={(e) => setOverviewText(e.target.value)}
                      placeholder="High-level overview of the company, team, and hiring scope..."
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-navy-900 leading-relaxed font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-600" />
                      Role Summary
                    </label>
                    <textarea
                      rows={3}
                      value={roleSummaryText}
                      onChange={(e) => setRoleSummaryText(e.target.value)}
                      placeholder="Role summary and primary deliverables..."
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-navy-900 leading-relaxed font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Requirement Section Header & Add Requirement Trigger */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-2">
                    <span>
                      {selectedCategory === 'all'
                        ? 'Structured Requirement Records'
                        : segmentation?.available_categories?.find((c) => c.code === selectedCategory)?.label || selectedCategory}
                    </span>
                    <span className="text-slate-400 font-normal">({filteredRequirements.length} shown)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Toggle Mandatory / Preferred, verify quotes against original JD, and edit standardized skill names.
                  </p>
                </div>

                {/* Add Requirement button (only enabled for latest active version) */}
                <button
                  onClick={() => {
                    setNewItemCategory(selectedCategory === 'all' ? 'mandatory_skills' : selectedCategory);
                    setIsAddingNew(true);
                  }}
                  disabled={!isLatestVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isLatestVersion ? "Add requirement" : "Historical revisions are read-only"}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Requirement
                </button>
              </div>

              {/* Add New Requirement Inline Card */}
              {isAddingNew && (
                <div className="p-4 bg-brand-50/50 border border-brand-200 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-navy-950">
                    <span>Add New Requirement</span>
                    <button onClick={() => setIsAddingNew(false)}><X className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                      >
                        {segmentation?.available_categories?.map((cat) => (
                          <option key={cat.code} value={cat.code}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Classification</label>
                      <select
                        value={newItemClassification}
                        onChange={(e) => setNewItemClassification(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs font-semibold"
                      >
                        <option value="Mandatory">Mandatory</option>
                        <option value="Preferred">Preferred</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Normalized Skill (Optional)</label>
                      <input
                        type="text"
                        value={newItemSkill}
                        onChange={(e) => setNewItemSkill(e.target.value)}
                        placeholder="e.g. Oracle FCCS, React"
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Requirement Description</label>
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="e.g. 5+ years of hands-on experience designing cloud architectures"
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Source Evidence Quote (Optional)</label>
                      <input
                        type="text"
                        value={newItemEvidence}
                        onChange={(e) => setNewItemEvidence(e.target.value)}
                        placeholder="Verbatim quote from JD supporting this requirement"
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNewItem}
                      className="px-4 py-1.5 bg-navy-900 text-white rounded text-xs font-semibold hover:bg-navy-950"
                    >
                      Add to Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Requirement Items List */}
              <div className="space-y-3">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading structured requirements...
                  </div>
                ) : filteredRequirements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                    <p className="font-semibold text-slate-600">No requirements matched active filters.</p>
                    <p className="text-[11px]">
                      {emptyCategoryCodes.includes(selectedCategory)
                        ? 'This section was not mentioned in the source JD. Click "Add Requirement" to specify one.'
                        : 'Try selecting "All Items" or reset status filters.'}
                    </p>
                  </div>
                ) : (
                  filteredRequirements.map((item) => {
                    const isInlineEditing = editingItemId === item.id;
                    const isVerifiedInSource = item.evidence_verification?.is_verified !== false;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                          item.is_approved
                            ? 'bg-white border-slate-200 shadow-xs ring-1 ring-emerald-500/10'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        {isInlineEditing ? (
                          /* Inline Edit Mode */
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500">Category</label>
                                <select
                                  value={inlineEditValues.category}
                                  onChange={(e) =>
                                    setInlineEditValues({ ...inlineEditValues, category: e.target.value })
                                  }
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                                >
                                  {segmentation?.available_categories?.map((cat) => (
                                    <option key={cat.code} value={cat.code}>{cat.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500">Classification</label>
                                <select
                                  value={inlineEditValues.classification}
                                  onChange={(e) =>
                                    setInlineEditValues({ ...inlineEditValues, classification: e.target.value })
                                  }
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-semibold"
                                >
                                  <option value="Mandatory">Mandatory</option>
                                  <option value="Preferred">Preferred</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500">Normalized Skill</label>
                                <input
                                  type="text"
                                  value={inlineEditValues.normalized_skill}
                                  onChange={(e) =>
                                    setInlineEditValues({ ...inlineEditValues, normalized_skill: e.target.value })
                                  }
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-slate-500">Requirement Text</label>
                              <input
                                type="text"
                                value={inlineEditValues.original_text}
                                onChange={(e) =>
                                  setInlineEditValues({ ...inlineEditValues, original_text: e.target.value })
                                }
                                className="w-full p-1.5 border border-slate-300 rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-semibold text-slate-500">Evidence Quote</label>
                              <input
                                type="text"
                                value={inlineEditValues.evidence}
                                onChange={(e) =>
                                  setInlineEditValues({ ...inlineEditValues, evidence: e.target.value })
                                }
                                className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="px-2.5 py-1 border border-slate-300 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveInlineEdit(item.id)}
                                className="px-3 py-1 bg-navy-900 text-white rounded text-[11px] font-semibold"
                              >
                                Save Edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Interactive Mandatory / Preferred Toggle Pill */}
                                  <button
                                    onClick={() => isLatestVersion && handleToggleClassification(item.id)}
                                    disabled={!isLatestVersion}
                                    title={isLatestVersion ? "Click to toggle Mandatory / Preferred" : "Historical revisions are read-only"}
                                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition-all shadow-2xs flex items-center gap-1 ${
                                      !isLatestVersion
                                        ? 'opacity-70 cursor-not-allowed bg-slate-100 text-slate-600 border-slate-300'
                                        : item.classification === 'Mandatory'
                                        ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 cursor-pointer'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 cursor-pointer'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        item.classification === 'Mandatory' ? 'bg-rose-500' : 'bg-emerald-500'
                                      }`}
                                    />
                                    {item.classification}
                                  </button>

                                  {/* Category Label Badge */}
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    {segmentation?.available_categories?.find((c) => c.code === item.category)?.label || item.category}
                                  </span>

                                  {/* Normalized Skill Tag */}
                                  {item.normalized_skill && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                      Skill: {item.normalized_skill}
                                    </span>
                                  )}

                                  {/* Experience Years */}
                                  {item.experience_years != null && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                      {item.experience_years}+ Years
                                    </span>
                                  )}

                                  {/* Provenance Origin Badge */}
                                  {item.source_origin === 'recruiter_added' ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200">
                                      Recruiter Added
                                    </span>
                                  ) : item.source_origin === 'recruiter_edited' ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
                                      Recruiter Edited
                                    </span>
                                  ) : item.source_origin === 'heuristic_fallback' ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200 flex items-center gap-1">
                                      <Sliders className="w-2.5 h-2.5 text-slate-500" />
                                      Rule-Grounded
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 font-medium border border-cyan-200 flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5 text-cyan-600" />
                                      AI Model ({Math.round((item.confidence || 0.95) * 100)}%)
                                    </span>
                                  )}

                                  {/* Verification Toggle Status */}
                                  <button
                                    onClick={() => isLatestVersion && handleToggleVerification(item.id)}
                                    disabled={!isLatestVersion}
                                    title={isLatestVersion ? "Click to toggle Recruiter Verification" : "Historical revisions are read-only"}
                                    className={`text-[10px] flex items-center gap-1 font-semibold ml-auto px-2 py-0.5 rounded border transition-colors ${
                                      !isLatestVersion
                                        ? 'opacity-70 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                                        : item.is_approved
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 cursor-pointer'
                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 cursor-pointer'
                                    }`}
                                  >
                                    <Check className={`w-3 h-3 ${item.is_approved ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    {item.is_approved ? 'Verified' : 'Verify'}
                                  </button>
                                </div>

                                <p className="font-medium text-slate-900 leading-snug">
                                  {item.original_text}
                                </p>
                              </div>

                              {/* Action Buttons: Edit, Delete (only available on latest version) */}
                              {isLatestVersion && (
                                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                  <button
                                    onClick={() => handleStartEdit(item)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                    title="Edit requirement"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setItemToDelete(item)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                    title="Delete requirement"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Evidence Quote Excerpt Box with Verification Indicator */}
                            {item.evidence && (
                              <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg flex items-start justify-between gap-2 text-[11px] text-slate-600">
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                  <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="italic line-clamp-2">"{item.evidence}"</span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Verification status pill */}
                                  {isVerifiedInSource ? (
                                    <span
                                      className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1"
                                      title="Verified quote exists in original source document text"
                                    >
                                      <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                      In Source
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1"
                                      title="Quote excerpt could not be directly matched to document text"
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                      Unverified
                                    </span>
                                  )}

                                  {/* Click to locate button */}
                                  <button
                                    onClick={() => handleLocateEvidence(item.evidence)}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 hover:text-brand-800 bg-white px-1.5 py-0.5 rounded border border-slate-200"
                                    title="Locate and highlight quote in source document"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    Locate
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
