'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';

interface Zone {
  id: number;
  name: string;
  description?: string;
}

interface Area {
  id: number;
  name: string;
  postal_code: string;
  zone_id: number;
  latitude?: number;
  longitude?: number;
}

interface RateRule {
  id: number;
  rate_card_version_id: number;
  order_type: string;
  movement_type: string;
  min_weight: number | string;
  max_weight: number | string;
  base_charge: number | string;
  per_kg_charge: number | string;
}

interface CodRule {
  id: number;
  rate_card_version_id: number;
  order_type: string;
  surcharge: number | string;
}

interface RateCard {
  id: number;
  name: string;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  rate_rules: RateRule[];
}

interface ActiveAssignment {
  assignment_id: number;
  order_id: number;
  order_status: string;
  pickup_address: string;
  pickup_postal_code: string;
  drop_address: string;
  drop_postal_code: string;
  order_type: string;
  payment_type: string;
  assigned_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
}

interface Agent {
  id: number;
  user_id: number;
  full_name: string | null;
  email: string | null;
  availability_status: string;
  current_zone_id: number;
  active_delivery_count: number;
  max_concurrent_deliveries: number;
  last_location_update?: string;
  is_location_fresh?: boolean;
  location_status?: string;
  dispatch_readiness?: string;
  active_assignments: ActiveAssignment[];
}

interface CustomerUser {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
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
  assigned_agent?: {
    agent_id: number;
    full_name: string | null;
    email: string | null;
  } | null;
  price_snapshot?: {
    total_charge: number | string;
    base_charge: number | string;
    weight_charge: number | string;
    cod_surcharge: number | string;
    movement_type: string;
  };
}

interface PricingQuote {
  actual_weight: number;
  volumetric_weight: number;
  billable_weight: number;
  pickup_area_name: string;
  pickup_zone_name: string;
  drop_area_name: string;
  drop_zone_name: string;
  movement_type: string;
  base_charge: number;
  weight_charge: number;
  cod_surcharge: number;
  total_charge: number;
}

