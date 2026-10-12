import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Plus } from 'lucide-react';
import { errorMessage } from '../../api/client';
import { clientService, googleService, meetingService } from '../../api/services';
import { Banner, Empty, ErrorState, Modal, Page, Skeletons } from '../../components/ui';
import { MeetingControls } from '../../features/meetings/controls';
import { AttendeePicker, isEmail, ReportBadge, StatusBadge } from '../../features/meetings/parts';
import { isPast, useGoogle, useMeetings, whenOf } from '../../features/meetings/useMeetings';
import { uid } from '../../lib/storage';
import type { Attendee, Client, Meeting, MeetingInput } from '../../types';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZS = Array.from(new Set([LOCAL_TZ, 'UTC', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney']));
interface Form extends MeetingInput { id?: string }
const blank = (): Form => ({ title: '', client: '', date: new Date().toLocaleDateString('en-CA'), time: '09:00', timezone: LOCAL_TZ, agenda: '', notes: '', attendees: [], createGoogleEvent: true });

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = 'Title is required.'; else if (f.title.length > 120) e.title = 'Title must be 120 characters or fewer.';
  if (!f.date) e.date = 'Date is required.'; if (!f.time) e.time = 'Time is required.';
  if (f.date && f.time && !f.id && f.createGoogleEvent && f.date < new Date().toLocaleDateString('en-CA')) e.date = 'Choose today or a future date to create a Google Calendar event.';
  if (f.attendees.some(a => a.email && !isEmail(a.email))) e.attendees = 'One or more attendee emails are invalid.';
  if (f.agenda.length > 5000) e.agenda = 'Agenda is too long (5000 characters max).';
  return e;
}

export default function Meetings() {
  const { meetings, loading, error, refresh } = useMeetings(); const google = useGoogle();
  const [clients, setClients] = useState<Client[]>([]); const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming'); const [sel, setSel] = useState('');
  const [form, setForm] = useState<Form | null>(null); const [errs, setErrs] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false); const [formErr, setFormErr] = useState('');
  const [att, setAtt] = useState(''); const [ci, setCi] = useState(''); const [gBusy, setGBusy] = useState(false); const [gErr, setGErr] = useState('');
  useEffect(() => { clientService.list().then(setClients).catch(e => setGErr(errorMessage(e))); }, []);

  const sorted = useMemo(() => [...meetings].sort((a, b) => whenOf(a).localeCompare(whenOf(b))), [meetings]);
  const upcoming = sorted.filter(m => !isPast(m)); const past = sorted.filter(isPast).reverse();
  const shown = tab === 'upcoming' ? upcoming : past;
  const m = meetings.find(x => x.id === sel) ?? shown[0];
  const gp = params.get('google');
  const patchM = async (p: Partial<Meeting>) => { if (!m) return; try { await meetingService.update(m.id, p); await refresh(); } catch (e) { setGErr(errorMessage(e)); } };

  const submit = async () => {
    if (!form) return; const e = validate(form); setErrs(e); if (Object.keys(e).length) return;
    setSaving(true); setFormErr('');
    try {
      const client = form.client.trim() || (clients.find(c => c.id === form.attendees.find(a => a.clientId)?.clientId)?.company ?? 'Internal');
      if (form.id) await meetingService.update(form.id, { title: form.title.trim(), client, date: form.date, time: form.time, timezone: form.timezone, agenda: form.agenda, notes: form.notes, attendeeDetails: form.attendees });
      else { const created = await meetingService.create({ ...form, title: form.title.trim(), client }); setSel(created.id); setTab('upcoming'); }
      await refresh(); setForm(null);
    } catch (x) { setFormErr(errorMessage(x)); } finally { setSaving(false); }
  };
  const connect = async () => { setGBusy(true); setGErr(''); try { await googleService.connect(); await google.refresh(); } catch (e) { setGErr(errorMessage(e)); } finally { setGBusy(false); } };
  const gs = google.status;

  return (
    <Page title="Meeting Workspace" sub="Schedule, invite clients, run Google Meet and get AI meeting reports"
      actions={<><Link className="btn" to="/app/meetings/insights"><BarChart3 size={16} /> Meeting insights</Link><button className="btn primary" onClick={() => { setErrs({}); setFormErr(''); setForm({ ...blank(), createGoogleEvent: !!gs?.connected }); }}><Plus size={16} /> New meeting</button></>}>
      {gp === 'connected' && <Banner kind="ok">Google account connected. <button className="btn sm ghost" onClick={() => setParams({})}>Dismiss</button></Banner>}
      {gp === 'error' && <Banner kind="error">Google connection failed{params.get('code') ? ` (${params.get('code')})` : ''}. Please try again. <button className="btn sm ghost" onClick={() => setParams({})}>Dismiss</button></Banner>}
      {!gs ? (google.error ? <ErrorState message={`Could not check the Google connection. ${google.error}`} onRetry={() => void google.refresh()} /> : <div className="skeleton" style={{ minHeight: 48 }} aria-label="Checking Google connection" />) :
        !gs.configured ? <Banner kind="error">Google integration is not configured on the server (OAuth client ID/secret missing). Meetings can be saved as drafts, but no Meet links can be created.</Banner> :
          gs.connected ? <Banner kind="ok"><span className="row between wrap"><span>Google connected{gs.email ? <> as <b>{gs.email}</b></> : ''}{gs.transcriptAccess === false && <> · Transcript access not granted — reports will need a manual transcript.</>}</span>
            <button className="btn sm" onClick={async () => { try { await googleService.disconnect(); await google.refresh(); } catch (e) { setGErr(errorMessage(e)); } }}>Disconnect</button></span></Banner> :
            <Banner kind="info"><span className="row between wrap"><span>Connect your Google account to create calendar events with real Google Meet links and invite clients.</span>
              <button className="btn sm primary" disabled={gBusy} onClick={connect}>{gBusy ? 'Connecting…' : 'Connect Google'}</button></span></Banner>}
      {gErr && <Banner kind="error">{gErr}</Banner>}
      {error && <Banner kind="error">{error} <button className="btn sm" onClick={() => void refresh()}>Retry</button></Banner>}

      {loading ? <Skeletons n={3} /> : <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', alignItems: 'start' }}>
        <div className="col">
          <div className="tabs" role="tablist" aria-label="Meeting lists">{(['upcoming', 'past'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); setSel(''); }}>{t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}</button>)}</div>
          <div className="col" role="list" aria-label="Meetings">{shown.map(x => <button key={x.id} role="listitem" className={'item' + (x.id === m?.id ? ' sel' : '')} onClick={() => setSel(x.id)}>
            <div className="row between"><b>{x.title}</b><StatusBadge status={x.status} /></div><div className="muted small">{x.date} · {x.time} · {x.attendees.length} attendees</div></button>)}
            {!shown.length && <Empty title={tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}>{tab === 'upcoming' ? 'Create one with “New meeting”.' : 'Completed meetings appear here.'}</Empty>}</div>
        </div>
        {m ? <div className="card col" style={{ gridColumn: 'span 2' }}>
          <div className="row between wrap"><h2 style={{ fontSize: '1.3em' }}>{m.title}</h2><span className="row wrap"><StatusBadge status={m.status} /><ReportBadge status={m.reportStatus} /><Link className="btn sm" to={`/app/meetings/${m.id}`}>Full details & report</Link>
            <button className="btn sm" onClick={() => { setErrs({}); setFormErr(''); setForm({ id: m.id, title: m.title, client: m.client === 'Internal' ? '' : m.client, date: m.date, time: m.time, timezone: m.timezone ?? LOCAL_TZ, agenda: m.agenda, notes: m.notes, attendees: m.attendeeDetails ?? [], createGoogleEvent: false }); }}>Edit details</button></span></div>
          <div className="muted">{m.client} · {m.date} at {m.time} ({m.timezone})</div>
          <MeetingControls m={m} onChanged={refresh} />
          {m.status === 'draft' && <Banner kind="info"><span className="row between wrap"><span>Draft — no Google Calendar event yet, so attendees have not been invited.</span>
            <button className="btn sm primary" disabled={!gs?.connected} title={gs?.connected ? '' : 'Connect Google first'} onClick={async () => { try { await meetingService.schedule(m.id); await refresh(); } catch (e) { setGErr(errorMessage(e)); } }}>Schedule on Google Calendar</button></span></Banner>}
          <div className="row wrap">{(m.attendeeDetails?.length ? m.attendeeDetails : m.attendees.map(name => ({ name, email: '' }))).map(a => <span key={a.name + a.email} className="chip" style={{ cursor: 'default' }} title={a.email}>{a.name}{a.email && <span className="muted small">{a.email}</span>}
            <button className="icon-btn" style={{ padding: 0 }} aria-label={`Remove ${a.name}`} onClick={() => patchM({ attendeeDetails: (m.attendeeDetails ?? []).filter(x => x !== a), attendees: m.attendees.filter(x => x !== a.name) })}>×</button></span>)}
            <form className="row" onSubmit={e => { e.preventDefault(); const v = att.trim(); if (!v) return; const a: Attendee = isEmail(v) ? { name: v.split('@')[0], email: v } : { name: v, email: '' }; void patchM({ attendeeDetails: [...(m.attendeeDetails ?? []), a] }); setAtt(''); }}>
              <input className="input" style={{ width: 190, minHeight: 32 }} aria-label="Add attendee" placeholder="Name or email" value={att} onChange={e => setAtt(e.target.value)} /><button className="btn sm">Add</button></form></div>
          <label className="f">Agenda<textarea key={m.id + 'a'} defaultValue={m.agenda} onBlur={e => e.target.value !== m.agenda && patchM({ agenda: e.target.value })} /></label>
          <label className="f">Notes<textarea key={m.id + 'n'} defaultValue={m.notes} onBlur={e => e.target.value !== m.notes && patchM({ notes: e.target.value })} /></label>
          <div className="grid g2">
            <div><h3 style={{ fontSize: '1em' }}>Preparation checklist</h3><ul className="list">{m.checklist.map(c => <li key={c.id}><input className="check" id={c.id} type="checkbox" checked={c.done} onChange={() => patchM({ checklist: m.checklist.map(x => x.id === c.id ? { ...x, done: !x.done } : x) })} /><label htmlFor={c.id} className={c.done ? 'done' : ''}>{c.text}</label></li>)}</ul>
              <form className="row" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (ci.trim()) { void patchM({ checklist: [...m.checklist, { id: uid(), text: ci.trim(), done: false }] }); setCi(''); } }}><input className="input" aria-label="New checklist item" placeholder="Add checklist item" value={ci} onChange={e => setCi(e.target.value)} /><button className="btn sm">Add</button></form></div>
            <div><h3 style={{ fontSize: '1em' }}>Action items</h3><ul className="list">{m.actions.map(c => <li key={c.id}><input className="check" id={c.id} type="checkbox" checked={c.done} onChange={async () => { try { if (m.report?.actionItems.some(r => r.id === c.id)) await meetingService.setActionItem(m.id, c.id, !c.done); else await meetingService.update(m.id, { actions: m.actions.map(x => x.id === c.id ? { ...x, done: !x.done } : x) }); await refresh(); } catch (e) { setGErr(errorMessage(e)); } }} /><label htmlFor={c.id} className={c.done ? 'done' : ''}>{c.text}</label></li>)}{!m.actions.length && <li className="muted">No action items</li>}</ul></div>
          </div>
        </div> : <Empty title="No meeting selected">Pick a meeting or create a new one.</Empty>}
      </div>}

      <Modal open={!!form} wide title={form?.id ? 'Edit meeting' : 'New meeting'} onClose={() => setForm(null)}>
        {form && <div className="col">
          <label className="f">Title<input className="input" value={form.title} maxLength={140} aria-invalid={!!errs.title} onChange={e => setForm({ ...form, title: e.target.value })} />{errs.title && <span className="err-text" role="alert">{errs.title}</span>}</label>
          <label className="f">Client / company (optional)<input className="input" value={form.client} placeholder="Derived from selected clients, or Internal" onChange={e => setForm({ ...form, client: e.target.value })} /></label>
          <div className="row wrap"><label className="f grow">Date<input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />{errs.date && <span className="err-text" role="alert">{errs.date}</span>}</label>
            <label className="f grow">Time<input className="input" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />{errs.time && <span className="err-text" role="alert">{errs.time}</span>}</label>
            <label className="f grow">Timezone<select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>{TZS.map(z => <option key={z}>{z}</option>)}</select></label></div>
          <div className="f">Attendees<AttendeePicker clients={clients} value={form.attendees} onChange={a => setForm({ ...form, attendees: a })} />{errs.attendees && <span className="err-text" role="alert">{errs.attendees}</span>}</div>
          <label className="f">Agenda<textarea value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} />{errs.agenda && <span className="err-text" role="alert">{errs.agenda}</span>}</label>
          <label className="f">Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          {!form.id && <label className="row"><input className="check" type="checkbox" checked={form.createGoogleEvent && !!gs?.connected} disabled={!gs?.connected} onChange={e => setForm({ ...form, createGoogleEvent: e.target.checked })} />
            <span>Create a Google Calendar event with a Google Meet link and email invitations to attendees{!gs?.connected && <span className="muted small"> — connect Google to enable (saved as Draft otherwise)</span>}</span></label>}
          {formErr && <Banner kind="error">{formErr}</Banner>}
          <div className="row"><button className="btn primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create meeting'}</button><button className="btn" onClick={() => setForm(null)}>Cancel</button></div>
        </div>}
      </Modal>
    </Page>
  );
}
