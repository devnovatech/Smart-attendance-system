import { Router } from 'express';
import {
  getDashboard,
  getAttendanceHistory,
  getCalendarView,
} from '../controllers/student.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('student', 'admin'));

/**
 * @swagger
 * /api/student/dashboard:
 *   get:
 *     summary: Get student attendance dashboard with subject-wise percentages
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/student/{id}/attendance:
 *   get:
 *     summary: Get attendance history for a student
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 */
router.get('/:id/attendance', getAttendanceHistory);

/**
 * @swagger
 * /api/student/{id}/calendar:
 *   get:
 *     summary: Get calendar view of attendance
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 */
router.get('/:id/calendar', getCalendarView);

export default router;
