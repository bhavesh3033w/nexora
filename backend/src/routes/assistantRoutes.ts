import { Router } from 'express';
import { AssistantController } from '../controllers/assistantController.js';

const router = Router();

router.post('/messages', AssistantController.handleMessage);

export default router;
