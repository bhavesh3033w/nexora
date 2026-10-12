import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAnalyticsMetric extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  eventType: string; // e.g., 'meeting_completed', 'task_created', 'feature_used', 'session_start'
  feature: string; // 'meetings', 'projects', 'communication', 'assistant', 'study'
  metadata: Record<string, any>;
  durationSeconds?: number;
  timestamp: Date;
}

const AnalyticsMetricSchema = new Schema<IAnalyticsMetric>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    feature: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
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

export const AnalyticsMetric: Model<IAnalyticsMetric> =
  mongoose.models.AnalyticsMetric ||
  mongoose.model<IAnalyticsMetric>('AnalyticsMetric', AnalyticsMetricSchema);
