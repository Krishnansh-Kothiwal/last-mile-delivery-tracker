'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { UserCheck, MapPin, Truck, CheckCircle2, XCircle, Navigation, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

// Fix #5: Match the flat shape returned by GET /agent/assignments
interface Assignment {
  assignment_id: number;
  order_id: number;
  attempt_id: number;
  attempt_number: number | null;
  attempt_status: string | null;
  order_status: string;
  pickup_address: string;
  pickup_postal_code: string;
  drop_address: string;
  drop_postal_code: string;
  actual_weight: number | string;
  payment_type: string;
  assigned_at: string;
}

// Fix #7: AgentProfile loaded from GET /agent/profile
interface AgentProfile {
  id: number;
  availability_status: 'AVAILABLE' | 'UNAVAILABLE' | 'INACTIVE';
  active_delivery_count: number;
  max_concurrent_deliveries: number;
  last_location_update?: string;
}

export default function AgentPortal() {
  const { user, quickLogin } = useAuth();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  // Failure modal state
  const [failingOrderId, setFailingOrderId] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState('Customer unavailable at drop location');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'DELIVERY_AGENT') {
      quickLogin('DELIVERY_AGENT');
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'DELIVERY_AGENT') {
      loadAgentData();
    }
  }, [user]);

  const loadAgentData = async () => {
    setLoading(true);
    try {
      // Fix #7: Load profile from dedicated endpoint
      const [pData, aData] = await Promise.all([
        fetchApi<AgentProfile>('/agent/profile'),
        fetchApi<Assignment[]>('/agent/assignments'),
      ]);
      setProfile(pData);
      setAssignments(aData);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fix #6: Backend expects { status: "AVAILABLE" } not { availability_status: "AVAILABLE" }
  const handleToggleAvailability = async () => {
    const newStatus = profile?.availability_status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    setMessage(null);
    try {
      await fetchApi('/agent/availability', {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      setProfile((prev) => prev ? { ...prev, availability_status: newStatus as any } : null);
      setMessage({ type: 'success', text: `Availability set to ${newStatus}` });
      loadAgentData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to update availability: ${e.message}` });
    }
  };

  const handlePingLocation = async () => {
    setUpdatingLocation(true);
    setMessage(null);
    try {
      // Mock GPS Ping around Bengaluru South (12.9100, 77.5950)
      const lat = 12.9100 + (Math.random() - 0.5) * 0.01;
      const lon = 77.5950 + (Math.random() - 0.5) * 0.01;
      await fetchApi('/agent/location', {
        method: 'POST',
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      setMessage({ type: 'success', text: `GPS location updated to (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
      loadAgentData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to ping location: ${e.message}` });
    } finally {
      setUpdatingLocation(false);
    }
  };

  // Fix #5: Use flat order_id field (not a.order.id)
  const handleStatusChange = async (orderId: number, action: 'pickup' | 'in-transit' | 'out-for-delivery' | 'deliver') => {
    setMessage(null);
    try {
      await fetchApi(`/agent/orders/${orderId}/${action}`, { method: 'POST' });
      setMessage({ type: 'success', text: `Order #${orderId} updated to ${action.toUpperCase().replace('-', '_')}` });
      loadAgentData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Status update failed: ${e.message}` });
    }
  };

  const handleFailOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingOrderId) return;
    setMessage(null);
    try {
      await fetchApi(`/agent/orders/${failingOrderId}/fail`, {
        method: 'POST',
        body: JSON.stringify({ failure_reason: failureReason }),
      });
      setMessage({ type: 'success', text: `Order #${failingOrderId} delivery attempt recorded as FAILED` });
      setFailingOrderId(null);
      loadAgentData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to record delivery failure: ${e.message}` });
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-emerald-500" /> Delivery Agent Dashboard
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Manage your assigned deliveries, report real-time GPS coordinates, and execute legal status transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingLocation}
            disabled={updatingLocation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold transition"
          >
            <Navigation className="w-3.5 h-3.5" /> {updatingLocation ? 'Pinging GPS...' : 'Ping Current GPS'}
          </button>

          <button
            onClick={loadAgentData}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
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

      {/* Agent Status Card */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <span className="text-xs text-gray-400 block mb-1">Agent Persona</span>
          <div className="text-base font-bold text-white">{user?.full_name}</div>
          <div className="text-xs text-gray-500">{user?.email}</div>
        </div>

        <div>
          <span className="text-xs text-gray-400 block mb-1">Availability Status</span>
          <button
            onClick={handleToggleAvailability}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              profile?.availability_status === 'AVAILABLE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {profile?.availability_status ?? 'Loading...'} (Click to toggle)
          </button>
        </div>

        <div>
          <span className="text-xs text-gray-400 block mb-1">Active Capacity</span>
          <div className="text-base font-bold text-blue-400 font-mono">
            {/* Fix #5: Count from flat assignment objects */}
            {assignments.filter(a => a.order_status !== 'DELIVERED' && a.order_status !== 'FAILED').length} / {profile?.max_concurrent_deliveries ?? 5} Max Deliveries
          </div>
        </div>
      </div>

      {/* Assigned Orders List */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-400" /> Assigned Delivery Tasks ({assignments.length})
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading assigned deliveries...</div>
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            No active deliveries assigned currently. Trigger Auto-Assignment from the Admin Control panel to assign deliveries.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fix #5: Destructure from flat assignment shape */}
            {assignments.map((a) => (
              <div
                key={a.assignment_id}
                className="glass-card p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-base">Order #{a.order_id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        a.order_status === 'DELIVERED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : a.order_status === 'FAILED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {a.order_status}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-mono">
                    {a.payment_type} • {a.actual_weight}kg
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800/80">
                    <span className="text-gray-500 font-semibold uppercase text-[10px] block mb-1">Pickup Point</span>
                    <p className="text-gray-200 font-medium">{a.pickup_address}</p>
                    <span className="text-blue-400 font-mono text-[11px]">Postal Code: {a.pickup_postal_code}</span>
                  </div>

                  <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800/80">
                    <span className="text-gray-500 font-semibold uppercase text-[10px] block mb-1">Drop Destination</span>
                    <p className="text-gray-200 font-medium">{a.drop_address}</p>
                    <span className="text-blue-400 font-mono text-[11px]">Postal Code: {a.drop_postal_code}</span>
                  </div>
                </div>

                {/* State Transition Actions — use a.order_id and a.order_status */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  {a.order_status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'pickup')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                    >
                      Mark Picked Up <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'PICKED_UP' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'in-transit')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                    >
                      Mark In-Transit <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'IN_TRANSIT' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'out-for-delivery')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    >
                      Mark Out for Delivery <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'OUT_FOR_DELIVERY' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(a.order_id, 'deliver')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Delivered (Terminal)
                      </button>

                      <button
                        onClick={() => setFailingOrderId(a.order_id)}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" /> Mark Failed
                      </button>
                    </>
                  )}

                  {a.order_status === 'DELIVERED' && (
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Order Successfully Delivered
                    </span>
                  )}

                  {a.order_status === 'FAILED' && (
                    <span className="text-red-400 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Delivery Marked as Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failure Reason Modal */}
      {failingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-red-500/30 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Record Delivery Failure
            </h3>
            <p className="text-xs text-gray-400">
              Provide a mandatory failure reason. Order will transition to FAILED → AWAITING_RESCHEDULE and auto-queue for reschedule.
            </p>

            <form onSubmit={handleFailOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Failure Reason</label>
                <textarea
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none h-24"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFailingOrderId(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition shadow-lg shadow-red-600/20"
                >
                  Confirm Failure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
