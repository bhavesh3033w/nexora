import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banner, Modal, Page } from '../components/ui';
import { OptionGroup, MiniPreview } from './Onboarding';
import { DEFAULTS, usePrefs } from '../features/personalization/PrefsContext';
import { QUESTIONS, STEPS } from '../features/personalization/questions';
import type { Prefs } from '../types';

export default function Settings() {
  const { prefs, update, reset } = usePrefs(); const nav = useNavigate();
  const [draft, setDraft] = useState<Prefs>(prefs); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [confirm, setConfirm] = useState(false);
  useEffect(() => setDraft(prefs), [prefs]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const save = async () => setMsg((await update(draft)) ? { k: 'ok', t: 'Preferences saved and applied.' } : { k: 'error', t: 'Saving failed — your changes were not applied.' });
  return (
    <Page title="Settings" sub="Personalization applies across your whole workspace" actions={<>
      <Link className="btn" to="/onboarding?redo=1">Rerun personalization wizard</Link>
      <button className="btn" disabled={!dirty} onClick={() => { setDraft(prefs); setMsg(null); }}>Cancel</button>
      <button className="btn" onClick={() => setDraft({ ...DEFAULTS, onboarded: true, order: DEFAULTS.order })}>Restore Defaults</button>
      <button className="btn primary" disabled={!dirty} onClick={save}>Save Changes</button></>}>
      {msg && <Banner kind={msg.k}>{msg.t}</Banner>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', alignItems: 'start' }}>
        <div className="col" style={{ gridColumn: 'span 2' }}>{STEPS.map((s, si) => <section key={s} className="card col" aria-label={s}><h2 style={{ fontSize: '1.15em' }}>{s}</h2>
          {QUESTIONS.filter(q => q.step === si + 1).map(q => <div key={q.n} className="col" style={{ gap: 8 }}><b className="small">{q.title}{q.optional && <span className="muted"> (optional)</span>}</b>
            <OptionGroup q={q} value={draft[q.key]} onChange={v => { setMsg(null); setDraft({ ...draft, [q.key]: v } as Prefs); }} /></div>)}</section>)}</div>
        <div className="col" style={{ position: 'sticky', top: 12 }}><MiniPreview p={draft} />
          <div className="card col"><h3 style={{ fontSize: '1em' }}>Reset</h3><button className="btn danger" onClick={() => setConfirm(true)}>Reset preferences</button></div></div>
      </div>
      <Modal open={confirm} title="Reset preferences?" onClose={() => setConfirm(false)}>
        <p>This restores defaults on the server and re-opens the personalization wizard.</p>
        <div className="row"><button className="btn danger" onClick={async () => { const ok = await reset(); setConfirm(false); if (ok) nav('/onboarding'); }}>Yes, reset</button><button className="btn" onClick={() => setConfirm(false)}>Cancel</button></div>
      </Modal>
    </Page>
  );
}
