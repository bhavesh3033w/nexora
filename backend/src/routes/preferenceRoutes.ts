import { Router } from 'express';
import { PreferenceController } from '../controllers/preferenceController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', PreferenceController.getPreferences);
router.put('/', PreferenceController.updatePreferences);
router.patch('/', PreferenceController.updatePreferences);

export default router;
