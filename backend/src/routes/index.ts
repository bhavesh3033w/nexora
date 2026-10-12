import { Router } from 'express';
import authRoutes from './authRoutes.js';
import meetingRoutes from './meetingRoutes.js';
import clientRoutes from './clientRoutes.js';
import integrationRoutes from './integrationRoutes.js';
import projectRoutes from './projectRoutes.js';
import taskRoutes from './taskRoutes.js';
import communicationRoutes from './communicationRoutes.js';
import tutorialRoutes from './tutorialRoutes.js';
import preferenceRoutes from './preferenceRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import adminRoutes from './adminRoutes.js';
import adaptationRoutes from './adaptationRoutes.js';
import assistantRoutes from './assistantRoutes.js';
import { isDbConnected } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';
import { Task } from '../models/Task.js';
import { Meeting } from '../models/Meeting.js';
import { Project } from '../models/Project.js';
import { Course } from '../models/Course.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      connected: isDbConnected(),
      driver: 'mongoose',
    },
  });
});

// Dashboard summary endpoint (GET /dashboard)
router.get('/dashboard', async (_req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tasks, meetings, projects, courses] = await Promise.all([
    Task.find(),
    Meeting.find({ date: { $gte: todayStr } }),
    Project.find(),
    Course.find(),
  ]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'doing').length;
  const overdue = tasks.filter((t) => t.due && t.due < todayStr && t.status !== 'done').length;

  sendSuccess(res, {
    taskSummary: {
      total: totalTasks,
      inProgress,
      completed: doneTasks,
      overdue,
    },
    upcomingMeetings: meetings.slice(0, 5),
    activeProjects: projects.slice(0, 5),
    courses: courses.slice(0, 3),
  }, 'Dashboard summary retrieved');
});

// Dashboard widgets endpoint (GET /dashboard/widgets)
router.get('/dashboard/widgets', (_req, res) => {
  sendSuccess(res, [
    { id: 'tasks', name: 'Task Summary & Table', defaultActive: true },
    { id: 'meetings', name: 'Upcoming Meetings', defaultActive: true },
    { id: 'messages', name: 'Unread Communications', defaultActive: true },
    { id: 'notifications', name: 'Notifications & Risk Alerts', defaultActive: true },
    { id: 'learning', name: 'Study & Course Progress', defaultActive: false },
    { id: 'projects', name: 'Project Progress Bars', defaultActive: true },
    { id: 'analytics', name: 'Active Users Chart', defaultActive: false },
    { id: 'assistant', name: 'AI Assistant Intent Bar', defaultActive: true },
  ], 'Registered workspace widgets');
});

// Mount modular sub-routers with primary and alias routes
router.use('/auth', authRoutes);
router.use('/preferences', preferenceRoutes);
router.use('/users/me/preferences', preferenceRoutes);
router.use('/tasks', taskRoutes);
router.use('/projects', projectRoutes);
router.use('/meetings', meetingRoutes);
router.use('/clients', clientRoutes);
router.use('/integrations', integrationRoutes);
router.use('/communication', communicationRoutes);
router.use('/messages', communicationRoutes);
router.use('/tutorials', tutorialRoutes);
router.use('/courses', tutorialRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/adaptations', adaptationRoutes);
router.use('/assistant', assistantRoutes);

export default router;
