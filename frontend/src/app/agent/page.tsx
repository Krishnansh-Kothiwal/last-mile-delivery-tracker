'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';

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
      setMessage({ type: 'success', text: `Availability status updated to ${newStatus}` });
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
      setMessage({ type: 'success', text: `GPS ping updated coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
      loadAgentData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to ping GPS location: ${e.message}` });
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleStatusChange = async (orderId: number, action: 'pickup' | 'in-transit' | 'out-for-delivery' | 'deliver') => {
    setMessage(null);
    try {
      await fetchApi(`/agent/orders/${orderId}/${action}`, { method: 'POST' });
      setMessage({ type: 'success', text: `Order #${orderId} updated to ${action.toUpperCase().replace(/-/g, '_')}` });
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
      setMessage({ type: 'error', text: `Failed to record failure: ${e.message}` });
    }
  };

  const agentName = profile?.full_name || user?.full_name || 'Delivery Agent';
  const agentEmail = profile?.email || user?.email || 'agent@logisticspro.com';
  const isAvailable = profile?.availability_status === 'AVAILABLE';
  const activeDeliveries = profile?.active_delivery_count ?? assignments.length;
  const maxDeliveries = profile?.max_concurrent_deliveries ?? 5;
  const workloadPercent = Math.min(100, Math.round((activeDeliveries / maxDeliveries) * 100));

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-gray-500 text-sm font-medium">
        Loading agent console...
      </div>
    );
  }

  return (
    <div className="bg-[#F7F5F2] min-h-screen text-gray-900 font-sans pb-12">
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">

        {/* Global Notification */}
        {message && (
          <div
            className={`p-4 rounded-lg text-sm font-medium border flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">
                {message.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {/* Agent Header Profile Card matching Stitch agent_portal_polished */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col lg:flex-row justify-between gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center border-2 border-gray-200 shadow-sm flex-shrink-0">
              {agentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{agentName}</h1>
              <p className="text-sm font-medium text-gray-600">{agentEmail}</p>
              
              <div className="mt-2 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-600' : 'bg-gray-400'}`}></span>
                <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  {isAvailable ? 'AVAILABLE' : 'OFF DUTY'}
                </span>

                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  className="relative inline-flex items-center cursor-pointer ml-2"
                >
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={handleToggleAvailability}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-left lg:text-right">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                  GPS STATUS
                </div>
                <div className="flex items-center gap-1 text-green-700 text-xs font-medium">
                  <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
                  {profile?.last_location_update
                    ? `Updated ${new Date(profile.last_location_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'GPS Active'}
                </div>
              </div>

              <button
                onClick={handlePingLocation}
                disabled={updatingLocation}
                className="bg-gray-100 text-gray-800 border border-gray-300 px-3.5 py-2 rounded text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">my_location</span>
                {updatingLocation ? 'Pinging GPS...' : 'Ping GPS'}
              </button>

              <button
                onClick={loadAgentData}
                className="bg-white text-gray-700 border border-gray-300 p-2 rounded hover:bg-gray-50 transition-colors"
                title="Refresh assignments"
              >
                <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>

            <div className="w-full lg:w-64">
              <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                <span>Daily Workload</span>
                <span className="font-semibold text-gray-900">{activeDeliveries} / {maxDeliveries} Deliveries</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${workloadPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Deliveries Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">Assigned Deliveries ({assignments.length})</h2>

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
              Loading active assignments...
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500 text-sm shadow-sm">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">task_alt</span>
              <p className="font-semibold text-gray-800">No active deliveries assigned.</p>
              <p className="text-xs text-gray-500 mt-1">Set status to AVAILABLE to receive auto-dispatched orders in your zone.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assignments.map((asgn) => {
                const isPickedUp = asgn.order_status === 'PICKED_UP' || asgn.order_status === 'IN_TRANSIT' || asgn.order_status === 'OUT_FOR_DELIVERY' || asgn.order_status === 'DELIVERED';
                
                return (
                  <div
                    key={asgn.assignment_id}
                    className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden shadow-sm"
                  >
                    <div
                      className={`absolute top-0 left-0 w-1.5 h-full ${
                        asgn.order_status === 'DELIVERED'
                          ? 'bg-green-600'
                          : asgn.order_status === 'PICKED_UP' || asgn.order_status === 'IN_TRANSIT'
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                    ></div>

                    <div className="flex justify-between items-start pl-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ORDER ID</div>
                        <div className="font-mono text-base font-bold text-gray-900">#ORD-{asgn.order_id}</div>
                      </div>
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded uppercase tracking-wide border border-gray-200">
                        {asgn.order_status}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 pl-2 text-sm">
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-gray-500 text-[20px] mt-0.5">store</span>
                        <div>
                          <div className={`text-xs font-semibold ${isPickedUp ? 'text-gray-500' : 'text-blue-600'}`}>
                            PICKUP {isPickedUp && '(Completed)'}
                          </div>
                          <div className={`text-sm ${isPickedUp ? 'line-through text-gray-400' : 'text-gray-900 font-medium'}`}>
                            {asgn.pickup_address} (PIN {asgn.pickup_postal_code})
                          </div>
                        </div>
                      </div>

                      <div className="w-0.5 h-3 bg-gray-200 ml-2.5"></div>

                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-blue-600 text-[20px] mt-0.5">location_on</span>
                        <div>
                          <div className="text-xs font-semibold text-blue-600">DROP-OFF</div>
                          <div className="text-sm font-medium text-gray-900">
                            {asgn.drop_address} (PIN {asgn.drop_postal_code})
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2 flex gap-2 pl-2">
                      {asgn.order_status === 'ASSIGNED' && (
                        <button
                          onClick={() => handleStatusChange(asgn.order_id, 'pickup')}
                          className="flex-1 bg-blue-600 text-white h-[38px] rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                          Mark Picked Up
                        </button>
                      )}

                      {asgn.order_status === 'PICKED_UP' && (
                        <button
                          onClick={() => handleStatusChange(asgn.order_id, 'in-transit')}
                          className="flex-1 bg-blue-600 text-white h-[38px] rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                          Mark In Transit
                        </button>
                      )}

                      {asgn.order_status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => handleStatusChange(asgn.order_id, 'out-for-delivery')}
                          className="flex-1 bg-blue-600 text-white h-[38px] rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">directions_bike</span>
                          Out For Delivery
                        </button>
                      )}

                      {(asgn.order_status === 'IN_TRANSIT' || asgn.order_status === 'OUT_FOR_DELIVERY') && (
                        <button
                          onClick={() => handleStatusChange(asgn.order_id, 'deliver')}
                          className="flex-1 bg-green-600 text-white h-[38px] rounded text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          Mark Delivered
                        </button>
                      )}

                      {asgn.order_status !== 'DELIVERED' && asgn.order_status !== 'FAILED' && (
                        <button
                          onClick={() => setFailingOrderId(asgn.order_id)}
                          className="bg-white border border-red-300 text-red-600 h-[38px] px-3 rounded text-xs font-semibold hover:bg-red-50 transition-colors flex items-center justify-center"
                          title="Report Failure"
                        >
                          <span className="material-symbols-outlined text-[18px]">warning</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Report Delivery Failure Modal */}
        {failingOrderId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-lg max-w-md w-full p-6 shadow-lg flex flex-col gap-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">report_problem</span>
                Report Failure for Order #{failingOrderId}
              </h3>
              <p className="text-xs text-gray-600">
                Reporting a failed delivery attempt will transition order to <strong>FAILED</strong> status and prompt customer reschedule.
              </p>

              <form onSubmit={handleFailOrder} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase">Reason for Failure</label>
                  <select
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="Customer unavailable at drop location">Customer unavailable at drop location</option>
                    <option value="Incorrect address provided">Incorrect address provided</option>
                    <option value="Customer refused package acceptance">Customer refused package acceptance</option>
                    <option value="Unable to access premises / gated security">Unable to access premises / gated security</option>
                    <option value="Vehicle breakdown / emergency">Vehicle breakdown / emergency</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setFailingOrderId(null)}
                    className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                  >
                    Confirm Failure
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
