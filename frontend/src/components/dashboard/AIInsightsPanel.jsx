// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react for AI intelligence items.
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Database,
  Cpu,
} from 'lucide-react';

// Export AIInsightsPanel presenting grounded suggestions and live database alerts.
export const AIInsightsPanel = ({
  insights = [],
  onSelectCandidate,
  onSelectJob,
  onNavigateTab,
  vertical = false,
}) => {
  // Helper to map both backend insight types (urgent, recommendation, verification) and legacy categories cleanly.
  const getInsightVisuals = (item) => {
    const key = item.category || item.type || 'recommendation';
    switch (key) {
      case 'urgent':
      case 'governance':
        return {
          icon: <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          badge: 'Priority Action',
          border: 'border-amber-200/80 dark:border-amber-800/60',
          bg: 'bg-amber-50/50 dark:bg-amber-950/20',
        };
      case 'grounded_job':
      case 'recommendation':
        return {
          icon: <Database className="w-4 h-4 text-brand-600 dark:text-brand-400" />,
          badge: 'Talent & JD Readiness',
          border: 'border-brand-200/80 dark:border-brand-800/60',
          bg: 'bg-brand-50/50 dark:bg-brand-950/20',
        };
      case 'vector_readiness':
      case 'verification':
      default:
        return {
          icon: <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          badge: 'Vector Health',
          border: 'border-purple-200/80 dark:border-purple-800/60',
          bg: 'bg-purple-50/50 dark:bg-purple-950/20',
        };
    }
  };

  // Render AI panel matching container height cleanly without cramped subcolumns.
  return (
    <div className="h-full flex flex-col justify-between p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card transition-colors">
      <div>
        {/* Panel header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/40 border border-brand-200/80 dark:border-brand-700/60 text-brand-600 dark:text-brand-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-900 dark:text-white tracking-tight">
                AI Recruitment Insights
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live SQLite pipeline alerts & Nemotron readiness
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            nemotron-3-embed-1b
          </span>
        </div>

        {/* Insights layout adapts to stacked single-column inside narrow cards or 3-column across full width */}
        <div className={vertical ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
          {insights.map((item) => {
            const visuals = getInsightVisuals(item);

            return (
              <div
                key={item.id}
                className={`p-4 border rounded-xl transition-all shadow-subtle flex flex-col justify-between ${visuals.bg} ${visuals.border}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {visuals.icon}
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {visuals.badge}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-semibold text-navy-900 dark:text-white mb-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Action trigger link */}
                <div className="pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                  <button
                    onClick={() => {
                      if (item.targetTab && onNavigateTab) {
                        onNavigateTab(item.targetTab);
                      } else if (item.targetJobId && onSelectJob) {
                        onSelectJob(item.targetJobId);
                      } else if (item.targetCandidateId && onSelectCandidate) {
                        onSelectCandidate(item.targetCandidateId);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 cursor-pointer transition-colors"
                  >
                    <span>{item.actionText || 'Inspect Details'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
