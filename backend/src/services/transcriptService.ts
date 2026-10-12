import { ITranscriptEntry, IActionItem } from '../models/Meeting.js';
import { resolveDeadline } from '../utils/deadline.js';

const FILLER_WORDS = /\b(um|uh|err|you know|sort of|kind of|i mean)\b/gi;
const TS_ONLY = /^\(?(\d{1,2}:\d{2}(?::\d{2})?)(?:[.,]\d+)?\)?$/;
const CUE_RANGE = /^(\d{1,2}:\d{2}(?::\d{2})?)(?:[.,]\d+)?\s*-->/;
// "Name [00:12]: text" / "Name (00:12): text" / "Name: text" — names are at most 4 words.
const SPEAKER_LINE = /^((?:[\p{L}0-9.'’-]+ ?){1,4}?)\s*(?:[[(](\d{1,2}:\d{2}(?::\d{2})?)[\])])?:\s*(.*)$/u;
const SENTENCES = /(?<=[.!?])\s+/;

export interface CleanedTranscriptResult {
  entries: ITranscriptEntry[];
  cleanedText: string;
  speakers: string[];
  talkTimeDistribution: Array<{ speaker: string; percentage: number; seconds: number }>;
}

export class TranscriptService {
  /**
   * Cleans raw transcript text, removes disfluencies and standardizes format
   */
  public static cleanText(rawText: string): string {
    if (!rawText) return '';
    return rawText
      .replace(FILLER_WORDS, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();
  }

  /**
   * Normalizes Google Meet .txt exports, WebVTT and SRT captions into "Speaker [ts]: text" lines.
   * Standalone timestamp lines and cue ranges are attached to the next speaker line.
   */
  public static normalize(raw: string): string {
    const out: string[] = [];
    let pendingTs = '';
    for (const original of raw.split(/\r?\n/)) {
      const line = original.trim();
      if (!line || line === 'WEBVTT' || /^NOTE\b/.test(line) || /^\d+$/.test(line)) continue;
      const cue = CUE_RANGE.exec(line) || TS_ONLY.exec(line);
      if (cue) {
        pendingTs = cue[1];
        continue;
      }
      const voice = /^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/.exec(line);
      let next = voice ? `${voice[1].trim()}: ${voice[2].trim()}` : line;
      if (pendingTs) {
        const m = SPEAKER_LINE.exec(next);
        if (m && !m[2]) next = `${m[1].trim()} [${pendingTs}]: ${m[3]}`;
        pendingTs = '';
      }
      out.push(next);
    }
    return out.join('\n');
  }

  /**
   * Parses raw transcript string formatted as:
   * "Speaker Name [00:12]: Text content here..."
   * into structured ITranscriptEntry array
   */
  public static parseRawTranscript(raw: string): CleanedTranscriptResult {
    if (!raw || !raw.trim()) {
      return { entries: [], cleanedText: '', speakers: [], talkTimeDistribution: [] };
    }

    const lines = this.normalize(raw).split(/\r?\n/).filter((l) => l.trim().length > 0);
    const entries: ITranscriptEntry[] = [];
    const speakerDurationMap: Record<string, number> = {};

    let currentSpeaker = 'Speaker';
    let currentTimestamp = '00:00';
    let accumulatedText = '';

    for (const line of lines) {
      // "Speaker [00:00]: text" or "Speaker: text"
      const match = line.match(SPEAKER_LINE);
      if (match) {
        if (accumulatedText.trim()) {
          const cleaned = this.cleanText(accumulatedText);
          entries.push({
            speaker: currentSpeaker,
            text: cleaned,
            timestamp: currentTimestamp,
            startTimeSeconds: this.parseTimestampToSeconds(currentTimestamp),
          });
          const wordCount = cleaned.split(/\s+/).length;
          speakerDurationMap[currentSpeaker] = (speakerDurationMap[currentSpeaker] || 0) + wordCount;
        }

        currentSpeaker = match[1].trim();
        currentTimestamp = match[2] || '00:00';
        accumulatedText = match[3] || '';
      } else {
        accumulatedText += ' ' + line;
      }
    }

    if (accumulatedText.trim()) {
      const cleaned = this.cleanText(accumulatedText);
      entries.push({
        speaker: currentSpeaker,
        text: cleaned,
        timestamp: currentTimestamp,
        startTimeSeconds: this.parseTimestampToSeconds(currentTimestamp),
      });
      const wordCount = cleaned.split(/\s+/).length;
      speakerDurationMap[currentSpeaker] = (speakerDurationMap[currentSpeaker] || 0) + wordCount;
    }

    const speakers = Object.keys(speakerDurationMap);
    const totalWords = Object.values(speakerDurationMap).reduce((a, b) => a + b, 0) || 1;

    const talkTimeDistribution = speakers.map((spk) => {
      const words = speakerDurationMap[spk] || 0;
      const percentage = Math.round((words / totalWords) * 100);
      // approximate 130 words per minute speaking rate
      const seconds = Math.round((words / 130) * 60);
      return {
        speaker: spk,
        percentage,
        seconds,
      };
    });

    const cleanedText = entries.map((e) => `${e.speaker}: ${e.text}`).join('\n\n');

    return {
      entries,
      cleanedText,
      speakers,
      talkTimeDistribution,
    };
  }

  /**
   * Extract potential action items via rule-based heuristic patterns (English + common Hinglish).
   * When `meetingDate` is given, spoken deadlines ("by Friday", "kal tak") are resolved to dates.
   */
  public static extractActionItemsHeuristic(entries: ITranscriptEntry[], meetingDate?: string): IActionItem[] {
    const actionItems: IActionItem[] = [];
    const actionPatterns = [
      /(?:i will|i'll|we will|we'll|let's|action item:?|tasked to|please|can you|could you|need to|needs to|have to|going to)\s+(.+?)(?:[.!?]|$)/i,
      /\b((?:follow up on|prepare|deploy|fix|review|document|schedule|send|share|update|finalize|finalise|draft|create|set up|verify|test)\s+.+?)(?:[.!?]|$)/i,
      /(?:main|mai|hum|tum|aap)\s+(.+?\s(?:kar dunga|kar dungi|karunga|karungi|kar denge|karenge|bhej dunga|bhej dungi|dekh lunga|dekh lungi|kar lena|kar dena|karna hai|bhejna hai))\b/i,
    ];
    const addressed = /^([A-Z][\p{L}'-]+),?\s+(?:can you|could you|please|will you|tum|aap)\b/u;

    for (const entry of entries) {
      for (const sentence of entry.text.split(SENTENCES)) {
        for (const pattern of actionPatterns) {
          const match = sentence.match(pattern);
          if (!match || !match[1]) continue;
          const taskDescription = match[1].trim().replace(/[,;:]$/, '');
          if (taskDescription.length <= 8 || taskDescription.length >= 160) continue;
          const who = addressed.exec(sentence);
          const dueDate = meetingDate ? resolveDeadline(sentence, meetingDate) ?? undefined : undefined;
          actionItems.push({
            task: `${taskDescription.charAt(0).toUpperCase()}${taskDescription.slice(1)}`,
            assignee: who ? who[1] : entry.speaker,
            dueDate,
            status: 'open',
          });
          break;
        }
      }
    }

    const seen = new Set<string>();
    return actionItems
      .filter((a) => {
        const key = a.task.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }

  /** Sentences that record agreements or decisions. */
  public static extractDecisions(entries: ITranscriptEntry[]): string[] {
    return this.pickSentences(entries, /\b(decided|agreed|approved|we'll go with|we will go with|finali[sz]ed|confirmed|let's go with|tay hua|final hai|fix hai)\b/i, 6);
  }

  /** Sentences that mention risks, blockers or concerns. */
  public static extractRisks(entries: ITranscriptEntry[]): string[] {
    return this.pickSentences(entries, /\b(risk|blocker|blocked|concern|delay|delayed|issue|problem|dependency|worried|stuck|dikkat|atka)\b/i, 6);
  }

  /** Open questions that still need an answer. */
  public static extractFollowUps(entries: ITranscriptEntry[]): string[] {
    return this.pickSentences(entries, /\?\s*$/, 6);
  }

  private static pickSentences(entries: ITranscriptEntry[], re: RegExp, max: number): string[] {
    const out: string[] = [];
    for (const e of entries) {
      for (const sentence of e.text.split(SENTENCES)) {
        const s = sentence.trim();
        if (s.length > 12 && s.length < 240 && re.test(s) && !out.some((o) => o.endsWith(s))) out.push(`${e.speaker}: ${s}`);
        if (out.length >= max) return out;
      }
    }
    return out;
  }

  private static parseTimestampToSeconds(ts: string): number {
    const parts = ts.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    if (parts.length === 3) {
      return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    return 0;
  }
}
