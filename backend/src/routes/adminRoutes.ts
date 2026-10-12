import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';

const router = Router();

// Protect all admin endpoints with authentication and admin role enforcement
router.use(requireAuth, requireAdmin);

router.get('/dashboard', AdminController.getSystemOverview);
router.get('/overview', AdminController.getSystemOverview);
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/status', AdminController.setUserStatus);
router.patch('/users/:id/role', AdminController.updateUserRole);
router.get('/activity', AdminController.getActivityLogs);

export default router;
