import { useCallback, useState } from 'react';

/** Namespace for device-local UI preferences (theme, bookmarks…). Application data never lives here — it comes from the API. */
const UI_PREFIX = 'nexora.ui.';

export function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
export function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }

/** Device-local UI preference (non-sensitive, per browser). Not application data. */
export function useLocalState<T>(name: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const key = UI_PREFIX + name;
  const [s, set] = useState<T>(() => load<T>(key, init));
  const upd = useCallback((v: T | ((p: T) => T)) => {
    set(p => { const n = typeof v === 'function' ? (v as (p: T) => T)(p) : v; save(key, n); return n; });
  }, [key]);
  return [s, upd];
}

/**
 * One-time cleanup of data written by earlier builds that ran in demo mode (sample meetings, tasks, messages, mock session…).
 * Real UI preferences (admin theme, tutorial bookmarks) are carried over to the new key namespace first.
 */
export function purgeLegacyDemoData() {
  try {
    const carry: [string, string][] = [['nexora.demo.adminprefs', UI_PREFIX + 'adminprefs'], ['nexora.demo.tutorialBookmarks', UI_PREFIX + 'tutorialBookmarks']];
    for (const [from, to] of carry) { const v = localStorage.getItem(from); if (v !== null && localStorage.getItem(to) === null) localStorage.setItem(to, v); }
    Object.keys(localStorage).filter(k => k.startsWith('nexora.demo.') || k.startsWith('nexora.prefs.v1:')).forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('nexora.session');
  } catch { /* storage unavailable */ }
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const dayOffset = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
export const today = () => dayOffset(0);
