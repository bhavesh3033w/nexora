import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Meeting } from '../models/Meeting.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { TranscriptService } from '../services/transcriptService.js';
import { AiAnalyzerService } from '../services/aiAnalyzerService.js';

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required'),
  client: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  timezone: z.string().optional(),
  agenda: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.number().optional(),
  meetingUrl: z.string().optional(),
  meetUrl: z.string().optional(),
  attendees: z.array(z.any()).optional(),
  createGoogleEvent: z.boolean().optional(),
  checklist: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
});

export const processTranscriptSchema = z.object({
  rawTranscript: z.string().optional(),
  text: z.string().optional(),
});

export class MeetingController {
  public static async getMeetings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filter: any = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.search) {
        filter.$or = [
          { title: { $regex: req.query.search, $options: 'i' } },
          { client: { $regex: req.query.search, $options: 'i' } },
        ];
      }

      const meetings = await Meeting.find(filter)
        .sort({ scheduledAt: -1, date: -1 });

      if (req.query.paginated === 'true') {
        const page = parseInt((req.query.page as string) || '1', 10);
        const limit = parseInt((req.query.limit as string) || '20', 10);
        const total = await Meeting.countDocuments(filter);
        sendPaginated(res, meetings, { page, limit, total });
        return;
      }

      sendSuccess(res, meetings, 'Meetings retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async getMeetingById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = await Meeting.findById(id);

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(res, meeting, 'Meeting details retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async createMeeting(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const {
        title,
        client,
        date,
        time,
        timezone,
        agenda,
        notes,
        description,
        durationMinutes,
        meetingUrl,
        meetUrl,
        attendees,
        checklist,
        actions,
      } = req.body;

      const meetingDate = date || new Date().toISOString().slice(0, 10);
      const meetingTime = time || '10:00 AM';

      const meeting = await Meeting.create({
        title,
        client: client || 'General Client',
        date: meetingDate,
        time: meetingTime,
        timezone: timezone || 'UTC',
        description: description || '',
        scheduledAt: new Date(`${meetingDate}T${meetingTime.split(' ')[0] || '10:00'}:00Z`),
        durationMinutes: durationMinutes || 30,
        host: req.user.userId,
        attendees: attendees || [req.user.email],
        agenda: agenda || '',
        notes: notes || '',
        checklist: checklist || [
          { id: '1', text: 'Review client goals and background', done: false },
          { id: '2', text: 'Prepare agenda presentation slides', done: false },
        ],
        actions: actions || [
          { id: '1', text: 'Send follow-up notes and action items', done: false },
        ],
        meetUrl: meetUrl || meetingUrl || `https://meet.google.com/nex-${Math.random().toString(36).substring(7)}`,
        status: 'scheduled',
        reportStatus: 'none',
        transcript: [],
      });

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId: req.user.userId,
        action: 'MEETING_CREATED',
        detail: `Scheduled meeting "${meeting.title}" with client ${meeting.client}`,
        level: 'info',
      });

      sendSuccess(res, meeting, 'Meeting scheduled successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateMeeting(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates._id;
      delete updates.id;

      const meeting = await Meeting.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(res, meeting, 'Meeting updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async schedule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = await Meeting.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'scheduled',
            googleEventId: `g_event_${Date.now()}`,
            calendarUrl: `https://calendar.google.com/calendar/event?eid=${Date.now()}`,
          },
        },
        { new: true }
      );

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(res, meeting, 'Meeting marked as scheduled');
    } catch (err) {
      next(err);
    }
  }

  public static async start(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = await Meeting.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'in_progress',
            startedAt: new Date().toISOString(),
          },
        },
        { new: true }
      );

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(
        res,
        { meetUrl: meeting.meetUrl, status: meeting.status },
        'Meeting started successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  public static async complete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = await Meeting.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'completed',
            endedAt: new Date().toISOString(),
            reportStatus: 'waiting_for_transcript',
          },
        },
        { new: true }
      );

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(res, meeting, 'Meeting completed successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async processTranscript(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const rawTranscript =
        req.body.rawTranscript ||
        req.body.text ||
        `
Alice [00:05]: Welcome everyone. We are here to review the delivery milestones for the adaptive workspace.
Client Lead [00:15]: The personalization requirements and UI look very promising. What are the next steps?
Alice [00:30]: We will finalize the deterministic adaptation rules and deliver the report by Thursday.
Bob [00:45]: I will verify the Mongo data seed and ensure all automated tests pass.
        `;

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      const cleanedResult = TranscriptService.parseRawTranscript(rawTranscript);
      const insights = await AiAnalyzerService.analyzeMeeting(meeting.title, cleanedResult.entries);
      insights.talkTimeDistribution = cleanedResult.talkTimeDistribution;

      const structuredReport = {
        summary: insights.summary,
        topics: insights.topics,
        decisions: [
          'Approved the deterministic intent-to-interface adaptation architecture.',
          'Agreed on zero external LLM API dependency for core workspace rules.',
        ],
        actionItems: insights.actionItems.map((a: any, i: number) => ({
          id: `ai_${i}`,
          text: a.task,
          owner: a.assignee || 'Dev Team',
          deadline: a.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
          done: false,
        })),
        risks: ['Ensure fast response times without network roundtrips.'],
        followUps: ['Share updated workspace walkthrough with stakeholders.'],
        generatedAt: new Date().toISOString(),
        source: 'manual-transcript' as const,
        engine: 'Nexora Deterministic Insight Engine',
      };

      meeting.rawTranscript = rawTranscript;
      meeting.cleanedTranscript = cleanedResult.cleanedText;
      meeting.transcript = cleanedResult.entries;
      meeting.insights = insights;
      meeting.report = structuredReport;
      meeting.reportStatus = 'ready';
      meeting.status = 'completed';
      meeting.processedAt = new Date().toISOString();

      await meeting.save();

      sendSuccess(res, meeting, 'Transcript processed successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async submitTranscript(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    return MeetingController.processTranscript(req, res, next);
  }

  public static async setActionItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id, itemId } = req.params;
      const { done } = req.body;

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      // Check in actions
      const act = meeting.actions.find((a) => a.id === itemId);
      if (act) {
        act.done = Boolean(done);
      }

      // Check in checklist
      const chk = meeting.checklist.find((c) => c.id === itemId);
      if (chk) {
        chk.done = Boolean(done);
      }

      // Check in report actionItems
      if (meeting.report?.actionItems) {
        const rAct = meeting.report.actionItems.find((a: any) => a.id === itemId);
        if (rAct) {
          rAct.done = Boolean(done);
        }
      }

      await meeting.save();
      sendSuccess(res, meeting, 'Action item updated');
    } catch (err) {
      next(err);
    }
  }

  public static async deleteMeeting(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const meeting = await Meeting.findByIdAndDelete(id);

      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      sendSuccess(res, { deletedId: id }, 'Meeting deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}
