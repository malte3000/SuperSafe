'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFundProgressively } from '@/lib/funds/progressive-fetch';

export function useFundData<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setRefreshing(true);
    void fetchFundProgressively<T>({ url, signal: controller.signal, onData: setData })
      .then(() => { if (!controller.signal.aborted) setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) { setRefreshing(false); active.current = null; } });
  }, [url]);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, intervalMs);
    // Recheck timestamps and source availability when returning to an old tab.
    const visible = () => { if (document.visibilityState === 'visible' && !active.current) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active.current?.abort(); window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh, intervalMs]);

  return { data, error, refreshing, loading: data === null && refreshing, refresh };
}
