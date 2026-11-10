// Import React for functional component structure.
import React from 'react';

// Export MetricCard component for clean dashboard KPI displays.
export const MetricCard = ({
  title,
  value,
  subvalue,
  icon: Icon,
  badgeText,
  badgeVariant = 'brand',
  trend,
  onClick,
}) => {
  // Render KPI card.
  return (
    <div
      onClick={onClick}
      className={`p-5 bg-white border border-slate-200/80 rounded-2xl shadow-card transition-all ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-dropdown' : ''
      }`}
    >
      {/* Top row with label and optional icon */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500">
            <Icon className="w-4 h-4 stroke-[1.75]" />
          </div>
        )}
      </div>

      {/* Numerical value */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-2xl font-bold text-navy-900 tracking-tight">{value}</span>
        {subvalue && <span className="text-xs text-slate-400 font-normal">{subvalue}</span>}
      </div>

      {/* Footer row with trend or status pill */}
      {(trend || badgeText) && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-50 mt-2">
          {badgeText && (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                badgeVariant === 'brand'
                  ? 'bg-brand-50 text-brand-700 border border-brand-200/60'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {badgeText}
            </span>
          )}
          {trend && <span className="text-xs text-slate-400">{trend}</span>}
        </div>
      )}
    </div>
  );
};
