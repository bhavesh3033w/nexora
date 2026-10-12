import { IMeetingInsights, ITranscriptEntry } from '../models/Meeting.js';
import { TranscriptService } from './transcriptService.js';
import { env } from '../config/env.js';

export class AiAnalyzerService {
  /**
   * Generates comprehensive meeting insights from transcript entries
   */
  public static async analyzeMeeting(
    title: string,
    entries: ITranscriptEntry[],
    meetingDate?: string
  ): Promise<IMeetingInsights> {
    const rawText = entries.map((e) => `${e.speaker}: ${e.text}`).join('\n');
    const heuristicActionItems = TranscriptService.extractActionItemsHeuristic(entries, meetingDate);

    // If Gemini API Key is available, invoke Gemini AI API
    if (env.GEMINI_API_KEY) {
      try {
        const aiResult = await this.analyzeWithGemini(title, rawText, meetingDate);
        if (aiResult) return { ...aiResult, engine: `Gemini (${env.GEMINI_MODEL})` };
      } catch (err) {
        console.warn('[AiAnalyzerService] Gemini API call fallback to heuristic engine:', err);
      }
    }

    // High quality deterministic NLP fallback
    return { ...this.generateHeuristicInsights(title, entries, heuristicActionItems), engine: 'Nexora Deterministic Insight Engine' };
  }

