import { ITranscriptEntry, IActionItem } from '../models/Meeting.js';

const FILLER_WORDS = /\b(um|uh|err|like|you know|sort of|kind of|i mean)\b/gi;

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
   * Parses raw transcript string formatted as:
   * "Speaker Name [00:12]: Text content here..."
   * into structured ITranscriptEntry array
   */
  public static parseRawTranscript(raw: string): CleanedTranscriptResult {
    if (!raw || !raw.trim()) {
      return { entries: [], cleanedText: '', speakers: [], talkTimeDistribution: [] };
    }

    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const entries: ITranscriptEntry[] = [];
    const speakerDurationMap: Record<string, number> = {};

    let currentSpeaker = 'Speaker';
    let currentTimestamp = '00:00';
    let accumulatedText = '';

    for (const line of lines) {
      // Regex for "Speaker [00:00]: text" or "Speaker: text"
      const match = line.match(/^([A-Za-z0-9\s]+?)(?:\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\])?:\s*(.*)$/);
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
   * Extract potential action items via rule-based heuristic patterns
   */
  public static extractActionItemsHeuristic(entries: ITranscriptEntry[]): IActionItem[] {
    const actionItems: IActionItem[] = [];
    const actionPatterns = [
      /(?:i will|i'll|we will|we'll|let's|action item|tasked to|please)\s+(.+?)(?:\.|$)/i,
      /(?:follow up on|prepare|deploy|fix|review|document|schedule)\s+(.+?)(?:\.|$)/i,
    ];

    for (const entry of entries) {
      for (const pattern of actionPatterns) {
        const match = entry.text.match(pattern);
        if (match && match[1]) {
          const taskDescription = match[1].trim();
          if (taskDescription.length > 8 && taskDescription.length < 150) {
            actionItems.push({
              task: `${taskDescription.charAt(0).toUpperCase()}${taskDescription.slice(1)}`,
              assignee: entry.speaker,
              status: 'open',
            });
            break;
          }
        }
      }
    }

    return actionItems.slice(0, 8);
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
