'use client';

import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import TeacherDashboard from '@/components/teacher/TeacherDashboard';
import StudentDashboard from '@/components/student/StudentDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div>
        <h1 className="text-2xl font-bold mb-6">
          Welcome, {user?.displayName || 'User'}
        </h1>

        {user?.role === 'teacher' && <TeacherDashboard />}
        {user?.role === 'student' && <StudentDashboard />}
        {user?.role === 'admin' && <AdminDashboard />}
      </div>
    </AppLayout>
  );
}
