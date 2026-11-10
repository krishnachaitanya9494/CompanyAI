// Import React for JSX structure.
import React from 'react';

// Import icons for activities.
import { Sparkles, FileText, CheckCircle2, Calendar, UserCheck } from 'lucide-react';

// Export RecentActivity component displaying system events.
export const RecentActivity = ({ activities = [] }) => {
  // Helper to map activity type to specific icon.
  const getIcon = (type) => {
    switch (type) {
      case 'ai_match':
        return <Sparkles className="w-3.5 h-3.5 text-brand-600" />;
      case 'jd_analyzed':
        return <FileText className="w-3.5 h-3.5 text-slate-600" />;
      case 'resume_ingested':
        return <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />;
      case 'interview':
        return <Calendar className="w-3.5 h-3.5 text-blue-600" />;
      case 'offer':
        return <UserCheck className="w-3.5 h-3.5 text-teal-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Render recent activity card.
  return (
    <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 tracking-tight">Recent Activities</h3>
          <p className="text-xs text-slate-500 mt-0.5">Real-time candidate indexing and LLM evaluations</p>
        </div>
        <span className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-200/60 px-2 py-0.5 rounded-md">
          Live Feed
        </span>
      </div>

      {/* Activity list */}
      <div className="space-y-4">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3.5">
            {/* Left activity badge icon */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0 mt-0.5">
              {getIcon(item.type)}
            </div>

            {/* Middle title and description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-navy-900 truncate">{item.title}</h4>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{item.time}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
              <span className="inline-block text-[10px] text-slate-400 mt-1 font-mono">
                via {item.actor}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
