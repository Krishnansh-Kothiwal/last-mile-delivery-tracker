'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to assigned portal
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'CUSTOMER') router.replace('/customer');
      else if (user.role === 'DELIVERY_AGENT') router.replace('/agent');
      else if (user.role === 'ADMIN') router.replace('/admin');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const loggedUser = await login(email.trim(), password);
      if (loggedUser.role === 'CUSTOMER') router.push('/customer');
      else if (loggedUser.role === 'DELIVERY_AGENT') router.push('/agent');
      else if (loggedUser.role === 'ADMIN') router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-gray-500 text-sm font-medium">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#F7F5F2]">
      {/* Login Container matching Stitch login_polished */}
      <main className="w-full max-w-md bg-white border border-gray-300 rounded-xl flex flex-col overflow-hidden relative shadow-sm">
        {/* Decorative Header Bar */}
        <div className="h-2 w-full bg-blue-600 absolute top-0 left-0"></div>

        <div className="p-8 pb-6 flex flex-col items-center border-b border-gray-200">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <span className="material-symbols-outlined text-3xl fill-1">local_shipping</span>
            <span className="text-3xl font-bold text-gray-900 tracking-tight">LogisticsPro</span>
          </div>
          <p className="text-base text-gray-600 text-center font-medium">
            Enter your credentials to access the console.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
          {error && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-lg">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
                mail
              </span>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@logisticspro.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-md text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow placeholder-gray-400"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="password">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
                lock
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-md text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center focus:outline-none"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-md flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Signing In...' : 'Sign In'}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>

          <div className="text-center mt-2">
            <p className="text-base text-gray-600 font-medium">
              New customer?{' '}
              <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </form>

        {/* Demo Helpers (Footer) */}
        <div className="bg-gray-50 p-6 border-t border-gray-200 flex flex-col gap-4">
          <p className="text-sm font-bold text-gray-600 text-center uppercase tracking-wider">
            Demo Quick Accounts
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => fillDemoAccount('cust@test.com', 'pass')}
              className="px-3.5 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors shadow-sm"
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('agent@test.com', 'pass')}
              className="px-3.5 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors shadow-sm"
            >
              Delivery Agent
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@test.com', 'pass')}
              className="px-3.5 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors shadow-sm"
            >
              Admin
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
