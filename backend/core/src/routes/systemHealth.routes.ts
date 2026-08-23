import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { getSystemHealth } from '../controllers/systemHealth.controller';
import { reqRole } from '../middleware/rbac.middleware';

const router = Router();

router.get('/', reqRole([UserRole.ADMIN]), getSystemHealth);

export default router;
