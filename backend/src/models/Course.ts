import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITopic {
  id: string;
  name: string;
  done: boolean;
}

export interface IAssessment {
  title: string;
  date: string;
}

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  title?: string;
  description?: string;
  category?: string;
  topics: ITopic[];
  assessment: IAssessment;
  quizBest: number | null;
  enrolledUserCount: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TopicSchema = new Schema<ITopic>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    title: { type: String, required: true },
    date: { type: String, required: true },
  },
  { _id: false }
);

const CourseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'General',
    },
    topics: [TopicSchema],
    assessment: {
      type: AssessmentSchema,
      default: () => ({ title: 'Mid-term Assessment', date: new Date().toISOString().slice(0, 10) }),
    },
    quizBest: {
      type: Number,
      default: null,
    },
    enrolledUserCount: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        ret.name = ret.name || ret.title || 'Course';
        ret.topics = ret.topics || [];
        ret.assessment = ret.assessment || { title: 'Final Assessment', date: '2026-12-31' };
        if (ret.quizBest === undefined) ret.quizBest = null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Course: Model<ICourse> =
  mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
