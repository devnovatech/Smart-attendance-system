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
}

export interface Timetable {
  id: string;
  teacherId: string;
  classId: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

export interface SubjectStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
}

export interface DashboardData {
  subjects: Record<string, SubjectStats>;
  threshold: number;
  alerts: { subject: string; percentage: number; message: string }[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
