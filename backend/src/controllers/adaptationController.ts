import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { WorkspaceConfiguration } from '../models/WorkspaceConfiguration.js';
import { AdaptationHistory } from '../models/AdaptationHistory.js';
import { Task } from '../models/Task.js';
import { Meeting } from '../models/Meeting.js';
import { Course } from '../models/Course.js';
import { UserPreference } from '../models/UserPreference.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { sendSuccess, sendError } from '../utils/response.js';

export type Intent = 'meeting' | 'communication' | 'study' | 'project' | 'analytics' | 'general';
export type FocusId =
  | 'agenda' | 'clientContext' | 'recentComms' | 'actionItems' | 'prepChecklist'
  | 'unread' | 'replyDrafts' | 'revisionTopics' | 'studyPlan' | 'quizzes'
  | 'overdue' | 'blockers' | 'deadlines' | 'activityChart' | 'metrics'
  | 'investigation' | 'assistant';

export interface AdaptationProposal {
  intent: Intent;
  matched: string[];
  confidence: number;
  workspace: { id: string; label: string; path: string };
  focus: FocusId[];
  order: string[];
  actions: { label: string; to: string }[];
  summary: string;
  explanation: string[];
}

export interface Rule {
  intent: Intent;
  strong: string[];
  weak: string[];
  workspace: { id: string; label: string; path: string };
  focus: FocusId[];
  order: string[];
  actions: { label: string; to: string }[];
  summary: string;
}

const RULES: Rule[] = [
  {
    intent: 'meeting',
    strong: ['meeting', 'agenda', 'client', 'attendee', 'kickoff', 'standup', 'sync'],
    weak: ['prepare', 'tomorrow', 'schedule', 'call', 'calendar'],
    workspace: { id: 'meetings', label: 'Meeting Workspace', path: '/app/meetings' },
    focus: ['agenda', 'clientContext', 'recentComms', 'actionItems', 'prepChecklist'],
    order: ['meetings', 'messages', 'tasks'],
    actions: [
      { label: 'Open Meeting Workspace', to: '/app/meetings' },
      { label: 'Review client communications', to: '/app/communication' },
    ],
    summary: 'Prioritizing upcoming client meetings and preparation items',
  },
  {
    intent: 'communication',
    strong: ['message', 'unread', 'reply', 'inbox', 'email', 'summarize', 'respond', 'draft'],
    weak: ['chat', 'team', 'urgent', 'communication'],
    workspace: { id: 'communication', label: 'Communication', path: '/app/communication' },
    focus: ['unread', 'replyDrafts'],
    order: ['messages', 'notifications', 'tasks'],
    actions: [
      { label: 'Open Inbox', to: '/app/communication' },
      { label: 'Triage priority messages', to: '/app/communication' },
    ],
    summary: 'Filtering unread messages and urgent inbox threads',
  },
  {
    intent: 'study',
    strong: ['exam', 'study', 'quiz', 'revision', 'revise', 'course', 'learn', 'flashcard', 'syllabus', 'midterm'],
    weak: ['prepare', 'practice', 'test', 'review'],
    workspace: { id: 'study', label: 'Study & Learning', path: '/app/study' },
    focus: ['revisionTopics', 'studyPlan', 'quizzes'],
    order: ['learning', 'tasks'],
    actions: [
      { label: 'Open Study Workspace', to: '/app/study' },
      { label: 'Review Assessment Checklist', to: '/app/study' },
    ],
    summary: 'Organizing revision topics and upcoming exam deadlines',
  },
  {
    intent: 'project',
    strong: ['overdue', 'blocker', 'blockers', 'task', 'tasks', 'deadline', 'project', 'sprint', 'kanban'],
    weak: ['late', 'status', 'show', 'progress'],
    workspace: { id: 'projects', label: 'Project Management', path: '/app/projects' },
    focus: ['overdue', 'blockers', 'deadlines'],
    order: ['projects', 'tasks', 'meetings'],
    actions: [
      { label: 'Open Project Board', to: '/app/projects' },
      { label: 'Review Overdue Tasks', to: '/app/projects' },
    ],
    summary: 'Elevating project blockers, overdue tasks, and milestone status',
  },
  {
    intent: 'analytics',
    strong: ['active users', 'declined', 'decline', 'decrease', 'analytics', 'metric', 'metrics', 'revenue', 'churn', 'conversion', 'trend'],
    weak: ['investigate', 'why', 'drop', 'chart', 'data'],
    workspace: { id: 'analytics', label: 'Data Analytics', path: '/app/analytics' },
    focus: ['activityChart', 'metrics', 'investigation'],
    order: ['analytics', 'projects'],
    actions: [
      { label: 'Open Data Analytics', to: '/app/analytics' },
      { label: 'View 90-Day Trends', to: '/app/analytics' },
    ],
    summary: 'Displaying activity metrics and trend comparisons',
  },
];

