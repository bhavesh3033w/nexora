import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { today } from '../../lib/storage';
import { useResource } from '../../api/useResource';
import { workspaceServices } from '../../api/services';
import { ErrorState, NeedsBackend, Progress, Ring } from '../../components/ui';
import { useMeetings, isPast, whenOf } from '../meetings/useMeetings';
import { avg, useAnalytics } from '../analytics/data';
import type { Course, Message, Meeting, Project, Task, WidgetId } from '../../types';
import type { FocusId } from './engine';

export interface Status { loading: boolean; error: string; retry: () => void; /** Re-fetch from the API (only set for resources loaded through useResource). */ refresh?: () => Promise<void> }
interface Data { meetings: Meeting[]; messages: Message[]; courses: Course[]; tasks: Task[]; projects: Project[]; status: Record<'meetings' | 'messages' | 'courses' | 'tasks' | 'projects', Status> }
const DataCtx = createContext<Data>(null as unknown as Data);

/** Fetches the dashboard's data once and shares it with every widget. Arrays are empty (never sample data) until the API answers. */
export function DataProvider({ children }: { children: ReactNode }) {
  const m = useMeetings(); const msg = useResource(() => workspaceServices.list('messages')); const co = useResource(() => workspaceServices.list('courses'));
  const ta = useResource(() => workspaceServices.list('tasks')); const pr = useResource(() => workspaceServices.list('projects'));
  const st = (r: { loading: boolean; error: string; retry: () => void; refresh: () => Promise<void> }): Status => ({ loading: r.loading, error: r.error, retry: r.retry, refresh: r.refresh });
  const value: Data = { meetings: m.meetings, messages: msg.data ?? [], courses: co.data ?? [], tasks: ta.data ?? [], projects: pr.data ?? [],
    status: { meetings: { loading: m.loading, error: m.error, retry: () => void m.refresh() }, messages: st(msg), courses: st(co), tasks: st(ta), projects: st(pr) } };
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
export const useData = () => useContext(DataCtx);

export const courseProgress = (c: Course) => ((c.topics ?? []).filter(t => t.done).length / Math.max(1, (c.topics ?? []).length)) * 100;
const merge = (...s: Status[]): Status => ({ loading: s.some(x => x.loading), error: s.find(x => x.error)?.error ?? '', retry: () => s.forEach(x => x.error && x.retry()) });
function Async({ s, children }: { s: Status; children: ReactNode }) {
  if (s.loading) return <div className="skeleton" style={{ minHeight: 44 }} aria-hidden />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.retry} />;
  return <>{children}</>;
}
const W = ({ title, to, children }: { title: string; to?: string; children: ReactNode }) => (
  <section className="card hover col" aria-label={title}><div className="row between"><h3 style={{ fontSize: '1.05em' }}>{title}</h3>{to && <Link className="small" to={to}>Open →</Link>}</div>{children}</section>);
const Muted = ({ children }: { children: ReactNode }) => <span className="muted small">{children}</span>;
const L = (items: string[], empty: string) => items.length ? <ul className="list">{items.map((x, i) => <li key={i}>• {x}</li>)}</ul> : <Muted>{empty}</Muted>;
const nextAssessment = (courses: Course[]) => courses.filter(c => c.assessment?.date && c.assessment.date >= today()).sort((a, b) => a.assessment.date.localeCompare(b.assessment.date))[0];

function ChartCard({ title, height, to, extra }: { title: string; height: number; to?: string; extra?: boolean }) {
  const a = useAnalytics(); const rows = (a.data ?? []).slice(-30);
  return <W title={title} to={to}><Async s={a}>{rows.length
    ? <><div style={{ height }}><ResponsiveContainer><AreaChart data={rows}><XAxis dataKey="date" hide /><Tooltip /><Area dataKey="activeUsers" name="Active users" stroke="var(--primary)" fill="var(--primary)" fillOpacity={extra ? .25 : .2} /></AreaChart></ResponsiveContainer></div></>
    : <Muted>No analytics data returned yet.</Muted>}</Async></W>;
}
function MetricsCard() {
  const a = useAnalytics(); const rows = a.data ?? []; const l = rows.slice(-14), p = rows.slice(-28, -14);
  const ch = p.length ? ((avg(l, 'activeUsers') - avg(p, 'activeUsers')) / avg(p, 'activeUsers')) * 100 : null;
  return <W title="Key metrics" to="/app/analytics"><Async s={a}>{l.length
    ? <><b style={{ fontSize: '1.6em' }}>{Math.round(avg(l, 'activeUsers')).toLocaleString()}</b><Muted>average daily active users, last {l.length} days</Muted>
      {ch !== null && Number.isFinite(ch) ? <span className={ch < 0 ? 'down' : 'up'}>{ch.toFixed(1)}% vs previous {p.length} days</span> : <Muted>Not enough history to compare periods.</Muted>}</>
    : <Muted>No analytics data returned yet.</Muted>}</Async></W>;
}

