import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Video } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { meetingService } from '../../api/services';
import { Banner } from '../../components/ui';
import type { Meeting } from '../../types';
import { useCopy } from './parts';

/** Start Meeting / copy invite link / mark ended. Never claims a Meet link exists when the backend did not return one. */
export function MeetingControls({ m, onChanged }: { m: Meeting; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [info, setInfo] = useState<{ url?: string } | null>(null);
  const { done, copy } = useCopy();
  const url = m.meetUrl ?? info?.url;
  const canStart = m.status === 'scheduled' || m.status === 'in_progress' || m.status === 'draft';
  const run = async (key: string, f: () => Promise<void>) => { setBusy(key); setErr(''); try { await f(); await onChanged(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(''); } };
  const start = () => run('start', async () => {
    if (m.status === 'draft' && !m.meetUrl) throw new Error('This meeting is a draft with no Google event. Schedule it on Google Calendar first.');
    const r = await meetingService.start(m.id); setInfo({ url: r.meetUrl });
    if (r.meetUrl) { const w = window.open(r.meetUrl, '_blank', 'noopener,noreferrer'); if (!w) setErr('Your browser blocked the pop-up. Use the “Open Meet” link below.'); }
  });
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap">
        <button className="btn start" disabled={!canStart || !!busy} onClick={start}><Video size={18} /> {busy === 'start' ? 'Starting…' : m.status === 'in_progress' ? 'Rejoin Meeting' : 'Start Meeting'}</button>
        <button className="btn" disabled={!url} title={url ? '' : 'No Google Meet link yet'} onClick={() => url && copy(url, 'link')}><Copy size={16} /> {done === 'link' ? 'Copied' : 'Copy invitation link'}</button>
        {url && <a className="btn" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open Meet</a>}
        {m.status === 'in_progress' && <button className="btn" disabled={!!busy} onClick={() => run('end', async () => { await meetingService.complete(m.id); })}><CheckCircle2 size={16} /> {busy === 'end' ? 'Saving…' : 'Mark meeting ended'}</button>}
      </div>
      {info && !url && <Banner kind="error">The server did not return a Google Meet link for this meeting, so nothing was opened.</Banner>}
      {!url && !info && m.status !== 'draft' && <span className="muted small">No Meet link is stored for this meeting.</span>}
      {done === 'fail' && <Banner kind="error">Clipboard is unavailable in this browser.</Banner>}
      {err && <Banner kind="error">{err}</Banner>}
    </div>
  );
}
