import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  actor: string;
  userId?: mongoose.Types.ObjectId;
  action: string;
  detail: string;
  level: 'info' | 'warn' | 'critical';
  time: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    actor: {
      type: String,
      required: true,
      default: 'System',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    detail: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'critical'],
      default: 'info',
      index: true,
    },
    time: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        ret.time = ret.time ? new Date(ret.time).toISOString() : new Date().toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
