// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react.
import { Sparkles, AlertCircle, TrendingUp, ShieldCheck, ArrowRight } from 'lucide-react';

// Export AIInsightsPanel presenting Nemotron suggestions and hiring alerts.
export const AIInsightsPanel = ({ insights = [], onSelectCandidate, onSelectJob }) => {
  // Helper to map insight type to styled icon.
  const getIcon = (type) => {
    switch (type) {
      case 'urgent':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'recommendation':
        return <TrendingUp className="w-4 h-4 text-brand-600" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-brand-600" />;
    }
  };

  // Render panel.
  return (
    <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-card">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-50 border border-brand-200/80 text-brand-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900 tracking-tight">AI Insights & Action Plan</h3>
            <p className="text-xs text-slate-500 mt-0.5">Automated suggestions powered by Nemotron LLM</p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">nemotron-4-340b</span>
      </div>

      {/* Insights cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((item) => (
          <div
            key={item.id}
            className="p-4 bg-surface-50/70 hover:bg-white border border-slate-200/70 hover:border-slate-300 rounded-xl transition-all shadow-subtle flex flex-col justify-between"
          >
            <div>
              {/* Type badge and icon */}
              <div className="flex items-center gap-2 mb-2">
                {getIcon(item.type)}
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {item.type}
                </span>
              </div>

              {/* Title */}
              <h4 className="text-xs font-semibold text-navy-900 mb-1.5">{item.title}</h4>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
            </div>

            {/* Action trigger link */}
            <div className="pt-3 mt-3 border-t border-slate-200/50">
              <button
                onClick={() => {
                  if (item.targetCandidateId && onSelectCandidate) {
                    onSelectCandidate(item.targetCandidateId);
                  } else if (item.targetJobId && onSelectJob) {
                    onSelectJob(item.targetJobId);
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 transition-colors"
              >
                <span>{item.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
