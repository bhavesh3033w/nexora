import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Prefs, WidgetId } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { preferencesService } from '../../api/services';
import { errorMessage } from '../../api/client';
import { Banner } from '../../components/ui';
import { QUESTIONS } from './questions';

export const ALL_WIDGETS: WidgetId[] = ['tasks', 'meetings', 'messages', 'notifications', 'learning', 'projects', 'analytics', 'assistant'];
/** Default UI configuration (not user data). Used until the server returns the user's saved preferences. */
export const DEFAULTS: Prefs = { v: 1, onboarded: false, focus: 'balanced', workspace: 'all', layout: 'balanced', widgets: ['tasks', 'meetings', 'messages'], order: ALL_WIDGETS,
  nav: 'sidebar', notifications: ['inapp'], theme: 'system', color: 'purple', style: 'minimal', textSize: 'medium', spacing: 'comfortable', motion: 'subtle', goal: '', adaptive: 'ask' };

/** Handles corrupted, missing and outdated data: unknown values fall back to defaults. */
export function sanitize(raw: unknown): Prefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>; const out: Prefs = { ...DEFAULTS };
  for (const q of QUESTIONS) {
    const allowed = q.options.map(x => x.v); const val = r[q.key as string];
    if (q.multi) { if (Array.isArray(val)) (out as unknown as Record<string, unknown>)[q.key] = val.filter(x => typeof x === 'string' && allowed.includes(x)); }
    else if (typeof val === 'string' && (allowed.includes(val) || (q.optional && val === ''))) (out as unknown as Record<string, unknown>)[q.key] = val;
  }
  const ord = Array.isArray(r.order) ? (r.order as unknown[]).filter((x): x is WidgetId => ALL_WIDGETS.includes(x as WidgetId)) : [];
  out.order = [...new Set([...ord, ...ALL_WIDGETS])] as WidgetId[];
  out.onboarded = r.onboarded === true;
  return out;
}
export function attrsFor(p: Prefs) {
  const dark = p.theme === 'dark' || (p.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  return { 'data-theme': dark ? 'dark' : 'light', 'data-color': p.color, 'data-style': p.style, 'data-text': p.textSize, 'data-space': p.spacing, 'data-motion': p.motion } as Record<string, string>;
}

interface Ctx { prefs: Prefs; loaded: boolean; loadError: string; retry: () => void; saveError: string; update: (patch: Partial<Prefs>) => Promise<boolean>; reset: () => Promise<boolean> }
const PrefsCtx = createContext<Ctx>(null as unknown as Ctx);
export const usePrefs = () => useContext(PrefsCtx);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS); const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(''); const [saveError, setErr] = useState(''); const [nonce, setNonce] = useState(0);
  const uid = session?.role === 'user' ? session.id : null;
  const loaded = uid === null ? true : loadedFor === uid; // never report "loaded" for a user whose preferences have not been fetched yet
  useEffect(() => {
    let cancelled = false; setLoadError('');
    if (!uid) { setPrefs(DEFAULTS); return; }
    preferencesService.get().then(p => { if (!cancelled) setPrefs(p ? sanitize(p) : DEFAULTS); })
      .catch(e => { if (!cancelled) { setPrefs(DEFAULTS); setLoadError(errorMessage(e)); } })
      .finally(() => { if (!cancelled) setLoadedFor(uid); });
    return () => { cancelled = true; };
  }, [uid, nonce]);
  useEffect(() => {
    const root = document.documentElement; const apply = () => Object.entries(attrsFor(uid ? prefs : { ...DEFAULTS, theme: 'light' })).forEach(([k, v]) => root.setAttribute(k, v));
    apply(); const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply);
  }, [prefs, uid]);
  const commit = useCallback(async (next: Prefs) => {
    if (!uid) return false; setErr('');
    try { await preferencesService.save(next); setPrefs(next); return true; }
    catch (e) { setErr(`Could not save your preferences to the server. Your changes were not applied. ${errorMessage(e)}`); return false; }
  }, [uid]);
  const update = useCallback((patch: Partial<Prefs>) => commit(sanitize({ ...prefs, ...patch })), [prefs, commit]);
  const reset = useCallback(() => commit({ ...DEFAULTS, onboarded: false }), [commit]);
  const retry = useCallback(() => { setLoadedFor(undefined); setNonce(n => n + 1); }, []);
  const value = useMemo(() => ({ prefs, loaded, loadError, retry, saveError, update, reset }), [prefs, loaded, loadError, retry, saveError, update, reset]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

/** Waits for the saved preferences, shows an error + retry if they cannot be loaded, and sends not-yet-onboarded users to the wizard. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { prefs, loaded, loadError, retry } = usePrefs();
  if (!loaded) return <div className="center-screen" role="status">Loading your workspace…</div>;
  if (loadError) return <div className="center-screen"><div className="col" style={{ maxWidth: 460, textAlign: 'center' }}><Banner kind="error">Could not load your preferences. {loadError}</Banner><div><button className="btn primary" onClick={retry}>Retry</button></div></div></div>;
  if (!prefs.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
