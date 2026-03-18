'use client';

import { useEffect, useState, FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse, Subject } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, BookOpen } from 'lucide-react';

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    department: '',
    semester: 1,
    credits: 0,
  });

  useEffect(() => {
    loadSubjects();
  }, [departmentFilter]);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (departmentFilter) params.department = departmentFilter;

      const res = await api.get<ApiResponse<Subject[]>>('/admin/subjects', params);
      if (res.data) setSubjects(res.data);
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await api.put(`/admin/subjects/${editingSubject.id}`, form);
        toast.success('Subject updated');
      } else {
        await api.post('/admin/subjects', form);
        toast.success('Subject created');
      }
      setShowModal(false);
      resetForm();
      loadSubjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/subjects/${id}`);
      toast.success('Subject deleted');
      loadSubjects();
    } catch {
      toast.error('Failed to delete subject');
    }
  };

  const openEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      department: subject.department,
      semester: subject.semester,
      credits: subject.credits || 0,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingSubject(null);
    setForm({ name: '', code: '', department: '', semester: 1, credits: 0 });
  };

  const departments = Array.from(new Set(subjects.map((s) => s.department))).filter(Boolean);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Manage Subjects</h1>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDepartmentFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !departmentFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setDepartmentFilter(dept)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                departmentFilter === dept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : subjects.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No subjects found. Create your first subject.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Code</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Department</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Semester</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Credits</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-3 font-mono font-medium">{subject.code}</td>
                    <td className="py-3 px-3">{subject.name}</td>
                    <td className="py-3 px-3 text-gray-600">{subject.department}</td>
                    <td className="py-3 px-3 text-gray-600">{subject.semester}</td>
                    <td className="py-3 px-3 text-gray-600">{subject.credits || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(subject)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(subject.id, subject.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingSubject ? 'Edit Subject' : 'Create Subject'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input-field" placeholder="e.g. CS101" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Data Structures" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field" placeholder="e.g. CSE" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <input type="number" value={form.semester} onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) || 1 })} className="input-field" min={1} max={12} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                  <input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })} className="input-field" min={0} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">{editingSubject ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
