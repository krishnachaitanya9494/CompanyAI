import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Loader2,
  Briefcase,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Tag,
  FileText,
} from 'lucide-react';
import { Modal } from '../common/Modal';

const DEPARTMENT_PRESETS = [
  'Digital Engineering',
  'Operations',
  'Customer Experience & BPO',
  'Finance & Accounting',
  'Enterprise Architecture & Cloud',
  'Human Resources & Talent',
  'Product & Marketing',
  'Sales & Business Development',
  'Legal, Risk & Compliance',
];

const STATUS_OPTIONS = [
  'Open',
  'Active',
  'Under Review',
  'Draft',
  'Closed',
  'On Hold',
];

export const EditJobModal = ({ isOpen, onClose, job, onSave }) => {
  const [form, setForm] = useState({
    title: '',
    department: '',
    location: '',
    minYears: '',
    maxYears: '',
    status: 'Open',
    requiredSkills: '',
    preferredSkills: '',
    description: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync form state whenever job prop changes or modal opens
  useEffect(() => {
    if (job) {
      setForm({
        title: job.title || '',
        department: job.department || 'Digital Engineering',
        location: job.location || '',
        minYears: job.minYears !== undefined && job.minYears !== null ? String(job.minYears) : '',
        maxYears: job.maxYears !== undefined && job.maxYears !== null ? String(job.maxYears) : '',
        status: job.status || 'Open',
        requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : '',
        preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills.join(', ') : '',
        description: job.description || '',
      });
      setError('');
      setSuccess(false);
    }
  }, [job, isOpen]);

  if (!isOpen || !job) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      setError('Job title is required.');
      return;
    }

    const minNum = form.minYears !== '' ? Number(form.minYears) : null;
    const maxNum = form.maxYears !== '' ? Number(form.maxYears) : null;

    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setError('Minimum experience cannot exceed maximum experience.');
      return;
    }

    const reqSkillsList = form.requiredSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const prefSkillsList = form.preferredSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let expStr = 'Not specified';
    if (minNum !== null && maxNum !== null) {
      expStr = `${minNum} - ${maxNum} Years`;
    } else if (minNum !== null) {
      expStr = `${minNum}+ Years`;
    } else if (job.experienceRequired) {
      expStr = job.experienceRequired;
    }

    const updatedJob = {
      ...job,
      title: cleanTitle,
      department: form.department.trim() || 'Digital Engineering',
      location: form.location.trim() || 'Not specified',
      minYears: minNum,
      maxYears: maxNum,
      experienceRequired: expStr,
      status: form.status,
      requiredSkills: reqSkillsList,
      preferredSkills: prefSkillsList,
      description: form.description,
    };

    setSaving(true);
    setError('');
    try {
      if (onSave) {
        await onSave(updatedJob);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 500);
    } catch (err) {
      setError(err?.message || 'Failed to save job changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Preview tags for required skills
  const parsedRequiredSkills = form.requiredSkills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Job Description"
      subtitle={`Update requisition metadata, skills, and scope for ${job.jdCode || `Job #${job.id}`}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-sm">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs animate-fadeIn">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Job details saved successfully!</span>
            </div>
          )}

          {/* Job Title */}
          <div>
            <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Workforce Management Lead / Real-Time Analyst"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-sm font-medium transition-all"
              required
            />
          </div>

          {/* Department & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
                Department
              </label>
              <input
                type="text"
                list="department-presets"
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="e.g. Operations / Customer Experience"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
              <datalist id="department-presets">
                {DEPARTMENT_PRESETS.map((dept) => (
                  <option key={dept} value={dept} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
                Requisition Status
              </label>
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all cursor-pointer"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & Experience Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g. Bengaluru / Hybrid"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
                Min Experience (Yrs)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={form.minYears}
                  onChange={(e) => handleChange('minYears', e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
                Max Experience (Yrs)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={form.maxYears}
                  onChange={(e) => handleChange('maxYears', e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Required Skills */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200">
                Required / Mandatory Skills
              </label>
              <span className="text-[11px] text-slate-400">Comma-separated</span>
            </div>
            <textarea
              rows={2}
              value={form.requiredSkills}
              onChange={(e) => handleChange('requiredSkills', e.target.value)}
              placeholder="e.g. NICE IEX / WFM, Real-Time Management, ASA, Occupancy, Schedule Adherence, Excel"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all custom-scrollbar"
            />
            {parsedRequiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {parsedRequiredSkills.map((sk, idx) => (
                  <span
                    key={`${sk}-${idx}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
                  >
                    <Tag className="w-2.5 h-2.5 text-brand-500" />
                    {sk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Preferred Skills */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-navy-900 dark:text-slate-200">
                Preferred / Nice-to-Have Skills
              </label>
              <span className="text-[11px] text-slate-400">Comma-separated</span>
            </div>
            <input
              type="text"
              value={form.preferredSkills}
              onChange={(e) => handleChange('preferredSkills', e.target.value)}
              placeholder="e.g. Verint, Genesys Cloud CCaaS, Power BI, SQL"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
          </div>

          {/* Description / Scope */}
          <div>
            <label className="block text-xs font-bold text-navy-900 dark:text-slate-200 mb-1">
              Job Description / Scope Summary
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detailed job responsibilities, candidate expectations, and scope..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all custom-scrollbar leading-relaxed"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-surface-darkBorder bg-surface-50/70 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || success}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
export default EditJobModal;
