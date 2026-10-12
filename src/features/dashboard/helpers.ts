import { useEffect, useRef, useState } from 'react';
import { today } from '../../lib/storage';
import type { Task } from '../../types';

/** Pure helpers over real API rows. Nothing here invents data. */
export const isOpen = (t: Task) => t.status !== 'done';
export const hasDue = (t: Task) => typeof t.due === 'string' && t.due.length >= 10;
export const isOverdue = (t: Task) => isOpen(t) && hasDue(t) && t.due.slice(0, 10) < today();
const parse = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00');
export const fmtDay = (iso?: string) => (iso && iso.length >= 10 ? parse(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date');
export const fmtLong = (iso: string) => parse(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
/** Whole days from today to `iso` (negative = in the past). */
export const daysFromToday = (iso: string) => Math.round((parse(iso).getTime() - parse(today()).getTime()) / 86400000);
export function relDay(iso?: string): string {
  if (!iso || iso.length < 10) return 'No date';
  const d = daysFromToday(iso);
  if (d === 0) return 'Today'; if (d === 1) return 'Tomorrow'; if (d === -1) return 'Yesterday';
  return d > 0 ? `In ${d} days` : `${-d} days overdue`;
}
export const byDue = (a: Task, b: Task) => (hasDue(a) ? a.due : '9999').localeCompare(hasDue(b) ? b.due : '9999');
export const STATUS_LABEL: Record<Task['status'], string> = { todo: 'To do', doing: 'In progress', done: 'Done' };
export const PRIORITY_RANK: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

const reduced = () => typeof window !== 'undefined' && (document.documentElement.dataset.motion === 'none' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
/** Animates an integer toward `target` (instant when motion is reduced/off). */
export function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(() => (reduced() ? target : 0)); const shown = useRef(v); shown.current = v;
  useEffect(() => {
    if (reduced()) { setV(target); return; }
    let raf = 0; const from = shown.current; const t0 = performance.now(); // animate from what is on screen, not from 0
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Deadline classification used by every deadline indicator (table, upcoming list, calendar). */
export type DeadlineKind = 'done' | 'none' | 'overdue' | 'today' | 'soon' | 'later';
export interface Deadline { kind: DeadlineKind; label: string; days: number }
export function deadlineOf(t: Task): Deadline {
  if (t.status === 'done') return { kind: 'done', label: 'Completed', days: 0 };
  if (!hasDue(t)) return { kind: 'none', label: 'No due date', days: 0 };
  const d = daysFromToday(t.due);
  if (d < 0) return { kind: 'overdue', label: d === -1 ? '1 day overdue' : `${-d} days overdue`, days: d };
  if (d === 0) return { kind: 'today', label: 'Due today', days: 0 };
  if (d === 1) return { kind: 'soon', label: 'Due tomorrow', days: 1 };
  if (d <= 3) return { kind: 'soon', label: `Due in ${d} days`, days: d };
  return { kind: 'later', label: fmtDay(t.due), days: d };
}
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type SortKey = 'title' | 'project' | 'priority' | 'status' | 'due' | 'assignee';
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
export const STATUS_RANK: Record<Task['status'], number> = { todo: 0, doing: 1, done: 2 };
export const DUE_LABEL: Record<DueFilter, string> = { any: 'Any due date', overdue: 'Overdue', today: 'Due today', week: 'Next 7 days', none: 'No due date' };
export function matchesDue(t: Task, f: DueFilter): boolean {
  if (f === 'any') return true;
  if (f === 'none') return !hasDue(t);
  if (!hasDue(t) || t.status === 'done') return false;
  const d = daysFromToday(t.due);
  return f === 'overdue' ? d < 0 : f === 'today' ? d === 0 : d >= 0 && d <= 7;
}
/** Comparator for a column. Tasks without a due date always sort last on the Due column, whatever the direction. */
export function compareBy(key: SortKey, dir: 1 | -1, pname: Map<string, string>) {
  return (a: Task, b: Task): number => {
    if (key === 'due') { const ha = hasDue(a), hb = hasDue(b); if (ha !== hb) return ha ? -1 : 1; return dir * (ha ? a.due.localeCompare(b.due) : 0); }
    const v = key === 'priority' ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      : key === 'status' ? STATUS_RANK[a.status] - STATUS_RANK[b.status]
        : key === 'project' ? (pname.get(a.projectId) ?? '').localeCompare(pname.get(b.projectId) ?? '')
          : key === 'assignee' ? (a.assignee ?? '').localeCompare(b.assignee ?? '') : a.title.localeCompare(b.title);
    return dir * v || a.title.localeCompare(b.title);
  };
}
