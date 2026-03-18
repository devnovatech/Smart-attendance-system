'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { Users, BarChart3, Settings, FileText, BookOpen, GraduationCap, Clock } from 'lucide-react';
import Link from 'next/link';

interface ReportSummary {
  totalSessions: number;
  averageAttendance: number;
}

export default function AdminDashboard() {
  const [userCount, setUserCount] = useState({ teachers: 0, students: 0 });
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teacherRes, studentRes, reportRes] = await Promise.all([
          api.get<ApiResponse & { total?: number }>('/admin/users', { role: 'teacher', limit: '1' }),
          api.get<ApiResponse & { total?: number }>('/admin/users', { role: 'student', limit: '1' }),
          api.get<ApiResponse & { summary?: ReportSummary }>('/admin/reports', { limit: '1' }),
        ]);

        setUserCount({
          teachers: teacherRes.total || 0,
          students: studentRes.total || 0,
        });

        if (reportRes.summary) setSummary(reportRes.summary);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const cards = [
    {
      title: 'Teachers',
      value: userCount.teachers,
      icon: Users,
      href: '/admin/users?role=teacher',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Students',
      value: userCount.students,
      icon: Users,
      href: '/admin/users?role=student',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Total Sessions',
      value: summary?.totalSessions || 0,
      icon: BarChart3,
      href: '/admin/reports',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Avg Attendance',
      value: `${summary?.averageAttendance || 0}%`,
      icon: FileText,
      href: '/admin/reports',
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <div className="card hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/users" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Manage Users</h3>
              <p className="text-sm text-gray-500">Add, edit, or remove users</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/subjects" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Manage Subjects</h3>
              <p className="text-sm text-gray-500">Add and manage course subjects</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/classes" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Manage Classes</h3>
              <p className="text-sm text-gray-500">Create classes and assign students</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/timetable" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Timetable</h3>
              <p className="text-sm text-gray-500">Assign teachers to classes with schedules</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/reports" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">View Reports</h3>
              <p className="text-sm text-gray-500">Export attendance data</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/config" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">System Settings</h3>
              <p className="text-sm text-gray-500">Configure thresholds and policies</p>
            </div>
          </div>
        </Link>
        <Link href="/admin/logs" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">System Logs</h3>
              <p className="text-sm text-gray-500">View all system activity</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
