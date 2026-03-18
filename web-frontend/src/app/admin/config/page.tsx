'use client';

import { useEffect, useState, FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

interface Config {
  attendanceThreshold: number;
  lateMarkMinutes: number;
  allowOfflineSync: boolean;
  maxSyncRetries: number;
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<Config>({
    attendanceThreshold: 75,
    lateMarkMinutes: 15,
    allowOfflineSync: true,
    maxSyncRetries: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.get<ApiResponse<Config>>('/admin/config');
        if (res.data) setConfig(res.data);
      } catch {
        toast.error('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/config', config);
      toast.success('Configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">System Configuration</h1>

        <form onSubmit={handleSubmit} className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attendance Threshold (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.attendanceThreshold}
              onChange={(e) => setConfig({ ...config, attendanceThreshold: Number(e.target.value) })}
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">Students below this percentage will see a warning alert.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Late Mark Grace Period (minutes)
            </label>
            <input
              type="number"
              min={0}
              value={config.lateMarkMinutes}
              onChange={(e) => setConfig({ ...config, lateMarkMinutes: Number(e.target.value) })}
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">Minutes after class start when attendance is marked as &quot;late&quot;.</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Allow Offline Sync</label>
              <p className="text-xs text-gray-500">Enable offline attendance marking with auto-sync.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, allowOfflineSync: !config.allowOfflineSync })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.allowOfflineSync ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.allowOfflineSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Sync Retries
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={config.maxSyncRetries}
              onChange={(e) => setConfig({ ...config, maxSyncRetries: Number(e.target.value) })}
              className="input-field"
            />
          </div>

          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
