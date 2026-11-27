// Compact live AI model badge showing active local Ollama model(s) and server status.
import React, { useEffect, useState } from 'react';
import { aiApi } from '../../api/client';

let _cachedMonitor = null;
let _inflightPromise = null;

export const AIModelBadge = ({ models = 'llama3.2:3b', className = '' }) => {
  const [online, setOnline] = useState(_cachedMonitor ? Boolean(_cachedMonitor.ollama_online) : true);

  useEffect(() => {
    if (_cachedMonitor) {
      setOnline(Boolean(_cachedMonitor.ollama_online));
      return;
    }
    if (!_inflightPromise) {
      _inflightPromise = aiApi.getMonitor().catch(() => null);
    }
    _inflightPromise.then((res) => {
      if (res) {
        _cachedMonitor = res;
        setOnline(Boolean(res.ollama_online));
      }
    });
  }, []);

  return (
    <span
      title={online ? `Local Ollama online (${models})` : `Local Ollama offline — deterministic fallback active`}
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      <span>{models}</span>
    </span>
  );
};
