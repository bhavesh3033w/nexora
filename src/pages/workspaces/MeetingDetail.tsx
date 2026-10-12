import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileUp, RefreshCw } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { meetingService } from '../../api/services';
import { Banner, Page, Skeletons } from '../../components/ui';
import { MeetingControls } from '../../features/meetings/controls';
import { ReportBadge, ReportView, StatusBadge } from '../../features/meetings/parts';
import { MAX_TRANSCRIPT_CHARS, validateFile } from '../../lib/transcript';
import type { Meeting } from '../../types';

export default function MeetingDetail() {
  const { id = '' } = useParams(); const [m, setM] = useState<Meeting | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(''); const [tErr, setTErr] = useState(''); const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { try { setM(await meetingService.get(id)); setErr(''); setNotFound(false); } catch (e) { const msg = errorMessage(e); setErr(msg); setNotFound(/not found/i.test(msg)); } finally { setLoading(false); } }, [id]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  const waiting = m?.status === 'processing' || m?.reportStatus === 'processing';
  useEffect(() => { if (!waiting) return; const t = setInterval(() => { void load(); }, 15000); return () => clearInterval(t); }, [waiting, load]);

  const run = async (key: string, f: () => Promise<unknown>) => { setBusy(key); setTErr(''); try { await f(); await load(); } catch (e) { setTErr(errorMessage(e)); await load(); } finally { setBusy(''); } };
  const onFile = async (f?: File) => { if (!f) return; const bad = validateFile(f); if (bad) { setTErr(bad); return; } setTErr(''); setText(await f.text()); };
  const submit = () => { if (text.trim().length < 40) return setTErr('Paste at least a few sentences of transcript.'); if (text.length > MAX_TRANSCRIPT_CHARS) return setTErr(`Transcript is too large (max ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`); void run('submit', async () => { await meetingService.submitTranscript(id, text); setText(''); }); };

  if (loading) return <Page title="Meeting"><Skeletons n={2} /></Page>;
  if (!m) return <Page title="Meeting"><Banner kind="error">{err || 'Meeting not found.'}</Banner><Link className="btn" to="/app/meetings"><ArrowLeft size={16} /> Back to meetings</Link>{!notFound && <button className="btn" onClick={() => { setLoading(true); void load(); }}>Retry</button>}</Page>;
  const rs = m.reportStatus ?? 'none'; const att = m.attendeeDetails?.length ? m.attendeeDetails : m.attendees.map(name => ({ name, email: '' }));
  const canRetry = rs === 'waiting_for_transcript' || rs === 'transcript_unavailable' || rs === 'failed';
  const open = m.actions.filter(a => !a.done).length;

  return (
    <Page title={m.title} sub={<>{m.client} · {m.date} at {m.time} ({m.timezone})</>} actions={<Link className="btn" to="/app/meetings"><ArrowLeft size={16} /> Meetings</Link>}>
      <div className="row wrap"><StatusBadge status={m.status} /><ReportBadge status={rs} /></div>
      <MeetingControls m={m} onChanged={load} />
      {err && <Banner kind="error">{err}</Banner>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <section className="card col" aria-label="Meeting details">
          <h2 className="h-s" style={{ fontSize: '1.1em' }}>Details</h2>
          <div><h3 className="h-s">Attendees ({att.length})</h3>{att.length ? <ul className="list" style={{ gap: 4 }}>{att.map(a => <li key={a.name + a.email}><b>{a.name}</b><span className="muted small">{a.email || 'no email on file'}</span></li>)}</ul> : <span className="muted small">No attendees.</span>}</div>
          <div><h3 className="h-s">Agenda</h3><pre className="pre">{m.agenda || 'No agenda.'}</pre></div>
          {m.notes && <div><h3 className="h-s">Notes</h3><pre className="pre">{m.notes}</pre></div>}
          <div><h3 className="h-s">Google Meet artifacts</h3>
            <ul className="list" style={{ gap: 4 }}>
              <li><span className="muted small">Meet link</span>{m.meetUrl ? <a href={m.meetUrl} target="_blank" rel="noopener noreferrer">{m.meetUrl}</a> : <span className="muted">None</span>}</li>
              <li><span className="muted small">Calendar event</span>{m.calendarUrl ? <a href={m.calendarUrl} target="_blank" rel="noopener noreferrer">Open in Google Calendar</a> : <span className="muted">{m.googleEventId ? m.googleEventId : 'None'}</span>}</li>
              <li><span className="muted small">Transcript</span><span>{m.transcriptAvailable ? 'Available from Google Meet' : rs === 'ready' ? 'Processed' : rs === 'waiting_for_transcript' ? 'Waiting for transcript' : 'Not available'}</span></li>
              {m.endedAt && <li><span className="muted small">Ended</span><span>{new Date(m.endedAt).toLocaleString()}</span></li>}
              {m.processedAt && <li><span className="muted small">Report generated</span><span>{new Date(m.processedAt).toLocaleString()}</span></li>}
            </ul></div>
        </section>
        <section className="card col" aria-label="AI meeting report">
          <div className="row between wrap"><h2 style={{ fontSize: '1.1em' }}>Meeting report</h2><ReportBadge status={rs} /></div>
          {m.report ? <ReportView m={m} onToggle={(itemId, done) => run('ai', () => meetingService.setActionItem(m.id, itemId, done))} /> : (
            <div className="col">
              {rs === 'waiting_for_transcript' && <Banner kind="info">Waiting for transcript. Google can take several minutes after the meeting ends, and transcripts exist only if transcription was turned on during the meeting. No summary has been generated.</Banner>}
              {rs === 'processing' && <Banner kind="info">Generating the report… this page refreshes automatically.</Banner>}
              {rs === 'transcript_unavailable' && <Banner kind="error">Transcript unavailable. {m.reportError ?? 'Google returned no transcript for this meeting.'} You can paste or upload one below. No summary has been generated.</Banner>}
              {rs === 'failed' && <Banner kind="error">Report generation failed. {m.reportError ?? ''}</Banner>}
              {rs === 'none' && <span className="muted">No report yet. After the meeting ends, Nexora looks for a Google Meet transcript — or you can supply one below. Nothing is summarised unless a transcript exists.</span>}
              {canRetry && <div><button className="btn sm" disabled={!!busy} onClick={() => run('retry', () => meetingService.processTranscript(m.id))}><RefreshCw size={14} /> {busy === 'retry' ? 'Checking…' : 'Retry transcript processing'}</button></div>}
            </div>)}
          {m.status === 'in_progress' && <span className="muted small">Mark the meeting as ended to start report processing.</span>}
        </section>
      </div>
      <section className="card col" aria-label="Manual transcript">
        <h2 style={{ fontSize: '1.1em' }}>Manual transcript (fallback)</h2>
        <span className="muted small">Paste text or upload .txt, .vtt, .srt or .md (max 1 MB). Only share transcripts you are permitted to process; all participants should have consented to recording/transcription.</span>
        <textarea aria-label="Transcript text" rows={7} value={text} placeholder="Paste the meeting transcript here…" onChange={e => setText(e.target.value)} />
        <div className="row wrap"><input ref={file} type="file" hidden accept=".txt,.vtt,.srt,.md,text/plain" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn" onClick={() => file.current?.click()}><FileUp size={16} /> Upload file</button>
          <button className="btn primary" disabled={!!busy || !text.trim()} onClick={submit}>{busy === 'submit' ? 'Analysing…' : m.report ? 'Re-generate report from this transcript' : 'Generate report'}</button>
          <span className="muted small">{text.length.toLocaleString()} characters</span></div>
        {tErr && <Banner kind="error">{tErr}</Banner>}
      </section>
      {m.report && <span className="muted small">{open} open action item{open === 1 ? '' : 's'} on this meeting.</span>}
    </Page>
  );
}
