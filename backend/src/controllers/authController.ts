import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

// Validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  department: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const validateAdminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().optional(),
  department: z.string().optional(),
  preferences: z.object({
    theme: z.enum(['dark', 'light', 'system']).optional(),
    emailNotifications: z.boolean().optional(),
    adaptiveLayout: z.boolean().optional(),
  }).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export class AuthController {
  // Register a standard user
  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password, name, department } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        sendError(res, 'An account with this email already exists', 409);
        return;
      }

      const passwordHash = await hashPassword(password);

      const user = await User.create({
        email: normalizedEmail,
        passwordHash,
        name,
        department: department || 'General',
        role: 'user',
        onboardingCompleted: false,
      });

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      await ActivityLog.create({
        actor: user.name,
        userId: user._id,
        action: 'USER_REGISTERED',
        detail: `New user account created: ${user.email}`,
        level: 'info',
      });

      const userJson = user.toJSON();

      sendSuccess(
        res,
        {
          token,
          id: userJson.id,
          name: userJson.name,
          email: userJson.email,
          role: userJson.role,
          user: userJson,
        },
        'Registration successful',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // Standard user login
  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({
        email: normalizedEmail,
      }).select('+passwordHash');

      if (!user || !user.passwordHash) {
        sendError(res, 'Invalid email or password', 401);
        return;
      }

      const passwordMatches = await comparePassword(
        password,
        user.passwordHash
      );

      if (!passwordMatches) {
        sendError(res, 'Invalid email or password', 401);
        return;
      }

      user.lastLoginAt = new Date();
      await user.save();

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      await ActivityLog.create({
        actor: user.name,
        userId: user._id,
        action: 'USER_LOGIN',
        detail: `User ${user.email} signed in`,
        level: 'info',
      });

      const userJson = user.toJSON();

      sendSuccess(
        res,
        {
          token,
          id: userJson.id,
          name: userJson.name,
          email: userJson.email,
          role: userJson.role,
          user: userJson,
        },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  // Admin login: requires valid credentials and admin role
  static async adminLogin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({
        email: normalizedEmail,
      }).select('+passwordHash');

      if (!user || !user.passwordHash) {
        sendError(res, 'Invalid email or password', 401);
        return;
      }

      const passwordMatches = await comparePassword(
        password,
        user.passwordHash
      );

      if (!passwordMatches) {
        sendError(res, 'Invalid email or password', 401);
        return;
      }

      if (user.role !== 'admin') {
        sendError(res, 'Admin access denied', 403);
        return;
      }

      user.lastLoginAt = new Date();
      await user.save();

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      await ActivityLog.create({
        actor: user.name,
        userId: user._id,
        action: 'ADMIN_LOGIN',
        detail: `Administrator ${user.email} accessed portal`,
        level: 'info',
      });

      const userJson = user.toJSON();

      sendSuccess(
        res,
        {
          token,
          id: userJson.id,
          name: userJson.name,
          email: userJson.email,
          role: userJson.role,
          user: userJson,
        },
        'Admin login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  // Get current user profile
  static async getCurrentUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const user = await User.findById(req.user.userId);

      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      const userJson = user.toJSON();

      sendSuccess(
        res,
        {
          id: userJson.id,
          name: userJson.name,
          email: userJson.email,
          role: userJson.role,
          user: userJson,
        },
        'User profile retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  // Logout endpoint
  static async logout(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { loggedOut: true }, 'Logged out successfully');
  }

  // Update profile
  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const allowedFields = [
        'name',
        'bio',
        'avatar',
        'department',
        'preferences',
        'onboardingCompleted',
      ];

      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      sendSuccess(
        res,
        { user: user.toJSON() },
        'Profile updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // Change password
  static async changePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user.userId)
        .select('+passwordHash');

      if (!user || !user.passwordHash) {
        sendError(res, 'User not found or password unavailable', 404);
        return;
      }

      const passwordMatches = await comparePassword(
        currentPassword,
        user.passwordHash
      );

      if (!passwordMatches) {
        sendError(res, 'Current password is incorrect', 400);
        return;
      }

      user.passwordHash = await hashPassword(newPassword);
      await user.save();

      await ActivityLog.create({
        actor: user.name,
        userId: user._id,
        action: 'PASSWORD_CHANGED',
        detail: `User ${user.email} updated account password`,
        level: 'info',
      });

      sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
}
