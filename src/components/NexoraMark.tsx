import { useId } from 'react';

/**
 * Original Nexora "N" monogram (inline SVG, crisp at any size, transparent background).
 * Two stems + a flowing diagonal ribbon with deliberate negative space.
 * `depth` renders the dimensional rose-gold/champagne version (soft shadow, deep-rose bevel edge, champagne body,
 * inner highlight, specular sweep mask). `animate` plays the draw-on + light sweeps used by the brand intro
 * (styles: `.nm*` in global.css). `decorative` hides it from assistive tech (e.g. the reflection).
 */
const STEM_L = 'M31 96V24';
const STEM_R = 'M89 96V24';
const RIBBON = 'M42 30C52 38 68 82 78 90';
// draw order: left stem, right stem, then the flowing diagonal completes the emblem
const STROKES = [[STEM_L, 'd1'], [STEM_R, 'd3'], [RIBBON, 'd2']] as const;

export default function NexoraMark({ size = 32, animate = false, depth = animate, decorative = false, className = '' }:
  { size?: number; animate?: boolean; depth?: boolean; decorative?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const body = `nm-body-${uid}`, edge = `nm-edge-${uid}`, sheen = `nm-sheen-${uid}`, mask = `nm-mask-${uid}`, blur = `nm-blur-${uid}`;
  const P = (cls: string, stroke: string, w: number, extra?: object) => STROKES.map(([d, c]) => <path key={d} className={`nm-dr ${c} ${cls}`} d={d} pathLength={1} stroke={stroke} strokeWidth={w} {...extra} />);
  return (
    <svg className={`nm${animate ? ' anim' : ''}${depth ? ' depth' : ''} ${className}`.trim()} width={size} height={size} viewBox="0 0 120 120"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Nexora' })}>
      <defs>
        <linearGradient id={body} gradientUnits="userSpaceOnUse" x1="22" y1="16" x2="98" y2="106">
          <stop offset="0" stopColor="#FFF3E3" /><stop offset=".28" stopColor="#F2CFB6" /><stop offset=".55" stopColor="#D9A58C" /><stop offset=".8" stopColor="#C58A72" /><stop offset="1" stopColor="#E6CDA8" />
        </linearGradient>
        <linearGradient id={edge} gradientUnits="userSpaceOnUse" x1="22" y1="16" x2="98" y2="106">
          <stop offset="0" stopColor="#B9806C" /><stop offset=".5" stopColor="#8A5646" /><stop offset="1" stopColor="#B79270" />
        </linearGradient>
        <linearGradient id={sheen} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="48" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#FFF6EC" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={blur} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" /></filter>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <g fill="none" stroke="#fff" strokeWidth={depth ? 8.6 : 8} strokeLinecap="round">{STROKES.map(([d]) => <path key={d} d={d} />)}</g>
        </mask>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {depth && <g filter={`url(#${blur})`} transform="translate(3 5)" opacity=".34">{P('nm-sh', '#5A2F26', 9)}</g>}
        {depth && P('nm-edge', `url(#${edge})`, 8.6)}
        {P('nm-body', `url(#${body})`, depth ? 6 : 8)}
        <g transform="translate(-1.5 -1.5)" opacity={depth ? 0.62 : 0.42}>{P('nm-hi', '#FFF6EA', depth ? 1.5 : 1.3)}</g>
        {depth && <g transform="translate(1.3 1.7)" opacity=".4">{P('nm-rim', '#7A4A3C', 0.9)}</g>}
      </g>
      <g mask={`url(#${mask})`} className="nm-sheen"><g transform="skewX(-18)"><rect className="nm-rect" x="-70" y="0" width="48" height="120" fill={`url(#${sheen})`} /></g></g>
    </svg>
  );
}
