// Import React hooks for executing real backend Nemotron JD analysis.
import React, { useState, useEffect } from 'react';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import jobApi service to trigger genuine SQLite segmentation and JDAnalysis sync.
import { jobApi } from '../../api/client';

// Import icons from lucide-react.
import { Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

// Export AnalyzeModal executing the real Nemotron JD extraction pipeline via FastAPI.
export const AnalyzeModal = ({ job, isOpen, onClose, onAnalysisComplete }) => {
  // Pipeline execution stages: running | complete | error.
  const [status, setStatus] = useState('running');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Execute real POST /api/jobs/{id}/analyze call when modal opens.
  useEffect(() => {
    if (!isOpen || !job?.id) {
      setStatus('running');
      setAnalysisResult(null);
      setErrorMsg('');
      return;
    }

    let cancelled = false;
    setStatus('running');
    setErrorMsg('');

    jobApi
      .analyze(job.id)
      .then((res) => {
        if (cancelled) return;
        setAnalysisResult(res?.analysis || null);
        setStatus('complete');
        if (onAnalysisComplete) {
          onAnalysisComplete(job.id, res?.analysis);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message || 'Analysis request failed.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, job?.id]);

  // If job is null, do not render.
  if (!job) return null;

  const extractedCount = analysisResult?.extractedResponsibilities?.length ?? 0;

  // Render analysis modal.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nemotron JD Intelligence Analyzer"
      subtitle={`Processing: ${job.jdCode || job.code} — ${job.title}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Pipeline Execution Stepper */}
        <div className="space-y-3">
          {/* Step 1: Document Ingestion */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-surface-darkBorder text-xs">
            {status === 'complete' ? (
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            ) : status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-navy-900 dark:text-slate-100">
                1. JD Segmentation & Responsibility Extraction
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                {job.sourceFilename || 'Stored job description'} • SQLite requirement schema check
              </p>
            </div>
            {status === 'complete' && (
              <span className="text-[10px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 rounded font-mono">
                DONE
              </span>
            )}
          </div>

          {/* Step 2: SQLite JDAnalysis Sync */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-surface-darkBorder text-xs">
            {status === 'complete' ? (
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            ) : status === 'running' ? (
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-navy-900 dark:text-slate-100">
                2. Persisted Vector & Criteria Sync
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Model: {analysisResult?.modelUsed || 'Nemotron / Heuristic Extractor'} • 2048-dim SQLite store
              </p>
            </div>
            {status === 'complete' && (
              <span className="text-[10px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 rounded font-mono">
                DONE
              </span>
            )}
          </div>
        </div>

        {/* Error Display */}
        {status === 'error' && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Completion summary card */}
        {status === 'complete' && analysisResult && (
          <div className="p-4 bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-2xl space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Analysis Complete & Persisted
              </span>
              <span className="text-brand-700 dark:text-brand-300 font-semibold font-mono">
                Confidence: {analysisResult.confidenceScore ?? 0}%
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Extracted {extractedCount} grounded core responsibility statements (Segmentation v{analysisResult.segmentationVersion || 1}).
            </p>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 text-white rounded-xl font-medium text-xs shadow-subtle transition-colors"
            >
              Done — View Analyzed Criteria
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