export function BaseWidget({ id }: { id: WidgetId }) {
  const { meetings, messages, courses, tasks, projects, status } = useData();
  switch (id) {
    case 'tasks': { const open = tasks.filter(t => t.status !== 'done').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
      return <W title="Priority tasks" to="/app/projects"><Async s={status.tasks}><ul className="list">{open.map(t => <li key={t.id}><span className={'tag ' + (t.due < today() ? 'err' : 'pri')}>{t.due < today() ? 'Overdue' : t.due.slice(5)}</span><span>{t.title}</span></li>)}{!open.length && <li className="muted">No open tasks</li>}</ul></Async></W>; }
    case 'meetings': { const up = meetings.filter(m => !isPast(m)).sort((a, b) => whenOf(a).localeCompare(whenOf(b))).slice(0, 3); const ready = meetings.filter(m => m.reportStatus === 'ready').length;
      return <W title="Upcoming meetings" to="/app/meetings"><Async s={status.meetings}><ul className="list">{up.map(m => <li key={m.id}><b>{m.time}</b><span>{m.title}</span><span className="muted small">{m.date.slice(5)}</span></li>)}{!up.length && <li className="muted">No upcoming meetings</li>}</ul>
        <Link className="small" to="/app/meetings/insights">{ready} meeting report{ready === 1 ? '' : 's'} ready · View insights →</Link></Async></W>; }
    case 'messages': { const un = messages.filter(m => m.unread).slice(0, 4);
      return <W title="Unread communications" to="/app/communication"><Async s={status.messages}><ul className="list">{un.map(m => <li key={m.id}>{m.priority === 'high' && <span className="tag err">High</span>}<span>{m.from.split(' (')[0]}: {m.subject}</span></li>)}{!un.length && <li className="muted">No unread messages</li>}</ul></Async></W>; }
    case 'notifications': { const od = tasks.filter(t => t.due < today() && t.status !== 'done').length; const hi = messages.filter(m => m.unread && m.priority === 'high').length; const ex = nextAssessment(courses);
      return <W title="Notifications"><Async s={merge(status.tasks, status.messages, status.courses)}><ul className="list">
        {ex && <li>Upcoming: {ex.assessment.title} on {ex.assessment.date} ({ex.name})</li>}<li>{od} task{od === 1 ? '' : 's'} overdue</li><li>{hi} high-priority unread message{hi === 1 ? '' : 's'}</li></ul>
        <Muted>Summary derived from your tasks, messages and courses. A dedicated notifications service is not available yet.</Muted></Async></W>; }
    case 'learning': return <W title="Study progress" to="/app/study"><Async s={status.courses}><div className="col">{courses.map(c => <div key={c.id} className="row"><Ring value={courseProgress(c)} size={46} /><span>{c.name}</span></div>)}{!courses.length && <Muted>No courses yet.</Muted>}</div></Async></W>;
    case 'projects': return <W title="Project progress" to="/app/projects"><Async s={merge(status.projects, status.tasks)}><div className="col">{projects.map(p => { const ts = tasks.filter(t => t.projectId === p.id); const pct = ts.length ? (ts.filter(t => t.status === 'done').length / ts.length) * 100 : 0; return <div key={p.id}><div className="row between small"><span>{p.name}</span><span>{Math.round(pct)}%</span></div><Progress value={pct} label={p.name} /></div>; })}{!projects.length && <Muted>No projects yet.</Muted>}</div></Async></W>;
    case 'analytics': return <ChartCard title="Active users (30 days)" height={120} to="/app/analytics" />;
    case 'assistant': return <W title="AI Assistant" to="/app/assistant"><span className="muted">Ask Nexora to prepare, summarize, plan or investigate.</span><div className="row wrap"><Link className="chip" to="/app/assistant">Plan my day</Link><Link className="chip" to="/app/assistant">Draft a reply</Link></div></W>;
  }
}

