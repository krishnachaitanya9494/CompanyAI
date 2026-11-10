// Import React for functional component structure.
import React from 'react';

// Import Inbox icon as default visual fallback.
import { Inbox } from 'lucide-react';

// Export EmptyState component for clean zero-data or filtered-out views.
export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'Try adjusting your search filters or add new records to populate this section.',
  actionLabel,
  onAction,
}) => {
  // Render centered empty state container.
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
      {/* Icon wrapper badge */}
      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-slate-400 mb-3.5">
        <Icon className="w-6 h-6 stroke-[1.5]" />
      </div>

      {/* Primary heading */}
      <h4 className="text-sm font-semibold text-navy-900 tracking-tight">{title}</h4>

      {/* Explanatory description */}
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>

      {/* Optional action button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg shadow-subtle transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
