import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { meetingService } from '../../api/services';
import { useResource } from '../../api/useResource';
import { ErrorState, Ring } from '../../components/ui';
import { DeadlineBadge } from '../../pages/workspaces/ActionTracker';

/** Compact dashboard summary of meeting action items. Loads its own data; hides itself to a one-line hint when there is nothing to track. */
export default function ActionTrackerCard() {
  const { data, loading, error, retry } = useResource(meetingService.actionTracker);
  if (error && !data) return <section className="card col" aria-label="Action tracker"><b className="small">Action Tracker</b><ErrorState message={error} onRetry={retry} /></section>;
  if (loading && !data) return <div className="skeleton trk-card-sk" aria-hidden />;
  if (!data) return null;
  const t = data.totals;
  if (!t.total) return <p className="muted small trk-hint"><ListChecks size={14} /> No meeting action items to track yet — <Link to="/app/meetings">process a meeting recording or transcript</Link> to generate them.</p>;
  const top = data.items.filter(i => i.state === 'overdue' || i.state === 'due_soon').sort((a, b) => (a.state === b.state ? (a.deadline ?? '~').localeCompare(b.deadline ?? '~') : a.state === 'overdue' ? -1 : 1)).slice(0, 3);
  return (
    <section className="card col trk-card" aria-label="Action tracker">
      <div className="row between wrap"><h2 style={{ fontSize: '1.1em' }} className="row"><ListChecks size={18} /> Meeting action items</h2><Link className="btn sm" to="/app/tracker">Open Action Tracker</Link></div>
      <div className="row wrap" style={{ gap: 18 }}><Ring value={t.progress} size={60} />
        {([['Overdue', t.overdue, 'var(--err)'], ['In progress', t.doing, ''], ['Done', t.done, 'var(--ok)'], ['Done late', t.doneLate, 'var(--warn)']] as [string, number, string][]).map(([l, v, c]) =>
          <div key={l} className="stat"><span className="muted small">{l}</span><b style={{ fontSize: '1.4em', ...(c && v ? { color: c } : {}) }}>{v}</b></div>)}</div>
      {top.length ? <ul className="list">{top.map(i => <li key={i.id} className="row between wrap"><span className="col" style={{ gap: 0 }}><span>{i.text}</span><span className="muted small">{i.owner || 'Unassigned'} · <Link to={`/app/meetings/${i.meetingId}`}>{i.meetingTitle}</Link></span></span><DeadlineBadge i={i} /></li>)}</ul>
        : <span className="muted small">Nothing overdue or due soon.</span>}
    </section>
  );
}
