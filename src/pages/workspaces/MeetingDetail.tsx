import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, FileUp, FileVideo, ListChecks, RefreshCw, Search, UploadCloud } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { meetingService } from '../../api/services';
import { Banner, Page, Progress, Skeletons } from '../../components/ui';
import { MeetingControls } from '../../features/meetings/controls';
import { ReportBadge, ReportView, StatusBadge, useCopy } from '../../features/meetings/parts';
import { MAX_TRANSCRIPT_CHARS, RECORDING_EXT, formatBytes, validateFile, validateRecording } from '../../lib/transcript';
import type { Meeting, TranscriptEntry } from '../../types';

export default function MeetingDetail() {
  const { id = '' } = useParams(); const [m, setM] = useState<Meeting | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(''); const [tErr, setTErr] = useState(''); const file = useRef<HTMLInputElement>(null);
  const recInput = useRef<HTMLInputElement>(null); const [rec, setRec] = useState<File | null>(null); const [pct, setPct] = useState(0); const [rErr, setRErr] = useState(''); const [drag, setDrag] = useState(false);
  const load = useCallback(async () => { try { setM(await meetingService.get(id)); setErr(''); setNotFound(false); } catch (e) { const msg = errorMessage(e); setErr(msg); setNotFound(/not found/i.test(msg)); } finally { setLoading(false); } }, [id]);
  useEffect(() => { setLoading(true); void load(); }, [load]);
  const waiting = m?.status === 'processing' || m?.reportStatus === 'processing';
  useEffect(() => { if (!waiting) return; const t = setInterval(() => { void load(); }, 15000); return () => clearInterval(t); }, [waiting, load]);

  const run = async (key: string, f: () => Promise<unknown>) => { setBusy(key); setTErr(''); try { await f(); await load(); } catch (e) { setTErr(errorMessage(e)); await load(); } finally { setBusy(''); } };
  const onFile = async (f?: File) => { if (!f) return; const bad = validateFile(f); if (bad) { setTErr(bad); return; } setTErr(''); setText(await f.text()); };
  const pickRec = (f?: File) => { if (!f) return; const bad = validateRecording(f); setRErr(bad ?? ''); setRec(bad ? null : f); setPct(0); };
  const uploadRec = async () => { if (!rec) return; setBusy('rec'); setRErr(''); setPct(0); try { await meetingService.uploadRecording(id, rec, p => setPct(p)); setRec(null); await load(); } catch (e) { setRErr(errorMessage(e)); await load(); } finally { setBusy(''); } };
  const submit = () => { if (text.trim().length < 40) return setTErr('Paste at least a few sentences of transcript.'); if (text.length > MAX_TRANSCRIPT_CHARS) return setTErr(`Transcript is too large (max ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`); void run('submit', async () => { await meetingService.submitTranscript(id, text); setText(''); }); };

  if (loading) return <Page title="Meeting"><Skeletons n={2} /></Page>;
  if (!m) return <Page title="Meeting"><Banner kind="error">{err || 'Meeting not found.'}</Banner><Link className="btn" to="/app/meetings"><ArrowLeft size={16} /> Back to meetings</Link>{!notFound && <button className="btn" onClick={() => { setLoading(true); void load(); }}>Retry</button>}</Page>;
  const rs = m.reportStatus ?? 'none'; const att = m.attendeeDetails?.length ? m.attendeeDetails : m.attendees.map(name => ({ name, email: '' }));
  const canRetry = rs === 'waiting_for_transcript' || rs === 'transcript_unavailable' || rs === 'failed';
  const open = m.actions.filter(a => !a.done).length; const transcribing = rs === 'processing' && !!m.recordingName;

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
          <div className="row between wrap"><h2 style={{ fontSize: '1.1em' }}>Meeting report</h2><span className="row wrap">{m.report && <Link className="btn sm" to="/app/tracker"><ListChecks size={14} /> Open Action Tracker</Link>}<ReportBadge status={rs} /></span></div>
          {m.report && rs === 'processing' && <Banner kind="info">Regenerating the report… this page refreshes automatically.</Banner>}
          {m.report ? <ReportView m={m} busy={!!busy} onToggle={(itemId, done) => run('ai', () => meetingService.setActionItem(m.id, itemId, done))} onStatus={(itemId, st) => run('ai', () => meetingService.setActionStatus(m.id, itemId, st))} /> : (
            <div className="col">
              {rs === 'waiting_for_transcript' && <Banner kind="info">Waiting for transcript. Google can take several minutes after the meeting ends, and transcripts exist only if transcription was turned on during the meeting. No summary has been generated.</Banner>}
              {rs === 'processing' && !transcribing && <Banner kind="info">Generating the report… this page refreshes automatically.</Banner>}
              {rs === 'transcript_unavailable' && <Banner kind="error">Transcript unavailable. {m.reportError ?? 'Google returned no transcript for this meeting.'} You can paste or upload one below. No summary has been generated.</Banner>}
              {rs === 'failed' && <Banner kind="error">Report generation failed. {m.reportError ?? ''}</Banner>}
              {rs === 'none' && <span className="muted">No report yet. After the meeting ends, Nexora looks for a Google Meet transcript — or you can supply one below. Nothing is summarised unless a transcript exists.</span>}
              {canRetry && <div><button className="btn sm" disabled={!!busy} onClick={() => run('retry', () => meetingService.processTranscript(m.id))}><RefreshCw size={14} /> {busy === 'retry' ? 'Checking…' : 'Retry transcript processing'}</button></div>}
            </div>)}
          {m.status === 'in_progress' && <span className="muted small">Mark the meeting as ended to start report processing.</span>}
        </section>
      </div>
      <section className="card col" aria-label="Upload meeting recording">
        <h2 style={{ fontSize: '1.1em' }}>Upload meeting recording</h2>
        <span className="muted small">Upload the Google Meet recording (.mp4 from Drive › Meet Recordings) or an audio file. Nexora transcribes it, writes the summary and turns action points into tracked tasks.</span>
        {m.recordingName && <span className="small rec-current"><FileVideo size={14} aria-hidden /> Last recording: <b>{m.recordingName}</b></span>}
        {transcribing && <Banner kind="info">Transcribing recording… this can take a few minutes for long meetings. This page refreshes automatically.</Banner>}
        <input ref={recInput} type="file" hidden accept={RECORDING_EXT.join(',') + ',video/*,audio/*'} onChange={e => { pickRec(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className={'rec-drop' + (drag ? ' on' : '')} disabled={busy === 'rec'} onClick={() => recInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); pickRec(e.dataTransfer.files?.[0]); }}>
          <UploadCloud size={22} aria-hidden />{rec ? <span><b>{rec.name}</b> <span className="muted">· {formatBytes(rec.size)}</span></span> : <span>Drop a recording here or <u>choose a file</u></span>}
          <span className="muted small">{RECORDING_EXT.join(' ')} · max 500 MB</span></button>
        {busy === 'rec' && <div className="col" style={{ gap: 4 }}><Progress value={pct} label="Upload progress" /><span className="muted small">{pct < 100 ? `Uploading… ${Math.round(pct)}%` : 'Upload complete — starting transcription…'}</span></div>}
        <div className="row wrap"><button className="btn primary" disabled={!!busy || !rec || transcribing} onClick={() => void uploadRec()}><UploadCloud size={16} /> {busy === 'rec' ? 'Uploading…' : 'Transcribe & generate report'}</button>
          {rec && busy !== 'rec' && <button className="btn" onClick={() => setRec(null)}>Clear</button>}</div>
        <span className="muted small">Only upload recordings you are permitted to process; all participants should have consented to recording/transcription.</span>
        {rErr && <Banner kind="error">{rErr}</Banner>}
      </section>
      {!!m.transcript?.length && <TranscriptView entries={m.transcript} />}
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

function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const [q, setQ] = useState(''); const { done, copy } = useCopy();
  const hits = useMemo(() => { const t = q.trim().toLowerCase(); return t ? entries.filter(e => (e.speaker + ' ' + e.text).toLowerCase().includes(t)) : entries; }, [entries, q]);
  const all = entries.map(e => `${e.timestamp ? `[${e.timestamp}] ` : ''}${e.speaker}: ${e.text}`).join('\n');
  return (
    <details className="card rec-transcript">
      <summary><h2 style={{ fontSize: '1.1em', display: 'inline' }}>Transcript</h2> <span className="muted small">{entries.length} line{entries.length === 1 ? '' : 's'}</span></summary>
      <div className="row wrap" style={{ marginTop: 10 }}><Search size={16} aria-hidden /><input className="input" style={{ flex: 1, minWidth: 160 }} aria-label="Search transcript" placeholder="Filter by speaker or text" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn sm" onClick={() => copy(all, 'tr')}><Copy size={14} /> {done === 'tr' ? 'Copied' : 'Copy all'}</button></div>
      {done === 'fail' && <Banner kind="error">Clipboard is unavailable in this browser.</Banner>}
      {q && <span className="muted small">{hits.length} of {entries.length} lines match.</span>}
      <ol className="rec-lines">{hits.map((e, i) => <li key={i}><span className="rec-ts">{e.timestamp ?? ''}</span><b className="rec-spk">{e.speaker || 'Unknown'}</b><span className="rec-txt">{e.text}</span></li>)}</ol>
      {!hits.length && <span className="muted small">No lines match “{q}”.</span>}
    </details>
  );
}
