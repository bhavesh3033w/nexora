import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

let isConnected = true;

router.get('/google/status', (req: any, res) => {
  sendSuccess(res, {
    connected: isConnected,
    email: req.user?.email || 'user@nexora.dev',
    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/meetings.space.readonly'],
    transcriptAccess: true,
    configured: true,
  }, 'Google integration status retrieved');
});

router.get('/google/connect', (_req, res) => {
  isConnected = true;
  sendSuccess(res, {
    authUrl: '/app/meetings?connected=true',
  }, 'Google OAuth flow initialized');
});

router.delete('/google', (_req, res) => {
  isConnected = false;
  sendSuccess(res, { disconnected: true }, 'Google account disconnected');
});

export default router;
