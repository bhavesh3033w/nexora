/**
 * Action Tracker — classifies meeting action items by delivery state and aggregates them
 * for the progress dashboard. Pure functions: no database access, so they are unit-testable.
 */

export type DeliveryState = 'overdue' | 'due_soon' | 'on_track' | 'no_deadline' | 'done_on_time' | 'done_late';

export interface TrackerInput {
  id: string;
  text: string;
  owner: string;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  deadline?: string;
  deadlineSource?: 'transcript' | 'default';
  completedAt?: string;
  createdAt?: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  actionItemId?: string;
}

export interface TrackerItem extends TrackerInput {
  state: DeliveryState;
  /** Days past the deadline (overdue: as of today; done_late: at completion). 0 otherwise. */
  daysLate: number;
  /** Days left until the deadline for open items; negative when overdue. */
  daysLeft: number | null;
}

export interface TrackerGroup { key: string; label: string; total: number; done: number; overdue: number; late: number; progress: number }

export interface TrackerSummary {
  today: string;
  totals: {
    total: number; todo: number; doing: number; done: number;
    overdue: number; dueSoon: number; onTrack: number; noDeadline: number;
    doneOnTime: number; doneLate: number;
    /** done / total, 0-100 */
    progress: number;
    /** done on time / done, 0-100 (null when nothing is done yet) */
    onTimeRate: number | null;
  };
  items: TrackerItem[];
  byOwner: TrackerGroup[];
  byMeeting: (TrackerGroup & { date: string })[];
  weekly: { week: string; created: number; completed: number }[];
}

export const DUE_SOON_DAYS = 2;

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / 86400000);

export function classify(item: TrackerInput, today: string): TrackerItem {
  const deadline = item.deadline?.slice(0, 10);
  if (item.status === 'done') {
    const doneOn = (item.completedAt ?? today).slice(0, 10);
    const late = deadline ? Math.max(0, dayDiff(deadline, doneOn)) : 0;
    return { ...item, state: late > 0 ? 'done_late' : 'done_on_time', daysLate: late, daysLeft: null };
  }
  if (!deadline) return { ...item, state: 'no_deadline', daysLate: 0, daysLeft: null };
  const left = dayDiff(today, deadline);
  if (left < 0) return { ...item, state: 'overdue', daysLate: -left, daysLeft: left };
  return { ...item, state: left <= DUE_SOON_DAYS ? 'due_soon' : 'on_track', daysLate: 0, daysLeft: left };
}

const weekStart = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
};

function group(items: TrackerItem[], keyOf: (i: TrackerItem) => string, labelOf: (i: TrackerItem) => string): TrackerGroup[] {
  const map = new Map<string, TrackerGroup>();
  for (const i of items) {
    const key = keyOf(i);
    const g = map.get(key) ?? { key, label: labelOf(i), total: 0, done: 0, overdue: 0, late: 0, progress: 0 };
    g.total++;
    if (i.status === 'done') g.done++;
    if (i.state === 'overdue') g.overdue++;
    if (i.state === 'done_late') g.late++;
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({ ...g, progress: Math.round((g.done / g.total) * 100) }));
}

export function summarize(inputs: TrackerInput[], today: string, weeks = 6): TrackerSummary {
  const items = inputs.map((i) => classify(i, today));
  const count = (f: (i: TrackerItem) => boolean) => items.filter(f).length;
  const done = count((i) => i.status === 'done');
  const doneOnTime = count((i) => i.state === 'done_on_time');

  const order: Record<DeliveryState, number> = { overdue: 0, due_soon: 1, on_track: 2, no_deadline: 3, done_late: 4, done_on_time: 5 };
  items.sort((a, b) => order[a.state] - order[b.state] || (a.deadline ?? '~').localeCompare(b.deadline ?? '~'));

  const thisWeek = weekStart(today);
  const weekly = Array.from({ length: weeks }, (_, k) => {
    const d = new Date(thisWeek + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - k));
    return { week: d.toISOString().slice(0, 10), created: 0, completed: 0 };
  });
  for (const i of items) {
    const c = weekly.find((w) => w.week === weekStart(i.createdAt ?? i.meetingDate));
    if (c) c.created++;
    if (i.completedAt) {
      const w = weekly.find((x) => x.week === weekStart(i.completedAt!));
      if (w) w.completed++;
    }
  }

  const byMeeting = group(items, (i) => i.meetingId, (i) => i.meetingTitle).map((g) => ({
    ...g,
    date: items.find((i) => i.meetingId === g.key)?.meetingDate ?? '',
  })).sort((a, b) => b.date.localeCompare(a.date));

  return {
    today,
    totals: {
      total: items.length,
      todo: count((i) => i.status === 'todo'),
      doing: count((i) => i.status === 'doing'),
      done,
      overdue: count((i) => i.state === 'overdue'),
      dueSoon: count((i) => i.state === 'due_soon'),
      onTrack: count((i) => i.state === 'on_track'),
      noDeadline: count((i) => i.state === 'no_deadline'),
      doneOnTime,
      doneLate: count((i) => i.state === 'done_late'),
      progress: items.length ? Math.round((done / items.length) * 100) : 0,
      onTimeRate: done ? Math.round((doneOnTime / done) * 100) : null,
    },
    items,
    byOwner: group(items, (i) => i.owner.toLowerCase(), (i) => i.owner).sort((a, b) => b.overdue - a.overdue || b.total - a.total),
    byMeeting,
    weekly,
  };
}
