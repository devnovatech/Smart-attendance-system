'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse, User, AttendanceStatus } from '@/types';
import toast from 'react-hot-toast';
import { Check, X, Clock, AlertTriangle, Send, Users } from 'lucide-react';

interface StudentAttendance {
  student: User;
  status: AttendanceStatus | null;
}

export default function TeacherAttendancePage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const subject = searchParams.get('subject');

  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skippedStudents, setSkippedStudents] = useState<string[]>([]);
  const [showSkippedModal, setShowSkippedModal] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await api.get<ApiResponse<User[]>>(`/teacher/${classId}/students`);
      if (res.data) {
        setStudents(res.data.map((s) => ({ student: s, status: null })));
      }
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const markStudent = async (studentId: string, status: AttendanceStatus) => {
    try {
      await api.post(`/teacher/${classId}/attendance`, { studentId, status });
      setStudents((prev) =>
        prev.map((s) =>
          s.student.uid === studentId ? { ...s, status } : s
        )
      );
    } catch {
      toast.error('Failed to mark attendance');
    }
  };

  const handleSubmit = async () => {
    const unmarked = students.filter((s) => s.status === null);
    if (unmarked.length > 0) {
      setSkippedStudents(unmarked.map((s) => s.student.displayName));
      setShowSkippedModal(true);
      return;
    }
    await submitAttendance(false);
  };

  const submitAttendance = async (confirmSkipped: boolean) => {
    setSubmitting(true);
    try {
      await api.post(`/teacher/${classId}/attendance/submit`, { confirmSkipped });
      toast.success('Attendance submitted successfully!');
      setShowSkippedModal(false);
    } catch {
      toast.error('Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const markedCount = students.filter((s) => s.status !== null).length;
  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;

  if (!classId || !subject) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Select a class from your dashboard to take attendance.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Take Attendance</h1>
            <p className="text-gray-500 mt-1">{subject} - {new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || markedCount === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Attendance'}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-2xl font-bold">{students.length}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
            <p className="text-sm text-gray-500">Present</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{absentCount}</p>
            <p className="text-sm text-gray-500">Absent</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{lateCount}</p>
            <p className="text-sm text-gray-500">Late</p>
          </div>
        </div>

        {/* Student List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {students.map(({ student, status }) => (
              <div
                key={student.uid}
                className={`card flex items-center justify-between ${
                  status === 'present'
                    ? 'border-l-4 border-l-green-500'
                    : status === 'absent'
                      ? 'border-l-4 border-l-red-500'
                      : status === 'late'
                        ? 'border-l-4 border-l-yellow-500'
                        : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {student.photoURL ? (
                      <img
                        src={student.photoURL}
                        alt={student.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">
                        {student.displayName[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{student.displayName}</p>
                    <p className="text-sm text-gray-500">
                      {student.rollNumber} | {student.studentId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markStudent(student.uid, 'present')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'present'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => markStudent(student.uid, 'absent')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'absent'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => markStudent(student.uid, 'late')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'late'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skipped Students Modal */}
        {showSkippedModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <h3 className="text-lg font-semibold">Unmarked Students</h3>
              </div>
              <p className="text-gray-600 mb-3">
                The following students have not been marked and will be set as absent:
              </p>
              <ul className="list-disc list-inside mb-4 text-sm text-gray-700 max-h-40 overflow-auto">
                {skippedStudents.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button onClick={() => setShowSkippedModal(false)} className="btn-secondary flex-1">
                  Go Back
                </button>
                <button
                  onClick={() => submitAttendance(true)}
                  disabled={submitting}
                  className="btn-primary flex-1"
                >
                  {submitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
