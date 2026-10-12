export type Role = 'admin' | 'user';
export interface Session { id: string; name: string; email: string; role: Role }
export type WidgetId = 'tasks' | 'meetings' | 'messages' | 'notifications' | 'learning' | 'projects' | 'analytics' | 'assistant';
export interface Prefs {
  v: number; onboarded: boolean;
  focus: string; workspace: string; layout: string; widgets: WidgetId[]; order: WidgetId[]; nav: string;
  notifications: string[]; theme: string; color: string; style: string; textSize: string; spacing: string;
  motion: string; goal: string; adaptive: string;
}
export interface Checkable { id: string; text: string; done: boolean }
export type MeetingStatus = 'draft' | 'scheduled' | 'in_progress' | 'processing' | 'completed' | 'failed';
export type ReportStatus = 'none' | 'waiting_for_transcript' | 'processing' | 'ready' | 'transcript_unavailable' | 'failed';
export interface Client { id: string; name: string; email: string; company: string }
export interface Attendee { name: string; email: string; clientId?: string }
export type ActionStatus = 'todo' | 'doing' | 'done';
export interface ReportActionItem { id: string; text: string; owner?: string; deadline?: string; deadlineSource?: 'transcript' | 'default'; priority?: 'low' | 'medium' | 'high'; done: boolean; status?: ActionStatus; completedAt?: string; taskId?: string }
export interface TranscriptEntry { speaker: string; text: string; timestamp?: string }
export type DeliveryState = 'overdue' | 'due_soon' | 'on_track' | 'no_deadline' | 'done_on_time' | 'done_late';
export interface TrackerItem {
  id: string; text: string; owner: string; status: ActionStatus; priority: 'low' | 'medium' | 'high'; deadline?: string; deadlineSource?: 'transcript' | 'default';
  completedAt?: string; createdAt?: string; meetingId: string; meetingTitle: string; meetingDate: string; actionItemId?: string;
  state: DeliveryState; daysLate: number; daysLeft: number | null;
}
export interface TrackerGroup { key: string; label: string; total: number; done: number; overdue: number; late: number; progress: number }
/** Reply of `GET /meetings/action-tracker`. `items[].id` is the Task id. */
export interface TrackerSummary {
  today: string;
  totals: { total: number; todo: number; doing: number; done: number; overdue: number; dueSoon: number; onTrack: number; noDeadline: number; doneOnTime: number; doneLate: number; progress: number; onTimeRate: number | null };
  items: TrackerItem[]; byOwner: TrackerGroup[]; byMeeting: (TrackerGroup & { date: string })[]; weekly: { week: string; created: number; completed: number }[];
}
export interface MeetingReport {
  summary: string; topics: string[]; decisions: string[]; actionItems: ReportActionItem[]; risks: string[]; followUps: string[];
  generatedAt: string; source: 'google-transcript' | 'manual-transcript' | 'recording'; engine: string;
}
/** Optional fields are populated by the backend as the meeting progresses (see docs/MEETINGS_BACKEND.md). */
export interface Meeting {
  id: string; title: string; client: string; date: string; time: string; attendees: string[]; agenda: string; notes: string; checklist: Checkable[]; actions: Checkable[];
  status?: MeetingStatus; timezone?: string; attendeeDetails?: Attendee[];
  meetUrl?: string; googleEventId?: string; calendarUrl?: string;
  reportStatus?: ReportStatus; reportError?: string; transcriptAvailable?: boolean; report?: MeetingReport | null;
  startedAt?: string; endedAt?: string; processedAt?: string;
  transcript?: TranscriptEntry[]; recordingName?: string;
}
export interface MeetingInput {
  title: string; client: string; date: string; time: string; timezone: string; agenda: string; notes: string;
  attendees: Attendee[]; createGoogleEvent: boolean;
}
export interface GoogleStatus { connected: boolean; email?: string; scopes?: string[]; transcriptAccess?: boolean; configured: boolean }
export interface StartResult { meetUrl?: string; status: MeetingStatus }
export interface Message { id: string; from: string; subject: string; body: string; unread: boolean; priority: 'high' | 'normal' | 'low'; date: string }
export interface Topic { id: string; name: string; done: boolean }
export interface Course { id: string; name: string; topics: Topic[]; assessment: { title: string; date: string }; quizBest: number | null }
export interface Project { id: string; name: string; description: string }
export interface Task { id: string; title: string; projectId: string; status: 'todo' | 'doing' | 'done'; priority: 'low' | 'medium' | 'high'; due: string; assignee: string; blocker?: string }
export interface AdminUser { id: string; name: string; email: string; workspace: string; status: 'active' | 'suspended' | 'pending'; lastActive: string }
export interface LogEntry { id: string; time: string; actor: string; action: string; detail: string; level: 'info' | 'warn' | 'critical' }
/** One day of product analytics as read by the Analytics workspace from `GET /analytics`. */
export interface DayRow { date: string; activeUsers: number; revenue: number; conversion: number; sessions: number }
/** Reply of `POST /assistant/messages`. */
export interface AssistantReply { intent: string; title: string; lines: string[]; actions: { label: string; to: string }[] }
