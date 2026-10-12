import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { meetingService, workspaceServices } from '../../api/services';
import { useResource } from '../../api/useResource';
import { Banner, Empty, ErrorState, Page, Progress, Ring, Skeletons } from '../../components/ui';
import type { ActionStatus, TrackerGroup, TrackerItem } from '../../types';

type Filter = 'all' | 'overdue' | 'due_soon' | 'doing' | 'todo' | 'done' | 'done_late';
const FILTERS: [Filter, string][] = [['all', 'All'], ['overdue', 'Overdue'], ['due_soon', 'Due soon'], ['doing', 'In progress'], ['todo', 'To do'], ['done', 'Done'], ['done_late', 'Done late']];
const match = (i: TrackerItem, f: Filter) => f === 'all' || (f === 'overdue' || f === 'due_soon' || f === 'done_late' ? i.state === f : i.status === f);
export const STATUS_TXT: Record<ActionStatus, string> = { todo: 'To do', doing: 'In progress', done: 'Done' };
const TIP = { background: 'var(--surface)', border: '1px solid var(--border)' };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Deadline badge derived from the server-computed delivery state. */
export function DeadlineBadge({ i }: { i: TrackerItem }) {
  const s = i.state, left = i.daysLeft ?? 0;
  const [cls, txt] = s === 'overdue' ? ['tag err', `${plural(i.daysLate, 'day')} overdue`] : s === 'done_late' ? ['tag', `Completed ${plural(i.daysLate, 'day')} late`] : s === 'done_on_time' ? ['tag ok', 'On time']
    : s === 'no_deadline' ? ['tag pri', 'No deadline'] : left <= 0 ? ['tag', 'Due today'] : [s === 'due_soon' ? 'tag' : 'tag ok', `Due in ${plural(left, 'day')}`];
  return <span className={cls}>{txt}</span>;
}

/** Changes an item's status. Meeting action items go through the meeting (which syncs the task server-side); others update the task directly. Never optimistic. */
export async function changeStatus(i: TrackerItem, status: ActionStatus) {
  if (i.actionItemId) { await meetingService.setActionStatus(i.meetingId, i.actionItemId, status); return; }
  const task = (await workspaceServices.list('tasks')).find(t => t.id === i.id); if (!task) throw new Error('Task not found — it may have been deleted.');
  await workspaceServices.update('tasks', i.id, { ...task, status });
}

const GroupList = ({ title, groups, link }: { title: string; groups: TrackerGroup[]; link?: boolean }) => (
  <section className="card col" aria-label={title}><h2 style={{ fontSize: '1.1em' }}>{title}</h2>
    {groups.length ? <ul className="list trk-groups">{groups.map(g => <li key={g.key} className="col" style={{ alignItems: 'stretch', gap: 4 }}>
      <div className="row between wrap">{link ? <Link to={`/app/meetings/${g.key}`}><b>{g.label}</b></Link> : <b>{g.label}</b>}<span className="muted small">{g.done}/{g.total} done · {Math.round(g.progress)}%</span></div>
      <Progress value={g.progress} label={`${g.label} progress`} />
      {(g.overdue > 0 || g.late > 0) && <span className="row wrap" style={{ gap: 6 }}>{g.overdue > 0 && <span className="tag err">{g.overdue} overdue</span>}{g.late > 0 && <span className="tag">{g.late} done late</span>}</span>}</li>)}</ul>
      : <span className="muted">Nothing to show yet.</span>}</section>);

