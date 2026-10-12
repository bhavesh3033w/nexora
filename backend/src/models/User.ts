import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: 'user' | 'admin' | 'manager';
  avatar?: string;
  bio?: string;
  department?: string;
  onboardingCompleted: boolean;
  preferences?: {
    theme?: 'dark' | 'light' | 'system';
    emailNotifications?: boolean;
    adaptiveLayout?: boolean;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Don't return password in default queries
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'manager'],
      default: 'user',
      index: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: 'General',
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    preferences: {
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
      emailNotifications: { type: Boolean, default: true },
      adaptiveLayout: { type: Boolean, default: true },
    },
    lastLoginAt: {
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
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
