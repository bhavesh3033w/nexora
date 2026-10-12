import type { MeetingReport, ReportActionItem } from '../types';

export const MAX_TRANSCRIPT_CHARS = 200_000;
export const ALLOWED_EXT = ['.txt', '.vtt', '.srt', '.md'];
export const MAX_FILE_BYTES = 1_000_000;
export const RECORDING_EXT = ['.mp4', '.webm', '.mov', '.mkv', '.m4a', '.mp3', '.wav', '.ogg', '.aac', '.flac'];
export const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

export function validateFile(f: File): string | null {
  const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return `Unsupported file type. Use ${ALLOWED_EXT.join(', ')}.`;
  if (f.size > MAX_FILE_BYTES) return 'File is larger than 1 MB.';
  return null;
}

export function validateRecording(f: File): string | null {
  const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
  if (!f.name.includes('.') || !RECORDING_EXT.includes(ext)) return `Unsupported recording type. Use ${RECORDING_EXT.join(', ')}.`;
  if (f.size === 0) return 'The selected file is empty.';
  if (f.size > MAX_RECORDING_BYTES) return 'Recording is larger than 500 MB.';
  return null;
}

export const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`;

/** Local YYYY-MM-DD for today (not UTC). */
export const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const localDate = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? iso.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const itemStatus = (a: ReportActionItem) => a.status ?? (a.done ? 'done' : 'todo');
/** 'overdue' = not done and past deadline; 'late' = completed after deadline. */
export function itemDelivery(a: ReportActionItem, today = todayLocal()): 'overdue' | 'late' | null {
  if (!a.deadline) return null; const dl = a.deadline.slice(0, 10);
  if (itemStatus(a) !== 'done') return dl < today ? 'overdue' : null;
  return a.completedAt && localDate(a.completedAt) > dl ? 'late' : null;
}
const STATUS_TXT = { todo: 'To do', doing: 'In progress', done: 'Done' } as const;

/** Formats a server-generated meeting report as Markdown for copy/export. */
export function reportToMarkdown(title: string, date: string, r: MeetingReport): string {
  const L = (xs: string[]) => xs.length ? xs.map(x => `- ${x}`).join('\n') : '_None identified_';
  const today = todayLocal();
  const item = (a: ReportActionItem) => { const s = itemStatus(a); const dv = itemDelivery(a, today);
    return `- [${s === 'done' ? 'x' : ' '}] ${a.text}${a.owner ? ` (owner: ${a.owner})` : ''}${a.deadline ? ` (due: ${a.deadline}${a.deadlineSource === 'default' ? ', default' : ''})` : ''} — ${STATUS_TXT[s]}${dv === 'overdue' ? ' **OVERDUE**' : dv === 'late' ? ' (completed late)' : ''}`; };
  return [`# ${title}`, `_${date}_`, '## Summary', r.summary, '## Discussion topics', L(r.topics), '## Key decisions', L(r.decisions),
    '## Action items', r.actionItems.length ? r.actionItems.map(item).join('\n') : '_None identified_',
    '## Risks', L(r.risks), '## Follow-up questions', L(r.followUps)].join('\n\n');
}
