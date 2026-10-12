import { Request, Response, NextFunction } from 'express';
import { classifyIntentDeterministically } from './adaptationController.js';
import { Task } from '../models/Task.js';
import { Meeting } from '../models/Meeting.js';
import { Course } from '../models/Course.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class AssistantController {
  public static async handleMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        sendError(res, 'Message text is required', 400);
        return;
      }

      const { rule, matched, score } = classifyIntentDeterministically(text);
      const todayStr = new Date().toISOString().slice(0, 10);

      let lines: string[] = [];
      let actions = rule.actions;
      let title = rule.summary;

      switch (rule.intent) {
        case 'meeting': {
          const upcoming = await Meeting.find({ date: { $gte: todayStr } })
            .sort({ date: 1 })
            .limit(3);
          lines = [
            `Classified intent: Meeting Preparation (matched: "${matched.join('", "') || 'meeting'}").`,
            `Found ${upcoming.length} upcoming meeting${upcoming.length === 1 ? '' : 's'} in your workspace:`,
            ...upcoming.map(
              (m) => `• ${m.title} with ${m.client} on ${m.date} at ${m.time}`
            ),
            'Checklist items and preparation agenda have been prioritized on your dashboard.',
          ];
          break;
        }
        case 'project': {
          const [overdue, blockers] = await Promise.all([
            Task.find({ due: { $lt: todayStr, $ne: '' }, status: { $ne: 'done' } }),
            Task.find({ blocker: { $ne: '' }, status: { $ne: 'done' } }),
          ]);
          lines = [
            `Classified intent: Project & Task Risk (matched: "${matched.join('", "') || 'project'}").`,
            `Current project telemetry: ${overdue.length} overdue tasks, ${blockers.length} active blockers.`,
            ...(overdue.length > 0
              ? overdue.slice(0, 3).map((t) => `• Overdue: "${t.title}" (Due: ${t.due}, Priority: ${t.priority})`)
              : ['• No overdue tasks identified. All open milestones on track.']),
            ...(blockers.length > 0
              ? blockers.slice(0, 2).map((t) => `• Blocker on "${t.title}": ${t.blocker}`)
              : []),
          ];
          break;
        }
        case 'study': {
          const courses = await Course.find().limit(3);
          lines = [
            `Classified intent: Examination & Learning Focus (matched: "${matched.join('", "') || 'study'}").`,
            `Active learning tracks available: ${courses.length}.`,
            ...courses.map(
              (c) =>
                `• ${c.name}: Assessment scheduled for ${c.assessment?.date || 'upcoming date'} (${c.topics.filter((t) => t.done).length}/${c.topics.length} topics completed)`
            ),
            'Study widgets and topic checklists promoted to main dashboard view.',
          ];
          break;
        }
        case 'communication': {
          lines = [
            `Classified intent: Communication Triage (matched: "${matched.join('", "') || 'inbox'}").`,
            'Unread communications and priority correspondence prioritized.',
            '• Review high-priority stakeholder inquiries in the Communication workspace.',
            '• Prepare follow-up notes for pending discussion threads.',
          ];
          break;
        }
        case 'analytics': {
          lines = [
            `Classified intent: Data Analytics Investigation (matched: "${matched.join('", "') || 'metrics'}").`,
            '30-day and 90-day active user trajectories loaded.',
            '• Comparing daily active users against prior rolling period.',
            '• Analytics cards and trend charts promoted for immediate inspection.',
          ];
          break;
        }
        default: {
          title = 'Nexora Deterministic Assistant';
          lines = [
            'I am Nexora\'s intent-aware workspace assistant, powered by local deterministic rules.',
            'You can ask me to:',
            '• "Prepare for tomorrow\'s client meeting"',
            '• "Show overdue project tasks and blockers"',
            '• "Help me prepare for my upcoming exam"',
            '• "Summarize my unread messages"',
            '• "Investigate why active users have declined"',
          ];
          break;
        }
      }

      sendSuccess(
        res,
        {
          intent: rule.intent,
          title,
          lines,
          actions,
        },
        'Assistant response generated'
      );
    } catch (err) {
      next(err);
    }
  }
}
