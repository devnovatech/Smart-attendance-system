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
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getClassDetails,
  assignStudentsToClass,
  removeStudentsFromClass,
  getTimetables,
  createTimetable,
  updateTimetable,
  deleteTimetable,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  updateUserSchema,
  configSchema,
  createSubjectSchema,
  updateSubjectSchema,
  createClassSchema,
  updateClassSchema,
  assignStudentsSchema,
  createTimetableSchema,
  updateTimetableSchema,
} from '../validators';

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

// Subject Management
/**
 * @swagger
 * /api/admin/subjects:
 *   get:
 *     summary: List all subjects
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: semester
 *         schema:
 *           type: integer
 */
router.get('/subjects', getSubjects);

/**
 * @swagger
 * /api/admin/subjects:
 *   post:
 *     summary: Create a new subject
 *     tags: [Admin]
 */
router.post('/subjects', validate(createSubjectSchema), createSubject);

/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   put:
 *     summary: Update a subject
 *     tags: [Admin]
 */
router.put('/subjects/:id', validate(updateSubjectSchema), updateSubject);

/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   delete:
 *     summary: Delete a subject
 *     tags: [Admin]
 */
router.delete('/subjects/:id', deleteSubject);

// Class Management
/**
 * @swagger
 * /api/admin/classes:
 *   get:
 *     summary: List all classes
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: semester
 *         schema:
 *           type: integer
 */
router.get('/classes', getClasses);

/**
 * @swagger
 * /api/admin/classes:
 *   post:
 *     summary: Create a new class
 *     tags: [Admin]
 */
router.post('/classes', validate(createClassSchema), createClass);

/**
 * @swagger
 * /api/admin/classes/{id}:
 *   get:
 *     summary: Get class details with students and timetable
 *     tags: [Admin]
 */
router.get('/classes/:id', getClassDetails);

/**
 * @swagger
 * /api/admin/classes/{id}:
 *   put:
 *     summary: Update a class
 *     tags: [Admin]
 */
router.put('/classes/:id', validate(updateClassSchema), updateClass);

/**
 * @swagger
 * /api/admin/classes/{id}:
 *   delete:
 *     summary: Delete a class
 *     tags: [Admin]
 */
router.delete('/classes/:id', deleteClass);

/**
 * @swagger
 * /api/admin/classes/{id}/students:
 *   post:
 *     summary: Assign students to a class
 *     tags: [Admin]
 */
router.post('/classes/:id/students', validate(assignStudentsSchema), assignStudentsToClass);

/**
 * @swagger
 * /api/admin/classes/{id}/students:
 *   delete:
 *     summary: Remove students from a class
 *     tags: [Admin]
 */
router.delete('/classes/:id/students', removeStudentsFromClass);

// Timetable Management
/**
 * @swagger
 * /api/admin/timetables:
 *   get:
 *     summary: List timetable entries
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: teacherId
 *         schema:
 *           type: string
 */
router.get('/timetables', getTimetables);

/**
 * @swagger
 * /api/admin/timetables:
 *   post:
 *     summary: Create a timetable entry
 *     tags: [Admin]
 */
router.post('/timetables', validate(createTimetableSchema), createTimetable);

/**
 * @swagger
 * /api/admin/timetables/{id}:
 *   put:
 *     summary: Update a timetable entry
 *     tags: [Admin]
 */
router.put('/timetables/:id', validate(updateTimetableSchema), updateTimetable);

/**
 * @swagger
 * /api/admin/timetables/{id}:
 *   delete:
 *     summary: Delete a timetable entry
 *     tags: [Admin]
 */
router.delete('/timetables/:id', deleteTimetable);

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
