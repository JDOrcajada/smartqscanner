import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { API_BASE } from '../../imports/api';

export default function SignUpPage() {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect to home if already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!employeeNumber.trim()) {
      setError('Employee number is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employeeNumber,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sign up failed');
        return;
      }

      // Store token and redirect to dashboard
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('employeeId', employeeNumber);
      navigate('/');
    } catch (err) {
      setError('Connection error. Make sure backend server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-5xl flex items-stretch bg-[#8FD19E] rounded-3xl shadow-lg overflow-hidden">
        {/* Sign Up Card */}
        <div className="w-full max-w-sm p-8">
          <h1 className="text-3xl font-bold text-black mb-8">
            Sign Up
          </h1>

          {error && (
            <div className="mb-6 p-3 bg-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-6">
            <div>
              <label htmlFor="employeeNumber" className="block text-black mb-2">
                Employee Number
              </label>
              <input
                type="text"
                id="employeeNumber"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-black mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-black mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
              />
            </div>

            <div className="flex justify-center pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#2D8B3E] hover:bg-[#256F32] disabled:bg-gray-400 text-white font-semibold px-12 py-3 rounded-lg transition-colors"
              >
                {loading ? 'Signing Up...' : 'Sign Up'}
              </button>
            </div>

            <div className="text-center">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
                className="text-white underline hover:no-underline text-sm"
              >
                Already have an account? Login
              </a>
            </div>
          </form>
        </div>

        {/* Logo Section */}
        <div className="hidden md:flex flex-1 items-center justify-center bg-white">
          <div className="flex items-center gap-6 p-12">
            <div className="text-8xl text-gray-400">🏢</div>
            <div className="text-left">
              <p className="text-3xl font-bold text-gray-800">SmartQ Systems</p>
              <p className="text-sm text-gray-400 mt-2">Attendance System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
