'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Hide global navbar on pages that render their own custom Stitch header (like Admin console sidebar layout)
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200 flex justify-between items-center w-full px-4 sm:px-8 h-16 z-40 sticky top-0 shadow-sm">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-blue-600 text-3xl fill-1">
            local_shipping
          </span>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            LogisticsPro
          </span>
        </Link>
      </div>

      {user && (
        <nav className="hidden md:flex gap-8 items-center h-full">
          {user.role === 'CUSTOMER' && (
            <>
              <Link
                href="/customer"
                className={`font-semibold h-full flex items-center px-1 transition-colors text-base border-b-2 ${
                  pathname === '/customer'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 border-transparent'
                }`}
              >
                Delivery & Orders
              </Link>
            </>
          )}

          {user.role === 'DELIVERY_AGENT' && (
            <Link
              href="/agent"
              className={`font-semibold h-full flex items-center px-1 transition-colors text-base border-b-2 ${
                pathname.startsWith('/agent')
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 border-transparent'
              }`}
            >
              Agent Delivery Console
            </Link>
          )}
        </nav>
      )}

      <div className="flex items-center gap-6">
        {user ? (
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4 sm:pl-6">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold text-gray-900 leading-tight">
                {user.full_name}
              </span>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-600 hover:bg-gray-50 p-2 rounded-md transition-colors ml-2 flex items-center gap-1.5"
              title="Logout"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
              <span className="hidden md:inline text-sm font-medium">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors h-9 px-4 rounded-md text-sm font-semibold flex items-center gap-1 shadow-sm"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
