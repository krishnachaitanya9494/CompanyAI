// Import React for header structure.
import React from 'react';

// Import icons for search, AI status, and notifications.
import { Sparkles, Search, Bell, HelpCircle, ArrowUpRight } from 'lucide-react';

// Export Topbar component receiving title, subtitle, and action triggers.
export const Topbar = ({ title, subtitle, onOpenAI, onOpenSearch }) => {
  // Render topbar navigation.
  return (
    <header className="h-16 px-6 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      {/* Left side: title and breadcrumb */}
      <div>
        <h1 className="text-base font-semibold text-navy-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      {/* Middle/Right: Unified Search and AI triggers */}
      <div className="flex items-center gap-3">
        {/* Sleek compact shortcut for Glean-style global ⌘K search */}
        <button
          onClick={onOpenSearch}
          title="Global Enterprise Search (⌘K)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100/80 hover:bg-slate-100 border border-slate-200/70 text-slate-600 hover:text-navy-900 text-xs rounded-xl transition-all shadow-subtle"
        >
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-500">
            ⌘K
          </span>
        </button>

        {/* Quick Nemotron AI assistant shortcut button */}
        <button
          onClick={onOpenAI}
          className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 hover:bg-brand-100/80 border border-brand-200/80 text-brand-700 text-xs font-medium rounded-xl transition-all shadow-subtle group"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-600 transition-transform group-hover:rotate-12" />
          <span>Ask Nemotron</span>
        </button>

        {/* Vertical divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* User profile avatar pill */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
            KC
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-medium text-navy-900 leading-tight">Krishna C.</span>
            <span className="text-[10px] text-slate-400">Recruiter Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
};
