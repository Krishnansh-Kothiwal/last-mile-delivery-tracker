'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';

export default function RegisterPage() {
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'CUSTOMER') router.replace('/customer');
      else if (user.role === 'DELIVERY_AGENT') router.replace('/agent');
      else if (user.role === 'ADMIN') router.replace('/admin');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Call backend public registration endpoint (automatically creates CUSTOMER user)
      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
        }),
      });

      // 2. Automatically log in the newly registered customer
      const loggedUser = await login(email.trim(), password);
      if (loggedUser.role === 'CUSTOMER') {
        router.push('/customer');
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-gray-500 text-sm font-medium">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-[#F7F5F2] font-sans">
      {/* Registration Card matching Stitch register_polished */}
      <main className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border border-gray-200 relative z-10 flex flex-col gap-8">
        {/* Header */}
        <header className="text-center flex flex-col gap-2">
          <div className="flex justify-center items-center gap-2 text-blue-600 mb-1">
            <span className="material-symbols-outlined text-[32px] fill-1">local_shipping</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LogisticsPro</h1>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Create Account</h2>
          <p className="text-base text-gray-600">Register to access the fleet management console.</p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-lg">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="fullName">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 text-[20px]">person</span>
              </div>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md bg-white text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 text-[20px]">mail</span>
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@logistics.pro"
                required
                className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md bg-white text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="phone">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 text-[20px]">call</span>
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
                className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md bg-white text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
              />
            </div>
          </div>

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-[20px]">lock</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md bg-white text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide" htmlFor="confirmPassword">
                Confirm
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-[20px]">lock_reset</span>
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md bg-white text-base text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2 mt-1">
            <div className="flex items-center h-5">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 bg-white cursor-pointer"
              />
            </div>
            <div className="text-sm text-gray-600 font-medium">
              <label htmlFor="terms" className="cursor-pointer">
                I agree to the <span className="text-blue-600 hover:text-blue-700 font-semibold">Terms of Service</span> and <span className="text-blue-600 hover:text-blue-700 font-semibold">Privacy Policy</span>.
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4 mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-blue-600 text-white text-base font-semibold rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
            <div className="text-center">
              <span className="text-sm text-gray-600 font-medium">Already have an account? </span>
              <Link href="/login" className="text-sm text-blue-600 font-semibold hover:text-blue-700">
                Sign In
              </Link>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
