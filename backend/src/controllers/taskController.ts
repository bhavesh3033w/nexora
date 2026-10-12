import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { MeetingReportService } from '../services/meetingReportService.js';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  projectId: z.string().optional(),
  project: z.string().optional(),
  assignee: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done', 'backlog', 'in_progress', 'review']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due: z.string().optional(),
  dueDate: z.string().or(z.date()).optional(),
  blocker: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'backlog', 'in_progress', 'review']),
  order: z.number().optional(),
});

export class TaskController {
  public static async getTasks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filter: any = {};
      if (req.query.projectId) {
        filter.$or = [{ projectId: req.query.projectId }, { project: req.query.projectId }];
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.assignee) {
        filter.assignee = new RegExp(String(req.query.assignee), 'i');
      }

      const tasks = await Task.find(filter)
        .sort({ order: 1, createdAt: -1 });

      sendSuccess(res, tasks, 'Tasks retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async getTaskById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const task = await Task.findById(id);

      if (!task) {
        sendError(res, 'Task not found', 404);
        return;
      }

      sendSuccess(res, task, 'Task retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async createTask(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const {
        title,
        description,
        projectId,
        project,
        assignee,
        status,
        priority,
        due,
        dueDate,
        blocker,
        tags,
      } = req.body;

      const pid = projectId || project || '';
      const highestOrderTask = await Task.findOne().sort({ order: -1 });
      const nextOrder = highestOrderTask ? highestOrderTask.order + 1 : 0;

      const task = await Task.create({
        title,
        description: description || '',
        projectId: pid,
        project: pid && pid.length === 24 ? pid : undefined,
        assignee: assignee || 'Unassigned',
        creator: req.user.userId,
        status: status || 'todo',
        priority: priority || 'medium',
        due: due || (dueDate ? new Date(dueDate).toISOString().slice(0, 10) : ''),
        dueDate: dueDate ? new Date(dueDate) : (due ? new Date(due) : undefined),
        blocker: blocker || '',
        tags: tags || [],
        order: nextOrder,
      });

      if (pid) {
        await TaskController.recalculateProjectProgress(pid);
      }

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId: req.user.userId,
        action: 'TASK_CREATED',
        detail: `Created task "${task.title}" with priority ${task.priority}`,
        level: 'info',
      });

      sendSuccess(res, task, 'Task created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateTask(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates._id;
      delete updates.id;

      const unset: Record<string, ''> = {};
      if (updates.status === 'done' && !updates.completedAt) {
        updates.completedAt = new Date();
      } else if (updates.status !== undefined && updates.status !== 'done') {
        delete updates.completedAt;
        unset.completedAt = '';
      }

      if (updates.due && !updates.dueDate) {
        updates.dueDate = new Date(updates.due);
      }

      const task = await Task.findByIdAndUpdate(
        id,
        Object.keys(unset).length ? { $set: updates, $unset: unset } : { $set: updates },
        { new: true, runValidators: true }
      );
      if (!task) {
        sendError(res, 'Task not found', 404);
        return;
      }

      const pid = task.projectId || (task.project ? task.project.toString() : '');
      if (pid) {
        await TaskController.recalculateProjectProgress(pid);
      }

      if (req.user) {
        await ActivityLog.create({
          actor: req.user.email || 'User',
          userId: req.user.userId,
          action: 'TASK_UPDATED',
          detail: `Updated task "${task.title}" (status: ${task.status})`,
          level: 'info',
        });
      }

      try {
        await MeetingReportService.syncFromTask(task);
      } catch (syncErr) {
        console.error('[TaskController] meeting report sync failed:', syncErr);
      }

      sendSuccess(res, task, 'Task updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async updateTaskStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status, order } = req.body;

      const updates: any = { status };
      if (order !== undefined) updates.order = order;
      if (status === 'done') updates.completedAt = new Date();

      const task = await Task.findByIdAndUpdate(
        id,
        status === 'done' ? { $set: updates } : { $set: updates, $unset: { completedAt: '' } },
        { new: true }
      );
      if (!task) {
        sendError(res, 'Task not found', 404);
        return;
      }

      const pid = task.projectId || (task.project ? task.project.toString() : '');
      if (pid) {
        await TaskController.recalculateProjectProgress(pid);
      }

      try {
        await MeetingReportService.syncFromTask(task);
      } catch (syncErr) {
        console.error('[TaskController] meeting report sync failed:', syncErr);
      }

      sendSuccess(res, task, 'Task status updated');
    } catch (err) {
      next(err);
    }
  }

  public static async deleteTask(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const task = await Task.findByIdAndDelete(id);

      if (!task) {
        sendError(res, 'Task not found', 404);
        return;
      }

      const pid = task.projectId || (task.project ? task.project.toString() : '');
      if (pid) {
        await TaskController.recalculateProjectProgress(pid);
      }

      if (req.user) {
        await ActivityLog.create({
          actor: req.user.email || 'User',
          userId: req.user.userId,
          action: 'TASK_DELETED',
          detail: `Deleted task "${task.title}"`,
          level: 'info',
        });
      }

      sendSuccess(res, { deletedId: id }, 'Task deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  private static async recalculateProjectProgress(projectId: string): Promise<void> {
    try {
      const tasks = await Task.find({
        $or: [{ projectId }, { project: projectId }],
      });
      if (tasks.length === 0) return;

      const doneTasks = tasks.filter((t) => t.status === 'done').length;
      const progressPercentage = Math.round((doneTasks / tasks.length) * 100);

      await Project.findByIdAndUpdate(projectId, { progressPercentage });
    } catch {
      // Non-blocking calculation
    }
  }
}
