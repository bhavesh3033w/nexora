import { Router } from 'express';
import {
  ProjectController,
  createProjectSchema,
} from '../controllers/projectController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', ProjectController.getProjects);
router.post('/', validateBody(createProjectSchema), ProjectController.createProject);
router.get('/:id', ProjectController.getProjectById);
router.patch('/:id', ProjectController.updateProject);
router.put('/:id', ProjectController.updateProject);
router.delete('/:id', ProjectController.deleteProject);

export default router;
