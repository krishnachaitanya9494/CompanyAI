// Import React and useState hook.
import React, { useState } from 'react';

// Import icons for send action and AI badge.
import { ArrowUp, Sparkles, CornerDownLeft } from 'lucide-react';

// Export ChatInput component with multi-line auto-expand support and key shortcuts.
export const ChatInput = ({ onSendMessage, isLoading, placeholder = 'Ask CompanyAI anything about candidates, JDs, or pipeline...' }) => {
  // Local state for typed input text.
  const [text, setText] = useState('');

  // Handle form submission.
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    // Prevent submitting empty text or while waiting for previous response.
    if (!text.trim() || isLoading) return;
    // Dispatch message.
    onSendMessage(text.trim());
    // Reset input text.
    setText('');
  };

  // Handle Enter key to submit (Shift+Enter adds new line).
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  

  // Render chat input box.
  return (
    <form onSubmit={handleSubmit} className="relative bg-white border border-slate-200/90 rounded-2xl shadow-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all p-2">
      {/* Textarea for message entry */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={2}
        className="w-full px-3 py-2 text-sm text-navy-900 placeholder-slate-400 bg-transparent resize-none focus:outline-none"
      />

      {/* Action controls row */}
      <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-100">
        {/* Model indicator tag */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          <span>Nemotron-4-340B Ready</span>
        </div>

        {/* Right side submit button with Enter hint */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-[10px] text-slate-400">
            Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">Enter ↵</kbd> to send
          </span>

          <button
            type="submit"
            disabled={!text.trim() || isLoading}
            className={`p-2 rounded-xl flex items-center justify-center transition-all ${
              text.trim() && !isLoading
                ? 'bg-navy-900 hover:bg-navy-800 text-white shadow-subtle'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </form>
  );
};
