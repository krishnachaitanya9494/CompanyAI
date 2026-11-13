// Import React for JSX structure and React Bits AnimatedList for smooth timeline entrance.
import React from 'react';
import { AnimatedList } from '../reactbits/AnimatedList';

// Import icons for diverse recruitment events.
import {
  Sparkles,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  FileCheck,
  PlusCircle,
  Clock,
} from 'lucide-react';

// Export RecentActivity component displaying system events grounded in real ActivityEvent records.
export const RecentActivity = ({ activities = [] }) => {
  // Helper to map activity type to contextual icon and styling.
  const getEventBadge = (type) => {
    switch (type) {
      case 'segmentation_approved':
        return {
          icon: <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60',
          label: 'Approved',
        };
      case 'jd_segmented':
      case 'segmentation_updated':
        return {
          icon: <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60',
          label: 'AI Segmentation',
        };
      case 'job_created':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
          bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60',
          label: 'Job Ingested',
        };
      case 'job_updated':
        return {
          icon: <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />,
          bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60',
          label: 'Job Updated',
        };
      case 'resume_uploaded':
      case 'resume_ingested':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />,
          bg: 'bg-brand-50 dark:bg-brand-900/30 border-brand-200/80 dark:border-brand-700/60',
          label: 'Resume Ingested',
        };
      case 'interview':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60',
          label: 'Interview',
        };
      case 'ai_match':
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />,
          bg: 'bg-brand-50 dark:bg-brand-900/30 border-brand-200/80 dark:border-brand-700/60',
          label: 'AI Engine',
        };
    }
  };

  // Render recent activity feed card stretching cleanly to match adjacent dashboard columns.
  return (
    <div className="h-full flex flex-col p-6 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card transition-colors">
      {/* Header with title and live feed indicator */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white tracking-tight">
            Recent System Activity
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit trail of job ingesting, AI segmentations, and candidate milestones
          </p>
        </div>
        <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 border border-brand-200/60 dark:border-brand-700/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          Live Audit
        </span>
      </div>

      {/* Activity list or empty state */}
      {activities.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Clock className="w-5 h-5 mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
          <span>No recent activities recorded in SQLite yet.</span>
        </div>
      ) : (
        <AnimatedList
          items={activities.slice(0, 7)}
          getItemKey={(item) => item.id}
          listClassName="space-y-3.5"
          staggerMs={35}
          renderItem={(item) => {
            const badge = getEventBadge(item.type);

            return (
              <div className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-surface-darkHover transition-colors">
                {/* Left activity badge icon */}
                <div
                  className={`p-2 rounded-xl border flex-shrink-0 mt-0.5 shadow-subtle ${badge.bg}`}
                >
                  {badge.icon}
                </div>

                {/* Middle title and description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {badge.label}
                      </span>
                      <h4 className="text-xs font-semibold text-navy-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0 font-mono">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  <span className="inline-block text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                    Actor: {item.actor || 'CompanyAI System'}
                  </span>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
};
