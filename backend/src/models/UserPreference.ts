import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUserPreference extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  v: number;
  onboarded: boolean;
  focus: string;
  workspace: string;
  layout: string;
  widgets: string[];
  order: string[];
  nav: string;
  notifications: string[];
  theme: string;
  color: string;
  style: string;
  textSize: string;
  spacing: string;
  motion: string;
  goal: string;
  adaptive: string;
  answers: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    v: {
      type: Number,
      default: 1,
    },
    onboarded: {
      type: Boolean,
      default: false,
    },
    focus: {
      type: String,
      default: 'balanced',
    },
    workspace: {
      type: String,
      default: 'all',
    },
    layout: {
      type: String,
      default: 'balanced',
    },
    widgets: {
      type: [String],
      default: ['tasks', 'meetings', 'messages'],
    },
    order: {
      type: [String],
      default: ['tasks', 'meetings', 'messages', 'notifications', 'learning', 'projects', 'analytics', 'assistant'],
    },
    nav: {
      type: String,
      default: 'sidebar',
    },
    notifications: {
      type: [String],
      default: ['inapp'],
    },
    theme: {
      type: String,
      default: 'system',
    },
    color: {
      type: String,
      default: 'purple',
    },
    style: {
      type: String,
      default: 'minimal',
    },
    textSize: {
      type: String,
      default: 'medium',
    },
    spacing: {
      type: String,
      default: 'comfortable',
    },
    motion: {
      type: String,
      default: 'subtle',
    },
    goal: {
      type: String,
      default: '',
    },
    adaptive: {
      type: String,
      default: 'ask',
    },
    answers: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const UserPreference: Model<IUserPreference> =
  mongoose.models.UserPreference ||
  mongoose.model<IUserPreference>('UserPreference', UserPreferenceSchema);
