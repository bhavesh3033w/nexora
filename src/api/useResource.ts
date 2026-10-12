import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './client';

export interface Resource<T> {
  /** null until the first successful load. Never filled with placeholder data. */
  data: T | null; loading: boolean; error: string;
  /** Re-fetch. Keeps the current data on screen while loading; `retry` also resets the error state. */
  refresh: () => Promise<void>; retry: () => void;
}

/** Loads data from the API with honest loading / error states. */
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const fn = useRef(load); fn.current = load;
  const alive = useRef(true); const hasData = useRef(false);
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    try { const d = await fn.current(); if (!alive.current) return; hasData.current = true; setData(d); setError(''); }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
    finally { if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const retry = useCallback(() => { setError(''); setLoading(true); void refresh(); }, [refresh]);
  return { data, loading, error, refresh, retry };
}
