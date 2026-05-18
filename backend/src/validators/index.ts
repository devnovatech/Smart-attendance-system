import { z } from 'zod';

export const loginSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export const studentIdLoginSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const attendanceRecordSchema = z.object({
  classId: z.string().min(1),
  subject: z.string().min(1),
  courseId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(['present', 'absent', 'late']),
    })
  ),
});

export const startAttendanceSchema = z.object({
  classId: z.string().min(1),
  subject: z.string().min(1),
  courseId: z.string().optional(),
});

export const markAttendanceSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late']),
});

export const notifyGuardiansSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  statuses: z.array(z.enum(['present', 'absent', 'late'])).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(['teacher', 'student', 'admin']),
  rollNumber: z.string().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
  guardianPhone: z.string().optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['teacher', 'student', 'admin']).optional(),
  rollNumber: z.string().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
  guardianPhone: z.string().optional(),
});

export const bulkCreateUsersSchema = z.object({
  users: z
    .array(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        displayName: z.string().min(1),
        role: z.enum(['teacher', 'student', 'admin']),
        rollNumber: z.string().optional(),
        studentId: z.string().optional(),
        department: z.string().optional(),
        guardianPhone: z.string().optional(),
      })
    )
    .min(1, 'At least one user row is required')
    .max(500, 'A maximum of 500 users can be imported per request'),
});

export const configSchema = z.object({
  attendanceThreshold: z.number().min(0).max(100).optional(),
  lateMarkMinutes: z.number().min(0).optional(),
  allowOfflineSync: z.boolean().optional(),
  maxSyncRetries: z.number().min(0).optional(),
  departments: z.array(z.string().min(1)).optional(),
});

export const departmentsSchema = z.object({
  departments: z.array(z.string().min(1)).min(0),
});

export const createCourseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  code: z.string().min(1, 'Course code is required'),
  department: z.string().min(1, 'Department is required'),
  semester: z.number().min(1).max(12),
  credits: z.number().min(0).optional(),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  semester: z.number().min(1).max(12).optional(),
  credits: z.number().min(0).optional(),
});

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  department: z.string().min(1, 'Department is required'),
  semester: z.number().min(1).max(12),
  section: z.string().min(1, 'Section is required'),
  academicYear: z.string().optional(),
  courseIds: z.array(z.string().min(1)).optional(),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  semester: z.number().min(1).max(12).optional(),
  section: z.string().min(1).optional(),
  academicYear: z.string().optional(),
});

export const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, 'At least one student ID is required'),
});

export const assignCoursesSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1, 'At least one course ID is required'),
});

export const createTimetableSchema = z.object({
  teacherId: z.string().min(1, 'Teacher is required'),
  classId: z.string().min(1, 'Class is required'),
  courseId: z.string().min(1, 'Course is required'),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:mm'),
  room: z.string().min(1, 'Room is required'),
});

export const updateTimetableSchema = z.object({
  teacherId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  room: z.string().min(1).optional(),
});

export const syncQueueSchema = z.object({
  items: z.array(
    z.object({
      action: z.string().min(1),
      data: z.record(z.unknown()),
      createdAt: z.string(),
    })
  ),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
