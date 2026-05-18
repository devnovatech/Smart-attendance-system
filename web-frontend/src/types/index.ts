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
}

export interface Timetable {
  id: string;
  teacherId: string;
  classId: string;
  courseId: string;
  subject: string; // snapshot of course name
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

export interface ClassInfo {
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
  date: string;
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

export interface CourseStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
}

export interface DashboardData {
  subjects: Record<string, CourseStats>;
  threshold: number;
  alerts: { subject: string; percentage: number; message: string }[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
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
