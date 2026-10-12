import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, FolderKanban, LayoutDashboard, BarChart3, Settings as Cog, Users } from 'lucide-react';
import Shell, { type NavItem } from '../../components/Shell';
import { Banner, Empty, ErrorState, Modal, NeedsBackend, Page, Progress, Skeletons } from '../../components/ui';
import { useLocalState, today } from '../../lib/storage';
import { adminService, workspaceServices } from '../../api/services';
import { errorMessage } from '../../api/client';
import { useResource } from '../../api/useResource';
import type { AdminUser, LogEntry } from '../../types';

const ITEMS: NavItem[] = [{ to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard }, { to: '/admin/users', label: 'User Management', icon: Users }, { to: '/admin/analytics', label: 'Workspace Analytics', icon: BarChart3 },
  { to: '/admin/projects', label: 'Projects Overview', icon: FolderKanban }, { to: '/admin/activity', label: 'Activity Logs', icon: FileText }, { to: '/admin/settings', label: 'Settings', icon: Cog }];
interface AP { theme: 'dark' | 'light'; color: string; space: string }
/** Device-local interface preferences for the admin console (theme/accent/density only). */
const useAP = () => useLocalState<AP>('adminprefs', { theme: 'light', color: 'purple', space: 'comfortable' });
const lvTag = (l: LogEntry['level']) => 'tag ' + (l === 'critical' ? 'err' : l === 'warn' ? '' : 'ok');

export function AdminLayout() {
  const [ap] = useAP();
  useEffect(() => { const r = document.documentElement; r.setAttribute('data-theme', ap.theme); r.setAttribute('data-color', ap.color); r.setAttribute('data-space', ap.space); r.setAttribute('data-style', 'minimal'); r.setAttribute('data-text', 'medium'); r.setAttribute('data-motion', 'subtle'); }, [ap]);
  return <Shell variant="admin" items={ITEMS} />;
}

