import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Empty, ErrorState, NeedsBackend, Page, Skeletons } from '../../components/ui';
import { avg, useAnalytics } from '../../features/analytics/data';
import type { DayRow } from '../../types';

const METRICS: { k: keyof DayRow; label: string; fmt: (n: number) => string }[] = [
  { k: 'activeUsers', label: 'Active users', fmt: n => Math.round(n).toLocaleString() }, { k: 'revenue', label: 'Revenue', fmt: n => Math.round(n).toLocaleString() },
  { k: 'conversion', label: 'Conversion rate', fmt: n => n.toFixed(2) + '%' }, { k: 'sessions', label: 'Sessions', fmt: n => Math.round(n).toLocaleString() }];
const sg = (n: number) => (n > 0 ? '+' : '') + n.toFixed(1) + '%';

export default function Analytics() {
  const res = useAnalytics(); const rows = res.data ?? [];
  const [range, setRange] = useState(30); const [metric, setMetric] = useState<keyof DayRow>('activeUsers'); const [type, setType] = useState<'line' | 'area' | 'bar'>('area'); const [cmp, setCmp] = useState(true);
  const cur = rows.slice(-range); const prev = rows.slice(-range * 2, -range); const m = METRICS.find(x => x.k === metric)!;
  const data = useMemo(() => cur.map((r, i) => ({ date: r.date.slice(5), value: r[metric] as number, previous: prev[i] ? (prev[i][metric] as number) : undefined })), [cur, prev, metric]);
  const ch = (k: keyof DayRow) => prev.length ? ((avg(cur, k) - avg(prev, k)) / avg(prev, k)) * 100 : null;
  const fmtCh = (k: keyof DayRow) => { const c = ch(k); return c === null || !Number.isFinite(c) ? 'no earlier period to compare' : `${c.toFixed(1)}% vs previous ${range} days`; };
  const ChartEl = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;
  const lo = cur.length ? cur.reduce((a, b) => (b[metric] as number) < (a[metric] as number) ? b : a) : null, hi = cur.length ? cur.reduce((a, b) => (b[metric] as number) > (a[metric] as number) ? b : a) : null;
  const au = ch('activeUsers');

  return (
    <Page title="Data Analytics" sub="Product metrics from your Nexora backend">
      {res.error && <ErrorState message={res.error} onRetry={res.retry} />}
      {res.loading ? <Skeletons n={4} /> : res.error ? null : !cur.length ? <Empty title="No analytics data yet">The server returned no daily metrics. Charts appear once data is available.</Empty> : <>
        <div className="row wrap"><select style={{ width: 'auto' }} aria-label="Date range" value={range} onChange={e => setRange(+e.target.value)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={45}>Last 45 days</option></select>
          <select style={{ width: 'auto' }} aria-label="Metric" value={metric} onChange={e => setMetric(e.target.value as keyof DayRow)}>{METRICS.map(x => <option key={x.k} value={x.k}>{x.label}</option>)}</select>
          <select style={{ width: 'auto' }} aria-label="Chart type" value={type} onChange={e => setType(e.target.value as typeof type)}><option value="area">Area</option><option value="line">Line</option><option value="bar">Bar</option></select>
          <label className="row small"><input className="check" type="checkbox" checked={cmp} onChange={e => setCmp(e.target.checked)} /> Compare with previous period</label></div>
        <div className="grid g4 stagger">{METRICS.map(x => { const c = ch(x.k); return <button key={x.k} className="card hover kpi" style={{ textAlign: 'left', cursor: 'pointer', borderColor: x.k === metric ? 'var(--primary)' : undefined }} onClick={() => setMetric(x.k)}><span className="muted small">{x.label}</span><b>{x.fmt(avg(cur, x.k))}</b><span className={c !== null && c < 0 ? 'down small' : 'up small'}>{fmtCh(x.k)}</span></button>; })}</div>
        <div className="card col"><h3 style={{ fontSize: '1.05em' }}>{m.label} — daily average over the last {cur.length} days</h3>
          <div className="chartbox"><ResponsiveContainer><ChartEl data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} width={48} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /><Legend />
            {type === 'bar' ? <Bar dataKey="value" name={m.label} fill="var(--primary)" /> : type === 'line' ? <Line dataKey="value" name={m.label} stroke="var(--primary)" dot={false} strokeWidth={2} /> : <Area dataKey="value" name={m.label} stroke="var(--primary)" fill="var(--primary)" fillOpacity={.2} />}
            {cmp && (type === 'bar' ? <Bar dataKey="previous" name="Previous period" fill="var(--muted)" /> : type === 'line' ? <Line dataKey="previous" name="Previous period" stroke="var(--muted)" dot={false} strokeDasharray="4 4" /> : <Area dataKey="previous" name="Previous period" stroke="var(--muted)" fill="var(--muted)" fillOpacity={.08} strokeDasharray="4 4" />)}</ChartEl></ResponsiveContainer></div>
          {hi && lo && <p className="muted small">Summary: average {m.label.toLowerCase()} is {m.fmt(avg(cur, metric))} ({fmtCh(metric)}). Peak {m.fmt(hi[metric] as number)} on {hi.date}; low {m.fmt(lo[metric] as number)} on {lo.date}.</p>}</div>
        <section className="card col" aria-label="Analytics Insights">
          <div><h3 className="card-h">Analytics Insights</h3><span className="muted small">Calculated only from the rows the server returned for the selected {range}-day range.</span></div>
          <div className="grid g3 stagger">
            <article className="insight"><div className="row between"><Activity size={18} style={{ color: 'var(--primary)' }} aria-hidden /><span className="tag pri">Measured</span></div><b>Active users{au !== null && Number.isFinite(au) ? `: ${sg(au)}` : ''}</b><span>Daily average {Math.round(avg(cur, 'activeUsers')).toLocaleString()}{prev.length ? ` vs ${Math.round(avg(prev, 'activeUsers')).toLocaleString()} in the previous ${range} days` : ' (no earlier period to compare)'}.</span></article>
            {hi && <article className="insight"><div className="row between"><TrendingUp size={18} className="up" aria-hidden /><span className="tag pri">Measured</span></div><b>Peak {m.label.toLowerCase()}</b><span>{m.fmt(hi[metric] as number)} on {hi.date}.</span></article>}
            {lo && <article className="insight"><div className="row between"><TrendingDown size={18} className="down" aria-hidden /><span className="tag pri">Measured</span></div><b>Lowest {m.label.toLowerCase()}</b><span>{m.fmt(lo[metric] as number)} on {lo.date}.</span></article>}
            {au !== null && au < 0 && <article className="insight hyp"><div className="row between"><Lightbulb size={18} style={{ color: 'var(--warn)' }} aria-hidden /><span className="tag">Hypothesis</span></div><b>Next check</b><span>Active users fell versus the previous period. Compare releases, campaigns or outages around the point the decline started. This is a lead to check, not a confirmed cause.</span></article>}
          </div>
        </section></>}
      <NeedsBackend feature="Feature usage breakdown" needs="an endpoint returning per-feature usage counts for the current and previous period (not defined in the API contract yet; the chart components in features/analytics/FeatureCharts.tsx are ready for it)" />
    </Page>
  );
}