export function FocusWidget({ id }: { id: FocusId }) {
  const { meetings, messages, courses, tasks, status } = useData();
  const m = meetings.filter(x => !isPast(x)).sort((a, b) => whenOf(a).localeCompare(whenOf(b)))[0];
  const c = courses.find(x => (x.topics ?? []).some(t => !t.done)) ?? courses[0];
  const overdue = tasks.filter(t => t.due < today() && t.status !== 'done');
  switch (id) {
    case 'agenda': return <W title="Meeting agenda"><Async s={status.meetings}>{m ? <><b className="small">{m.title} · {m.time}</b>{L((m.agenda ?? '').split('\n').filter(Boolean), 'No agenda set.')}</> : <Muted>No upcoming meetings.</Muted>}</Async></W>;
    case 'clientContext': return <W title="Client context"><Async s={status.meetings}>{m ? <><b className="small">{m.client}</b><span className="muted">{m.notes || 'No notes yet.'}</span><span className="small">Attendees: {m.attendees.join(', ') || 'none'}</span></> : <Muted>No upcoming meetings.</Muted>}</Async></W>;
    case 'recentComms': return <W title="Recent communications" to="/app/communication"><Async s={status.messages}>{L([...messages].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(x => `${x.from.split(' (')[0]}: ${x.subject}`), 'No messages.')}</Async></W>;
    case 'actionItems': return <W title="Open action items"><Async s={status.meetings}>{L(meetings.flatMap(x => x.actions).filter(a => !a.done).map(a => a.text), 'No open action items.')}</Async></W>;
    case 'prepChecklist': return <W title="Preparation checklist"><Async s={status.meetings}>{m ? L(m.checklist.map(x => (x.done ? '✓ ' : '○ ') + x.text), 'No checklist items.') : <Muted>No upcoming meetings.</Muted>}</Async></W>;
    case 'unread': return <W title="Unread messages" to="/app/communication"><Async s={status.messages}>{L(messages.filter(x => x.unread).map(x => `${x.from.split(' (')[0]} — ${x.subject}`), 'No unread messages.')}</Async></W>;
    case 'replyDrafts': return <W title="Reply drafting"><span className="muted">Open a message in Communication to read it. Drafting and sending replies are not available yet.</span><Link className="btn sm" to="/app/communication">Open Communication</Link></W>;
    case 'revisionTopics': return <W title="Revision topics" to="/app/study"><Async s={status.courses}>{c ? <><b className="small">{c.name}</b>{L((c.topics ?? []).filter(t => !t.done).map(t => t.name), 'All topics complete.')}</> : <Muted>No courses yet.</Muted>}</Async></W>;
    case 'studyPlan': return <W title="Study plan"><Async s={status.courses}>{c ? <><b className="small">{c.name}</b>{L((c.topics ?? []).filter(t => !t.done).slice(0, 3).map((t, i) => `Step ${i + 1}: ${t.name}`), 'All topics complete.')}<Muted>Order follows your course topic list.</Muted></> : <Muted>No courses yet.</Muted>}</Async></W>;
    case 'quizzes': return <W title="Practice quizzes" to="/app/study"><NeedsBackend feature="Practice quizzes" needs="a quiz questions endpoint (none is defined in the API contract yet)" /></W>;
    case 'overdue': return <W title="Overdue tasks" to="/app/projects"><Async s={status.tasks}><ul className="list">{overdue.map(t => <li key={t.id}><span className="tag err">{t.due.slice(5)}</span>{t.title}</li>)}{!overdue.length && <li>Nothing overdue</li>}</ul></Async></W>;
    case 'blockers': return <W title="Blockers"><Async s={status.tasks}>{L(tasks.filter(t => t.blocker && t.status !== 'done').map(t => `${t.title} — ${t.blocker}`), 'No blocked tasks.')}</Async></W>;
    case 'deadlines': return <W title="Upcoming deadlines"><Async s={status.tasks}>{L([...tasks].filter(t => t.status !== 'done' && t.due >= today()).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4).map(t => `${t.due.slice(5)} · ${t.title}`), 'No upcoming deadlines.')}</Async></W>;
    case 'activityChart': return <ChartCard title="Activity chart" height={150} to="/app/analytics" extra />;
    case 'metrics': return <MetricsCard />;
    case 'investigation': return <W title="Investigation suggestions"><span className="muted">Open Analytics to compare a metric across two periods and look for the day the change began. Treat any pattern as a lead, not a confirmed cause.</span><Link className="btn sm" to="/app/analytics">Open Analytics</Link></W>;
    case 'assistant': return <W title="Assistant" to="/app/assistant"><span>Nexora can prepare meetings, summarize messages, plan study sessions, prioritize tasks and explain metrics.</span><Link className="btn sm primary" to="/app/assistant">Open AI Assistant</Link></W>;
  }
}
