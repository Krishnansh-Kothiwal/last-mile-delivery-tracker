'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // View Mode: 'dashboard' or 'history'
  const [viewMode, setViewMode] = useState<'dashboard' | 'history'>('dashboard');

  // Search & Filter State for Order History Archive
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Quote Form State
  const [pickupPostal, setPickupPostal] = useState('560078');
  const [dropPostal, setDropPostal] = useState('560041');
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

  // Inline Tracking & History Drawer State
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [trackingMap, setTrackingMap] = useState<{ [orderId: number]: TrackingEvent[] }>({});
  const [loadingTrackingId, setLoadingTrackingId] = useState<number | null>(null);
  const [trackingErrorMap, setTrackingErrorMap] = useState<{ [orderId: number]: string }>({});

  // Reschedule Form State
  const [rescheduleOrderId, setRescheduleOrderId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'CUSTOMER') {
        if (user.role === 'ADMIN') router.replace('/admin');
        else if (user.role === 'DELIVERY_AGENT') router.replace('/agent');
      }
    }
  }, [user, authLoading, router]);

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

      setMessage({ type: 'success', text: `Order #${newOrder.id} created & confirmed successfully!` });
      setQuote(null);
      loadOrders();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setPlacingOrder(false);
    }
  };

  const toggleOrderHistory = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);

    if (!trackingMap[orderId]) {
      setLoadingTrackingId(orderId);
      setTrackingErrorMap((prev) => ({ ...prev, [orderId]: '' }));
      try {
        const data = await fetchApi<{ order_id: number; events: TrackingEvent[] }>(`/orders/${orderId}/tracking`);
        setTrackingMap((prev) => ({ ...prev, [orderId]: data.events }));
      } catch (e: any) {
        setTrackingErrorMap((prev) => ({ ...prev, [orderId]: e.message || 'Failed to load tracking data.' }));
      } finally {
        setLoadingTrackingId(null);
      }
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent, orderId: number) => {
    e.preventDefault();
    if (!rescheduleDate) {
      setMessage({ type: 'error', text: 'Please select a valid date for reschedule.' });
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
      setMessage({ type: 'success', text: `Order #${orderId} reschedule requested successfully!` });

      const data = await fetchApi<{ order_id: number; events: TrackingEvent[] }>(`/orders/${orderId}/tracking`);
      setTrackingMap((prev) => ({ ...prev, [orderId]: data.events }));
      setRescheduleOrderId(null);
      loadOrders();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Reschedule failed: ${e.message}` });
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const confirmed = window.confirm(`Are you sure you want to cancel Order #${orderId}?`);
    if (!confirmed) return;

    setCancellingOrderId(orderId);
    setMessage(null);
    try {
      await fetchApi(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer requested cancellation via portal' }),
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

  const filteredOrders = orders.filter((order) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = order.id.toString().includes(q);
      const matchPickup = order.pickup_postal_code.includes(q) || order.pickup_address.toLowerCase().includes(q);
      const matchDrop = order.drop_postal_code.includes(q) || order.drop_address.toLowerCase().includes(q);
      if (!matchId && !matchPickup && !matchDrop) return false;
    }
    if (statusFilter !== 'ALL' && order.current_status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && order.order_type !== typeFilter) return false;
    if (paymentFilter !== 'ALL' && order.payment_type !== paymentFilter) return false;
    return true;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-gray-500 text-sm font-medium">
        Loading portal data...
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-gray-900 font-sans">
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">

        {/* Global Notification Banner */}
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

        {/* View Mode Toggle Switcher */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Create Order / Rate Quote
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                viewMode === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Order History ({orders.length})
            </button>
          </div>
        </div>

        {/* DASHBOARD VIEW: Quote Calculator & Inspector Side Card */}
        {viewMode === 'dashboard' && (
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Left Column: Delivery Quote Form */}
            <div className="flex-1 flex flex-col gap-8 w-full max-w-5xl">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-sm">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 tracking-tight">
                  Delivery Quote / Create Order
                </h1>

                <form onSubmit={handleCalculateQuote} className="flex flex-col gap-8">
                  {/* Location Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Pickup */}
                    <div className="flex flex-col gap-5">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <span className="material-symbols-outlined text-blue-600 text-xl">my_location</span>
                        Pickup Details
                      </h2>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Pickup PIN (Bengaluru)
                        </label>
                        <input
                          type="text"
                          value={pickupPostal}
                          onChange={(e) => setPickupPostal(e.target.value)}
                          placeholder="e.g. 560078"
                          required
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Full Pickup Address
                        </label>
                        <textarea
                          rows={3}
                          value={pickupAddress}
                          onChange={(e) => setPickupAddress(e.target.value)}
                          placeholder="Building, Street, Area..."
                          required
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow resize-none"
                        />
                      </div>
                    </div>

                    {/* Drop */}
                    <div className="flex flex-col gap-5">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <span className="material-symbols-outlined text-gray-600 text-xl">location_on</span>
                        Drop Details
                      </h2>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Drop PIN (Bengaluru)
                        </label>
                        <input
                          type="text"
                          value={dropPostal}
                          onChange={(e) => setDropPostal(e.target.value)}
                          placeholder="e.g. 560041"
                          required
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Full Drop Address
                        </label>
                        <textarea
                          rows={3}
                          value={dropAddress}
                          onChange={(e) => setDropAddress(e.target.value)}
                          placeholder="Building, Street, Area..."
                          required
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-shadow resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Package & Order Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                    {/* Package */}
                    <div className="flex flex-col gap-5">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <span className="material-symbols-outlined text-gray-500 text-xl">box</span>
                        Package Dimensions & Weight
                      </h2>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">L (cm)</label>
                          <input
                            type="number"
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            placeholder="0"
                            required
                            className="border border-gray-300 rounded-md bg-white px-3 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">B (cm)</label>
                          <input
                            type="number"
                            value={breadth}
                            onChange={(e) => setBreadth(e.target.value)}
                            placeholder="0"
                            required
                            className="border border-gray-300 rounded-md bg-white px-3 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">H (cm)</label>
                          <input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="0"
                            required
                            className="border border-gray-300 rounded-md bg-white px-3 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Actual Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="0.0"
                          required
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Order Type */}
                    <div className="flex flex-col gap-5">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <span className="material-symbols-outlined text-gray-500 text-xl">receipt_long</span>
                        Order & Payment Configuration
                      </h2>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Customer Type
                        </label>
                        <select
                          value={orderType}
                          onChange={(e) => setOrderType(e.target.value as 'B2B' | 'B2C')}
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        >
                          <option value="B2C">B2C (Consumer)</option>
                          <option value="B2B">B2B (Business)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Payment Mode
                        </label>
                        <select
                          value={paymentType}
                          onChange={(e) => setPaymentType(e.target.value as 'PREPAID' | 'COD')}
                          className="border border-gray-300 rounded-md bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        >
                          <option value="PREPAID">Prepaid</option>
                          <option value="COD">COD (Cash on Delivery)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 border-t border-gray-200 pt-6">
                    <button
                      type="submit"
                      disabled={calculating}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors h-12 px-8 rounded-md text-base font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg">calculate</span>
                      {calculating ? 'Calculating Quote...' : 'Calculate Quote'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Recent Orders Overview Cards */}
              <div className="mt-2">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Recent Orders</h2>
                  <button
                    onClick={() => setViewMode('history')}
                    className="text-blue-600 text-sm font-semibold uppercase tracking-wide hover:text-blue-700 flex items-center gap-1 transition-colors"
                  >
                    View All Orders <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>

                {loadingOrders ? (
                  <div className="p-8 text-center text-gray-500 text-sm">Loading recent orders...</div>
                ) : orders.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500 text-sm">
                    No orders placed yet. Calculate a quote above and confirm to create your first order!
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {orders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-gray-300 transition-colors shadow-sm"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold text-gray-900">#ORD-{order.id}</span>
                            <span
                              className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border ${getStatusBadgeClass(
                                order.current_status
                              )}`}
                            >
                              {order.current_status}
                            </span>
                          </div>
                          <div className="text-sm sm:text-base text-gray-600 flex items-center gap-2 font-medium flex-wrap">
                            <span>PIN {order.pickup_postal_code}</span>
                            <span className="material-symbols-outlined text-gray-400 text-sm">arrow_forward</span>
                            <span>PIN {order.drop_postal_code}</span>
                            <span className="mx-1 text-gray-300">|</span>
                            <span>{order.order_type} - {order.payment_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                          <div className="text-xl font-bold text-gray-900">
                            ₹{order.price_snapshot?.total_charge ? Number(order.price_snapshot.total_charge).toFixed(2) : '0.00'}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleOrderHistory(order.id)}
                              className="text-blue-600 border border-blue-600 hover:bg-blue-50 rounded-md px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
                            >
                              Track & Audit
                            </button>
                            {(order.current_status === 'CREATED' || order.current_status === 'CONFIRMED' || order.current_status === 'ASSIGNED') && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={cancellingOrderId === order.id}
                                className="text-red-600 border border-red-600 hover:bg-red-50 rounded-md px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sticky Quote Summary Inspector Card */}
            <aside className="w-full xl:w-[380px] flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 sticky top-24 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-4 mb-6 flex items-center gap-2 tracking-tight">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">request_quote</span>
                  Quote Summary
                </h3>

                {quote ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex justify-between items-center text-sm sm:text-base text-gray-600">
                      <span>Route Zones</span>
                      <span className="font-semibold text-gray-900">
                        {quote.pickup_zone_name} → {quote.drop_zone_name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm sm:text-base text-gray-600 border-b border-gray-100 pb-4">
                      <span>Billable Weight</span>
                      <span className="font-semibold text-gray-900 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                        {quote.billable_weight} kg ({quote.movement_type})
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm sm:text-base text-gray-600">
                      <span>Base Charge</span>
                      <span className="font-mono text-gray-900 font-medium">₹{Number(quote.base_charge).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm sm:text-base text-gray-600">
                      <span>Weight Surcharge</span>
                      <span className="font-mono text-gray-900 font-medium">₹{Number(quote.weight_charge).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm sm:text-base text-gray-600">
                      <span>COD Surcharge</span>
                      <span className="font-mono text-gray-900 font-medium">₹{Number(quote.cod_surcharge).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-6 mt-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide pb-1">
                          Total Charge
                        </span>
                        <span className="text-3xl font-bold text-gray-900 tracking-tight">
                          ₹{Number(quote.total_charge).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateOrder}
                      disabled={placingOrder}
                      className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors h-14 mt-6 rounded-md flex items-center justify-center gap-2 text-lg font-semibold shadow-sm disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                      {placingOrder ? 'Confirming Order...' : 'Confirm Order'}
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-2">
                      Rate card active: <span className="font-medium text-gray-700">{quote.rate_card_version_name}</span>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 gap-3">
                    <span className="material-symbols-outlined text-4xl text-gray-300">calculate</span>
                    <p className="text-sm font-medium">
                      Fill in the pickup, drop, and package details and click <strong>Calculate Quote</strong> to inspect charges.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* FULL ORDER HISTORY ARCHIVE VIEW */}
        {viewMode === 'history' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">Order History</h1>
                <p className="text-sm text-gray-600">Review past shipments, track status transitions, and audit logs.</p>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-4 items-center shadow-sm">
              <div className="relative flex-1 min-w-[240px] flex items-center">
                <span className="material-symbols-outlined absolute right-3 text-gray-500 text-lg">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID, PIN, or Address..."
                  className="w-full pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder-gray-400"
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-2 pl-3 pr-8 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CREATED">CREATED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="py-2 pl-3 pr-8 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Order Types</option>
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="py-2 pl-3 pr-8 bg-white border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Payments</option>
                  <option value="PREPAID">PREPAID</option>
                  <option value="COD">COD</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col shadow-sm">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide items-center">
                <div className="col-span-2">Order ID & Date</div>
                <div className="col-span-4">Route & Postal Codes</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Type / Payment</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <div className="flex-1 divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 text-sm">
                    No orders match your filter criteria.
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order.id} className="flex flex-col">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center text-sm hover:bg-gray-50 transition-colors">
                        <div className="md:col-span-2 flex flex-col gap-0.5">
                          <span className="font-mono text-gray-900 font-bold">#ORD-{order.id}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="md:col-span-4 flex flex-col gap-1">
                          <div className="text-gray-900 font-medium flex items-center gap-2">
                            <span>PIN {order.pickup_postal_code}</span>
                            <span className="material-symbols-outlined text-gray-400 text-sm">arrow_forward</span>
                            <span>PIN {order.drop_postal_code}</span>
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {order.pickup_address} → {order.drop_address}
                          </div>
                        </div>

                        <div className="md:col-span-2 flex items-center">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getStatusBadgeClass(
                              order.current_status
                            )}`}
                          >
                            {order.current_status}
                          </span>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-0.5">
                          <span className="text-gray-900 font-medium">{order.order_type}</span>
                          <span className="text-xs text-gray-500">{order.payment_type}</span>
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-2">
                          <button
                            onClick={() => toggleOrderHistory(order.id)}
                            className="h-[32px] px-3 bg-white text-blue-600 border border-blue-600 rounded-md text-xs font-semibold uppercase tracking-wide hover:bg-blue-50 flex items-center gap-1 transition-colors"
                          >
                            {expandedOrderId === order.id ? 'Close Audit' : 'Audit Timeline'}
                            <span className="material-symbols-outlined text-[16px]">
                              {expandedOrderId === order.id ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>

                          {(order.current_status === 'CREATED' || order.current_status === 'CONFIRMED' || order.current_status === 'ASSIGNED') && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancellingOrderId === order.id}
                              className="h-[32px] px-3 bg-white text-red-600 border border-red-600 rounded-md text-xs font-semibold uppercase tracking-wide hover:bg-red-50 flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}

                          {order.current_status === 'FAILED' && (
                            <button
                              onClick={() => setRescheduleOrderId(rescheduleOrderId === order.id ? null : order.id)}
                              className="h-[32px] px-3 bg-amber-500 text-white rounded-md text-xs font-semibold uppercase tracking-wide hover:bg-amber-600 flex items-center gap-1 transition-colors"
                            >
                              Reschedule
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Reschedule Form */}
                      {rescheduleOrderId === order.id && (
                        <div className="bg-amber-50/50 border-t border-b border-amber-200 p-4 px-6 flex flex-col gap-3">
                          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-amber-600 text-lg">calendar_month</span>
                            Request Delivery Reschedule (Max 30 days ahead)
                          </h4>
                          <form onSubmit={(e) => handleRescheduleSubmit(e, order.id)} className="flex flex-wrap gap-4 items-end">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-600 uppercase">Preferred Date</label>
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                required
                                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                              <label className="text-xs font-semibold text-gray-600 uppercase">Reason (Optional)</label>
                              <input
                                type="text"
                                value={rescheduleReason}
                                onChange={(e) => setRescheduleReason(e.target.value)}
                                placeholder="e.g. Out of town on delivery day"
                                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={rescheduling}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-1.5 rounded text-sm transition-colors"
                            >
                              {rescheduling ? 'Submitting...' : 'Confirm Reschedule'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Expandable Audit Timeline */}
                      {expandedOrderId === order.id && (
                        <div className="border-t border-gray-200 bg-gray-50 p-6 pl-10 sm:pl-14">
                          <h4 className="text-base font-bold mb-4 text-gray-900 tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600 text-xl">history</span>
                            Audit History & Tracking Events
                          </h4>

                          {loadingTrackingId === order.id ? (
                            <div className="text-sm text-gray-500">Loading audit history...</div>
                          ) : trackingErrorMap[order.id] ? (
                            <div className="text-sm text-red-600">{trackingErrorMap[order.id]}</div>
                          ) : !trackingMap[order.id] || trackingMap[order.id].length === 0 ? (
                            <div className="text-sm text-gray-500">No audit events recorded yet.</div>
                          ) : (
                            <div className="relative border-l-2 border-gray-300 ml-3 space-y-6 pb-2">
                              {trackingMap[order.id].map((evt) => (
                                <div key={evt.id} className="relative pl-6">
                                  <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white"></span>
                                  <div className="flex items-start justify-between flex-wrap gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {evt.event_type.replace(/_/g, ' ')}
                                      </div>
                                      {evt.previous_status && evt.new_status && (
                                        <div className="text-xs text-gray-600 mt-0.5">
                                          Status transition: <span className="font-semibold">{evt.previous_status}</span> → <span className="font-semibold text-blue-600">{evt.new_status}</span>
                                        </div>
                                      )}
                                      {evt.metadata_json && (
                                        <div className="text-xs font-mono text-gray-500 bg-gray-100 p-1.5 rounded mt-1 max-w-md overflow-x-auto">
                                          {evt.metadata_json}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right text-xs text-gray-500">
                                      <div>{new Date(evt.created_at).toLocaleString()}</div>
                                      <div className="font-semibold text-gray-700 uppercase mt-0.5">
                                        Actor: {evt.actor_role || 'SYSTEM'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