const GENERAL_RULE: Rule = {
  intent: 'general',
  strong: [],
  weak: [],
  workspace: { id: 'assistant', label: 'AI Assistant', path: '/app/assistant' },
  focus: ['assistant'],
  order: ['assistant', 'tasks', 'meetings'],
  actions: [{ label: 'Open AI Assistant', to: '/app/assistant' }],
  summary: 'General workspace guidance and intent assistance',
};

export function classifyIntentDeterministically(input: string): {
  rule: Rule;
  matched: string[];
  score: number;
} {
  const normalized = ' ' + input.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ') + ' ';
  let best = GENERAL_RULE;
  let bestScore = 0;
  let matched: string[] = [];

  for (const r of RULES) {
    const hs = r.strong.filter((k) => normalized.includes(' ' + k));
    const hw = r.weak.filter((k) => normalized.includes(' ' + k));
    const score = hs.length * 2 + hw.length;

    if (score > bestScore) {
      best = r;
      bestScore = score;
      matched = [...hs, ...hw];
    }
  }

  return { rule: best, matched, score: bestScore };
}

export class AdaptationController {
  public static async preview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        sendError(res, 'Intent text is required', 400);
        return;
      }

      const { rule, matched, score } = classifyIntentDeterministically(text);
      const confidence = Math.min(0.99, score ? 0.5 + score * 0.1 : 0.4);

      // Context checks
      const userId = req.user?.userId;
      let overdueCount = 0;
      let upcomingMeetings = 0;
      let openCourses = 0;

      if (userId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const [tasks, meetings, courses] = await Promise.all([
          Task.find({ status: { $ne: 'done' } }),
          Meeting.find({ date: { $gte: todayStr } }),
          Course.find(),
        ]);
        overdueCount = tasks.filter((t) => t.due && t.due < todayStr).length;
        upcomingMeetings = meetings.length;
        openCourses = courses.length;
      }

      const explanation = [
        `Detected intent: ${rule.intent}${matched.length ? ` (matched keywords: "${matched.slice(0, 4).join('", "')}")` : ' (general productivity intent)'}. Confidence: ${Math.round(confidence * 100)}%.`,
        `Selected workspace: ${rule.workspace.label}.`,
        `Focus areas brought forward: ${rule.focus.join(', ')}.`,
        `Prioritized widget layout: ${rule.order.join(' → ')}.`,
      ];

      if (rule.intent === 'project' && overdueCount > 0) {
        explanation.push(`Identified ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} in your database to review.`);
      } else if (rule.intent === 'meeting' && upcomingMeetings > 0) {
        explanation.push(`Surfaced ${upcomingMeetings} upcoming meeting${upcomingMeetings > 1 ? 's' : ''} with agendas.`);
      } else if (rule.intent === 'study' && openCourses > 0) {
        explanation.push(`Connected ${openCourses} active course${openCourses > 1 ? 's' : ''} with assessment milestones.`);
      }

      const proposal: AdaptationProposal = {
        intent: rule.intent,
        matched,
        confidence,
        workspace: rule.workspace,
        focus: rule.focus,
        order: rule.order,
        actions: rule.actions,
        summary: rule.summary,
        explanation,
      };

      sendSuccess(res, proposal, 'Adaptation preview generated');
    } catch (err) {
      next(err);
    }
  }

  public static async apply(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const { text, proposal } = req.body;
      const userId = req.user.userId;

      // Get current configuration or preferences as previous state
      const existingConfig = await WorkspaceConfiguration.findOne({ userId });
      const previousState = existingConfig ? existingConfig.toJSON() : {};

      const { rule, matched, score } = classifyIntentDeterministically(text || proposal?.intent || 'general');
      const confidence = proposal?.confidence || Math.min(0.99, score ? 0.5 + score * 0.1 : 0.4);

      const appliedConfig = {
        name: proposal?.workspace?.label || rule.workspace.label,
        intent: rule.intent,
        workspace: proposal?.workspace || rule.workspace,
        focus: proposal?.focus || rule.focus,
        order: proposal?.order || rule.order,
        activeWidgets: proposal?.order || rule.order,
        density: 'comfortable' as const,
        isDefault: false,
        appliedAt: new Date(),
      };

      // Save active configuration
      await WorkspaceConfiguration.findOneAndUpdate(
        { userId },
        { $set: { ...appliedConfig, userId } },
        { upsert: true, new: true }
      );

      // Record in history
      const historyRecord = await AdaptationHistory.create({
        userId,
        intentText: text || rule.intent,
        classifiedIntent: rule.intent,
        matchedKeywords: matched,
        confidence,
        previousConfig: previousState,
        appliedConfig,
        explanation: proposal?.explanation || [`Reorganized workspace for ${rule.workspace.label}`],
        appliedAt: new Date(),
        undone: false,
      });

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId,
        action: 'ADAPTATION_APPLIED',
        detail: `Adapted workspace to "${rule.workspace.label}" for intent: "${text}"`,
        level: 'info',
      });

      sendSuccess(
        res,
        {
          configuration: appliedConfig,
          historyId: historyRecord.id,
        },
        'Adaptation applied successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  public static async history(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const history = await AdaptationHistory.find({ userId: req.user.userId })
        .sort({ appliedAt: -1 })
        .limit(20);

      sendSuccess(res, history, 'Adaptation history retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async undo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const userId = req.user.userId;

      // Find latest non-undone history record
      const latestHistory = await AdaptationHistory.findOne({
        userId,
        undone: false,
      }).sort({ appliedAt: -1 });

      if (!latestHistory) {
        sendError(res, 'No previous adaptation to undo', 404);
        return;
      }

      latestHistory.undone = true;
      latestHistory.undoneAt = new Date();
      await latestHistory.save();

      // Restore previous config if present, or reset to user preferences default
      const prev = latestHistory.previousConfig;
      let restored;

      if (prev && Object.keys(prev).length > 0 && prev.order) {
        restored = prev;
        await WorkspaceConfiguration.findOneAndUpdate(
          { userId },
          { $set: prev },
          { upsert: true }
        );
      } else {
        const userPrefs = await UserPreference.findOne({ userId });
        restored = {
          name: 'Default Workspace',
          intent: 'general',
          workspace: { id: 'dashboard', label: 'Default Dashboard', path: '/app' },
          focus: [],
          order: userPrefs?.order || ['tasks', 'meetings', 'messages'],
          activeWidgets: userPrefs?.widgets || ['tasks', 'meetings', 'messages'],
          density: 'comfortable',
          isDefault: true,
        };
        await WorkspaceConfiguration.findOneAndDelete({ userId });
      }

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId,
        action: 'ADAPTATION_UNDONE',
        detail: `Undid adaptation for intent "${latestHistory.intentText}"`,
        level: 'info',
      });

      sendSuccess(res, restored, 'Adaptation undone successfully');
    } catch (err) {
      next(err);
    }
  }
}
