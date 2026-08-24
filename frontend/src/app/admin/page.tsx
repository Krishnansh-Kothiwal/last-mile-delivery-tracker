'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { ShieldCheck, MapPin, Truck, Scale, RefreshCw, Zap, UserCheck, AlertTriangle, ChevronRight, CheckCircle2, Sliders, Layers } from 'lucide-react';

interface Zone {
  id: number;
  name: string;
  description: string;
}

interface Area {
  id: number;
  name: string;
  postal_code: string;
  zone_id: number;
  latitude: number;
  longitude: number;
}

interface RateCard {
  id: number;
  name: string;
  is_active: boolean;
  effective_from: string;
  rate_rules: Array<{
    id: number;
    order_type: string;
    movement_type: string;
    base_charge: number | string;
    per_kg_charge: number | string;
    min_weight: number | string;
    max_weight: number | string;
  }>;
  cod_rules: Array<{
    id: number;
    order_type: string;
    surcharge: number | string;
  }>;
}

interface Agent {
  id: number;
  user_id: number;
  user?: { full_name: string; email: string };
  availability_status: string;
  current_zone_id: number;
  active_delivery_count: number;
  max_concurrent_deliveries: number;
  last_location_update?: string;
}

interface Order {
  id: number;
  customer_id: number;
  pickup_address: string;
  pickup_postal_code: string;
  drop_address: string;
  drop_postal_code: string;
  actual_weight: number | string;
  order_type: string;
  payment_type: string;
  current_status: string;
  created_at: string;
}

