export type UserRole = 'teacher' | 'student' | 'admin';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  rollNumber?: string;
  studentId?: string;
  department?: string;
  photoURL?: string;
  guardianPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Timetable {
  id: string;
  teacherId: string;
  classId: string;
  courseId: string;
  subject: string; // Snapshot of course name; preserved on attendance records
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  department: string;
  semester: number;
  credits?: number;
}

export interface Class {
  id: string;
  name: string;
  department: string;
  semester: number;
  section: string;
  academicYear: string;
  studentIds: string[];
  courseIds: string[];
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  teacherId: string;
  courseId?: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed';
  records: AttendanceEntry[];
}

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  markedAt: string;
  markedBy: string;
}

export interface AttendanceLog {
  id: string;
  action: string;
  userId: string;
  details: string;
  timestamp: string;
}

export interface Config {
  attendanceThreshold: number;
  lateMarkMinutes: number;
  allowOfflineSync: boolean;
  maxSyncRetries: number;
  departments: string[];
}

export interface SyncQueueItem {
  id: string;
  userId: string;
  action: string;
  data: Record<string, unknown>;
  createdAt: string;
  syncedAt?: string;
  status: 'pending' | 'synced' | 'failed';
  retries: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DecodedToken {
  uid: string;
  email: string;
  role: UserRole;
}

export interface BulkUserRow {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  rollNumber?: string;
  studentId?: string;
  department?: string;
  guardianPhone?: string;
}
