import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Bot, CalendarDays, GraduationCap, KanbanSquare, Menu, MessagesSquare, ShieldCheck, Sparkles, X, type LucideIcon } from 'lucide-react';
import Tilt from '../components/Tilt';
import HeroVideo from '../components/HeroVideo';
import BrandIntro from '../components/BrandIntro';
import NexoraMark from '../components/NexoraMark';
import { classifyIntent, FOCUS_LABEL } from '../features/adaptive/engine';
import { COLOR_HEX } from '../features/personalization/questions';

interface Card { icon: LucideIcon; title: string; rows: string[]; chip: string }
const CARDS: Card[] = [
  { icon: CalendarDays, title: 'Meetings', rows: ['Schedule and start Google Meet', 'Reports from meeting transcripts'], chip: 'Prep checklist' },
  { icon: MessagesSquare, title: 'Communication', rows: ['Inbox and follow-ups', 'Priority messages first'], chip: 'Inbox' },
  { icon: GraduationCap, title: 'Study & Learning', rows: ['Courses and topics', 'Progress you can see'], chip: 'Progress' },
  { icon: KanbanSquare, title: 'Project Management', rows: ['Board and deadlines', 'Blockers at a glance'], chip: 'Board' },
  { icon: BarChart3, title: 'Data Analytics', rows: ['Metrics and trends', 'Period-over-period comparison'], chip: 'Trends' },
  { icon: Bot, title: 'AI Assistant', rows: ['"Prepare my client meeting"', 'Intent-aware help'], chip: 'Ask Nexora' },
];
const SAMPLES = ['Prepare for tomorrow\'s client meeting.', 'Summarize my unread messages and help me reply.', 'Help me prepare for my upcoming exam.', 'Show overdue project tasks and blockers.', 'Investigate why active users have declined.', 'How can Nexora help me manage my work?'];

function FloatCard({ c, i }: { c: Card; i: number }) {
  const [on, setOn] = useState(false);
  return (
    <div className={`fc p${i} reveal`} style={{ ['--d' as string]: `${0.15 * i}s` }}>
      <div className="par" style={{ ['--dp' as string]: (i % 3) + 1 }}>
        <div className="fl" style={{ ['--sp' as string]: `${5 + i}s`, ['--r' as string]: `${(i % 2 ? 1 : -1) * 0.8}deg` }}>
          <Tilt className="glass wcard">
            <div className="row between"><span className="ic"><c.icon size={17} color="#fff" /></span>
              <button className="chip" aria-pressed={on} onClick={() => setOn(!on)} style={on ? { background: 'var(--btn-a)', color: '#fff' } : undefined}>{on ? '✓ ' : ''}{c.chip}</button></div>
            <b>{c.title}</b>{c.rows.map(r => <span key={r} className="muted small">{r}</span>)}
          </Tilt>
        </div>
      </div>
    </div>
  );
}

/** Adds the `.in` class to `.sr-reveal` elements as they enter the viewport (disabled for reduced motion). */
function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.sr-reveal'));
    if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);
}
const NAV = [['product', 'Product'], ['workspaces', 'Workspaces'], ['how', 'How it works'], ['privacy', 'Privacy']] as const;
function useActiveSection() {
  const [active, setActive] = useState('product');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }), { rootMargin: '-40% 0px -50% 0px' });
    NAV.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return active;
}

