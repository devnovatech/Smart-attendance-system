'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarData {
  [date: string]: {
    subjects: Record<string, string>;
  };
}

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<{ id: string; date: string; subject: string; status: string }[]>([]);

  useEffect(() => {
    loadData();
  }, [currentMonth, currentYear, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [calRes, histRes] = await Promise.all([
        api.get<ApiResponse<CalendarData>>(`/student/${user.uid}/calendar`, {
          month: String(currentMonth),
          year: String(currentYear),
        }),
        api.get<ApiResponse<typeof history>>(`/student/${user.uid}/attendance`),
      ]);
      if (calRes.data) setCalendarData(calRes.data);
      if (histRes.data) setHistory(histRes.data);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const getDayStatus = (day: number): 'present' | 'absent' | 'late' | 'mixed' | null => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = calendarData[dateStr];
    if (!dayData) return null;

    const statuses = Object.values(dayData.subjects);
    if (statuses.every((s) => s === 'present')) return 'present';
    if (statuses.every((s) => s === 'absent')) return 'absent';
    if (statuses.some((s) => s === 'late')) return 'late';
    return 'mixed';
  };

  const statusColors = {
    present: 'bg-green-100 text-green-800 border-green-300',
    absent: 'bg-red-100 text-red-800 border-red-300',
    late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    mixed: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Attendance</h1>

        {/* Calendar */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">{monthNames[currentMonth - 1]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-12" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const status = getDayStatus(day);
                  return (
                    <div
                      key={day}
                      className={`h-12 flex items-center justify-center rounded-lg text-sm font-medium border ${
                        status ? statusColors[status] : 'border-transparent text-gray-700'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200" /> Late</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200" /> Mixed</span>
              </div>
            </>
          )}
        </div>

        {/* Recent History */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Subject</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2 px-3">{item.date}</td>
                    <td className="py-2 px-3">{item.subject}</td>
                    <td className="py-2 px-3">
                      <span className={`badge-${item.status}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">No attendance records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
