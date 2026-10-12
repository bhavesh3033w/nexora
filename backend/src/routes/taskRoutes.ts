import { Router } from 'express';
import {
  TaskController,
  createTaskSchema,
  updateTaskStatusSchema,
} from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', TaskController.getTasks);
router.post('/', validateBody(createTaskSchema), TaskController.createTask);
router.get('/:id', TaskController.getTaskById);
router.patch('/:id', TaskController.updateTask);
router.put('/:id', TaskController.updateTask);
router.patch('/:id/status', validateBody(updateTaskStatusSchema), TaskController.updateTaskStatus);
router.delete('/:id', TaskController.deleteTask);

export default router;
