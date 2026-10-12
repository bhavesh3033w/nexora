import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface FeatureRow { name: string; current: number; previous: number }
/** Nexora chart palette: Dusky Rose, Mocha Brown, Blush Pink, Peach Sunset, Soft Beige, Deep espresso (+ a deep rose-brown for the 7th series). */
export const FEATURE_COLORS = ['#B56F76', '#8F7466', '#FFD1DC', '#F4C2C2', '#F5F5DC', '#382A27', '#6E4A4F'];
/** Readable label colour for a segment: espresso on light fills, white on dark fills. */
const labelOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); return l > 150 ? '#382A27' : '#FFFFFF'; };

/** Percentages to 1 decimal that always sum to exactly 100.0 (largest-remainder rounding). */
export function percentages(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0); if (!total) return values.map(() => 0);
  const raw = values.map(v => (v / total) * 1000), floor = raw.map(Math.floor); let rest = 1000 - floor.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - floor[i] })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (rest > 0) { floor[i]++; rest--; } });
  return floor.map(x => x / 10);
}
const tip = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' };

export function FeaturePie({ rows }: { rows: FeatureRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  const { data, total } = useMemo(() => { const pct = percentages(rows.map(r => r.current)); return { total: rows.reduce((s, r) => s + r.current, 0), data: rows.map((r, i) => ({ name: r.name, value: r.current, pct: pct[i], color: FEATURE_COLORS[i % FEATURE_COLORS.length] })) }; }, [rows]);
  const a = active !== null ? data[active] : null;
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="chartbox pie-box" role="img" aria-label={'Feature usage distribution: ' + data.map(d => `${d.name} ${d.pct}%`).join(', ')}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2} animationDuration={700}
              labelLine={false} label={(p: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; index: number }) => {
                const d = data[p.index]; if (d.pct < 6) return null; const R = Math.PI / 180, r = p.innerRadius + (p.outerRadius - p.innerRadius) / 2;
                return <text x={p.cx + r * Math.cos(-p.midAngle * R)} y={p.cy + r * Math.sin(-p.midAngle * R)} fill={labelOn(d.color)} fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>{d.pct}%</text>;
              }}
              onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}>
              {data.map((d, i) => <Cell key={d.name} fill={d.color} fillOpacity={active === null || active === i ? 1 : .35} style={{ transition: 'fill-opacity .2s', cursor: 'pointer', outline: 'none' }} />)}
            </Pie>
            <Tooltip content={({ active: on, payload }: any) => {
              if (!on || !payload?.length) return null; const d = payload[0].payload;
              return <div style={{ ...tip, padding: '8px 12px', fontSize: 13 }}><b><span style={{ color: d.color, textShadow: '0 0 1px rgba(56,42,39,.6)' }} aria-hidden>●</span> {d.name}</b><div>{d.value.toLocaleString()} uses · <b>{d.pct}%</b></div><div className="muted small">of {total.toLocaleString()} total</div></div>;
            }} />
            <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fill="var(--muted)" fontSize={12}>{a ? a.name : 'Total uses'}</text>
            <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize={20} fontWeight={700}>{(a ? a.value : total).toLocaleString()}</text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend-grid" aria-label="Legend">
        {data.map((d, i) => <li key={d.name}><button type="button" className={'legend-item' + (active === i ? ' on' : '')} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
          <i style={{ background: d.color }} aria-hidden /><span>{d.name}</span><b>{d.pct}%</b></button></li>)}
      </ul>
    </div>
  );
}

export function FeatureBars({ rows }: { rows: FeatureRow[] }) {
  return (
    <div className="chartbox"><ResponsiveContainer><BarChart data={rows} margin={{ bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey="name" stroke="var(--muted)" fontSize={11} interval={0} angle={-30} textAnchor="end" height={64} /><YAxis stroke="var(--muted)" fontSize={11} width={44} />
      <Tooltip contentStyle={tip} /><Legend verticalAlign="top" height={28} /><Bar dataKey="previous" name="Previous" fill="var(--muted)" radius={[3, 3, 0, 0]} /><Bar dataKey="current" name="Current" fill="var(--primary)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
  );
}
