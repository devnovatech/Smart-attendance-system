import { Router } from 'express';
import { processSyncQueue, getSyncStatus } from '../controllers/sync.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { syncQueueSchema } from '../validators';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/sync/queue:
 *   post:
 *     summary: Process offline sync queue
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 */
router.post('/queue', validate(syncQueueSchema), processSyncQueue);

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Get sync queue status
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', getSyncStatus);

export default router;
