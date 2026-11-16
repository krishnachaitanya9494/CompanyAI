// Import React and hooks for managing state and effects in the workspace.
import React, { useState, useEffect, useRef, useMemo } from 'react';
// Import icons for embedding readiness, verification, categories, and actions.
import {
  X,
  Sparkles,
  CheckCircle,
  CheckCircle2,
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
  ChevronUp,
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
  Building2,
  ArrowLeft,
  Crown,
  Briefcase,
  MapPin,
  Award,
  BookOpen,
  Wrench,
  Globe,
  Tag,
  ChevronRight,
} from 'lucide-react';
// Import apiRequest and jobApi embedding helpers.
import { apiRequest } from '../../api';
import { jobApi } from '../../api/client';
import { CustomSelect } from '../common/CustomSelect';

// Utility to clean raw markdown headers, bulletin symbols, and prefix artifacts from structured text
const sanitizeStructuredText = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\[section=[^;\]]+(?:;\s*source_line=\d+)?\]\s*/gi, '')
    .replace(/\[(?:section|source_line)=[^\]]+\]\s*/gi, '')
    .replace(/^##\s*Role:.*$/gim, '')
    .replace(/^##\s*Requisition ID:.*$/gim, '')
    .replace(/^##\s*Experience:.*$/gim, '')
    .replace(/^##\s*Location:.*$/gim, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Domain category icons mapping
const CATEGORY_ICONS = {
  mandatory_skills: Crown,
  preferred_skills: Award,
  key_responsibilities: CheckCircle2,
  technical_skills: Cpu,
  tools_and_technologies: Wrench,
  domain_knowledge: Globe,
  minimum_experience: Clock,
  preferred_experience: Clock,
  educational_qualifications: BookOpen,
  certifications: Award,
  location_requirements: MapPin,
  employment_type: Briefcase,
  other_requirements: Tag,
};

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
  // Toggle inline editing of Executive Scope card
  const [isEditingScope, setIsEditingScope] = useState(false);
  // Responsive mobile/tablet viewport active panel toggle ('source' | 'structured')
  const [mobileActivePanel, setMobileActivePanel] = useState('structured');

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
        // Skip document-level overview and summary items from individual requirements
        if (catCode === 'job_overview' || catCode === 'role_summary') {
          // If items has valid skill-like content, remap it to mandatory_skills or key_responsibilities
          items.forEach((item) => {
            const text = (item.original_text || '').replace(/\[section=[^;\]]+;\s*source_line=\d+\]\s*/g, '').trim();
            if (text && text.length > 5 && !text.toLowerCase().startsWith('looking for') && !text.toLowerCase().startsWith('seeking a')) {
              flat.push({ ...item, original_text: text, category: item.normalized_skill ? 'mandatory_skills' : 'key_responsibilities' });
            }
          });
          return;
        }
        items.forEach((item) => {
          const cleanText = (item.original_text || '').replace(/\[section=[^;\]]+;\s*source_line=\d+\]\s*/g, '').trim();
          flat.push({ ...item, original_text: cleanText || item.original_text, category: catCode });
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
      const cleanOverview = sanitizeStructuredText(seg.job_overview || '');
      const rawSummary = sanitizeStructuredText(seg.role_summary || '');
      const jobRoleName = job.title || 'Technical Specialist';
      setOverviewText(cleanOverview || `Comprehensive role owning technical delivery and system architecture for ${jobRoleName}.`);
      setRoleSummaryText(
        rawSummary &&
        rawSummary !== 'Professional role within engineering organization.' &&
        rawSummary !== 'Professional role within technical organization.'
          ? rawSummary
          : `Key contributor driving platform architecture, engineering excellence, and mission-critical solution delivery for ${jobRoleName}.`
      );
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

  // Requirement categories only (filters out document-level narrative keys)
  const requirementCategories = useMemo(() => {
    return (segmentation?.available_categories || []).filter(
      (cat) => cat.code !== 'job_overview' && cat.code !== 'role_summary' && !cat.is_narrative
    );
  }, [segmentation?.available_categories]);

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
    setMobileActivePanel('source');
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
      setEditableReqs(flattenSegmentationCategories(updated));
      setDeletedIds([]);
      setIsEditingScope(false);
      setSuccessMessage('Segmentation changes saved to SQLite.');
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
      setOverviewText(sanitizeStructuredText(reseg.job_overview || ''));
      setRoleSummaryText(sanitizeStructuredText(reseg.role_summary || ''));
      setEditableReqs(flattenSegmentationCategories(reseg));
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
  const groundedPercent = totalCount > 0 ? Math.round((groundedCount / totalCount) * 100) : 100;

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

  // Calculate grouped requirements when "all" categories are shown
  const groupedRequirements = useMemo(() => {
    if (selectedCategory !== 'all') return [];
    const groups = [];
    const categoryOrder = [
      { code: 'mandatory_skills', label: 'Mandatory Technical Stack', icon: Crown, color: 'text-rose-600 bg-rose-50 border-rose-200' },
      { code: 'preferred_skills', label: 'Preferred Qualifications & Differentiators', icon: Award, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      { code: 'key_responsibilities', label: 'Key Responsibilities & Deliverables', icon: CheckCircle2, color: 'text-sky-600 bg-sky-50 border-sky-200' },
      { code: 'technical_skills', label: 'Technical Competencies & Architecture', icon: Cpu, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
      { code: 'tools_and_technologies', label: 'Tools, Platforms & Frameworks', icon: Wrench, color: 'text-amber-600 bg-amber-50 border-amber-200' },
      { code: 'domain_knowledge', label: 'Domain Knowledge & Governance', icon: Globe, color: 'text-teal-600 bg-teal-50 border-teal-200' },
      { code: 'minimum_experience', label: 'Experience Level Requirements', icon: Clock, color: 'text-purple-600 bg-purple-50 border-purple-200' },
      { code: 'educational_qualifications', label: 'Education & Academic Criteria', icon: BookOpen, color: 'text-blue-600 bg-blue-50 border-blue-200' },
      { code: 'certifications', label: 'Professional Certifications', icon: Award, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      { code: 'location_requirements', label: 'Location & Work Arrangement', icon: MapPin, color: 'text-violet-600 bg-violet-50 border-violet-200' },
      { code: 'employment_type', label: 'Employment Terms', icon: Briefcase, color: 'text-slate-600 bg-slate-50 border-slate-200' },
      { code: 'other_requirements', label: 'Additional Criteria', icon: Tag, color: 'text-slate-600 bg-slate-50 border-slate-200' },
    ];

    categoryOrder.forEach((grp) => {
      const items = filteredRequirements.filter((r) => r.category === grp.code);
      if (items.length > 0) {
        groups.push({
          ...grp,
          items,
        });
      }
    });

    // Catch any items that didn't fit into standard groups
    const groupedCodes = new Set(categoryOrder.map((c) => c.code));
    const remaining = filteredRequirements.filter((r) => !groupedCodes.has(r.category));
    if (remaining.length > 0) {
      groups.push({
        code: 'other',
        label: 'General Requirements',
        icon: Tag,
        color: 'text-slate-600 bg-slate-50 border-slate-200',
        items: remaining,
      });
    }

    return groups;
  }, [filteredRequirements, selectedCategory]);

  const activeCategoryMeta = requirementCategories.find((c) => c.code === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/75 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-surface-darkCard rounded-2xl shadow-2xl border border-slate-200 dark:border-surface-darkBorder w-[min(96vw,1440px)] max-h-[calc(100vh-2rem)] h-[calc(100vh-2rem)] flex flex-col overflow-hidden animate-scaleIn">
        
        {/* Workspace Top Header Bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-surface-darkBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-navy-950 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                JD Intelligence & Requirements Workspace
              </h2>

              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                {job.jobCode || job.code || `REQ-${job.id}`}
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
                  Approved by {segmentation.approved_by || 'Lead Recruiter'}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Review Pending
                </span>
              )}

              {/* Embedding Readiness Pill */}
              {embeddingStatus && (
                <span
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1"
                  title={`${embeddingStatus.requirement_embeddings_count ?? embeddingStatus.embeddings_count ?? 0} requirement vectors + ${embeddingStatus.full_jd_embeddings_count ?? 1} Full JD vector`}
                >
                  <Cpu className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  Vectors: {embeddingStatus.requirement_embeddings_count ?? embeddingStatus.embeddings_count ?? embeddingStatus.total_embeddings ?? 0}/{embeddingStatus.total_requirements ?? totalCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {job.title} • {mandatoryCount} Mandatory • {preferredCount} Preferred • {groundedPercent}% Grounding in Source
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <Users className="w-3.5 h-3.5" />
                <span>View Candidates</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-surface-darkBorder rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-surface-darkBorder rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              title={isLatestVersion ? "Save progress" : "Historical versions are read-only"}
            >
              <Save className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              Save Progress
            </button>

            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={isSaving || !isLatestVersion}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              {segmentation?.status === 'approved' ? 'Re-Approve & Sync' : 'Approve Final Segmentation'}
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors ml-1"
              aria-label="Close workspace"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Read-Only Historical Version Banner */}
        {!isLatestVersion && (
          <div className="px-6 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between shrink-0 animate-fadeIn">
            <span className="flex items-center gap-2 font-medium">
              <History className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              Viewing Historical Revision <strong>v{selectedVersion}</strong> (Read-only).
            </span>
            <button
              onClick={() => handleSwitchVersion(latestVersionNumber)}
              className="text-xs font-bold text-blue-800 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 px-2.5 py-1 rounded transition-colors"
            >
              Switch to Latest (v{latestVersionNumber})
            </button>
          </div>
        )}

        {/* Notification Banners */}
        {errorMessage && (
          <div className="px-6 py-2 bg-red-50 dark:bg-rose-950/40 border-b border-red-200 text-xs text-red-700 dark:text-rose-200 flex items-center justify-between shrink-0">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {successMessage && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between shrink-0">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Resegment Confirmation Alert */}
        {showResegmentConfirm && (
          <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Warning:</strong> Re-running AI will create a fresh version from the source document. Proceed?</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowResegmentConfirm(false)} className="px-2.5 py-1 border border-slate-300 rounded bg-white text-slate-700 font-medium">Cancel</button>
              <button onClick={handleResegment} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold">Yes, Re-segment</button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {itemToDelete && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-300 text-xs text-rose-900 flex items-center justify-between shrink-0 animate-fadeIn">
            <span>Delete requirement <strong>"{itemToDelete.original_text.slice(0, 50)}..."</strong>?</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setItemToDelete(null)} className="px-2.5 py-1 border border-slate-300 rounded bg-white text-slate-700 font-medium">Cancel</button>
              <button onClick={confirmDeleteItem} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold">Confirm Delete</button>
            </div>
          </div>
        )}

        {/* Approval Confirmation Dialog */}
        {showApproveConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-navy-950/60 p-4">
            <div className="bg-white dark:bg-surface-darkCard rounded-xl shadow-2xl border border-slate-200 dark:border-surface-darkBorder max-w-md w-full p-6 space-y-4 animate-scaleIn">
              <div className="flex items-center gap-2.5 text-navy-950 dark:text-slate-100 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Confirm Final Segmentation Approval</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Approving locks this version as the recruitment baseline and synchronizes skills to the live matching engine:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs space-y-1.5 border border-slate-200 dark:border-surface-darkBorder">
                <div className="flex justify-between">
                  <span className="font-semibold text-rose-700 dark:text-rose-300">Mandatory Skills:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{mandatoryCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">Preferred Skills:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{preferredCount}</strong>
                </div>
                <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200 dark:border-surface-darkBorder">
                  <span>Recruiter Verified Items:</span>
                  <strong>{verifiedCount} of {totalCount}</strong>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowApproveConfirm(false)} className="px-3.5 py-1.5 border border-slate-300 dark:border-surface-darkBorder rounded text-xs font-semibold text-slate-700 dark:text-slate-300">Review More</button>
                <button onClick={handleApproveSegmentation} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm">Approve &amp; Synchronize Skills</button>
              </div>
            </div>
          </div>
        )}

        {/* KPI Filter Ribbon */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-surface-darkBorder flex items-center gap-2 overflow-x-auto text-xs shrink-0 scrollbar-none">
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
            onClick={() => setStatusFilter('verified')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'verified'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50'
            }`}
          >
            <Check className="w-3 h-3 text-blue-500" />
            Verified ({verifiedCount})
          </button>

          <button
            onClick={() => setStatusFilter('unreviewed')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 ${
              statusFilter === 'unreviewed'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-surface-darkCard text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Unreviewed ({unreviewedCount})
          </button>

          {/* Requirement search input */}
          <div className="relative shrink-0 ml-2">
            <input
              type="text"
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
              placeholder="Search specifications..."
              className="pl-7 pr-2 py-1 text-xs rounded-md border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 w-44"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Grounding: <strong>{groundedPercent}%</strong>
            </span>
          </div>
        </div>

        {/* Mobile/Tablet Segmented Control (< lg) */}
        <div className="lg:hidden flex items-center justify-around border-b border-slate-200 dark:border-surface-darkBorder bg-slate-50 dark:bg-slate-900/60 p-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileActivePanel('source')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 transition-all ${
              mobileActivePanel === 'source'
                ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Source Document</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileActivePanel('structured')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 transition-all ${
              mobileActivePanel === 'structured'
                ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Structured Intelligence ({editableReqs.length})</span>
          </button>
        </div>

        {/* Workspace Body: Split Screen View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          
          {/* Left Panel: Original JD Source Text (38% width) */}
          <div className={`lg:col-span-5 border-r border-slate-200 dark:border-surface-darkBorder flex-col bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden h-full min-h-0 ${mobileActivePanel === 'source' ? 'flex' : 'hidden lg:flex'}`}>
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
              className="p-4 flex-1 overflow-y-auto overscroll-contain font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text bg-white dark:bg-surface-darkCanvas"
            >
              {highlightedQuote && sourceSearch ? (
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

          {/* Right Panel: Structured Requirements Workspace (62% width) */}
          <div className={`lg:col-span-7 flex-col bg-white dark:bg-surface-darkCard overflow-hidden h-full min-h-0 ${mobileActivePanel === 'structured' ? 'flex' : 'hidden lg:flex'}`}>
            
            {/* Domain Category Filter Toolbar */}
            <div className="p-3 border-b border-slate-200 dark:border-surface-darkBorder bg-slate-50/70 dark:bg-slate-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2.5 flex-wrap">
                {/* Category Selector Dropdown Button */}
                <div className="w-full sm:w-64 flex-shrink-0">
                  <CustomSelect
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={[
                      { value: 'all', label: 'All Specifications', badge: editableReqs.length },
                      ...requirementCategories.map((cat) => ({
                        value: cat.code,
                        label: cat.label,
                        badge: editableReqs.filter((r) => r.category === cat.code).length,
                      })),
                    ]}
                    icon={Building2}
                    size="sm"
                    placeholder="Select Domain..."
                    ariaLabel="Filter requirements by domain"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  {editableReqs.length} verified specifications across {requirementCategories.length} domains
                </span>
              </div>

              {/* Wrapping Quick Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-xs'
                      : 'bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100'
                  }`}
                >
                  All ({editableReqs.length})
                </button>

                {requirementCategories.map((cat) => {
                  const count = editableReqs.filter((r) => r.category === cat.code).length;
                  const isCatEmpty = count === 0;

                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => setSelectedCategory(cat.code)}
                      className={`px-2.5 py-1 rounded-xl text-xs shrink-0 transition-all flex items-center gap-1.5 ${
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
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Structured Content Area with Independent Scroll */}
            <div className="flex-1 p-5 overflow-y-auto overscroll-contain space-y-4">
              
              {/* Executive Narrative Scope & Position Architecture Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-surface-darkBorder space-y-3.5 shadow-subtle">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60 dark:border-surface-darkBorder/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-navy-950 dark:text-slate-100">
                      Role Scope &amp; Narrative Architecture
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingScope) {
                        handleSaveAllChanges();
                      } else {
                        setIsEditingScope(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {isEditingScope ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Done Editing</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Scope</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Position Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">Role Title</span>
                    <span className="font-semibold text-navy-950 dark:text-slate-100 truncate block mt-0.5">{job.title || 'Technical Role'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">Requisition Code</span>
                    <span className="font-semibold text-navy-950 dark:text-slate-100 block font-mono mt-0.5">{job.jobCode || job.code || `REQ-${job.id}`}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">Experience Level</span>
                    <span className="font-semibold text-navy-950 dark:text-slate-100 block mt-0.5">{job.experienceRequired || job.experience || '5 - 8 Years'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">Location / Mode</span>
                    <span className="font-semibold text-navy-950 dark:text-slate-100 block mt-0.5">{job.location || 'Remote / Hybrid'}</span>
                  </div>
                </div>

                {/* Scope Content (View mode vs Edit mode) */}
                {isEditingScope ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-brand-600" />
                        Job Overview
                      </label>
                      <textarea
                        rows={3}
                        value={overviewText}
                        onChange={(e) => setOverviewText(e.target.value)}
                        placeholder="Comprehensive role overview..."
                        className="w-full text-xs p-2.5 border border-slate-300 dark:border-surface-darkBorder rounded-xl focus:ring-2 focus:ring-brand-500/20 leading-relaxed bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-teal-600" />
                        Role Mission &amp; Deliverables
                      </label>
                      <textarea
                        rows={3}
                        value={roleSummaryText}
                        onChange={(e) => setRoleSummaryText(e.target.value)}
                        placeholder="Core role mission and deliverables..."
                        className="w-full text-xs p-2.5 border border-slate-300 dark:border-surface-darkBorder rounded-xl focus:ring-2 focus:ring-brand-500/20 leading-relaxed bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                    <div className="p-3 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 tracking-wider">
                        <Sparkles className="w-3 h-3 text-brand-600" />
                        Job Overview
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                        {overviewText || 'Comprehensive role owning technical delivery and system architecture.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/70 dark:border-surface-darkBorder space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 tracking-wider">
                        <Layers className="w-3 h-3 text-teal-600" />
                        Role Mission
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                        {roleSummaryText || 'Strategic contributor driving platform architecture, engineering excellence, and lifecycle delivery.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Requirements Toolbar Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div>
                  <h3 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <span>
                      {selectedCategory === 'all'
                        ? 'Structured Requirement Records'
                        : activeCategoryMeta?.label || selectedCategory}
                    </span>
                    <span className="text-slate-400 font-normal">({filteredRequirements.length} specifications)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Toggle Mandatory / Preferred, verify quotes against original document, and customize skill tags.
                  </p>
                </div>

                {/* Add Requirement button */}
                <button
                  type="button"
                  onClick={() => {
                    setNewItemCategory(selectedCategory === 'all' ? 'mandatory_skills' : selectedCategory);
                    setIsAddingNew(true);
                  }}
                  disabled={!isLatestVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg text-xs font-semibold transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Specification
                </button>
              </div>

              {/* Add New Requirement Drawer */}
              {isAddingNew && (
                <div className="p-4 bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-navy-950 dark:text-slate-100">
                    <span>Add New Requirement Specification</span>
                    <button onClick={() => setIsAddingNew(false)}><X className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Domain Category</label>
                      <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-surface-darkCard text-xs text-navy-950 dark:text-slate-100"
                      >
                        {requirementCategories.map((cat) => (
                          <option key={cat.code} value={cat.code}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Classification</label>
                      <select
                        value={newItemClassification}
                        onChange={(e) => setNewItemClassification(e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-surface-darkCard text-xs font-semibold text-navy-950 dark:text-slate-100"
                      >
                        <option value="Mandatory">Mandatory</option>
                        <option value="Preferred">Preferred</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Standardized Skill Name</label>
                      <input
                        type="text"
                        value={newItemSkill}
                        onChange={(e) => setNewItemSkill(e.target.value)}
                        placeholder="e.g. Oracle FCCS, Groovy"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Specification Text *</label>
                      <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="e.g. 5+ years of hands-on experience designing cloud architectures"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Verbatim Source Quote (Optional)</label>
                      <input
                        type="text"
                        value={newItemEvidence}
                        onChange={(e) => setNewItemEvidence(e.target.value)}
                        placeholder="Exact phrase from JD supporting this requirement"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
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
                      className="px-4 py-1.5 bg-navy-900 text-white rounded text-xs font-semibold hover:bg-navy-950 shadow-xs"
                    >
                      Add Specification
                    </button>
                  </div>
                </div>
              )}

              {/* Requirement Items Section */}
              <div className="space-y-4">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading structured specifications...
                  </div>
                ) : filteredRequirements.length === 0 ? (
                  /* Domain Assistant State: Never leaves the recruiter in a blank box */
                  <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-surface-darkBorder space-y-3 animate-fadeIn">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
                        No {activeCategoryMeta?.label || 'matching'} specifications currently logged
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                        This section was not explicitly detailed in the source document. You can add one manually or return to all {editableReqs.length} specifications.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setNewItemCategory(selectedCategory === 'all' ? 'mandatory_skills' : selectedCategory);
                          setIsAddingNew(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add {activeCategoryMeta?.label || 'Requirement'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>View All Specifications ({editableReqs.length})</span>
                      </button>
                    </div>
                  </div>
                ) : selectedCategory === 'all' ? (
                  /* Grouped View across all domains */
                  groupedRequirements.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.code} className="space-y-2.5">
                        <div className="flex items-center gap-2 pt-2 border-b border-slate-100 dark:border-surface-darkBorder pb-1">
                          <span className={`p-1 rounded-lg ${group.color} border`}>
                            <GroupIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-xs font-bold text-navy-950 dark:text-slate-100">
                            {group.label}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {group.items.length}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {group.items.map((item) => renderRequirementCard(item))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Single Selected Category View */
                  <div className="space-y-2.5">
                    {filteredRequirements.map((item) => renderRequirementCard(item))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper to render an individual requirement card
  function renderRequirementCard(item) {
    const isInlineEditing = editingItemId === item.id;
    const isVerifiedInSource = item.evidence_verification?.is_verified !== false;

    return (
      <div
        key={item.id}
        className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2.5 ${
          item.is_approved
            ? 'bg-white dark:bg-surface-darkCard border-slate-200/90 dark:border-surface-darkBorder shadow-subtle ring-1 ring-emerald-500/15'
            : 'bg-slate-50/70 dark:bg-surface-darkBg border-slate-200/80 dark:border-surface-darkBorder'
        }`}
      >
        {isInlineEditing ? (
          /* Inline Edit Mode */
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500">Domain Category</label>
                <select
                  value={inlineEditValues.category}
                  onChange={(e) => setInlineEditValues({ ...inlineEditValues, category: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                >
                  {requirementCategories.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500">Classification</label>
                <select
                  value={inlineEditValues.classification}
                  onChange={(e) => setInlineEditValues({ ...inlineEditValues, classification: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white dark:bg-surface-darkCard font-semibold text-navy-950 dark:text-slate-100"
                >
                  <option value="Mandatory">Mandatory</option>
                  <option value="Preferred">Preferred</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500">Standardized Skill</label>
                <input
                  type="text"
                  value={inlineEditValues.normalized_skill}
                  onChange={(e) => setInlineEditValues({ ...inlineEditValues, normalized_skill: e.target.value })}
                  className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500">Requirement Text</label>
              <textarea
                rows={2}
                value={inlineEditValues.original_text}
                onChange={(e) => setInlineEditValues({ ...inlineEditValues, original_text: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded text-xs bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveInlineEdit(item.id)}
                className="px-3 py-1 bg-navy-900 text-white rounded text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mandatory vs Preferred toggle button */}
                <button
                  type="button"
                  onClick={() => isLatestVersion && handleToggleClassification(item.id)}
                  disabled={!isLatestVersion}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1 ${
                    !isLatestVersion
                      ? 'opacity-70 cursor-not-allowed bg-slate-100 text-slate-600 border-slate-300'
                      : item.classification === 'Mandatory'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100 cursor-pointer'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer'
                  }`}
                  title="Click to toggle Mandatory vs Preferred"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.classification === 'Mandatory' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {item.classification}
                </button>

                {/* Category Label Badge */}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-surface-darkBorder">
                  {segmentation?.available_categories?.find((c) => c.code === item.category)?.label || item.category.replace('_', ' ')}
                </span>

                {/* Normalized Skill Tag */}
                {item.normalized_skill && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold">
                    Skill: {item.normalized_skill}
                  </span>
                )}

                {/* Experience Years */}
                {item.experience_years != null && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {item.experience_years}+ Years
                  </span>
                )}

                {/* Provenance Origin Badge */}
                {item.source_origin === 'recruiter_added' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-200">
                    Recruiter Added
                  </span>
                ) : item.source_origin === 'recruiter_edited' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
                    Recruiter Edited
                  </span>
                ) : isVerifiedInSource ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800 flex items-center gap-1" title="Verbatim quote verified in source document">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                    Grounded • Verbatim
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-medium border border-cyan-200 dark:border-cyan-800 flex items-center gap-1" title="Inferred by Nemotron AI from context">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-600" />
                    AI Inferred
                  </span>
                )}

                {/* Recruiter Verification Toggle Button */}
                <button
                  type="button"
                  onClick={() => isLatestVersion && handleToggleVerification(item.id)}
                  disabled={!isLatestVersion}
                  title={isLatestVersion ? (item.is_approved ? "Recruiter Verified — click to unverify" : "Click to mark as Recruiter Verified") : "Historical revisions are read-only"}
                  className={`text-[10px] flex items-center gap-1 font-semibold ml-auto px-2.5 py-0.5 rounded-full border transition-all ${
                    !isLatestVersion
                      ? 'opacity-70 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                      : item.is_approved
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Check className={`w-3 h-3 ${item.is_approved ? 'text-emerald-600 font-bold' : 'text-slate-400'}`} />
                  <span>{item.is_approved ? 'Recruiter Verified' : 'Mark Verified'}</span>
                </button>
              </div>

              {/* Requirement Description */}
              <p className="font-semibold text-navy-950 dark:text-slate-100 leading-snug text-xs sm:text-[13px] pt-0.5">
                {item.original_text}
              </p>

              {/* Evidence Quote Locator Shortcut */}
              {item.evidence && (
                <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleLocateEvidence(item.evidence)}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-mono"
                    title="Click to highlight in source document"
                  >
                    <Quote className="w-2.5 h-2.5" />
                    <span className="truncate max-w-sm">"{item.evidence.slice(0, 60)}..."</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Icons: Edit & Delete */}
            {isLatestVersion && (
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleStartEdit(item)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Edit requirement"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setItemToDelete(item)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete requirement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
};
