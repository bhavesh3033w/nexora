import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICheckable {
  id: string;
  text: string;
  done: boolean;
}

export interface ITranscriptEntry {
  speaker: string;
  text: string;
  timestamp?: string;
  startTimeSeconds?: number;
}

export interface IActionItem {
  id?: string;
  task: string;
  assignee?: string;
  dueDate?: string;
  status: 'open' | 'completed';
}

export interface IMeetingReportActionItem {
  id: string;
  text: string;
  owner?: string;
  deadline?: string;
  done: boolean;
}

export interface IMeetingReport {
  summary: string;
  topics: string[];
  decisions: string[];
  actionItems: IMeetingReportActionItem[];
  risks: string[];
  followUps: string[];
  generatedAt: string;
  source: 'google-transcript' | 'manual-transcript';
  engine: string;
}

export interface IMeetingInsights {
  summary: string;
  keyTakeaways: string[];
  actionItems: Array<{
    id?: string;
    task: string;
    assignee?: string;
    dueDate?: string;
    status: 'open' | 'completed';
  }>;
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
  };
  topics: string[];
  talkTimeDistribution: Array<{
    speaker: string;
    percentage: number;
    seconds?: number;
  }>;
  engagementScore?: number;
}

export interface IMeeting extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  client: string;
  date: string;
  time: string;
  timezone?: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  host: mongoose.Types.ObjectId;
  attendees: any[];
  agenda: string;
  notes: string;
  checklist: ICheckable[];
  actions: ICheckable[];
  meetUrl?: string;
  meetingUrl?: string;
  googleCalendarEventId?: string;
  googleEventId?: string;
  calendarUrl?: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'processing' | 'completed' | 'cancelled' | 'failed';
  reportStatus: 'none' | 'waiting_for_transcript' | 'processing' | 'ready' | 'transcript_unavailable' | 'failed';
  reportError?: string;
  transcriptAvailable?: boolean;
  report?: IMeetingReport | null;
  transcript: ITranscriptEntry[];
  rawTranscript?: string;
  cleanedTranscript?: string;
  insights?: IMeetingInsights;
  startedAt?: string;
  endedAt?: string;
  processedAt?: string;
  recordingUrl?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CheckableSchema = new Schema<ICheckable>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const TranscriptEntrySchema = new Schema<ITranscriptEntry>(
  {
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: String },
    startTimeSeconds: { type: Number },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
  {
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      index: true,
    },
    client: {
      type: String,
      default: 'General Client',
      trim: true,
    },
    date: {
      type: String,
      default: '',
      index: true,
    },
    time: {
      type: String,
      default: '10:00 AM',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    description: {
      type: String,
      default: '',
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 30,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attendees: [
      {
        type: Schema.Types.Mixed,
      },
    ],
    agenda: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    checklist: [CheckableSchema],
    actions: [CheckableSchema],
    meetUrl: {
      type: String,
      default: '',
    },
    meetingUrl: {
      type: String,
      default: '',
    },
    googleCalendarEventId: {
      type: String,
      index: true,
    },
    googleEventId: {
      type: String,
    },
    calendarUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'in_progress', 'processing', 'completed', 'cancelled', 'failed'],
      default: 'scheduled',
      index: true,
    },
    reportStatus: {
      type: String,
      enum: ['none', 'waiting_for_transcript', 'processing', 'ready', 'transcript_unavailable', 'failed'],
      default: 'none',
      index: true,
    },
    reportError: {
      type: String,
    },
    transcriptAvailable: {
      type: Boolean,
      default: false,
    },
    report: {
      type: Schema.Types.Mixed,
      default: null,
    },
    transcript: [TranscriptEntrySchema],
    rawTranscript: {
      type: String,
    },
    cleanedTranscript: {
      type: String,
    },
    insights: {
      type: Schema.Types.Mixed,
    },
    startedAt: {
      type: String,
    },
    endedAt: {
      type: String,
    },
    processedAt: {
      type: String,
    },
    recordingUrl: {
      type: String,
    },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();

        // Ensure date string YYYY-MM-DD
        if (!ret.date && ret.scheduledAt) {
          ret.date = new Date(ret.scheduledAt).toISOString().slice(0, 10);
        }

        // Ensure meetUrl
        ret.meetUrl = ret.meetUrl || ret.meetingUrl || 'https://meet.google.com/new';

        // Flatten attendees to strings for frontend compatibility if they are objects
        if (Array.isArray(ret.attendees)) {
          ret.attendees = ret.attendees.map((a: any) =>
            typeof a === 'string' ? a : a.name || a.email || 'Participant'
          );
        }

        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Meeting: Model<IMeeting> =
  mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', MeetingSchema);
