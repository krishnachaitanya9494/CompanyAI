// Import React and hooks for header interactivity.
import React, { useState } from 'react';
import { Magnet } from '../reactbits/Magnet';

// Import icons from lucide-react for search, AI status, notifications, and theme switching.
import {
  Sparkles,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ShieldAlert,
  CheckCircle,
  ChevronDown,
  Upload,
} from 'lucide-react';

// Export Topbar component receiving titles, action triggers, and theme state.
export const Topbar = ({
  title,
  subtitle,
  onOpenAI,
  onOpenSearch,
  onUploadJD,
  theme = 'light',
  onToggleTheme,
  pendingApprovalsCount = 0,
  onToggleSidebar,
}) => {
  // Toggle profile dropdown menu state.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  // Toggle notification popover state.
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Render topbar navigation header with hybrid enterprise aesthetics.
  return (
    <header className="h-16 px-4 md:px-6 border-b border-slate-200/80 dark:border-surface-darkBorder bg-white/90 dark:bg-surface-darkCard/90 backdrop-blur-md glass-surface flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Left side: mobile menu trigger, title, and breadcrumb context */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile / Tablet sidebar toggle button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Toggle navigation sidebar"
            className="p-1.5 rounded-lg text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Title and contextual subtitle */}
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-navy-900 dark:text-white tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] md:text-sm text-slate-500 dark:text-slate-400 font-normal truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Global Upload JD, Search, CompanyAI trigger, Theme switch, Notifications, and Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Global Upload Job Description button fixed in Topbar across all pages */}
        {onUploadJD && (
          <button
            type="button"
            onClick={onUploadJD}
            title="Upload Job Description"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-700 text-white text-[15px] font-semibold shadow-sm transition-colors flex-shrink-0 btn-interactive"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden md:inline">Upload Job Description</span>
            <span className="md:hidden">Upload JD</span>
          </button>
        )}

        {/* Global ⌘K search shortcut button */}
        <button
          onClick={onOpenSearch}
          title="Global Enterprise Search (⌘K / Ctrl+K)"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 dark:bg-surface-darkHover hover:bg-slate-200/70 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-navy-900 dark:hover:text-white text-[15px] rounded-xl transition-all shadow-subtle btn-interactive"
        >
          <Search className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="hidden sm:inline font-medium">Search</span>
          <span className="text-xs bg-white dark:bg-surface-darkCard px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-slate-500 dark:text-slate-400">
            ⌘K
          </span>
        </button>

        {/* Quick CompanyAI assistant shortcut button with subtle React Bits Magnet pull */}
        <Magnet padding={20} magnetStrength={8}>
          <button
            onClick={onOpenAI}
            title="Open AI Recruitment Assistant"
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-3.5 py-1.5 bg-gradient-to-r from-brand-50 via-white to-accent-50 dark:from-brand-900/30 dark:via-surface-darkCard dark:to-accent-950/60 hover:from-brand-100/80 hover:to-accent-100/80 dark:hover:to-accent-900/50 border border-accent-200/80 dark:border-accent-700/60 text-accent-700 dark:text-accent-400 text-[15px] font-semibold rounded-xl transition-all shadow-subtle btn-interactive group"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400 transition-transform group-hover:rotate-12" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        </Magnet>

        {/* Vertical divider */}
        <div className="w-px h-5 bg-slate-200 dark:bg-surface-darkBorder" />

        {/* Light/Dark theme toggle button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-all duration-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 btn-interactive group"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 transition-transform duration-300 group-hover:-rotate-12" />
            )}
          </button>
        )}

        {/* Notification bell button with pending approvals badge */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            title="Notifications and governance approvals"
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors relative border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <Bell className="w-4 h-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-surface-darkCard" />
            )}
          </button>

          {/* Notifications dropdown popover */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-2xl shadow-dropdown p-4 text-xs z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-surface-darkBorder mb-3">
                <span className="font-semibold text-navy-900 dark:text-white">System Notifications</span>
                <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
              </div>
              {pendingApprovalsCount > 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block">{pendingApprovalsCount} Pending Approval(s)</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      Sensitive AI actions require recruiter authorization in the banner above.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>All governance workflows clear. No pending items.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User profile avatar pill and dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-1 py-1 pr-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-semibold shadow-subtle">
              KC
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-navy-900 dark:text-white leading-tight">Krishna C.</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Recruiter Admin</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden lg:block" />
          </button>

          {/* User profile dropdown menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder rounded-2xl shadow-dropdown p-3 text-xs z-50 animate-fadeIn">
              <div className="px-2 py-1.5 border-b border-slate-100 dark:border-surface-darkBorder mb-2">
                <span className="font-semibold text-navy-900 dark:text-white block">Krishna Chaitanya</span>
                <span className="text-[11px] text-slate-400 block truncate">Talent Acquisition Lead</span>
                <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-700/60">
                  Role: Recruiter Admin
                </span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div className="px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-darkHover cursor-pointer flex items-center justify-between">
                  <span>Workspace Engine</span>
                  <span className="text-[10px] font-mono text-brand-600 dark:text-brand-400">Online</span>
                </div>
                <div className="px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-darkHover cursor-pointer flex items-center justify-between">
                  <span>Vector Index</span>
                  <span className="text-[10px] font-mono text-slate-400">768-dim</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
