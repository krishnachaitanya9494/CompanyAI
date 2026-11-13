// Import React for JSX structure and local approval notice state.
import React, { useState, useMemo, useEffect, useRef } from 'react';

// Import Badge and CustomSelect components for skills, status pills, and beautified dropdowns.
import { Badge } from '../common/Badge';
import { CustomSelect } from '../common/CustomSelect';

// Import MatchingCandidates subcomponent.
import { MatchingCandidates } from './MatchingCandidates';

// Import approvalApi for JD approval submission.
import { approvalApi } from '../../api/client';

// Import icons from lucide-react.
import {
  Briefcase,
  MapPin,
  Sparkles,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Users,
  ChevronDown,
  Building2,
  Search,
  Copy,
  Check,
  Plus,
  X,
  ExternalLink,
  Globe,
  Zap,
  Edit3,
  RotateCcw,
  SlidersHorizontal,
  ShieldAlert,
} from 'lucide-react';

// Deterministic stack-to-ecosystem company suggestions for recruiter sourcing (advisory only).
const STACK_COMPANY_ECOSYSTEMS = [
  {
    keywords: ['sap', 'cpi', 's/4hana', 'abap', 'integration suite', 'pi/po'],
    companies: ['SAP Labs', 'Accenture', 'Infosys', 'Capgemini', 'Deloitte', 'Wipro', 'TCS', 'IBM Consulting'],
  },
  {
    keywords: ['fccs', 'epm', 'hyperion', 'hfm', 'smart view', 'oracle'],
    companies: ['Oracle', 'Deloitte', 'PwC', 'EY', 'KPMG', 'Accenture', 'Genpact', 'Cognizant'],
  },
  {
    keywords: ['teamcenter', 'bmide', 'plm', 'active workspace', 'siemens', 'itk'],
    companies: ['Siemens Digital Industries', 'Tata Technologies', 'L&T Technology Services', 'HCLTech', 'Capgemini', 'Quest Global'],
  },
  {
    keywords: ['java', 'spring', 'microservices', 'hibernate', 'kafka'],
    companies: ['TCS', 'Infosys', 'Cognizant', 'Persistent Systems', 'EPAM Systems', 'Thoughtworks', 'Publicis Sapient'],
  },
  {
    keywords: ['.net', 'c#', 'azure', 'sql server', 'asp.net'],
    companies: ['Microsoft', 'Nagarro', 'LTIMindtree', 'HCLTech', 'Accenture', 'Coforge', 'Mphasis'],
  },
  {
    keywords: ['react', 'javascript', 'typescript', 'frontend', 'node', 'python', 'fastapi'],
    companies: ['Zoho', 'Freshworks', 'Razorpay', 'Flipkart', 'Swiggy', 'Atlassian', 'BrowserStack'],
  },
  {
    keywords: ['qa', 'selenium', 'automation testing', 'manual testing', 'playwright', 'cypress'],
    companies: ['BrowserStack', 'Infosys', 'Cognizant', 'Capgemini', 'Wipro', 'Qualitest', 'GlobalLogic'],
  },
];

