import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  title?: string;
  description: string;
  owner?: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  status: 'planning' | 'active' | 'in_review' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  progressPercentage: number;
  startDate?: Date;
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
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
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['planning', 'active', 'in_review', 'completed', 'archived'],
      default: 'planning',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    category: {
      type: String,
      default: 'Engineering',
    },
    progressPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        ret.name = ret.name || ret.title || 'Untitled Project';
        ret.title = ret.name;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to ensure name and title remain synchronized
ProjectSchema.pre('save', function (next) {
  if (this.name && !this.title) {
    this.title = this.name;
  } else if (this.title && !this.name) {
    this.name = this.title;
  }
  next();
});

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
