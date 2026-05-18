'use client';

import { useEffect, useState, FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse } from '@/types';
import toast from 'react-hot-toast';
import { Save, Plus, X } from 'lucide-react';

interface Config {
  attendanceThreshold: number;
  lateMarkMinutes: number;
  allowOfflineSync: boolean;
  maxSyncRetries: number;
  departments: string[];
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<Config>({
    attendanceThreshold: 75,
    lateMarkMinutes: 15,
    allowOfflineSync: true,
    maxSyncRetries: 3,
    departments: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDepartments, setSavingDepartments] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.get<ApiResponse<Config>>('/admin/config');
        if (res.data) {
          setConfig({
            attendanceThreshold: res.data.attendanceThreshold ?? 75,
            lateMarkMinutes: res.data.lateMarkMinutes ?? 15,
            allowOfflineSync: res.data.allowOfflineSync ?? true,
            maxSyncRetries: res.data.maxSyncRetries ?? 3,
            departments: res.data.departments ?? [],
          });
        }
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
      const { departments: _dept, ...rest } = config;
      await api.put('/admin/config', rest);
      toast.success('Configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const persistDepartments = async (next: string[]) => {
    setSavingDepartments(true);
    try {
      await api.put('/admin/departments', { departments: next });
      setConfig((c) => ({ ...c, departments: next }));
      toast.success('Departments updated');
    } catch {
      toast.error('Failed to update departments');
    } finally {
      setSavingDepartments(false);
    }
  };

  const addDepartment = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newDepartment.trim();
    if (!trimmed) return;
    if (config.departments.includes(trimmed)) {
      toast.error('Department already exists');
      return;
    }
    await persistDepartments([...config.departments, trimmed]);
    setNewDepartment('');
  };

  const removeDepartment = async (name: string) => {
    if (!confirm(`Remove department "${name}"? Existing users/courses tagged with it will keep the value but it won't appear in dropdowns anymore.`)) return;
    await persistDepartments(config.departments.filter((d) => d !== name));
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
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">System Configuration</h1>

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

        {/* Departments editor */}
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Departments</h2>
            <p className="text-xs text-gray-500">
              These appear as dropdown options on the Users, Courses, and Classes pages.
            </p>
          </div>

          {config.departments.length === 0 ? (
            <p className="text-sm text-gray-400">No departments defined yet.</p>
          ) : (
            <ul className="space-y-2">
              {config.departments.map((dept) => (
                <li
                  key={dept}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
                >
                  <span>{dept}</span>
                  <button
                    type="button"
                    onClick={() => removeDepartment(dept)}
                    disabled={savingDepartments}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    aria-label={`Remove ${dept}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addDepartment} className="flex gap-2">
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={savingDepartments || !newDepartment.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
