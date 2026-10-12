import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import NexoraMark from './NexoraMark';

/**
 * Cinematic brand intro (overlay). A -> awakening, B -> N materializes, C -> light ribbons, D -> wordmark + tagline,
 * E -> finale pulse, F -> dissolve into the already-mounted landing page.
 * `onReveal` fires when the exit begins (hero content starts revealing underneath); `onDone` unmounts the overlay.
 * Timing adapts: constrained devices/connections get fewer effects and a shorter hold. Skip / Escape / click exit fast.
 */
const T = { exit: 4200, exitLite: 3000, out: 800, fast: 300 };
type V = CSSProperties & Record<`--${string}`, string | number>;
const lite = () => {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  return !!n.connection?.saveData || /2g/.test(n.connection?.effectiveType ?? '') || (n.deviceMemory ?? 8) <= 2 || (n.hardwareConcurrency ?? 8) <= 2;
};
const DUST = Array.from({ length: 24 }, (_, i) => ({ x: (i * 37 + 11) % 100, y: 30 + ((i * 53 + 7) % 70), s: 2 + ((i * 7) % 3), d: 8 + ((i * 5) % 7), dl: -((i * 1.7) % 9), sw: (10 + ((i * 13) % 22)) * (i % 2 ? 1 : -1) }));
const BOKEH: [number, number, number, number][] = [[8, 18, 150, 9], [92, 12, 110, 11], [5, 78, 120, 10], [94, 80, 170, 12], [22, 92, 70, 8], [80, 30, 60, 9], [50, 5, 90, 13]];
const SPHERES: [number, number, number, number][] = [[14, 42, 22, 7], [86, 60, 28, 9], [30, 18, 14, 8], [72, 14, 16, 10]];

/** Orbital arc + flowing rose-gold ribbon + light trails. `back` renders behind the monogram, `front` in front of it. */
function Ribbons({ part }: { part: 'back' | 'front' }) {
  const id = useId().replace(/:/g, ''); const g = `rg-${id}`, f = `rf-${id}`; const back = part === 'back';
  const top = 'M30 200A170 62 0 0 1 370 200', bot = 'M370 200A170 62 0 0 1 30 200';
  const top2 = 'M62 200A138 46 0 0 1 338 200', bot2 = 'M338 200A138 46 0 0 1 62 200';
  const cd = back ? 0 : 3.5;
  return (
    <svg className={`in-rib ${part}`} viewBox="0 0 400 400" aria-hidden>
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="370" y2="0"><stop offset="0" stopColor="#DCAE96" stopOpacity="0" /><stop offset=".25" stopColor="#DCAE96" /><stop offset=".5" stopColor="#FBE3D2" /><stop offset=".75" stopColor="#B7806B" /><stop offset="1" stopColor="#C3B091" stopOpacity="0" /></linearGradient>
        <linearGradient id={f} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="0"><stop offset="0" stopColor="#DCAE96" stopOpacity="0" /><stop offset=".5" stopColor="#E7BFA8" stopOpacity=".9" /><stop offset="1" stopColor="#DCAE96" stopOpacity="0" /></linearGradient>
      </defs>
      {back && <g className="rb-small"><path className="rb-trail t1" d="M20 120C120 60 240 190 380 90" pathLength={1} stroke={`url(#${f})`} /><path className="rb-trail t2" d="M10 300C130 340 250 250 390 310" pathLength={1} stroke={`url(#${f})`} /><path className="rb-trail t3" d="M60 380C160 300 300 360 360 230" pathLength={1} stroke={`url(#${f})`} /></g>}
      <g className="rb-sway a"><g transform="rotate(-22 200 200)">
        <path className="rb-base rb-orbit" d={back ? top : bot} pathLength={1} stroke={`url(#${g})`} />
        <path className="rb-comet" d={back ? top : bot} pathLength={1} style={{ animationDelay: `${2.6 + cd}s` }} />
      </g></g>
      <g className="rb-sway b"><g transform="rotate(26 200 200)">
        <path className="rb-base rb-ribbon" d={back ? top2 : bot2} pathLength={1} stroke={`url(#${g})`} />
        <path className="rb-comet r" d={back ? top2 : bot2} pathLength={1} style={{ animationDelay: `${3.1 + cd}s` }} />
      </g></g>
    </svg>
  );
}

