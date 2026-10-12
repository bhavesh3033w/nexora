import type { MeetingReport } from '../types';

export const MAX_TRANSCRIPT_CHARS = 200_000;
export const ALLOWED_EXT = ['.txt', '.vtt', '.srt', '.md'];
export const MAX_FILE_BYTES = 1_000_000;

export function validateFile(f: File): string | null {
  const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return `Unsupported file type. Use ${ALLOWED_EXT.join(', ')}.`;
  if (f.size > MAX_FILE_BYTES) return 'File is larger than 1 MB.';
  return null;
}

/** Formats a server-generated meeting report as Markdown for copy/export. */
export function reportToMarkdown(title: string, date: string, r: MeetingReport): string {
  const L = (xs: string[]) => xs.length ? xs.map(x => `- ${x}`).join('\n') : '_None identified_';
  return [`# ${title}`, `_${date}_`, '## Summary', r.summary, '## Discussion topics', L(r.topics), '## Key decisions', L(r.decisions),
    '## Action items', r.actionItems.length ? r.actionItems.map(a => `- [${a.done ? 'x' : ' '}] ${a.text}${a.owner ? ` (owner: ${a.owner})` : ''}${a.deadline ? ` (due: ${a.deadline})` : ''}`).join('\n') : '_None identified_',
    '## Risks', L(r.risks), '## Follow-up questions', L(r.followUps)].join('\n\n');
}
