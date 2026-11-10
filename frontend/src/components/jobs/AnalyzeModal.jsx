// Import React and useState hook.
import React, { useState, useEffect } from 'react';

// Import Modal component.
import { Modal } from '../common/Modal';

// Import icons from lucide-react.
import { Sparkles, CheckCircle2, Loader2, ArrowRight, ShieldCheck, Database } from 'lucide-react';

// Export AnalyzeModal simulating the Nemotron JD extraction pipeline.
export const AnalyzeModal = ({ job, isOpen, onClose, onAnalysisComplete }) => {
  // Current analysis step (0: idle/running, 1: chunking, 2: LLM extraction, 3: vector matching, 4: completed).
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(true);

  // Run simulation sequence when modal opens.
  useEffect(() => {
    if (!isOpen || !job) {
      setStep(1);
      setIsProcessing(true);
      return;
    }

    // Step 1 to Step 2 timer
    const t1 = setTimeout(() => setStep(2), 700);
    // Step 2 to Step 3 timer
    const t2 = setTimeout(() => setStep(3), 1400);
    // Step 3 to Completion timer
    const t3 = setTimeout(() => {
      setStep(4);
      setIsProcessing(false);
      if (onAnalysisComplete) {
        onAnalysisComplete(job.id);
      }
    }, 2100);

    // Cleanup timeouts
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen, job]);

  // If job is null, do not render.
  if (!job) return null;

  // Render analysis modal.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nemotron JD Intelligence Analyzer"
      subtitle={`Processing: ${job.jdCode} — ${job.title}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Pipeline Execution Stepper */}
        <div className="space-y-3">
          {/* Step 1: Document Ingestion */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-slate-200/60 text-xs">
            {step > 1 ? (
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-navy-900">
                1. Text Ingestion & Section Normalization
              </div>
              <p className="text-slate-500 text-[11px]">
                Read {job.sourceFilename} • SHA-256 integrity validated
              </p>
            </div>
            {step > 1 && (
              <span className="text-[10px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded font-mono">
                DONE
              </span>
            )}
          </div>

          {/* Step 2: OpenRouter Nemotron Extraction */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-slate-200/60 text-xs">
            {step > 2 ? (
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            ) : step === 2 ? (
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-navy-900">
                2. Nemotron LLM Schema Extraction
              </div>
              <p className="text-slate-500 text-[11px]">
                nvidia/nemotron-4-340b-instruct • Extracting mandatory & preferred criteria
              </p>
            </div>
            {step > 2 && (
              <span className="text-[10px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded font-mono">
                DONE
              </span>
            )}
          </div>

          {/* Step 3: Vector Embeddings & Talent Matching */}
          <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-slate-200/60 text-xs">
            {step > 3 ? (
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
            ) : step === 3 ? (
              <Loader2 className="w-4 h-4 text-brand-600 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-navy-900">
                3. ChromaDB Semantic Vector Indexing
              </div>
              <p className="text-slate-500 text-[11px]">
                Generating embeddings & ranking candidate profiles by cosine similarity
              </p>
            </div>
            {step > 3 && (
              <span className="text-[10px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded font-mono">
                DONE
              </span>
            )}
          </div>
        </div>

        {/* Completion summary card */}
        {step === 4 && (
          <div className="p-4 bg-brand-50/50 border border-brand-200 rounded-2xl space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Analysis Complete & Validated
              </span>
              <span className="text-brand-700 font-semibold font-mono">Confidence: 96%</span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Extracted 4 mandatory technical requirements and mapped against local talent pool.
              Candidate matches updated with evidence quotes.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-medium text-xs shadow-subtle transition-colors"
            >
              Done — View Analyzed Criteria
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
