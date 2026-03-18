'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, Users, Check, X, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceEntry {
  studentId: string;
  status: 'present' | 'absent' | 'late';
  markedAt: string;
}

interface AttendanceRecord {
  id: string;
  classId: string;
  subject: string;
  date: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed';
  records: AttendanceEntry[];
}

export default function TeacherHistoryPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const subject = searchParams.get('subject');

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadHistory = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(
        `/teacher/${classId}/attendance`,
        { page: String(page), limit: '15' }
      );
      if (res.data) setRecords(res.data);
      if (res.totalPages) setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  }, [classId, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!classId || !subject) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select a class from your dashboard to view attendance history.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance History</h1>
          <p className="text-gray-500 mt-1">{subject}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="card text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No attendance records found.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {records.map((record) => {
                const presentCount = record.records.filter((r) => r.status === 'present').length;
                const absentCount = record.records.filter((r) => r.status === 'absent').length;
                const lateCount = record.records.filter((r) => r.status === 'late').length;
                const total = record.records.length;
                const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

                return (
                  <div key={record.id} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-gray-500">{record.date}</p>
                        <p className="font-semibold">{record.subject}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${percentage < 75 ? 'text-red-600' : 'text-green-600'}`}>
                          {percentage}%
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          record.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {record.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" /> {total} Total
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-green-500" /> {presentCount} Present
                      </span>
                      <span className="flex items-center gap-1.5">
                        <X className="w-4 h-4 text-red-500" /> {absentCount} Absent
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-yellow-500" /> {lateCount} Late
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
