import { Router } from 'express';
import { AdaptationController } from '../controllers/adaptationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Preview can work with or without active session for landing demo
router.post('/preview', (req, res, next) => {
  // If token is present, authenticate, else continue anonymously
  if (req.headers.authorization) {
    return requireAuth(req, res, next);
  }
  next();
}, AdaptationController.preview);

router.post('/apply', requireAuth, AdaptationController.apply);
router.get('/history', requireAuth, AdaptationController.history);
router.post('/undo', requireAuth, AdaptationController.undo);

export default router;
