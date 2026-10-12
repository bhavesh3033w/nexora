import { Response, NextFunction } from 'express';
import { UserPreference } from '../models/UserPreference.js';
import { User } from '../models/User.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class PreferenceController {
  public static async getPreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      let prefs = await UserPreference.findOne({ userId: req.user.userId });
      if (!prefs) {
        prefs = await UserPreference.create({
          userId: req.user.userId,
          v: 1,
          onboarded: false,
          focus: 'balanced',
          workspace: 'all',
          layout: 'balanced',
          widgets: ['tasks', 'meetings', 'messages'],
          order: ['tasks', 'meetings', 'messages', 'notifications', 'learning', 'projects', 'analytics', 'assistant'],
          nav: 'sidebar',
          notifications: ['inapp'],
          theme: 'system',
          color: 'purple',
          style: 'minimal',
          textSize: 'medium',
          spacing: 'comfortable',
          motion: 'subtle',
          goal: '',
          adaptive: 'ask',
          answers: {},
        });
      }

      const pJson = prefs.toJSON();
      sendSuccess(res, pJson, 'Preferences retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async updatePreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const updates = { ...req.body };
      delete updates._id;
      delete updates.userId;

      const prefs = await UserPreference.findOneAndUpdate(
        { userId: req.user.userId },
        { $set: updates },
        { new: true, upsert: true, runValidators: true }
      );

      if (updates.onboarded === true || (updates.answers && Object.keys(updates.answers).length > 0)) {
        await User.findByIdAndUpdate(req.user.userId, { onboardingCompleted: true });
      }

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId: req.user.userId,
        action: 'PREFERENCES_UPDATED',
        detail: `User preferences updated (theme: ${prefs.theme}, style: ${prefs.style})`,
        level: 'info',
      });

      sendSuccess(res, prefs.toJSON(), 'Preferences updated successfully');
    } catch (err) {
      next(err);
    }
  }
}
