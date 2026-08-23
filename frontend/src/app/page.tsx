'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Package, UserCheck, ShieldCheck, ArrowRight, Zap, MapPin, Scale, Clock } from 'lucide-react';

export default function LandingPage() {
  const { user, quickLogin } = useAuth();
  const router = useRouter();

  const handleSelectRole = async (role: 'CUSTOMER' | 'DELIVERY_AGENT' | 'ADMIN') => {
    try {
      await quickLogin(role);
      if (role === 'CUSTOMER') router.push('/customer');
      if (role === 'DELIVERY_AGENT') router.push('/agent');
      if (role === 'ADMIN') router.push('/admin');
    } catch (e: any) {
      alert(`Login failed: ${e.message}`);
    }
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
      </div>

      {/* Role Selector Cards */}
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
          <button
            onClick={() => handleSelectRole('CUSTOMER')}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            Enter as Customer (Rahul) <ArrowRight className="w-4 h-4" />
          </button>
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
          <button
            onClick={() => handleSelectRole('DELIVERY_AGENT')}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            Enter as Agent (Deepa) <ArrowRight className="w-4 h-4" />
          </button>
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
          <button
            onClick={() => handleSelectRole('ADMIN')}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
          >
            Enter as Admin <ArrowRight className="w-4 h-4" />
          </button>
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
