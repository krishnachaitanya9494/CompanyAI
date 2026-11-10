// Import React for functional component definition.
import React from 'react';

// Export Badge component supporting various visual variants (brand, neutral, warning, danger, blue).
export const Badge = ({ children, variant = 'neutral', size = 'sm', className = '' }) => {
  // Define style map based on variant prop to maintain consistent design tokens.
  const variantStyles = {
    // Subtle emerald green accent for AI matches, positive status, and verified tags.
    brand: 'bg-brand-50 text-brand-700 border-brand-200/80',
    // Dark navy subtle tint for structural identifiers and active tabs.
    navy: 'bg-slate-100 text-navy-800 border-slate-200',
    // Neutral slate tone for general skill tags and metadata.
    neutral: 'bg-slate-50 text-slate-700 border-slate-200/60',
    // Warning amber tone for medium priority or pending review items.
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    // Danger tone for urgent requisitions or high risk warnings.
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    // Blue tone for ongoing interviews or active progress stages.
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  // Define size map for padding and typography adjustments.
  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[11px] font-medium leading-tight',
    sm: 'px-2.5 py-1 text-xs font-medium',
    md: 'px-3 py-1.5 text-sm font-medium',
  };

  // Return styled span element.
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-tight font-sans ${variantStyles[variant] || variantStyles.neutral} ${sizeStyles[size] || sizeStyles.sm} ${className}`}
    >
      {children}
    </span>
  );
};
