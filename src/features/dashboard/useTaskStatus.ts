import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { workspaceServices } from '../../api/services';
import type { Task } from '../../types';
import { STATUS_LABEL } from './helpers';

/**
 * Changes a task's status through the EXISTING contract `PUT /tasks/{id}` (full object) — the same call the Projects board uses.
 * Nothing is applied optimistically: the table only changes after the server accepted the write and the list was re-read.
 * A failure leaves the task as it was and surfaces the real error.
 */
export function useTaskStatus(reload?: () => Promise<void>) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const change = useCallback(async (t: Task, next: Task['status']) => {
    if (next === t.status) return;
    setError(''); setNotice(''); setPending(p => new Set(p).add(t.id));
    const done = () => { if (alive.current) setPending(p => { const n = new Set(p); n.delete(t.id); return n; }); };
    try { await workspaceServices.update('tasks', t.id, { ...t, status: next }); }
    catch (e) { if (alive.current) setError(`“${t.title}” was not changed. ${errorMessage(e)}`); done(); return; }
    try { await reload?.(); } finally { if (alive.current) setNotice(`“${t.title}” saved as ${STATUS_LABEL[next]}.`); done(); }
  }, [reload]);
  return { pending, error, notice, change, dismiss: () => { setError(''); setNotice(''); } };
}
export type TaskActions = ReturnType<typeof useTaskStatus>;
