'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Timetable, ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Clock, MapPin, BookOpen, Play, History } from 'lucide-react';

export default function TeacherDashboard() {
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [currentClass, setCurrentClass] = useState<{ timetable: Timetable; class: { id: string; name: string } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ttRes, ccRes] = await Promise.all([
        api.get<ApiResponse<Timetable[]>>('/teacher/timetable'),
        api.get<ApiResponse<typeof currentClass>>('/teacher/current-class'),
      ]);
      if (ttRes.data) setTimetable(ttRes.data);
      if (ccRes.data) setCurrentClass(ccRes.data);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAttendance = async (classId: string, subject: string) => {
    try {
      await api.post('/teacher/attendance/start', { classId, subject });
      toast.success('Attendance session started!');
      window.location.href = `/teacher?classId=${classId}&subject=${subject}`;
    } catch {
      toast.error('Failed to start attendance');
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Class Alert */}
      {currentClass && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary">Current Class in Session</h3>
              <p className="text-primary-600 mt-1">
                {currentClass.timetable.subject} - {currentClass.class.name}
              </p>
              <p className="text-sm text-primary-500 mt-0.5">
                {currentClass.timetable.startTime} - {currentClass.timetable.endTime} | Room {currentClass.timetable.room}
              </p>
            </div>
            <button
              onClick={() => handleStartAttendance(currentClass.timetable.classId, currentClass.timetable.subject)}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Attendance
            </button>
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Today&apos;s Schedule ({dayNames[today]})</h2>
        {timetable.filter((t) => t.dayOfWeek === today).length === 0 ? (
          <p className="text-gray-500">No classes scheduled for today.</p>
        ) : (
          <div className="space-y-3">
            {timetable
              .filter((t) => t.dayOfWeek === today)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <Clock className="w-5 h-5 text-gray-400 mx-auto" />
                      <p className="text-sm font-medium mt-1">{entry.startTime}</p>
                      <p className="text-xs text-gray-400">{entry.endTime}</p>
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        {entry.subject}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        Room {entry.room}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/teacher/history?classId=${entry.classId}&subject=${entry.subject}`}
                      className="btn-secondary text-sm flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      History
                    </Link>
                    <button
                      onClick={() => handleStartAttendance(entry.classId, entry.subject)}
                      className="btn-secondary text-sm"
                    >
                      Take Attendance
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Weekly Timetable */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Weekly Timetable</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Day</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Time</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Subject</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Room</th>
              </tr>
            </thead>
            <tbody>
              {timetable
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                .map((entry) => (
                  <tr key={entry.id} className={`border-b ${entry.dayOfWeek === today ? 'bg-primary-50' : ''}`}>
                    <td className="py-2 px-3">{dayNames[entry.dayOfWeek]}</td>
                    <td className="py-2 px-3">{entry.startTime} - {entry.endTime}</td>
                    <td className="py-2 px-3 font-medium">{entry.subject}</td>
                    <td className="py-2 px-3">{entry.room}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
