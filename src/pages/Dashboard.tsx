import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronDown, ChevronUp, Plus, RotateCcw, Send, Undo2, Wand2 } from 'lucide-react';
import { classifyIntent, FOCUS_LABEL, type AdaptiveConfig } from '../features/adaptive/engine';
import { adaptationService } from '../api/services';
import { BaseWidget, DataProvider, FocusWidget, useData } from '../features/adaptive/Widgets';
import { CalendarWidget, ProgressPanel, SummaryCards, TaskTable, UpcomingTasks } from '../features/dashboard/panels';
import ActionTrackerCard from '../features/dashboard/ActionTrackerCard';
import { isOverdue } from '../features/dashboard/helpers';
import { useTaskStatus } from '../features/dashboard/useTaskStatus';
import { ALL_WIDGETS, DEFAULTS, usePrefs } from '../features/personalization/PrefsContext';
import { WIDGET_LABEL } from '../features/personalization/questions';
import { useAuth } from '../features/auth/AuthContext';
import { Banner, Empty, Page } from '../components/ui';
import type { WidgetId } from '../types';

const SAMPLES = ['Prepare for tomorrow\'s client meeting.', 'Summarize my unread messages and help me reply.', 'Help me prepare for my upcoming exam.', 'Show overdue project tasks and blockers.', 'Investigate why active users have declined.', 'How can Nexora help me manage my work?'];
const FOCUS_W: Record<string, WidgetId> = { tasks: 'tasks', meetings: 'meetings', messages: 'messages', learning: 'learning', analytics: 'analytics' };
const SHORT: Record<string, { to: string; label: string }> = { meetings: { to: '/app/meetings', label: 'Meetings' }, communication: { to: '/app/communication', label: 'Communication' }, study: { to: '/app/study', label: 'Study & Learning' }, projects: { to: '/app/projects', label: 'Projects' }, analytics: { to: '/app/analytics', label: 'Analytics' }, assistant: { to: '/app/assistant', label: 'AI Assistant' } };
const GOAL_SC: Record<string, string[]> = { organize: ['projects', 'meetings'], collaborate: ['communication', 'meetings'], learn: ['study', 'assistant'], track: ['analytics', 'projects'], manage: ['projects', 'analytics'] };

export default function Dashboard() { return <DataProvider><DashboardInner /></DataProvider>; }

