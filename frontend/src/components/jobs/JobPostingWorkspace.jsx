import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Layers,
  BarChart3,
  History,
  FileCheck2,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import { jobPostingApi } from '../../api/client';

const PLATFORMS = [
  ['linkedin', 'LinkedIn'],
  ['naukri', 'Naukri'],
  ['indeed', 'Indeed'],
  ['careers', 'Company Careers'],
  ['referral', 'Employee Referral'],
];

const REWRITE_MODES = [
  { id: 'professionalism', label: 'Elevate Professionalism', desc: 'Refine tone for corporate & executive standards' },
  { id: 'readability', label: 'Enhance Readability', desc: 'Simplify complex sentence structures and clarify flow' },
  { id: 'concise', label: 'Make Concise (-30%)', desc: 'Trim fluff while strictly preserving all requirements' },
  { id: 'engaging', label: 'Engaging Hook & Pitch', desc: 'Craft a persuasive introduction to attract passive talent' },
  { id: 'optimize_keywords', label: 'Optimize Search Keywords', desc: 'Highlight mandatory skill keywords for search & ATS indexability' },
  { id: 'simplify_technical', label: 'Plain Language Clarity', desc: 'Explain domain jargon into clear functional outcomes' },
  { id: 'improve_responsibilities', label: 'Action-Verb Duties', desc: 'Power all bullets with strong, proactive action verbs' },
];

function renderInlineContent(rawText) {
  if (!rawText) return '';
  // 1. Repair orphan trailing :** like 'Location:**' or '• Location:**' -> '**Location:**'
  let normalized = rawText.replace(/(^|[\s•·+*-])([A-Za-z0-9/& -]+):\*\*/g, '$1**$2:**');
  // 2. Repair orphan leading **Word: into '**Word:**'
  normalized = normalized.replace(/\*\*([A-Za-z0-9/& -]+):(?!\*)/g, '**$1:**');
  // 3. Split by paired **...**
  const tokens = normalized.split(/\*\*(.+?)\*\*/);
  return tokens.map((part, i) => {
    // Strip any lingering lone asterisks so raw * characters never display
    const clean = part.replace(/\*/g, '');
    if (!clean) return null;
    return i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
        {clean}
      </strong>
    ) : (
      clean
    );
  });
}

