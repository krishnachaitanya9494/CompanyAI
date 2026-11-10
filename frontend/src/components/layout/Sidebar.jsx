// Import React for JSX structure.
import React from 'react';

// Import icons from lucide-react for modern navigation visuals.
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Briefcase,
  GitPullRequest,
  Cpu,
  Database,
  Calendar,
  Columns,
  Layers,
} from 'lucide-react';

// Export Sidebar component receiving activeTab, onSelectTab, and counts.
export const Sidebar = ({ activeTab, onSelectTab, counts = {} }) => {
  // Navigation sections categorized for recruitment workspace.
  const navSections = [
    {
      title: 'Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'assistant',
          label: 'AI Assistant',
          icon: Sparkles,
          badge: 'Nemotron',
          isAi: true,
        },
      ],
    },
    {
      title: 'Recruitment',
      items: [
        {
          id: 'candidates',
          label: 'Candidates',
          icon: Users,
          badge: counts.candidates || 178,
        },
        {
          id: 'jobs',
          label: 'Job Descriptions',
          icon: Briefcase,
          badge: counts.jobs || 7,
        },
        {
          id: 'requests',
          label: 'Hiring Requests',
          icon: GitPullRequest,
          badge: counts.requests || 5,
        },
        {
          id: 'interviews',
          label: 'Interviews',
          icon: Calendar,
          badge: counts.interviews || null,
        },
        {
          id: 'pipeline',
          label: 'Pipeline Kanban',
          icon: Columns,
          badge: null,
        },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        {
          id: 'matching',
          label: 'Matching Matrix',
          icon: Layers,
          badge: 'Vector Match',
          isAi: true,
        },
      ],
    },
  ];

  // Render navigation drawer.
  return (
    <aside className="w-64 min-w-[16rem] h-screen sticky top-0 flex flex-col bg-white border-r border-slate-200/80 select-none">
      {/* Workspace branding header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        {/* Minimal emerald logo badge */}
        <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-600 shadow-subtle">
          <Cpu className="w-4 h-4" />
        </div>

        {/* Brand identity titles */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-navy-900 tracking-tight">CompanyAI</span>
            <span className="px-1.5 py-0.2 text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded">
              v2.0
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Enterprise Recruitment Workspace</span>
        </div>
      </div>

      {/* Main navigation list grouped by sections */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {/* Section Header Title */}
            <div className="px-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              {section.title}
            </div>

            {/* Section Item Links */}
            {section.items.map((item) => {
              const isActive = activeTab === item.id;
              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-100/90 text-navy-950 shadow-subtle font-semibold'
                      : 'text-slate-600 hover:text-navy-900 hover:bg-slate-50'
                  }`}
                >
                  {/* Left icon and label */}
                  <div className="flex items-center gap-2.5">
                    <IconComponent
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? item.isAi
                            ? 'text-brand-600'
                            : 'text-navy-950'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {/* Right badge counter or indicator */}
                  {item.badge !== null && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        item.isAi
                          ? 'bg-brand-50 text-brand-700 border border-brand-200/80'
                          : isActive
                          ? 'bg-white text-navy-900 border border-slate-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom workspace status card */}
      <div className="p-3 border-t border-slate-100 bg-surface-50/50">
        <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-subtle">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Talent Engine
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              Synced
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-navy-900 font-medium">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>SQLite & Nemotron AI</span>
          </div>

          <p className="text-[10px] text-slate-400 mt-1 leading-normal">
            225 Resumes • 7 Requisitions • SQLite Grounded
          </p>
        </div>
      </div>
    </aside>
  );
};
