import { Router } from 'express';
import {
  CommunicationController,
  sendMessageSchema,
} from '../controllers/communicationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', CommunicationController.getMessages);
router.post('/', validateBody(sendMessageSchema), CommunicationController.createMessage);
router.get('/channels', CommunicationController.getChannels);
router.get('/:id', CommunicationController.getMessageById);
router.patch('/:id', CommunicationController.updateMessage);
router.put('/:id', CommunicationController.updateMessage);
router.delete('/:id', CommunicationController.deleteMessage);

export default router;
