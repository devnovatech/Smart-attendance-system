'use client';

import { useEffect, useState, FormEvent, ChangeEvent, useRef } from 'react';
import * as XLSX from 'xlsx';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse, BulkUserRow, User } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Upload, FileSpreadsheet, Download, Search } from 'lucide-react';

const REQUIRED_COLUMNS = ['email', 'password', 'displayName', 'role'];
const OPTIONAL_COLUMNS = ['rollNumber', 'studentId', 'department', 'guardianPhone'];
const ROLE_VALUES = ['teacher', 'student', 'admin'];

type ParsedRow = BulkUserRow & { _row: number; _error?: string };

interface BulkResult {
  created: { email: string; uid: string }[];
  failed: { email: string; error: string }[];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<(User & { id: string }) | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'student' as 'teacher' | 'student' | 'admin',
    rollNumber: '',
    studentId: '',
    department: '',
    guardianPhone: '',
  });

  // Bulk import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, searchTerm]);

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await api.get<ApiResponse<string[]>>('/admin/departments');
      if (res.data) setDepartments(res.data);
    } catch {
      // non-fatal
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (roleFilter) params.role = roleFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get<ApiResponse<(User & { id: string })[]> & { total?: number; totalPages?: number }>(
        '/admin/users',
        params
      );
      if (res.data) setUsers(res.data);
      if (res.totalPages) setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { email: _e, password: _p, ...updates } = form;
        await api.put(`/admin/users/${editingUser.id}`, updates);
        toast.success('User updated');
      } else {
        await api.post('/admin/users', form);
        toast.success('User created');
      }
      setShowModal(false);
      resetForm();
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted');
      loadUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const openEdit = (user: User & { id: string }) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: '',
      displayName: user.displayName,
      role: user.role,
      rollNumber: user.rollNumber || '',
      studentId: user.studentId || '',
      department: user.department || '',
      guardianPhone: user.guardianPhone || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setForm({ email: '', password: '', displayName: '', role: 'student', rollNumber: '', studentId: '', department: '', guardianPhone: '' });
  };

  // ---- Bulk import ----

  const downloadTemplate = () => {
    const sample: Record<string, string> = {};
    [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].forEach((c) => (sample[c] = ''));
    sample.email = 'student1@example.com';
    sample.password = 'changeme123';
    sample.displayName = 'Student One';
    sample.role = 'student';
    sample.rollNumber = 'CS001';
    sample.department = departments[0] || 'Computer Science';

    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'users_template.xlsx');
  };

  const validateRow = (row: Record<string, unknown>, index: number): ParsedRow => {
    const email = String(row.email || '').trim();
    const password = String(row.password || '').trim();
    const displayName = String(row.displayName || '').trim();
    const role = String(row.role || '').trim().toLowerCase();

    const errors: string[] = [];
    if (!email) errors.push('email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email is invalid');
    if (!password) errors.push('password is required');
    else if (password.length < 6) errors.push('password must be at least 6 chars');
    if (!displayName) errors.push('displayName is required');
    if (!ROLE_VALUES.includes(role)) errors.push(`role must be one of ${ROLE_VALUES.join('/')}`);

    const dept = row.department ? String(row.department).trim() : '';
    if (dept && departments.length > 0 && !departments.includes(dept)) {
      errors.push(`department "${dept}" is not in the configured list`);
    }

    return {
      _row: index + 2, // +2 to match 1-based sheet rows (header at row 1)
      email,
      password,
      displayName,
      role: (role || 'student') as BulkUserRow['role'],
      rollNumber: row.rollNumber ? String(row.rollNumber).trim() : undefined,
      studentId: row.studentId ? String(row.studentId).trim() : undefined,
      department: dept || undefined,
      guardianPhone: row.guardianPhone ? String(row.guardianPhone).trim() : undefined,
      _error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  };

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        if (rows.length === 0) {
          toast.error('The spreadsheet has no rows');
          return;
        }

        // Verify required columns present
        const headers = Object.keys(rows[0]);
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          toast.error(`Missing required columns: ${missing.join(', ')}`);
          return;
        }

        const parsed = rows.map((r, i) => validateRow(r, i));
        setParsedRows(parsed);
        const errs = parsed.filter((r) => r._error).length;
        if (errs > 0) toast(`${errs} row(s) need fixing before import`, { icon: '⚠️' });
        else toast.success(`${parsed.length} row(s) ready to import`);
      } catch (err) {
        toast.error('Failed to parse Excel file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset the input so the same file can be picked again
    e.target.value = '';
  };

  const submitBulkImport = async () => {
    const validRows = parsedRows.filter((r) => !r._error);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setBulkSubmitting(true);
    try {
      const payload = {
        users: validRows.map(({ _row: _r, _error: _e, ...rest }) => rest),
      };
      const res = await api.post<ApiResponse<BulkResult>>('/admin/users/bulk', payload);
      if (res.data) {
        setBulkResult(res.data);
        toast.success(`Imported ${res.data.created.length} of ${validRows.length} user(s)`);
        loadUsers();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setParsedRows([]);
    setBulkResult(null);
  };

  const validRowCount = parsedRows.filter((r) => !r._error).length;
  const invalidRowCount = parsedRows.length - validRowCount;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowBulkModal(true)} className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Import from Excel
            </button>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {['', 'teacher', 'student', 'admin'].map((r) => (
              <button
                key={r}
                onClick={() => { setRoleFilter(r); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  roleFilter === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r || 'All'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email, roll no, dept…"
              className="input-field pl-9 pr-9 text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Department</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">{user.displayName}</td>
                    <td className="py-3 px-3 text-gray-600">{user.email}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{user.department || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(user)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(user.id, user.displayName)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
                  Previous
                </button>
                <span className="flex items-center text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm">
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Create User'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                {!editingUser && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" required minLength={6} />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'teacher' | 'student' | 'admin' })} className="input-field">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No departments configured yet — add some in System Settings.
                    </p>
                  )}
                </div>
                {form.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                      <input type="text" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                      <input type="text" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guardian&apos;s WhatsApp Number</label>
                      <input
                        type="tel"
                        value={form.guardianPhone}
                        onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                        className="input-field"
                        placeholder="e.g. +91 9876543210"
                      />
                      <p className="text-xs text-gray-400 mt-1">Used to send attendance reports via WhatsApp</p>
                    </div>
                  </>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">{editingUser ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Bulk Import Users from Excel</h3>
                </div>
                <button onClick={closeBulkModal} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!bulkResult && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium mb-1">Expected columns</p>
                    <p className="text-xs">
                      Required: <code className="bg-white px-1 rounded">{REQUIRED_COLUMNS.join(', ')}</code>
                    </p>
                    <p className="text-xs">
                      Optional: <code className="bg-white px-1 rounded">{OPTIONAL_COLUMNS.join(', ')}</code>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
                      <Download className="w-4 h-4" /> Download template
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFilePicked}
                      className="hidden"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
                      <Upload className="w-4 h-4" /> Choose Excel file
                    </button>
                  </div>

                  {parsedRows.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-gray-700">
                          {parsedRows.length} row(s) parsed —{' '}
                          <span className="text-green-700 font-medium">{validRowCount} valid</span>
                          {invalidRowCount > 0 && (
                            <>
                              ,{' '}
                              <span className="text-red-700 font-medium">{invalidRowCount} with errors</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-auto max-h-72">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Row</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Email</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Name</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Role</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Department</th>
                              <th className="text-left py-2 px-2 font-medium text-gray-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.map((row) => (
                              <tr key={row._row} className={`border-t ${row._error ? 'bg-red-50' : ''}`}>
                                <td className="py-1.5 px-2 text-gray-500">{row._row}</td>
                                <td className="py-1.5 px-2">{row.email}</td>
                                <td className="py-1.5 px-2">{row.displayName}</td>
                                <td className="py-1.5 px-2">{row.role}</td>
                                <td className="py-1.5 px-2">{row.department || '-'}</td>
                                <td className="py-1.5 px-2">
                                  {row._error ? (
                                    <span className="text-red-700 text-xs">{row._error}</span>
                                  ) : (
                                    <span className="text-green-700 text-xs">Ready</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={closeBulkModal} className="btn-secondary flex-1">Cancel</button>
                    <button
                      onClick={submitBulkImport}
                      disabled={validRowCount === 0 || bulkSubmitting}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      {bulkSubmitting ? 'Importing...' : `Import ${validRowCount} user(s)`}
                    </button>
                  </div>
                </div>
              )}

              {bulkResult && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                    Imported {bulkResult.created.length} user(s) successfully.
                  </div>
                  {bulkResult.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                      <p className="font-medium text-red-800 mb-2">
                        {bulkResult.failed.length} row(s) failed:
                      </p>
                      <ul className="text-xs text-red-700 list-disc list-inside space-y-1 max-h-48 overflow-auto">
                        {bulkResult.failed.map((f, i) => (
                          <li key={i}>
                            <span className="font-mono">{f.email}</span> — {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={closeBulkModal} className="btn-primary flex-1">Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
