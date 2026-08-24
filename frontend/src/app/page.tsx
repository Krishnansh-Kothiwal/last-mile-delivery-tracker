'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

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
    <div className="bg-[#F7F5F2] min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 px-4 sm:px-8 font-sans">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold">
          <span className="material-symbols-outlined text-base fill-1">local_shipping</span>
          <span>LogisticsPro Operations System</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
          Last-Mile Delivery & Fleet Tracker
        </h1>

        <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto font-medium">
          Deterministic pricing, zone-based Haversine dispatching, and immutable tracking events for Bengaluru urban logistics.
        </p>

        <div className="pt-4 flex justify-center gap-4 flex-wrap">
          <Link
            href={getPortalLink()}
            className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-base font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            {user ? (
              <>
                Go to My Console ({user.role})
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </>
            ) : (
              <>
                Sign In to Console
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </>
            )}
          </Link>
          {!user && (
            <Link
              href="/register"
              className="h-12 px-8 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-md text-base font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              Create Customer Account
            </Link>
          )}
        </div>
      </div>

      {/* Role Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        {/* Customer */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col justify-between gap-6 shadow-sm hover:border-blue-600 transition-all">
          <div>
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">request_quote</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Customer Portal</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Calculate instant quotes, inspect price breakdowns, confirm orders, track live audit events, and manage delivery reschedules.
            </p>
          </div>
          <Link
            href={user ? '/customer' : '/login'}
            className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:text-blue-700"
          >
            Access Customer Portal <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>

        {/* Delivery Agent */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col justify-between gap-6 shadow-sm hover:border-blue-600 transition-all">
          <div>
            <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Agent Portal</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Toggle availability status, stream GPS location updates, accept assigned orders, and execute legal status transitions.
            </p>
          </div>
          <Link
            href={user ? '/agent' : '/login'}
            className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:text-blue-700"
          >
            Access Agent Console <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>

        {/* Admin */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col justify-between gap-6 shadow-sm hover:border-blue-600 transition-all">
          <div>
            <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">dashboard</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Admin Console</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Manage Bengaluru postal codes, zones, rate cards, trigger automatic Haversine dispatching, and manual agent assignment.
            </p>
          </div>
          <Link
            href={user ? '/admin' : '/login'}
            className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:text-blue-700"
          >
            Access Admin Console <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
