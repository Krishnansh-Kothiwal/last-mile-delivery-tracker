'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { UserCheck, MapPin, Truck, CheckCircle2, XCircle, Navigation, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

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

interface AgentProfile {
  id: number;
  user_id: number;
  full_name: string | null;
  email: string | null;
  availability_status: 'AVAILABLE' | 'UNAVAILABLE' | 'INACTIVE';
  active_delivery_count: number;
  max_concurrent_deliveries: number;
  current_zone_id?: number | null;
  last_location_update?: string;
}

export default function AgentPortal() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  // Failure modal state
  const [failingOrderId, setFailingOrderId] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState('Customer unavailable at drop location');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'DELIVERY_AGENT') {
        if (user.role === 'ADMIN') router.replace('/admin');
        else if (user.role === 'CUSTOMER') router.replace('/customer');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'DELIVERY_AGENT') {
      loadAgentData();
    }
  }, [user]);

  const loadAgentData = async () => {
    setLoading(true);
    try {
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

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[#64748B] text-sm font-medium">
        Verifying agent portal state...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-[#16A34A]" /> Delivery Agent Portal
          </h1>
          <p className="text-[#64748B] text-sm mt-1 font-medium">
            Manage your assigned deliveries, report real-time GPS coordinates, and execute legal status transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingLocation}
            disabled={updatingLocation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5" /> {updatingLocation ? 'Pinging GPS...' : 'Ping Current GPS'}
          </button>

          <button
            onClick={loadAgentData}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Alert / Feedback Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border text-xs font-semibold flex items-center justify-between transition shadow-sm ${
            message.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-[#64748B] hover:text-[#0F172A] text-xs px-2 py-0.5">
            ✕
          </button>
        </div>
      )}

      {/* Agent Status Card */}
      <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <span className="text-xs text-[#64748B] font-medium block mb-1">Agent Profile</span>
          <div className="text-base font-bold text-[#0F172A]">{profile?.full_name || user?.full_name}</div>
          <div className="text-xs text-[#475569]">{profile?.email || user?.email}</div>
        </div>

        <div>
          <span className="text-xs text-[#64748B] font-medium block mb-1">Availability Status</span>
          <button
            onClick={handleToggleAvailability}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              profile?.availability_status === 'AVAILABLE'
                ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${profile?.availability_status === 'AVAILABLE' ? 'bg-[#16A34A] animate-pulse' : 'bg-[#DC2626]'}`} />
            {profile?.availability_status ?? 'Loading...'} (Toggle)
          </button>
        </div>

        <div>
          <span className="text-xs text-[#64748B] font-medium block mb-1">Active Capacity</span>
          <div className="text-base font-bold text-[#2563EB] font-mono">
            {assignments.filter(a => a.order_status !== 'DELIVERED' && a.order_status !== 'FAILED').length} / {profile?.max_concurrent_deliveries ?? 5} Max Deliveries
          </div>
        </div>
      </div>

      {/* Assigned Orders List */}
      <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#16A34A]" /> Assigned Delivery Tasks ({assignments.length})
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#64748B]">Loading assigned deliveries...</div>
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            No active deliveries assigned currently. Trigger Auto-Assignment from the Admin Control panel to assign deliveries.
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => (
              <div
                key={a.assignment_id}
                className="bg-white p-5 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] transition space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[#0F172A] text-base">Order #{a.order_id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                        a.order_status === 'DELIVERED'
                          ? 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]'
                          : a.order_status === 'FAILED'
                          ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                          : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                      }`}
                    >
                      {a.order_status}
                    </span>
                  </div>

                  <div className="text-xs text-[#64748B] font-mono font-medium">
                    {a.payment_type} • {a.actual_weight}kg
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <span className="text-[#64748B] font-semibold uppercase text-[10px] block mb-1">Pickup Point</span>
                    <p className="text-[#0F172A] font-medium">{a.pickup_address}</p>
                    <span className="text-[#2563EB] font-mono text-xs">Postal Code: {a.pickup_postal_code}</span>
                  </div>

                  <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <span className="text-[#64748B] font-semibold uppercase text-[10px] block mb-1">Drop Destination</span>
                    <p className="text-[#0F172A] font-medium">{a.drop_address}</p>
                    <span className="text-[#2563EB] font-mono text-xs">Postal Code: {a.drop_postal_code}</span>
                  </div>
                </div>

                {/* State Transition Actions */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  {a.order_status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'pickup')}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      Mark Picked Up <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'PICKED_UP' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'in-transit')}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      Mark In-Transit <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'IN_TRANSIT' && (
                    <button
                      onClick={() => handleStatusChange(a.order_id, 'out-for-delivery')}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      Mark Out for Delivery <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {a.order_status === 'OUT_FOR_DELIVERY' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(a.order_id, 'deliver')}
                        className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Delivered
                      </button>

                      <button
                        onClick={() => setFailingOrderId(a.order_id)}
                        className="px-4 py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" /> Mark Failed
                      </button>
                    </>
                  )}

                  {a.order_status === 'DELIVERED' && (
                    <span className="text-[#15803D] text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Order Successfully Delivered
                    </span>
                  )}

                  {a.order_status === 'FAILED' && (
                    <span className="text-[#B91C1C] text-xs font-bold flex items-center gap-1.5">
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl p-6 border border-[#FECACA] shadow-lg space-y-4">
            <h3 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" /> Record Delivery Failure
            </h3>
            <p className="text-xs text-[#64748B]">
              Provide a mandatory failure reason. Order will transition to FAILED status.
            </p>

            <form onSubmit={handleFailOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#475569] font-medium mb-1">Failure Reason</label>
                <textarea
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-lg p-3 text-[#0F172A] outline-none h-24 focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFailingOrderId(null)}
                  className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg font-semibold transition shadow-sm"
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
