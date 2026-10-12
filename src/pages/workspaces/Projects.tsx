import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { workspaceServices } from '../../api/services';
import { useResource } from '../../api/useResource';
import { Banner, Empty, ErrorState, Modal, Page, Progress, Skeletons } from '../../components/ui';
import { today } from '../../lib/storage';
import type { Project, Task } from '../../types';

const COLS: { id: Task['status']; label: string }[] = [{ id: 'todo', label: 'To Do' }, { id: 'doing', label: 'In Progress' }, { id: 'done', label: 'Done' }];
export default function Projects() {
  const pr = useResource(() => workspaceServices.list('projects')); const ta = useResource(() => workspaceServices.list('tasks'));
  const projects = pr.data ?? [], tasks = ta.data ?? [];
  const [pf, setPf] = useState('all'); const [q, setQ] = useState(''); const [prio, setPrio] = useState('all'); const [who, setWho] = useState('all'); const [od, setOd] = useState(false);
  const [edit, setEdit] = useState<Partial<Task> | null>(null); const [proj, setProj] = useState<Partial<Project> | null>(null); const [tip, setTip] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [modalErr, setModalErr] = useState('');
  const people = useMemo(() => Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).sort(), [tasks]);
  const vis = useMemo(() => tasks.filter(t => (pf === 'all' || t.projectId === pf) && (prio === 'all' || t.priority === prio) && (who === 'all' || t.assignee === who) && (!od || (t.due < today() && t.status !== 'done')) && t.title.toLowerCase().includes(q.toLowerCase())), [tasks, pf, q, prio, who, od]);
  const scoped = tasks.filter(t => pf === 'all' || t.projectId === pf); const done = scoped.filter(t => t.status === 'done').length;
  const overdue = scoped.filter(t => t.due < today() && t.status !== 'done'); const blockers = scoped.filter(t => t.blocker && t.status !== 'done');
  const load = people.map(n => ({ n, c: scoped.filter(t => t.assignee === n && t.status !== 'done').length })); const maxLoad = Math.max(1, ...load.map(l => l.c));

  const run = async (f: () => Promise<unknown>, inModal = false) => { setBusy(true); inModal ? setModalErr('') : setErr(''); try { await f(); return true; } catch (e) { inModal ? setModalErr(errorMessage(e)) : setErr(errorMessage(e)); return false; } finally { setBusy(false); } };
  const move = (t: Task, d: -1 | 1) => { const i = COLS.findIndex(c => c.id === t.status) + d; if (!COLS[i]) return; void run(async () => { await workspaceServices.update('tasks', t.id, { ...t, status: COLS[i].id }); await ta.refresh(); }); };
  const saveTask = async () => {
    if (!edit?.title?.trim()) return;
    const base = { title: edit.title.trim(), projectId: edit.projectId || projects[0]?.id || '', status: edit.status || 'todo', priority: edit.priority || 'medium', due: edit.due || today(), assignee: (edit.assignee ?? '').trim(), blocker: edit.blocker || undefined } as Omit<Task, 'id'>;
    const ok = await run(async () => { if (edit.id) await workspaceServices.update('tasks', edit.id, { ...(edit as Task), ...base }); else await workspaceServices.create('tasks', base); await ta.refresh(); }, true);
    if (ok) setEdit(null);
  };
  const saveProject = async () => { if (!proj?.name?.trim()) return; const ok = await run(async () => { await workspaceServices.create('projects', { name: proj.name!.trim(), description: proj.description ?? '' }); await pr.refresh(); }, true); if (ok) setProj(null); };
  const suggest = () => { const w = { high: 3, medium: 2, low: 1 }; setTip([...scoped.filter(t => t.status !== 'done')].sort((a, b) => (+(b.due < today()) * 5 + w[b.priority] + +!!b.blocker) - (+(a.due < today()) * 5 + w[a.priority] + +!!a.blocker)).slice(0, 3).map((t, i) => `${i + 1}. ${t.title} — ${t.due < today() ? 'overdue, ' : ''}${t.priority} priority${t.blocker ? `, blocked: ${t.blocker}` : ''}`)); };
  const loading = pr.loading || ta.loading; const loadErr = pr.error || ta.error;

  return (
    <Page title="Project Management" sub="Board, deadlines and workload" actions={<><button className="btn" disabled={!!loadErr} onClick={() => { setModalErr(''); setProj({}); }}>New project</button><button className="btn primary" disabled={!!loadErr} onClick={() => { setModalErr(''); setEdit({}); }}><Plus size={16} /> New task</button></>}>
      {loadErr && <ErrorState message={loadErr} onRetry={() => { if (pr.error) pr.retry(); if (ta.error) ta.retry(); }} />}
      {err && <Banner kind="error">{err}</Banner>}
      {loading ? <Skeletons n={3} /> : loadErr ? null : <>
        <div className="row wrap"><select style={{ width: 'auto' }} aria-label="Project" value={pf} onChange={e => setPf(e.target.value)}><option value="all">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input className="input" style={{ maxWidth: 240 }} aria-label="Search tasks" placeholder="Search tasks" value={q} onChange={e => setQ(e.target.value)} />
          <select style={{ width: 'auto' }} aria-label="Priority" value={prio} onChange={e => setPrio(e.target.value)}><option value="all">Any priority</option><option>high</option><option>medium</option><option>low</option></select>
          <select style={{ width: 'auto' }} aria-label="Assignee" value={who} onChange={e => setWho(e.target.value)}><option value="all">Anyone</option>{people.map(t => <option key={t}>{t}</option>)}</select>
          <label className="row small"><input className="check" type="checkbox" checked={od} onChange={e => setOd(e.target.checked)} /> Overdue only</label></div>
        {!projects.length && !tasks.length ? <Empty title="No projects or tasks yet">Create a project, then add tasks to it.</Empty> : <>
          <div className="grid g4"><div className="card kpi"><span className="muted small">Completion</span><b>{scoped.length ? Math.round(done / scoped.length * 100) : 0}%</b><Progress value={scoped.length ? done / scoped.length * 100 : 0} label="Completion" /></div><div className="card kpi"><span className="muted small">Overdue</span><b className={overdue.length ? 'down' : ''}>{overdue.length}</b></div><div className="card kpi"><span className="muted small">Blockers</span><b>{blockers.length}</b></div>
            <div className="card"><span className="muted small">Team workload (open tasks)</span>{load.map(l => <div key={l.n} className="row small"><span style={{ width: 90 }}>{l.n.split(' ')[0]}</span><div className="grow"><Progress value={(l.c / maxLoad) * 100} label={l.n} /></div>{l.c}</div>)}{!load.length && <div className="muted small">No assignees yet.</div>}</div></div>
          <div className="row wrap"><button className="btn sm" onClick={suggest}>Suggest priorities</button><span className="muted small">Rule-based ranking of your open tasks (overdue, priority, blockers).</span>{tip.length > 0 && <Banner kind="info">{tip.map(t => <div key={t}>{t}</div>)}</Banner>}</div>
          <div className="kan">{COLS.map(c => <section key={c.id} className="card col" aria-label={c.label}><div className="row between"><h3 style={{ fontSize: '1em' }}>{c.label}</h3><span className="chip" style={{ cursor: 'default' }}>{vis.filter(t => t.status === c.id).length}</span></div>
            {vis.filter(t => t.status === c.id).map(t => <article key={t.id} className="tcard"><div className="row between"><b>{t.title}</b><span className={'tag ' + (t.priority === 'high' ? 'err' : t.priority === 'medium' ? '' : 'ok')}>{t.priority}</span></div>
              <div className="muted small">{projects.find(p => p.id === t.projectId)?.name ?? 'No project'}{t.assignee ? ` · ${t.assignee}` : ''}</div><div className="row small"><span className={t.due < today() && t.status !== 'done' ? 'down' : ''}>Due {t.due}{t.due < today() && t.status !== 'done' ? ' (overdue)' : ''}</span></div>
              {t.blocker && t.status !== 'done' && <span className="tag err" style={{ width: 'fit-content' }}>Blocked: {t.blocker}</span>}
              <div className="row"><button className="icon-btn" aria-label={`Move ${t.title} left`} disabled={busy || t.status === 'todo'} onClick={() => move(t, -1)}><ArrowLeft size={16} /></button><button className="icon-btn" aria-label={`Move ${t.title} right`} disabled={busy || t.status === 'done'} onClick={() => move(t, 1)}><ArrowRight size={16} /></button><span className="grow" /><button className="btn sm ghost" onClick={() => { setModalErr(''); setEdit(t); }}>Details</button></div></article>)}</section>)}</div></>}
      </>}
      <Modal open={!!edit} title={edit?.id ? 'Task details' : 'New task'} onClose={() => setEdit(null)}>
        <label className="f">Title<input className="input" value={edit?.title ?? ''} onChange={e => setEdit({ ...edit, title: e.target.value })} /></label>
        <div className="row"><label className="f grow">Project<select value={edit?.projectId ?? projects[0]?.id ?? ''} onChange={e => setEdit({ ...edit, projectId: e.target.value })}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="f grow">Status<select value={edit?.status ?? 'todo'} onChange={e => setEdit({ ...edit, status: e.target.value as Task['status'] })}>{COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>
        <div className="row"><label className="f grow">Priority<select value={edit?.priority ?? 'medium'} onChange={e => setEdit({ ...edit, priority: e.target.value as Task['priority'] })}><option>high</option><option>medium</option><option>low</option></select></label><label className="f grow">Assignee<input className="input" list="assignees" value={edit?.assignee ?? ''} onChange={e => setEdit({ ...edit, assignee: e.target.value })} /><datalist id="assignees">{people.map(p => <option key={p} value={p} />)}</datalist></label></div>
        <label className="f">Deadline<input className="input" type="date" value={edit?.due ?? today()} onChange={e => setEdit({ ...edit, due: e.target.value })} /></label><label className="f">Blocker (optional)<input className="input" value={edit?.blocker ?? ''} onChange={e => setEdit({ ...edit, blocker: e.target.value })} /></label>
        {!projects.length && <Banner kind="info">Create a project first — tasks belong to a project.</Banner>}
        {modalErr && <Banner kind="error">{modalErr}</Banner>}
        <div className="row"><button className="btn primary" disabled={busy || !edit?.title?.trim() || !projects.length} onClick={() => void saveTask()}>{busy ? 'Saving…' : 'Save'}</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div></Modal>
      <Modal open={!!proj} title="New project" onClose={() => setProj(null)}>
        <label className="f">Name<input className="input" value={proj?.name ?? ''} onChange={e => setProj({ ...proj, name: e.target.value })} /></label><label className="f">Description<textarea value={proj?.description ?? ''} onChange={e => setProj({ ...proj, description: e.target.value })} /></label>
        {modalErr && <Banner kind="error">{modalErr}</Banner>}
        <div className="row"><button className="btn primary" disabled={busy || !proj?.name?.trim()} onClick={() => void saveProject()}>{busy ? 'Creating…' : 'Create'}</button><button className="btn" onClick={() => setProj(null)}>Cancel</button></div></Modal>
    </Page>
  );
}
