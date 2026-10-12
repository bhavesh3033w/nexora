import fs from 'fs';
import { Readable } from 'stream';
import { env } from '../config/env.js';

const API = 'https://generativelanguage.googleapis.com';

/** Audio/video types Gemini accepts. Google Meet recordings are video/mp4. */
export const RECORDING_MIME_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg', 'video/x-matroska', 'video/3gpp',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav',
  'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac',
];
export const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

export class TranscriptionError extends Error {
  constructor(public code: 'AI_PROVIDER_ERROR' | 'TRANSCRIPT_NOT_AVAILABLE', message: string) {
    super(message);
  }
}

const PROMPT = `Transcribe this meeting recording completely and verbatim.
- One utterance per line, formatted exactly as: Speaker Name [mm:ss]: spoken text
- Use real names when people introduce themselves or address each other; otherwise "Speaker 1", "Speaker 2", ...
- Keep the original language. Write Hindi/Hinglish in Roman (Latin) script, not Devanagari.
- Do not summarise, translate or add commentary. Output only the transcript lines.
- If there is no intelligible speech, output exactly: NO_SPEECH`;

export class RecordingTranscriber {
  public static isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  /** Uploads the recording to the Gemini Files API, transcribes it, then deletes the remote copy. */
  public static async transcribe(filePath: string, mimeType: string, displayName: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new TranscriptionError('AI_PROVIDER_ERROR', 'GEMINI_API_KEY is not set on the server, so recordings cannot be transcribed. Upload a transcript instead.');
    }
    const key = env.GEMINI_API_KEY;
    const size = (await fs.promises.stat(filePath)).size;

    const start = await fetch(`${API}/upload/v1beta/files?key=${key}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(size),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }),
    });
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!start.ok || !uploadUrl) throw new TranscriptionError('AI_PROVIDER_ERROR', `Recording upload could not start (${start.status}).`);

    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Length': String(size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: Readable.toWeb(fs.createReadStream(filePath)) as any,
      duplex: 'half',
    } as RequestInit);
    if (!upload.ok) throw new TranscriptionError('AI_PROVIDER_ERROR', `Recording upload failed (${upload.status}).`);
    let file: { name: string; uri: string; state?: string } = ((await upload.json()) as any).file;

    try {
      // Video files are processed asynchronously; wait until ACTIVE (max ~10 minutes).
      for (let i = 0; file.state === 'PROCESSING' && i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await fetch(`${API}/v1beta/${file.name}?key=${key}`);
        if (poll.ok) file = (await poll.json()) as any;
      }
      if (file.state && file.state !== 'ACTIVE') {
        throw new TranscriptionError('AI_PROVIDER_ERROR', `The recording could not be processed (state: ${file.state}).`);
      }

      const gen = await fetch(`${API}/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ file_data: { mime_type: mimeType, file_uri: file.uri } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 65536 },
        }),
      });
      if (!gen.ok) throw new TranscriptionError('AI_PROVIDER_ERROR', `Transcription request failed (${gen.status}).`);
      const data: any = await gen.json();
      const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').trim();
      if (!text || text === 'NO_SPEECH') {
        throw new TranscriptionError('TRANSCRIPT_NOT_AVAILABLE', 'No intelligible speech was found in the recording.');
      }
      return text.replace(/^```\w*\n?|```$/g, '').trim();
    } finally {
      void fetch(`${API}/v1beta/${file.name}?key=${key}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }
}
