import React from 'react';
import { FileText, LoaderCircle, Upload } from 'lucide-react';
import { AIModelBadge } from '../common/AIModelBadge';

/** Keep the comparison entry point focused on pasting or uploading the two source documents. */
export const ComparisonHeader = ({
  adhocJdText,
  setAdhocJdText,
  adhocResumeText,
  setAdhocResumeText,
  handleRunAdhocComparison,
  isLoading,
  onUploadText,
}) => (
  <div className="space-y-4">
    <header className="border-b border-slate-200 pb-3 dark:border-surface-darkBorder">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-bold text-navy-950 dark:text-slate-100 sm:text-2xl">JD vs Resume Comparison</h1>
        <AIModelBadge models="nomic-embed-text + llama3.2:3b" />
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paste text or upload a job description and resume.</p>
    </header>
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-surface-darkBorder dark:bg-surface-darkCard">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-surface-darkBorder">
        <FileText className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-navy-950 dark:text-slate-100">Add your job description and resume</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Job Description" text={adhocJdText} onChange={setAdhocJdText} onUpload={(file) => onUploadText('jd', file)} placeholder="Paste the job description here…" />
        <TextInput label="Candidate Resume" text={adhocResumeText} onChange={setAdhocResumeText} onUpload={(file) => onUploadText('resume', file)} placeholder="Paste the resume here…" />
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={handleRunAdhocComparison} disabled={isLoading || !adhocJdText.trim() || !adhocResumeText.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {isLoading ? 'Comparing…' : 'Compare JD and resume'}
        </button>
      </div>
    </section>
  </div>
);

function TextInput({ label, text, onChange, onUpload, placeholder }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-within:ring-2 focus-within:ring-indigo-500/30 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
          <Upload className="h-3.5 w-3.5" /> Upload
          <input className="sr-only" type="file" accept=".pdf,.docx,.txt" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = '';
          }} />
        </label>
      </div>
      <textarea rows={9} value={text} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-surface-darkBorder dark:bg-surface-darkBg dark:text-slate-100" />
    </div>
  );
}
