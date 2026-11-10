// Import React for JSX structure.
import React from 'react';

// Import SearchInput common component.
import { SearchInput } from '../common/SearchInput';

// Import Filter and X icons from lucide-react.
import { Filter, X, RotateCcw } from 'lucide-react';

// Export CandidateFilter component for filtering candidate datasets.
export const CandidateFilter = ({
  searchQuery,
  onSearchChange,
  selectedLocation,
  onLocationChange,
  selectedAvailability,
  onAvailabilityChange,
  selectedSkill,
  onSkillChange,
  availableSkills = [],
  availableLocations = [],
  onResetFilters,
}) => {
  // Determine if any filter is active.
  const hasActiveFilters = searchQuery || selectedLocation || selectedAvailability || selectedSkill;

  // Render filter bar.
  return (
    <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-subtle space-y-3">
      {/* Search query row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search candidates by name, title, skill, or keyword..."
          className="w-full sm:max-w-md"
        />

        {/* Filter reset button if any filter is chosen */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-navy-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Select dropdowns row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filter by:
        </span>

        {/* Location selector */}
        <select
          value={selectedLocation}
          onChange={(e) => onLocationChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-navy-900 font-medium focus:outline-none focus:border-brand-500"
        >
          <option value="">All Locations</option>
          {availableLocations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        {/* Availability selector */}
        <select
          value={selectedAvailability}
          onChange={(e) => onAvailabilityChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-navy-900 font-medium focus:outline-none focus:border-brand-500"
        >
          <option value="">All Availabilities</option>
          <option value="Immediate">Immediate Joiner</option>
          <option value="15 Days">15 Days Notice</option>
          <option value="30 Days">30 Days Notice</option>
        </select>

        {/* Skills selector */}
        <select
          value={selectedSkill}
          onChange={(e) => onSkillChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-navy-900 font-medium focus:outline-none focus:border-brand-500"
        >
          <option value="">All Technical Skills</option>
          {availableSkills.map((sk) => (
            <option key={sk} value={sk}>
              {sk}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
