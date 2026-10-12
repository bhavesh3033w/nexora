import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null; const el = ref.current!;
    const f = () => Array.from(el.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(x => !x.hasAttribute('disabled'));
    (f()[1] ?? f()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { const l = f(); if (!l.length) return; const a = l[0], b = l[l.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); } }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); prev?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={'modal card' + (wide ? ' wide' : '')}>
        <div className="row between"><h3>{title}</h3><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
export const Progress = ({ value, label }: { value: number; label?: string }) => (
  <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})` }} /></div>);
export function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (<svg width={size} height={size} role="img" aria-label={`${Math.round(value)} percent`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .6s' }} />
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill="var(--text)">{Math.round(value)}%</text></svg>);
}
export const Banner = ({ kind, children }: { kind: 'error' | 'ok' | 'info'; children: ReactNode }) => <div className={'banner ' + kind} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
/** Inline error with an optional retry action. */
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => <Banner kind="error"><span className="row between wrap"><span>{message}</span>{onRetry && <button className="btn sm" onClick={onRetry}>Retry</button>}</span></Banner>;
/** Honest placeholder for a feature whose backend capability does not exist yet. Never shows fabricated data. */
export const NeedsBackend = ({ feature, needs }: { feature: string; needs: string }) => <div className="card col" role="note"><b className="small">{feature} is not available yet</b><span className="muted small">Needs backend support: {needs}</span></div>;
export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}><h3>{title}</h3><div className="muted">{children}</div></div>;
export const Page = ({ title, sub, actions, children }: { title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) => (
  <div className="col route"><div className="row between wrap"><div><h1 style={{ fontSize: '1.7em' }}>{title}</h1>{sub && <div className="muted">{sub}</div>}</div><div className="row wrap">{actions}</div></div>{children}</div>);
export const Skeletons = ({ n = 3 }: { n?: number }) => <div className="grid g3">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" aria-hidden />)}</div>;