export default function AdminControlCenter() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dispatch' | 'create_order' | 'fleet' | 'areas' | 'zones' | 'rate_cards'>('dispatch');

  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [codRules, setCodRules] = useState<CodRule[]>([]);
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Dispatch Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderZoneFilter, setOrderZoneFilter] = useState('');

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

  // Agent Fleet expanded card
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null);

  // Area / Postal Code Management State
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaPostal, setNewAreaPostal] = useState('');
  const [newAreaZoneId, setNewAreaZoneId] = useState<number>(1);
  const [newAreaLat, setNewAreaLat] = useState('12.9716');
  const [newAreaLon, setNewAreaLon] = useState('77.5946');

  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editAreaPostal, setEditAreaPostal] = useState('');
  const [editAreaZoneId, setEditAreaZoneId] = useState<number>(1);
  const [areaSearch, setAreaSearch] = useState('');
  const [submittingArea, setSubmittingArea] = useState(false);

  // Zone Management State
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDesc, setNewZoneDesc] = useState('');
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneDesc, setEditZoneDesc] = useState('');

  // Rate Rule & COD Editing State
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRuleBase, setEditRuleBase] = useState('');
  const [editRulePerKg, setEditRulePerKg] = useState('');

  const [editingCodId, setEditingCodId] = useState<number | null>(null);
  const [editCodSurcharge, setEditCodSurcharge] = useState('');

  // Admin Create Order State
  const [adminCustomerId, setAdminCustomerId] = useState<number | string>('');
  const [adminPickupAddr, setAdminPickupAddr] = useState('123 Mg Road');
  const [adminPickupPostal, setAdminPickupPostal] = useState('560001');
  const [adminDropAddr, setAdminDropAddr] = useState('456 Jayanagar');
  const [adminDropPostal, setAdminDropPostal] = useState('560041');
  const [adminLength, setAdminLength] = useState('20');
  const [adminBreadth, setAdminBreadth] = useState('15');
  const [adminHeight, setAdminHeight] = useState('10');
  const [adminWeight, setAdminWeight] = useState('2.5');
  const [adminOrderType, setAdminOrderType] = useState('B2C');
  const [adminPaymentType, setAdminPaymentType] = useState('PREPAID');

  const [adminQuote, setAdminQuote] = useState<PricingQuote | null>(null);
  const [calculatingAdminQuote, setCalculatingAdminQuote] = useState(false);
  const [submittingAdminOrder, setSubmittingAdminOrder] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'ADMIN') {
        if (user.role === 'CUSTOMER') router.replace('/customer');
        else if (user.role === 'DELIVERY_AGENT') router.replace('/agent');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oData, aData, zData, arData, rData, codData, cData] = await Promise.all([
        fetchApi<{ orders: Order[]; total: number }>('/admin/orders'),
        fetchApi<Agent[]>('/admin/agents'),
        fetchApi<Zone[]>('/admin/zones'),
        fetchApi<Area[]>('/admin/areas'),
        fetchApi<RateCard[]>('/pricing/rate-cards'),
        fetchApi<CodRule[]>('/admin/cod-rules'),
        fetchApi<CustomerUser[]>('/admin/customers'),
      ]);
      setOrders(oData.orders);
      setAgents(aData);
      setZones(zData);
      setAreas(arData);
      setRateCards(rData);
      setCodRules(codData);
      setCustomers(cData);
      if (cData.length > 0 && !adminCustomerId) {
        setAdminCustomerId(cData[0].id);
      }
      if (zData.length > 0 && !newAreaZoneId) {
        setNewAreaZoneId(zData[0].id);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAutoDispatch = async (orderId: number) => {
    setMessage(null);
    try {
      const result = await fetchApi<any>(`/admin/orders/${orderId}/auto-assign`, { method: 'POST' });
      setDispatchResult(result);
      setMessage({ type: 'success', text: `Auto-dispatch completed for Order #${orderId}` });
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Auto-dispatch failed: ${e.message}` });
    }
  };

  const handleManualAssignSubmit = async (orderId: number) => {
    if (!selectedAgentId) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/orders/${orderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          agent_id: parseInt(selectedAgentId),
        }),
      });
      setMessage({ type: 'success', text: `Order #${orderId} manually assigned!` });
      setAssigningOrderId(null);
      setSelectedAgentId('');
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Manual assignment failed: ${e.message}` });
    }
  };

  const handleOverrideStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrderId || !overrideReason.trim()) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/orders/${overrideOrderId}/override-status`, {
        method: 'POST',
        body: JSON.stringify({
          new_status: overrideStatus,
          reason: overrideReason.trim(),
        }),
      });
      setMessage({ type: 'success', text: `Order #${overrideOrderId} status updated to ${overrideStatus}` });
      setOverrideOrderId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Status override failed: ${e.message}` });
    }
  };

  const handleCalculateAdminQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculatingAdminQuote(true);
    setMessage(null);
    try {
      const res = await fetchApi<PricingQuote>('/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          pickup_postal_code: adminPickupPostal,
          drop_postal_code: adminDropPostal,
          length: parseFloat(adminLength),
          breadth: parseFloat(adminBreadth),
          height: parseFloat(adminHeight),
          actual_weight: parseFloat(adminWeight),
          order_type: adminOrderType,
          payment_type: adminPaymentType,
        }),
      });
      setAdminQuote(res);
    } catch (e: any) {
      setMessage({ type: 'error', text: `Quote calculation failed: ${e.message}` });
    } finally {
      setCalculatingAdminQuote(false);
    }
  };

  const handleAdminCreateOrderSubmit = async () => {
    if (!adminCustomerId) {
      setMessage({ type: 'error', text: 'Please select a registered customer.' });
      return;
    }
    setSubmittingAdminOrder(true);
    setMessage(null);
    try {
      const newOrder = await fetchApi<Order>('/admin/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: parseInt(adminCustomerId.toString()),
          pickup_address: adminPickupAddr,
          pickup_postal_code: adminPickupPostal,
          drop_address: adminDropAddr,
          drop_postal_code: adminDropPostal,
          length: parseFloat(adminLength),
          breadth: parseFloat(adminBreadth),
          height: parseFloat(adminHeight),
          actual_weight: parseFloat(adminWeight),
          order_type: adminOrderType,
          payment_type: adminPaymentType,
        }),
      });
      setMessage({ type: 'success', text: `Order #${newOrder.id} created & confirmed in CONFIRMED status!` });
      setAdminQuote(null);
      setActiveTab('dispatch');
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Admin order creation failed: ${e.message}` });
    } finally {
      setSubmittingAdminOrder(false);
    }
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim() || !newAreaPostal.trim()) return;
    setSubmittingArea(true);
    setMessage(null);
    try {
      await fetchApi('/admin/areas', {
        method: 'POST',
        body: JSON.stringify({
          name: newAreaName.trim(),
          postal_code: newAreaPostal.trim(),
          zone_id: newAreaZoneId,
          latitude: parseFloat(newAreaLat),
          longitude: parseFloat(newAreaLon),
        }),
      });
      setMessage({ type: 'success', text: `Area '${newAreaName}' (PIN ${newAreaPostal}) created!` });
      setNewAreaName('');
      setNewAreaPostal('');
      setShowAddAreaModal(false);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to create area: ${e.message}` });
    } finally {
      setSubmittingArea(false);
    }
  };

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAreaId || !editAreaName.trim() || !editAreaPostal.trim()) return;
    setSubmittingArea(true);
    setMessage(null);
    try {
      await fetchApi(`/admin/areas/${editingAreaId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editAreaName.trim(),
          postal_code: editAreaPostal.trim(),
          zone_id: editAreaZoneId,
        }),
      });
      setMessage({ type: 'success', text: `Area #${editingAreaId} updated!` });
      setEditingAreaId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to update area: ${e.message}` });
    } finally {
      setSubmittingArea(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    setMessage(null);
    try {
      await fetchApi('/admin/zones', {
        method: 'POST',
        body: JSON.stringify({
          name: newZoneName.trim(),
          description: newZoneDesc.trim() || undefined,
        }),
      });
      setMessage({ type: 'success', text: `Zone '${newZoneName}' created!` });
      setNewZoneName('');
      setNewZoneDesc('');
      setShowAddZoneModal(false);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to create zone: ${e.message}` });
    }
  };

  const handleUpdateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneId || !editZoneName.trim()) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/zones/${editingZoneId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editZoneName.trim(),
          description: editZoneDesc.trim() || undefined,
        }),
      });
      setMessage({ type: 'success', text: `Zone #${editingZoneId} updated!` });
      setEditingZoneId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to update zone: ${e.message}` });
    }
  };

  const handleDeleteZone = async (zoneId: number, zoneName: string) => {
    const confirmDel = window.confirm(`Delete Zone '${zoneName}'? Zone must have no assigned areas.`);
    if (!confirmDel) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/zones/${zoneId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `Zone '${zoneName}' deleted!` });
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Delete failed: ${e.message}` });
    }
  };

  const handleUpdateRateRule = async (rule: RateRule) => {
    if (!editRuleBase || !editRulePerKg) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/rate-rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          rate_card_version_id: rule.rate_card_version_id,
          order_type: rule.order_type,
          movement_type: rule.movement_type,
          min_weight: parseFloat(rule.min_weight.toString()),
          max_weight: parseFloat(rule.max_weight.toString()),
          base_charge: parseFloat(editRuleBase),
          per_kg_charge: parseFloat(editRulePerKg),
        }),
      });
      setMessage({ type: 'success', text: `Rate rule #${rule.id} updated!` });
      setEditingRuleId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to update rate rule: ${e.message}` });
    }
  };

  const handleUpdateCodRule = async (rule: CodRule) => {
    if (!editCodSurcharge) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/cod-rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          rate_card_version_id: rule.rate_card_version_id,
          order_type: rule.order_type,
          surcharge: parseFloat(editCodSurcharge),
        }),
      });
      setMessage({ type: 'success', text: `COD rule #${rule.id} updated!` });
      setEditingCodId(null);
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to update COD rule: ${e.message}` });
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      const matchId = o.id.toString().includes(q);
      const matchPickup = o.pickup_postal_code.includes(q) || o.pickup_address.toLowerCase().includes(q);
      const matchDrop = o.drop_postal_code.includes(q) || o.drop_address.toLowerCase().includes(q);
      if (!matchId && !matchPickup && !matchDrop) return false;
    }
    if (orderStatusFilter && o.current_status !== orderStatusFilter) return false;
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
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm font-medium bg-[#F7F5F2]">
        Loading Admin Operations Console...
      </div>
    );
  }

  return (
    <div className="bg-[#F7F5F2] text-gray-900 font-sans h-screen overflow-hidden flex">
      {/* SideNavBar matching Stitch Admin Console */}
      <nav className="hidden md:flex bg-white border-r border-gray-200 fixed left-0 top-0 h-full flex-col py-6 px-4 gap-2 z-50 w-64">
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            LP
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-tight">Admin Console</h1>
            <p className="text-xs font-medium text-gray-500">Fleet Operations</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('create_order')}
          className="w-full bg-blue-600 text-white font-semibold text-sm py-2.5 px-4 rounded-md flex items-center justify-center gap-2 mb-4 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          New Order
        </button>

        <ul className="flex flex-col gap-1 w-full">
          <li
            onClick={() => setActiveTab('dispatch')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'dispatch' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span>Dispatch Board</span>
          </li>
          <li
            onClick={() => setActiveTab('create_order')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'create_order' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">add_box</span>
            <span>Create Order</span>
          </li>
          <li
            onClick={() => setActiveTab('fleet')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'fleet' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">local_shipping</span>
            <span>Agent Fleet</span>
          </li>
          <li
            onClick={() => setActiveTab('areas')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'areas' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">map</span>
            <span>Areas & PINs</span>
          </li>
          <li
            onClick={() => setActiveTab('zones')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'zones' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">layers</span>
            <span>Zones</span>
          </li>
          <li
            onClick={() => setActiveTab('rate_cards')}
            className={`font-semibold rounded-md flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${
              activeTab === 'rate_cards' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">payments</span>
            <span>Rate Cards</span>
          </li>
        </ul>
      </nav>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col md:ml-64 h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-white border-b border-gray-200 flex justify-between items-center w-full px-6 sm:px-8 h-16 z-40 sticky top-0 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="md:hidden font-bold text-lg text-blue-600">LogisticsPro Admin</div>
          </div>
          <div className="flex items-center gap-6 flex-1 justify-end">
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6 h-8">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                {user?.full_name ? user.full_name.charAt(0) : 'A'}
              </div>
              <span className="text-sm font-semibold text-gray-900 hidden sm:inline-block">
                {user?.full_name || 'Admin'}
              </span>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-red-600 hover:bg-gray-50 p-1.5 rounded-md transition-colors ml-1"
                title="Logout"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="flex-1 overflow-auto p-4 md:p-8 flex flex-col gap-6 max-w-[1440px] mx-auto w-full">
          {/* Notification Message */}
          {message && (
            <div
              className={`p-4 rounded-md text-sm font-medium border flex items-center justify-between ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  {message.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{message.text}</span>
              </div>
              <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* TAB 1: DISPATCH BOARD */}
          {activeTab === 'dispatch' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Dispatch Board</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Real-time order state machine and fleet dispatching.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadData}
                    className="bg-white border border-gray-300 text-gray-700 text-sm font-semibold py-2 px-3 rounded-md flex items-center gap-1.5 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    Refresh
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Orders</span>
                  <div className="text-3xl font-bold text-gray-900 tracking-tight">{orders.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Awaiting Assignment</span>
                  <div className="text-3xl font-bold text-amber-500 tracking-tight">
                    {orders.filter((o) => o.current_status === 'CREATED' || o.current_status === 'CONFIRMED').length}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Deliveries</span>
                  <div className="text-3xl font-bold text-blue-600 tracking-tight">
                    {orders.filter((o) => o.current_status === 'ASSIGNED' || o.current_status === 'IN_TRANSIT' || o.current_status === 'OUT_FOR_DELIVERY').length}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-2 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Failed / Reschedule</span>
                  <div className="text-3xl font-bold text-red-600 tracking-tight">
                    {orders.filter((o) => o.current_status === 'FAILED' || o.current_status === 'AWAITING_RESCHEDULE').length}
                  </div>
                </div>
              </div>

              {/* Orders Data Table */}
              <div className="bg-white border border-gray-200 rounded-lg flex-1 flex flex-col min-h-[400px] shadow-sm">
                <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4 bg-white rounded-t-lg">
                  <div className="relative w-72 flex items-center">
                    <span className="material-symbols-outlined absolute right-3 text-gray-500 text-lg">search</span>
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Filter orders by ID or PIN..."
                      className="w-full border border-gray-300 rounded-md pl-4 pr-10 py-2 text-sm focus:border-blue-600 focus:outline-none bg-white"
                    />
                  </div>

                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="CREATED">CREATED</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="PICKED_UP">PICKED_UP</option>
                    <option value="IN_TRANSIT">IN_TRANSIT</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Agent</th>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Route & PINs</th>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                        <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-900">
                      {filteredOrders.map((o) => (
                        <tr key={o.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4 font-mono font-bold text-gray-900">#ORD-{o.id}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getStatusBadgeClass(o.current_status)}`}>
                              {o.current_status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {o.assigned_agent ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                                  {o.assigned_agent.full_name ? o.assigned_agent.full_name.charAt(0) : 'A'}
                                </div>
                                <span className="font-medium text-gray-900">{o.assigned_agent.full_name || `Agent #${o.assigned_agent.agent_id}`}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-gray-600 font-medium text-xs">
                            {o.pickup_postal_code} → {o.drop_postal_code}
                          </td>
                          <td className="px-5 py-4 text-gray-600 font-medium text-xs">
                            {o.order_type} ({o.payment_type})
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              {(o.current_status === 'CONFIRMED' || o.current_status === 'AWAITING_RESCHEDULE') && (
                                <button
                                  onClick={() => handleTriggerAutoDispatch(o.id)}
                                  className="bg-blue-600 text-white hover:bg-blue-700 px-2.5 py-1 rounded text-xs font-semibold"
                                >
                                  Auto Dispatch
                                </button>
                              )}

                              {(o.current_status === 'CONFIRMED' || o.current_status === 'AWAITING_RESCHEDULE') && (
                                <button
                                  onClick={() => setAssigningOrderId(assigningOrderId === o.id ? null : o.id)}
                                  className="border border-gray-300 bg-white text-gray-700 px-2.5 py-1 rounded text-xs font-semibold hover:bg-gray-50"
                                >
                                  Manual Assign
                                </button>
                              )}

                              <button
                                onClick={() => setOverrideOrderId(o.id)}
                                className="border border-amber-300 bg-amber-50 text-amber-800 px-2.5 py-1 rounded text-xs font-semibold hover:bg-amber-100"
                              >
                                Override Status
                              </button>
                            </div>

                            {/* Manual Assign Dropdown Bar */}
                            {assigningOrderId === o.id && (
                              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded flex gap-2 justify-end items-center">
                                <select
                                  value={selectedAgentId}
                                  onChange={(e) => setSelectedAgentId(e.target.value)}
                                  className="border border-gray-300 rounded text-xs p-1 bg-white"
                                >
                                  <option value="">Select Agent...</option>
                                  {agents.map((ag) => (
                                    <option key={ag.id} value={ag.id}>
                                      {ag.full_name || `Agent #${ag.id}`} ({ag.availability_status})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleManualAssignSubmit(o.id)}
                                  disabled={!selectedAgentId}
                                  className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold disabled:opacity-50"
                                >
                                  Assign
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE ORDER */}
          {activeTab === 'create_order' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 max-w-4xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Admin Create Order</h2>
              
              <form onSubmit={handleCalculateAdminQuote} className="flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase">Select Registered Customer</label>
                  <select
                    value={adminCustomerId}
                    onChange={(e) => setAdminCustomerId(e.target.value)}
                    className="border border-gray-300 rounded px-4 py-2.5 text-sm bg-white"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Pickup Address</label>
                    <input
                      type="text"
                      value={adminPickupAddr}
                      onChange={(e) => setAdminPickupAddr(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Pickup Postal Code</label>
                    <input
                      type="text"
                      value={adminPickupPostal}
                      onChange={(e) => setAdminPickupPostal(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Drop Address</label>
                    <input
                      type="text"
                      value={adminDropAddr}
                      onChange={(e) => setAdminDropAddr(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Drop Postal Code</label>
                    <input
                      type="text"
                      value={adminDropPostal}
                      onChange={(e) => setAdminDropPostal(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Length (cm)</label>
                    <input
                      type="number"
                      value={adminLength}
                      onChange={(e) => setAdminLength(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Breadth (cm)</label>
                    <input
                      type="number"
                      value={adminBreadth}
                      onChange={(e) => setAdminBreadth(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Height (cm)</label>
                    <input
                      type="number"
                      value={adminHeight}
                      onChange={(e) => setAdminHeight(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={adminWeight}
                      onChange={(e) => setAdminWeight(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Order Type</label>
                    <select
                      value={adminOrderType}
                      onChange={(e) => setAdminOrderType(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm bg-white"
                    >
                      <option value="B2C">B2C</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600 uppercase">Payment Type</label>
                    <select
                      value={adminPaymentType}
                      onChange={(e) => setAdminPaymentType(e.target.value)}
                      className="border border-gray-300 rounded px-4 py-2 text-sm bg-white"
                    >
                      <option value="PREPAID">PREPAID</option>
                      <option value="COD">COD</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={calculatingAdminQuote}
                    className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    {calculatingAdminQuote ? 'Calculating Quote...' : 'Calculate Quote'}
                  </button>
                </div>
              </form>

              {/* Calculated Quote Display & Confirm Action */}
              {adminQuote && (
                <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-4">
                  <h3 className="font-bold text-gray-900 text-lg">Quote Breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs uppercase block">Route</span>
                      <span className="font-semibold">{adminQuote.pickup_zone_name} → {adminQuote.drop_zone_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase block">Billable Weight</span>
                      <span className="font-semibold">{adminQuote.billable_weight} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase block">Base Charge</span>
                      <span className="font-semibold">₹{Number(adminQuote.base_charge).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase block">Total Charge</span>
                      <span className="font-bold text-xl text-gray-900">₹{Number(adminQuote.total_charge).toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAdminCreateOrderSubmit}
                    disabled={submittingAdminOrder}
                    className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded text-sm transition-colors"
                  >
                    {submittingAdminOrder ? 'Creating Order...' : 'Confirm & Create Order (CONFIRMED Status)'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AGENT FLEET */}
          {activeTab === 'fleet' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Agent Fleet Management</h2>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Agent</th>
                      <th className="px-5 py-3">Availability</th>
                      <th className="px-5 py-3">Zone</th>
                      <th className="px-5 py-3">Active Deliveries</th>
                      <th className="px-5 py-3">GPS Freshness</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {agents.map((ag) => (
                      <tr key={ag.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-5 py-4 font-semibold text-gray-900">
                          {ag.full_name || `Agent #${ag.id}`}
                          <div className="text-xs text-gray-500 font-normal">{ag.email}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ag.availability_status === 'AVAILABLE' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600'}`}>
                            {ag.availability_status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">Zone #{ag.current_zone_id}</td>
                        <td className="px-5 py-4 font-medium">
                          {ag.active_delivery_count} / {ag.max_concurrent_deliveries}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {ag.last_location_update ? new Date(ag.last_location_update).toLocaleString() : 'No GPS Ping'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: AREAS & PINS */}
          {activeTab === 'areas' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Areas & Postal Codes</h2>
                <button
                  onClick={() => setShowAddAreaModal(true)}
                  className="bg-blue-600 text-white font-semibold px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  + Add New Postal Mapping
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">PIN Code</th>
                      <th className="px-5 py-3">Area Name</th>
                      <th className="px-5 py-3">Assigned Zone</th>
                      <th className="px-5 py-3">Coordinates</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {areas.map((ar) => (
                      <tr key={ar.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-5 py-4 font-mono font-bold text-gray-900">{ar.postal_code}</td>
                        <td className="px-5 py-4 text-gray-900 font-medium">{ar.name}</td>
                        <td className="px-5 py-4 text-gray-600">Zone #{ar.zone_id}</td>
                        <td className="px-5 py-4 text-xs text-gray-500">{ar.latitude}, {ar.longitude}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ZONES */}
          {activeTab === 'zones' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Zone Management</h2>
                <button
                  onClick={() => setShowAddZoneModal(true)}
                  className="bg-blue-600 text-white font-semibold px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  + Create Zone
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map((z) => (
                  <div key={z.id} className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between gap-4 shadow-sm">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{z.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{z.description || 'No description provided.'}</p>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => handleDeleteZone(z.id, z.name)}
                        className="text-red-600 hover:text-red-700 text-xs font-semibold px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: RATE CARDS */}
          {activeTab === 'rate_cards' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Rate Cards & COD Surcharge Rules</h2>
              {rateCards.map((rc) => (
                <div key={rc.id} className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{rc.name}</h3>
                      <p className="text-xs text-gray-500">Effective: {new Date(rc.effective_from).toLocaleDateString()}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-xs font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-gray-800 mt-2">Weight & Base Charge Rules</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2">Order Type</th>
                          <th className="px-4 py-2">Movement</th>
                          <th className="px-4 py-2">Base Charge</th>
                          <th className="px-4 py-2">Per-Kg Surcharge</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {rc.rate_rules.map((rule) => (
                          <tr key={rule.id} className="border-b border-gray-100">
                            <td className="px-4 py-3 font-semibold">{rule.order_type}</td>
                            <td className="px-4 py-3 text-gray-600">{rule.movement_type}</td>
                            <td className="px-4 py-3">₹{Number(rule.base_charge).toFixed(2)}</td>
                            <td className="px-4 py-3">₹{Number(rule.per_kg_charge).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-semibold text-sm text-gray-800 mt-4">COD Surcharge Rules</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-2">Order Type</th>
                          <th className="px-4 py-2">COD Fixed Surcharge</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {codRules.map((cRule) => (
                          <tr key={cRule.id} className="border-b border-gray-100">
                            <td className="px-4 py-3 font-semibold">{cRule.order_type}</td>
                            <td className="px-4 py-3">₹{Number(cRule.surcharge).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Add Area Modal */}
      {showAddAreaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full flex flex-col gap-4 shadow-lg">
            <h3 className="font-bold text-gray-900 text-lg">Add New Area & Postal Code</h3>
            <form onSubmit={handleAddArea} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Area Name</label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="e.g. Koramangala 5th Block"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Postal Code (PIN)</label>
                <input
                  type="text"
                  value={newAreaPostal}
                  onChange={(e) => setNewAreaPostal(e.target.value)}
                  placeholder="e.g. 560095"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Assigned Zone</label>
                <select
                  value={newAreaZoneId}
                  onChange={(e) => setNewAreaZoneId(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 bg-white"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddAreaModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingArea}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold"
                >
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Zone Modal */}
      {showAddZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full flex flex-col gap-4 shadow-lg">
            <h3 className="font-bold text-gray-900 text-lg">Create New Zone</h3>
            <form onSubmit={handleAddZone} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Zone Name</label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="e.g. Outer Ring Road Zone"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Description</label>
                <input
                  type="text"
                  value={newZoneDesc}
                  onChange={(e) => setNewZoneDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddZoneModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold"
                >
                  Create Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Override Modal */}
      {overrideOrderId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full flex flex-col gap-4 shadow-lg">
            <h3 className="font-bold text-gray-900 text-lg">Override Status for Order #{overrideOrderId}</h3>
            <form onSubmit={handleOverrideStatus} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Target Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 bg-white"
                >
                  <option value="CREATED">CREATED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">Reason for Override</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setOverrideOrderId(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded text-xs font-semibold"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
