'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Truck, Package, ShieldCheck, UserCheck, LogOut, LogIn } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Last-Mile Logistics
            </span>
            <span className="block text-xs text-blue-400 font-medium">Bengaluru Logistics Network</span>
          </div>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-gray-900/60 p-1.5 rounded-xl border border-gray-800">
            {user.role === 'CUSTOMER' && (
              <Link
                href="/customer"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pathname.startsWith('/customer')
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Customer Portal
              </Link>
            )}

            {user.role === 'DELIVERY_AGENT' && (
              <Link
                href="/agent"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pathname.startsWith('/agent')
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Agent Portal
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pathname.startsWith('/admin')
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Control
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* User Tag */}
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-200">{user.full_name}</div>
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{user.role}</div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition flex items-center gap-1 text-xs"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
