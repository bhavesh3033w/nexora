import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { workspaceServices } from '../../api/services';
import { useResource } from '../../api/useResource';
import { Banner, Empty, ErrorState, NeedsBackend, Page, Skeletons } from '../../components/ui';
import type { Message } from '../../types';

type Filter = 'all' | 'unread' | 'read' | 'high';
export default function Communication() {
  const res = useResource(() => workspaceServices.list('messages')); const msgs = res.data ?? [];
  const [q, setQ] = useState(''); const [f, setF] = useState<Filter>('all'); const [sel, setSel] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const shown = msgs.filter(m => (f === 'all' || (f === 'unread' && m.unread) || (f === 'read' && !m.unread) || (f === 'high' && m.priority === 'high')) && (m.from + m.subject + m.body).toLowerCase().includes(q.toLowerCase()));
  const m = msgs.find(x => x.id === sel);
  const setUnread = async (x: Message, unread: boolean) => { setBusy(true); setErr(''); try { await workspaceServices.update('messages', x.id, { ...x, unread }); await res.refresh(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } };
  const open = (x: Message) => { setSel(x.id); if (x.unread) void setUnread(x, false); };
  return (
    <Page title="Communication" sub="Inbox and follow-ups" actions={<button className="btn primary" disabled title="Composing and sending messages needs a backend endpoint that is not defined yet"><Pencil size={16} /> Compose</button>}>
      {res.error && <ErrorState message={res.error} onRetry={res.retry} />}{err && <Banner kind="error">{err}</Banner>}
      {res.loading ? <Skeletons n={3} /> : res.error ? null : !msgs.length ? <Empty title="No messages">Your inbox is empty.</Empty> : <>
        <div className="row wrap"><input className="input" style={{ maxWidth: 320 }} aria-label="Search messages" placeholder="Search messages" value={q} onChange={e => setQ(e.target.value)} />
          {(['all', 'unread', 'read', 'high'] as Filter[]).map(x => <button key={x} className={'chip' + (f === x ? ' on' : '')} aria-pressed={f === x} onClick={() => setF(x)}>{x === 'high' ? 'High priority' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', alignItems: 'start' }}>
          <div className="col" role="list" aria-label="Conversations">{shown.map(x => <button key={x.id} role="listitem" className={'item' + (x.id === sel ? ' sel' : '')} onClick={() => open(x)}><div className="row between"><b>{x.unread ? '● ' : ''}{x.from.split(' (')[0]}</b>{x.priority === 'high' && <span className="tag err">High</span>}</div><div className="small">{x.subject}</div></button>)}{!shown.length && <div className="card muted">No messages match.</div>}</div>
          <div className="card col" style={{ gridColumn: 'span 2' }}>{m ? <>
            <div className="row between wrap"><div><h2 style={{ fontSize: '1.2em' }}>{m.subject}</h2><span className="muted small">{m.from} · {m.date}</span></div><button className="btn sm" disabled={busy} onClick={() => void setUnread(m, !m.unread)}>Mark as {m.unread ? 'read' : 'unread'}</button></div>
            <p>{m.body}</p>
            <NeedsBackend feature="Replying, drafting, AI rewrite/summary and follow-up reminders" needs="message reply/send, draft, reminder and AI text endpoints (none are defined in the API contract yet)" />
          </> : <span className="muted">Select a conversation to read it.</span>}</div>
        </div></>}
    </Page>
  );
}
