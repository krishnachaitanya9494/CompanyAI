// Import React and useState hook.
import React, { useState, useMemo } from 'react';

// Import candidate components.
import { CandidateTable } from '../components/candidates/CandidateTable';
import { CandidateFilter } from '../components/candidates/CandidateFilter';
import { CandidateDetail } from '../components/candidates/CandidateDetail';
import { ResumePreview } from '../components/candidates/ResumePreview';
import { EmptyState } from '../components/common/EmptyState';

// Import icons from lucide-react.
import { Users, FileUp, Sparkles, Plus } from 'lucide-react';

// Export CandidatesPage component handling candidate inventory, search, and drill-downs.
export const CandidatesPage = ({
  candidates = [],
  jobs = [],
  onUpdateCandidate,
  onUploadResume,
  onCreateCandidate,
  resumeDiscovery = null,
  initialCandidateId = null,
  onClearInitialCandidate,
  onNavigateToComparison,
}) => {
  // Search query text state.
  const [searchQuery, setSearchQuery] = useState('');
  // Location filter state.
  const [selectedLocation, setSelectedLocation] = useState('');
  // Availability filter state.
  const [selectedAvailability, setSelectedAvailability] = useState('');
  // Skill filter state.
  const [selectedSkill, setSelectedSkill] = useState('');

  // Selected candidate object for detailed profile drawer modal.
  const [activeCandidateId, setActiveCandidateId] = useState(initialCandidateId);

  // Candidate object for resume document preview modal.
  const [previewCandidate, setPreviewCandidate] = useState(null);
  // Show upload and ingestion results beside the candidate list controls.
  const [uploadNotice, setUploadNotice] = useState('');

  // Lookup active candidate dynamically so any stage or interview update immediately reflects.
  const activeCandidate = useMemo(() => {
    return candidates.find((c) => c.id === activeCandidateId) || null;
  }, [candidates, activeCandidateId]);

  // Extract unique skill list from all candidate records across all uploaded resumes.
  const availableSkills = useMemo(() => {
    // Create set to collect distinct skills.
    const set = new Set();
    // Iterate over candidate list.
    candidates.forEach((c) => {
      // Gather all candidate skills from skills array or primary/secondary lists.
      const list = c.skills || [...(c.primarySkills || []), ...(c.secondarySkills || [])];
      // Add each valid skill to the set.
      list.forEach((s) => s && set.add(s));
    });
    // Return sorted array of unique technical skills.
    return Array.from(set).sort();
  }, [candidates]);

  // Extract unique locations.
  const availableLocations = useMemo(() => {
    // Create set for distinct candidate locations.
    const set = new Set();
    // Collect locations.
    candidates.forEach((c) => c.location && set.add(c.location));
    // Return sorted locations.
    return Array.from(set).sort();
  }, [candidates]);

  // Filter candidates based on active filters and text query.
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Collect candidate skills for searching.
      const candSkills = c.skills || [...(c.primarySkills || []), ...(c.secondarySkills || [])];

      // Text match against name, role, skills, summary.
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (c.name || '').toLowerCase().includes(query);
        const matchesRole = (c.currentRole || '').toLowerCase().includes(query);
        const matchesSkills = candSkills.some((s) => (s || '').toLowerCase().includes(query));
        const matchesSummary = (c.summary || '').toLowerCase().includes(query);
        if (!matchesName && !matchesRole && !matchesSkills && !matchesSummary) {
          return false;
        }
      }

      // Location match.
      if (selectedLocation && c.location !== selectedLocation) {
        return false;
      }

      // Availability match.
      if (selectedAvailability && c.availability !== selectedAvailability) {
        return false;
      }

      // Skill match against any candidate skills.
      if (selectedSkill && !candSkills.some((s) => (s || '').toLowerCase() === selectedSkill.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [candidates, searchQuery, selectedLocation, selectedAvailability, selectedSkill]);

  // Reset all active filters.
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
    setSelectedAvailability('');
    setSelectedSkill('');
  };

  // Open candidate details modal by ID.
  const handleSelectCandidateById = (id) => {
    setActiveCandidateId(id);
  };

  // Render candidate directory page.
  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Title & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[26px] font-bold font-display text-navy-950 dark:text-white tracking-tight flex items-center gap-2">
            <span>Candidate Directory</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {filteredCandidates.length} Profiles
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Parsed resume profiles with evidence-linked verification, customizable stages, and interview scheduler
          </p>
        </div>

        {/* Actions row: Add candidate and Upload Resume */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-800 dark:hover:bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white shadow-subtle transition-all">
            <FileUp className="w-3.5 h-3.5" />
            <span>Upload Resume</span>
            <input
              className="hidden"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || !onUploadResume) return;
                try {
                  setUploadNotice('Uploading resume and parsing candidate profile...');
                  const notice = await onUploadResume(file);
                  setUploadNotice(notice);
                  setTimeout(() => setUploadNotice(''), 6000);
                } catch (error) {
                  setUploadNotice(`Upload error: ${error.message}`);
                }
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* Upload Confirmation or Error Notice Banner */}
      {uploadNotice && (
        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs font-semibold text-brand-800 flex items-center justify-between animate-fadeIn shadow-subtle">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>{uploadNotice}</span>
          </div>
          <button
            onClick={() => setUploadNotice('')}
            className="text-slate-400 hover:text-navy-900 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <CandidateFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        selectedAvailability={selectedAvailability}
        onAvailabilityChange={setSelectedAvailability}
        selectedSkill={selectedSkill}
        onSkillChange={setSelectedSkill}
        availableSkills={availableSkills}
        availableLocations={availableLocations}
        onResetFilters={handleResetFilters}
      />

      {/* Candidate Data Table or Empty State */}
      {filteredCandidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates match your filters"
          description="Try broadening your criteria, clearing selected location/skills, or resetting the search text."
          actionLabel="Clear Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <CandidateTable
          candidates={filteredCandidates}
          onSelectCandidate={handleSelectCandidateById}
          onPreviewResume={(cand) => setPreviewCandidate(cand)}
          onUpdateCandidate={onUpdateCandidate}
        />
      )}

      {/* Candidate Profile Details Drawer/Modal */}
      <CandidateDetail
        candidate={activeCandidate}
        isOpen={Boolean(activeCandidate)}
        onClose={() => {
          setActiveCandidateId(null);
          if (onClearInitialCandidate) onClearInitialCandidate();
        }}
        onPreviewResume={(cand) => setPreviewCandidate(cand)}
        onUpdateCandidate={onUpdateCandidate}
        onCompareWithJD={onNavigateToComparison}
      />

      {/* Resume Document Preview Modal */}
      <ResumePreview
        candidate={previewCandidate}
        isOpen={Boolean(previewCandidate)}
        onClose={() => setPreviewCandidate(null)}
      />
    </div>
  );
};
