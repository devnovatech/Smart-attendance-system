import { Router } from 'express';
import {
  getTimetable,
  getCurrentClass,
  startAttendance,
  markAttendance,
  submitAttendance,
  getAttendanceHistory,
  getClassStudents,
} from '../controllers/teacher.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { startAttendanceSchema, markAttendanceSchema } from '../validators';

const router = Router();

router.use(authenticate, authorize('teacher', 'admin'));

/**
 * @swagger
 * /api/teacher/timetable:
 *   get:
 *     summary: Get teacher's timetable
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Timetable data
 */
router.get('/timetable', getTimetable);

/**
 * @swagger
 * /api/teacher/current-class:
 *   get:
 *     summary: Auto-detect current class based on timetable
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 */
router.get('/current-class', getCurrentClass);

/**
 * @swagger
 * /api/teacher/attendance/start:
 *   post:
 *     summary: Start a new attendance session
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 */
router.post('/attendance/start', validate(startAttendanceSchema), startAttendance);

/**
 * @swagger
 * /api/teacher/{classId}/attendance:
 *   post:
 *     summary: Mark attendance for a student
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/:classId/attendance', validate(markAttendanceSchema), markAttendance);

/**
 * @swagger
 * /api/teacher/{classId}/attendance/submit:
 *   post:
 *     summary: Submit and finalize attendance
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:classId/attendance/submit', submitAttendance);

/**
 * @swagger
 * /api/teacher/{classId}/attendance:
 *   get:
 *     summary: Get attendance history for a class
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:classId/attendance', getAttendanceHistory);

/**
 * @swagger
 * /api/teacher/{classId}/students:
 *   get:
 *     summary: Get student list for a class
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:classId/students', getClassStudents);

export default router;
