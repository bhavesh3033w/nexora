import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { meetingService } from '../../api/services';
import { Banner, Empty, Page, Skeletons } from '../../components/ui';
import { ReportBadge, STATUS_LABEL, StatusBadge } from '../../features/meetings/parts';
import { isPast, useMeetings, whenOf } from '../../features/meetings/useMeetings';
import type { MeetingStatus } from '../../types';

export default function MeetingInsights() {
  const { meetings, loading, error, refresh } = useMeetings(); const [err, setErr] = useState('');
  const [q, setQ] = useState(''); const [status, setStatus] = useState<'' | MeetingStatus>(''); const [client, setClient] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const clients = useMemo(() => Array.from(new Set(meetings.map(m => m.client))).sort(), [meetings]);
  const filtered = useMemo(() => meetings.filter(m => (!status || (m.status ?? 'scheduled') === status) && (!client || m.client === client) && (!from || m.date >= from) && (!to || m.date <= to)
    && (!q.trim() || (m.title + ' ' + m.client + ' ' + (m.report?.summary ?? '')).toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => whenOf(b).localeCompare(whenOf(a))), [meetings, q, status, client, from, to]);
  const completed = meetings.filter(m => m.status === 'completed').length; const upcoming = meetings.filter(m => !isPast(m)).length;
  const awaiting = meetings.filter(m => m.reportStatus === 'waiting_for_transcript' || m.reportStatus === 'processing' || m.reportStatus === 'transcript_unavailable').length;
  const items = filtered.flatMap(m => (m.report?.actionItems ?? []).map(a => ({ ...a, m }))); const openItems = items.filter(i => !i.done).sort((a, b) => (a.deadline ?? '~').localeCompare(b.deadline ?? '~'));
  const decisions = filtered.filter(m => m.report?.decisions.length).slice(0, 5);
  const toggle = async (mid: string, iid: string, done: boolean) => { try { await meetingService.setActionItem(mid, iid, done); await refresh(); } catch (e) { setErr(errorMessage(e)); } };
  const reset = () => { setQ(''); setStatus(''); setClient(''); setFrom(''); setTo(''); };

  return (
    <Page title="Meeting Intelligence" sub="Reports, decisions and action items from your meetings" actions={<Link className="btn" to="/app/meetings"><ArrowLeft size={16} /> Meetings</Link>}>
      {error && <Banner kind="error">{error} <button className="btn sm" onClick={() => void refresh()}>Retry</button></Banner>}{err && <Banner kind="error">{err}</Banner>}
      {loading ? <Skeletons n={4} /> : <>
        <div className="grid g4">{[['Total meetings', meetings.length], ['Completed', completed], ['Upcoming', upcoming], ['Awaiting report', awaiting]].map(([l, v]) => <div key={l} className="card stat"><span className="muted small">{l}</span><b>{v}</b></div>)}</div>
        <section className="card col" aria-label="Filters">
          <div className="grid g4"><label className="f">Search<input className="input" placeholder="Title, client or summary" value={q} onChange={e => setQ(e.target.value)} /></label>
            <label className="f">Status<select value={status} onChange={e => setStatus(e.target.value as '' | MeetingStatus)}><option value="">All</option>{(Object.keys(STATUS_LABEL) as MeetingStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <label className="f">Client<select value={client} onChange={e => setClient(e.target.value)}><option value="">All</option>{clients.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="f">From<input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label className="f">To<input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
          <div className="row"><span className="muted small">{filtered.length} of {meetings.length} meetings</span><button className="btn sm ghost" onClick={reset}>Clear filters</button></div>
        </section>
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <section className="col" aria-label="Recent meeting history"><h2 style={{ fontSize: '1.1em' }}>Recent meetings</h2>
            {filtered.slice(0, 12).map(m => <Link key={m.id} className="hist" to={`/app/meetings/${m.id}`}>
              <div className="row between wrap"><b>{m.title}</b><span className="row"><StatusBadge status={m.status} /><ReportBadge status={m.reportStatus} /></span></div>
              <span className="muted small">{m.client} · {m.date} {m.time}</span>
              {m.report ? <span>{m.report.summary.slice(0, 180)}{m.report.summary.length > 180 ? '…' : ''}</span> : <span className="muted small">No report — {m.reportStatus === 'waiting_for_transcript' ? 'waiting for transcript' : m.reportStatus === 'transcript_unavailable' ? 'transcript unavailable' : 'nothing has been summarised'}.</span>}</Link>)}
            {!filtered.length && <Empty title={meetings.length ? 'No meetings match these filters' : 'No meetings yet'}>{meetings.length ? 'Try clearing the filters.' : 'Schedule a meeting to get started.'}</Empty>}</section>
          <div className="col">
            <section className="card col" aria-label="Open action items"><h2 style={{ fontSize: '1.1em' }}>Open action items ({openItems.length})</h2>
              {openItems.length ? <ul className="list">{openItems.slice(0, 12).map(a => <li key={a.m.id + a.id} style={{ alignItems: 'flex-start' }}><input className="check" id={'x' + a.id} type="checkbox" checked={false} onChange={() => toggle(a.m.id, a.id, true)} />
                <label htmlFor={'x' + a.id}>{a.text}{a.owner && <span className="tag pri" style={{ marginLeft: 6 }}>{a.owner}</span>}{a.deadline && <span className="tag" style={{ marginLeft: 6 }}>Due {a.deadline}</span>}<div className="muted small"><Link to={`/app/meetings/${a.m.id}`}>{a.m.title}</Link></div></label></li>)}</ul> : <span className="muted">No open AI-extracted action items.</span>}</section>
            <section className="card col" aria-label="Key decisions"><h2 style={{ fontSize: '1.1em' }}>Recent key decisions</h2>
              {decisions.length ? decisions.map(m => <div key={m.id}><b className="small">{m.title}</b><ul className="list" style={{ gap: 2 }}>{m.report!.decisions.slice(0, 3).map((d, i) => <li key={i} style={{ alignItems: 'flex-start' }}>• <span>{d}</span></li>)}</ul></div>) : <span className="muted">No decisions recorded yet — they appear after a meeting has been processed from a transcript.</span>}</section>
          </div>
        </div>
      </>}
    </Page>
  );
}
