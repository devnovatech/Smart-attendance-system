import api from './api';
import { ApiResponse, AttendanceStatus } from '@/types';

export interface NotifyResult {
  sent: number;
  failed: number;
  skipped: number;
  errors?: { studentId: string; error: string }[];
}

export async function sendWhatsAppReports(
  classId: string,
  subject: string,
  options: { date?: string; statuses?: AttendanceStatus[] } = {}
): Promise<NotifyResult> {
  const result = await api.post<ApiResponse<NotifyResult>>(
    `/teacher/${classId}/attendance/notify-guardians`,
    { subject, ...options }
  );
  if (!result.data) {
    throw new Error(result.error || 'Failed to send WhatsApp reports');
  }
  return result.data;
}
