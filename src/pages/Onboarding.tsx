import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banner, Progress } from '../components/ui';
import { QUESTIONS, COLOR_HEX, WIDGET_LABEL } from '../features/personalization/questions';
import { attrsFor, DEFAULTS, usePrefs } from '../features/personalization/PrefsContext';
import type { Prefs } from '../types';

export function OptionGroup({ q, value, onChange }: { q: typeof QUESTIONS[number]; value: unknown; onChange: (v: unknown) => void }) {
  const cur = q.multi ? (value as string[]) : (value as string);
  const toggle = (v: string) => { const a = cur as string[]; onChange(a.includes(v) ? a.filter(x => x !== v) : [...a, v]); };
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr" style={{ position: 'absolute', left: -999 }}>{q.title}</legend>
      <div className="opts stagger">{q.options.map(o => (
        <label key={o.v} className="opt">
          <input type={q.multi ? 'checkbox' : 'radio'} name={'q' + q.n} checked={q.multi ? (cur as string[]).includes(o.v) : cur === o.v} onChange={() => q.multi ? toggle(o.v) : onChange(o.v)} />
          {q.key === 'color' && <span className="sw" style={{ background: COLOR_HEX[o.v] }} />}<span>{o.l}</span></label>))}</div>
    </fieldset>
  );
}
export function MiniPreview({ p }: { p: Prefs }) {
  return (
    <div className="mini scope card" {...attrsFor(p)} aria-label="Live dashboard preview" role="img">
      <div className="row between"><b>Good morning</b><span className="tag pri">Preview</span></div><div className="mb" style={{ width: '60%' }} />
      <div className="grid g2" style={{ gap: 8 }}>{(p.widgets.length ? p.widgets : []).slice(0, 4).map(w => <div key={w} className="card" style={{ padding: 10 }}><b className="small">{WIDGET_LABEL[w]}</b><div className="bar" style={{ marginTop: 6 }}><i style={{ transform: 'scaleX(.6)' }} /></div></div>)}
        {!p.widgets.length && <span className="muted small">No widgets selected</span>}</div>
      <div className="row"><button className="btn primary sm" tabIndex={-1}>Primary action</button><span className="muted small">Nav: {p.nav} · {p.layout}</span></div>
    </div>
  );
}

/** Waits for the saved preferences so a re-run of the wizard starts from the real saved values. */
export default function Onboarding() {
  const { loaded, loadError, retry } = usePrefs();
  if (!loaded) return <div className="center-screen" role="status">Loading…</div>;
  if (loadError) return <div className="center-screen"><div className="col" style={{ maxWidth: 460, textAlign: 'center' }}><Banner kind="error">Could not load your preferences. {loadError}</Banner><div><button className="btn primary" onClick={retry}>Retry</button></div></div></div>;
  return <Wizard />;
}

function Wizard() {
  const { prefs, update } = usePrefs(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [draft, setDraft] = useState<Prefs>(sp.get('redo') ? prefs : { ...DEFAULTS, ...prefs, onboarded: false });
  const [i, setI] = useState(0); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const total = QUESTIONS.length; const review = i === total; const q = QUESTIONS[i];
  const valid = review || q.optional || (q.multi ? (draft[q.key] as string[]).length > 0 : !!draft[q.key]);
  const next = () => { if (!valid) { setErr('Please choose at least one option to continue.'); return; } setErr(''); setI(i + 1); };
  const launch = async () => { setSaving(true); const ok = await update({ ...draft, onboarded: true }); setSaving(false); if (ok) nav('/app', { replace: true }); else setErr('Could not save preferences. Please try again.'); };
  const step = review ? 3 : q.step;
  return (
    <div className="scope" style={{ minHeight: '100vh', padding: 'clamp(14px,3vw,40px)' }}><div className="col" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div className="row between wrap"><b>Nexora · Personalize your workspace</b>{!sp.get('redo') && <span className="muted small">You can change everything later in Settings</span>}</div>
      <div><div className="row between small muted"><span>{review ? 'Final review' : `Step ${step} of 3 — ${q.section}`}</span><span>{review ? 'Done' : `Question ${q.n} of ${total}`}</span></div><Progress value={(i / total) * 100} label="Wizard progress" /></div>
      <div className="wiz">
        <div className="card col" key={i} style={{ animation: 'rise .35s both' }}>
          {!review ? (<>
            <h1 style={{ fontSize: '1.45em' }} id="qt">{q.n}. {q.title}</h1>{q.optional && <span className="tag ok" style={{ width: 'fit-content' }}>Optional</span>}
            {q.key === 'notifications' && <span className="muted small">Desktop and email delivery are listed for preference only — they are not available yet.</span>}
            <OptionGroup q={q} value={draft[q.key]} onChange={v => { setErr(''); setDraft({ ...draft, [q.key]: v } as Prefs); }} />
          </>) : (<>
            <h1 style={{ fontSize: '1.45em' }}>Review your choices</h1>
            <ul className="list">{QUESTIONS.map(x => { const v = draft[x.key]; const lbl = (s: string) => x.options.find(o => o.v === s)?.l ?? s; return (
              <li key={x.n} className="between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, alignItems: 'flex-start' }}><span className="muted small" style={{ flex: 1 }}>{x.n}. {x.title}</span>
                <b className="small" style={{ flex: 1, textAlign: 'right' }}>{Array.isArray(v) ? (v.length ? v.map(lbl).join(', ') : 'None') : v ? lbl(v as string) : 'Skipped'}</b></li>); })}</ul>
          </>)}
          {err && <Banner kind="error">{err}</Banner>}
          <div className="row between wrap">
            <button className="btn" disabled={i === 0} onClick={() => { setErr(''); setI(i - 1); }}>Previous</button>
            <div className="row">{!review && q.optional && <button className="btn ghost" onClick={() => { setDraft({ ...draft, [q.key]: q.key === 'adaptive' ? 'ask' : '' } as Prefs); setI(i + 1); }}>Skip</button>}
              {review ? <button className="btn primary" disabled={saving} onClick={launch}>{saving ? 'Launching…' : 'Launch My Workspace'}</button> : <button className="btn primary" onClick={next}>Continue</button>}</div>
          </div>
        </div>
        <div className="col"><MiniPreview p={draft} /><span className="muted small">The preview updates live as you choose a theme, color, style, text size and spacing.</span></div>
      </div>
    </div></div>
  );
}
