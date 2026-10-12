import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IChannel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  members: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  workspaceType: 'general' | 'project' | 'team' | 'announcements';
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<IChannel>(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      index: true,
    },
    topic: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspaceType: {
      type: String,
      enum: ['general', 'project', 'team', 'announcements'],
      default: 'general',
    },
    lastActivity: {
      type: Date,
      default: Date.now,
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

export const Channel: Model<IChannel> =
  mongoose.models.Channel || mongoose.model<IChannel>('Channel', ChannelSchema);