export default function AdminControlCenter() {
  const { user, quickLogin } = useAuth();
  const [activeTab, setActiveTab] = useState<'dispatch' | 'overrides' | 'zones' | 'rates' | 'agents'>('dispatch');

  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);

  // Dispatch reasoning modal
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);

  // Manual assignment state
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Status override state
  const [overrideOrderId, setOverrideOrderId] = useState<number | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('CONFIRMED');
  const [overrideReason, setOverrideReason] = useState<string>('Admin manual correction');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      quickLogin('ADMIN');
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // /admin/orders returns OrderListResponse: { orders: Order[], total: number }
      const [oData, aData, zData, arData, rData] = await Promise.all([
        fetchApi<{ orders: Order[]; total: number }>('/admin/orders'),
        fetchApi<Agent[]>('/admin/agents'),
        fetchApi<Zone[]>('/admin/zones'),
        fetchApi<Area[]>('/admin/areas'),
        fetchApi<RateCard[]>('/admin/rate-card-versions'),
      ]);
      setOrders(oData.orders);
      setAgents(aData);
      setZones(zData);
      setAreas(arData);
      setRateCards(rData);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async (orderId: number) => {
    setMessage(null);
    try {
      const res = await fetchApi(`/admin/orders/${orderId}/auto-assign`, { method: 'POST' });
      setDispatchResult(res);
      setMessage({ type: 'success', text: `Auto-assignment completed for Order #${orderId}` });
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Auto-assignment failed: ${e.message}` });
    }
  };

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningOrderId || !selectedAgentId) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/orders/${assigningOrderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agent_id: parseInt(selectedAgentId) }),
      });
      setMessage({ type: 'success', text: `Order #${assigningOrderId} assigned successfully!` });
      setAssigningOrderId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Assignment failed: ${e.message}` });
    }
  };

  const handleStatusOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrderId) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/orders/${overrideOrderId}/override-status`, {
        method: 'POST',
        body: JSON.stringify({
          new_status: overrideStatus,
          reason: overrideReason,
        }),
      });
      setMessage({ type: 'success', text: `Status overridden to ${overrideStatus} for Order #${overrideOrderId}!` });
      setOverrideOrderId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Override failed: ${e.message}` });
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-500" /> Admin Logistics Control Center
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Dispatch management, rate rules, zone administration, and emergency status overrides.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh All Data
        </button>
      </div>

      {/* Alert / Feedback Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-gray-900/50">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'dispatch' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Zap className="w-4 h-4" /> Dispatch Board
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'overrides' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Status Overrides
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'zones' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <MapPin className="w-4 h-4" /> Zones & Areas ({areas.length})
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'rates' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Scale className="w-4 h-4" /> Rate Cards
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'agents' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Agent Fleet ({agents.length})
        </button>
      </div>

      {/* TAB 1: DISPATCH BOARD */}
      {activeTab === 'dispatch' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" /> Order Dispatch & Auto-Assignment Board
          </h2>

          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-sm">Order #{order.id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        order.current_status === 'CONFIRMED' || order.current_status === 'AWAITING_RESCHEDULE'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {order.current_status}
                    </span>
                  </div>
                  <div className="text-gray-300 font-medium">
                    Pickup: <span className="text-white font-bold">{order.pickup_postal_code}</span> → Drop: <span className="text-white font-bold">{order.drop_postal_code}</span>
                  </div>
                  <div className="text-gray-500 text-[11px]">
                    {order.order_type} • {order.payment_type} • {order.actual_weight}kg
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(order.current_status === 'CONFIRMED' || order.current_status === 'AWAITING_RESCHEDULE') && (
                    <>
                      <button
                        onClick={() => handleAutoAssign(order.id)}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                      >
                        <Zap className="w-3.5 h-3.5" /> Auto-Assign Agent
                      </button>

                      <button
                        onClick={() => setAssigningOrderId(order.id)}
                        className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl text-xs font-semibold transition"
                      >
                        Manual Assign
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OVERRIDES */}
      {activeTab === 'overrides' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4 max-w-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Admin Status Override
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Emergency status override. Appends an immutable <code className="text-purple-300 font-mono">ADMIN_OVERRIDE</code> tracking event recording actor user ID, previous status, new status, and audit reason.
          </p>

          <form onSubmit={handleStatusOverride} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-400 mb-1">Select Order</label>
              <select
                onChange={(e) => setOverrideOrderId(parseInt(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none font-mono"
                required
              >
                <option value="">-- Choose Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.id} ({o.current_status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">New Target Status</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none font-mono"
              >
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="PICKED_UP">PICKED_UP</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="FAILED">FAILED</option>
                <option value="AWAITING_RESCHEDULE">AWAITING_RESCHEDULE</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Mandatory Override Reason</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none h-20"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition shadow-lg shadow-amber-600/20"
            >
              Execute Admin Override & Log Audit
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ZONES & AREAS */}
      {activeTab === 'zones' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white">Bengaluru Zones ({zones.length})</h2>
            <div className="space-y-3">
              {zones.map((z) => (
                <div key={z.id} className="p-3 bg-gray-900/60 rounded-xl border border-gray-800 text-xs space-y-1">
                  <div className="font-bold text-white text-sm">{z.name}</div>
                  <div className="text-gray-400">{z.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white">Postal Code Areas ({areas.length})</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {areas.map((a) => (
                <div key={a.id} className="p-3 bg-gray-900/60 rounded-xl border border-gray-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{a.name}</span>
                    <span className="text-gray-400 font-mono block text-[11px]">Postal: {a.postal_code}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-[10px]">({a.latitude}, {a.longitude})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RATES */}
      {activeTab === 'rates' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
          <h2 className="text-base font-bold text-white">Active Rate Cards & Pricing Rules</h2>
          {rateCards.map((card) => (
            <div key={card.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{card.name}</span>
                {card.is_active && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ACTIVE</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {card.rate_rules?.map((rule) => (
                  <div key={rule.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 text-xs space-y-1">
                    <div className="font-bold text-blue-400">{rule.order_type} • {rule.movement_type}</div>
                    <div className="text-gray-300">Base Charge: ₹{Number(rule.base_charge).toFixed(2)}</div>
                    <div className="text-gray-300">Per KG Rate: ₹{Number(rule.per_kg_charge).toFixed(2)}/kg</div>
                    <div className="text-gray-500 text-[10px]">Weight Band: {Number(rule.min_weight)}kg - {Number(rule.max_weight)}kg</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: AGENTS */}
      {activeTab === 'agents' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
          <h2 className="text-base font-bold text-white">Agent Fleet ({agents.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((ag) => (
              <div key={ag.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{ag.user?.full_name || `Agent #${ag.id}`}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {ag.availability_status}
                  </span>
                </div>
                <div className="text-gray-400">Email: {ag.user?.email}</div>
                <div className="text-blue-400 font-mono">Workload: {ag.active_delivery_count} / {ag.max_concurrent_deliveries} active</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Assignment Result Modal (Reasoning Display) */}
      {dispatchResult && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl p-6 border border-purple-500/40 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" /> Haversine Dispatch Results
            </h3>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs space-y-2">
              <div className="font-bold text-purple-300">
                Selected Agent: {dispatchResult.selected_agent?.agent_name} (ID #{dispatchResult.selected_agent?.agent_id})
              </div>
              <div className="text-gray-300">Distance: {dispatchResult.selected_agent?.distance_km} km</div>
              <div className="text-gray-300">Total Score: {dispatchResult.selected_agent?.total_score}</div>
              <div className="text-gray-400 italic text-[11px]">{dispatchResult.selected_agent?.explanation}</div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-400">All Evaluated Candidates</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {dispatchResult.all_candidates?.map((c: any) => (
                  <div key={c.agent_id} className="p-2.5 bg-gray-900 rounded-lg border border-gray-800">
                    <div className="font-bold text-white">{c.agent_name} (Score: {c.total_score})</div>
                    <div className="text-[10px] text-gray-400">{c.explanation}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setDispatchResult(null)}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs"
            >
              Close Reasoning Breakdown
            </button>
          </div>
        </div>
      )}

      {/* Manual Assign Modal */}
      {assigningOrderId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-gray-700 space-y-4">
            <h3 className="font-bold text-white text-base">Manual Agent Assignment — Order #{assigningOrderId}</h3>

            <form onSubmit={handleManualAssign} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Select Delivery Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none"
                  required
                >
                  <option value="">-- Choose Agent --</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.user?.full_name || `Agent #${ag.id}`} ({ag.active_delivery_count}/{ag.max_concurrent_deliveries} active)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningOrderId(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition shadow-lg shadow-purple-600/20"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
