'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Calculator, Package, Clock, Calendar, CheckCircle2, AlertCircle, MapPin, Truck, RefreshCw, ChevronRight, FileText } from 'lucide-react';

interface PricingQuote {
  volumetric_weight: number;
  billable_weight: number;
  movement_type: string;
  base_charge: number;
  weight_charge: number;
  cod_surcharge: number;
  total_charge: number;
  pickup_zone_name: string;
  drop_zone_name: string;
  rate_card_version_name: string;
}

interface TrackingEvent {
  id: number;
  event_type: string;
  previous_status?: string;
  new_status?: string;
  actor_role?: string;
  metadata_json?: string;
  created_at: string;
}

interface Order {
  id: number;
  pickup_address: string;
  pickup_postal_code: string;
  drop_address: string;
  drop_postal_code: string;
  actual_weight: number;
  order_type: string;
  payment_type: string;
  current_status: string;
  created_at: string;
  price_snapshot?: {
    total_charge: number;
    movement_type: string;
    billable_weight: number;
  };
}

export default function CustomerPortal() {
  const { user, quickLogin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Quote Form State
  const [pickupPostal, setPickupPostal] = useState('560078'); // JP Nagar
  const [dropPostal, setDropPostal] = useState('560041'); // Jayanagar
  const [length, setLength] = useState('40');
  const [breadth, setBreadth] = useState('30');
  const [height, setHeight] = useState('20');
  const [weight, setWeight] = useState('5');
  const [orderType, setOrderType] = useState<'B2B' | 'B2C'>('B2C');
  const [paymentType, setPaymentType] = useState<'PREPAID' | 'COD'>('PREPAID');

  const [pickupAddress, setPickupAddress] = useState('123, 2nd Main, JP Nagar 2nd Phase, Bengaluru');
  const [dropAddress, setDropAddress] = useState('45, 4th Cross, Jayanagar 4th Block, Bengaluru');

  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tracking Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Reschedule Form
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') {
      quickLogin('CUSTOMER');
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'CUSTOMER') {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchApi<Order[]>('/orders');
      setOrders(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleCalculateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    setMessage(null);
    try {
      const res = await fetchApi<PricingQuote>('/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          pickup_postal_code: pickupPostal,
          drop_postal_code: dropPostal,
          length: parseFloat(length),
          breadth: parseFloat(breadth),
          height: parseFloat(height),
          actual_weight: parseFloat(weight),
          order_type: orderType,
          payment_type: paymentType,
        }),
      });
      setQuote(res);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!quote) return;
    setPlacingOrder(true);
    setMessage(null);
    try {
      // 1. Create order
      const newOrder = await fetchApi<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          pickup_address: pickupAddress,
          pickup_postal_code: pickupPostal,
          drop_address: dropAddress,
          drop_postal_code: dropPostal,
          length: parseFloat(length),
          breadth: parseFloat(breadth),
          height: parseFloat(height),
          actual_weight: parseFloat(weight),
          order_type: orderType,
          payment_type: paymentType,
        }),
      });

      // 2. Confirm order to freeze price snapshot
      await fetchApi(`/orders/${newOrder.id}/confirm`, { method: 'POST' });

      setMessage({ type: 'success', text: `Order #${newOrder.id} created & price locked successfully!` });
      setQuote(null);
      loadOrders();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setPlacingOrder(false);
    }
  };

  const openTracking = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingTracking(true);
    try {
      const events = await fetchApi<TrackingEvent[]>(`/orders/${order.id}/tracking`);
      setTrackingEvents(events);
    } catch (e: any) {
      alert(`Failed to load tracking: ${e.message}`);
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setRescheduling(true);
    try {
      await fetchApi(`/orders/${selectedOrder.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          requested_date: rescheduleDate ? new Date(rescheduleDate).toISOString() : null,
          reason: rescheduleReason,
        }),
      });
      alert('Reschedule request submitted successfully!');
      openTracking(selectedOrder);
      loadOrders();
    } catch (e: any) {
      alert(`Reschedule failed: ${e.message}`);
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" /> Customer Delivery Portal
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Calculate deterministic delivery rates, place orders, and track real-time delivery timelines.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} /> Refresh Orders
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Quote Calculator & Order Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-6 border border-gray-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400" /> Instant Rate Calculator
            </h2>

            <form onSubmit={handleCalculateQuote} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Pickup Postal Code</label>
                  <input
                    type="text"
                    value={pickupPostal}
                    onChange={(e) => setPickupPostal(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    placeholder="e.g. 560078"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Drop Postal Code</label>
                  <input
                    type="text"
                    value={dropPostal}
                    onChange={(e) => setDropPostal(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    placeholder="e.g. 560041"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Dimensions (L × B × H in cm)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    placeholder="L"
                    required
                  />
                  <input
                    type="number"
                    value={breadth}
                    onChange={(e) => setBreadth(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    placeholder="B"
                    required
                  />
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    placeholder="H"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Order Type</label>
                  <select
                    value={orderType}
                    onChange={(e: any) => setOrderType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="B2C">B2C</option>
                    <option value="B2B">B2B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Payment</label>
                  <select
                    value={paymentType}
                    onChange={(e: any) => setPaymentType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">COD</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={calculating}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-md shadow-blue-600/20"
              >
                {calculating ? 'Calculating Quote...' : 'Calculate Quote'}
              </button>
            </form>

            {/* Quote Result Box */}
            {quote && (
              <div className="p-4 bg-gray-900/80 rounded-xl border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="text-xs text-gray-400">Total Price Quote</span>
                  <span className="text-xl font-black text-blue-400">₹{quote.total_charge.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                  <div>Movement: <span className="font-bold text-white">{quote.movement_type}</span></div>
                  <div>Billable Wt: <span className="font-bold text-white">{quote.billable_weight} kg</span></div>
                  <div>Volumetric Wt: <span className="font-mono">{quote.volumetric_weight} kg</span></div>
                  <div>Base Charge: <span className="font-mono">₹{quote.base_charge}</span></div>
                  <div>Weight Charge: <span className="font-mono">₹{quote.weight_charge}</span></div>
                  <div>COD Surcharge: <span className="font-mono">₹{quote.cod_surcharge}</span></div>
                </div>

                {/* Pickup/Drop Address Inputs */}
                <div className="space-y-2 pt-2 border-t border-gray-800 text-xs">
                  <div>
                    <label className="block text-gray-400 mb-1">Pickup Address</label>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Drop Address</label>
                    <input
                      type="text"
                      value={dropAddress}
                      onChange={(e) => setDropAddress(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>

                  <button
                    onClick={handleCreateOrder}
                    disabled={placingOrder}
                    className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-600/20"
                  >
                    {placingOrder ? 'Confirming & Locking Price...' : 'Confirm Order & Lock Price'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order History & Tracking */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> My Orders ({orders.length})
              </span>
            </h2>

            {loadingOrders ? (
              <div className="py-12 text-center text-gray-400 text-xs">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">No orders placed yet. Use the Rate Calculator on the left to place your first order.</div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="glass-card p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">Order #{order.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            order.current_status === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : order.current_status === 'FAILED' || order.current_status === 'AWAITING_RESCHEDULE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {order.current_status}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" /> {order.pickup_postal_code} → {order.drop_postal_code}
                      </div>

                      <div className="text-[11px] text-gray-500">
                        {order.order_type} • {order.payment_type} • {order.actual_weight}kg • {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => openTracking(order)}
                      className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      Track & Audit <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tracking & Reschedule Timeline Drawer */}
          {selectedOrder && (
            <div className="glass-panel rounded-2xl p-6 border border-blue-500/30 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">Tracking Timeline — Order #{selectedOrder.id}</h3>
                  <p className="text-xs text-gray-400">Append-Only Immutable Event Audit Log</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
                >
                  Close
                </button>
              </div>

              {loadingTracking ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading audit log...</div>
              ) : (
                <div className="relative border-l border-blue-500/30 ml-4 space-y-6">
                  {trackingEvents.map((ev) => (
                    <div key={ev.id} className="relative pl-6">
                      <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-gray-900" />
                      <div className="text-xs font-bold text-white">{ev.event_type}</div>
                      <div className="text-[11px] text-gray-400">
                        {ev.previous_status ? `${ev.previous_status} → ` : ''}<span className="text-blue-300 font-semibold">{ev.new_status}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Actor: {ev.actor_role || 'SYSTEM'} • {new Date(ev.created_at).toLocaleString()}
                      </div>
                      {ev.metadata_json && (
                        <pre className="mt-1 text-[10px] font-mono bg-gray-900/90 p-2 rounded border border-gray-800 text-gray-300 overflow-x-auto">
                          {ev.metadata_json}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reschedule Section if FAILED or AWAITING_RESCHEDULE */}
              {(selectedOrder.current_status === 'FAILED' || selectedOrder.current_status === 'AWAITING_RESCHEDULE') && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Request Delivery Reschedule
                  </div>
                  <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-gray-400 mb-1">Preferred Date</label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Reschedule Reason / Instructions</label>
                      <input
                        type="text"
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                        placeholder="e.g. Please deliver after 3 PM"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={rescheduling}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition"
                    >
                      {rescheduling ? 'Submitting...' : 'Submit Reschedule Request'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
