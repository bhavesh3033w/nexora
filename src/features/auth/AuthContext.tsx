import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { Role, Session } from '../../types';
import { authService } from '../../api/services';
import { errorMessage, isHttpStatus } from '../../api/client';
import { Banner } from '../../components/ui';

interface Ctx {
  session: Session | null; ready: boolean;
  /** Set when the session check failed for a reason other than "not signed in" (e.g. API unreachable). */
  bootError: string; retry: () => void;
  login: (p: Role, e: string, pw: string) => Promise<Session>; register: (n: string, e: string, pw: string) => Promise<Session>; logout: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);
const valid = (s: unknown): s is Session => !!s && typeof s === 'object' && typeof (s as Session).id === 'string' && ((s as Session).role === 'admin' || (s as Session).role === 'user');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false); const [bootError, setBootError] = useState('');
  const boot = useCallback(async () => {
    setReady(false); setBootError('');
    try { const s = await authService.me(); if (valid(s)) setSession(s); else { setSession(null); setBootError('The server returned an unexpected session response.'); } } // backend-managed session cookie decides identity and role
    catch (e) { setSession(null); if (!isHttpStatus(e, 401, 403)) setBootError(errorMessage(e)); } // 401/403 simply means "not signed in"
    finally { setReady(true); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  const accept = (s: Session) => { if (!valid(s)) throw new Error('The server returned an unexpected sign-in response.'); setSession(s); return s; };
  const login = useCallback(async (p: Role, e: string, pw: string) => accept(await authService.login(p, e, pw)), []);
  const register = useCallback(async (n: string, e: string, pw: string) => accept(await authService.register(n, e, pw)), []);
  const logout = useCallback(async () => { try { await authService.logout(); } finally { setSession(null); } }, []);
  const value = useMemo(() => ({ session, ready, bootError, retry: () => void boot(), login, register, logout }), [session, ready, bootError, boot, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/** UX-only guard. Real authorization MUST be enforced by Spring Boot on every request. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, ready, bootError, retry } = useAuth(); const loc = useLocation();
  if (!ready) return <div className="center-screen" role="status">Loading…</div>;
  if (bootError) return <div className="center-screen"><div className="col" style={{ maxWidth: 460, textAlign: 'center' }}><Banner kind="error">{bootError}</Banner><div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={retry}>Retry</button><Link className="btn" to="/">Back to main website</Link></div></div></div>;
  if (!session || session.role !== role) return <Navigate to={`/${role}/login`} replace state={{ from: loc.pathname, denied: !!session }} />;
  return <>{children}</>;
}
