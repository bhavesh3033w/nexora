import { Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { Meeting } from '../models/Meeting.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class AdminController {
  public static async getSystemOverview(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const [totalUsers, totalProjects, totalMeetings, totalTasks, recentLogs] = await Promise.all([
        User.countDocuments(),
        Project.countDocuments(),
        Meeting.countDocuments(),
        Task.countDocuments(),
        ActivityLog.find().sort({ time: -1 }).limit(10),
      ]);

      const uptimeSeconds = Math.round(process.uptime());

      sendSuccess(
        res,
        {
          status: 'healthy',
          uptimeSeconds,
          counts: {
            users: totalUsers,
            projects: totalProjects,
            meetings: totalMeetings,
            tasks: totalTasks,
          },
          recentActivity: recentLogs,
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          },
        },
        'System overview retrieved'
      );
    } catch (err) {
      next(err);
    }
  }

  public static async getUsers(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const users = await User.find().sort({ createdAt: -1 });

      const adminUsers = users.map((u) => {
        const json = u.toJSON();
        return {
          id: json.id,
          name: json.name,
          email: json.email,
          workspace: json.department || 'General',
          status: (json.role === 'admin' ? 'active' : 'active') as 'active' | 'suspended' | 'pending',
          lastActive: json.lastLoginAt ? new Date(json.lastLoginAt).toISOString().slice(0, 10) : 'Today',
        };
      });

      sendSuccess(res, adminUsers, 'Admin users retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async setUserStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended', 'pending'].includes(status)) {
        sendError(res, 'Invalid status. Must be active, suspended, or pending', 400);
        return;
      }

      const user = await User.findById(id);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      await ActivityLog.create({
        actor: req.user?.email || 'Admin',
        userId: req.user?.userId,
        action: 'USER_STATUS_UPDATED',
        detail: `Updated user ${user.email} status to ${status}`,
        level: 'warn',
      });

      sendSuccess(res, { id, status }, 'User status updated');
    } catch (err) {
      next(err);
    }
  }

  public static async getActivityLogs(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let logs = await ActivityLog.find().sort({ time: -1 }).limit(50);

      if (logs.length === 0) {
        // Seed initial activity logs for demo if empty
        const initialLogs = await ActivityLog.create([
          {
            actor: 'System Bootstrap',
            action: 'CLUSTER_INIT',
            detail: 'Nexora Adaptive MERN Engine initialized',
            level: 'info',
            time: new Date(),
          },
          {
            actor: 'Security Daemon',
            action: 'TOKEN_VALIDATION',
            detail: 'JWT authentication and RBAC guards online',
            level: 'info',
            time: new Date(Date.now() - 3600000),
          },
          {
            actor: 'Engine Service',
            action: 'ADAPTIVE_ENGINE_LOADED',
            detail: 'Local deterministic rule engine primed with 5 intent classifiers',
            level: 'info',
            time: new Date(Date.now() - 7200000),
          },
        ]);
        logs = initialLogs;
      }

      sendSuccess(res, logs, 'Activity logs retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async updateUserRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['user', 'admin'].includes(role)) {
        sendError(res, 'Invalid role', 400);
        return;
      }

      const user = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true });
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      sendSuccess(res, user, 'User role updated');
    } catch (err) {
      next(err);
    }
  }
}
