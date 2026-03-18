'use client';

import { useEffect, useState, FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse, ClassInfo, User, Timetable } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, CalendarDays, Clock } from 'lucide-react';

interface TimetableEntry extends Timetable {
  teacherName?: string;
  className?: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminTimetablePage() {
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [form, setForm] = useState({
    teacherId: '',
    classId: '',
    subject: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    room: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTimetables();
  }, [filterClassId, filterTeacherId]);

  const loadData = async () => {
    try {
      const [classRes, teacherRes] = await Promise.all([
        api.get<ApiResponse<ClassInfo[]>>('/admin/classes'),
        api.get<ApiResponse<(User & { id: string })[]> & { total?: number }>('/admin/users', { role: 'teacher', limit: '200' }),
      ]);
      if (classRes.data) setClasses(classRes.data);
      if (teacherRes.data) setTeachers(teacherRes.data);
    } catch {
      toast.error('Failed to load data');
    }
  };

  const loadTimetables = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterClassId) params.classId = filterClassId;
      if (filterTeacherId) params.teacherId = filterTeacherId;

      const res = await api.get<ApiResponse<TimetableEntry[]>>('/admin/timetables', params);
      if (res.data) setTimetables(res.data);
    } catch {
      toast.error('Failed to load timetables');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.startTime >= form.endTime) {
      toast.error('End time must be after start time');
      return;
    }
    try {
      await api.post('/admin/timetables', form);
      toast.success('Timetable entry created');
      setShowModal(false);
      resetForm();
      loadTimetables();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create timetable entry');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this timetable entry?')) return;
    try {
      await api.delete(`/admin/timetables/${id}`);
      toast.success('Timetable entry deleted');
      loadTimetables();
    } catch {
      toast.error('Failed to delete timetable entry');
    }
  };

  const resetForm = () => {
    setForm({ teacherId: '', classId: '', subject: '', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: '' });
  };

  // Group timetables by day
  const groupedByDay: Record<number, TimetableEntry[]> = {};
  for (const tt of timetables) {
    if (!groupedByDay[tt.dayOfWeek]) groupedByDay[tt.dayOfWeek] = [];
    groupedByDay[tt.dayOfWeek].push(tt);
  }
  // Sort each day by start time
  for (const day of Object.keys(groupedByDay)) {
    groupedByDay[parseInt(day)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Timetable Management</h1>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Class</label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name} ({cls.section})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Teacher</label>
            <select
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : timetables.length === 0 ? (
          <div className="card text-center py-12">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No timetable entries found. Create your first schedule.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const entries = groupedByDay[day];
              if (!entries || entries.length === 0) return null;
              return (
                <div key={day} className="card">
                  <h3 className="font-semibold text-lg mb-3 text-primary">{DAYS[day]}</h3>
                  <div className="space-y-2">
                    {entries.map((tt) => (
                      <div key={tt.id} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-sm font-mono">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{tt.startTime} - {tt.endTime}</span>
                          </div>
                          <div>
                            <span className="font-medium">{tt.subject}</span>
                            <span className="text-gray-400 mx-2">|</span>
                            <span className="text-sm text-gray-600">{tt.className || tt.classId}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Teacher: <span className="font-medium">{tt.teacherName || tt.teacherId}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Room: <span className="font-medium">{tt.room}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDelete(tt.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add Timetable Entry</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input-field" required>
                    <option value="">Select Class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name} - Section {cls.section} (Sem {cls.semester})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                  <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className="input-field" required>
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.displayName} ({t.department || 'No dept'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" placeholder="e.g. Data Structures" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                  <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })} className="input-field">
                    {DAYS.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input-field" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input type="text" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="input-field" placeholder="e.g. Room 301" required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
