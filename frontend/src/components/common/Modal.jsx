// Import React and useEffect hook for handling Escape key listener.
import React, { useEffect } from 'react';

// Import X icon from lucide-react for modal dismissal.
import { X } from 'lucide-react';

// Export reusable Modal component supporting centered dialog or side-drawer appearance.
export const Modal = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) => {
  // Add keyboard listener to close modal on Escape press.
  useEffect(() => {
    // Define keydown handler function.
    const handleKeyDown = (e) => {
      // Check if pressed key is Escape.
      if (e.key === 'Escape') {
        // Invoke close callback.
        onClose();
      }
    };

    // Attach event listener when modal is open.
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scrolling behind open modal.
      document.body.style.overflow = 'hidden';
    }

    // Cleanup listener and restore scroll upon unmount or closing.
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // If modal is not open, render nothing.
  if (!isOpen) return null;

  // Render modal backdrop and content card.
  return (
    // Fixed container spanning entire screen with subtle dark translucent overlay.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      {/* Background click handler to dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main card dialog surface */}
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-dropdown border border-slate-200/80 overflow-hidden z-10 animate-scaleUp`}
      >
        {/* Header section with title and close icon button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-surface-50/50">
          <div>
            {/* Modal main heading */}
            <h3 className="text-lg font-semibold text-navy-900 tracking-tight">{title}</h3>
            {/* Optional descriptive subtitle */}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          {/* Dismiss button */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body content container */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-120px)]">{children}</div>
      </div>
    </div>
  );
};
