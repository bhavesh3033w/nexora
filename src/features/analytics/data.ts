import { useResource } from '../../api/useResource';
import { workspaceServices } from '../../api/services';
import { ApiError } from '../../api/client';
import type { DayRow } from '../../types';

const NUM: (keyof DayRow)[] = ['activeUsers', 'revenue', 'conversion', 'sessions'];

/** Loads daily analytics rows from `GET /analytics`. Rows that do not match the expected shape are rejected, never repaired. */
export function useAnalytics() {
  return useResource<DayRow[]>(async () => {
    const raw = await workspaceServices.list('analytics');
    const rows = raw.filter(r => r && typeof r.date === 'string' && NUM.every(k => Number.isFinite(r[k])));
    if (raw.length && !rows.length) throw new ApiError('INVALID_RESPONSE', 'Analytics rows must contain date, activeUsers, revenue, conversion and sessions.');
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  });
}
export const avg = (rows: DayRow[], k: keyof DayRow) => rows.reduce((s, r) => s + (r[k] as number), 0) / Math.max(1, rows.length);
