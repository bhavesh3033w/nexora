// Intent-to-Interface engine: deterministic, configuration-driven, replaceable by a Spring Boot AI endpoint.
// Contract for a future backend: POST /api/adaptive/intent { text } -> AdaptiveConfig
import type { WidgetId } from '../../types';

export type Intent = 'meeting' | 'communication' | 'study' | 'project' | 'analytics' | 'general';
export type FocusId = 'agenda' | 'clientContext' | 'recentComms' | 'actionItems' | 'prepChecklist' | 'unread' | 'replyDrafts'
  | 'revisionTopics' | 'studyPlan' | 'quizzes' | 'overdue' | 'blockers' | 'deadlines' | 'activityChart' | 'metrics' | 'investigation' | 'assistant';
export interface AdaptiveConfig {
  intent: Intent; matched: string[]; confidence: number;
  workspace: { id: string; label: string; path: string };
  focus: FocusId[]; order: WidgetId[];
  actions: { label: string; to: string }[];
  summary: string;
}
export const FOCUS_LABEL: Record<FocusId, string> = {
  agenda: 'Meeting agenda', clientContext: 'Client context', recentComms: 'Recent communications', actionItems: 'Open action items', prepChecklist: 'Preparation checklist',
  unread: 'Unread messages', replyDrafts: 'Reply drafting', revisionTopics: 'Revision topics', studyPlan: 'Study plan', quizzes: 'Practice quizzes',
  overdue: 'Overdue tasks', blockers: 'Blockers', deadlines: 'Upcoming deadlines', activityChart: 'Activity chart', metrics: 'Key metrics', investigation: 'Investigation suggestions', assistant: 'AI Assistant',
};
interface Rule { intent: Intent; strong: string[]; weak: string[]; workspace: AdaptiveConfig['workspace']; focus: FocusId[]; order: WidgetId[]; actions: AdaptiveConfig['actions']; summary: string }
const RULES: Rule[] = [
  { intent: 'meeting', strong: ['meeting', 'agenda', 'client', 'attendee', 'kickoff', 'standup'], weak: ['prepare', 'tomorrow', 'schedule', 'call'],
    workspace: { id: 'meetings', label: 'Meeting Workspace', path: '/app/meetings' },
    focus: ['agenda', 'clientContext', 'recentComms', 'actionItems', 'prepChecklist'], order: ['meetings', 'messages', 'tasks'],
    actions: [{ label: 'Open Meeting Workspace', to: '/app/meetings' }, { label: 'Review client messages', to: '/app/communication' }], summary: 'Preparing for a meeting' },
  { intent: 'communication', strong: ['message', 'unread', 'reply', 'inbox', 'email', 'summarize', 'respond', 'draft'], weak: [],
    workspace: { id: 'communication', label: 'Communication', path: '/app/communication' },
    focus: ['unread', 'replyDrafts'], order: ['messages', 'notifications', 'tasks'],
    actions: [{ label: 'Open inbox', to: '/app/communication' }, { label: 'Draft replies with the Assistant', to: '/app/assistant' }], summary: 'Catching up on messages' },
  { intent: 'study', strong: ['exam', 'study', 'quiz', 'revision', 'revise', 'course', 'learn', 'operating systems', 'flashcard', 'syllabus'], weak: ['prepare', 'practice'],
    workspace: { id: 'study', label: 'Study & Learning', path: '/app/study' },
    focus: ['revisionTopics', 'studyPlan', 'quizzes'], order: ['learning', 'tasks'],
    actions: [{ label: 'Start practice quiz', to: '/app/study' }, { label: 'Open Study workspace', to: '/app/study' }], summary: 'Preparing for an exam' },
  { intent: 'project', strong: ['overdue', 'blocker', 'blockers', 'task', 'tasks', 'deadline', 'project', 'sprint', 'kanban'], weak: ['late', 'status', 'show'],
    workspace: { id: 'projects', label: 'Project Management', path: '/app/projects' },
    focus: ['overdue', 'blockers', 'deadlines'], order: ['projects', 'tasks', 'meetings'],
    actions: [{ label: 'Open board', to: '/app/projects' }, { label: 'Ask for prioritization help', to: '/app/assistant' }], summary: 'Reviewing project risk' },
  { intent: 'analytics', strong: ['active users', 'declined', 'decline', 'decrease', 'analytics', 'metric', 'metrics', 'revenue', 'churn', 'conversion', 'trend'], weak: ['investigate', 'why', 'drop'],
    workspace: { id: 'analytics', label: 'Data Analytics', path: '/app/analytics' },
    focus: ['activityChart', 'metrics', 'investigation'], order: ['analytics', 'projects'],
    actions: [{ label: 'Open Analytics', to: '/app/analytics' }, { label: 'Explain the trend', to: '/app/assistant' }], summary: 'Investigating a metric change' },
];
const GENERAL: Rule = { intent: 'general', strong: [], weak: [], workspace: { id: 'assistant', label: 'AI Assistant', path: '/app/assistant' },
  focus: ['assistant'], order: ['assistant'], actions: [{ label: 'Open AI Assistant', to: '/app/assistant' }], summary: 'General assistance' };

export function classifyIntent(input: string): AdaptiveConfig {
  const t = ' ' + input.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ') + ' ';
  let best: Rule = GENERAL; let bestScore = 0; let matched: string[] = [];
  for (const r of RULES) {
    const hs = r.strong.filter(k => t.includes(' ' + k) ); const hw = r.weak.filter(k => t.includes(' ' + k));
    const score = hs.length * 2 + hw.length;
    if (score > bestScore) { best = r; bestScore = score; matched = [...hs, ...hw]; }
  }
  return { intent: best.intent, matched, confidence: Math.min(0.99, bestScore ? 0.5 + bestScore * 0.1 : 0.4),
    workspace: best.workspace, focus: best.focus, order: best.order, actions: best.actions, summary: best.summary };
}
