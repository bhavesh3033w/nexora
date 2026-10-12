import { useMemo, useState } from 'react';
import { Check, Copy, Download, Search, X } from 'lucide-react';
import { Banner } from '../../components/ui';
import { itemDelivery, itemStatus, reportToMarkdown, todayLocal } from '../../lib/transcript';
import type { ActionStatus, Attendee, Client, Meeting, MeetingStatus, ReportStatus } from '../../types';

export const STATUS_LABEL: Record<MeetingStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', in_progress: 'In Progress', processing: 'Processing', completed: 'Completed', failed: 'Failed' };
const STATUS_CLS: Record<MeetingStatus, string> = { draft: '', scheduled: 'pri', in_progress: 'ok', processing: '', completed: 'ok', failed: 'err' };
export const StatusBadge = ({ status = 'scheduled' }: { status?: MeetingStatus }) => <span className={'tag ' + STATUS_CLS[status]}>{STATUS_LABEL[status]}</span>;

export const REPORT_LABEL: Record<ReportStatus, string> = { none: 'No report yet', waiting_for_transcript: 'Waiting for transcript', processing: 'Generating report…', ready: 'Report ready', transcript_unavailable: 'Transcript unavailable', failed: 'Report failed' };
export const ReportBadge = ({ status = 'none' }: { status?: ReportStatus }) => <span className={'tag ' + (status === 'ready' ? 'ok' : status === 'failed' || status === 'transcript_unavailable' ? 'err' : '')}>{REPORT_LABEL[status]}</span>;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Searchable multi-select of clients + manual email entry. Shows names, emails and removable chips. */
export function AttendeePicker({ clients, value, onChange }: { clients: Client[]; value: Attendee[]; onChange: (a: Attendee[]) => void }) {
  const [q, setQ] = useState(''); const [email, setEmail] = useState(''); const [err, setErr] = useState('');
  const has = (e: string) => value.some(a => a.email.toLowerCase() === e.toLowerCase());
  const hits = useMemo(() => clients.filter(c => (c.name + c.email + c.company).toLowerCase().includes(q.trim().toLowerCase())), [clients, q]);
  const toggle = (c: Client) => onChange(has(c.email) ? value.filter(a => a.email.toLowerCase() !== c.email.toLowerCase()) : [...value, { name: c.name, email: c.email, clientId: c.id }]);
  const addEmail = () => { const e = email.trim(); if (!isEmail(e)) return setErr('Enter a valid email address.'); if (has(e)) return setErr('Already added.'); onChange([...value, { name: e.split('@')[0], email: e }]); setEmail(''); setErr(''); };
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap" aria-label="Selected attendees">{value.map(a => <span key={a.email || a.name} className="chip" style={{ cursor: 'default' }} title={a.email}>{a.name}{a.email && <span className="muted small">{a.email}</span>}
        <button type="button" className="icon-btn" style={{ padding: 0 }} aria-label={`Remove ${a.name}`} onClick={() => onChange(value.filter(x => x !== a))}><X size={14} /></button></span>)}
        {!value.length && <span className="muted small">No attendees selected.</span>}</div>
      <div className="row"><Search size={16} aria-hidden /><input className="input" aria-label="Search clients" placeholder="Search clients by name, email or company" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="pick" role="listbox" aria-multiselectable="true" aria-label="Clients">
        {hits.map(c => <button type="button" role="option" aria-selected={has(c.email)} key={c.id} className={'pick-row' + (has(c.email) ? ' on' : '')} onClick={() => toggle(c)}>
          <span className="pick-check">{has(c.email) && <Check size={14} />}</span><span><b>{c.name}</b> <span className="muted small">· {c.company}</span><div className="muted small">{c.email}</div></span></button>)}
        {!hits.length && <div className="muted small" style={{ padding: 10 }}>No clients match “{q}”.</div>}
      </div>
      <div className="row"><input className="input" type="email" aria-label="Add attendee by email" placeholder="Add another email" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }} />
        <button type="button" className="btn sm" onClick={addEmail}>Add</button></div>
      {err && <span className="err-text" role="alert">{err}</span>}
    </div>
  );
}

