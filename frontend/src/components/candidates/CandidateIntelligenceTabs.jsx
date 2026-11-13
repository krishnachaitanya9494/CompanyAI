/**
 * Phase 1 Candidate Intelligence Sub-Tabs rendered inside CandidateDetail:
 * - Digital Twin 360° (verified facts, extracted resume profile, suitability)
 * - Resume Evolution (chronological version diffs without assuming skill loss)
 * - Potential & Mobility (verified vs transferable skills, alternative roles)
 * - Candidate Network (strong employer/project evidence vs technical similarity)
 */
import React, { useState, useEffect } from 'react';
import { intelligenceApi } from '../../api/client';
import { Badge } from '../common/Badge';
import { LatticeLoader } from '../reactbits/LatticeLoader';
import {
  Layers,
  GitBranch,
  Compass,
  Network,
  ShieldCheck,
  AlertCircle,
  Briefcase,
  Building,
  Award,
  GraduationCap,
  FolderGit2,
  ArrowRight,
  Info,
} from 'lucide-react';

export const CandidateIntelligenceTabs = ({ candidateId, activeTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!candidateId || activeTab === 'overview') return;
    let alive = true;
    setLoading(true);
    setError('');
    setData(null);

    const loader =
      activeTab === 'digital_twin'
        ? intelligenceApi.getDigitalTwin(candidateId)
        : activeTab === 'evolution'
        ? intelligenceApi.getResumeEvolution(candidateId)
        : activeTab === 'mobility'
        ? intelligenceApi.getPotentialMobility(candidateId)
        : intelligenceApi.getCandidateNetwork(candidateId);

    loader
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Unable to load talent intelligence.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [candidateId, activeTab]);

  if (loading) {
    return (
      <div className="p-10 flex justify-center bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-surface-darkBorder">
        <LatticeLoader label="Computing Phase 1 Talent Intelligence" pattern="orbit" grid={3} color="#4F46E5" cellSize={5} fontSize={12} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  // 1. DIGITAL TWIN 360
  if (activeTab === 'digital_twin') {
    const ext = data.extracted_profile || {};
    return (
      <div className="space-y-4 text-xs sm:text-sm animate-fadeIn">
        <div className="p-3.5 rounded-xl bg-accent-50/70 dark:bg-accent-950/40 border border-accent-200 dark:border-accent-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-accent-800 dark:text-accent-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            Unified 360° Digital Twin • Sources: {(data.data_provenance_summary?.extracted_sources || []).length} Resume(s)
          </span>
          <Badge variant="accent" size="xs">Verified + Extracted Attribution</Badge>
        </div>

        {/* Extracted Profile Facts with Source Attribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-accent-600" />
              Extracted Employers & Titles
            </h4>
            {((ext.companies || []).length === 0 && (ext.titles || []).length === 0) ? (
              <p className="text-xs text-slate-400">No explicit employer or title lines parsed from stored resume files.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {(ext.titles || []).map((t, i) => (
                  <div key={`t-${i}`} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-800/60">
                    <span className="font-semibold text-navy-900 dark:text-slate-100">{t.value}</span>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">{t.source_filename}</span>
                  </div>
                ))}
                {(ext.companies || []).map((c, i) => (
                  <div key={`c-${i}`} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-700 dark:text-slate-200">{c.value}</span>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">{c.source_filename}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-brand-600" />
              Certifications, Education & Projects
            </h4>
            {((ext.certifications || []).length === 0 && (ext.education || []).length === 0 && (ext.projects || []).length === 0) ? (
              <p className="text-xs text-slate-400">No explicit certification, education, or project headers extracted.</p>
            ) : (
              <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
                {(ext.certifications || []).map((c, i) => (
                  <div key={`cert-${i}`} className="p-1.5 rounded bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                    <strong>Cert:</strong> {c.value}
                  </div>
                ))}
                {(ext.education || []).map((e, i) => (
                  <div key={`edu-${i}`} className="p-1.5 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 flex items-start gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                    <span>{e.value}</span>
                  </div>
                ))}
                {(ext.projects || []).map((p, i) => (
                  <div key={`proj-${i}`} className="p-1.5 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 flex items-start gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent-500" />
                    <span>{p.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Job Suitability Summary */}
        <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-brand-600" />
            Top Open Job Suitability (Phase 5C Matching Engine)
          </h4>
          {(data.job_suitability || []).length === 0 ? (
            <p className="text-xs text-slate-400">No active jobs evaluated.</p>
          ) : (
            <div className="space-y-2">
              {data.job_suitability.map((jm) => (
                <div key={jm.job_id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-navy-900 dark:text-white block truncate">{jm.job_title}</span>
                    <span className="text-[11px] text-slate-500">{jm.client_name || 'Internal'} • Sem Sim: {(jm.semantic_similarity ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={jm.match_score >= 75 ? 'success' : jm.match_score >= 60 ? 'warning' : 'neutral'} size="xs">
                      {jm.classification}
                    </Badge>
                    <span className="font-mono font-bold text-sm text-navy-900 dark:text-white">{jm.match_score}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 italic">{data.placements_note}</p>
        </div>
      </div>
    );
  }

  // 2. RESUME EVOLUTION
  if (activeTab === 'evolution') {
    return (
      <div className="space-y-4 text-xs sm:text-sm animate-fadeIn">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-surface-darkBorder flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-navy-900 dark:text-white flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-brand-600" />
            {data.overall_summary}
          </span>
          <Badge variant="brand" size="xs">{data.resume_count} Version(s)</Badge>
        </div>

        <div className="space-y-3">
          {(data.timeline || []).map((ver) => (
            <div key={ver.resume_id} className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 font-mono font-bold text-xs border border-accent-200 dark:border-accent-800">
                    {ver.version_label}
                  </span>
                  <span className="font-semibold text-navy-900 dark:text-white text-xs">{ver.filename}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {ver.created_at ? ver.created_at.slice(0, 10) : 'Date N/A'} • {ver.disk_text_available ? 'Disk Extracted' : 'Disk Unavailable'}
                </span>
              </div>

              {ver.newly_detected_skills?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                    Newly Detected Skills in {ver.version_label}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ver.newly_detected_skills.map((sk) => (
                      <Badge key={sk} variant="success" size="xs">+ {sk}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {ver.skills_detected?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ver.skills_detected.map((sk) => (
                    <Badge key={sk} variant="neutral" size="xs">{sk}</Badge>
                  ))}
                </div>
              )}

              {ver.not_mentioned_in_this_version?.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Not mentioned in {ver.version_label}:</strong> {ver.not_mentioned_in_this_version.join(', ')}.{' '}
                  <span className="italic">{ver.omission_disclaimer}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. POTENTIAL & TALENT MOBILITY
  if (activeTab === 'mobility') {
    return (
      <div className="space-y-4 text-xs sm:text-sm animate-fadeIn">
        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{data.disclaimer}</span>
        </div>

        {/* Separated Verified vs Transferable Adjacent Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified Skills (SQLite)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(data.verified_skills || []).map((s) => (
                <Badge key={s.canonical} variant="success" size="xs">{s.canonical}</Badge>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent-700 dark:text-accent-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Adjacent / Transferable Skills (Inferred)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(data.transferable_adjacent_skills || []).slice(0, 10).map((a) => (
                <Badge key={a.skill} variant="accent" size="xs">{a.skill}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended Alternative Career Paths */}
        <div className="space-y-3">
          {(data.recommended_roles || []).length === 0 ? (
            <p className="text-xs text-slate-400 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              Insufficient catalog skill overlap to recommend alternative role paths.
            </p>
          ) : (
            data.recommended_roles.map((role) => (
              <div key={role.recommended_role} className="p-4 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-accent-600" />
                    <span className="font-bold text-navy-900 dark:text-white text-sm">{role.recommended_role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="accent" size="xs">{role.suitability_tier}</Badge>
                    <span className="font-mono font-bold text-sm text-navy-900 dark:text-white">{role.readiness_score}%</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{role.explanation}</p>
                {role.matching_open_jobs?.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-slate-500">Open Jobs:</span>
                    {role.matching_open_jobs.map((j) => (
                      <Badge key={j.job_id} variant="neutral" size="xs">{j.title}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 4. CANDIDATE NETWORK
  return (
    <div className="space-y-4 text-xs sm:text-sm animate-fadeIn">
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-surface-darkBorder text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
        <Network className="w-4 h-4 text-accent-600 flex-shrink-0 mt-0.5" />
        <span>{data.methodology_note}</span>
      </div>

      {(data.connections || []).length === 0 ? (
        <p className="text-xs text-slate-400 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          No peer candidates met the shared skill/employer threshold.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.connections.map((conn) => (
            <div key={conn.candidate_id} className="p-3.5 rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-navy-900 dark:text-white text-xs">{conn.name}</span>
                  <span className="text-[11px] text-slate-500 ml-2">
                    {conn.experience_years != null ? `${conn.experience_years} yrs` : ''} • {conn.location || 'Location N/A'}
                  </span>
                </div>
                <Badge variant={conn.relationship_strength === 'strong_evidence' ? 'success' : 'accent'} size="xs">
                  {conn.relationship_label} ({conn.similarity_score}%)
                </Badge>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 list-disc list-inside">
                {(conn.evidence || []).map((ev, idx) => (
                  <li key={idx}>{ev}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
