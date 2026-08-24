'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Package, UserCheck, ShieldCheck, ArrowRight, Zap, MapPin, Scale, Clock, LogIn } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();

  const getPortalLink = () => {
    if (!user) return '/login';
    if (user.role === 'CUSTOMER') return '/customer';
    if (user.role === 'DELIVERY_AGENT') return '/agent';
    if (user.role === 'ADMIN') return '/admin';
    return '/login';
  };

  return (
    <div className="space-y-12 py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" /> Full-Stack Modular Monolith Logistics Engine
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
          Last-Mile Delivery Tracker
        </h1>
        <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
          Deterministic pricing, zone-based Haversine dispatching, and append-only immutable tracking events for urban logistics.
        </p>

        <div className="pt-2">
          <Link
            href={getPortalLink()}
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition shadow-sm"
          >
            {user ? (
              <>Go to My Portal ({user.role}) <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Sign In to Access Portals <LogIn className="w-4 h-4" /></>
            )}
          </Link>
        </div>
      </div>

      {/* Role Feature Cards matching Stitch light cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Card */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-blue-500 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Portal</h3>
            <p className="text-gray-600 text-xs leading-relaxed mb-6">
              Calculate instant price quotes, freeze immutable rate snapshots, place orders, and track deliveries with live audit logs.
            </p>
          </div>
          <Link
            href={user ? '/customer' : '/login'}
            className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'CUSTOMER' ? 'Go to Customer Portal' : 'Customer Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Agent Card */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-green-500 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center text-green-700 mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delivery Agent Portal</h3>
            <p className="text-gray-600 text-xs leading-relaxed mb-6">
              Toggle availability, stream location coordinates, accept dispatched orders, and update delivery statuses in real-time.
            </p>
          </div>
          <Link
            href={user ? '/agent' : '/login'}
            className="w-full py-2.5 px-4 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'DELIVERY_AGENT' ? 'Go to Agent Console' : 'Agent Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Admin Card */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:border-purple-500 transition-all flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Admin Control Center</h3>
            <p className="text-gray-600 text-xs leading-relaxed mb-6">
              Manage zones, areas & rate cards, trigger automatic Haversine dispatching, and perform audited status overrides.
            </p>
          </div>
          <Link
            href={user ? '/admin' : '/login'}
            className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'ADMIN' ? 'Go to Admin Console' : 'Admin Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
