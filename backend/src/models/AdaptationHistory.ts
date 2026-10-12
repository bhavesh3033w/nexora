import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAdaptationHistory extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  intentText: string;
  classifiedIntent: string;
  matchedKeywords: string[];
  confidence: number;
  previousConfig: Record<string, any>;
  appliedConfig: Record<string, any>;
  explanation: string[];
  appliedAt: Date;
  undone: boolean;
  undoneAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdaptationHistorySchema = new Schema<IAdaptationHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    intentText: {
      type: String,
      required: true,
    },
    classifiedIntent: {
      type: String,
      required: true,
    },
    matchedKeywords: {
      type: [String],
      default: [],
    },
    confidence: {
      type: Number,
      required: true,
    },
    previousConfig: {
      type: Schema.Types.Mixed,
      default: {},
    },
    appliedConfig: {
      type: Schema.Types.Mixed,
      required: true,
    },
    explanation: {
      type: [String],
      default: [],
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    undone: {
      type: Boolean,
      default: false,
      index: true,
    },
    undoneAt: {
      type: Date,
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

export const AdaptationHistory: Model<IAdaptationHistory> =
  mongoose.models.AdaptationHistory ||
  mongoose.model<IAdaptationHistory>('AdaptationHistory', AdaptationHistorySchema);
