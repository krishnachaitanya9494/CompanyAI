import React from 'react';
import { BookOpen, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const STATUS_STYLE = {
  DIRECT_MATCH: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  EQUIVALENT_MATCH: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  PARTIAL_MATCH: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  MISSING: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  UNVERIFIED: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const STATUS_LABEL = {
  DIRECT_MATCH: 'Direct match',
  EQUIVALENT_MATCH: 'Equivalent',
  PARTIAL_MATCH: 'Partial',
  MISSING: 'Missing',
  UNVERIFIED: 'Unverified',
};

const FILTERS = [
  ['all', 'All'],
  ['satisfied', 'Satisfied'],
  ['partial', 'Partial'],
  ['mandatory_gap', 'Mandatory gaps'],
  ['preferred_gap', 'Preferred gaps'],
  ['unverified', 'Unverified'],
  ['responsibility', 'Responsibilities'],
];

const getEvidenceStatus = (req) => req.evidence_status || (
  req.verification_status === 'UNVERIFIED' || req.status === 'UNVERIFIED' ? 'UNVERIFIED'
    : req.status === 'SATISFIED' ? 'DIRECT_MATCH'
      : req.status === 'PARTIAL' ? 'PARTIAL_MATCH' : 'MISSING'
);

export const RequirementsAlignmentTable = ({
  filteredRequirements = [],
  requirementFilter = 'all',
  setRequirementFilter,
}) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-surface-darkBorder dark:bg-surface-darkCard">
    <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-surface-darkBorder lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
          <BookOpen className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-navy-950 dark:text-slate-100">JD requirements and resume evidence</h3>
          <p className="mt-0.5 text-xs text-slate-500">{filteredRequirements.length} requirements shown · evidence is quoted from the resume</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Filter requirements">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setRequirementFilter(value)}
            aria-pressed={requirementFilter === value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              requirementFilter === value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[35%]" />
          <col className="w-[28%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3">Requirement</th>
            <th scope="col" className="px-4 py-3">JD details</th>
            <th scope="col" className="px-4 py-3">Resume evidence</th>
            <th scope="col" className="px-4 py-3">Assessment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRequirements.map((req, idx) => {
            const status = getEvidenceStatus(req);
            const responsibility = req.classification === 'Responsibility';
            const hasEvidence = Boolean(req.evidence && req.evidence_source !== 'none' && !/^no (?:direct |explicit )?evidence/i.test(req.evidence));
            const StatusIcon = status === 'DIRECT_MATCH' || status === 'EQUIVALENT_MATCH' ? CheckCircle2 : status === 'MISSING' ? XCircle : AlertTriangle;
            return (
              <tr key={req.requirement_id || idx} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                <td className="px-4 py-4">
                  <div className="font-semibold leading-5 text-navy-950 dark:text-slate-100">{req.category_label || req.category || 'Requirement'}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${responsibility ? 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : req.classification === 'Mandatory' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                      {responsibility ? 'Interview probe' : req.classification}
                    </span>
                    {req.jd_source_line != null && <span className="py-0.5 text-[10px] text-slate-400">JD line {req.jd_source_line}</span>}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs leading-5 text-slate-700 dark:text-slate-300">{req.original_text}</td>
                <td className="px-4 py-4">
                  {hasEvidence ? (
                    <>
                      <blockquote className="border-l-2 border-indigo-300 pl-2.5 text-xs leading-5 text-slate-700 dark:border-indigo-700 dark:text-slate-300">“{req.evidence}”</blockquote>
                      {req.evidence_source && <p className="mt-1.5 text-[10px] text-slate-400">Source: {req.evidence_source}</p>}
                    </>
                  ) : <span className="text-xs italic text-slate-400">{status === 'UNVERIFIED' ? 'Resume text is insufficient to verify this requirement' : 'No supporting evidence found in the reviewed resume'}</span>}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold ${responsibility ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300' : STATUS_STYLE[status] || STATUS_STYLE.UNVERIFIED}`}>
                    {!responsibility && <StatusIcon className="h-3.5 w-3.5" />}
                    {responsibility ? 'Probe' : STATUS_LABEL[status] || STATUS_LABEL.UNVERIFIED}
                  </span>
                  {req.explanation && <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{req.explanation}</p>}
                  <p className="mt-2 text-[10px] font-semibold text-slate-500">
                    {req.score_contribution == null ? 'No score contribution' : `Contribution ${req.score_contribution}%`}
                  </p>
                </td>
              </tr>
            );
          })}
          {filteredRequirements.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">No requirements match this filter.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);
