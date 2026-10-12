import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Trash2 } from 'lucide-react';
import { Modal, Page } from '../../components/ui';
import { assistantService } from '../../api/services';
import { errorMessage } from '../../api/client';
import type { AssistantReply } from '../../types';

interface Msg { id: number; role: 'me' | 'ai' | 'err'; text: string; reply?: AssistantReply; retry?: string }
const PROMPTS = ['Prepare for tomorrow\'s client meeting', 'Summarize my unread messages and help me reply', 'Help me prepare for my upcoming exam', 'Show overdue project tasks and blockers', 'Investigate why active users have declined', 'How can Nexora help me manage my work?'];
/** The conversation lives in memory for this session only; replies come exclusively from POST /assistant/messages. */
export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  const send = async (t: string, again = false) => {
    if (!t.trim() || busy) return; const id = Date.now(); setText(''); setBusy(true);
    setMsgs(l => [...l.filter(m => !(again && m.role === 'err' && m.retry === t)), ...(again ? [] : [{ id, role: 'me' as const, text: t }])]);
    try { const r = await assistantService.send(t); setMsgs(l => [...l, { id: id + 1, role: 'ai', text: r.title, reply: r }]); }
    catch (e) { setMsgs(l => [...l, { id: id + 1, role: 'err', text: errorMessage(e), retry: t }]); } finally { setBusy(false); }
  };
  const history = msgs.filter(m => m.role === 'me').slice(-6).reverse();
  return (
    <Page title="AI Assistant" sub="Intent-aware helper" actions={<button className="btn" disabled={!msgs.length} onClick={() => setConfirm(true)}><Trash2 size={15} /> Clear conversation</button>}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', alignItems: 'start' }}>
        <div className="card col" style={{ gridColumn: 'span 2' }}>
          <div className="chat" role="log" aria-live="polite" aria-label="Conversation">
            {!msgs.length && !busy && <div className="bub muted">Ask Nexora what you need, or pick a suggested prompt.</div>}
            {msgs.map(m => <div key={m.id} className={'bub ' + (m.role === 'me' ? 'me' : '')} style={{ animation: 'rise .3s both' }}>
              {m.reply ? <div className="col" style={{ gap: 8 }}><b>{m.reply.title}</b>{m.reply.lines.map((l, i) => <span key={i} className="small">• {l}</span>)}<div className="row wrap">{m.reply.actions.map(a => <Link key={a.label} className="btn sm" to={a.to}>{a.label}</Link>)}</div></div>
                : m.role === 'err' ? <div className="col" style={{ gap: 8 }} role="alert"><span>{m.text}</span>{m.retry && <div><button className="btn sm" disabled={busy} onClick={() => void send(m.retry!, true)}>Retry</button></div>}</div> : m.text}</div>)}
            {busy && <div className="bub muted" role="status">Thinking…</div>}<div ref={end} /></div>
          <form className="row" onSubmit={e => { e.preventDefault(); void send(text); }}><input className="input" aria-label="Message the assistant" placeholder="Ask Nexora…" value={text} onChange={e => setText(e.target.value)} /><button className="btn primary" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button></form>
        </div>
        <div className="col"><div className="card col"><h3 style={{ fontSize: '1em' }}>Suggested prompts</h3>{PROMPTS.map(p => <button key={p} className="chip" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => void send(p)}>{p}</button>)}</div>
          <div className="card col"><h3 style={{ fontSize: '1em' }}>This session</h3>{history.length ? history.map(h => <button key={h.id} className="item small" onClick={() => void send(h.text)}>{h.text}</button>) : <span className="muted small">No prompts yet.</span>}</div></div>
      </div>
      <Modal open={confirm} title="Clear conversation?" onClose={() => setConfirm(false)}><p>This clears the conversation shown on this page. The conversation is not saved.</p><div className="row"><button className="btn danger" onClick={() => { setMsgs([]); setConfirm(false); }}>Clear</button><button className="btn" onClick={() => setConfirm(false)}>Cancel</button></div></Modal>
    </Page>
  );
}