  private static async analyzeWithGemini(
    title: string,
    transcriptText: string,
    meetingDate?: string
  ): Promise<IMeetingInsights | null> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this business meeting titled "${title}"${meetingDate ? ` held on ${meetingDate}` : ''}.
The transcript may mix English and Hindi (Hinglish); always answer in English.
Only use facts stated in the transcript. Use empty arrays when nothing applies.
Transcript:
${transcriptText.slice(0, 60000)}

Return ONLY valid JSON strictly adhering to this schema:
{
  "summary": "3-5 sentence executive summary",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "decisions": ["decision that was agreed"],
  "risks": ["risk, blocker or concern raised"],
  "followUps": ["open question still to be answered"],
  "actionItems": [{"task": "concrete action, imperative", "assignee": "person responsible or Unassigned", "dueDate": "YYYY-MM-DD resolved from what was said relative to the meeting date, or null if no deadline was stated", "status": "open"}],
  "sentiment": {"overall": "positive|neutral|negative", "score": 0.8},
  "topics": ["topic 1", "topic 2"],
  "engagementScore": 88
}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) return null;
      const data: any = await response.json();
      const content = (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').replace(/^```(?:json)?\s*|\s*```$/g, '');
      if (!content) return null;

      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || `Executive discussion on ${title}.`,
        keyTakeaways: parsed.keyTakeaways || [],
        actionItems: (parsed.actionItems || []).map((a: any) => ({
          task: String(a.task || '').trim(),
          assignee: a.assignee || undefined,
          dueDate: typeof a.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : undefined,
          status: 'open' as const,
        })).filter((a: any) => a.task),
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
        sentiment: parsed.sentiment || { overall: 'positive', score: 0.85 },
        topics: parsed.topics || ['Strategy', 'Execution'],
        talkTimeDistribution: [],
        engagementScore: parsed.engagementScore || 90,
      };
    } catch {
      return null;
    }
  }

  private static generateHeuristicInsights(
    title: string,
    entries: ITranscriptEntry[],
    actionItems: any[]
  ): IMeetingInsights {
    const speakers = Array.from(new Set(entries.map((e) => e.speaker)));
    const topics = this.extractTopics(title, entries);

    const positiveWords = ['great', 'excellent', 'agree', 'good', 'success', 'approved', 'progress', 'perfect'];
    const negativeWords = ['blocker', 'issue', 'problem', 'delay', 'failed', 'risk', 'disagree', 'critical'];

    let posCount = 0;
    let negCount = 0;

    for (const entry of entries) {
      const lower = entry.text.toLowerCase();
      for (const w of positiveWords) if (lower.includes(w)) posCount++;
      for (const w of negativeWords) if (lower.includes(w)) negCount++;
    }

    let overall: 'positive' | 'neutral' | 'negative' = 'neutral';
    let score = 0.65;
    if (posCount > negCount + 2) {
      overall = 'positive';
      score = 0.82;
    } else if (negCount > posCount + 1) {
      overall = 'negative';
      score = 0.38;
    }

    const decisions = TranscriptService.extractDecisions(entries);
    const risks = TranscriptService.extractRisks(entries);
    const followUps = TranscriptService.extractFollowUps(entries);
    const summary = this.extractiveSummary(title, entries, speakers, topics, actionItems.length, decisions.length);

    const extracted = [...decisions, ...actionItems.map((a) => `${a.assignee || 'Team'} to ${a.task.charAt(0).toLowerCase()}${a.task.slice(1)}`)];
    // Nothing decided or assigned: fall back to the longest statements actually made in the meeting.
    const keyTakeaways = (extracted.length ? extracted : [...entries].sort((x, y) => y.text.length - x.text.length).slice(0, 3).map((e) => `${e.speaker}: ${e.text}`)).slice(0, 5);

    return {
      summary,
      keyTakeaways,
      actionItems,
      decisions,
      risks,
      followUps,
      sentiment: { overall, score },
      topics,
      talkTimeDistribution: [],
      engagementScore: Math.min(95, 60 + speakers.length * 8 + entries.length * 2),
    };
  }

  /** Builds a summary from the transcript's own highest-signal sentences — never canned text. */
  private static extractiveSummary(
    title: string,
    entries: ITranscriptEntry[],
    speakers: string[],
    topics: string[],
    actionCount: number,
    decisionCount: number
  ): string {
    if (entries.length === 0) return `No transcript content was found for "${title}".`;
    const signal = /\b(decided|agreed|deadline|launch|release|deliver|milestone|priority|plan|goal|budget|client|risk|blocker|next step|will|need)\b/i;
    const sentences = entries.flatMap((e) =>
      e.text.split(/(?<=[.!?])\s+/).map((s, i) => ({ s: s.trim(), speaker: e.speaker, score: (signal.test(s) ? 2 : 0) + (s.length > 50 ? 1 : 0) - i * 0.01 }))
    ).filter((x) => x.s.length > 25 && !/\?$/.test(x.s));
    const top = [...sentences].sort((a, b) => b.score - a.score).slice(0, 3);
    const ordered = sentences.filter((x) => top.includes(x)).map((x) => `${x.speaker}: "${x.s}"`);
    const lead = `${speakers.length} participant${speakers.length === 1 ? '' : 's'} (${speakers.join(', ')}) discussed ${topics.slice(0, 2).join(' and ').toLowerCase()}.`;
    const tail = `${decisionCount} decision${decisionCount === 1 ? '' : 's'} and ${actionCount} action item${actionCount === 1 ? '' : 's'} were captured.`;
    return [lead, ...ordered, tail].join(' ');
  }

  private static extractTopics(title: string, entries: ITranscriptEntry[]): string[] {
    const defaultTopics = ['Strategy', 'Project Review', 'Team Collaboration'];
    const text = (title + ' ' + entries.map((e) => e.text).join(' ')).toLowerCase();

    const candidates = [
      { name: 'Architecture & Engineering', words: ['architecture', 'api', 'backend', 'frontend', 'code', 'database'] },
      { name: 'Sprint Planning & Roadmaps', words: ['sprint', 'roadmap', 'milestone', 'deadline', 'timeline'] },
      { name: 'Product Design & UX', words: ['design', 'ui', 'ux', 'components', 'user experience'] },
      { name: 'Quality Assurance & Testing', words: ['test', 'qa', 'bug', 'regression', 'verification'] },
      { name: 'Security & Access Control', words: ['auth', 'jwt', 'security', 'permissions', 'rbac'] },
      { name: 'Analytics & Reporting', words: ['analytics', 'metrics', 'chart', 'kpi', 'performance'] },
    ];

    const matched = candidates
      .filter((c) => c.words.some((w) => text.includes(w)))
      .map((c) => c.name);

    return matched.length > 0 ? matched.slice(0, 4) : defaultTopics;
  }
}
