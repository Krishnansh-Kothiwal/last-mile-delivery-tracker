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
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400 text-xs">
        Verifying authentication state...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Sign In to Delivery Tracker
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm">
          Enter your account credentials to access your portal.
        </p>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Login Form */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1.5" htmlFor="email-input">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-blue-500 transition"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1.5" htmlFor="password-input">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-10 py-2.5 text-white outline-none focus:border-blue-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Signing In...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>

          <div className="pt-2 text-center border-t border-gray-800">
            <Link
              href="/register"
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition"
            >
              New customer? Create an account
            </Link>
          </div>
        </form>
      </div>

      {/* Demo Accounts Helper Section */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3 text-xs">
        <div className="font-bold text-gray-300 flex items-center justify-between">
          <span>Demo Account Credentials</span>
          <span className="text-[10px] text-blue-400 font-normal">Click to fill</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {/* Customer Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('rahul@example.com', 'customer123')}
            className="p-3 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/40 rounded-xl text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white group-hover:text-blue-300">Customer Demo</div>
                <div className="text-[11px] text-gray-400">rahul@example.com / customer123</div>
              </div>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">Fill</span>
          </button>

          {/* Agent Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('deepa@agent.com', 'agent123')}
            className="p-3 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 rounded-xl text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white group-hover:text-emerald-300">Delivery Agent Demo</div>
                <div className="text-[11px] text-gray-400">deepa@agent.com / agent123</div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">Fill</span>
          </button>

          {/* Admin Demo */}
          <button
            type="button"
            onClick={() => fillDemoAccount('admin@deliverytracker.com', 'admin123')}
            className="p-3 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/40 rounded-xl text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white group-hover:text-purple-300">Admin Demo</div>
                <div className="text-[11px] text-gray-400">admin@deliverytracker.com / admin123</div>
              </div>
            </div>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">Fill</span>
          </button>
        </div>
      </div>
    </div>
  );
}
