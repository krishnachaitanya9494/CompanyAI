// Import React and useMemo for performant text parsing.
import React, { useMemo } from 'react';
// Import icons from lucide-react for enhanced visual callouts.
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code2,
  Sparkles,
  Info,
  Copy,
  Check,
} from 'lucide-react';

/**
 * Helper to parse inline markdown: **bold**, *italic*, and `code` tags.
 * Returns an array of React spans.
 */
export const renderInlineMarkdown = (text) => {
  if (!text) return null;

  // Split tokens by bold (**...**), inline code (`...`), and italics (*...*).
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-navy-900 dark:text-white">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-darkHover font-mono text-[11px] text-brand-700 dark:text-brand-300 border border-slate-200/70 dark:border-surface-darkBorder"
        >
          {codeText}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const italText = part.slice(1, -1);
      return (
        <em key={idx} className="italic text-slate-700 dark:text-slate-300">
          {italText}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
};

/**
 * RichChatMessageContent parses raw AI agent text containing Markdown
 * headers, lists, code blocks, and structured candidate evaluation summaries.
 */
export const RichChatMessageContent = ({ content = '' }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = React.useState(null);

  const handleCopyCode = (code, idx) => {
    navigator.clipboard?.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const parsedElements = useMemo(() => {
    if (!content) return [];

    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    let codeBlockBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle Code Block start/end ```
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // Closing code block
          const codeString = codeBlockBuffer.join('\n');
          const codeIdx = i;
          elements.push(
            <div
              key={`code-${codeIdx}`}
              className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-surface-darkBorder bg-slate-950 text-slate-100 font-mono text-xs shadow-subtle"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                  <Code2 className="w-3 h-3 text-brand-400" />
                  {codeBlockLanguage || 'Code'}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, codeIdx)}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors"
                >
                  {copiedCodeIdx === codeIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-[11px] leading-relaxed text-emerald-300 selection:bg-brand-900">
                <code>{codeString}</code>
              </pre>
            </div>
          );
          codeBlockBuffer = [];
          inCodeBlock = false;
        } else {
          // Opening code block
          inCodeBlock = true;
          codeBlockLanguage = line.trim().slice(3).trim();
          codeBlockBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockBuffer.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Empty lines
      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-1.5" />);
        continue;
      }

      // Markdown Headings: #, ##, ###
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4
            key={`h4-${i}`}
            className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider mt-3 mb-1.5 flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            {renderInlineMarkdown(trimmed.slice(4))}
          </h4>
        );
        continue;
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-sm font-bold text-navy-900 dark:text-white tracking-tight mt-3 mb-1.5 flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            {renderInlineMarkdown(trimmed.slice(3))}
          </h3>
        );
        continue;
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-base font-bold text-navy-900 dark:text-white tracking-tight mt-3 mb-2"
          >
            {renderInlineMarkdown(trimmed.slice(2))}
          </h2>
        );
        continue;
      }

      // Special Callout: Top Ranked Candidate line
      if (trimmed.includes('Top Ranked Candidate:')) {
        elements.push(
          <div
            key={`topcand-${i}`}
            className="my-2.5 p-3 rounded-xl bg-gradient-to-r from-brand-500/10 via-emerald-500/5 to-transparent border border-brand-200/80 dark:border-brand-700/60 flex items-start gap-2.5 shadow-subtle"
          >
            <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs sm:text-[13px] leading-relaxed flex-1">
              {renderInlineMarkdown(trimmed.replace(/^[-*]\s*/, ''))}
            </div>
          </div>
        );
        continue;
      }

      // Special Callout: Eligibility Assessment line
      if (trimmed.includes('Eligibility Assessment:')) {
        elements.push(
          <div
            key={`eligibility-${i}`}
            className="my-2 p-3 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-700/60 flex items-start gap-2.5 shadow-subtle"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs sm:text-[13px] leading-relaxed flex-1 text-slate-800 dark:text-slate-200">
              {renderInlineMarkdown(trimmed.replace(/^[-*]\s*/, ''))}
            </div>
          </div>
        );
        continue;
      }

      // Bullet points (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.replace(/^[-*]\s+/, '');
        elements.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2 text-xs sm:text-[13px] leading-relaxed my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500/70 dark:bg-brand-400 flex-shrink-0 mt-2" />
            <div className="flex-1">{renderInlineMarkdown(bulletText)}</div>
          </div>
        );
        continue;
      }

      // Standard paragraphs
      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-[13px] leading-relaxed my-1">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    }

    return elements;
  }, [content, copiedCodeIdx]);

  return <div className="space-y-1">{parsedElements}</div>;
};
