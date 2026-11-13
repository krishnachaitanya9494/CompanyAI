// Import React for JSX structure.
import React from 'react';

// Import SearchInput and CustomSelect common components.
import { SearchInput } from '../common/SearchInput';
import { CustomSelect } from '../common/CustomSelect';

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
    <div className="p-4 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-subtle space-y-3">
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
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Select dropdowns row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-surface-darkBorder text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filter by:
        </span>

        {/* Location selector */}
        <CustomSelect
          value={selectedLocation}
          onChange={onLocationChange}
          ariaLabel="Filter by location"
          size="sm"
          buttonClassName="bg-slate-50 dark:bg-slate-800"
          options={[
            { value: '', label: 'All Locations' },
            ...availableLocations.map((loc) => ({ value: loc, label: loc })),
          ]}
        />

        {/* Availability selector */}
        <CustomSelect
          value={selectedAvailability}
          onChange={onAvailabilityChange}
          ariaLabel="Filter by availability"
          size="sm"
          buttonClassName="bg-slate-50 dark:bg-slate-800"
          options={[
            { value: '', label: 'All Availabilities' },
            { value: 'Immediate', label: 'Immediate Joiner' },
            { value: '15 Days', label: '15 Days Notice' },
            { value: '30 Days', label: '30 Days Notice' },
          ]}
        />

        {/* Skills selector */}
        <CustomSelect
          value={selectedSkill}
          onChange={onSkillChange}
          ariaLabel="Filter by technical skill"
          size="sm"
          buttonClassName="bg-slate-50 dark:bg-slate-800"
          options={[
            { value: '', label: 'All Technical Skills' },
            ...availableSkills.map((sk) => ({ value: sk, label: sk })),
          ]}
        />
      </div>
    </div>
  );
};