export default function Landing() {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [intro, setIntro] = useState(!reduce); const [ready, setReady] = useState(reduce);
  const stage = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !stage.current) return; const b = stage.current.getBoundingClientRect();
    stage.current.style.setProperty('--mx', String(((e.clientX - b.left) / b.width - 0.5) * 2)); stage.current.style.setProperty('--my', String(((e.clientY - b.top) / b.height - 0.5) * 2));
  };
  useScrollReveal(); const active = useActiveSection(); const [menu, setMenu] = useState(false);
  const [intent, setIntent] = useState(SAMPLES[0]); const [accent, setAccent] = useState('purple'); const cfg = classifyIntent(intent);
  return (
    <div className={'warm-scene' + (ready ? ' ready' : '')}>
      {intro && <BrandIntro onReveal={() => setReady(true)} onDone={() => setIntro(false)} />}
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <header className="nav-m layer">
        <div className="brand"><NexoraMark size={34} depth />Nexora</div>
        <button className="icon-btn nav-toggle" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="site-links" onClick={() => setMenu(m => !m)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        <nav id="site-links" className={'links' + (menu ? ' open' : '')} aria-label="Sections">{NAV.map(([id, label]) => <a key={id} href={'#' + id} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined} onClick={() => setMenu(false)}>{label}</a>)}</nav>
        <div className="row wrap cta-row"><Link className="btn sm" to="/admin/login">Admin Portal</Link><Link className="btn sm primary" to="/user/login">User Workspace</Link></div>
      </header>
      <div className="hero-wrap">
        <HeroVideo />
      <section className="hero layer" id="product">
        <div>
          <p className="reveal eyebrow" style={{ ['--d' as string]: '.0s' }}><Sparkles size={14} aria-hidden /> Intent-to-Interface · Your Intent. Your Workspace.</p>
          <h1 className="reveal" style={{ ['--d' as string]: '.1s', marginTop: 14 }}>Your <span className="hl">Intent.</span> Your <span className="hl">Interface.</span></h1>
          <h2 className="reveal" style={{ ['--d' as string]: '.25s' }}>One Workspace. Every Possibility.</h2>
          <p className="reveal muted" style={{ ['--d' as string]: '.4s', maxWidth: 520 }}>An intelligent workspace that transforms your goals into a focused, personalized digital environment.</p>
          <div className="row wrap reveal" style={{ ['--d' as string]: '.55s', marginTop: 24 }}>
            <a className="btn primary" href="#workspaces">Explore Nexora</a><Link className="btn" to="/user/login">Enter Your Workspace</Link>
          </div>
          <div className="row wrap reveal" style={{ ['--d' as string]: '.7s', marginTop: 14 }}>
            <Link className="lk" to="/admin/login">Admin Portal →</Link><Link className="lk" to="/user/login">User Workspace →</Link>
          </div>
        </div>
        <div><div className="stage" ref={stage} onPointerMove={onMove}>{CARDS.map((c, i) => <FloatCard key={c.title} c={c} i={i} />)}</div></div>
      </section>
      </div>
      <div className="band layer"><section className="sec sr-reveal" id="workspaces">
        <h2 className="t">Six workspaces. One intent.</h2><p className="muted" style={{ maxWidth: 640 }}>Meetings, communication, learning, projects, analytics and an assistant — each a full workspace, reorganized around what you are trying to do.</p>
        <div className="grid g3" style={{ marginTop: 24 }}>{CARDS.map(c => <div key={c.title} className="glass wcard feat"><span className="ic"><c.icon size={17} color="#fff" /></span><b>{c.title}</b><span className="muted small">{c.rows.join(' · ')}</span></div>)}</div>
      </section></div>
      <section className="sec layer sr-reveal" id="how">
        <h2 className="t">How intent-driven adaptation works</h2>
        <div className="grid g3" style={{ marginBottom: 20 }}>{['Describe your goal in plain language', 'Nexora classifies the intent and picks a workspace', 'Widgets, order and actions reorganize — with an explanation'].map((s, i) => <div key={s} className="glass wcard"><b className="grad-text" style={{ fontSize: '1.8em', fontFamily: 'var(--font-display)' }}>0{i + 1}</b><span>{s}</span></div>)}</div>
        <div className="glass" style={{ padding: 20 }} data-color={accent}>
          <div className="row wrap" style={{ marginBottom: 10 }}>{SAMPLES.map(s => <button key={s} className={'chip' + (s === intent ? ' on' : '')} onClick={() => setIntent(s)} style={s === intent ? { background: 'var(--btn-a)', color: '#fff' } : undefined}>{s.replace(/[.?]$/, '')}</button>)}</div>
          <label className="f">Try an intent<input className="input" value={intent} onChange={e => setIntent(e.target.value)} /></label>
          <div className="row wrap" style={{ marginTop: 14 }}><span className="tag pri">{cfg.intent}</span><b>{cfg.workspace.label}</b><span className="muted">→ {cfg.focus.map(f => FOCUS_LABEL[f]).join(' · ')}</span></div>
          <div className="row wrap" style={{ marginTop: 14 }}><span className="muted small">Try an accent color:</span>{Object.entries(COLOR_HEX).map(([k, v]) => <button key={k} aria-label={k} aria-pressed={k === accent} onClick={() => setAccent(k)} style={{ width: 26, height: 26, borderRadius: '50%', background: v, border: k === accent ? '3px solid var(--espresso)' : '2px solid var(--warm-border)', cursor: 'pointer' }} />)}</div>
        </div>
      </section>
      <div className="band layer"><section className="sec sr-reveal"><h2 className="t">Built for individuals and teams</h2>
        <div className="grid g2"><div className="glass wcard"><b>Individuals</b><span className="muted">A command center that follows your goal: exam week, client prep or inbox zero — with 14 personalization choices.</span></div><div className="glass wcard"><b>Teams</b><span className="muted">Shared projects, meeting prep, communication triage and analytics in one place, with an admin portal for operational visibility.</span></div></div>
      </section></div>
      <section className="sec layer sr-reveal" id="privacy"><h2 className="t"><ShieldCheck style={{ verticalAlign: -4 }} /> Privacy and security principles</h2>
        <div className="grid g3">{['Roles are enforced by the server, never by the browser.', 'No passwords or tokens in browser storage.', 'Personalization stays non-sensitive.'].map(t => <div className="glass wcard feat" key={t}><span>{t}</span></div>)}</div>
      </section>
      <section className="sec layer sr-reveal" style={{ textAlign: 'center' }}><h2 className="t">Tell Nexora <span className="hl">what you need.</span></h2>
        <div className="row wrap" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/user/register">Create your workspace</Link><Link className="btn" to="/admin/login">Admin Portal</Link></div></section>
      <footer className="ftr layer"><span>© Nexora · Dusky Rose &amp; Mocha design system</span><nav aria-label="Footer"><a href="#product">Product</a><Link to="/user/login">User Workspace</Link><Link to="/admin/login">Admin Portal</Link><Link to="/user/register">Register</Link></nav></footer>
    </div>
  );
}
