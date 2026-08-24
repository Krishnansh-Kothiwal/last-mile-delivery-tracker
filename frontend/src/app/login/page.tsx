'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, UserCheck, Package } from 'lucide-react';

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
          LogisticsPro Sign In
        </h1>
        <p className="text-gray-600 text-sm">
          Enter your credentials to access your operations portal.
        </p>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Login Form matching Stitch light card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="email-input">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1.5" htmlFor="password-input">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                id="password-input"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold transition shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Signing In...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>

          <div className="pt-3 text-center border-t border-gray-100">
            <Link
              href="/register"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              New customer? Create an account
            </Link>
          </div>
        </form>
      </div>

      {/* Demo Accounts Helper Section - EXACT WORKING CREDENTIALS */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3 text-xs">
        <div className="font-bold text-gray-800 flex items-center justify-between">
          <span>Demo Account Credentials</span>
          <span className="text-[11px] text-blue-600 font-medium">Click to fill</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {/* Customer Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('rahul@example.com', 'customer123')}
            className="p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-gray-900 group-hover:text-blue-700">Customer Demo</div>
                <div className="text-[11px] text-gray-500">rahul@example.com / customer123</div>
              </div>
            </div>
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded font-semibold">Fill</span>
          </button>

          {/* Agent Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('deepa@agent.com', 'agent123')}
            className="p-3 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-green-100 text-green-700 rounded-md">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-gray-900 group-hover:text-green-700">Delivery Agent Demo</div>
                <div className="text-[11px] text-gray-500">deepa@agent.com / agent123</div>
              </div>
            </div>
            <span className="text-[11px] bg-green-600 text-white px-2.5 py-1 rounded font-semibold">Fill</span>
          </button>

          {/* Admin Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('admin@deliverytracker.com', 'admin123')}
            className="p-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-purple-100 text-purple-700 rounded-md">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-gray-900 group-hover:text-purple-700">Admin Demo</div>
                <div className="text-[11px] text-gray-500">admin@deliverytracker.com / admin123</div>
              </div>
            </div>
            <span className="text-[11px] bg-purple-600 text-white px-2.5 py-1 rounded font-semibold">Fill</span>
          </button>
        </div>
      </div>
    </div>
  );
}
