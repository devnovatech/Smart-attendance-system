'use client';

import { useEffect, useState, FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ApiResponse, ClassInfo, Course, User } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, GraduationCap, Users, UserPlus, UserMinus, BookOpen, BookPlus, BookMinus, Search } from 'lucide-react';

interface ClassWithDetails extends ClassInfo {
  students?: (User & { uid: string })[];
  courses?: Course[];
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [form, setForm] = useState({
    name: '',
    department: '',
    semester: 1,
    section: 'A',
    academicYear: '',
    courseIds: [] as string[],
  });

  // Student assignment state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithDetails | null>(null);
  const [allStudents, setAllStudents] = useState<(User & { id: string })[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Course assignment state
  const [showCourseModal, setShowCourseModal] = useState(false);

  // Search inside assignment modals
  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    loadClasses();
    loadDepartments();
    loadCourses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ClassInfo[]>>('/admin/classes');
      if (res.data) setClasses(res.data);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get<ApiResponse<string[]>>('/admin/departments');
      if (res.data) setDepartments(res.data);
    } catch {
      // non-fatal
    }
  };

  const loadCourses = async () => {
    try {
      const res = await api.get<ApiResponse<Course[]>>('/admin/courses');
      if (res.data) setAllCourses(res.data);
    } catch {
      // non-fatal
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.department) {
      toast.error('Please pick a department');
      return;
    }
    try {
      const payload = {
        ...form,
        academicYear: form.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      };
      if (editingClass) {
        const { courseIds: _ci, ...updates } = payload;
        await api.put(`/admin/classes/${editingClass.id}`, updates);
        toast.success('Class updated');
      } else {
        await api.post('/admin/classes', payload);
        toast.success('Class created');
      }
      setShowModal(false);
      resetForm();
      loadClasses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete class "${name}"? This will also delete related timetable entries.`)) return;
    try {
      await api.delete(`/admin/classes/${id}`);
      toast.success('Class deleted');
      loadClasses();
    } catch {
      toast.error('Failed to delete class');
    }
  };

  const openEdit = (cls: ClassInfo) => {
    setEditingClass(cls);
    setForm({
      name: cls.name,
      department: cls.department,
      semester: cls.semester,
      section: cls.section,
      academicYear: cls.academicYear || '',
      courseIds: cls.courseIds || [],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingClass(null);
    setForm({
      name: '',
      department: departments[0] || '',
      semester: 1,
      section: 'A',
      academicYear: '',
      courseIds: [],
    });
  };

  const refreshClassDetails = async (classId: string) => {
    const res = await api.get<ApiResponse<ClassWithDetails>>(`/admin/classes/${classId}`);
    if (res.data) setSelectedClass(res.data);
  };

  // ---- Students ----

  const openStudentAssignment = async (cls: ClassInfo) => {
    setLoadingDetails(true);
    setShowStudentModal(true);
    setStudentSearch('');
    try {
      const [classRes, studentsRes] = await Promise.all([
        api.get<ApiResponse<ClassWithDetails>>(`/admin/classes/${cls.id}`),
        api.get<ApiResponse<(User & { id: string })[]> & { total?: number }>('/admin/users', { role: 'student', limit: '200' }),
      ]);
      if (classRes.data) setSelectedClass(classRes.data);
      if (studentsRes.data) setAllStudents(studentsRes.data);
    } catch {
      toast.error('Failed to load class details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const assignStudent = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      await api.post(`/admin/classes/${selectedClass.id}/students`, { studentIds: [studentId] });
      toast.success('Student assigned');
      await refreshClassDetails(selectedClass.id);
      loadClasses();
    } catch {
      toast.error('Failed to assign student');
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      const token = api.getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      await fetch(`${API_URL}/admin/classes/${selectedClass.id}/students`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentIds: [studentId] }),
      });
      toast.success('Student removed');
      await refreshClassDetails(selectedClass.id);
      loadClasses();
    } catch {
      toast.error('Failed to remove student');
    }
  };

  // ---- Courses ----

  const openCourseAssignment = async (cls: ClassInfo) => {
    setLoadingDetails(true);
    setShowCourseModal(true);
    setCourseSearch('');
    try {
      const classRes = await api.get<ApiResponse<ClassWithDetails>>(`/admin/classes/${cls.id}`);
      if (classRes.data) setSelectedClass(classRes.data);
      if (allCourses.length === 0) await loadCourses();
    } catch {
      toast.error('Failed to load class details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const assignCourse = async (courseId: string) => {
    if (!selectedClass) return;
    try {
      await api.post(`/admin/classes/${selectedClass.id}/courses`, { courseIds: [courseId] });
      toast.success('Course added to class');
      await refreshClassDetails(selectedClass.id);
      loadClasses();
    } catch {
      toast.error('Failed to assign course');
    }
  };

  const removeCourse = async (courseId: string) => {
    if (!selectedClass) return;
    try {
      const token = api.getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      await fetch(`${API_URL}/admin/classes/${selectedClass.id}/courses`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseIds: [courseId] }),
      });
      toast.success('Course removed from class');
      await refreshClassDetails(selectedClass.id);
      loadClasses();
    } catch {
      toast.error('Failed to remove course');
    }
  };

  const toggleCourseInForm = (courseId: string) => {
    setForm((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id) => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  };

  const studentMatches = (s: { displayName?: string; email?: string; rollNumber?: string; studentId?: string; department?: string }) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    return [s.displayName, s.email, s.rollNumber, s.studentId, s.department]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  };

  const courseMatches = (c: Course) => {
    if (!courseSearch.trim()) return true;
    const q = courseSearch.trim().toLowerCase();
    return [c.name, c.code, c.department].some((v) => v.toLowerCase().includes(q));
  };

  const assignedStudentIds = selectedClass?.studentIds || [];
  const unassignedStudents = allStudents.filter((s) => !assignedStudentIds.includes(s.id));
  const filteredAssignedStudents = (selectedClass?.students || []).filter(studentMatches);
  const filteredUnassignedStudents = unassignedStudents.filter(studentMatches);

  const assignedCourseIds = selectedClass?.courseIds || [];
  const unassignedCourses = allCourses.filter((c) => !assignedCourseIds.includes(c.id));
  const filteredAssignedCourses = (selectedClass?.courses || []).filter(courseMatches);
  const filteredUnassignedCourses = unassignedCourses.filter(courseMatches);

  const formEligibleCourses = form.department
    ? allCourses.filter((c) => c.department === form.department)
    : allCourses;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Manage Classes</h1>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Class
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : classes.length === 0 ? (
          <div className="card text-center py-12">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No classes found. Create your first class.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <div key={cls.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{cls.name}</h3>
                    <p className="text-sm text-gray-500">{cls.department} - Semester {cls.semester}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cls)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cls.id, cls.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Section</span>
                    <span className="font-medium">{cls.section}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Academic Year</span>
                    <span className="font-medium">{cls.academicYear || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Students</span>
                    <span className="font-medium">{cls.studentIds?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Courses</span>
                    <span className="font-medium">{cls.courseIds?.length || 0}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openStudentAssignment(cls)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Students
                  </button>
                  <button
                    onClick={() => openCourseAssignment(cls)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Courses
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingClass ? 'Edit Class' : 'Create Class'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. B.Tech CSE 3rd Year" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {departments.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No departments configured.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <input type="number" value={form.semester} onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) || 1 })} className="input-field" min={1} max={12} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <input type="text" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="input-field" placeholder="e.g. A" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                    <input type="text" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className="input-field" placeholder="e.g. 2025-2026" />
                  </div>
                </div>

                {!editingClass && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Courses ({form.courseIds.length} selected)
                    </label>
                    {formEligibleCourses.length === 0 ? (
                      <p className="text-xs text-gray-400 px-2 py-3">
                        {form.department
                          ? `No courses for ${form.department}.`
                          : 'Select a department to see available courses.'}{' '}
                        You can add courses to this class later.
                      </p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg max-h-44 overflow-auto divide-y">
                        {formEligibleCourses.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={form.courseIds.includes(c.id)}
                              onChange={() => toggleCourseInForm(c.id)}
                            />
                            <span className="font-mono text-xs text-gray-500">{c.code}</span>
                            <span>{c.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">Sem {c.semester}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">{editingClass ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Student Assignment Modal */}
        {showStudentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Manage Students - {selectedClass?.name || ''}
                </h3>
                <button onClick={() => { setShowStudentModal(false); setSelectedClass(null); }} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name, email, roll no, dept…"
                      className="input-field pl-9 pr-9 text-sm"
                    />
                    {studentSearch && (
                      <button
                        type="button"
                        onClick={() => setStudentSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Assigned Students */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Assigned Students ({filteredAssignedStudents.length}
                      {studentSearch && ` of ${selectedClass?.students?.length || 0}`})
                    </h4>
                    {filteredAssignedStudents.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {filteredAssignedStudents.map((student) => (
                          <div key={student.uid} className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                            <div>
                              <span className="font-medium text-sm">{student.displayName}</span>
                              <span className="text-xs text-gray-500 ml-2">{student.rollNumber || student.email}</span>
                            </div>
                            <button onClick={() => removeStudent(student.uid)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove from class">
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">
                        {studentSearch
                          ? 'No assigned students match your search.'
                          : 'No students assigned yet.'}
                      </p>
                    )}
                  </div>

                  {/* Unassigned Students */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Available Students ({filteredUnassignedStudents.length}
                      {studentSearch && ` of ${unassignedStudents.length}`})
                    </h4>
                    {filteredUnassignedStudents.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {filteredUnassignedStudents.map((student) => (
                          <div key={student.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                            <div>
                              <span className="font-medium text-sm">{student.displayName}</span>
                              <span className="text-xs text-gray-500 ml-2">{student.email}</span>
                            </div>
                            <button onClick={() => assignStudent(student.id)} className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded" title="Add to class">
                              <UserPlus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">
                        {studentSearch
                          ? 'No available students match your search.'
                          : 'All students are assigned to this class.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Course Assignment Modal */}
        {showCourseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Manage Courses - {selectedClass?.name || ''}
                </h3>
                <button onClick={() => { setShowCourseModal(false); setSelectedClass(null); }} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search by course name, code or department…"
                      className="input-field pl-9 pr-9 text-sm"
                    />
                    {courseSearch && (
                      <button
                        type="button"
                        onClick={() => setCourseSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Assigned Courses ({filteredAssignedCourses.length}
                      {courseSearch && ` of ${selectedClass?.courses?.length || 0}`})
                    </h4>
                    {filteredAssignedCourses.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {filteredAssignedCourses.map((course) => (
                          <div key={course.id} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                            <div>
                              <span className="font-mono text-xs text-gray-500 mr-2">{course.code}</span>
                              <span className="font-medium text-sm">{course.name}</span>
                              <span className="text-xs text-gray-500 ml-2">Sem {course.semester}</span>
                            </div>
                            <button onClick={() => removeCourse(course.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove from class">
                              <BookMinus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">
                        {courseSearch
                          ? 'No assigned courses match your search.'
                          : 'No courses assigned yet.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">
                      Available Courses ({filteredUnassignedCourses.length}
                      {courseSearch && ` of ${unassignedCourses.length}`})
                    </h4>
                    {filteredUnassignedCourses.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {filteredUnassignedCourses.map((course) => (
                          <div key={course.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                            <div>
                              <span className="font-mono text-xs text-gray-500 mr-2">{course.code}</span>
                              <span className="font-medium text-sm">{course.name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {course.department} · Sem {course.semester}
                              </span>
                            </div>
                            <button onClick={() => assignCourse(course.id)} className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded" title="Add to class">
                              <BookPlus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">
                        {courseSearch
                          ? 'No available courses match your search.'
                          : 'All courses are assigned to this class.'}
                      </p>
                    )}
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
