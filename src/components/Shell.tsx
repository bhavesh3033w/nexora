import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Settings as Cog, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { usePrefs } from '../features/personalization/PrefsContext';
import { Banner } from './ui';
import NexoraMark from './NexoraMark';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export const Brand = ({ sub }: { sub?: string }) => (
  <div className="brand"><span className="logo"><NexoraMark size={28} depth /></span><span className="lbl">Nexora{sub && <span className="muted small"> {sub}</span>}</span></div>);

/** Initials from the signed-in account's real name (falls back to the e-mail, then "?"). */
export const initialsOf = (name?: string, email?: string) => {
  const src = (name || email || '').trim(); if (!src) return '?';
  const p = src.split(/[\s@._-]+/).filter(Boolean); return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
};

function ProfileMenu({ variant, onLogout }: { variant: 'user' | 'admin'; onLogout: () => void }) {
  const { session } = useAuth(); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!session) return null;
  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="avatar" aria-hidden>{initialsOf(session.name, session.email)}</span>
        <span className="profile-meta"><b>{session.name}</b><span className="muted small">{session.role === 'admin' ? 'Administrator' : 'Member'}</span></span>
        <ChevronDown size={16} className="chev" />
      </button>
      {open && <div className="card pop profile-pop col" role="menu" aria-label="Account">
        <div className="row"><span className="avatar lg" aria-hidden>{initialsOf(session.name, session.email)}</span>
          <div style={{ minWidth: 0 }}><b>{session.name}</b><div className="muted small ellipsis">{session.email}</div><span className="tag pri">{session.role}</span></div></div>
        <div className="menu-sep" />
        {variant === 'user' && <Link role="menuitem" className="menu-item" to="/app/settings" onClick={() => setOpen(false)}><Cog size={16} />Settings</Link>}
        <button role="menuitem" className="menu-item" onClick={onLogout}><LogOut size={16} />Log out</button>
      </div>}
    </div>
  );
}

export default function Shell({ items, variant, extra }: { items: NavItem[]; variant: 'user' | 'admin'; extra?: ReactNode }) {
  const { session, logout } = useAuth(); const { prefs, saveError } = usePrefs(); const nav = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false); const mode = variant === 'user' ? prefs.nav : 'sidebar'; const main = useRef<HTMLElement>(null);
  useEffect(() => { setOpen(false); main.current?.focus({ preventScroll: true }); }, [loc.pathname]);
  const out = async () => { await logout(); nav(variant === 'admin' ? '/admin/login' : '/user/login'); };
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find(i => (i.end ? loc.pathname === i.to : loc.pathname === i.to || loc.pathname.startsWith(i.to + '/')));
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div className={`shell ${variant} ${mode === 'compact' ? 'compact' : ''} ${mode === 'top' ? 'top' : ''}`}>
      <a href="#main" className="sr" style={{ position: 'absolute', left: -999 }}>Skip to content</a>
      <aside className={'side' + (open ? ' open' : '')} aria-label="Primary">
        <div className="row between"><Brand sub={variant === 'admin' ? 'Admin' : undefined} /><button className="icon-btn menu-btn" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
        {mode !== 'top' && <div className="nav-cap lbl">{variant === 'admin' ? 'Administration' : 'Workspace'}</div>}
        <nav className="nav" aria-label={variant + ' navigation'} style={{ display: 'flex', flexDirection: mode === 'top' ? 'row' : 'column', gap: 4 }}>
          {items.map(i => <NavLink key={i.to} to={i.to} end={i.end} title={i.label}><i.icon size={18} /><span className="lbl">{i.label}</span></NavLink>)}
        </nav>
        <div className="grow spacer" />
        {session && <div className="side-user lbl" aria-label="Signed in as">
          <span className="avatar" aria-hidden>{initialsOf(session.name, session.email)}</span>
          <div style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{session.name}</b><span className="small ellipsis" style={{ display: 'block', opacity: .75 }}>{session.email}</span></div>
        </div>}
        <nav className="nav"><button className="navbtn" onClick={out} title="Log out"><LogOut size={18} /><span className="lbl">Log out</span></button></nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="row"><button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <div className="crumb"><b>{current?.label ?? (variant === 'admin' ? 'Administration' : 'Nexora')}</b><span className="muted small">{variant === 'admin' ? 'Administration' : date}</span></div></div>
          <div className="row top-actions">{extra}<ProfileMenu variant={variant} onLogout={out} /></div>
        </header>
        <main id="main" tabIndex={-1} ref={main} className="content" style={{ outline: 'none' }}>
          {saveError && <Banner kind="error">{saveError}</Banner>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { prefs } = usePrefs(); const [open, setOpen] = useState(false);
  const show = prefs.notifications.includes('inapp') || prefs.notifications.includes('important');
  if (!show) return null;
  return (
    <div className="bell" style={{ position: 'relative' }}>
      <button className="icon-btn" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(!open)}><Bell size={19} /></button>
      {open && <div className="card pop col" role="region" aria-label="Notifications">
        <b>Notifications</b>
        <div className="muted small">Notifications are not available yet — the backend has no notifications endpoint, so nothing is shown here.</div>
        {(prefs.notifications.includes('desktop') || prefs.notifications.includes('email')) && <div className="muted small">Desktop and email delivery are not available yet.</div>}
      </div>}
    </div>
  );
}
