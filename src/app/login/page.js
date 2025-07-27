'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { demoUsers } from '@/data/demoUsers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const router = useRouter();
  const { login, user, loading, isAuthenticated } = useAuth();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isAuthenticated]);

  const handleSeedDatabase = async () => {
    try {
      setSeedLoading(true);
      const response = await fetch('/api/seed');
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error('Error seeding database:', error);
      alert('Error seeding database');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoginLoading(true);
      await login(email, password);
      router.push('/dashboard');
    } catch (error) {
      setError(error.message || 'Failed to login');
    } finally {
      setLoginLoading(false);
    }
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Don't render login form if user is authenticated
  if (isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-[500px] space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Real-time Notification System</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Password"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSeedDatabase}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              disabled={seedLoading}
            >
              {seedLoading ? 'Processing...' : 'Insert Demo Users'}
            </button>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={loginLoading}
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm">
          <h3 className="font-medium text-center mb-2">Demo Users:</h3>
          <ul className="max-h-[200px] overflow-y-scroll space-y-2 border rounded-md p-3 bg-gray-50">
            {demoUsers.map(user => (
              <li key={user.id} className="flex justify-between items-center">
                <span>{user.email} | {user.password}</span>
                <button 
                  className="bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded transition-colors" 
                  onClick={() => { setEmail(user.email); setPassword(user.password) }}
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
