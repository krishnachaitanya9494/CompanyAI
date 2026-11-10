// Import React for JSX structure.
import React from 'react';

// Export PipelineFunnel component visualizing candidates across stages.
export const PipelineFunnel = ({ stages = [] }) => {
  // Compute total candidates dynamically across stages.
  const total = stages.reduce((acc, curr) => acc + (curr.count || 0), 0);

  // Render funnel container card.
  return (
    <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-card">
      {/* Header with title and total status */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 tracking-tight">
            Recruitment Pipeline Overview
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active funnel conversion rates across candidate qualification stages
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-navy-900 border border-slate-200">
          {total} Candidates
        </span>
      </div>

      {/* Funnel bars list */}
      <div className="space-y-4">
        {stages.map((stage, idx) => (
          <div key={idx} className="space-y-1.5">
            {/* Stage title and count numbers */}
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-700">{stage.stage}</span>
              <div className="flex items-center gap-2">
                <span className="text-navy-900 font-semibold">{stage.count}</span>
                <span className="text-slate-400 text-[11px]">({stage.percentage}%)</span>
              </div>
            </div>

            {/* Progress bar background */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${stage.color || 'bg-brand-500'} rounded-full transition-all duration-500`}
                style={{ width: `${stage.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
