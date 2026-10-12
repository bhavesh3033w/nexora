import { Router } from 'express';
import {
  AuthController,
  registerSchema,
  loginSchema,
  validateAdminLoginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../controllers/authController.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Registration routes
router.post(
  '/register',
  validateBody(registerSchema),
  AuthController.register
);
router.post(
  '/user/register',
  validateBody(registerSchema),
  AuthController.register
);

// Login routes
router.post(
  '/login',
  validateBody(loginSchema),
  AuthController.login
);
router.post(
  '/user/login',
  validateBody(loginSchema),
  AuthController.login
);
router.post(
  '/admin/login',
  validateBody(validateAdminLoginSchema),
  AuthController.adminLogin
);

// Logout
router.post('/logout', AuthController.logout);

// Current user profile
router.get('/me', requireAuth, AuthController.getCurrentUser);

// Profile updates
router.patch(
  '/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  AuthController.updateProfile
);

// Password change
router.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  AuthController.changePassword
);

export default router;