export function AdminOverview() {
  const users = useResource(() => adminService.listUsers()); const logs = useResource(() => adminService.activity());
  const list = users.data ?? [];
  return (
    <Page title="Administrative overview" sub="Organization-wide visibility">
      {users.error && <ErrorState message={`Users: ${users.error}`} onRetry={users.retry} />}
      {users.loading ? <Skeletons n={4} /> : !users.error && <div className="grid g4 stagger">{[['Users returned by the API', list.length.toLocaleString(), 'total'], ['Active', list.filter(u => u.status === 'active').length, 'status = active'], ['Pending', list.filter(u => u.status === 'pending').length, 'status = pending'], ['Suspended', list.filter(u => u.status === 'suspended').length, 'status = suspended']].map(([a, b, c]) => <div key={a as string} className="card kpi"><span className="muted small">{a}</span><b>{b}</b><span className="small muted">{c}</span></div>)}</div>}
      <div className="grid g2">
        <NeedsBackend feature="Usage trend, workspace adoption and system health" needs="GET /admin/dashboard is listed in the README but its response shape is not defined; define it (and a health source) to enable these panels" />
        <div className="card col"><h3 style={{ fontSize: '1.05em' }}>Recent administrative activity</h3>
          {logs.error && <ErrorState message={logs.error} onRetry={logs.retry} />}
          {logs.loading ? <div className="skeleton" style={{ minHeight: 60 }} aria-hidden /> : !logs.error && <ul className="list">{(logs.data ?? []).slice(0, 5).map(l => <li key={l.id}><span className={lvTag(l.level)}>{l.level}</span>{l.action} — <span className="muted small">{l.detail}</span></li>)}{!(logs.data ?? []).length && <li className="muted">No activity recorded.</li>}</ul>}</div></div>
      <div className="card row wrap"><b>Shortcuts:</b><Link className="btn sm" to="/admin/users">Manage users</Link><Link className="btn sm" to="/admin/analytics">Analytics</Link><Link className="btn sm" to="/admin/activity">Activity logs</Link><Link className="btn sm" to="/admin/settings">Settings</Link></div>
    </Page>
  );
}
export function AdminUsers() {
  const res = useResource(() => adminService.listUsers()); const users = res.data ?? [];
  const [q, setQ] = useState(''); const [st, setSt] = useState('all'); const [selId, setSelId] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const sel = users.find(u => u.id === selId);
  const shown = users.filter(u => (st === 'all' || u.status === st) && (u.name + u.email + u.id).toLowerCase().includes(q.toLowerCase()));
  const setStatus = async (u: AdminUser, status: AdminUser['status']) => { setBusy(true); setErr(''); try { await adminService.setStatus(u.id, status); await res.refresh(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } };
  return (
    <Page title="User management" sub="Accounts returned by the Nexora API">
      {res.error && <ErrorState message={res.error} onRetry={res.retry} />}
      {res.loading ? <Skeletons n={3} /> : res.error ? null : <>
        <div className="row wrap"><input className="input" style={{ maxWidth: 320 }} aria-label="Search users" placeholder="Search by name, email or ID" value={q} onChange={e => setQ(e.target.value)} />{['all', 'active', 'pending', 'suspended'].map(s => <button key={s} className={'chip' + (st === s ? ' on' : '')} aria-pressed={st === s} onClick={() => setSt(s)}>{s}</button>)}</div>
        <div className="card scroll-x"><table><thead><tr><th>User</th><th>Workspace</th><th>Status</th><th>Last active</th><th /></tr></thead><tbody>{shown.map(u => <tr key={u.id}><td><b>{u.name}</b><div className="muted small">{u.email}</div></td><td>{u.workspace}</td><td><span className={'tag ' + (u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'err' : '')}>{u.status}</span></td><td>{u.lastActive}</td><td><button className="btn sm" onClick={() => { setErr(''); setSelId(u.id); }}>View</button></td></tr>)}{!shown.length && <tr><td colSpan={5} className="muted">{users.length ? 'No users match.' : 'The server returned no users.'}</td></tr>}</tbody></table></div></>}
      <Modal open={!!sel} title={sel?.name ?? ''} onClose={() => setSelId('')}>{sel && <><div className="muted">{sel.email} · {sel.id}</div><div>Primary workspace: <b>{sel.workspace}</b> · Last active {sel.lastActive}</div>
        <label className="f">Account status<select disabled={busy} value={sel.status} onChange={e => void setStatus(sel, e.target.value as AdminUser['status'])}><option>active</option><option>pending</option><option>suspended</option></select></label>
        <span className="muted small">Changes are sent to the server (PATCH /admin/users/{'{id}'}/status) and shown only after it confirms.</span>
        {err && <Banner kind="error">{err}</Banner>}</>}</Modal>
    </Page>
  );
}
export function AdminAnalytics() {
  return (
    <Page title="Workspace analytics" sub="Adoption and usage">
      <NeedsBackend feature="Organization-wide workspace analytics" needs="an admin analytics endpoint (adoption by workspace and active-user time series); none is defined in the API contract yet" />
    </Page>
  );
}
export function AdminProjects() {
  const pr = useResource(() => workspaceServices.list('projects')); const ta = useResource(() => workspaceServices.list('tasks'));
  const projects = pr.data ?? [], tasks = ta.data ?? [];
  return (
    <Page title="Projects overview" sub="Projects and tasks returned by the API for your account">
      {(pr.error || ta.error) && <ErrorState message={pr.error || ta.error} onRetry={() => { if (pr.error) pr.retry(); if (ta.error) ta.retry(); }} />}
      {pr.loading || ta.loading ? <Skeletons n={2} /> : pr.error || ta.error ? null : !projects.length ? <Empty title="No projects">The server returned no projects.</Empty> :
        <div className="card scroll-x"><table><thead><tr><th>Project</th><th>Tasks</th><th>Completion</th><th>Overdue</th><th>Blocked</th></tr></thead><tbody>{projects.map(p => { const ts = tasks.filter(t => t.projectId === p.id); const d = ts.filter(t => t.status === 'done').length; return <tr key={p.id}><td><b>{p.name}</b><div className="muted small">{p.description}</div></td><td>{ts.length}</td><td style={{ minWidth: 140 }}><Progress value={ts.length ? d / ts.length * 100 : 0} label={p.name} /></td><td>{ts.filter(t => t.due < today() && t.status !== 'done').length}</td><td>{ts.filter(t => t.blocker && t.status !== 'done').length}</td></tr>; })}</tbody></table></div>}
    </Page>
  );
}
export function AdminActivity() {
  const res = useResource(() => adminService.activity()); const logs = res.data ?? [];
  const [lv, setLv] = useState('all'); const [sel, setSel] = useState<LogEntry | null>(null);
  return (
    <Page title="Activity logs" sub="Audit trail from the server">
      {res.error && <ErrorState message={res.error} onRetry={res.retry} />}
      {res.loading ? <Skeletons n={2} /> : res.error ? null : <>
        <div className="row wrap">{['all', 'info', 'warn', 'critical'].map(s => <button key={s} className={'chip' + (lv === s ? ' on' : '')} aria-pressed={lv === s} onClick={() => setLv(s)}>{s}</button>)}</div>
        <div className="card scroll-x"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Level</th><th /></tr></thead><tbody>{logs.filter(l => lv === 'all' || l.level === lv).map(l => <tr key={l.id}><td>{l.time}</td><td>{l.actor}</td><td>{l.action}</td><td><span className={lvTag(l.level)}>{l.level}</span></td><td><button className="btn sm" onClick={() => setSel(l)}>Details</button></td></tr>)}{!logs.length && <tr><td colSpan={5} className="muted">No activity recorded.</td></tr>}</tbody></table></div></>}
      <Modal open={!!sel} title={sel?.action ?? ''} onClose={() => setSel(null)}>{sel && <><div className="muted">{sel.time} · {sel.actor}</div><p>{sel.detail}</p></>}</Modal>
    </Page>
  );
}
export function AdminSettings() {
  const [ap, setAp] = useAP();
  return (
    <Page title="Admin settings" sub="Interface preferences for this browser only — no security settings live in the browser">
      <div className="card col"><label className="f">Theme<select value={ap.theme} onChange={e => setAp({ ...ap, theme: e.target.value as AP['theme'] })}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="f">Accent<select value={ap.color} onChange={e => setAp({ ...ap, color: e.target.value })}>{['blue', 'purple', 'green', 'teal', 'orange', 'neutral'].map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="f">Density<select value={ap.space} onChange={e => setAp({ ...ap, space: e.target.value })}><option>compact</option><option>comfortable</option><option>spacious</option></select></label></div>
    </Page>
  );
}
