import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', AnalyticsController.getDailyAnalytics);
router.get('/metrics', AnalyticsController.getDashboardMetrics);
router.get('/features', AnalyticsController.getFeatureAnalytics);
router.post('/events', AnalyticsController.trackEvent);

export default router;
