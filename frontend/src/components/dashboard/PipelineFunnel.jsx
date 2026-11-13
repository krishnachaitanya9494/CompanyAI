// Import React for JSX structure.
import React from 'react';

// Export PipelineFunnel component visualizing candidates across recruitment stages with equal-height grid support.
export const PipelineFunnel = ({ stages = [], totalCandidates = null, footerStats = null, onSelectStage }) => {
  // Compute total across displayed stages cleanly or use true total candidates when stages omit terminal buckets.
  const stageSum = stages.reduce((acc, curr) => acc + (curr.count || 0), 0);
  const displayTotal = totalCandidates != null ? totalCandidates : stageSum;

  // Render funnel container card stretching cleanly to match sibling panel height.
  return (
    <div className="h-full flex flex-col justify-between p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl card-reflective transition-colors">
      <div>
        {/* Header with title and total candidates pill */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-navy-900 dark:text-white tracking-tight">
              Recruitment Pipeline Overview
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Live SQLite distribution across candidate progression stages
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {displayTotal} Candidates
          </span>
        </div>

        {/* Funnel bars list */}
        <div className="space-y-3.5">
          {stages.map((stage, idx) => (
            <div
              key={idx}
              onClick={() => onSelectStage && onSelectStage(stage.stage)}
              className={`group space-y-1.5 p-2 -mx-2 rounded-xl transition-colors ${
                onSelectStage ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-darkHover' : ''
              }`}
            >
              {/* Stage title and count numbers */}
              <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                <span className="text-slate-700 dark:text-slate-200 font-medium group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                  {stage.stage}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-navy-900 dark:text-white font-bold font-mono">
                    {stage.count}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">
                    ({stage.percentage}%)
                  </span>
                </div>
              </div>

              {/* Progress bar background track with GPU scaleX reveal + smooth width transition */}
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stage.color || 'bg-brand-500'} rounded-full animate-barGrow transition-[width] duration-500 ease-out`}
                  style={{
                    width: `${Math.max(stage.count > 0 ? 2 : 0, stage.percentage)}%`,
                    animationDelay: `${Math.min(idx * 45, 225)}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balanced Pipeline Health Summary Footer eliminating vertical whitespace gaps */}
      {footerStats && (
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-surface-darkBorder grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-100 dark:border-surface-darkBorder">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Interviews</span>
            <span className="text-sm font-bold text-navy-900 dark:text-white font-mono">{footerStats.interviews ?? 0}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-100 dark:border-surface-darkBorder">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Offers</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">{footerStats.offers ?? 0}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-100 dark:border-surface-darkBorder">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Rejected</span>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 font-mono">{footerStats.rejected ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
};
