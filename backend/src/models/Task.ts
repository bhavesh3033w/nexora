import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  projectId: string;
  project?: mongoose.Types.ObjectId;
  assignee: string;
  creator: mongoose.Types.ObjectId;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  due: string;
  dueDate?: Date;
  blocker?: string;
  order: number;
  tags: string[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    projectId: {
      type: String,
      default: '',
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    assignee: {
      type: String,
      default: 'Unassigned',
      index: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['todo', 'doing', 'done', 'backlog', 'in_progress', 'review'],
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    due: {
      type: String,
      default: '',
      index: true,
    },
    dueDate: {
      type: Date,
    },
    blocker: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id?.toString();
        // Map status cleanly to frontend standard 'todo' | 'doing' | 'done'
        if (ret.status === 'in_progress' || ret.status === 'review') {
          ret.status = 'doing';
        } else if (ret.status === 'backlog') {
          ret.status = 'todo';
        }

        // Map priority cleanly
        if (ret.priority === 'urgent') {
          ret.priority = 'high';
        }

        // Ensure projectId is a string
        ret.projectId = ret.projectId || ret.project?.toString() || '';

        // Ensure due date string format YYYY-MM-DD
        if (!ret.due && ret.dueDate) {
          ret.due = new Date(ret.dueDate).toISOString().slice(0, 10);
        }

        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