function AdvertisementPreview({ title, content }) {
  if (!content) return null;

  const blocks = [];
  let list = null;
  const cleanTitle = (title || '').trim().toLowerCase();

  const isTitleLine = (text) => {
    if (!cleanTitle) return false;
    const cleanLine = text
      .toLowerCase()
      .replace(/^[#*•·+\s-]+/, '')
      .replace(/[*#:]+$/, '')
      .replace(/^(?:we're hiring:?\s*|hiring:?\s*|🚀\s*employee referral opportunity:?\s*|job title:?\s*|role:?\s*|position:?\s*)/, '')
      .replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '')
      .trim();
    const tClean = cleanTitle.replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '').trim();
    return cleanLine === tClean || cleanLine.startsWith(tClean) || tClean.startsWith(cleanLine);
  };

  content.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      if (list) {
        blocks.push(list);
        list = null;
      }
      return;
    }

    // Skip redundant title headings or subtitle lines matching the main heading
    if (isTitleLine(line)) {
      return;
    }

    const heading = line.match(/^#{1,6}\s*(.+)$/);
    if (heading) {
      if (list) {
        blocks.push(list);
        list = null;
      }
      const rawHead = heading[1].replace(/[:*]+$/, '').replace(/\*/g, '').trim();
      if (isTitleLine(rawHead)) {
        return;
      }
      blocks.push(
        <h3 key={`heading-${index}`} className="mt-5 mb-2 text-base font-bold text-navy-900 dark:text-slate-100 border-b pb-1 dark:border-slate-800">
          {rawHead}
        </h3>
      );
      return;
    }

    const bullet = rawLine.match(/^(\s*)(?:[-*+•·]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const indentation = Math.min(Math.floor((bullet[1].match(/\t/g)?.length || 0) + bullet[1].length / 2), 3);
      if (!list) list = { indent: indentation, items: [] };
      if (indentation !== list.indent) list = { indent: indentation, items: [...list.items, null] };
      const bulletText = bullet[2].replace(/^(?:[•·+-]|\*(?!\*)|\d+[.)])\s*/, '').trim();
      list.items.push({ text: bulletText, indent: indentation });
      return;
    }

    if (list) {
      blocks.push(list);
      list = null;
    }
    blocks.push(
      <p key={`paragraph-${index}`} className="my-2 leading-relaxed text-sm text-slate-700 dark:text-slate-300">
        {renderInlineContent(line.replace(/^(?:[•·+-]|\*(?!\*)|\d+[.)])\s*/, ''))}
      </p>
    );
  });

  if (list) blocks.push(list);

  return (
    <div className="max-w-[75ch] space-y-1">
      <h2 className="text-xl font-bold text-navy-900 dark:text-slate-100">{renderInlineContent(title)}</h2>
      {blocks.map((block, index) => {
        if (block && block.items) {
          return (
            <ul key={`list-${index}`} className="my-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {block.items.filter(Boolean).map((item, itemIndex) => (
                <li key={`item-${itemIndex}`} style={{ marginLeft: `${item.indent * 1.25}rem` }} className="flex items-start">
                  <span className="mr-2 text-brand-600 font-bold dark:text-brand-400" aria-hidden="true">•</span>
                  <span className="leading-6">{renderInlineContent(item.text)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return block;
      })}
    </div>
  );
}

export function JobPostingWorkspace({ job }) {
  const jobId = job.numeric_id || job.id;
  const [data, setData] = useState({ versions: [], metrics: [], activity: [], strategy: null, supplementary_info: {} });
  const [platform, setPlatform] = useState('linkedin');
  const [tab, setTab] = useState('builder');
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [externalId, setExternalId] = useState('');
  const [metrics, setMetrics] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Recruiter Productivity States
  const [readiness, setReadiness] = useState(null);
  const [rewriteMode, setRewriteMode] = useState('professionalism');
  const [customPrompt, setCustomPrompt] = useState('');
  const [rewrittenPreview, setRewrittenPreview] = useState(null);

  // Comparison State
  const [compareP1, setCompareP1] = useState('linkedin');
  const [compareP2, setCompareP2] = useState('naukri');
  const [compareData, setCompareData] = useState(null);

  // Supplementary Form State
  const [companyOverview, setCompanyOverview] = useState('');
  const [benefitsText, setBenefitsText] = useState('');
  const [applyInstructions, setApplyInstructions] = useState('');
  const [referralBonus, setReferralBonus] = useState('');

  const load = async () => {
    try {
      setError('');
      const res = await jobPostingApi.get(jobId);
      setData(res);
      if (res.supplementary_info) {
        setCompanyOverview(res.supplementary_info.company_overview || '');
        setBenefitsText((res.supplementary_info.benefits || []).join('\n'));
        setApplyInstructions(res.supplementary_info.application_instructions || '');
        setReferralBonus(res.supplementary_info.referral_bonus || '');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadReadiness = async () => {
    try {
      const res = await jobPostingApi.getReadiness(jobId);
      setReadiness(res);
    } catch (err) {
      console.warn('Readiness fetch error:', err.message);
    }
  };

  useEffect(() => {
    load();
    loadReadiness();
  }, [jobId]);

  useEffect(() => {
    const version = data.versions?.find((item) => item.platform === platform);
    setTitle(version?.title || job.title || '');
    setContent(version?.content || '');
    setUrl(version?.external_posting_url || '');
    setExternalId(version?.job_id_external || '');
    setRewrittenPreview(null);
  }, [platform, data, job.title]);

  const selected = data.versions?.find((item) => item.platform === platform);

  const generate = async () => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await jobPostingApi.generate(jobId, platform);
      setData(res);
      await loadReadiness();
      setSuccessMsg(`Successfully generated advertisement for ${PLATFORMS.find(([id]) => id === platform)?.[1]}!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateSection = async (section) => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await jobPostingApi.regenerateSection(jobId, { platform, section });
      setData(res);
      await loadReadiness();
      setSuccessMsg(`Successfully regenerated ${section} section!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [newSkillText, setNewSkillText] = useState('');
  const [skillType, setSkillType] = useState('mandatory');

  const customSkills = data.supplementary_info?.custom_skills;
  const currentMandatory = customSkills?.mandatory || job.required_skills || job.synced_mandatory_skills || [];
  const currentPreferred = customSkills?.preferred || job.preferred_skills || job.synced_preferred_skills || [];

  const handleAddSkill = async () => {
    if (!newSkillText.trim()) return;
    const clean = newSkillText.trim();
    let updatedMandatory = [...currentMandatory];
    let updatedPreferred = [...currentPreferred];
    if (skillType === 'mandatory') {
      if (!updatedMandatory.includes(clean)) updatedMandatory.push(clean);
    } else {
      if (!updatedPreferred.includes(clean)) updatedPreferred.push(clean);
    }
    setBusy(true);
    try {
      const res = await jobPostingApi.updateSkills(jobId, {
        mandatory_skills: updatedMandatory,
        preferred_skills: updatedPreferred,
      });
      setData(res);
      setNewSkillText('');
      setSuccessMsg(`Added skill '${clean}'`);
      await handleRegenerateSection('skills');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSkill = async (skillToRemove, isMandatory) => {
    let updatedMandatory = currentMandatory.filter((s) => s !== skillToRemove);
    let updatedPreferred = currentPreferred.filter((s) => s !== skillToRemove);
    setBusy(true);
    try {
      const res = await jobPostingApi.updateSkills(jobId, {
        mandatory_skills: updatedMandatory,
        preferred_skills: updatedPreferred,
      });
      setData(res);
      setSuccessMsg(`Removed skill '${skillToRemove}'`);
      await handleRegenerateSection('skills');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fetchStrategy = async () => {
    setBusy(true);
    setError('');
    try {
      const strat = await jobPostingApi.strategy(jobId);
      setData((prev) => ({ ...prev, strategy: strat }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await jobPostingApi.updateVersion(selected.id, title, content);
      await load();
      await loadReadiness();
      setEdit(false);
      setSuccessMsg('Advertisement draft saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const approveAd = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await jobPostingApi.approve(selected.id);
      await load();
      await loadReadiness();
      setSuccessMsg('Advertisement approved by recruiter.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updatePublishStatus = async (status) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await jobPostingApi.publish(selected.id, {
        platform,
        external_posting_url: url || null,
        job_id_external: externalId || null,
        status,
      });
      await load();
      await loadReadiness();
      setSuccessMsg(`Posting status updated to: ${status}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const executeRewrite = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await jobPostingApi.rewrite(selected.id, rewriteMode, customPrompt || null);
      setRewrittenPreview(res.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const applyRewrite = async () => {
    if (!rewrittenPreview || !selected) return;
    setContent(rewrittenPreview);
    setRewrittenPreview(null);
    setBusy(true);
    try {
      await jobPostingApi.updateVersion(selected.id, title, rewrittenPreview, 'Recruiter Edited');
      await load();
      setSuccessMsg('AI Rewrite successfully applied to advertisement!');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const executeComparison = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await jobPostingApi.compare(jobId, compareP1, compareP2);
      setCompareData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSupplementaryInfo = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        company_overview: companyOverview.trim() || null,
        benefits: benefitsText.split('\n').map((s) => s.trim()).filter(Boolean),
        application_instructions: applyInstructions.trim() || null,
        referral_bonus: referralBonus.trim() || null,
      };
      await jobPostingApi.updateSupplementary(jobId, payload);
      await load();
      setSuccessMsg('Supplementary company details saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cleanTextAsterisks = (str) => {
    if (!str) return '';
    return str
      .replace(/([A-Za-z0-9/& -]+):\*\*/g, '$1:')
      .replace(/\*\*([A-Za-z0-9/& -]+):/g, '$1:')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*/g, '');
  };

  const getDeduplicatedPlainText = (rawTitle, rawContent) => {
    const cleanT = cleanTextAsterisks(rawTitle).trim();
    const cleanC = cleanTextAsterisks(rawContent).trim();
    if (!cleanT) return cleanC;
    const lines = cleanC.split('\n');
    while (lines.length > 0 && !lines[0].trim()) {
      lines.shift();
    }
    if (lines.length > 0) {
      const firstLineClean = lines[0]
        .toLowerCase()
        .replace(/^[#*•·+\s-]+/, '')
        .replace(/[*#:]+$/, '')
        .replace(/^(?:we're hiring:?\s*|hiring:?\s*|🚀\s*employee referral opportunity:?\s*|job title:?\s*|role:?\s*|position:?\s*)/, '')
        .replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '')
        .trim();
      const tClean = cleanT
        .toLowerCase()
        .replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '')
        .trim();
      if (firstLineClean === tClean || firstLineClean.startsWith(tClean) || tClean.startsWith(firstLineClean)) {
        lines.shift();
      }
    }
    const remaining = lines.join('\n').trim();
    return remaining ? `${cleanT}\n\n${remaining}` : cleanT;
  };

  const copyToClipboard = async () => {
    const cleanAd = getDeduplicatedPlainText(title, content);
    await navigator.clipboard.writeText(cleanAd);
    setSuccessMsg('Copied advertisement text to clipboard!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const downloadFile = (format = 'txt') => {
    const baseName = `${job.title || 'job'}-${platform}`;
    if (format === 'txt') {
      const plainText = getDeduplicatedPlainText(title, content);
      const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${baseName}.txt`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      return;
    }

    setBusy(true);
    jobPostingApi
      .exportDocument({
        title,
        content,
        format,
        filename: baseName,
      })
      .then((blob) => {
        const ext = format === 'word' ? 'docx' : format;
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${baseName}.${ext}`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        setSuccessMsg(`Downloaded advertisement as ${format === 'pdf' ? 'PDF' : 'Word (.docx)'}`);
        setTimeout(() => setSuccessMsg(''), 3000);
      })
      .catch((err) => {
        if (format === 'docx' || format === 'word') {
          const cleanDocTitle = cleanTextAsterisks(title).trim();
          const lines = content.split('\n');
          while (lines.length > 0 && !lines[0].trim()) {
            lines.shift();
          }
          if (lines.length > 0) {
            const firstLineClean = cleanTextAsterisks(lines[0])
              .toLowerCase()
              .replace(/^[#*•·+\s-]+/, '')
              .replace(/[*#:]+$/, '')
              .replace(/^(?:we're hiring:?\s*|hiring:?\s*|🚀\s*employee referral opportunity:?\s*|job title:?\s*|role:?\s*|position:?\s*)/, '')
              .replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '')
              .trim();
            const tClean = cleanDocTitle
              .toLowerCase()
              .replace(/\s*[-–]\s*[a-z0-9\s,&/()]+$/, '')
              .trim();
            if (firstLineClean === tClean || firstLineClean.startsWith(tClean) || tClean.startsWith(firstLineClean)) {
              lines.shift();
            }
          }
          const cleanDocBody = lines
            .map((line) => {
              const norm = line
                .replace(/([A-Za-z0-9/& -]+):\*\*/g, '**$1:**')
                .replace(/\*\*([A-Za-z0-9/& -]+):(?!\*)/g, '**$1:**');
              const tokens = norm.split(/\*\*(.+?)\*\*/);
              const rendered = tokens
                .map((part, i) => {
                  const clean = part.replace(/\*/g, '');
                  return i % 2 === 1 ? `<b>${clean}</b>` : clean;
                })
                .join('');
              return `<p>${rendered}</p>`;
            })
            .join('');
          const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${cleanDocTitle}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;}h1{font-size:18pt;color:#0f172a;}p{margin-bottom:8pt;}</style></head><body><h1>${cleanDocTitle}</h1><div>${cleanDocBody}</div></body></html>`;
          const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword;charset=utf-8' });
          const anchor = document.createElement('a');
          anchor.href = URL.createObjectURL(blob);
          anchor.download = `${baseName}.doc`;
          anchor.click();
          URL.revokeObjectURL(anchor.href);
          setSuccessMsg('Downloaded advertisement as Word (.doc)');
          setTimeout(() => setSuccessMsg(''), 3000);
        } else {
          setError(err.message || `Failed to export as ${format.toUpperCase()}`);
        }
      })
      .finally(() => setBusy(false));
  };

  const recordMetricsSubmit = async () => {
    setBusy(true);
    setError('');
    try {
      await jobPostingApi.recordMetrics(jobId, { platform, metrics, source: 'manual' });
      await load();
      setMetrics({});
      setSuccessMsg('Posting performance metrics recorded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
        <div className="flex gap-2 overflow-x-auto py-1">
          {[
            ['builder', 'Advertisement Builder', Layers],
            ['rewrite', 'AI Rewrite Assistant', Sparkles],
            ['readiness', 'Readiness Checklist', FileCheck2],
            ['compare', 'Platform Comparison', Sliders],
            ['strategy', 'AI Strategy & Channels', BarChart3],
            ['supplementary', 'Supplementary Info', PlusCircle],
            ['performance', 'Performance Metrics', BarChart3],
            ['history', 'Audit History', History],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                if (id === 'readiness') loadReadiness();
                if (id === 'strategy' && !data.strategy) fetchStrategy();
                if (id === 'compare' && !compareData) executeComparison();
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === id
                  ? 'bg-navy-900 text-white shadow-sm dark:bg-brand-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {readiness && (
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border dark:border-slate-700">
            <span className="text-slate-500">Readiness:</span>
            <span className={readiness.readiness_percentage >= 80 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {readiness.readiness_percentage}%
            </span>
          </div>
        )}
      </div>

      {/* TAB 1: ADVERTISEMENT BUILDER */}
      {tab === 'builder' && (
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          {/* Platform List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">Publishing Channels</div>
            {PLATFORMS.map(([id, label]) => {
              const pVer = data.versions?.find((v) => v.platform === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlatform(id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                    platform === id
                      ? 'bg-brand-50 text-brand-700 border border-brand-200 shadow-sm dark:bg-brand-950/40 dark:border-brand-800 dark:text-brand-300'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{label}</span>
                  {pVer && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        pVer.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : pVer.status === 'Published'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {pVer.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Builder Workspace */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900 shadow-sm">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={generate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                  Generate / Regenerate Full Ad ({PLATFORMS.find(([id]) => id === platform)?.[1]})
                </button>
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => handleRegenerateSection('overview')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  title="Regenerate only the Role Overview without losing other edits"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Regen Overview
                </button>
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => handleRegenerateSection('skills')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  title="Regenerate only the Skills & Competencies section"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                  Regen Skills
                </button>
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => setEdit((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {edit ? 'Preview Mode' : 'Edit Text'}
                </button>
                <button
                  type="button"
                  disabled={!content}
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  disabled={!content}
                  onClick={() => downloadFile('txt')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .txt
                </button>
                <button
                  type="button"
                  disabled={!content || busy}
                  onClick={() => downloadFile('pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={!content || busy}
                  onClick={() => downloadFile('docx')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Word
                </button>
              </div>

              {selected && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">Method: {selected.generation_method}</span>
                </div>
              )}
            </div>

            {/* Skills & Keywords Block */}
            <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    Skills & Keywords ({currentMandatory.length + currentPreferred.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Target skills indexed across Naukri, LinkedIn, and ATS matching engines.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={skillType}
                    onChange={(e) => setSkillType(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <option value="mandatory">Mandatory</option>
                    <option value="preferred">Preferred</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Add skill..."
                    value={newSkillText}
                    onChange={(e) => setNewSkillText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill(); }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-32 sm:w-40 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    disabled={!newSkillText.trim() || busy}
                    onClick={handleAddSkill}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {currentMandatory.map((skill, idx) => (
                  <span
                    key={`mand-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill, true)}
                      className="hover:text-rose-600 transition-colors ml-0.5"
                      title="Remove skill"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {currentPreferred.map((skill, idx) => (
                  <span
                    key={`pref-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                  >
                    <span className="text-[10px] uppercase font-bold text-purple-500">Pref:</span>
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill, false)}
                      className="hover:text-rose-600 transition-colors ml-0.5"
                      title="Remove skill"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Content Display or Editor */}
            {selected ? (
              edit ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Advertisement Heading / Title:
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Markdown Body:
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={18}
                      className="mt-1 w-full border rounded-lg p-3 font-mono text-xs leading-relaxed bg-white dark:bg-slate-800 dark:border-slate-700"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveDraft}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Draft Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selected.status === 'Needs Recruiter Review' && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0 text-amber-600" />
                      <div>
                        <b>Recruiter Review Required:</b> This advertisement contains validation warnings or missing facts. Review and approve prior to publishing.
                      </div>
                    </div>
                  )}
                  <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
                    <AdvertisementPreview title={title} content={content} />
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-sm text-slate-500">
                Click <b>Generate / Regenerate</b> above to craft a source-grounded {PLATFORMS.find(([id]) => id === platform)?.[1]} advertisement.
              </div>
            )}

            {/* Approval & External Publishing Controls */}
            {selected && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.status === 'Approved'}
                    onClick={approveAd}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {selected.status === 'Approved' ? 'Approved' : 'Mark Recruiter Approved'}
                  </button>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="External Posting URL (e.g. LinkedIn link)"
                    className="border rounded-lg px-3 py-1.5 text-xs min-w-[240px] dark:bg-slate-800 dark:border-slate-700"
                  />
                  <input
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder="Job Post ID"
                    className="border rounded-lg px-3 py-1.5 text-xs w-28 dark:bg-slate-800 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updatePublishStatus('Published')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Record Published Status
                  </button>
                </div>

                {selected.external_posting_url && (
                  <a
                    href={selected.external_posting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-semibold"
                  >
                    Live Post <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI REWRITE ASSISTANT */}
      {tab === 'rewrite' && (
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Rewrite Objective</div>
            <div className="space-y-1.5">
              {REWRITE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRewriteMode(m.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                    rewriteMode === m.id
                      ? 'bg-brand-50 border border-brand-300 text-brand-900 font-bold dark:bg-brand-950 dark:border-brand-700 dark:text-brand-200'
                      : 'border border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t dark:border-slate-800">
              Custom Recruiter Instruction (Optional):
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Focus on immediate joiners or specific ERP tools..."
                rows={3}
                className="mt-1 w-full border rounded-lg p-2 text-xs dark:bg-slate-800 dark:border-slate-700"
              />
            </label>

            <button
              type="button"
              disabled={busy || !selected}
              onClick={executeRewrite}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 dark:bg-brand-600 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Rewrite for {PLATFORMS.find(([id]) => id === platform)?.[1]}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100">AI Rewrite Comparison & Verification</h3>
            {rewrittenPreview ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-950/40 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 uppercase pb-2 border-b dark:border-slate-800">Current Version</div>
                    <div className="mt-2 text-xs font-mono whitespace-pre-wrap">{content}</div>
                  </div>
                  <div className="border border-brand-200 rounded-xl p-4 bg-brand-50/20 dark:bg-brand-950/20 dark:border-brand-900">
                    <div className="text-xs font-bold text-brand-700 uppercase pb-2 border-b border-brand-200 dark:border-brand-900">Rewritten Candidate</div>
                    <div className="mt-2 text-xs font-mono whitespace-pre-wrap">{rewrittenPreview}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyRewrite}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
                  >
                    <Check className="w-4 h-4" /> Apply Rewritten Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setRewrittenPreview(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" /> Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-12 text-center text-xs text-slate-500">
                Select a rewrite objective on the left and click <b>Rewrite</b> to preview candidate variations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: READINESS CHECKLIST */}
      {tab === 'readiness' && readiness && (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">Job Posting Readiness Score</h3>
                <p className="text-xs text-slate-500">{readiness.summary}</p>
              </div>
              <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
                {readiness.readiness_percentage}%
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full ${readiness.readiness_percentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${readiness.readiness_percentage}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y dark:divide-slate-800">
            {readiness.checklist?.map((item) => (
              <div key={item.id} className="p-4 flex items-start gap-3">
                {item.status === 'passed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : item.status === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <X className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy-900 dark:text-slate-100">{item.label}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.category}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PLATFORM COMPARISON */}
      {tab === 'compare' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Compare Platforms:</span>
            <select
              value={compareP1}
              onChange={(e) => setCompareP1(e.target.value)}
              className="border rounded-lg px-2.5 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
            >
              {PLATFORMS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400">vs</span>
            <select
              value={compareP2}
              onChange={(e) => setCompareP2(e.target.value)}
              className="border rounded-lg px-2.5 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
            >
              {PLATFORMS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={executeComparison}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-semibold dark:bg-brand-600"
            >
              Run Side-by-Side Diff
            </button>
          </div>

          {compareData && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {[compareData.platform_1, compareData.platform_2].map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                    <h4 className="text-sm font-bold capitalize text-navy-900 dark:text-slate-100">{p.platform} Metrics</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">Words: <b>{p.word_count}</b></div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">Characters: <b>{p.character_count}</b></div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">Headings: <b>{p.heading_count}</b></div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">Bullets: <b>{p.bullet_count}</b></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI STRATEGY & DISTRIBUTION */}
      {tab === 'strategy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={busy}
              onClick={fetchStrategy}
              className="px-4 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800 dark:bg-brand-600"
            >
              {busy ? 'Analyzing...' : 'Recompute Strategy'}
            </button>
            {data.strategy?.top_recommended_platform && (
              <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
                Primary Channel: <b>{data.strategy.top_recommended_platform}</b>
              </div>
            )}
          </div>

          {data.strategy ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Strategic Distribution Summary</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">{data.strategy.strategy_summary}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {data.strategy.platforms?.map((p) => (
                  <div key={p.name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <b className="text-sm text-navy-900 dark:text-slate-100">{p.name}</b>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        p.suitability_score >= 85
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {p.suitability} ({p.suitability_score}/100)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{p.reason}</p>
                    <div className="pt-2 border-t dark:border-slate-800 text-[11px] space-y-1 text-slate-500">
                      <div><b>Target Audience:</b> {p.target_audience}</div>
                      <div><b>Suggested Title:</b> {p.suggested_title}</div>
                      <div><b>Format:</b> {p.recommended_format}</div>
                      <div><b>Challenges:</b> {p.potential_challenges}</div>
                    </div>
                  </div>
                ))}
              </div>

              {data.strategy.keywords_bank && (
                <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Dynamic Keywords Bank</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {data.strategy.keywords_bank.map((kw, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
              Click <b>Recompute Strategy</b> to calculate platform suitability and sourcing channels.
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SUPPLEMENTARY INFO MANAGER */}
      {tab === 'supplementary' && (
        <div className="max-w-2xl space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">Supplementary Recruiter Facts</h3>
            <p className="text-xs text-slate-500">
              Information supplied here is kept strictly separate from the original JD and incorporated into advertisements when available.
            </p>
          </div>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Company Overview / Culture Pitch:
            <textarea
              value={companyOverview}
              onChange={(e) => setCompanyOverview(e.target.value)}
              placeholder="e.g. Target Global Tax team provides enterprise tax compliance support..."
              rows={3}
              className="mt-1 w-full border rounded-lg p-2.5 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Perks & Benefits (One per line):
            <textarea
              value={benefitsText}
              onChange={(e) => setBenefitsText(e.target.value)}
              placeholder="e.g. Comprehensive health coverage&#10;Flexible hybrid work schedule&#10;Annual learning stipend"
              rows={4}
              className="mt-1 w-full border rounded-lg p-2.5 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Application Instructions:
            <input
              value={applyInstructions}
              onChange={(e) => setApplyInstructions(e.target.value)}
              placeholder="e.g. Apply through portal or email tax-careers@enterprise.com with resume"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Referral Reward Note:
            <input
              value={referralBonus}
              onChange={(e) => setReferralBonus(e.target.value)}
              placeholder="e.g. $2,500 referral bonus upon successful 90-day onboarding"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-xs dark:bg-slate-800 dark:border-slate-700"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={saveSupplementaryInfo}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold hover:bg-navy-800 dark:bg-brand-600"
          >
            <Save className="w-4 h-4" /> Save Supplementary Info
          </button>
        </div>
      )}

      {/* TAB 7: PERFORMANCE METRICS */}
      {tab === 'performance' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-3">
            <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">Log Platform Performance</h4>
            {['views', 'clicks', 'applications', 'qualified_applications', 'shortlisted', 'interviews', 'cost_per_application'].map((key) => (
              <label key={key} className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {key.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                <input
                  type="number"
                  value={metrics[key] || ''}
                  onChange={(e) => setMetrics((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 block w-full border rounded-lg px-3 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                />
              </label>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={recordMetricsSubmit}
              className="w-full px-3 py-2 rounded-lg bg-navy-900 text-white text-xs font-semibold dark:bg-brand-600"
            >
              Save Metrics for {PLATFORMS.find(([id]) => id === platform)?.[1]}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-2">
            <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">Recorded Performance Logs</h4>
            {data.metrics?.length ? (
              data.metrics.map((row) => (
                <div key={row.id} className="border-b py-2 text-xs dark:border-slate-800">
                  <div className="flex justify-between">
                    <b>{row.platform}</b>
                    <span className="text-[10px] text-slate-400">{row.recorded_at}</span>
                  </div>
                  <pre className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">{JSON.stringify(row.metrics, null, 2)}</pre>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No performance metrics recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: POSTING HISTORY */}
      {tab === 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 space-y-2">
          <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">Lifecycle Audit Trail</h4>
          {data.activity?.length ? (
            data.activity.map((row) => (
              <div key={row.id} className="border-b py-2.5 text-xs last:border-0 dark:border-slate-800 flex items-start justify-between">
                <div>
                  <span className="font-bold text-navy-900 dark:text-slate-200">{row.action}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">{JSON.stringify(row.details)}</div>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-4">{row.created_at}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No activity recorded for this job posting.</p>
          )}
        </div>
      )}
    </div>
  );
}
