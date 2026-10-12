import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';

export const createProjectSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().or(z.date()).optional(),
  tags: z.array(z.string()).optional(),
});

export class ProjectController {
  public static async getProjects(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filter: any = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.category) {
        filter.category = req.query.category;
      }
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { title: { $regex: req.query.search, $options: 'i' } },
        ];
      }

      const projects = await Project.find(filter)
        .sort({ updatedAt: -1 });

      if (req.query.paginated === 'true') {
        const page = parseInt((req.query.page as string) || '1', 10);
        const limit = parseInt((req.query.limit as string) || '20', 10);
        const total = await Project.countDocuments(filter);
        sendPaginated(res, projects, { page, limit, total });
        return;
      }

      sendSuccess(res, projects, 'Projects retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async getProjectById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const project = await Project.findById(id);

      if (!project) {
        sendError(res, 'Project not found', 404);
        return;
      }

      const tasks = await Task.find({
        $or: [{ projectId: project._id.toString() }, { project: project._id }],
      }).sort({ order: 1, createdAt: 1 });

      sendSuccess(res, { project, tasks }, 'Project retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async createProject(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const { name, title, description, category, priority, dueDate, tags } = req.body;
      const projectName = name || title;

      if (!projectName) {
        sendError(res, 'Project name or title is required', 400);
        return;
      }

      const project = await Project.create({
        name: projectName,
        title: projectName,
        description: description || '',
        category: category || 'Engineering',
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        tags: tags || [],
        owner: req.user.userId,
        members: [req.user.userId],
        status: 'active',
      });

      await ActivityLog.create({
        actor: req.user.email || 'User',
        userId: req.user.userId,
        action: 'PROJECT_CREATED',
        detail: `Created project "${project.name}"`,
        level: 'info',
      });

      sendSuccess(res, project, 'Project created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateProject(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates._id;
      delete updates.id;

      if (updates.name && !updates.title) updates.title = updates.name;
      if (updates.title && !updates.name) updates.name = updates.title;

      const project = await Project.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!project) {
        sendError(res, 'Project not found', 404);
        return;
      }

      if (req.user) {
        await ActivityLog.create({
          actor: req.user.email || 'User',
          userId: req.user.userId,
          action: 'PROJECT_UPDATED',
          detail: `Updated project "${project.name}"`,
          level: 'info',
        });
      }

      sendSuccess(res, project, 'Project updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async deleteProject(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const project = await Project.findByIdAndDelete(id);

      if (!project) {
        sendError(res, 'Project not found', 404);
        return;
      }

      // Also clean up tasks belonging to this project
      await Task.deleteMany({
        $or: [{ projectId: id }, { project: id }],
      });

      if (req.user) {
        await ActivityLog.create({
          actor: req.user.email || 'User',
          userId: req.user.userId,
          action: 'PROJECT_DELETED',
          detail: `Deleted project "${project.name}" and associated tasks`,
          level: 'warn',
        });
      }

      sendSuccess(res, { deletedId: id }, 'Project deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}