export default function ActionTracker() {
  const { data, loading, error, refresh, retry } = useResource(meetingService.actionTracker);
  const [filter, setFilter] = useState<Filter>('all'); const [q, setQ] = useState(''); const [owner, setOwner] = useState('');
  const [saving, setSaving] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const items = data?.items ?? [];
  const owners = useMemo(() => Array.from(new Set(items.map(i => i.owner).filter(Boolean))).sort(), [items]);
  const base = useMemo(() => items.filter(i => (!owner || i.owner === owner) && (!q.trim() || (i.text + ' ' + i.owner + ' ' + i.meetingTitle).toLowerCase().includes(q.trim().toLowerCase()))), [items, q, owner]);
  const rows = base.filter(i => match(i, filter));
  const reload = async () => { setBusy(true); await refresh(); setBusy(false); };
  const setStatus = async (i: TrackerItem, s: ActionStatus) => { setSaving(i.id); setErr(''); try { await changeStatus(i, s); await refresh(); } catch (e) { setErr(errorMessage(e)); } finally { setSaving(''); } };
  const t = data?.totals;

  return (
    <Page title="Action Tracker" sub="Progress on action points extracted from your meeting recordings and transcripts"
      actions={<><Link className="btn sm" to="/app/meetings"><CalendarDays size={15} /> Meetings</Link><button className="btn sm" onClick={() => void reload()} disabled={busy || loading}><RefreshCw size={15} /> {busy ? 'Refreshing…' : 'Refresh'}</button></>}>
      {error && (data ? <Banner kind="error">{error}</Banner> : <ErrorState message={error} onRetry={retry} />)}{err && <Banner kind="error">Could not update status: {err}</Banner>}
      {loading && !data ? <Skeletons n={6} /> : !data || !t ? null : t.total === 0 ? <Empty title="No action items yet">No action items yet — upload a meeting recording or transcript on a meeting to generate them. <div style={{ marginTop: 10 }}><Link className="btn primary" to="/app/meetings">Go to Meetings</Link></div></Empty> : <>
        <div className="trk-kpis">
          <div className="card stat trk-ring"><Ring value={t.progress} size={64} /><div className="col" style={{ gap: 2 }}><span className="muted small">Progress</span><b className="small">{t.done} of {t.total} done</b></div></div>
          {([['Total action items', t.total, ''], ['In progress', t.doing, ''], ['Overdue', t.overdue, 'var(--err)'], ['Done on time', t.doneOnTime, 'var(--ok)'], ['Done late', t.doneLate, 'var(--warn)'], ['On-time rate', t.onTimeRate == null ? '—' : `${Math.round(t.onTimeRate)}%`, '']] as [string, number | string, string][]).map(([l, v, c]) =>
            <div key={l} className="card stat"><span className="muted small">{l}</span><b style={c ? { color: c } : undefined}>{v}</b></div>)}
        </div>
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <section className="card col" aria-label="Status breakdown"><h2 style={{ fontSize: '1.1em' }}>Status breakdown</h2>
            <div className="chartbox"><ResponsiveContainer><PieChart><Pie data={[{ name: 'To do', value: t.todo, c: 'var(--muted)' }, { name: 'In progress', value: t.doing, c: 'var(--primary)' }, { name: 'Done', value: t.done, c: 'var(--ok)' }]} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
              {['var(--muted)', 'var(--primary)', 'var(--ok)'].map(c => <Cell key={c} fill={c} stroke="var(--surface)" />)}</Pie><Tooltip contentStyle={TIP} /><Legend /></PieChart></ResponsiveContainer></div>
            <div className="row wrap small"><span className="tag err">{t.overdue} overdue</span><span className="tag">{t.dueSoon} due soon</span><span className="tag ok">{t.onTrack} on track</span><span className="tag pri">{t.noDeadline} no deadline</span></div></section>
          <section className="card col" aria-label="Weekly trend"><h2 style={{ fontSize: '1.1em' }}>Weekly trend</h2>
            {data.weekly.length ? <div className="chartbox"><ResponsiveContainer>{data.weekly.length > 1
              ? <LineChart data={data.weekly}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="week" stroke="var(--muted)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted)" fontSize={11} width={32} /><Tooltip contentStyle={TIP} /><Legend />
                <Line dataKey="created" name="Created" stroke="var(--primary)" strokeWidth={2} /><Line dataKey="completed" name="Completed" stroke="var(--ok)" strokeWidth={2} /></LineChart>
              : <BarChart data={data.weekly}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="week" stroke="var(--muted)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted)" fontSize={11} width={32} /><Tooltip contentStyle={TIP} /><Legend />
                <Bar dataKey="created" name="Created" fill="var(--primary)" /><Bar dataKey="completed" name="Completed" fill="var(--ok)" /></BarChart>}</ResponsiveContainer></div> : <span className="muted">No weekly history yet.</span>}</section>
        </div>
        <div className="grid g2" style={{ alignItems: 'start' }}><GroupList title="By owner" groups={data.byOwner} /><GroupList title="By meeting" groups={data.byMeeting} link /></div>
        <section className="card col" aria-label="Action items">
          <div className="row between wrap"><h2 style={{ fontSize: '1.1em' }}>Action items</h2>
            <div className="row wrap"><input className="input" aria-label="Search action items" placeholder="Search action, owner or meeting" value={q} onChange={e => setQ(e.target.value)} />
              <select aria-label="Filter by owner" value={owner} onChange={e => setOwner(e.target.value)}><option value="">All owners</option>{owners.map(o => <option key={o}>{o}</option>)}</select></div></div>
          <div className="row wrap" role="group" aria-label="Filter by state">{FILTERS.map(([f, l]) => <button key={f} className={'chip' + (filter === f ? ' on' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} <b>{base.filter(i => match(i, f)).length}</b></button>)}</div>
          {rows.length ? <div className="scroll-x"><table className="trk-table"><thead><tr><th>Action</th><th>Owner</th><th>Meeting</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead><tbody>
            {rows.map(i => <tr key={i.id} className={'trk-' + i.state}><td className="trk-text">{i.text}</td><td>{i.owner || <span className="muted">Unassigned</span>}</td>
              <td><Link to={`/app/meetings/${i.meetingId}`}>{i.meetingTitle}</Link><div className="muted small">{i.meetingDate}</div></td>
              <td><div className="col" style={{ gap: 3 }}><span>{i.deadline ?? '—'}{i.deadlineSource === 'default' && <span className="muted small"> (default)</span>}</span><DeadlineBadge i={i} /></div></td>
              <td><span className={'tag' + (i.priority === 'high' ? ' err' : i.priority === 'low' ? ' ok' : '')}>{i.priority}</span></td>
              <td><select aria-label={`Status of ${i.text}`} value={i.status} disabled={saving === i.id} onChange={e => void setStatus(i, e.target.value as ActionStatus)}>{(Object.keys(STATUS_TXT) as ActionStatus[]).map(s => <option key={s} value={s}>{STATUS_TXT[s]}</option>)}</select>{saving === i.id && <div className="muted small">Saving…</div>}</td></tr>)}
          </tbody></table></div> : <span className="muted">No action items match these filters.</span>}
        </section>
      </>}
    </Page>
  );
}
