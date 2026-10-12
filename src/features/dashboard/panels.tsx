import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDashed, ListChecks, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { ErrorState } from '../../components/ui';
import { today } from '../../lib/storage';
import type { Course, Meeting, Project, Task } from '../../types';
import type { Status } from '../adaptive/Widgets';
import { byDue, compareBy, deadlineOf, DUE_LABEL, fmtDay, fmtLong, hasDue, isOpen, isOverdue, iso, matchesDue, STATUS_LABEL, useCountUp, type DueFilter, type SortKey } from './helpers';
import type { TaskActions } from './useTaskStatus';

/** Shared panel chrome: title row + body that shows skeleton / error+retry / content from one Status. */
export function Panel({ title, icon, to, linkLabel = 'Open', status, className = '', children, actions }:
  { title: string; icon?: ReactNode; to?: string; linkLabel?: string; status?: Status; className?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`card panel ${className}`} aria-label={title} aria-busy={status?.loading || undefined}>
      <header className="panel-head"><h2>{icon}{title}</h2><div className="row">{actions}{to && <Link className="panel-link" to={to}>{linkLabel} →</Link>}</div></header>
      {status?.loading ? <div className="col" aria-label={`Loading ${title}`} role="status"><div className="skeleton" style={{ minHeight: 18, width: '60%' }} /><div className="skeleton" style={{ minHeight: 44 }} /><div className="skeleton" style={{ minHeight: 44 }} /></div>
        : status?.error ? <ErrorState message={status.error} onRetry={status.retry} />
          : children}
    </section>
  );
}
const Note = ({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) =>
  <div className="empty-note">{icon}<b>{title}</b>{children && <span className="muted small">{children}</span>}{action}</div>;

/* ------------------------------------------------------------------ summary cards */
function Stat({ label, value, sub, icon, tone, status, i }: { label: string; value: number; sub: string; icon: ReactNode; tone: string; status: Status; i: number }) {
  const shown = useCountUp(status.loading || status.error ? 0 : value);
  return (
    <div className={`card stat tone-${tone}`} style={{ animationDelay: `${i * 60}ms` }} role="group" aria-label={label} aria-busy={status.loading || undefined}>
      <div className="stat-top"><span className="stat-ico" aria-hidden>{icon}</span><span className="muted small">{label}</span></div>
      {status.loading ? <><div className="skeleton" style={{ minHeight: 34, width: '45%' }} /><div className="skeleton" style={{ minHeight: 14, width: '70%' }} /></>
        : status.error ? <><b className="stat-val">—</b><span className="small muted">Unavailable · <button className="linkbtn" onClick={status.retry}>Retry</button></span></>
          : <><b className="stat-val" aria-label={`${value}`}>{shown}</b><span className="small muted">{sub}</span></>}
    </div>
  );
}
export function SummaryCards({ tasks, status }: { tasks: Task[]; status: Status }) {
  const total = tasks.length, doing = tasks.filter(t => t.status === 'doing').length, done = tasks.filter(t => t.status === 'done').length, od = tasks.filter(isOverdue).length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}% of all tasks` : 'No tasks yet');
  return (
    <div className="stat-grid" aria-label="Task summary">
      <Stat i={0} tone="rose" label="Total tasks" value={total} sub={total ? `${tasks.filter(isOpen).length} still open` : 'No tasks yet'} icon={<ListChecks size={18} />} status={status} />
      <Stat i={1} tone="mocha" label="In progress" value={doing} sub={pct(doing)} icon={<Loader2 size={18} />} status={status} />
      <Stat i={2} tone="sand" label="Completed" value={done} sub={pct(done)} icon={<CheckCircle2 size={18} />} status={status} />
      <Stat i={3} tone={od ? 'alert' : 'khaki'} label="Overdue" value={od} sub={od ? 'Need attention' : total ? 'Nothing overdue' : 'No tasks yet'} icon={<AlertTriangle size={18} />} status={status} />
    </div>
  );
}

/* ------------------------------------------------------------------ deadline indicator */
export function DeadlineBadge({ task, compact }: { task: Task; compact?: boolean }) {
  const d = deadlineOf(task);
  const icon = d.kind === 'overdue' ? <AlertTriangle size={12} aria-hidden /> : d.kind === 'done' ? <Check size={12} aria-hidden /> : d.kind === 'none' ? null : <CalendarClock size={12} aria-hidden />;
  return <span className={`dl dl-${d.kind}${compact ? ' compact' : ''}`} title={hasDue(task) ? fmtLong(task.due) : 'No due date set'}>{icon}{d.label}</span>;
}

/* ------------------------------------------------------------------ task table */
type Filter = 'all' | Task['status'];
type Sort = { key: SortKey; dir: 1 | -1 } | null;
const COLS: { key: SortKey; label: string }[] = [{ key: 'title', label: 'Task' }, { key: 'project', label: 'Project' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'due', label: 'Deadline' }, { key: 'assignee', label: 'Assignee' }];
const NO_PROJECT = '__none__';

export function StatusControl({ task, actions }: { task: Task; actions: TaskActions }) {
  const busy = actions.pending.has(task.id);
  return (
    <span className={`status-ctl st-${task.status}${busy ? ' busy' : ''}`}>
      {busy && <Loader2 size={13} className="spin" aria-hidden />}
      <select aria-label={`Status of ${task.title}`} value={task.status} disabled={busy} onChange={e => void actions.change(task, e.target.value as Task['status'])}>
        {(['todo', 'doing', 'done'] as const).map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
      </select>
    </span>
  );
}

export function TaskTable({ tasks, projects, status, projectStatus, actions, day, onClearDay }:
  { tasks: Task[]; projects: Project[]; status: Status; projectStatus: Status; actions: TaskActions; day: string | null; onClearDay: () => void }) {
  const [filter, setFilter] = useState<Filter>('all'); const [q, setQ] = useState(''); const [all, setAll] = useState(false);
  const [prio, setPrio] = useState<'any' | Task['priority']>('any'); const [proj, setProj] = useState('any'); const [due, setDue] = useState<DueFilter>('any'); const [sort, setSort] = useState<Sort>(null);
  const pname = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);
  const projOptions = useMemo(() => { const ids = [...new Set(tasks.map(t => t.projectId))]; return ids.map(id => ({ id: pname.has(id) ? id : NO_PROJECT + id, name: pname.get(id) ?? 'Unknown project' })); }, [tasks, pname]);
  const counts = { all: tasks.length, todo: tasks.filter(t => t.status === 'todo').length, doing: tasks.filter(t => t.status === 'doing').length, done: tasks.filter(t => t.status === 'done').length };
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = tasks.filter(t => (filter === 'all' || t.status === filter) && (prio === 'any' || t.priority === prio)
      && (proj === 'any' || t.projectId === proj || NO_PROJECT + t.projectId === proj) && matchesDue(t, due) && (!day || (hasDue(t) && t.due.slice(0, 10) === day))
      && (!needle || `${t.title} ${t.assignee ?? ''} ${pname.get(t.projectId) ?? ''} ${t.priority} ${STATUS_LABEL[t.status]} ${t.blocker ?? ''}`.toLowerCase().includes(needle)));
    return sort ? list.sort(compareBy(sort.key, sort.dir, pname)) : list.sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || byDue(a, b) || compareBy('priority', 1, pname)(a, b));
  }, [tasks, filter, prio, proj, due, day, needle, sort, pname]);
  const shown = all ? rows : rows.slice(0, 8);
  const active = filter !== 'all' || prio !== 'any' || proj !== 'any' || due !== 'any' || !!day || !!needle;
  const reset = () => { setFilter('all'); setPrio('any'); setProj('any'); setDue('any'); setQ(''); setSort(null); onClearDay(); };
  const clickSort = (key: SortKey) => setSort(s => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const tabs: [Filter, string][] = [['all', 'All'], ['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  return (
    <Panel title="My tasks" icon={<ListChecks size={18} />} to="/app/projects" linkLabel="Manage in Projects" status={status} className="span-task">
      {actions.error && <div className="banner error" role="alert"><span className="row between wrap"><span>{actions.error}</span><button className="btn sm" onClick={actions.dismiss}>Dismiss</button></span></div>}
      {actions.notice && <div className="banner ok" role="status"><span className="row between wrap"><span>{actions.notice}</span><button className="btn sm ghost" onClick={actions.dismiss} aria-label="Dismiss message"><X size={14} /></button></span></div>}
      {tasks.length === 0
        ? <Note icon={<CircleDashed size={26} />} title="No tasks yet" action={<Link className="btn sm primary" to="/app/projects">Create your first task</Link>}>Tasks you create in Projects will appear here.</Note>
        : <>
          <div className="table-tools">
            <div className="seg" role="tablist" aria-label="Filter tasks by status">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setAll(false); }}>{l}<span className="count">{counts[k]}</span></button>)}</div>
            <label className="search"><Search size={15} aria-hidden /><input type="search" aria-label="Search tasks" placeholder="Search title, project, assignee…" value={q} onChange={e => { setQ(e.target.value); setAll(false); }} onKeyDown={e => { if (e.key === 'Escape') setQ(''); }} />
              {q && <button className="icon-btn clear" aria-label="Clear search" onClick={() => setQ('')}><X size={14} /></button>}</label>
          </div>
          <div className="filter-row" role="group" aria-label="More filters">
            <label>Priority<select value={prio} onChange={e => { setPrio(e.target.value as typeof prio); setAll(false); }}><option value="any">Any</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label>Project<select value={proj} onChange={e => { setProj(e.target.value); setAll(false); }}><option value="any">All projects</option>{projOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label>Deadline<select value={due} onChange={e => { setDue(e.target.value as DueFilter); setAll(false); }}>{(Object.keys(DUE_LABEL) as DueFilter[]).map(k => <option key={k} value={k}>{DUE_LABEL[k]}</option>)}</select></label>
            {active && <button className="btn sm ghost" onClick={reset}><RotateCcw size={14} />Reset</button>}
          </div>
          {day && <div className="chips-row"><span className="chip on">Due {fmtDay(day)}<button className="icon-btn" aria-label="Clear day filter" onClick={onClearDay}><X size={12} /></button></span></div>}
          {projectStatus.error && <ErrorState message={`Project names unavailable: ${projectStatus.error}`} onRetry={projectStatus.retry} />}
          <div className="muted small" role="status" aria-live="polite">{rows.length === tasks.length ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}` : `Showing ${rows.length} of ${tasks.length} tasks`}{sort ? ` · sorted by ${COLS.find(c => c.key === sort.key)?.label.toLowerCase()} (${sort.dir === 1 ? 'ascending' : 'descending'})` : ' · default order: open first, by deadline'}</div>
          {rows.length === 0 ? <Note title="No tasks match" icon={<Search size={22} />} action={<button className="btn sm" onClick={reset}>Clear all filters</button>}>No task fits the current search and filters.</Note> :
            <div className="scroll-x"><table className="task-table">
              <thead><tr>{COLS.map(c => { const on = sort?.key === c.key; return (
                <th key={c.key} scope="col" aria-sort={on ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button className={'th-btn' + (on ? ' on' : '')} onClick={() => clickSort(c.key)} title={`Sort by ${c.label.toLowerCase()}`}>{c.label}{on ? (sort!.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <span className="sort-ph" aria-hidden />}</button></th>); })}</tr></thead>
              <tbody>{shown.map((t, i) => (
                <tr key={t.id} className={deadlineOf(t).kind === 'overdue' ? 'late' : ''} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                  <td><div className="t-title"><span className={'dot ' + t.priority} aria-hidden /><span className={t.status === 'done' ? 'done' : ''}>{t.title}</span>{t.blocker && t.status !== 'done' && <span className="tag err" title={t.blocker}>Blocked</span>}</div></td>
                  <td className="muted">{pname.get(t.projectId) ?? '—'}</td>
                  <td><span className={`pill pr-${t.priority}`}>{t.priority}</span></td>
                  <td><StatusControl task={t} actions={actions} /></td>
                  <td className="nowrap"><DeadlineBadge task={t} /></td>
                  <td className="muted">{t.assignee || '—'}</td>
                </tr>))}</tbody></table></div>}
          {rows.length > 8 && <button className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => setAll(a => !a)}>{all ? 'Show fewer' : `Show all ${rows.length} tasks`}</button>}
        </>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ progress */
export function ProgressPanel({ tasks, projects, status, projectStatus }: { tasks: Task[]; projects: Project[]; status: Status; projectStatus: Status }) {
  const total = tasks.length, done = tasks.filter(t => t.status === 'done').length, doing = tasks.filter(t => t.status === 'doing').length, todo = total - done - doing;
  const pct = total ? Math.round((done / total) * 100) : 0; const shownPct = useCountUp(pct, 900);
  const R = 52, C = 2 * Math.PI * R;
  const per = projects.map(p => { const ts = tasks.filter(t => t.projectId === p.id); return { p, n: ts.length, d: ts.filter(t => t.status === 'done').length }; }).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4);
  return (
    <Panel title="Overall progress" icon={<CheckCircle2 size={18} />} to="/app/projects" status={status} className="span-progress">
      {total === 0 ? <Note icon={<CircleDashed size={26} />} title="No progress to show yet">Completion is calculated from your real tasks once you have some.</Note> : <>
        <div className="progress-hero">
          <svg width="136" height="136" viewBox="0 0 136 136" role="img" aria-label={`${pct} percent of tasks completed`}>
            <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B56F76" /><stop offset=".55" stopColor="#DCAE96" /><stop offset="1" stopColor="#8F7466" /></linearGradient></defs>
            <circle cx="68" cy="68" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
            <circle className="ring-arc" cx="68" cy="68" r={R} fill="none" stroke="url(#pg)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 68 68)" style={{ ['--c' as string]: C }} />
            <text x="68" y="64" textAnchor="middle" className="ring-num">{shownPct}%</text><text x="68" y="84" textAnchor="middle" className="ring-sub">complete</text>
          </svg>
          <ul className="legend">
            <li><i className="sw done" />Done<b>{done}</b></li><li><i className="sw doing" />In progress<b>{doing}</b></li><li><i className="sw todo" />To do<b>{todo}</b></li>
          </ul>
        </div>
        <div className="stack" role="img" aria-label={`${done} done, ${doing} in progress, ${todo} to do`}><i className="done" style={{ flex: done }} /><i className="doing" style={{ flex: doing }} /><i className="todo" style={{ flex: todo }} /></div>
        {projectStatus.error ? <ErrorState message={`Project breakdown unavailable: ${projectStatus.error}`} onRetry={projectStatus.retry} /> : per.length > 0 && <div className="col" style={{ gap: 10 }}>
          <span className="muted small">By project</span>
          {per.map(({ p, n, d }) => <div key={p.id}><div className="row between small"><span>{p.name}</span><span className="muted">{d}/{n}</span></div><div className="bar" role="progressbar" aria-label={p.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((d / n) * 100)}><i style={{ transform: `scaleX(${d / n})` }} /></div></div>)}
        </div>}
      </>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ upcoming tasks */
export function UpcomingTasks({ tasks, projects, status, actions }: { tasks: Task[]; projects: Project[]; status: Status; actions: TaskActions }) {
  const pname = new Map(projects.map(p => [p.id, p.name]));
  const list = tasks.filter(isOpen).sort((a, b) => Number(!isOverdue(a)) - Number(!isOverdue(b)) || byDue(a, b)).slice(0, 6);
  return (
    <Panel title="Upcoming tasks" icon={<CalendarClock size={18} />} to="/app/projects" status={status} className="span-upcoming">
      {list.length === 0 ? <Note icon={<CheckCircle2 size={26} />} title={tasks.length ? 'All caught up' : 'No tasks yet'}>{tasks.length ? 'You have no open tasks.' : 'Upcoming tasks appear here once you add some.'}</Note>
        : <ul className="upcoming">{list.map((t, i) => { const busy = actions.pending.has(t.id); return (
          <li key={t.id} className={isOverdue(t) ? 'late' : ''} style={{ animationDelay: `${i * 50}ms` }}>
            <button className="done-btn" aria-label={`Mark “${t.title}” as done`} title="Mark as done" disabled={busy} onClick={() => void actions.change(t, 'done')}>{busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}</button>
            <div className="grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{t.title}</b><span className="muted small">{pname.get(t.projectId) ?? 'No project'}{t.assignee ? ` · ${t.assignee}` : ''}</span></div>
            <DeadlineBadge task={t} compact />
          </li>); })}</ul>}
    </Panel>
  );
}

/* ------------------------------------------------------------------ calendar */
interface DayEvents { tasks: Task[]; meetings: Meeting[]; exams: Course[] }
export function CalendarWidget({ tasks, meetings, courses, statuses, activeDay, onFilterDay }:
  { tasks: Task[]; meetings: Meeting[]; courses: Course[]; statuses: { name: string; s: Status }[]; activeDay: string | null; onFilterDay: (d: string | null) => void }) {
  const now = new Date(); const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() }); const [sel, setSel] = useState(today());
  const grid = useRef<HTMLDivElement>(null); const refocus = useRef(false);
  const events = useMemo(() => {
    const map = new Map<string, DayEvents>(); const at = (d: string) => { const k = d.slice(0, 10); let e = map.get(k); if (!e) { e = { tasks: [], meetings: [], exams: [] }; map.set(k, e); } return e; };
    tasks.filter(hasDue).forEach(t => at(t.due).tasks.push(t)); meetings.filter(m => m.date).forEach(m => at(m.date).meetings.push(m)); courses.filter(c => c.assessment?.date).forEach(c => at(c.assessment.date).exams.push(c));
    return map;
  }, [tasks, meetings, courses]);
  const first = new Date(cur.y, cur.m, 1); const lead = first.getDay(); const dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${cur.y}-${pad(cur.m + 1)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const go = (d: number) => setCur(c => { const n = new Date(c.y, c.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dow = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const months = Array.from({ length: 12 }, (_, i) => new Date(2023, i, 1).toLocaleDateString(undefined, { month: 'long' }));
  const years = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i); if (!years.includes(cur.y)) years.push(cur.y); years.sort((a, b) => a - b);
  const day = events.get(sel); const loading = statuses.some(x => x.s.loading); const failed = statuses.filter(x => x.s.error);
  const count = (day?.tasks.length ?? 0) + (day?.meetings.length ?? 0) + (day?.exams.length ?? 0);
  const inMonth = sel.slice(0, 7) === `${cur.y}-${pad(cur.m + 1)}`;
  const jump = (d: Date) => { setSel(iso(d)); setCur({ y: d.getFullYear(), m: d.getMonth() }); refocus.current = true; };
  const goToday = () => { jump(new Date()); refocus.current = false; };
  useEffect(() => { if (refocus.current) { refocus.current = false; grid.current?.querySelector<HTMLElement>(`[data-d="${sel}"]`)?.focus(); } }, [sel, cur]);
  const onKey = (e: { key: string; preventDefault: () => void }) => {
    const base = new Date(sel + 'T00:00:00'); const step = (n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
    const mv = (d: Date) => { e.preventDefault(); jump(d); };
    switch (e.key) {
      case 'ArrowLeft': return mv(step(-1)); case 'ArrowRight': return mv(step(1)); case 'ArrowUp': return mv(step(-7)); case 'ArrowDown': return mv(step(7));
      case 'Home': return mv(step(-base.getDay())); case 'End': return mv(step(6 - base.getDay()));
      case 'PageUp': return mv(new Date(base.getFullYear(), base.getMonth() - 1, Math.min(base.getDate(), new Date(base.getFullYear(), base.getMonth(), 0).getDate())));
      case 'PageDown': return mv(new Date(base.getFullYear(), base.getMonth() + 1, Math.min(base.getDate(), new Date(base.getFullYear(), base.getMonth() + 2, 0).getDate())));
    }
  };
  return (
    <section className="card panel span-cal" aria-label="Calendar">
      <header className="panel-head"><h2><CalendarClock size={18} />Calendar</h2>
        <div className="row"><button className="btn sm" onClick={goToday} disabled={sel === today() && inMonth}>Today</button></div></header>
      <div className="cal-nav">
        <button className="icon-btn" aria-label="Previous month" onClick={() => go(-1)}><ChevronLeft size={18} /></button>
        <div className="cal-pickers" aria-live="polite" aria-label={label}>
          <select aria-label="Month" value={cur.m} onChange={e => setCur(c => ({ ...c, m: Number(e.target.value) }))}>{months.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          <select aria-label="Year" value={cur.y} onChange={e => setCur(c => ({ ...c, y: Number(e.target.value) }))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        <button className="icon-btn" aria-label="Next month" onClick={() => go(1)}><ChevronRight size={18} /></button>
      </div>
      <div className="cal" role="grid" aria-label={label} ref={grid} onKeyDown={onKey}>
        {dow.map((d, i) => <span key={i} className="cal-dow" role="columnheader">{d}</span>)}
        {cells.map((d, i) => { if (!d) return <span key={i} className="cal-cell empty" role="gridcell" />; const e = events.get(d); const isT = d === today(); const od = !!e?.tasks.some(isOverdue);
          const tab = inMonth ? d === sel : d.endsWith('-01');
          return <button key={d} data-d={d} role="gridcell" tabIndex={tab ? 0 : -1} aria-selected={d === sel} aria-current={isT ? 'date' : undefined}
            aria-label={`${fmtLong(d)}${e ? `: ${e.tasks.length} task${e.tasks.length === 1 ? '' : 's'}${od ? ' (overdue)' : ''}, ${e.meetings.length} meeting${e.meetings.length === 1 ? '' : 's'}, ${e.exams.length} assessment${e.exams.length === 1 ? '' : 's'}` : ''}`}
            className={'cal-cell' + (isT ? ' today' : '') + (d === sel ? ' sel' : '') + (d === activeDay ? ' filtered' : '')} onClick={() => setSel(d)}>
            <span>{Number(d.slice(8))}</span>
            {e && <span className="dots" aria-hidden>{e.tasks.length > 0 && <i className={od ? 'o' : 't'} />}{e.meetings.length > 0 && <i className="m" />}{e.exams.length > 0 && <i className="x" />}</span>}</button>; })}
      </div>
      <div className="cal-key muted small"><span><i className="t" />Task due</span><span><i className="o" />Overdue</span><span><i className="m" />Meeting</span><span><i className="x" />Assessment</span></div>
      {failed.map(f => <ErrorState key={f.name} message={`${f.name} could not be loaded: ${f.s.error}`} onRetry={f.s.retry} />)}
      <div className="cal-day" aria-live="polite">
        <div className="row between wrap"><b>{fmtLong(sel)}</b>
          {(day?.tasks.length ?? 0) > 0 && (activeDay === sel
            ? <button className="btn sm ghost" onClick={() => onFilterDay(null)}><X size={14} />Clear table filter</button>
            : <button className="btn sm" onClick={() => onFilterDay(sel)}>Filter table to this day<ArrowRight size={14} /></button>)}</div>
        {loading && count === 0 ? <span className="muted small">Loading events…</span>
          : count === 0 ? <span className="muted small">{failed.length ? 'Some events could not be loaded.' : 'Nothing scheduled.'}</span>
            : <ul className="list">
              {day?.meetings.map(m => <li key={m.id}><i className="m" /><span className="grow ellipsis">{m.title}</span><span className="muted small">{m.time}</span></li>)}
              {day?.tasks.map(t => <li key={t.id}><i className={isOverdue(t) ? 'o' : 't'} /><span className={'grow ellipsis ' + (t.status === 'done' ? 'done' : '')}>{t.title}</span><DeadlineBadge task={t} compact /></li>)}
              {day?.exams.map(c => <li key={c.id}><i className="x" /><span className="grow ellipsis">{c.assessment.title}</span><span className="muted small">{c.name}</span></li>)}
            </ul>}
      </div>
    </section>
  );
}
