// Import React and useState for pagination state management.
import React, { useState } from 'react';

// Import Badge component for skills and status pills.
import { Badge } from '../common/Badge';

// Import icons from lucide-react.
import { Eye, FileText, Sparkles, MapPin, Clock, ShieldCheck, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Export CandidateTable component for list and tabular candidate display with customizable inline controls.
export const CandidateTable = ({
  candidates = [],
  onSelectCandidate,
  onPreviewResume,
  onUpdateCandidate,
}) => {
  // Current page state for smooth pagination over large candidate directories.
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Compute total pages and sliced candidates for active page.
  const totalPages = Math.ceil(candidates.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCandidates = candidates.slice(startIndex, startIndex + pageSize);

  // Available candidate stages for interactive stage dropdown.
  const stageOptions = [
    'Screened',
    'Shortlisted',
    'Technical Round 1',
    'Technical Round 2',
    'Manager Round',
    'HR Discussion',
    'Offer Extended',
    'Hired',
    'Rejected'
  ];

  // Available availability notice options.
  const availabilityOptions = [
    'Immediate',
    '15 Days',
    '30 Days',
    '60 Days',
    'Serving Notice'
  ];

  // Helper to map stage to styling classes.
  const getStageStyle = (status) => {
    switch (status) {
      case 'Offered':
      case 'Offer Extended':
      case 'Hired':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Technical Round 1':
      case 'Technical Round 2':
      case 'Manager Round':
      case 'Interviewing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Shortlisted':
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Render responsive table structure.
  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table head */}
          <thead>
            <tr className="border-b border-slate-100 bg-surface-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-5">Candidate</th>
              <th className="py-3.5 px-4">Stage (Customizable)</th>
              <th className="py-3.5 px-4">Experience</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4">Availability</th>
              <th className="py-3.5 px-4">Key Skills</th>
              <th className="py-3.5 px-4">AI Score</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table body */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedCandidates.map((cand) => (
              <tr
                key={cand.id}
                onClick={() => onSelectCandidate(cand.id)}
                className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
              >
                {/* Name and current role */}
                <td className="py-4 px-5">
                  <div className="font-semibold text-navy-900 group-hover:text-brand-700 transition-colors">
                    {cand.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    {cand.currentRole || 'Candidate'}
                  </div>
                </td>

                {/* Interactive Stage Dropdown */}
                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block w-40">
                    <select
                      value={cand.status || 'Screened'}
                      onChange={(e) => {
                        const newStage = e.target.value;
                        onUpdateCandidate(
                          { ...cand, status: newStage, stage: newStage },
                          `Stage updated to ${newStage} for ${cand.name}`
                        );
                      }}
                      className={`w-full py-1 px-2.5 rounded-lg border text-xs font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all ${getStageStyle(
                        cand.status || 'Screened'
                      )}`}
                    >
                      {stageOptions.map((stg) => (
                        <option key={stg} value={stg} className="bg-white text-navy-900 font-normal">
                          {stg}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                  </div>
                </td>

                {/* Experience years */}
                <td className="py-4 px-4 text-slate-600 font-medium">
                  {cand.experienceYears != null ? `${cand.experienceYears} Years` : '5+ Years'}
                </td>

                {/* Location */}
                <td className="py-4 px-4 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cand.location || 'India'}</span>
                  </div>
                </td>

                {/* Interactive Availability Dropdown */}
                <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block w-36">
                    <select
                      value={cand.availability || 'Immediate'}
                      onChange={(e) => {
                        const newAvail = e.target.value;
                        onUpdateCandidate(
                          { ...cand, availability: newAvail },
                          `Availability set to ${newAvail} for ${cand.name}`
                        );
                      }}
                      className="w-full py-1 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs appearance-none cursor-pointer focus:outline-none focus:border-brand-500 font-medium"
                    >
                      {availabilityOptions.map((avail) => (
                        <option key={avail} value={avail}>
                          {avail}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </td>

                {/* Skills tags */}
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {(cand.primarySkills || []).slice(0, 3).map((skill, sIdx) => (
                      <Badge key={sIdx} variant="neutral" size="xs">
                        {skill}
                      </Badge>
                    ))}
                    {(cand.primarySkills || []).length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{cand.primarySkills.length - 3}
                      </span>
                    )}
                  </div>
                </td>

                {/* AI Score pill */}
                <td className="py-4 px-4">
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 border border-brand-200/80 px-2.5 py-0.5 rounded-full text-xs">
                    <Sparkles className="w-3 h-3 text-brand-600" />
                    {cand.matchScore || 85}%
                  </span>
                </td>

                {/* Actions */}
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onSelectCandidate(cand.id)}
                      className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Inspect Candidate Profile & Schedule"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onPreviewResume(cand)}
                      className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Preview Resume Document"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {candidates.length > pageSize && (
        <div className="px-5 py-3 border-t border-slate-100 bg-surface-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-navy-900">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-navy-900">
              {Math.min(startIndex + pageSize, candidates.length)}
            </span>{' '}
            of <span className="font-semibold text-navy-900">{candidates.length}</span> candidates
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-navy-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-navy-900">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-navy-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