// Export JobDetail component for displaying deep specifications and matched applicants with customizable status.
export const JobDetail = ({
  job,
  matchingCandidates = [],
  onAnalyzeJob,
  onSelectCandidate,
  onUpdateJob,
  onOpenSegmentation,
  onOpenMatrix,
  onRefreshApprovals,
}) => {
  const [approvalSentMsg, setApprovalSentMsg] = useState('');
  const [naukriStrictAnd, setNaukriStrictAnd] = useState(true);
  const [includePreferredInBoolean, setIncludePreferredInBoolean] = useState(false);
  const [includeCompaniesInBoolean, setIncludeCompaniesInBoolean] = useState(false);
  const [includeLocationInBoolean, setIncludeLocationInBoolean] = useState(false);
  const [includeNoticeInBoolean, setIncludeNoticeInBoolean] = useState(false);
  const [includeExclusionsInBoolean, setIncludeExclusionsInBoolean] = useState(false);
  const [includeSeniorityInBoolean, setIncludeSeniorityInBoolean] = useState(false);
  const [sourcingPlatform, setSourcingPlatform] = useState('naukri'); // 'naukri' | 'linkedin' | 'xray'
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [customCompanies, setCustomCompanies] = useState([]);
  const [customCompanyInput, setCustomCompanyInput] = useState('');
  const [showAddCompanyInput, setShowAddCompanyInput] = useState(false);
  const [copiedBoolean, setCopiedBoolean] = useState(false);

  // Custom Query Editor state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customQueryText, setCustomQueryText] = useState('');
  const queryInputRef = useRef(null);

  // Reset company selection, custom query & copy state when switching jobs.
  useEffect(() => {
    setSelectedCompanies([]);
    setCustomCompanies([]);
    setCustomCompanyInput('');
    setShowAddCompanyInput(false);
    setCopiedBoolean(false);
    setIsCustomMode(false);
    setCustomQueryText('');
  }, [job?.id]);

  // Derive JD-related target sourcing companies from the job's title & skill stack.
  const relatedCompanies = useMemo(() => {
    if (!job) return [];
    const haystack = [
      job.title || '',
      job.department || '',
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
    ]
      .join(' ')
      .toLowerCase();

    const matched = new Set();
    STACK_COMPANY_ECOSYSTEMS.forEach((group) => {
      if (group.keywords.some((kw) => haystack.includes(kw))) {
        group.companies.forEach((c) => matched.add(c));
      }
    });
    if (matched.size === 0) {
      ['TCS', 'Infosys', 'Accenture', 'Capgemini', 'Cognizant', 'Wipro', 'HCLTech'].forEach((c) =>
        matched.add(c)
      );
    }
    return Array.from(matched).slice(0, 8);
  }, [job]);

  // Combined company list (derived + custom added)
  const allCompanies = useMemo(() => {
    const combined = [...relatedCompanies];
    customCompanies.forEach((c) => {
      if (!combined.includes(c)) combined.push(c);
    });
    return combined;
  }, [relatedCompanies, customCompanies]);

  // Build ready-to-paste Boolean search string for Naukri, LinkedIn, or Google X-Ray.
  const autoBooleanQuery = useMemo(() => {
    if (!job) return '';
    const quote = (term) => {
      const cleaned = String(term || '').trim();
      if (!cleaned) return '';
      return /\s|[\/\-+&]/.test(cleaned) ? `"${cleaned}"` : cleaned;
    };

    const parts = [];

    // Title / Role keywords
    const titleWords = (job.title || '')
      .split(/[\/,|()-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 3)
      .map(quote)
      .filter(Boolean);
    if (titleWords.length > 0) {
      parts.push(`(${titleWords.join(' OR ')})`);
    }

    // Seniority / Lead focus (optional)
    if (includeSeniorityInBoolean) {
      parts.push('("Lead" OR "Senior" OR "Staff" OR "Principal" OR "Architect")');
    }

    // Mandatory Skills
    const mandatory = (job.requiredSkills || []).map(quote).filter(Boolean);
    if (mandatory.length > 0) {
      parts.push(`(${mandatory.join(naukriStrictAnd ? ' AND ' : ' OR ')})`);
    }

    // Preferred Skills (optional)
    if (includePreferredInBoolean) {
      const preferred = (job.preferredSkills || []).map(quote).filter(Boolean);
      if (preferred.length > 0) {
        parts.push(`(${preferred.join(' OR ')})`);
      }
    }

    // Target Companies (optional)
    const activeCompanies =
      selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
    if (includeCompaniesInBoolean && activeCompanies.length > 0) {
      parts.push(`(${activeCompanies.map(quote).join(' OR ')})`);
    }

    // Location filter (optional)
    if (includeLocationInBoolean && job.location) {
      const locList = job.location
        .split(/[\/,]+/)
        .map((l) => l.trim())
        .filter((l) => l && !/india/i.test(l))
        .map(quote);
      if (locList.length > 0) {
        parts.push(`(${locList.join(' OR ')})`);
      }
    }

    // Immediate Notice booster (optional)
    if (includeNoticeInBoolean) {
      parts.push('("Immediate" OR "15 Days" OR "30 Days" OR "Serving Notice")');
    }

    let coreQuery = parts.join(' AND ');

    // Exclusion filter: drop interns, trainees, students, freshers (optional)
    if (includeExclusionsInBoolean) {
      coreQuery += ' NOT ("Intern" OR "Trainee" OR "Student" OR "Fresher")';
    }

    if (sourcingPlatform === 'xray') {
      return `site:linkedin.com/in ${coreQuery}`;
    }

    return coreQuery;
  }, [
    job,
    naukriStrictAnd,
    includePreferredInBoolean,
    includeCompaniesInBoolean,
    includeLocationInBoolean,
    includeNoticeInBoolean,
    includeSeniorityInBoolean,
    includeExclusionsInBoolean,
    sourcingPlatform,
    selectedCompanies,
    allCompanies,
  ]);

  // Active query: user's custom edited string if in Custom Mode, otherwise AI auto-generated.
  const activeBooleanQuery = isCustomMode ? customQueryText : autoBooleanQuery;

  // Toggle Custom Query Mode
  const handleToggleCustomMode = () => {
    if (!isCustomMode) {
      setCustomQueryText(autoBooleanQuery);
      setIsCustomMode(true);
      setTimeout(() => queryInputRef.current?.focus(), 50);
    } else {
      setIsCustomMode(false);
    }
  };

  // Revert custom query back to AI auto-generated
  const handleResetToAutoQuery = () => {
    setCustomQueryText(autoBooleanQuery);
    setIsCustomMode(false);
  };

  // Insert Boolean operators or syntax tokens into textarea at caret position
  const handleInsertOperator = (snippet) => {
    if (!isCustomMode) {
      setCustomQueryText(autoBooleanQuery);
      setIsCustomMode(true);
    }
    const textarea = queryInputRef.current;
    if (!textarea) {
      setCustomQueryText((prev) => (prev ? `${prev} ${snippet}` : snippet));
      return;
    }
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const current = textarea.value;
    const updated = current.slice(0, start) + snippet + current.slice(end);
    setCustomQueryText(updated);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleToggleCompany = (company) => {
    setSelectedCompanies((prev) =>
      prev.includes(company) ? prev.filter((c) => c !== company) : [...prev, company]
    );
  };

  const handleSelectAllCompanies = () => {
    setSelectedCompanies([...allCompanies]);
    if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
  };

  const handleClearSelectedCompanies = () => {
    setSelectedCompanies([]);
  };

  const handleAddCustomCompany = (e) => {
    e?.preventDefault();
    const trimmed = customCompanyInput.trim();
    if (!trimmed) return;
    if (!allCompanies.includes(trimmed)) {
      setCustomCompanies((prev) => [...prev, trimmed]);
      setSelectedCompanies((prev) => [...prev, trimmed]);
      if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
    } else if (!selectedCompanies.includes(trimmed)) {
      setSelectedCompanies((prev) => [...prev, trimmed]);
    }
    setCustomCompanyInput('');
    setShowAddCompanyInput(false);
  };

  const handleRemoveCustomCompany = (company, e) => {
    e?.stopPropagation();
    setCustomCompanies((prev) => prev.filter((c) => c !== company));
    setSelectedCompanies((prev) => prev.filter((c) => c !== company));
  };

  const handleCopyBoolean = async (specificText) => {
    const textToCopy = specificText || activeBooleanQuery;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedBoolean(true);
      setTimeout(() => setCopiedBoolean(false), 2000);
    } catch {
      // Clipboard fallback omitted in restricted contexts.
    }
  };

  const handleLaunchSearch = () => {
    if (!activeBooleanQuery) return;
    let url = '';
    if (sourcingPlatform === 'xray') {
      url = `https://www.google.com/search?q=${encodeURIComponent(activeBooleanQuery)}`;
    } else if (sourcingPlatform === 'linkedin') {
      url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(activeBooleanQuery)}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent('site:naukri.com ' + activeBooleanQuery)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // If no job is selected, show placeholder instruction.
  if (!job) {
    return (
      <div className="p-12 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card text-center text-slate-400">
        <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
        <p className="text-sm font-medium text-navy-900 dark:text-slate-100">Select a Job Description</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Click any job on the left to inspect requirements, AI analysis, and matched applicants.
        </p>
      </div>
    );
  }

  // Include Open alongside Active and Under Review to match real SQLite job status distribution.
  const jobStatusOptions = ['Active', 'Open', 'Under Review', 'Draft', 'On Hold', 'Closed'];

  // Normalize job status string for dropdown matching.
  const normalizedJobStatus =
    jobStatusOptions.find((opt) => opt.toLowerCase() === (job.status || '').trim().toLowerCase()) ||
    job.status ||
    'Active';

  // Helper to style job status badge dropdown.
  const getJobStatusStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
        return 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800';
      case 'open':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'under review':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  // Propose human-in-the-loop JD segmentation / publishing approval.
  const handleProposeJobApproval = async () => {
    setApprovalSentMsg('');
    try {
      await approvalApi.propose({
        action_type: 'approve_jd_segmentation',
        description: `Approve JD specification & matching criteria for ${job.title}`,
        payload: { job_id: job.numeric_id || job.id, job_title: job.title, version: job.version || 1 },
        requester: 'Krishna C. (Recruiter)',
      });
      setApprovalSentMsg('JD approval request submitted to Approvals Queue.');
      if (onRefreshApprovals) {
        await onRefreshApprovals();
      }
    } catch (err) {
      setApprovalSentMsg(`Submission failed: ${err.message}`);
    }
  };

  // Track JD-synced vs recruiter-added provenance cleanly.
  const syncedMandatorySet = new Set(job.syncedMandatorySkills || []);

  // Render job detail view.
  return (
    <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card p-6 space-y-6">
      {/* Header section with title, customizable status dropdown, and action triggers */}
      <div className="flex flex-col gap-4 pb-5 border-b border-slate-100 dark:border-surface-darkBorder">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {job.jdCode}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              v{job.version || 1}
            </span>
            {job.ocrNeeded && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                OCR Required
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{job.department}</span>

            {/* Interactive Job Status Dropdown */}
            <div className="relative inline-block ml-1">
              <CustomSelect
                value={normalizedJobStatus}
                onChange={(nextStatus) => {
                  if (onUpdateJob) {
                    onUpdateJob({ ...job, status: nextStatus });
                  }
                }}
                ariaLabel={`Status for ${job.title}`}
                size="sm"
                buttonClassName={`!py-1 !px-2.5 !rounded-lg !text-[13px] !font-semibold ${getJobStatusStyle(
                  normalizedJobStatus
                )}`}
                options={jobStatusOptions.map((opt) => ({ value: opt, label: opt }))}
              />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-navy-900 dark:text-slate-100 tracking-tight">{job.title}</h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {job.location || 'Location not specified'}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              {job.experienceRequired}
            </span>
            {job.sourceFilename && (
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {job.sourceFilename}
              </span>
            )}
          </div>
        </div>

        {/* Action Button Group (wraps cleanly inside card bounds) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenMatrix?.(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Users className="w-4 h-4 text-white" />
            <span>Matching Workspace</span>
          </button>

          <button
            onClick={() => onOpenSegmentation?.(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-navy-900 dark:bg-slate-800 hover:bg-navy-950 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-brand-300" />
            <span>Requirements Workspace</span>
          </button>

          <button
            onClick={() => onAnalyzeJob(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200/90 dark:border-brand-800 rounded-xl text-xs font-semibold shadow-subtle transition-all"
          >
            <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Analyze Criteria</span>
          </button>

          <button
            type="button"
            onClick={handleProposeJobApproval}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit Approval</span>
          </button>
        </div>
      </div>

      {approvalSentMsg && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
          {approvalSentMsg}
        </div>
      )}

      {/* Structured Job Description Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Job Summary & Scope
        </h4>
        <p className="text-xs text-navy-900 dark:text-slate-200 leading-relaxed bg-surface-50/50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-surface-darkBorder rounded-xl whitespace-pre-line">
          {job.description || 'No description stored for this job.'}
        </p>
      </div>

      {/* Skills requirements breakdown distinguishing JD-derived vs Recruiter-added */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Required Competencies
        </h4>
        <div className="space-y-2 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1.5">Mandatory Skills:</span>
            <div className="flex flex-wrap gap-1.5">
              {(job.requiredSkills || []).map((sk, idx) => (
                <Badge key={idx} variant={syncedMandatorySet.has(sk) ? 'brand' : 'blue'} size="sm">
                  {sk}
                  {syncedMandatorySet.size > 0 && (
                    <span className="ml-1 opacity-75 text-[9px]">
                      ({syncedMandatorySet.has(sk) ? 'JD' : 'Recruiter'})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {job.preferredSkills && job.preferredSkills.length > 0 && (
            <div className="pt-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1.5">Preferred Skills:</span>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredSkills.map((sk, idx) => (
                  <Badge key={idx} variant="neutral" size="sm">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nemotron LLM Analysis card */}
      {job.analysis && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              Nemotron Analysis & Extracted Criteria
            </h4>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-400">{job.analysis.analyzedAt}</span>
          </div>

          <div className="p-4 bg-brand-50/40 dark:bg-surface-darkCard border border-brand-200/60 dark:border-surface-darkBorder rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-brand-700 dark:text-brand-400 font-semibold">
                Confidence Rating: {job.analysis.confidenceScore}%
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Model: {job.analysis.modelUsed}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-navy-900 dark:text-slate-100 block">
                Extracted Core Responsibilities:
              </span>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {job.analysis.extractedResponsibilities.map((resp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* JD Related Companies & Target Sourcing Ecosystem */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-subtle">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  Job Description Related Companies
                </h4>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/70 dark:border-indigo-800">
                  {selectedCompanies.length > 0 ? `${selectedCompanies.length} selected` : `${allCompanies.length} suggested`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ecosystem competitors & target sourcing firms derived from JD tech stack
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCompanies.length > 0 ? (
              <button
                type="button"
                onClick={handleClearSelectedCompanies}
                className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Clear Selection
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSelectAllCompanies}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              >
                Select All
              </button>
            )}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder rounded-2xl shadow-subtle space-y-3.5">
          {/* Target Hiring Client Banner if present */}
          {(job.client || job.client_name) && (
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Target Hiring Client:</span>
              <Badge variant="brand" size="sm">
                <Building2 className="w-3.5 h-3.5" />
                {job.client || job.client_name}
              </Badge>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                • Target competitors for candidate talent poaching
              </span>
            </div>
          )}

          {/* Interactive Sourcing Company Pills */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-navy-950 dark:text-slate-200">
                Suggested Target Sourcing Companies:
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Click to include in Boolean query
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allCompanies.map((company) => {
                const isPicked = selectedCompanies.includes(company);
                const isCustom = customCompanies.includes(company);

                return (
                  <button
                    key={company}
                    type="button"
                    onClick={() => {
                      handleToggleCompany(company);
                      if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
                    }}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 ${
                      isPicked
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-surface-darkBorder hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20'
                    }`}
                  >
                    <span className="text-[11px]">{isPicked ? '✓' : '+'}</span>
                    <span>{company}</span>
                    {isCustom && (
                      <span
                        onClick={(e) => handleRemoveCustomCompany(company, e)}
                        className={`ml-1 hover:text-rose-400 p-0.5 rounded ${
                          isPicked ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                        title="Remove custom company"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Add Custom Company Button / Inline Input */}
              {showAddCompanyInput ? (
                <form onSubmit={handleAddCustomCompany} className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customCompanyInput}
                    onChange={(e) => setCustomCompanyInput(e.target.value)}
                    placeholder="Enter company..."
                    autoFocus
                    className="w-36 px-2.5 py-1 text-xs rounded-xl border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-surface-darkBg text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="submit"
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    title="Add company"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCompanyInput(false);
                      setCustomCompanyInput('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg text-xs"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCompanyInput(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-300 dark:border-surface-darkBorder text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Company</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Naukri & Sourcing Boolean Search Generator */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-subtle">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                Boolean Search Query Generator
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Multi-platform Boolean strings for Naukri Resdex, LinkedIn Recruiter & Google X-Ray
              </p>
            </div>
          </div>

          {/* Quick External Launch, Customize & Copy Triggers */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleToggleCustomMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-subtle transition-all ${
                isCustomMode
                  ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-400 dark:border-brand-700 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                  : 'bg-white dark:bg-surface-darkCard border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Edit3 className={`w-3.5 h-3.5 ${isCustomMode ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
              <span>{isCustomMode ? 'Editing Query' : 'Customize Query'}</span>
            </button>

            <button
              type="button"
              onClick={handleLaunchSearch}
              title={`Launch query in ${sourcingPlatform === 'xray' ? 'Google X-Ray' : sourcingPlatform === 'linkedin' ? 'LinkedIn' : 'Web Search'}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 dark:hover:border-brand-500 text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-darkCard text-xs font-semibold shadow-subtle hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Launch Search</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleCopyBoolean()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-subtle transition-all duration-150 ${
                copiedBoolean
                  ? 'bg-emerald-600 text-white'
                  : 'bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-700 text-white'
              }`}
            >
              {copiedBoolean ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBoolean ? 'Copied to Clipboard!' : 'Copy Boolean'}</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/90 dark:border-surface-darkBorder rounded-2xl shadow-subtle space-y-4">
          {/* Sourcing Platform Selector Tabs & Mode Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-surface-darkBg rounded-xl border border-slate-200/70 dark:border-surface-darkBorder">
              <button
                type="button"
                onClick={() => setSourcingPlatform('naukri')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'naukri'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                Naukri Resdex
              </button>
              <button
                type="button"
                onClick={() => setSourcingPlatform('linkedin')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'linkedin'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                LinkedIn Recruiter
              </button>
              <button
                type="button"
                onClick={() => setSourcingPlatform('xray')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'xray'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                Google X-Ray
              </button>
            </div>

            {/* Mode & Character Length & Syntax Validity badge */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {isCustomMode ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                  <Edit3 className="w-3 h-3" />
                  Customized Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-surface-darkBg px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-surface-darkBorder">
                  <Sparkles className="w-3 h-3 text-brand-500" />
                  AI Auto-Generated
                </span>
              )}

              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {activeBooleanQuery.length} chars (Limit: 1000)
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Zap className="w-3 h-3" />
                Valid
              </span>
            </div>
          </div>

          {/* Interactive Boolean Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNaukriStrictAnd((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                naukriStrictAnd
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              Mandatory Skills: {naukriStrictAnd ? 'Strict (AND)' : 'Broad (OR)'}
            </button>

            {job.preferredSkills && job.preferredSkills.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIncludePreferredInBoolean((v) => !v);
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  includePreferredInBoolean
                    ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
                }`}
              >
                {includePreferredInBoolean ? '✓ ' : '+ '}Preferred Skills ({job.preferredSkills.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIncludeCompaniesInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeCompaniesInBoolean
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeCompaniesInBoolean ? '✓ ' : '+ '}Target Companies (
              {selectedCompanies.length > 0 ? selectedCompanies.length : 'All Suggested'})
            </button>

            {job.location && (
              <button
                type="button"
                onClick={() => {
                  setIncludeLocationInBoolean((v) => !v);
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  includeLocationInBoolean
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
                }`}
              >
                {includeLocationInBoolean ? '✓ ' : '+ '}Include Location
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIncludeNoticeInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeNoticeInBoolean
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeNoticeInBoolean ? '✓ ' : '+ '}Immediate Joiners (≤30 Days)
            </button>

            {/* Sourcing Exclusions (Negative Sourcing NOT) */}
            <button
              type="button"
              onClick={() => {
                setIncludeExclusionsInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeExclusionsInBoolean
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeExclusionsInBoolean ? '✓ ' : '+ '}Exclude Interns / Trainees (NOT)
            </button>

            {/* Seniority / Lead Booster */}
            <button
              type="button"
              onClick={() => {
                setIncludeSeniorityInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeSeniorityInBoolean
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeSeniorityInBoolean ? '✓ ' : '+ '}Senior / Lead Focus
            </button>
          </div>

          {/* Quick Syntax Insertion Toolbar when in Custom Mode */}
          {isCustomMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-surface-darkBg rounded-xl border border-slate-200/80 dark:border-surface-darkBorder animate-fadeIn">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Insert Operator:</span>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' AND ')}
                  className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-200 transition-colors"
                >
                  + AND
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' OR ')}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-bold hover:bg-amber-200 transition-colors"
                >
                  + OR
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' NOT ')}
                  className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[11px] font-bold hover:bg-rose-200 transition-colors"
                >
                  + NOT
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator('""')}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold hover:bg-slate-300 transition-colors"
                >
                  + "Quotes"
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator('()')}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold hover:bg-slate-300 transition-colors"
                >
                  + (Parens)
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetToAutoQuery}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-0.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to AI Auto</span>
              </button>
            </div>
          )}

          {/* Generated or Custom Boolean Code Box */}
          <div className="relative group">
            {isCustomMode ? (
              <textarea
                ref={queryInputRef}
                value={customQueryText}
                onChange={(e) => setCustomQueryText(e.target.value)}
                placeholder="Type or edit your custom boolean search expression..."
                rows={4}
                className="w-full p-4 rounded-xl bg-slate-900 dark:bg-black border-2 border-brand-500/70 text-slate-100 font-mono text-[13px] sm:text-sm leading-relaxed shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-y"
              />
            ) : (
              <div
                onClick={() => {
                  setCustomQueryText(autoBooleanQuery);
                  setIsCustomMode(true);
                }}
                title="Click to customize / edit query"
                className="p-4 rounded-xl bg-slate-900 dark:bg-black border border-slate-800 dark:border-surface-darkBorder text-slate-200 font-mono text-[13px] sm:text-sm break-words select-all leading-relaxed shadow-inner pr-20 cursor-pointer hover:border-slate-700 transition-colors"
              >
                {activeBooleanQuery ? (
                  activeBooleanQuery
                    .split(/(\bAND\b|\bOR\b|\bNOT\b|\bsite:linkedin\.com\/in\b)/g)
                    .map((token, i) => {
                      if (token === 'AND') {
                        return (
                          <span key={i} className="text-emerald-400 font-bold px-1">
                            AND
                          </span>
                        );
                      }
                      if (token === 'OR') {
                        return (
                          <span key={i} className="text-amber-400 font-bold px-1">
                            OR
                          </span>
                        );
                      }
                      if (token === 'NOT') {
                        return (
                          <span key={i} className="text-rose-400 font-bold px-1">
                            NOT
                          </span>
                        );
                      }
                      if (token === 'site:linkedin.com/in') {
                        return (
                          <span key={i} className="text-indigo-400 font-bold pr-1">
                            site:linkedin.com/in
                          </span>
                        );
                      }
                      return <span key={i}>{token}</span>;
                    })
                ) : (
                  <span className="text-slate-500 italic">
                    Add required skills or select job criteria to generate a query.
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCopyBoolean()}
              className="absolute right-3 top-3 opacity-90 hover:opacity-100 p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all text-xs flex items-center gap-1.5 shadow-sm"
              title="Copy active query"
            >
              {copiedBoolean ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedBoolean ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick Snippet Copy Shortcuts & Sourcing Guidance */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <strong className="text-navy-900 dark:text-slate-200">Exp Filter:</strong>{' '}
                {job.experienceRequired || job.experienceRange || 'Any'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-navy-900 dark:text-slate-200">Location:</strong>{' '}
                {job.location || 'Any (Pan India / Remote)'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-navy-900 dark:text-slate-200">Department:</strong>{' '}
                {job.department || 'General'}
              </span>
            </div>

            {/* Quick Sourcing Snippet Copy Shortcuts */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const skills = (job.requiredSkills || []).map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(' AND ');
                  handleCopyBoolean(skills);
                }}
                className="text-[11px] font-semibold text-brand-700 dark:text-brand-400 hover:underline"
              >
                Copy Skills Only
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  const companies = selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
                  const str = companies.map((c) => `"${c}"`).join(' OR ');
                  handleCopyBoolean(`(${str})`);
                }}
                className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                Copy Target Companies
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Matching Candidates Section */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-surface-darkBorder">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-navy-900 dark:text-slate-200" />
              Recruiter Semantic Matching Results
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ranked using active approved JD embeddings and candidate resume vectors.
            </p>
          </div>

          {/* Quick link to full Matrix Workspace */}
          <button
            onClick={() => onOpenMatrix?.(job)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-surface-darkCard dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-transparent dark:border-surface-darkBorder rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            <span>Open Matching Matrix</span>
            <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-slate-400 dark:text-slate-400" />
          </button>
        </div>

        {/* Matching KPIs Header Summary Cards */}
        {matchingCandidates.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">Evaluated Pool</span>
              <span className="text-base font-extrabold text-navy-900 dark:text-slate-100">{matchingCandidates.length}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">candidates</span>
            </div>
            <div className="p-3 bg-emerald-50/60 dark:bg-surface-darkCard border border-emerald-200/60 dark:border-emerald-900/60 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block tracking-wider">Top Matches</span>
              <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                {matchingCandidates.filter((c) => (c.matchScore || c.match_score || 0) >= 75).length}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 block">score &ge; 75%</span>
            </div>
            <div className="p-3 bg-brand-50/60 dark:bg-surface-darkCard border border-brand-200/60 dark:border-brand-900/60 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-brand-700 dark:text-brand-400 block tracking-wider">Average Fit</span>
              <span className="text-base font-extrabold text-brand-900 dark:text-brand-300">
                {Math.round(
                  matchingCandidates.reduce((acc, c) => acc + (c.matchScore || c.match_score || 0), 0) /
                    matchingCandidates.length
                )}%
              </span>
              <span className="text-[10px] text-brand-600 dark:text-brand-400/80 block">across pool</span>
            </div>
            <div className="p-3 bg-blue-50/60 dark:bg-surface-darkCard border border-blue-200/60 dark:border-blue-900/60 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider">Top Score</span>
              <span className="text-base font-extrabold text-blue-900 dark:text-blue-300">
                {Math.max(...matchingCandidates.map((c) => c.matchScore || c.match_score || 0))}%
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400/80 block">highest rank</span>
            </div>
          </div>
        )}

        <MatchingCandidates
          candidates={matchingCandidates}
          onSelectCandidate={onSelectCandidate}
          onOpenWorkspace={() => onOpenMatrix?.(job)}
        />
      </div>
    </div>
  );
};