export default function BrandIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<'play' | 'out'>('play'); const [fast, setFast] = useState(false);
  const root = useRef<HTMLDivElement>(null); const isLite = useMemo(lite, []);
  const cb = useRef({ onReveal, onDone }); cb.current = { onReveal, onDone };
  const skip = () => { setFast(true); setPhase('out'); };

  useEffect(() => { const t = setTimeout(() => setPhase('out'), isLite ? T.exitLite : T.exit); return () => clearTimeout(t); }, [isLite]);
  useEffect(() => {
    if (phase !== 'out') return;
    cb.current.onReveal();
    const t = setTimeout(() => cb.current.onDone(), fast ? T.fast : T.out);
    return () => clearTimeout(t);
  }, [phase, fast]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  // depth parallax: mouse only; sets CSS variables (no React re-render, no rAF needed)
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || !root.current) return; const b = root.current.getBoundingClientRect();
    root.current.style.setProperty('--px', String(((e.clientX - b.left) / b.width - 0.5) * 2)); root.current.style.setProperty('--py', String(((e.clientY - b.top) / b.height - 0.5) * 2));
  };
  const dust = isLite ? DUST.slice(0, 10) : DUST;

  return (
    <div ref={root} className={'intro' + (phase === 'out' ? ' out' : '') + (fast ? ' fast' : '')} role="dialog" aria-label="Nexora intro" onClick={skip} onPointerMove={onMove}>
      <div className="in-bg" aria-hidden /><div className="in-glow" aria-hidden />
      <div className="in-layer" style={{ '--k': 22 } as V} aria-hidden>{BOKEH.slice(0, isLite ? 3 : 7).map(([x, y, s, d], i) => <i key={i} className="in-bk" style={{ '--x': x, '--y': y, '--s': `${s}px`, '--d': `${d}s` } as V} />)}</div>
      <div className="in-layer" style={{ '--k': 12 } as V} aria-hidden>{SPHERES.slice(0, isLite ? 2 : 4).map(([x, y, s, d], i) => <i key={i} className="in-sp" style={{ '--x': x, '--y': y, '--s': `${s}px`, '--d': `${d}s` } as V} />)}</div>
      <div className="in-layer" style={{ '--k': 5 } as V} aria-hidden>{dust.map((p, i) => <i key={i} className="in-d" style={{ '--x': p.x, '--y': p.y, '--s': `${p.s}px`, '--d': `${p.d}s`, '--dl': `${p.dl}s`, '--sw': `${p.sw}px` } as V} />)}</div>
      <div className="in-stage">
        <div className="in-markbox">
          <div className="in-point" aria-hidden /><div className="in-ring" aria-hidden />
          <Ribbons part="back" />
          <div className="in-tilt"><div className="in-halo" aria-hidden /><div className="in-float"><NexoraMark animate size={170} className="in-mark" /></div></div>
          <Ribbons part="front" />
          <div className="in-floor" aria-hidden><div className="in-horizon" /><div className="in-hglow" /><div className="in-refl"><NexoraMark decorative depth size={170} /></div></div>
        </div>
        <div className="in-word" aria-label="Nexora">{'NEXORA'.split('').map((c, i) => <span key={i} aria-hidden data-c={c} style={{ '--i': i } as V}>{c}</span>)}</div>
        <p className="in-tag" aria-label="Ideas, People, Progress">IDEAS · PEOPLE · PROGRESS</p><div className="in-rule" aria-hidden />
      </div>
      <button className="in-skip" onClick={e => { e.stopPropagation(); skip(); }}>Skip intro <span className="arr" aria-hidden>→</span></button>
    </div>
  );
}
