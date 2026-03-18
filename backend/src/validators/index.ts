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
});

export const markAttendanceSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late']),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(['teacher', 'student', 'admin']),
  rollNumber: z.string().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['teacher', 'student', 'admin']).optional(),
  rollNumber: z.string().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
});

export const configSchema = z.object({
  attendanceThreshold: z.number().min(0).max(100).optional(),
  lateMarkMinutes: z.number().min(0).optional(),
  allowOfflineSync: z.boolean().optional(),
  maxSyncRetries: z.number().min(0).optional(),
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