function DashboardInner() {
  const { session } = useAuth(); const { prefs, update } = usePrefs(); const { tasks, meetings, courses, projects, status } = useData();
  const [text, setText] = useState(''); const [day, setDay] = useState<string | null>(null); const taskActions = useTaskStatus(status.tasks.refresh);
  const [active, setActive] = useState<AdaptiveConfig | null>(null);
  const [proposal, setProposal] = useState<AdaptiveConfig | null>(null);
  const [history, setHistory] = useState<AdaptiveConfig[]>([]);
  const [why, setWhy] = useState(true);

  const applyAdaptation = (cfg: AdaptiveConfig, query: string) => {
    if (active) {
      setHistory((prev) => [active, ...prev]);
    }
    setActive(cfg);
    setProposal(null);
    void adaptationService.apply(query, cfg).catch(() => {});
  };

  const undoAdaptation = async () => {
    if (history.length > 0) {
      const prev = history[0];
      setHistory((h) => h.slice(1));
      setActive(prev);
    } else {
      setActive(null);
    }
    try {
      await adaptationService.undo();
    } catch {
      // Local fallback handled above
    }
  };

  const run = async (t: string) => {
    if (!t.trim()) return;
    try {
      const res = await adaptationService.preview(t);
      const cfg: AdaptiveConfig = {
        intent: res.intent,
        matched: res.matched || [],
        confidence: res.confidence || 0.85,
        workspace: res.workspace,
        focus: res.focus,
        order: res.order,
        actions: res.actions,
        summary: res.summary,
      };
      if (prefs.adaptive === 'auto') {
        applyAdaptation(cfg, t);
      } else {
        setProposal(cfg);
      }
    } catch {
      const cfg = classifyIntent(t);
      if (prefs.adaptive === 'auto') {
        applyAdaptation(cfg, t);
      } else {
        setProposal(cfg);
      }
    }
  };

  let ids = prefs.order.filter(w => prefs.widgets.includes(w) && w !== 'tasks'); // 'tasks' is now the first-class task table + upcoming panels
  const pri = active ? active.order : prefs.layout !== 'custom' && FOCUS_W[prefs.focus] ? [FOCUS_W[prefs.focus]] : [];
  ids = [...pri.filter(i => ids.includes(i)), ...ids.filter(i => !pri.includes(i))];
  if (prefs.layout === 'minimal') ids = ids.slice(0, 3);
  const overdue = tasks.filter(isOverdue).length;
  const sc = [...new Set([...(prefs.workspace !== 'all' ? [prefs.workspace] : []), ...(GOAL_SC[prefs.goal] ?? []), 'meetings', 'communication', 'study', 'projects', 'analytics', 'assistant'])];
  const explain = (c: AdaptiveConfig) => [`Detected intent: ${c.intent}${c.matched.length ? ` (matched “${c.matched.slice(0, 4).join('”, “')}”)` : ' (no specific keywords — general help)'}, confidence ${Math.round(c.confidence * 100)}%.`,
    `Selected workspace: ${c.workspace.label}.`, `Widgets brought into focus: ${c.focus.map(f => FOCUS_LABEL[f]).join(', ')}.`,
    `Dashboard order now starts with: ${c.order.filter(o => prefs.widgets.includes(o)).map(o => WIDGET_LABEL[o]).join(', ') || 'your selected widgets (none of the priority widgets are enabled)'}.`,
    `Adaptive mode: ${prefs.adaptive === 'auto' ? 'automatic' : prefs.adaptive === 'ask' ? 'ask first' : 'manual'}.`];
  const move = (w: WidgetId, d: -1 | 1) => { const o = [...prefs.order]; const i = o.indexOf(w); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; void update({ order: o }); };
  const toggle = (w: WidgetId) => void update({ widgets: prefs.widgets.includes(w) ? prefs.widgets.filter(x => x !== w) : [...prefs.widgets, w] });
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Page title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${session?.name.split(' ')[0]}`} sub={date} actions={<><Link className="btn sm" to="/app/meetings"><CalendarPlus size={15} />Meetings</Link><Link className="btn sm primary" to="/app/projects"><Plus size={15} />New task</Link></>}>
      <form className="card row cmd" onSubmit={e => { e.preventDefault(); run(text); }} role="search" aria-label="Adaptive command bar">
        <Wand2 size={18} color="var(--primary)" /><input className="input" style={{ border: 0, boxShadow: 'none' }} aria-label="Tell Nexora what you need" placeholder="Tell Nexora what you need… e.g. “Prepare for tomorrow's client meeting.”" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn primary" aria-label="Adapt workspace"><Send size={16} /></button>
      </form>
      {prefs.layout !== 'minimal' && <div className="row wrap">{SAMPLES.map(s => <button key={s} className="chip" onClick={() => { setText(s); run(s); }}>{s.replace(/[.?]$/, '')}</button>)}</div>}

      {proposal && <div className="card col" role="region" aria-label="Proposed adaptation"><b>Proposed adaptation: {proposal.workspace.label}</b>
        <Banner kind="info">{prefs.adaptive === 'manual' ? 'Your layout is set to manual customization, so nothing changes unless you confirm.' : 'Review the proposal. Nothing changes until you apply it.'}</Banner>
        <ul className="list">{explain(proposal).slice(0, 4).map(l => <li key={l}>• {l}</li>)}</ul>
        <div className="row"><button className="btn primary" onClick={() => applyAdaptation(proposal, text)}>Apply Adaptation</button><button className="btn" onClick={() => setProposal(null)}>Dismiss</button></div></div>}

      {active && <section className="col" aria-label="Adapted workspace" style={{ animation: 'rise .4s both' }}>
        <div className="row between wrap"><h2 style={{ fontSize: '1.25em' }}>{active.summary} · <span style={{ color: 'var(--primary)' }}>{active.workspace.label}</span></h2>
          <div className="row">
            {active.actions.map(a => <Link key={a.label} className="btn sm" to={a.to}>{a.label}</Link>)}
            {history.length > 0 && (
              <button className="btn sm ghost" onClick={undoAdaptation}>
                <Undo2 size={14} /> Undo Adaptation
              </button>
            )}
            <button className="btn sm ghost" onClick={() => { setActive(null); setText(''); }}>
              <RotateCcw size={14} /> Restore Default Dashboard
            </button>
          </div>
        </div>
        <div className="grid g2 stagger" key={active.intent}>{active.focus.map(f => <FocusWidget key={f} id={f} />)}</div>
        <div className="card"><button className="btn ghost sm" aria-expanded={why} onClick={() => setWhy(!why)}>Why this workspace? {why ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          {why && <ul className="list" style={{ marginTop: 10 }}>{explain(active).map(l => <li key={l}>• {l}</li>)}</ul>}</div>
      </section>}

      <SummaryCards tasks={tasks} status={status.tasks} />
      <ActionTrackerCard />

      <div className="dash-grid">
        <div className="dash-col">
        <TaskTable tasks={tasks} projects={projects} status={status.tasks} projectStatus={status.projects} actions={taskActions} day={day} onClearDay={() => setDay(null)} />
        <ProgressPanel tasks={tasks} projects={projects} status={status.tasks} projectStatus={status.projects} />
        </div>
        <div className="dash-col">
        <CalendarWidget tasks={tasks} meetings={meetings} courses={courses} statuses={[{ name: 'Tasks', s: status.tasks }, { name: 'Meetings', s: status.meetings }, { name: 'Courses', s: status.courses }]} activeDay={day} onFilterDay={setDay} />
        <UpcomingTasks tasks={tasks} projects={projects} status={status.tasks} actions={taskActions} />
        </div>
      </div>

      {prefs.layout === 'custom' && <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Customize widgets (show/hide and reorder)</summary>
        <ul className="list" style={{ marginTop: 10 }}>{prefs.order.map((w, i) => <li key={w}><label className="row grow"><input className="check" type="checkbox" checked={prefs.widgets.includes(w)} onChange={() => toggle(w)} />{WIDGET_LABEL[w]}</label>
          <button className="icon-btn" aria-label={`Move ${WIDGET_LABEL[w]} up`} disabled={i === 0} onClick={() => move(w, -1)}><ChevronUp size={16} /></button><button className="icon-btn" aria-label={`Move ${WIDGET_LABEL[w]} down`} disabled={i === ALL_WIDGETS.length - 1} onClick={() => move(w, 1)}><ChevronDown size={16} /></button></li>)}</ul></details>}

      {prefs.widgets.length === 0
        ? <Empty title="No extra widgets selected">Your task overview above is always shown. <div style={{ marginTop: 10 }}><button className="btn primary" onClick={() => void update({ widgets: DEFAULTS.widgets, order: DEFAULTS.order })}>Restore Default Widgets</button></div></Empty>
        : ids.length > 0 && <section className="col" aria-label="Your widgets"><h2 className="sec-title">More from your workspace</h2><div className="grid g2 stagger">{ids.map(w => <BaseWidget key={w} id={w} />)}</div></section>}

      <div className="card col"><h3 style={{ fontSize: '1.05em' }}>Workspace shortcuts{prefs.goal && <span className="muted small"> · prioritized for your goal</span>}</h3>
        <div className="row wrap">{sc.map(k => <Link key={k} className="btn sm" to={SHORT[k].to}>{SHORT[k].label}</Link>)}</div>
        {!status.tasks.loading && !status.tasks.error && <span className="muted small">Suggestion (rule-based, from your tasks): {overdue ? `You have ${overdue} overdue task${overdue > 1 ? 's' : ''} — try “Show overdue project tasks and blockers.”` : 'Nothing overdue. Try describing your next goal above.'}</span>}</div>
    </Page>
  );
}
