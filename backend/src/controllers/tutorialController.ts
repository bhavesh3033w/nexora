import { Response, NextFunction } from 'express';
import { Course } from '../models/Course.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class TutorialController {
  public static async getCourses(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const courses = await Course.find({ isPublished: true }).sort({ createdAt: -1 });
      sendSuccess(res, courses, 'Tutorial courses retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async getCourseById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);

      if (!course) {
        sendError(res, 'Course not found', 404);
        return;
      }

      sendSuccess(res, course, 'Course details retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async createCourse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name, title, description, category, topics, assessment, quizBest } = req.body;
      const course = await Course.create({
        name: name || title || 'New Course',
        title: name || title || 'New Course',
        description: description || '',
        category: category || 'Engineering',
        topics: topics || [],
        assessment: assessment || { title: 'Final Exam', date: new Date().toISOString().slice(0, 10) },
        quizBest: quizBest || null,
      });

      sendSuccess(res, course, 'Course created', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateCourse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates._id;
      delete updates.id;

      const course = await Course.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!course) {
        sendError(res, 'Course not found', 404);
        return;
      }

      sendSuccess(res, course, 'Course updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async deleteCourse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const course = await Course.findByIdAndDelete(id);

      if (!course) {
        sendError(res, 'Course not found', 404);
        return;
      }

      sendSuccess(res, { deletedId: id }, 'Course deleted');
    } catch (err) {
      next(err);
    }
  }

  public static async enrollCourse(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const course = await Course.findByIdAndUpdate(
        id,
        { $inc: { enrolledUserCount: 1 } },
        { new: true }
      );

      if (!course) {
        sendError(res, 'Course not found', 404);
        return;
      }

      sendSuccess(res, course, 'Enrolled successfully');
    } catch (err) {
      next(err);
    }
  }
}
