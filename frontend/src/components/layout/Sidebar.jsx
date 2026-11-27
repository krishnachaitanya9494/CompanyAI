// Import React for component structure and hooks.
import React, { useState } from 'react';

// Import icons from lucide-react for modern enterprise navigation visuals.
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
  UserCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Info,
  Building,
  Award,
  ShieldAlert,
  Bell,
  Network,
  Globe2,
  Scale,
  Compass,
  Gauge,
  GitCompare,
  Lock,
  Activity,
} from 'lucide-react';

// Export Sidebar component receiving navigation state, counts, and layout controls.
export const Sidebar = ({
  activeTab,
  onSelectTab,
  counts = {},
  isCollapsed = false,
  onToggleCollapse,
  theme = 'light',
  onToggleTheme,
  isGovernanceBlocked = true,
}) => {
  // Temporary tooltip or toast state for planned modules.
  const [plannedNotice, setPlannedNotice] = useState(null);

  // Navigation sections categorized for the enterprise hybrid ATS workspace covering all 13 operational modules.
  const navSections = [
    {
      title: 'Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
          isFunctional: true,
        },
        {
          id: 'ai_monitor',
          label: 'AI Monitor',
          icon: Activity,
          badge: 'Live',
          isAi: true,
          isFunctional: true,
        },
        {
          id: 'assistant',
          label: 'AI Recruiter Assistant',
          icon: Sparkles,
          badge: 'AI',
          isAi: true,
          isFunctional: true,
        },
      ],
    },
    {
      title: 'Recruiting Hub',
      items: [
        {
          id: 'jobs',
          label: 'Jobs & Requisitions',
          icon: Briefcase,
          badge: counts.jobs || 34,
          isFunctional: true,
        },
        {
          id: 'candidates',
          label: 'Candidates',
          icon: Users,
          badge: counts.candidates || 194,
          isFunctional: true,
        },
        {
          id: 'matching',
          label: 'Candidate Matches',
          icon: Layers,
          badge: 'Smart Fit',
          isAi: true,
          isFunctional: true,
        },
        {
          id: 'comparison',
          label: 'Compare Resume to Job',
          icon: GitCompare,
          badge: '1-on-1 Fit',
          isAi: true,
          isFunctional: true,
        },
        {
          id: 'requests',
          label: 'Hiring Requisitions',
          icon: GitPullRequest,
          badge: counts.requests || 5,
          isFunctional: true,
        },
        {
          id: 'talent_pool',
          label: 'Resume Database',
          icon: UserCheck,
          badge: counts.resumes ? `${counts.resumes} Resumes` : '240 Resumes',
          isFunctional: true,
        },
        {
          id: 'clients',
          label: 'Clients & Accounts',
          icon: Building,
          badge: null,
          isFunctional: true,
        },
        {
          id: 'placements',
          label: 'Placements & Offers',
          icon: Award,
          badge: null,
          isFunctional: true,
        },
        {
          id: 'interviews',
          label: 'Scheduled Interviews',
          icon: Calendar,
          badge: counts.interviews || null,
          isFunctional: true,
        },
        {
          id: 'pipeline',
          label: 'Hiring Pipeline',
          icon: Columns,
          badge: null,
          isFunctional: true,
        },
      ],
    },
    {
      title: 'Reports & Insights',
      isBlocked: isGovernanceBlocked,
      items: [
        {
          id: 'analytics',
          label: 'Recruitment Analytics',
          icon: BarChart3,
          badge: isGovernanceBlocked ? 'Blocked' : 'Live',
          isFunctional: true,
          isBlocked: isGovernanceBlocked,
        },
        {
          id: 'approvals',
          label: 'Recruiter Approvals',
          icon: ShieldAlert,
          badge: isGovernanceBlocked ? null : (counts.pendingApprovals > 0 ? counts.pendingApprovals : null),
          isFunctional: true,
          isBlocked: isGovernanceBlocked,
        },
        {
          id: 'agent_activity',
          label: 'AI Automation Activity',
          icon: Cpu,
          badge: null,
          isFunctional: true,
          isBlocked: isGovernanceBlocked,
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: null,
          isFunctional: true,
          isBlocked: isGovernanceBlocked,
        },
      ],
    },
    {
      title: 'Administration',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          badge: null,
          isFunctional: true,
        },
      ],
    },
  ];

  // Handle item click, routing to functional tabs and auto-collapsing mobile drawer when open.
  const handleItemClick = (item) => {
    if (item.isBlocked) {
      setPlannedNotice('Governance & Analytics is currently blocked. You can unblock this section in Settings.');
      onSelectTab(item.id);
      if (typeof window !== 'undefined' && window.innerWidth < 768 && !isCollapsed && onToggleCollapse) {
        onToggleCollapse();
      }
      return;
    }

    if (item.isFunctional) {
      setPlannedNotice(null);
      onSelectTab(item.id);
      // Close mobile drawer automatically after selecting a route.
      if (typeof window !== 'undefined' && window.innerWidth < 768 && !isCollapsed && onToggleCollapse) {
        onToggleCollapse();
      }
    } else {
      setPlannedNotice(item.description || `${item.label} is planned for a future release.`);
      setTimeout(() => setPlannedNotice(null), 3000);
    }
  };

  // Render navigation drawer with responsive mobile overlay, backdrop, and active rail highlight.
  return (
    <>
      {!isCollapsed && onToggleCollapse && (
        <div
          onClick={onToggleCollapse}
          aria-hidden="true"
          className="fixed inset-0 bg-navy-950/40 backdrop-blur-[1px] z-30 md:hidden animate-fadeIn"
        />
      )}
      <aside
        className={`h-screen fixed md:sticky top-0 left-0 flex flex-col bg-white/95 dark:bg-surface-darkCard/95 backdrop-blur-md glass-surface border-r border-slate-200/80 dark:border-surface-darkBorder select-none transition-all duration-200 z-40 md:z-30 ${
          // On mobile, hide when collapsed; on tablet/desktop, show compact 64px icon rail.
          isCollapsed ? 'hidden md:flex md:w-16 md:min-w-[4rem]' : 'w-64 min-w-[16rem] shadow-2xl md:shadow-none'
        }`}
      >
      {/* Workspace branding header */}
      <div className="flex items-center justify-between px-3.5 py-4 border-b border-slate-100 dark:border-surface-darkBorder">
        {/* Dual-tone Emerald-Indigo logo badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-50 to-accent-100 dark:from-brand-900/50 dark:to-accent-900/60 border border-accent-200/80 dark:border-accent-700/60 flex items-center justify-center text-accent-600 dark:text-accent-400 shadow-subtle flex-shrink-0">
            <Cpu className="w-4 h-4" />
          </div>

          {/* Brand identity titles hidden in collapsed mode */}
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-navy-900 dark:text-white tracking-tight truncate">CompanyAI</span>
                <span className="px-1.5 py-0.2 text-[10px] font-semibold text-accent-700 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/60 border border-accent-200 dark:border-accent-700/60 rounded">
                  v2.0
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">Enterprise Workspace</span>
            </div>
          )}
        </div>

        {/* Collapsible sidebar toggle button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Planned feature temporary banner */}
      {plannedNotice && !isCollapsed && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2 animate-fadeIn">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] leading-tight">{plannedNotice}</span>
        </div>
      )}

      {/* Main navigation list grouped by sections */}
      <div className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto no-scrollbar">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {/* Section Header Title visible only when expanded */}
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  {section.title}
                </span>
                {section.isBlocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.2 rounded">
                    <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span>Blocked</span>
                  </span>
                )}
              </div>
            )}

            {/* Section Item Links (15-16px readable navigation scale) */}
            {section.items.map((item) => {
              const isActive = activeTab === item.id;
              const IconComponent = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  aria-current={isActive ? 'page' : undefined}
                  title={
                    isCollapsed
                      ? `${item.label}${item.isBlocked ? ' (Blocked)' : item.isPlanned ? ' (Planned)' : ''}`
                      : undefined
                  }
                  className={`relative w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-xl text-[15px] font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-100/95 dark:bg-surface-darkHover text-navy-950 dark:text-white shadow-subtle font-semibold'
                      : item.isBlocked
                      ? 'text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                      : item.isPlanned
                      ? 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50/60 dark:hover:bg-surface-darkHover/40 opacity-75'
                      : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50/90 dark:hover:bg-surface-darkHover hover:translate-x-0.5'
                  }`}
                >
                  {isActive && !isCollapsed && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400"
                    />
                  )}
                  {/* Left icon and label */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComponent
                      className={`w-4 h-4 flex-shrink-0 transition-colors ${
                        isActive
                          ? item.isAi
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-navy-950 dark:text-white'
                          : item.isBlocked
                          ? 'text-amber-600 dark:text-amber-400'
                          : item.isPlanned
                          ? 'text-slate-400 dark:text-slate-600'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {/* Right badge counter or indicator */}
                  {!isCollapsed && (
                    item.isBlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 flex-shrink-0">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Blocked</span>
                      </span>
                    ) : (
                      item.badge !== null && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            item.isPlanned
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700/50'
                              : item.isAi
                              ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-700/60'
                              : isActive
                              ? 'bg-white dark:bg-slate-800 text-navy-900 dark:text-white border border-slate-200 dark:border-slate-700'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )
                    )
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile and System Telemetry Footer */}
      <div className="p-2.5 border-t border-slate-100 dark:border-surface-darkBorder bg-surface-50/60 dark:bg-surface-darkCanvas/40 space-y-2">
        {/* Workspace telemetry status card visible when expanded */}
        {!isCollapsed && (
          <div className="p-2.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl shadow-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Talent Engine
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 dark:text-brand-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                Synced
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-navy-900 dark:text-white font-medium">
              <Database className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>SQLite & CompanyAI</span>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-normal truncate">
              {counts.resumes || 240} Resumes • {counts.jobs || 34} Jobs
            </p>
          </div>
        )}

        {/* User profile row and theme toggle */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between px-1'}`}>
          {/* User avatar and identity info */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 shadow-subtle">
              KC
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-navy-900 dark:text-white truncate">Krishna C.</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Recruiter Admin</span>
              </div>
            )}
          </div>

          {/* Theme toggle icon button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-1.5 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors flex-shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
          )}
        </div>
      </div>
      </aside>
    </>
  );
};