export function useCopy() {
  const [done, setDone] = useState('');
  return { done, copy: async (text: string, key = 'x') => { try { await navigator.clipboard.writeText(text); setDone(key); setTimeout(() => setDone(''), 1800); } catch { setDone('fail'); } } };
}

const SOURCE_LABEL = { 'google-transcript': 'Google Meet transcript', 'manual-transcript': 'Manually supplied transcript', recording: 'From recording' } as const;

export function ReportView({ m, onToggle, onStatus, busy }: { m: Meeting; onToggle: (itemId: string, done: boolean) => void; onStatus?: (itemId: string, status: ActionStatus) => void; busy?: boolean }) {
  const r = m.report; const { done, copy } = useCopy(); const today = todayLocal();
  if (!r) return null;
  const md = reportToMarkdown(m.title, m.date, r);
  const L = (xs: string[]) => xs.length ? <ul className="list" style={{ gap: 4 }}>{xs.map((x, i) => <li key={i} style={{ alignItems: 'flex-start' }}>• <span>{x}</span></li>)}</ul> : <span className="muted small">None identified in the transcript.</span>;
  return (
    <div className="col">
      <div className="row between wrap"><span className="muted small">Generated {new Date(r.generatedAt).toLocaleString()} · {SOURCE_LABEL[r.source] ?? r.source} · {r.engine}</span>
        <span className="row"><button className="btn sm" onClick={() => copy(md, 'md')}><Copy size={14} /> {done === 'md' ? 'Copied' : 'Copy summary'}</button>
          <button className="btn sm" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = m.title.replace(/[^\w]+/g, '-').toLowerCase() + '-summary.md'; a.click(); URL.revokeObjectURL(a.href); }}><Download size={14} /> Export .md</button></span></div>
      {done === 'fail' && <Banner kind="error">Clipboard is unavailable in this browser.</Banner>}
      <div><h3 className="h-s">Summary</h3><p>{r.summary}</p></div>
      <div className="grid g2"><div><h3 className="h-s">Discussion topics</h3>{L(r.topics)}</div><div><h3 className="h-s">Key decisions</h3>{L(r.decisions)}</div></div>
      <div><h3 className="h-s">Action items</h3>
        {r.actionItems.length ? <ul className="list rec-items">{r.actionItems.map(a => { const st = itemStatus(a); const dv = itemDelivery(a, today); return <li key={a.id} className="rec-item">
          <input className="check" id={'ai' + a.id} type="checkbox" checked={st === 'done'} disabled={busy} onChange={e => onStatus ? onStatus(a.id, e.target.checked ? 'done' : 'todo') : onToggle(a.id, e.target.checked)} />
          <div className="rec-item-body"><label htmlFor={'ai' + a.id} className={st === 'done' ? 'done' : ''}>{a.text}</label>
            <div className="row wrap rec-item-meta"><span className="tag pri">{a.owner || 'Unassigned'}</span>
              {a.deadline ? <span className="tag" title={a.deadlineSource === 'default' ? 'No deadline was said in the meeting; a default was applied.' : undefined}>Due {a.deadline}{a.deadlineSource === 'default' && <span className="muted"> (default)</span>}</span> : <span className="tag">No deadline</span>}
              {a.priority && <span className="tag">{a.priority} priority</span>}
              {dv === 'overdue' && <span className="tag err">Overdue</span>}{dv === 'late' && <span className="tag rec-late">Completed late</span>}</div></div>
          {onStatus && <select className="rec-status" disabled={busy} aria-label={`Status of “${a.text}”`} value={st} onChange={e => onStatus(a.id, e.target.value as ActionStatus)}><option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option></select>}</li>; })}</ul> : <span className="muted small">No action items identified.</span>}</div>
      <div className="grid g2"><div><h3 className="h-s">Risks</h3>{L(r.risks)}</div><div><h3 className="h-s">Follow-up questions</h3>{L(r.followUps)}</div></div>
    </div>
  );
}
