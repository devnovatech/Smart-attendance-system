import { Router } from 'express';
import {
  getUsers,
  createUser,
  bulkCreateUsers,
  updateUser,
  deleteUser,
  getReports,
  exportExcel,
  exportPdf,
  getConfig,
  updateConfig,
  getDepartments,
  updateDepartments,
  getLogs,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getClassDetails,
  assignStudentsToClass,
  removeStudentsFromClass,
  assignCoursesToClass,
  removeCoursesFromClass,
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
  bulkCreateUsersSchema,
  configSchema,
  departmentsSchema,
  createCourseSchema,
  updateCourseSchema,
  createClassSchema,
  updateClassSchema,
  assignStudentsSchema,
  assignCoursesSchema,
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
 * /api/admin/users/bulk:
 *   post:
 *     summary: Bulk-create users (Excel import)
 *     tags: [Admin]
 */
router.post('/users/bulk', validate(bulkCreateUsersSchema), bulkCreateUsers);

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

// Course Management
/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     summary: List all courses
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
router.get('/courses', getCourses);

/**
 * @swagger
 * /api/admin/courses:
 *   post:
 *     summary: Create a new course
 *     tags: [Admin]
 */
router.post('/courses', validate(createCourseSchema), createCourse);

/**
 * @swagger
 * /api/admin/courses/{id}:
 *   put:
 *     summary: Update a course
 *     tags: [Admin]
 */
router.put('/courses/:id', validate(updateCourseSchema), updateCourse);

/**
 * @swagger
 * /api/admin/courses/{id}:
 *   delete:
 *     summary: Delete a course
 *     tags: [Admin]
 */
router.delete('/courses/:id', deleteCourse);

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
 *     summary: Get class details with students, courses, and timetable
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

/**
 * @swagger
 * /api/admin/classes/{id}/courses:
 *   post:
 *     summary: Assign courses to a class
 *     tags: [Admin]
 */
router.post('/classes/:id/courses', validate(assignCoursesSchema), assignCoursesToClass);

/**
 * @swagger
 * /api/admin/classes/{id}/courses:
 *   delete:
 *     summary: Remove courses from a class
 *     tags: [Admin]
 */
router.delete('/classes/:id/courses', removeCoursesFromClass);

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

// Departments (used as dropdown source for users/courses/classes)
/**
 * @swagger
 * /api/admin/departments:
 *   get:
 *     summary: Get the list of departments
 *     tags: [Admin]
 */
router.get('/departments', getDepartments);

/**
 * @swagger
 * /api/admin/departments:
 *   put:
 *     summary: Replace the list of departments
 *     tags: [Admin]
 */
router.put('/departments', validate(departmentsSchema), updateDepartments);

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
