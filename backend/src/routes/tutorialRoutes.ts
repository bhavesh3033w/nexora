import { Router } from 'express';
import { TutorialController } from '../controllers/tutorialController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', TutorialController.getCourses);
router.post('/', TutorialController.createCourse);
router.get('/:id', TutorialController.getCourseById);
router.patch('/:id', TutorialController.updateCourse);
router.put('/:id', TutorialController.updateCourse);
router.delete('/:id', TutorialController.deleteCourse);
router.post('/:id/enroll', TutorialController.enrollCourse);

export default router;
