// Dedicated modal for generating, previewing, and exporting the
// Recruiter-Friendly Market Intelligence & Target Company Sourcing Report.
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileBarChart2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { jobApi } from '../../api/client';

export const MarketReportModal = ({ isOpen, onClose, job, hasTargetCompanies }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState('');
  const [error, setError] = useState('');
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const jobIdParam = job?.numeric_id || job?.id;
  const hasJd = Boolean((job?.originalText || job?.description || '').trim());
  const todayDisplay = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Reset report preview whenever the user switches to a different requisition.
  useEffect(() => {
    setReport(null);
    setError('');
    setRecruiterNotes('');
    setCopiedKey('');
  }, [jobIdParam]);

  const handleGenerate = async (forceRefresh = false) => {
    if (!jobIdParam || !hasJd || !hasTargetCompanies) return;
    setLoading(true);
    setError('');
    try {
      const data = await jobApi.generateMarketReport(jobIdParam, {
        force_refresh: forceRefresh,
        allow_llm: true,
        recruiter_notes: recruiterNotes,
      });
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Failed to generate market intelligence report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format) => {
    if (!jobIdParam) return;
    setDownloadingFormat(format);
    setError('');
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
    const ext = format === 'word' ? 'docx' : 'pdf';
    try {
      const qs = recruiterNotes ? `?notes=${encodeURIComponent(recruiterNotes)}` : '';
      const response = await fetch(
        `${apiBase}/jobs/${encodeURIComponent(jobIdParam)}/market-report/${format}${qs}`
      );
      if (!response.ok) {
        throw new Error(`Report download failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = (job?.title || 'Job').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `Market_Intelligence_Report_${safeTitle}_${dateStr}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || `Failed to download ${format.toUpperCase()} report.`);
    } finally {
      setDownloadingFormat('');
    }
  };

  const handleCopy = async (key, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts.
    }
  };

  const meta = report?.report_metadata || {};
  const secA = report?.section_a_job_overview || {};
  const secB = report?.section_b_sourcing_strategy || {};
  const secC = report?.section_c_target_companies || {};
  const secD = report?.section_d_market_intelligence || {};
  const titles = report?.suggested_job_titles || {};
  const skills = report?.important_skills || {};
  const searches = report?.recruiter_search_suggestions || {};
  const plan = report?.recruiter_action_plan || {};
  const provenance = report?.provenance || {};
  const refs = report?.source_references || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Market Intelligence & Target Company Sourcing Report"
      subtitle="Recruiter-friendly sourcing brief combining JD requirements, target companies, Boolean searches, and sourced market data"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-300">
        {/* Top Requisition Summary Card */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-blue-950 dark:text-blue-100">
                {job?.title || 'Selected Requisition'}
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Requisition ID: <span className="font-semibold">REQ-{String(jobIdParam || '').padStart(4, '0')}</span>
                {'  |  '}Location: <span className="font-semibold">{job?.location || 'Not specified'}</span>
                {'  |  '}Date: <span className="font-semibold">{meta.generated_date || todayDisplay}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleGenerate(Boolean(report))}
                disabled={loading || !hasJd || !hasTargetCompanies}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all shadow-subtle cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : report ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <FileBarChart2 className="w-3.5 h-3.5" />
                )}
                <span>{loading ? 'Generating...' : report ? 'Refresh Report' : 'Generate Report'}</span>
              </button>

              {report && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownload('pdf')}
                    disabled={Boolean(downloadingFormat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-all shadow-subtle cursor-pointer"
                  >
                    {downloadingFormat === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('word')}
                    disabled={Boolean(downloadingFormat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-subtle cursor-pointer"
                  >
                    {downloadingFormat === 'word' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Download Word</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-blue-900/80 dark:text-blue-200/80">
            Contains: Job Overview, Sourcing Strategy, Target Companies (Tier 1/2/3), Real Market Hiring Activity &amp; Skills, Suggested Job Titles, Ready-to-Use Boolean Searches, and a Recruiter Action Plan with clickable source links.
          </p>
        </div>

        {/* Missing JD or Target Companies Guard */}
        {(!hasJd || !hasTargetCompanies) && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Cannot generate report yet</p>
              <p>
                {!hasJd
                  ? 'The selected requisition does not have a Job Description recorded.'
                  : 'Target Company recommendations are not loaded yet for this requisition.'}
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Partial Market Research Warning with Retry */}
        {report && provenance.failed_sources?.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
            <div>
              <span className="font-semibold">Partial external market research: </span>
              <span>{provenance.failed_sources.join(' | ')}</span>
            </div>
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700 shrink-0"
            >
              Retry Research
            </button>
          </div>
        )}

        {/* Report Preview */}
        {report && (
          <div className="space-y-5">
            {/* Section A — Job Overview */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Section A — Job Overview</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Verified information
                </span>
              </div>
              <p className="leading-relaxed">{secA.role_summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-surface-darkBg p-3 rounded-lg">
                <div><span className="font-semibold">Experience:</span> {secA.experience_required}</div>
                <div><span className="font-semibold">Employment Type:</span> {secA.employment_type}</div>
                <div><span className="font-semibold">Domain:</span> {secA.domain}</div>
                <div><span className="font-semibold">Location:</span> {secA.location}</div>
                <div className="sm:col-span-2"><span className="font-semibold">Mandatory Skills:</span> {(secA.mandatory_skills || []).join(', ') || 'None specified'}</div>
                <div className="sm:col-span-2"><span className="font-semibold">Preferred Skills:</span> {(secA.preferred_skills || []).join(', ') || 'None specified'}</div>
              </div>
              {secA.responsibilities?.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Main Responsibilities:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {secA.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </section>

            {/* Section B — Sourcing Strategy */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Section B — Sourcing Strategy</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Recruiter suggestion
                </span>
              </div>
              <p>{secB.sourcing_approach}</p>
              <p><span className="font-semibold">Direct vs. Transferable Experience:</span> {secB.direct_vs_transferable}</p>
              <p><span className="font-semibold">Priority Locations:</span> {(secB.priority_locations || []).join(', ')}</p>
            </section>

            {/* Section C — Target Companies */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>Section C — Target Companies ({secC.total_companies || 0})</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  {secC.ecosystem_name}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-surface-darkBorder">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-blue-900 text-white">
                    <tr>
                      <th className="p-2">Company Name</th>
                      <th className="p-2">Tier</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Location</th>
                      <th className="p-2">Why Target</th>
                      <th className="p-2">Suggested Titles</th>
                      <th className="p-2">Important Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(secC.companies || []).map((co, idx) => (
                      <tr key={idx} className="border-t border-slate-200 dark:border-surface-darkBorder even:bg-slate-50/70 dark:even:bg-slate-900/30">
                        <td className="p-2 font-semibold">{co.company_name}</td>
                        <td className="p-2 whitespace-nowrap">{co.tier}</td>
                        <td className="p-2">{co.industry_category}</td>
                        <td className="p-2">{co.location}</td>
                        <td className="p-2">{co.why_target}</td>
                        <td className="p-2">{co.suggested_job_titles}</td>
                        <td className="p-2">{co.important_skills}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section D — Real Market Intelligence */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Section D — Real Market Intelligence</h4>
                <span className="text-[11px] text-slate-500">Researched: {meta.research_performed_date}</span>
              </div>

              <div>
                <p className="font-semibold mb-1.5">1. Company Hiring Activity (Verified public postings)</p>
                {secD.company_hiring_activity?.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-surface-darkBorder">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="p-2">Company</th>
                          <th className="p-2">Job Title</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Experience</th>
                          <th className="p-2">Posted</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secD.company_hiring_activity.map((p, idx) => (
                          <tr key={idx} className="border-t border-slate-200 dark:border-surface-darkBorder">
                            <td className="p-2 font-semibold">{p.company_name}</td>
                            <td className="p-2">{p.job_title}</td>
                            <td className="p-2">{p.location}</td>
                            <td className="p-2">{p.experience_requirement}</td>
                            <td className="p-2 whitespace-nowrap">{p.posted_date}</td>
                            <td className="p-2">{p.vacancy_status}</td>
                            <td className="p-2">
                              <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                                <span>{p.source_name}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="italic text-slate-500">Market information not available for this section.</p>
                )}
              </div>

              <div>
                <p className="font-semibold">2. Market Hiring Trends</p>
                <p>{secD.market_hiring_trends?.summary}</p>
              </div>

              <div>
                <p className="font-semibold">3. In-Demand Skills</p>
                <p>
                  <span className="font-medium">Additional Market Skills:</span>{' '}
                  {skills.additional_market_skills?.length > 0
                    ? skills.additional_market_skills.map((s) => `${s.skill} (${s.mentions} postings)`).join(', ')
                    : 'None observed across multiple postings'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {secD.in_demand_skills?.sample_limitation_note} {skills.additional_skills_note}
                </p>
              </div>

              <div>
                <p className="font-semibold">4. Location Intelligence</p>
                <p>
                  Requested: {secD.location_intelligence?.requested_location} | Remote mentions:{' '}
                  {secD.location_intelligence?.remote_mentions_count ?? 0} of{' '}
                  {secD.location_intelligence?.total_postings_reviewed ?? 0} postings
                </p>
              </div>

              <div>
                <p className="font-semibold">5. Salary and Compensation Information</p>
                {secD.salary_and_compensation?.available && secD.salary_and_compensation?.entries?.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {secD.salary_and_compensation.entries.map((e, i) => (
                      <li key={i}>
                        <span className="font-semibold">{e.salary_range}</span> — {e.role} ({e.location}, {e.classification}) —{' '}
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                          {e.source_name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic text-slate-500">
                    {secD.salary_and_compensation?.note || 'Market information not available for this section.'}
                  </p>
                )}
              </div>

              <div>
                <p className="font-semibold">6. Competitor and Talent-Pool Insights</p>
                <p>{secD.competitor_and_talent_pool_insights?.summary}</p>
              </div>
            </section>

            {/* Suggested Job Titles & Boolean Searches */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Search className="w-4 h-4" />
                  <span>Suggested Job Titles &amp; Boolean Searches</span>
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'titles',
                      [
                        ...(titles.direct_titles || []),
                        ...(titles.alternative_titles || []),
                        ...(titles.adjacent_industry_titles || []),
                      ].join(', ')
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-semibold"
                >
                  {copiedKey === 'titles' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'titles' ? 'Copied Titles' : 'Copy All Titles'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div><span className="font-semibold">Direct:</span> {(titles.direct_titles || []).join(', ') || 'N/A'}</div>
                <div><span className="font-semibold">Alternative:</span> {(titles.alternative_titles || []).join(', ') || 'N/A'}</div>
                <div><span className="font-semibold">Adjacent Industry:</span> {(titles.adjacent_industry_titles || []).join(', ') || 'N/A'}</div>
                <div><span className="font-semibold">Market Observed:</span> {(titles.market_observed_titles || []).join(', ') || 'None observed'}</div>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'naukri', label: 'Naukri Resdex', query: searches.naukri?.query },
                  { key: 'linkedin', label: 'LinkedIn Recruiter', query: searches.linkedin?.query },
                  { key: 'google_xray', label: 'Google X-Ray', query: searches.google_xray?.query },
                ].map((item) => (
                  <div key={item.key} className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[11px]">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.key, item.query)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {copiedKey === item.key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === item.key ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <code className="block font-mono text-[11px] break-all text-slate-800 dark:text-slate-200">
                      {item.query || 'N/A'}
                    </code>
                  </div>
                ))}
              </div>
            </section>

            {/* Recruiter Action Plan & Optional Notes */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-2.5">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Recruiter Action Plan</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1">
                <li><span className="font-semibold">Prioritize First:</span> {(plan.prioritize_companies_first || []).join(', ')}</li>
                <li><span className="font-semibold">Titles to Search:</span> {(plan.suggested_titles_to_search || []).join(', ')}</li>
                <li><span className="font-semibold">Core Skills Focus:</span> {(plan.important_skills_focus || []).join(', ')}</li>
                <li><span className="font-semibold">Priority Locations:</span> {(plan.priority_locations || []).join(', ')}</li>
                <li><span className="font-semibold">Adjacent Industries:</span> {(plan.adjacent_industries || []).join(', ')}</li>
              </ol>
              <div>
                <label className="block font-semibold mb-1">Recruiter Notes (optional — included in PDF &amp; Word downloads):</label>
                <textarea
                  rows={2}
                  value={recruiterNotes}
                  onChange={(e) => setRecruiterNotes(e.target.value)}
                  placeholder="Add sourcing observations, hiring manager feedback, or priority notes..."
                  className="w-full rounded-lg border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </section>

            {/* Source References */}
            <section className="rounded-xl border border-slate-200 dark:border-surface-darkBorder p-4 space-y-2">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Source References ({refs.length})</h4>
              {refs.length > 0 ? (
                <ul className="space-y-1 text-[11px]">
                  {refs.map((ref, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{ref.source_name}:</span>
                      <a href={ref.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                        <span>{ref.title}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-slate-500">
                        (Published: {ref.published_date} | Accessed: {ref.accessed_date} | {ref.evidence_type})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-slate-500">No external source links were retrieved.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
};
