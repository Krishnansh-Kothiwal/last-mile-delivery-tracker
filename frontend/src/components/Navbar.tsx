'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Truck, Package, ShieldCheck, UserCheck, LogOut, ArrowRightLeft } from 'lucide-react';

export default function Navbar() {
  const { user, logout, quickLogin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleRoleSwitch = async (role: 'CUSTOMER' | 'DELIVERY_AGENT' | 'ADMIN') => {
    try {
      await quickLogin(role);
      if (role === 'CUSTOMER') router.push('/customer');
      if (role === 'DELIVERY_AGENT') router.push('/agent');
      if (role === 'ADMIN') router.push('/admin');
    } catch (e: any) {
      console.error(`Failed to switch role: ${e.message}`);
    }
  };

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
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Quick Persona Switcher */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900/80 px-2.5 py-1.5 rounded-lg border border-gray-800">
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span>Switch:</span>
                <button
                  onClick={() => handleRoleSwitch('CUSTOMER')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    user.role === 'CUSTOMER' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'hover:text-white'
                  }`}
                >
                  Cust
                </button>
                <button
                  onClick={() => handleRoleSwitch('DELIVERY_AGENT')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    user.role === 'DELIVERY_AGENT' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'hover:text-white'
                  }`}
                >
                  Agent
                </button>
                <button
                  onClick={() => handleRoleSwitch('ADMIN')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    user.role === 'ADMIN' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'hover:text-white'
                  }`}
                >
                  Admin
                </button>
              </div>

              {/* User Tag */}
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-200">{user.full_name}</div>
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{user.role}</div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
