import { Router } from 'express';
import {
  MeetingController,
  createMeetingSchema,
  processTranscriptSchema,
  recordingUpload,
} from '../controllers/meetingController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', MeetingController.getMeetings);
router.post('/', validateBody(createMeetingSchema), MeetingController.createMeeting);
router.get('/action-tracker', MeetingController.actionTracker);
router.get('/:id', MeetingController.getMeetingById);
router.patch('/:id', MeetingController.updateMeeting);
router.delete('/:id', MeetingController.deleteMeeting);

router.post('/:id/schedule', MeetingController.schedule);
router.post('/:id/start', MeetingController.start);
router.post('/:id/complete', MeetingController.complete);
router.post('/:id/process-transcript', validateBody(processTranscriptSchema), MeetingController.processTranscript);
router.post('/:id/transcript', validateBody(processTranscriptSchema), MeetingController.submitTranscript);
router.post('/:id/recording', recordingUpload, MeetingController.uploadRecording);
router.patch('/:id/action-items/:itemId', MeetingController.setActionItem);

export default router;
