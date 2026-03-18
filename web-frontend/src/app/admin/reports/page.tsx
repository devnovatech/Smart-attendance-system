'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

interface ReportItem {
  id: string;
  classId: string;
  subject: string;
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalSessions: 0, averageAttendance: 0 });

  useEffect(() => {
    loadReports();
  }, [page, startDate, endDate]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<ApiResponse<ReportItem[]> & { summary?: typeof summary; totalPages?: number }>(
        '/admin/reports',
        params
      );
      if (res.data) setReports(res.data);
      if (res.totalPages) setTotalPages(res.totalPages);
      if (res.summary) setSummary(res.summary);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const exportFile = async (format: 'excel' | 'pdf') => {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const blob = await api.get<Blob>(`/admin/reports/export/${format}`, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch {
      toast.error(`Failed to export ${format}`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Attendance Reports</h1>
          <div className="flex gap-2">
            <button onClick={() => exportFile('excel')} className="btn-secondary flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => exportFile('pdf')} className="btn-secondary flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary">{summary.totalSessions}</p>
            <p className="text-sm text-gray-500 mt-1">Total Sessions</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary">{summary.averageAttendance}%</p>
            <p className="text-sm text-gray-500 mt-1">Average Attendance</p>
          </div>
        </div>

        {/* Date Filters */}
        <div className="card flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="btn-secondary">Clear</button>
        </div>

        {/* Reports Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Subject</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">Total</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">Present</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">Absent</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">Late</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500">%</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3">{r.date}</td>
                    <td className="py-3 px-3 font-medium">{r.subject}</td>
                    <td className="py-3 px-3 text-center">{r.totalStudents}</td>
                    <td className="py-3 px-3 text-center text-green-600">{r.present}</td>
                    <td className="py-3 px-3 text-center text-red-600">{r.absent}</td>
                    <td className="py-3 px-3 text-center text-yellow-600">{r.late}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-semibold ${r.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                        {r.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500">No records found</td></tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">Previous</button>
                <span className="flex items-center text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
