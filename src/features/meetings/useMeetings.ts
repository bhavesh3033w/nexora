import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { googleService, meetingService } from '../../api/services';
import type { GoogleStatus, Meeting } from '../../types';

const ACTIVE = (m: Meeting) => m.status === 'in_progress' || m.status === 'processing';

/** Loads meetings from the API; polls every 20s while any meeting is in progress or awaiting its report. Starts empty — never pre-filled. */
export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setMeetings(await meetingService.list()); setError(''); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const polling = meetings.some(ACTIVE);
  useEffect(() => { if (!polling) return; const t = setInterval(() => { void refresh(); }, 20000); return () => clearInterval(t); }, [polling, refresh]);
  return { meetings, setMeetings, loading, error, refresh };
}

/** `status` stays null (with `error` set) when the status endpoint cannot be reached — it is never guessed. */
export function useGoogle() {
  const [status, setStatus] = useState<GoogleStatus | null>(null); const [error, setError] = useState('');
  const refresh = useCallback(async () => { try { setStatus(await googleService.status()); setError(''); } catch (e) { setStatus(null); setError(errorMessage(e)); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { status, error, refresh };
}

export const whenOf = (m: Meeting) => m.date + 'T' + (m.time || '00:00');
export const isPast = (m: Meeting) => m.status === 'completed' || m.status === 'processing' || m.status === 'failed' || (m.status !== 'in_progress' && whenOf(m) < new Date().toLocaleDateString('en-CA') + 'T00:00');
