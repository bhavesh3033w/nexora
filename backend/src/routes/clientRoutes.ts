import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();
router.use(requireAuth);

const SAMPLE_CLIENTS = [
  { id: 'c1', name: 'Acme Global Ventures', email: 'contact@acmeglobal.com', company: 'Acme Corp' },
  { id: 'c2', name: 'Apex Tech Dynamics', email: 'leads@apextech.io', company: 'Apex Tech' },
  { id: 'c3', name: 'Quantum Cloud Inc', email: 'ops@quantumcloud.net', company: 'Quantum Cloud' },
  { id: 'c4', name: 'Starlight Media', email: 'hello@starlight.media', company: 'Starlight Group' },
];

router.get('/', (_req, res) => {
  sendSuccess(res, SAMPLE_CLIENTS, 'Clients retrieved');
});

export default router;
