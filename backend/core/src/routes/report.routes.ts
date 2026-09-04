import { Router } from 'express';
import { getSummaryReport } from '../controllers/report.controller';
import { authenticateRequest } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', authenticateRequest, getSummaryReport);

export default router;
