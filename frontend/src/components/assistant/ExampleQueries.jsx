// Import React for functional component structure.
import React from 'react';

// Import Sparkles icon from lucide-react.
import { Sparkles } from 'lucide-react';

// Export ExampleQueries component providing 1-click prompt suggestion pills.
export const ExampleQueries = ({ queries = [], onSelectQuery, disabled }) => {
  // Return suggestions container.
  return (
    <div className="space-y-2">
      {/* Title */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-brand-600" />
        <span>Example Queries</span>
      </div>

      {/* Grid of clickable suggestion pills */}
      <div className="flex flex-wrap gap-2">
        {queries.map((q, idx) => (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onSelectQuery(q)}
            className="text-left text-xs px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-navy-900 border border-slate-200/80 hover:border-slate-300 rounded-xl transition-all shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
