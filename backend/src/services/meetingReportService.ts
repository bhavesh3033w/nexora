import mongoose from 'mongoose';
import { Meeting, IMeeting, IMeetingReport, IMeetingReportActionItem, ActionItemStatus } from '../models/Meeting.js';
import { Task, ITask } from '../models/Task.js';
import { TranscriptService } from './transcriptService.js';
import { AiAnalyzerService } from './aiAnalyzerService.js';
import { addDaysIso } from '../utils/deadline.js';

/** Days given to an action item when no deadline was stated in the meeting. */
export const DEFAULT_DEADLINE_DAYS = 7;

const meetingDateOf = (m: IMeeting) =>
  m.date || (m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

const priorityOf = (text: string): 'low' | 'medium' | 'high' =>
  /\b(urgent|asap|critical|blocker|immediately|jaldi|turant)\b/i.test(text) ? 'high' : /\b(nice to have|later|someday|optional)\b/i.test(text) ? 'low' : 'medium';

export class MeetingReportService {
  /**
   * Transcript → cleaned entries → insights → structured report, written onto the meeting.
   * Action items are mirrored into the Tasks workspace so they show up on the Projects board and Action Tracker.
   */
  public static async generate(
    meeting: IMeeting,
    rawTranscript: string,
    source: IMeetingReport['source'],
    creatorId: string
  ): Promise<IMeeting> {
    const meetingDate = meetingDateOf(meeting);
    const cleaned = TranscriptService.parseRawTranscript(rawTranscript);
    const insights = await AiAnalyzerService.analyzeMeeting(meeting.title, cleaned.entries, meetingDate);
    insights.talkTimeDistribution = cleaned.talkTimeDistribution;

    const actionItems: IMeetingReportActionItem[] = insights.actionItems.map((a, i) => ({
      id: `ai_${Date.now().toString(36)}_${i}`,
      text: a.task,
      owner: a.assignee && !/^unassigned$/i.test(a.assignee) ? a.assignee : 'Unassigned',
      deadline: a.dueDate || addDaysIso(meetingDate, DEFAULT_DEADLINE_DAYS),
      deadlineSource: a.dueDate ? 'transcript' : 'default',
      priority: priorityOf(a.task),
      done: false,
      status: 'todo',
    }));

    meeting.rawTranscript = rawTranscript;
    meeting.cleanedTranscript = cleaned.cleanedText;
    meeting.transcript = cleaned.entries;
    meeting.insights = insights;
    meeting.report = {
      summary: insights.summary,
      topics: insights.topics,
      decisions: insights.decisions ?? [],
      actionItems,
      risks: insights.risks ?? [],
      followUps: insights.followUps ?? [],
      generatedAt: new Date().toISOString(),
      source,
      engine: insights.engine ?? 'Nexora Deterministic Insight Engine',
    };
    meeting.reportStatus = 'ready';
    meeting.reportError = undefined;
    meeting.status = 'completed';
    meeting.processedAt = new Date().toISOString();

    await this.syncTasks(meeting, creatorId, true);
    meeting.markModified('report');
    await meeting.save();
    return meeting;
  }

  /**
   * Ensures every report action item has a Task. With `replace`, tasks from a previous report of
   * this meeting are removed first (regenerating a report must not leave stale tasks behind).
   */
  public static async syncTasks(meeting: IMeeting, creatorId: string, replace = false): Promise<boolean> {
    const items = meeting.report?.actionItems ?? [];
    const meetingId = meeting._id.toString();
    if (replace) await Task.deleteMany({ meetingId });

    let changed = false;
    for (const item of items) {
      if (!replace && item.taskId && (await Task.exists({ _id: item.taskId }))) continue;
      const status: ActionItemStatus = item.status ?? (item.done ? 'done' : 'todo');
      const task = await Task.create({
        title: item.text,
        description: `Action item from meeting "${meeting.title}" (${meetingDateOf(meeting)}).`,
        assignee: item.owner || 'Unassigned',
        creator: new mongoose.Types.ObjectId(creatorId),
        status,
        priority: item.priority ?? 'medium',
        due: item.deadline || '',
        dueDate: item.deadline ? new Date(item.deadline) : undefined,
        completedAt: status === 'done' ? (item.completedAt ? new Date(item.completedAt) : new Date()) : undefined,
        tags: ['meeting'],
        meetingId,
        actionItemId: item.id,
      });
      item.taskId = task._id.toString();
      item.status = status;
      changed = true;
    }
    if (changed) meeting.markModified('report');
    return changed;
  }

  /** Applies a status change to one report action item (and its task). */
  public static async setItemStatus(meeting: IMeeting, itemId: string, status: ActionItemStatus): Promise<IMeetingReportActionItem | null> {
    const item = meeting.report?.actionItems.find((a) => a.id === itemId);
    if (!item) return null;
    this.applyStatus(item, status);
    meeting.markModified('report');
    if (item.taskId) {
      await Task.findByIdAndUpdate(item.taskId, {
        $set: { status, completedAt: status === 'done' ? new Date(item.completedAt!) : undefined },
      });
    }
    return item;
  }

  /** Called after a Task changes elsewhere (Projects board, dashboard) so the meeting report stays in step. */
  public static async syncFromTask(task: ITask): Promise<void> {
    if (!task.meetingId || !task.actionItemId) return;
    const meeting = await Meeting.findById(task.meetingId);
    const item = meeting?.report?.actionItems.find((a) => a.id === task.actionItemId);
    if (!meeting || !item) return;
    const status: ActionItemStatus = task.status === 'done' ? 'done' : task.status === 'todo' || (task.status as string) === 'backlog' ? 'todo' : 'doing';
    this.applyStatus(item, status, task.completedAt);
    item.deadline = task.due || item.deadline;
    item.owner = task.assignee || item.owner;
    meeting.markModified('report');
    await meeting.save();
  }

  private static applyStatus(item: IMeetingReportActionItem, status: ActionItemStatus, completedAt?: Date) {
    item.status = status;
    item.done = status === 'done';
    item.completedAt = status === 'done' ? (item.completedAt ?? (completedAt ?? new Date()).toISOString()) : undefined;
  }
}
