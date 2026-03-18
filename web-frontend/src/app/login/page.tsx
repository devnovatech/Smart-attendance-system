'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type LoginMode = 'email' | 'studentId';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let loginEmail = email;

      if (mode === 'studentId') {
        const res = await api.post<{ success: boolean; data: { email: string } }>(
          '/auth/lookup-student-id',
          { studentId, password }
        );
        if (res.data?.email) {
          loginEmail = res.data.email;
        } else {
          toast.error('No student found with this ID');
          setLoading(false);
          return;
        }
      }

      await login(loginEmail, password);
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch {
      toast.error(mode === 'studentId' ? 'Invalid Student ID or password.' : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Attendance System</h1>
          <p className="text-gray-500 mt-1">Sign in to your account</p>
        </div>

        {/* Login Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'email' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode('studentId')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'studentId' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Student ID
          </button>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'email' ? (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="Enter your email"
                  required
                />
              </div>
            ) : (
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="input-field"
                  placeholder="Enter your Student ID (e.g., STU001)"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Demo Accounts:</p>
          <p>Admin: admin@smartattendance.com</p>
          <p>Teacher: teacher1@smartattendance.com</p>
          <p>Student: student1@smartattendance.com | ID: STU001</p>
          <p className="mt-1">(Password: role + @123, e.g., Admin@123)</p>
        </div>
      </div>
    </div>
  );
}
