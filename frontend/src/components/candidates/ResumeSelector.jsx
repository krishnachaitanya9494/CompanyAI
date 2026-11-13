// Accessible multi-version resume dropdown selector for candidate profiles and resume preview.
import React, { useState, useRef, useEffect } from 'react';
import { FileText, ChevronDown, Check, Calendar, ShieldCheck } from 'lucide-react';

/**
 * Derive short document format badge from filename extension without guessing missing data.
 */
function getDocType(filename = '') {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return 'DOC';
  return filename.slice(idx + 1).toUpperCase();
}

/**
 * ResumeSelector renders a clean dropdown ONLY when a candidate has multiple resumes (`resumes.length > 1`).
 * When only one resume exists, it displays a static, readable document pill to avoid unnecessary controls.
 * Strictly scopes all state to the passed `resumes` prop so resumes are never mixed across candidates.
 */
export const ResumeSelector = ({
  resumes = [],
  selectedResumeId = null,
  onSelectResume,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown smoothly on outside click or Escape key.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Reset open state whenever the candidate's resume list changes.
  useEffect(() => {
    setIsOpen(false);
  }, [resumes]);

  if (!Array.isArray(resumes) || resumes.length === 0) {
    return null;
  }

  // Resolve currently selected resume cleanly, defaulting to the first persisted version.
  const activeIndex = resumes.findIndex((r) => String(r.id) === String(selectedResumeId));
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeResume = resumes[resolvedIndex];
  const activeVersion = `v${resolvedIndex + 1}`;
  const activeType = getDocType(activeResume.filename);

  // Avoid unnecessary dropdown controls when candidate has only a single stored resume.
  if (resumes.length === 1) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-surface-darkBorder text-xs ${className}`}
      >
        <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
        <span className="font-semibold text-navy-900 dark:text-slate-100 truncate max-w-[200px]">
          {activeResume.filename || 'Stored Resume'}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
          {activeType}
        </span>
        {!compact && activeResume.uploadedAt && (
          <span className="text-[11px] text-slate-400 hidden sm:inline">• {activeResume.uploadedAt}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-surface-darkCard border border-brand-300/90 dark:border-brand-700 hover:border-brand-500 text-xs shadow-subtle transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
          <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-[10px] font-bold font-mono flex-shrink-0">
            {activeVersion} / {resumes.length}
          </span>
          <span className="font-semibold text-navy-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-[220px]">
            {activeResume.filename || `Resume #${activeResume.id}`}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 flex-shrink-0">
            {activeType}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
            isOpen ? 'rotate-180 text-brand-600' : ''
          }`}
        />
      </button>

      {/* Smooth dropdown menu listing all historical & active resume versions */}
      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select candidate resume version"
          className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-80 max-w-[90vw] bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-2xl shadow-dropdown p-1.5 z-50 animate-slideDown space-y-1"
        >
          <li className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Resume Versions ({resumes.length})</span>
            <span>Select to Preview</span>
          </li>
          {resumes.map((res, idx) => {
            const isSelected = String(res.id) === String(activeResume.id);
            const docType = getDocType(res.filename);
            return (
              <li key={res.id || idx}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setIsOpen(false);
                    if (onSelectResume) onSelectResume(res);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-start justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-brand-50/90 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800'
                      : 'hover:bg-slate-50 dark:hover:bg-surface-darkHover border border-transparent'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-slate-200">
                        v{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-navy-900 dark:text-slate-100 truncate">
                        {res.filename || `Resume #${res.id}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold">{docType}</span>
                      {res.uploadedAt && (
                        <span className="inline-flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {res.uploadedAt}
                        </span>
                      )}
                      {res.hasEmbedding && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Indexed
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ResumeSelector;
