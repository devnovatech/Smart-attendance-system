'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';

interface LogEntry {
  id: string;
  action: string;
  userId: string;
  details: string;
  timestamp: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<LogEntry[]> & { totalPages?: number }>(
        '/admin/logs',
        { page: String(page), limit: '50' }
      );
      if (res.data) setLogs(res.data);
      if (res.totalPages) setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const actionColors: Record<string, string> = {
    CREATE_USER: 'bg-green-100 text-green-800',
    DELETE_USER: 'bg-red-100 text-red-800',
    START_ATTENDANCE: 'bg-blue-100 text-blue-800',
    SUBMIT_ATTENDANCE: 'bg-purple-100 text-purple-800',
    UPDATE_CONFIG: 'bg-orange-100 text-orange-800',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Logs</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="card">
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                    actionColors[log.action] || 'bg-gray-100 text-gray-800'
                  }`}>
                    {log.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{log.details}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(log.timestamp).toLocaleString()} | User: {log.userId.substring(0, 8)}...
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-center text-gray-500 py-8">No logs yet.</p>
              )}
            </div>

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
