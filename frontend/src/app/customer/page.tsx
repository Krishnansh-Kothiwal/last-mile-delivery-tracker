'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import {
  Calculator, Package, Clock, Calendar, CheckCircle2, AlertCircle,
  MapPin, RefreshCw, ChevronRight, FileText, Search, Filter,
  ArrowRight, ArrowLeft, History, X
} from 'lucide-react';

interface PricingQuote {
  actual_weight?: number | string;
  volumetric_weight: number | string;
  billable_weight: number | string;
  movement_type: string;
  base_charge: number | string;
  weight_charge: number | string;
  cod_surcharge: number | string;
  total_charge: number | string;
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
  actual_weight: number | string;
  order_type: string;
  payment_type: string;
  current_status: string;
  created_at: string;
  price_snapshot?: {
    total_charge: number | string;
    movement_type: string;
    billable_weight: number | string;
    base_charge?: number | string;
    weight_charge?: number | string;
    cod_surcharge?: number | string;
  };
}

export default function CustomerPortal() {
  const { user, quickLogin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // View Mode: 'dashboard' (Main Dashboard with Rate Calculator + 3 Recent Orders) or 'history' (Full Searchable Archive)
  const [viewMode, setViewMode] = useState<'dashboard' | 'history'>('dashboard');

  // Search & Filter State for Order History Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

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

  // Inline Tracking & History Accordion State
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [trackingMap, setTrackingMap] = useState<{ [orderId: number]: TrackingEvent[] }>({});
  const [loadingTrackingId, setLoadingTrackingId] = useState<number | null>(null);
  const [trackingErrorMap, setTrackingErrorMap] = useState<{ [orderId: number]: string }>({});

  // Reschedule Form
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

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
      const data = await fetchApi<{ orders: Order[]; total: number }>('/orders');
      setOrders(data.orders);
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
      setQuote({
        ...res,
        actual_weight: Number(res.actual_weight ?? 0),
        volumetric_weight: Number(res.volumetric_weight ?? 0),
        billable_weight: Number(res.billable_weight ?? 0),
        base_charge: Number(res.base_charge ?? 0),
        weight_charge: Number(res.weight_charge ?? 0),
        cod_surcharge: Number(res.cod_surcharge ?? 0),
        total_charge: Number(res.total_charge ?? 0),
      });
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

  const toggleOrderHistory = async (order: Order) => {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(order.id);
    setRescheduleDate('');
    setRescheduleReason('');

    if (!trackingMap[order.id]) {
      setLoadingTrackingId(order.id);
      setTrackingErrorMap((prev) => ({ ...prev, [order.id]: '' }));
      try {
        const data = await fetchApi<{ order_id: number; events: TrackingEvent[] }>(`/orders/${order.id}/tracking`);
        setTrackingMap((prev) => ({ ...prev, [order.id]: data.events }));
      } catch (e: any) {
        setTrackingErrorMap((prev) => ({ ...prev, [order.id]: e.message || 'Failed to load tracking data.' }));
      } finally {
        setLoadingTrackingId(null);
      }
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent, orderId: number) => {
    e.preventDefault();

    if (!rescheduleDate) {
      setMessage({ type: 'error', text: 'Please select a preferred reschedule date.' });
      return;
    }

    const selectedDate = new Date(rescheduleDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    if (selectedDate <= now) {
      setMessage({ type: 'error', text: 'Reschedule date must be in the future.' });
      return;
    }
    if (selectedDate > maxDate) {
      setMessage({ type: 'error', text: 'Reschedule date cannot be more than 30 days in the future.' });
      return;
    }

    setRescheduling(true);
    try {
      await fetchApi(`/orders/${orderId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          requested_date: new Date(rescheduleDate).toISOString(),
          reason: rescheduleReason,
        }),
      });
      setMessage({ type: 'success', text: 'Reschedule request submitted successfully!' });

      const data = await fetchApi<{ order_id: number; events: TrackingEvent[] }>(`/orders/${orderId}/tracking`);
      setTrackingMap((prev) => ({ ...prev, [orderId]: data.events }));
      loadOrders();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Reschedule failed: ${e.message}` });
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const confirmed = window.confirm(`Are you sure you want to cancel Order #${orderId}? This action cannot be undone.`);
    if (!confirmed) return;

    setCancellingOrderId(orderId);
    setMessage(null);
    try {
      await fetchApi(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer requested cancellation' }),
      });
      setMessage({ type: 'success', text: `Order #${orderId} cancelled successfully!` });

      if (trackingMap[orderId]) {
        const data = await fetchApi<{ order_id: number; events: TrackingEvent[] }>(`/orders/${orderId}/tracking`);
        setTrackingMap((prev) => ({ ...prev, [orderId]: data.events }));
      }
      loadOrders();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Cancellation failed: ${e.message}` });
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Client-side Filter Logic for Order History Archive
  const filteredOrders = orders.filter((order) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = order.id.toString().includes(q);
      const matchStatus = order.current_status.toLowerCase().includes(q);
      const matchPickupPostal = order.pickup_postal_code.toLowerCase().includes(q);
      const matchDropPostal = order.drop_postal_code.toLowerCase().includes(q);
      const matchPickupAddress = order.pickup_address.toLowerCase().includes(q);
      const matchDropAddress = order.drop_address.toLowerCase().includes(q);
      if (!matchId && !matchStatus && !matchPickupPostal && !matchDropPostal && !matchPickupAddress && !matchDropAddress) {
        return false;
      }
    }

    if (statusFilter !== 'ALL' && order.current_status !== statusFilter) {
      return false;
    }

    if (typeFilter !== 'ALL' && order.order_type !== typeFilter) {
      return false;
    }

    if (paymentFilter !== 'ALL' && order.payment_type !== paymentFilter) {
      return false;
    }

    return true;
  });

  // Recent 3 Orders for Main Dashboard
  const recentOrders = orders.slice(0, 3);
  const isFilterActive = searchQuery.trim() !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || paymentFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPaymentFilter('ALL');
  };

  // Render a Single Order Card with Inline Expandable Accordion History
  const renderOrderCard = (order: Order) => {
    const isExpanded = expandedOrderId === order.id;
    const isLoadingHistory = loadingTrackingId === order.id;
    const historyEvents = trackingMap[order.id] || [];
    const historyError = trackingErrorMap[order.id];
    const isCancelled = order.current_status === 'CANCELLED';
    const buttonLabel = isCancelled
      ? isExpanded ? 'View History ▲' : 'View History ▼'
      : isExpanded ? 'Track & Audit ▲' : 'Track & Audit ▼';

    return (
      <div
        key={order.id}
        className={`glass-card rounded-xl border transition overflow-hidden ${
          isExpanded ? 'border-blue-500/40 bg-gray-900/80' : 'border-gray-800 hover:border-gray-700'
        }`}
      >
        {/* Order Card Summary Header */}
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm">Order #{order.id}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  order.current_status === 'DELIVERED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : order.current_status === 'FAILED' || order.current_status === 'AWAITING_RESCHEDULE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isCancelled
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
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

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {['CREATED', 'CONFIRMED', 'ASSIGNED'].includes(order.current_status) && (
              <button
                onClick={() => handleCancelOrder(order.id)}
                disabled={cancellingOrderId === order.id}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition"
              >
                {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}

            <button
              onClick={() => toggleOrderHistory(order)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                isExpanded
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300'
              }`}
            >
              {buttonLabel}
            </button>
          </div>
        </div>

        {/* Expanded Inline History & Audit Timeline */}
        {isExpanded && (
          <div className="border-t border-gray-800 bg-gray-950/70 p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
              <span className="font-bold text-gray-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {isCancelled ? 'Audit History' : 'Tracking Timeline'} (Order #{order.id})
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Immutable Audit Log</span>
            </div>

            {isLoadingHistory ? (
              <div className="py-6 text-center text-gray-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" /> Loading order audit history...
              </div>
            ) : historyError ? (
              <div className="py-3 px-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                {historyError}
              </div>
            ) : historyEvents.length === 0 ? (
              <div className="py-4 text-center text-gray-500 italic">No tracking events recorded yet.</div>
            ) : (
              <div className="relative border-l border-blue-500/30 ml-3 pl-4 space-y-4 pt-1">
                {historyEvents.map((ev) => (
                  <div key={ev.id} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-gray-950" />
                    <div className="font-bold text-white text-xs">{ev.event_type}</div>
                    <div className="text-[11px] text-gray-400">
                      {ev.previous_status ? `${ev.previous_status} → ` : ''}
                      <span className="text-blue-300 font-semibold">{ev.new_status}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Actor: {ev.actor_role || 'SYSTEM'} • {new Date(ev.created_at).toLocaleString()}
                    </div>
                    {ev.metadata_json && (
                      <pre className="mt-1 text-[10px] font-mono bg-gray-900/90 p-2 rounded border border-gray-800/80 text-gray-300 overflow-x-auto">
                        {ev.metadata_json}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline Reschedule Form if FAILED or AWAITING_RESCHEDULE */}
            {(order.current_status === 'FAILED' || order.current_status === 'AWAITING_RESCHEDULE') && (
              <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Request Delivery Reschedule
                </div>
                <form onSubmit={(e) => handleRescheduleSubmit(e, order.id)} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-400 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                      max={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}
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
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition shadow-md shadow-amber-600/20"
                  >
                    {rescheduling ? 'Submitting...' : 'Submit Reschedule Request'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" /> Customer Delivery Portal
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Calculate deterministic rates, place orders, and manage your delivery archive.
          </p>
        </div>

        {/* View Mode Switcher + Refresh Button */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs font-semibold">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                viewMode === 'history'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Order History ({orders.length})
            </button>
          </div>

          <button
            onClick={loadOrders}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Global Feedback Message */}
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

      {/* VIEW 1: MAIN CUSTOMER DASHBOARD */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Instant Rate Calculator */}
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

              {quote && (
                <div className="p-4 bg-gray-900/80 rounded-xl border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-xs text-gray-400">Total Price Quote</span>
                    <span className="text-xl font-black text-blue-400">₹{Number(quote.total_charge).toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                    <div>Movement: <span className="font-bold text-white">{quote.movement_type}</span></div>
                    <div>Billable Wt: <span className="font-bold text-white">{Number(quote.billable_weight).toFixed(2)} kg</span></div>
                    <div>Volumetric Wt: <span className="font-mono">{Number(quote.volumetric_weight).toFixed(2)} kg</span></div>
                    <div>Base Charge: <span className="font-mono">₹{Number(quote.base_charge).toFixed(2)}</span></div>
                    <div>Weight Charge: <span className="font-mono">₹{Number(quote.weight_charge).toFixed(2)}</span></div>
                    <div>COD Surcharge: <span className="font-mono">₹{Number(quote.cod_surcharge).toFixed(2)}</span></div>
                  </div>

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

          {/* Right Column: Recent Orders (Maximum 3) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Recent Orders
                </h2>
                {orders.length > 0 && (
                  <span className="text-xs text-gray-400 font-mono">
                    Showing {recentOrders.length} of {orders.length}
                  </span>
                )}
              </div>

              {loadingOrders ? (
                <div className="py-12 text-center text-gray-400 text-xs">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No orders yet. Use the Rate Calculator on the left to place your first order.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => renderOrderCard(order))}

                  {/* View All Orders Button */}
                  <button
                    onClick={() => setViewMode('history')}
                    className="w-full mt-2 py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
                  >
                    View All Orders ({orders.length}) <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SEARCHABLE & FILTERABLE ORDER HISTORY ARCHIVE */}
      {viewMode === 'history' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
            {/* Header with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-400" /> Order History Archive
                  </h2>
                  <p className="text-xs text-gray-400">
                    Search and filter all {orders.length} historical delivery orders
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono text-gray-400">
                Found: <span className="font-bold text-blue-400">{filteredOrders.length}</span> / {orders.length} orders
              </div>
            </div>

            {/* Search & Filter Control Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              {/* Search Bar */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-8 py-2 text-white outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="sm:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">Status: All</option>
                  <option value="CREATED">CREATED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="AWAITING_RESCHEDULE">AWAITING_RESCHEDULE</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* Order Type Filter */}
              <div className="sm:col-span-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">Type: All</option>
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                </select>
              </div>

              {/* Payment Type Filter */}
              <div className="sm:col-span-2">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">Payment: All</option>
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">COD</option>
                </select>
              </div>
            </div>

            {/* Active Filter Clear Prompt */}
            {isFilterActive && (
              <div className="flex items-center justify-between text-xs bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg text-blue-300">
                <span>Active filters applied. Showing {filteredOrders.length} matching order(s).</span>
                <button onClick={resetFilters} className="text-xs underline hover:text-white font-bold">
                  Clear Filters
                </button>
              </div>
            )}

            {/* Order History List */}
            {loadingOrders ? (
              <div className="py-12 text-center text-gray-400 text-xs">Loading order archive...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">No orders yet.</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <div className="text-sm font-semibold">No orders match your search and filter criteria.</div>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => renderOrderCard(order))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
