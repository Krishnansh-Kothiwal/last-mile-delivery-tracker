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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-gray-900">
              LogisticsPro
            </span>
            <span className="block text-xs text-blue-600 font-semibold">Bengaluru Network</span>
          </div>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            {user.role === 'CUSTOMER' && (
              <Link
                href="/customer"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  pathname.startsWith('/customer')
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Customer Portal
              </Link>
            )}

            {user.role === 'DELIVERY_AGENT' && (
              <Link
                href="/agent"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  pathname.startsWith('/agent')
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Agent Console
              </Link>
            )}

            {user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  pathname.startsWith('/admin')
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Console
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-gray-900">{user.full_name}</div>
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">{user.role}</div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1 text-xs"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-semibold">Logout</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
