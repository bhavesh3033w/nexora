import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  from: string;
  subject: string;
  body: string;
  unread: boolean;
  priority: 'high' | 'normal' | 'low';
  date: string;
  sender?: mongoose.Types.ObjectId;
  channel?: mongoose.Types.ObjectId;
  content?: string;
  attachments: Array<{
    name: string;
    url: string;
    fileType: string;
    sizeBytes?: number;
  }>;
  reactions: Array<{
    emoji: string;
    users: mongoose.Types.ObjectId[];
  }>;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    from: {
      type: String,
      default: 'Team Member',
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      default: 'General Update',
      trim: true,
    },
    body: {
      type: String,
      default: '',
    },
    unread: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['high', 'normal', 'low'],
      default: 'normal',
      index: true,
    },
    date: {
      type: String,
      default: '',
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    content: {
      type: String,
    },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String, required: true },
        sizeBytes: { type: Number },
      },
    ],
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        ret.from = ret.from || 'Team Member';
        ret.subject = ret.subject || 'Project Notice';
        ret.body = ret.body || ret.content || '';
        if (ret.unread === undefined) ret.unread = true;
        ret.priority = ret.priority || 'normal';
        ret.date = ret.date || (ret.createdAt ? new Date(ret.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
