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
    <div className="space-y-12 py-6">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" /> Full-Stack Modular Monolith Logistics Engine
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-blue-100 to-gray-400 bg-clip-text text-transparent">
          Last-Mile Delivery Tracker
        </h1>
        <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
          Deterministic pricing, zone-based Haversine dispatching, and append-only immutable tracking events for urban logistics.
        </p>

        <div className="pt-2">
          <Link
            href={getPortalLink()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-blue-600/30"
          >
            {user ? (
              <>Go to My Portal ({user.role}) <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Sign In to Access Portals <LogIn className="w-4 h-4" /></>
            )}
          </Link>
        </div>
      </div>

      {/* Role Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Card */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Customer Portal</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Calculate instant price quotes, freeze immutable rate snapshots, place orders, and track deliveries with live audit logs.
            </p>
          </div>
          <Link
            href={user ? '/customer' : '/login'}
            className="w-full py-2.5 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'CUSTOMER' ? 'Go to Customer Portal' : 'Customer Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Agent Card */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Delivery Agent Portal</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Toggle availability, stream location coordinates, accept dispatched orders, and update delivery statuses in real-time.
            </p>
          </div>
          <Link
            href={user ? '/agent' : '/login'}
            className="w-full py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'DELIVERY_AGENT' ? 'Go to Agent Portal' : 'Agent Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Admin Card */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Admin Control Center</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Manage zones, areas & rate cards, trigger automatic Haversine dispatching, and perform audited status overrides.
            </p>
          </div>
          <Link
            href={user ? '/admin' : '/login'}
            className="w-full py-2.5 px-4 bg-purple-600/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            {user && user.role === 'ADMIN' ? 'Go to Admin Control' : 'Admin Sign In'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        <div className="glass-card p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Scale className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-bold text-white">Deterministic Pricing</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Volumetric vs actual weight, intra/inter zone pricing & frozen price snapshots.</p>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><MapPin className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-bold text-white">Haversine Dispatch</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Auto-assignment algorithm evaluating distance, workload penalties & zone tie-breakers.</p>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Clock className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-bold text-white">Append-Only Audit Log</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Immutable tracking events recording every state transition & admin override.</p>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><Zap className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-bold text-white">Notification Outbox</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Transactional outbox pattern guaranteeing email/SMS notifications on state changes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
