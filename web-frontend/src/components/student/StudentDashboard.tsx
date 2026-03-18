'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { DashboardData, ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { AlertTriangle, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await api.get<ApiResponse<DashboardData>>('/student/dashboard');
        if (res.data) setData(res.data);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!data) return <p className="text-gray-500">No attendance data available.</p>;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert) => (
            <div key={alert.subject} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Subject-wise Attendance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(data.subjects).map(([subject, stats]) => {
          const isLow = stats.percentage < data.threshold;
          return (
            <div key={subject} className={`card border-l-4 ${isLow ? 'border-l-red-500' : 'border-l-green-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">{subject}</h3>
                </div>
                {isLow ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Attendance</span>
                  <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${stats.percentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-green-50 rounded p-1.5">
                  <p className="font-semibold text-green-700">{stats.present}</p>
                  <p className="text-green-600">Present</p>
                </div>
                <div className="bg-red-50 rounded p-1.5">
                  <p className="font-semibold text-red-700">{stats.absent}</p>
                  <p className="text-red-600">Absent</p>
                </div>
                <div className="bg-yellow-50 rounded p-1.5">
                  <p className="font-semibold text-yellow-700">{stats.late}</p>
                  <p className="text-yellow-600">Late</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Threshold info */}
      <div className="card bg-gray-50">
        <p className="text-sm text-gray-600">
          Minimum attendance threshold: <span className="font-semibold text-primary">{data.threshold}%</span>
        </p>
      </div>
    </div>
  );
}
