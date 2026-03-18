import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getReports,
  exportExcel,
  exportPdf,
  getConfig,
  updateConfig,
  getLogs,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema, updateUserSchema, configSchema } from '../validators';

const router = Router();

router.use(authenticate, authorize('admin'));

// User Management
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (paginated)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [teacher, student, admin]
 */
router.get('/users', getUsers);

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users', validate(createUserSchema), createUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Admin]
 */
router.put('/users/:id', validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 */
router.delete('/users/:id', deleteUser);

// Reports
/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Get campus-wide attendance reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/reports', getReports);

/**
 * @swagger
 * /api/admin/reports/export/excel:
 *   get:
 *     summary: Export attendance report as Excel
 *     tags: [Admin]
 */
router.get('/reports/export/excel', exportExcel);

/**
 * @swagger
 * /api/admin/reports/export/pdf:
 *   get:
 *     summary: Export attendance report as PDF
 *     tags: [Admin]
 */
router.get('/reports/export/pdf', exportPdf);

// Config
/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     summary: Get system configuration
 *     tags: [Admin]
 */
router.get('/config', getConfig);

/**
 * @swagger
 * /api/admin/config:
 *   put:
 *     summary: Update system configuration
 *     tags: [Admin]
 */
router.put('/config', validate(configSchema), updateConfig);

// Logs
/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: View system logs
 *     tags: [Admin]
 */
router.get('/logs', getLogs);

export default router;
