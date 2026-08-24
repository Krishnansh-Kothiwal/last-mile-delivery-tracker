'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { User, Mail, Phone, Lock, Eye, EyeOff, UserPlus, AlertCircle, Package } from 'lucide-react';

export default function RegisterPage() {
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    setSubmitting(true);

    try {
      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
        }),
      });

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
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500 text-sm font-medium">
        Verifying authentication state...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      {/* Stitch Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 mb-1">
          <Package className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Create Customer Account
        </h1>
        <p className="text-gray-600 text-sm">
          Register to calculate deterministic rates and manage your shipments.
        </p>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form Panel matching Stitch light card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="reg-name">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Vikram Sharma"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="reg-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="reg-phone">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="reg-password">
              Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="reg-confirm-password">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold transition shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Register Customer Account
              </>
            )}
          </button>

          <div className="pt-3 text-center border-t border-gray-100">
            <Link
              href="/login"
              className="text-xs text-gray-600 hover:text-gray-900 font-medium transition"
            >
              Already have an account? <span className="text-blue-600 font-semibold hover:underline">Sign In</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
