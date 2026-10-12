import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { Meeting, ActionItemStatus } from '../models/Meeting.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { MeetingReportService } from '../services/meetingReportService.js';
import { summarize, TrackerInput } from '../services/actionTrackerService.js';
import {
  RecordingTranscriber,
  RECORDING_MIME_TYPES,
  MAX_RECORDING_BYTES,
  TranscriptionError,
} from '../services/recordingTranscriber.js';

const EXT_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

/** Picks the MIME type sent to the transcriber, falling back to the file extension. */
function resolveRecordingMime(file: { mimetype: string; originalname: string }): string {
  if (RECORDING_MIME_TYPES.includes(file.mimetype)) return file.mimetype;
  return EXT_MIME[path.extname(file.originalname).toLowerCase()] ?? file.mimetype;
}

const recordingMulter = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(null, `nexora-rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_RECORDING_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const genericType = !file.mimetype || file.mimetype === 'application/octet-stream';
    if (RECORDING_MIME_TYPES.includes(file.mimetype) || (genericType && ext in EXT_MIME)) {
      cb(null, true);
      return;
    }
    cb(new UnsupportedRecordingError());
  },
}).single('recording');

class UnsupportedRecordingError extends Error {
  constructor() {
    super('Unsupported recording type. Upload an audio or video file (mp4, webm, mov, mkv, m4a, mp3, wav, ogg, aac, flac).');
  }
}

/** Multer middleware for POST /meetings/:id/recording; upload errors become JSON responses. */
export function recordingUpload(req: Request, res: Response, next: NextFunction): void {
  recordingMulter(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof UnsupportedRecordingError) {
      sendError(res, err.message, 400, undefined, 'VALIDATION_ERROR');
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        sendError(
          res,
          `Recording is too large. Maximum size is ${Math.round(MAX_RECORDING_BYTES / (1024 * 1024))} MB.`,
          413,
          undefined,
          'VALIDATION_ERROR'
        );
        return;
      }
      sendError(res, `Upload failed: ${err.message}`, 400, undefined, 'VALIDATION_ERROR');
      return;
    }
    next(err);
  });
}

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
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const { id } = req.params;
      const raw = String(req.body?.rawTranscript || req.body?.text || '').trim();
      if (!raw) {
        sendError(res, 'Transcript text is required.', 400, undefined, 'VALIDATION_ERROR');
        return;
      }

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      await MeetingReportService.generate(meeting, raw, 'manual-transcript', req.user.userId);
      sendSuccess(res, meeting, 'Transcript processed successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async uploadRecording(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const file = req.file;
    const cleanup = () => {
      if (file?.path) fs.promises.unlink(file.path).catch(() => undefined);
    };
    try {
      if (!req.user) {
        cleanup();
        sendError(res, 'Unauthorized', 401);
        return;
      }
      if (!file) {
        sendError(res, 'A recording file is required (multipart field "recording").', 400, undefined, 'VALIDATION_ERROR');
        return;
      }
      const meeting = await Meeting.findById(req.params.id);
      if (!meeting) {
        cleanup();
        sendError(res, 'Meeting not found', 404);
        return;
      }
      if (!RecordingTranscriber.isConfigured()) {
        cleanup();
        sendError(
          res,
          'Recording transcription is not configured on the server (GEMINI_API_KEY is missing). Upload a transcript instead.',
          503,
          undefined,
          'AI_PROVIDER_ERROR'
        );
        return;
      }

      const userId = req.user.userId;
      const mimeType = resolveRecordingMime(file);
      meeting.status = 'processing';
      meeting.reportStatus = 'processing';
      meeting.reportError = undefined;
      meeting.recordingName = file.originalname;
      await meeting.save();
      sendSuccess(res, meeting, 'Recording uploaded. Transcription started.', 202);

      // Background: transcribe -> generate report. Not awaited by the request.
      void (async () => {
        try {
          const transcript = await RecordingTranscriber.transcribe(file.path, mimeType, file.originalname);
          await MeetingReportService.generate(meeting, transcript, 'recording', userId);
        } catch (err: any) {
          console.error('[uploadRecording] transcription failed:', err?.message || err);
          try {
            const fresh = await Meeting.findById(meeting._id);
            if (fresh) {
              fresh.reportStatus =
                err instanceof TranscriptionError && err.code === 'TRANSCRIPT_NOT_AVAILABLE' ? 'transcript_unavailable' : 'failed';
              fresh.status = 'completed';
              fresh.reportError = err?.message || 'Recording could not be processed.';
              await fresh.save();
            }
          } catch (saveErr) {
            console.error('[uploadRecording] failed to record error state:', saveErr);
          }
        } finally {
          cleanup();
        }
      })();
    } catch (err) {
      cleanup();
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
      const body = req.body ?? {};
      let status: ActionItemStatus;
      if (body.status !== undefined) {
        if (!['todo', 'doing', 'done'].includes(body.status)) {
          sendError(res, "status must be one of 'todo', 'doing', 'done'.", 400, undefined, 'VALIDATION_ERROR');
          return;
        }
        status = body.status;
      } else if (body.done !== undefined) {
        status = body.done === true || body.done === 'true' ? 'done' : 'todo';
      } else {
        sendError(res, 'Provide { status } or { done }.', 400, undefined, 'VALIDATION_ERROR');
        return;
      }
      const done = status === 'done';

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        sendError(res, 'Meeting not found', 404);
        return;
      }

      const act = meeting.actions.find((a) => a.id === itemId);
      if (act) act.done = done;

      const chk = meeting.checklist.find((c) => c.id === itemId);
      if (chk) chk.done = done;

      const reportItem = await MeetingReportService.setItemStatus(meeting, itemId, status);

      if (!act && !chk && !reportItem) {
        sendError(res, 'Action item not found', 404);
        return;
      }

      await meeting.save();
      sendSuccess(res, meeting, 'Action item updated');
    } catch (err) {
      next(err);
    }
  }

  public static async actionTracker(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const meetings = await Meeting.find({ report: { $ne: null } });
      for (const m of meetings) {
        // Backfills tasks for reports generated before action items were mirrored into Tasks.
        if (await MeetingReportService.syncTasks(m, req.user.userId)) await m.save();
      }
      const meetingById = new Map(meetings.map((m) => [m._id.toString(), m]));

      const tasks = await Task.find({ meetingId: { $exists: true, $ne: null } });
      const inputs: TrackerInput[] = [];
      for (const t of tasks) {
        const m = meetingById.get(String(t.meetingId));
        if (!m) continue;
        const item = m.report?.actionItems?.find((a) => a.id === t.actionItemId);
        const rawStatus = t.status as string;
        const status: TrackerInput['status'] =
          rawStatus === 'done' ? 'done' : rawStatus === 'todo' || rawStatus === 'backlog' ? 'todo' : 'doing';
        const rawPriority = t.priority as string;
        const priority: TrackerInput['priority'] =
          rawPriority === 'urgent' || rawPriority === 'high' ? 'high' : rawPriority === 'low' ? 'low' : 'medium';
        inputs.push({
          id: t._id.toString(),
          text: t.title,
          owner: t.assignee || 'Unassigned',
          status,
          priority,
          deadline: t.due || undefined,
          deadlineSource: item?.deadlineSource,
          completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
          meetingId: m._id.toString(),
          meetingTitle: m.title,
          meetingDate: m.date || (m.scheduledAt ? new Date(m.scheduledAt).toISOString().slice(0, 10) : ''),
          actionItemId: t.actionItemId,
        });
      }

      const today = new Date().toLocaleDateString('en-CA');
      sendSuccess(res, summarize(inputs, today), 'Action tracker retrieved');
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
