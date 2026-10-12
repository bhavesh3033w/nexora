import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { Channel } from '../models/Channel.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const sendMessageSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  content: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  unread: z.boolean().optional(),
  date: z.string().optional(),
  channelId: z.string().optional(),
});

export class CommunicationController {
  public static async getMessages(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const messages = await Message.find()
        .sort({ createdAt: -1 });

      sendSuccess(res, messages, 'Messages retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async getMessageById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const message = await Message.findById(id);

      if (!message) {
        sendError(res, 'Message not found', 404);
        return;
      }

      sendSuccess(res, message, 'Message retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async createMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { from, subject, body, content, priority, unread, date } = req.body;

      const message = await Message.create({
        from: from || req.user?.email || 'User',
        subject: subject || 'General Communication',
        body: body || content || '',
        content: body || content || '',
        priority: priority || 'normal',
        unread: unread !== undefined ? unread : true,
        date: date || new Date().toISOString().slice(0, 10),
        sender: req.user?.userId,
      });

      sendSuccess(res, message, 'Message created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      delete updates._id;
      delete updates.id;

      const message = await Message.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!message) {
        sendError(res, 'Message not found', 404);
        return;
      }

      sendSuccess(res, message, 'Message updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async deleteMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const message = await Message.findByIdAndDelete(id);

      if (!message) {
        sendError(res, 'Message not found', 404);
        return;
      }

      sendSuccess(res, { deletedId: id }, 'Message deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  // Channels for Slack-like channels
  public static async getChannels(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const channels = await Channel.find().sort({ lastActivity: -1 });
      sendSuccess(res, channels, 'Channels retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}
