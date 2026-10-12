import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IWorkspaceConfiguration extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  intent: string;
  workspace: {
    id: string;
    label: string;
    path: string;
  };
  focus: string[];
  order: string[];
  activeWidgets: string[];
  density: 'compact' | 'comfortable' | 'spacious';
  isDefault: boolean;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceConfigurationSchema = new Schema<IWorkspaceConfiguration>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    intent: {
      type: String,
      required: true,
      default: 'general',
    },
    workspace: {
      id: { type: String, required: true },
      label: { type: String, required: true },
      path: { type: String, required: true },
    },
    focus: {
      type: [String],
      default: [],
    },
    order: {
      type: [String],
      default: [],
    },
    activeWidgets: {
      type: [String],
      default: [],
    },
    density: {
      type: String,
      enum: ['compact', 'comfortable', 'spacious'],
      default: 'comfortable',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    appliedAt: {
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

export const WorkspaceConfiguration: Model<IWorkspaceConfiguration> =
  mongoose.models.WorkspaceConfiguration ||
  mongoose.model<IWorkspaceConfiguration>('WorkspaceConfiguration', WorkspaceConfigurationSchema);
