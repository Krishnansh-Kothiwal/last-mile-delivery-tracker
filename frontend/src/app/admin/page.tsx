'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import {
  ShieldCheck, MapPin, Truck, Scale, RefreshCw, Zap, UserCheck,
  AlertTriangle, ChevronRight, CheckCircle2, Sliders, Layers,
  Plus, Trash2, Edit2, X, Check, Search, PackagePlus, DollarSign, Calculator
} from 'lucide-react';

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dispatch' | 'overrides' | 'zones' | 'rates' | 'agents'>('dispatch');

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
  const [orderAgentFilter, setOrderAgentFilter] = useState('');

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

  // Agent Fleet: which agent card is expanded to show assignments
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

  // Admin Create Order State (2-Step Quote -> Confirm)
  const [showAdminCreateOrderModal, setShowAdminCreateOrderModal] = useState(false);
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
  const [adminQuoteError, setAdminQuoteError] = useState<string | null>(null);
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
      if (cData.length > 0) {
        setAdminCustomerId(cData[0].id);
      }
      if (zData.length > 0) {
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
      const result = await fetchApi<any>(`/dispatch/auto-assign/${orderId}`, { method: 'POST' });
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
      await fetchApi('/dispatch/manual-assign', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
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
          reason: overrideReason,
        }),
      });
      setMessage({ type: 'success', text: `Order #${overrideOrderId} status overridden to ${overrideStatus}` });
      setOverrideOrderId(null);
      setOverrideReason('Admin manual correction');
      loadData();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Status override failed: ${e.message}` });
    }
  };

  // Step 1: Calculate Quote before order creation
  const handleCalculateAdminQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculatingAdminQuote(true);
    setAdminQuoteError(null);
    setAdminQuote(null);

    try {
      const quote = await fetchApi<PricingQuote>('/pricing/quote', {
        method: 'POST',
        body: JSON.stringify({
          pickup_postal_code: adminPickupPostal.trim(),
          drop_postal_code: adminDropPostal.trim(),
          length: parseFloat(adminLength) || 10,
          breadth: parseFloat(adminBreadth) || 10,
          height: parseFloat(adminHeight) || 10,
          actual_weight: parseFloat(adminWeight) || 1.0,
          order_type: adminOrderType,
          payment_type: adminPaymentType,
        }),
      });
      setAdminQuote(quote);
    } catch (err: any) {
      setAdminQuoteError(err.message || 'Serviceability or pricing error');
    } finally {
      setCalculatingAdminQuote(false);
    }
  };

  // Step 2: Confirm & Create Order
  const handleConfirmAdminOrder = async () => {
    if (!adminCustomerId || !adminQuote) return;
    setSubmittingAdminOrder(true);
    setMessage(null);
    try {
      const newOrder = await fetchApi('/admin/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: Number(adminCustomerId),
          pickup_address: adminPickupAddr.trim(),
          pickup_postal_code: adminPickupPostal.trim(),
          drop_address: adminDropAddr.trim(),
          drop_postal_code: adminDropPostal.trim(),
          length: parseFloat(adminLength) || 10,
          breadth: parseFloat(adminBreadth) || 10,
          height: parseFloat(adminHeight) || 10,
          actual_weight: parseFloat(adminWeight) || 1.0,
          order_type: adminOrderType,
          payment_type: adminPaymentType,
        }),
      });
      setMessage({ type: 'success', text: `Order #${newOrder.id} created successfully on behalf of Customer #${adminCustomerId}!` });
      setShowAdminCreateOrderModal(false);
      setAdminQuote(null);
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create order' });
    } finally {
      setSubmittingAdminOrder(false);
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    setMessage(null);
    try {
      await fetchApi('/admin/zones', {
        method: 'POST',
        body: JSON.stringify({
          name: newZoneName.trim(),
          description: newZoneDesc.trim(),
        }),
      });
      setMessage({ type: 'success', text: `Zone ${newZoneName} created successfully!` });
      setShowAddZoneModal(false);
      setNewZoneName('');
      setNewZoneDesc('');
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create zone' });
    }
  };

  const startEditingZone = (z: Zone) => {
    setEditingZoneId(z.id);
    setEditZoneName(z.name);
    setEditZoneDesc(z.description || '');
  };

  const handleUpdateZone = async (zoneId: number) => {
    setMessage(null);
    try {
      await fetchApi(`/admin/zones/${zoneId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editZoneName.trim(),
          description: editZoneDesc.trim(),
        }),
      });
      setMessage({ type: 'success', text: `Zone updated successfully!` });
      setEditingZoneId(null);
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update zone' });
    }
  };

  const handleDeleteZone = async (z: Zone) => {
    if (!window.confirm(`Are you sure you want to delete Zone '${z.name}'?`)) return;
    setMessage(null);
    try {
      await fetchApi(`/admin/zones/${z.id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `Zone '${z.name}' deleted.` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete zone' });
    }
  };

  const startEditingRateRule = (rule: RateRule) => {
    setEditingRuleId(rule.id);
    setEditRuleBase(String(rule.base_charge));
    setEditRulePerKg(String(rule.per_kg_charge));
  };

  const handleUpdateRateRule = async (rule: RateRule) => {
    setMessage(null);
    try {
      await fetchApi(`/admin/rate-rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          rate_card_version_id: rule.rate_card_version_id,
          order_type: rule.order_type,
          movement_type: rule.movement_type,
          min_weight: rule.min_weight,
          max_weight: rule.max_weight,
          base_charge: parseFloat(editRuleBase) || 0,
          per_kg_charge: parseFloat(editRulePerKg) || 0,
        }),
      });
      setMessage({ type: 'success', text: `Rate rule updated successfully!` });
      setEditingRuleId(null);
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update rate rule' });
    }
  };

  const startEditingCodRule = (cod: CodRule) => {
    setEditingCodId(cod.id);
    setEditCodSurcharge(String(cod.surcharge));
  };

  const handleUpdateCodRule = async (cod: CodRule) => {
    const val = parseFloat(editCodSurcharge);
    if (isNaN(val) || val < 0) {
      setMessage({ type: 'error', text: 'COD surcharge cannot be negative.' });
      return;
    }
    setMessage(null);
    try {
      await fetchApi(`/admin/cod-rules/${cod.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          rate_card_version_id: cod.rate_card_version_id,
          order_type: cod.order_type,
          surcharge: val,
        }),
      });
      setMessage({ type: 'success', text: `COD rule updated successfully!` });
      setEditingCodId(null);
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update COD rule' });
    }
  };

  const handleCreateArea = async (e: React.FormEvent) => {
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
          zone_id: Number(newAreaZoneId),
          latitude: parseFloat(newAreaLat) || 12.9716,
          longitude: parseFloat(newAreaLon) || 77.5946,
        }),
      });
      setMessage({ type: 'success', text: `Postal code ${newAreaPostal} (${newAreaName}) added successfully!` });
      setShowAddAreaModal(false);
      setNewAreaName('');
      setNewAreaPostal('');
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add postal code mapping' });
    } finally {
      setSubmittingArea(false);
    }
  };

  const startEditingArea = (area: Area) => {
    setEditingAreaId(area.id);
    setEditAreaName(area.name);
    setEditAreaPostal(area.postal_code);
    setEditAreaZoneId(area.zone_id);
  };

  const handleUpdateArea = async (areaId: number) => {
    setSubmittingArea(true);
    setMessage(null);
    try {
      await fetchApi(`/admin/areas/${areaId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editAreaName.trim(),
          postal_code: editAreaPostal.trim(),
          zone_id: Number(editAreaZoneId),
        }),
      });
      setMessage({ type: 'success', text: `Postal code mapping updated successfully!` });
      setEditingAreaId(null);
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update postal code mapping' });
    } finally {
      setSubmittingArea(false);
    }
  };

  const handleDeleteArea = async (areaId: number, postalCode: string) => {
    if (!window.confirm(`Are you sure you want to delete postal code mapping ${postalCode}?`)) return;
    try {
      await fetchApi(`/admin/areas/${areaId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `Postal code mapping ${postalCode} deleted.` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete postal code mapping' });
    }
  };

  // Filter Orders in Dispatch Board
  const filteredOrders = orders.filter((o) => {
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      if (!String(o.id).includes(q) && !o.pickup_postal_code.includes(q) && !o.drop_postal_code.includes(q)) {
        return false;
      }
    }
    if (orderStatusFilter && o.current_status !== orderStatusFilter) return false;
    if (orderZoneFilter) {
      const zid = Number(orderZoneFilter);
      // Map area postal codes to zone_id
      const pArea = areas.find((a) => a.postal_code === o.pickup_postal_code);
      const dArea = areas.find((a) => a.postal_code === o.drop_postal_code);
      if (pArea?.zone_id !== zid && dArea?.zone_id !== zid) return false;
    }
    if (orderAgentFilter) {
      const agId = Number(orderAgentFilter);
      if (o.assigned_agent?.agent_id !== agId) return false;
    }
    return true;
  });

  const filteredAreas = areas.filter((a) => {
    if (!areaSearch.trim()) return true;
    const q = areaSearch.toLowerCase().trim();
    return a.name.toLowerCase().includes(q) || a.postal_code.includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-500" /> Admin Control Center
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Dispatch engine control, audited state overrides, rate cards, and postal code area management.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh All Data
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-800 pb-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'dispatch' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-400 hover:text-white bg-gray-900/60'
          }`}
        >
          <Zap className="w-4 h-4" /> Dispatch Board ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'agents' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-400 hover:text-white bg-gray-900/60'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Agent Fleet ({agents.length})
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'zones' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-400 hover:text-white bg-gray-900/60'
          }`}
        >
          <MapPin className="w-4 h-4" /> Zones & Areas ({zones.length} zones / {areas.length} PINs)
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'rates' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-400 hover:text-white bg-gray-900/60'
          }`}
        >
          <Scale className="w-4 h-4" /> Rate Cards & Rules
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
            activeTab === 'overrides' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-400 hover:text-white bg-gray-900/60'
          }`}
        >
          <Sliders className="w-4 h-4" /> Status Override
        </button>
      </div>

      {/* TAB 1: DISPATCH BOARD */}
      {activeTab === 'dispatch' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" /> Active Orders Dispatch Board
              </h2>
              <button
                onClick={() => {
                  setShowAdminCreateOrderModal(true);
                  setAdminQuote(null);
                  setAdminQuoteError(null);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <PackagePlus className="w-4 h-4" /> Create Admin Order
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-gray-900/80 rounded-xl border border-gray-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Order # or PIN..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-white outline-none focus:border-purple-500"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
              >
                <option value="">All Statuses</option>
                <option value="CREATED">CREATED</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="PICKED_UP">PICKED_UP</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="FAILED">FAILED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <select
                value={orderZoneFilter}
                onChange={(e) => setOrderZoneFilter(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
              >
                <option value="">All Zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>

              <select
                value={orderAgentFilter}
                onChange={(e) => setOrderAgentFilter(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
              >
                <option value="">All Assigned Agents</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.full_name || `Agent #${ag.id}`}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setOrderSearch('');
                  setOrderStatusFilter('');
                  setOrderZoneFilter('');
                  setOrderAgentFilter('');
                }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold text-xs transition"
              >
                Clear Filters
              </button>
            </div>

            {/* Admin Create Order Modal / Box (2-Step Quote -> Confirm) */}
            {showAdminCreateOrderModal && (
              <div className="p-5 bg-gray-950/90 rounded-2xl border border-purple-500/40 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="font-bold text-white text-sm flex items-center gap-2">
                    <PackagePlus className="w-4 h-4 text-purple-400" /> Create Order on Behalf of Customer
                  </span>
                  <button onClick={() => setShowAdminCreateOrderModal(false)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCalculateAdminQuote} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-gray-400 mb-1">Select Customer User</label>
                      <select
                        value={adminCustomerId}
                        onChange={(e) => setAdminCustomerId(Number(e.target.value))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                        required
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} — {c.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Order Type</label>
                      <select
                        value={adminOrderType}
                        onChange={(e) => setAdminOrderType(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                      >
                        <option value="B2C">B2C</option>
                        <option value="B2B">B2B</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Payment Type</label>
                      <select
                        value={adminPaymentType}
                        onChange={(e) => setAdminPaymentType(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                      >
                        <option value="PREPAID">PREPAID</option>
                        <option value="COD">COD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Actual Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={adminWeight}
                        onChange={(e) => setAdminWeight(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Pickup Address</label>
                      <input
                        type="text"
                        value={adminPickupAddr}
                        onChange={(e) => setAdminPickupAddr(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Pickup Postal Code</label>
                      <input
                        type="text"
                        value={adminPickupPostal}
                        onChange={(e) => setAdminPickupPostal(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Drop Address</label>
                      <input
                        type="text"
                        value={adminDropAddr}
                        onChange={(e) => setAdminDropAddr(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Drop Postal Code</label>
                      <input
                        type="text"
                        value={adminDropPostal}
                        onChange={(e) => setAdminDropPostal(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={calculatingAdminQuote}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Calculator className="w-3.5 h-3.5" /> {calculatingAdminQuote ? 'Calculating Quote...' : 'Calculate Quote'}
                    </button>
                  </div>
                </form>

                {/* Quote Error Banner */}
                {adminQuoteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{adminQuoteError}</span>
                  </div>
                )}

                {/* Step 2: Quote Breakdown & Explicit Confirmation */}
                {adminQuote && (
                  <div className="p-4 bg-gray-900 rounded-xl border border-purple-500/30 space-y-3 text-xs">
                    <div className="font-bold text-purple-300 text-xs border-b border-gray-800 pb-2">
                      Pricing Quote & Route Breakdown
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-300">
                      <div>
                        <span className="text-gray-500 text-[10px] block">Pickup Zone</span>
                        <span className="font-bold text-white">{adminQuote.pickup_zone_name}</span> ({adminQuote.pickup_area_name})
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">Drop Zone</span>
                        <span className="font-bold text-white">{adminQuote.drop_zone_name}</span> ({adminQuote.drop_area_name})
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">Volumetric / Billable</span>
                        <span className="font-mono">{adminQuote.volumetric_weight}kg / {adminQuote.billable_weight}kg</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">Movement Type</span>
                        <span className="font-bold text-blue-300">{adminQuote.movement_type}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-950 rounded-lg flex items-center justify-between font-mono text-xs border border-gray-800">
                      <div className="space-y-0.5 text-[11px] text-gray-400">
                        <div>Base: ₹{Number(adminQuote.base_charge).toFixed(2)} + Weight: ₹{Number(adminQuote.weight_charge).toFixed(2)}</div>
                        <div>COD Surcharge: ₹{Number(adminQuote.cod_surcharge).toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block font-sans">Total Charge</span>
                        <span className="text-lg font-black text-emerald-400">₹{Number(adminQuote.total_charge).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setAdminQuote(null)}
                        className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                      >
                        Reset Quote
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAdminOrder}
                        disabled={submittingAdminOrder}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20"
                      >
                        {submittingAdminOrder ? 'Creating Order...' : 'Confirm & Create Order'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs italic">
                  No orders match current filter criteria.
                </div>
              ) : (
                filteredOrders.map((o) => (
                  <div key={o.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">Order #{o.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {o.current_status}
                          </span>
                        </div>
                        <div className="text-gray-400 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-500" /> {o.pickup_postal_code} → {o.drop_postal_code}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {o.order_type} • {o.payment_type} • {o.actual_weight}kg • Created {new Date(o.created_at).toLocaleString()}
                        </div>

                        {/* Display assigned agent name if available */}
                        {o.assigned_agent && (
                          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 pt-0.5">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Assigned to: {o.assigned_agent.full_name || `Agent #${o.assigned_agent.agent_id}`}
                            {o.assigned_agent.email && <span className="text-gray-400 font-normal">({o.assigned_agent.email})</span>}
                          </div>
                        )}
                      </div>

                      {/* Dispatch Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleTriggerAutoDispatch(o.id)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 shadow-md shadow-purple-600/20"
                        >
                          <Zap className="w-3.5 h-3.5" /> Auto-Dispatch (Haversine)
                        </button>

                        {assigningOrderId === o.id ? (
                          <div className="flex items-center gap-2 bg-gray-800 p-1.5 rounded-lg border border-gray-700">
                            <select
                              value={selectedAgentId}
                              onChange={(e) => setSelectedAgentId(e.target.value)}
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none"
                            >
                              <option value="">Select Agent...</option>
                              {agents.map((ag) => (
                                <option key={ag.id} value={ag.id}>
                                  {ag.full_name || `Agent #${ag.id}`} ({ag.availability_status} - {ag.active_assignments?.length ?? 0}/{ag.max_concurrent_deliveries})
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleManualAssignSubmit(o.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => setAssigningOrderId(null)}
                              className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAssigningOrderId(o.id);
                              setSelectedAgentId('');
                            }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg font-semibold text-xs transition"
                          >
                            Manual Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Auto-Dispatch Reasoning Modal / Box */}
          {dispatchResult && (
            <div className="p-4 bg-gray-900/90 rounded-2xl border border-purple-500/30 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="font-bold text-purple-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Haversine Dispatch Engine Reasoning Result
                </span>
                <button onClick={() => setDispatchResult(null)} className="text-gray-500 hover:text-white">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <div>Status: <span className="font-bold text-white">{dispatchResult.success ? 'SUCCESS' : 'FAILED'}</span></div>
                <div>Assigned Agent: <span className="font-bold text-purple-300">{dispatchResult.assigned_agent_id ? `Agent #${dispatchResult.assigned_agent_id}` : 'None'}</span></div>
                {dispatchResult.selected_candidate && (
                  <>
                    <div>Selected Distance: <span className="font-mono text-emerald-400">{dispatchResult.selected_candidate.distance_km} km</span></div>
                    <div>Score Penalty: <span className="font-mono">{dispatchResult.selected_candidate.score}</span></div>
                  </>
                )}
              </div>

              <pre className="p-3 bg-gray-950 rounded-xl font-mono text-[10px] text-gray-400 overflow-x-auto border border-gray-800">
                {JSON.stringify(dispatchResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OVERRIDES */}
      {activeTab === 'overrides' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 max-w-xl mx-auto space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" /> Audited Status Override
            </h2>
            <p className="text-xs text-gray-400">
              Manually transition an order's lifecycle status. Every override creates an append-only audit event in tracking history.
            </p>
          </div>

          <form onSubmit={handleOverrideStatus} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-400 mb-1">Select Target Order</label>
              <select
                value={overrideOrderId || ''}
                onChange={(e) => setOverrideOrderId(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-amber-500"
                required
              >
                <option value="">Select Order...</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.id} — Current Status: {o.current_status} ({o.pickup_postal_code} → {o.drop_postal_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">New Target Status</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-amber-500"
              >
                <option value="CREATED">CREATED</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="PICKED_UP">PICKED_UP</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="FAILED">FAILED</option>
                <option value="AWAITING_RESCHEDULE">AWAITING_RESCHEDULE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Mandatory Override Reason</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none h-20"
                placeholder="State administrative reason for manual correction..."
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
        <div className="space-y-6">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-gray-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" /> Bengaluru Zones & Postal Code Area Mappings
              </h2>
              <p className="text-xs text-gray-400">
                {zones.length} Zones configured • {areas.length} Postal Codes mapped
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddZoneModal(true)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Zone
              </button>
              <button
                onClick={() => setShowAddAreaModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <Plus className="w-4 h-4" /> Add Postal Code Mapping
              </button>
            </div>
          </div>

          {/* Add Zone Modal / Form */}
          {showAddZoneModal && (
            <div className="glass-panel p-5 rounded-2xl border border-purple-500/40 space-y-3 bg-gray-950/90">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400" /> Create New Zone
                </span>
                <button onClick={() => setShowAddZoneModal(false)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateZone} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Zone Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru Central"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Central Business District & Inner Suburbs"
                    value={newZoneDesc}
                    onChange={(e) => setNewZoneDesc(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddZoneModal(false)}
                    className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold"
                  >
                    Create Zone
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Add Area Modal / Form */}
          {showAddAreaModal && (
            <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 space-y-4 bg-gray-950/90">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400" /> Add New Postal Code Mapping
                </span>
                <button onClick={() => setShowAddAreaModal(false)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateArea} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Area / Locality Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Koramangala 4th Block"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Postal Code (6 digits)</label>
                  <input
                    type="text"
                    placeholder="e.g. 560034"
                    value={newAreaPostal}
                    onChange={(e) => setNewAreaPostal(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Assigned Zone</label>
                  <select
                    value={newAreaZoneId}
                    onChange={(e) => setNewAreaZoneId(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newAreaLat}
                    onChange={(e) => setNewAreaLat(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newAreaLon}
                    onChange={(e) => setNewAreaLon(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono outline-none"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAreaModal(false)}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingArea}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    {submittingArea ? 'Saving...' : 'Save Postal Code Mapping'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Zones & Mappings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Zones Summary List (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" /> Bengaluru Zones ({zones.length})
                </h3>
                <div className="space-y-3">
                  {zones.map((z) => {
                    const count = areas.filter((a) => a.zone_id === z.id).length;
                    const isEditingZ = editingZoneId === z.id;

                    if (isEditingZ) {
                      return (
                        <div key={z.id} className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-2 text-xs">
                          <div>
                            <label className="block text-gray-400 text-[10px] mb-0.5">Zone Name</label>
                            <input
                              type="text"
                              value={editZoneName}
                              onChange={(e) => setEditZoneName(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-[10px] mb-0.5">Description</label>
                            <input
                              type="text"
                              value={editZoneDesc}
                              onChange={(e) => setEditZoneDesc(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingZoneId(null)}
                              className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateZone(z.id)}
                              className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-[11px]"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={z.id} className="p-3.5 bg-gray-900/70 rounded-xl border border-gray-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{z.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-mono text-[10px]">
                              {count} PINs
                            </span>
                            <button
                              onClick={() => startEditingZone(z)}
                              className="p-1 text-gray-400 hover:text-purple-300 rounded"
                              title="Rename Zone"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteZone(z)}
                              className="p-1 text-gray-400 hover:text-red-400 rounded"
                              title="Delete Zone"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-400 text-[11px] leading-normal">{z.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Postal Codes Mappings Table / List (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="glass-panel rounded-2xl p-5 border border-gray-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-400" /> Configured Postal Codes ({filteredAreas.length})
                  </h3>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter postal codes..."
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredAreas.map((a) => {
                    const isEditing = editingAreaId === a.id;
                    const assignedZone = zones.find((z) => z.id === a.zone_id);

                    if (isEditing) {
                      return (
                        <div key={a.id} className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-gray-400 text-[10px] mb-1">Locality Name</label>
                              <input
                                type="text"
                                value={editAreaName}
                                onChange={(e) => setEditAreaName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 text-[10px] mb-1">Postal Code</label>
                              <input
                                type="text"
                                value={editAreaPostal}
                                onChange={(e) => setEditAreaPostal(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 text-[10px] mb-1">Zone</label>
                              <select
                                value={editAreaZoneId}
                                onChange={(e) => setEditAreaZoneId(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none"
                              >
                                {zones.map((z) => (
                                  <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingAreaId(null)}
                              className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateArea(a.id)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={a.id}
                        className="p-3 bg-gray-900/60 hover:bg-gray-800/60 rounded-xl border border-gray-800 text-xs flex items-center justify-between gap-3 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{a.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {a.postal_code}
                            </span>
                          </div>
                          <div className="text-gray-400 text-[11px]">
                            Zone: <span className="text-purple-300 font-semibold">{assignedZone?.name || `Zone #${a.zone_id}`}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditingArea(a)}
                            className="p-1.5 text-gray-400 hover:text-purple-300 hover:bg-gray-800 rounded transition"
                            title="Edit postal code mapping"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteArea(a.id, a.postal_code)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition"
                            title="Delete mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RATES & COD */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" /> Active Rate Cards & Pricing Rules
            </h2>

            {rateCards.map((card) => (
              <div key={card.id} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{card.name}</span>
                  {card.is_active && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ACTIVE</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {card.rate_rules?.map((rule) => {
                    const isEditingRule = editingRuleId === rule.id;
                    return (
                      <div key={rule.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-blue-400">{rule.order_type} • {rule.movement_type}</div>
                          {!isEditingRule && (
                            <button
                              onClick={() => startEditingRateRule(rule)}
                              className="p-1 text-gray-400 hover:text-purple-300 hover:bg-gray-800 rounded transition"
                              title="Edit Rate Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isEditingRule ? (
                          <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Base Charge (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editRuleBase}
                                  onChange={(e) => setEditRuleBase(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Per KG Charge (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editRulePerKg}
                                  onChange={(e) => setEditRulePerKg(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingRuleId(null)}
                                className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateRateRule(rule)}
                                className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-[11px]"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-gray-300">Base Charge: ₹{Number(rule.base_charge).toFixed(2)}</div>
                            <div className="text-gray-300">Per KG Rate: ₹{Number(rule.per_kg_charge).toFixed(2)}/kg</div>
                            <div className="text-gray-500 text-[10px]">Weight Band: {Number(rule.min_weight)}kg - {Number(rule.max_weight)}kg</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* COD Rules Configuration */}
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Cash on Delivery (COD) Surcharge Rules
            </h2>
            <p className="text-xs text-gray-400">
              Configure flat COD handling surcharges for B2B and B2C orders. PREPAID orders automatically receive no surcharge.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {codRules.map((cod) => {
                const isEditingCod = editingCodId === cod.id;
                return (
                  <div key={cod.id} className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-emerald-400">{cod.order_type} COD Surcharge</div>
                      {!isEditingCod && (
                        <button
                          onClick={() => startEditingCodRule(cod)}
                          className="p-1 text-gray-400 hover:text-emerald-300 hover:bg-gray-800 rounded transition"
                          title="Edit COD Rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingCod ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-0.5">Surcharge Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editCodSurcharge}
                            onChange={(e) => setEditCodSurcharge(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingCodId(null)}
                            className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateCodRule(cod)}
                            className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px]"
                          >
                            Save COD Rule
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-200 text-sm font-bold font-mono">
                        ₹{Number(cod.surcharge).toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AGENTS */}
      {activeTab === 'agents' && (
        <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-4">
          <h2 className="text-base font-bold text-white">Agent Fleet ({agents.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((ag) => {
              const isExpanded = expandedAgentId === ag.id;
              const assignmentCount = ag.active_assignments?.length ?? 0;
              return (
                <div
                  key={ag.id}
                  className={`bg-gray-900/60 rounded-xl border text-xs transition ${
                    isExpanded ? 'border-purple-500/40' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm">{ag.full_name || `Agent #${ag.id}`}</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ag.availability_status === 'AVAILABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ag.availability_status === 'UNAVAILABLE'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {ag.availability_status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ag.dispatch_readiness === 'READY_FOR_DISPATCH'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : ag.dispatch_readiness === 'AT_CAPACITY'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : ag.dispatch_readiness === 'LOCATION_STALE'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : ag.dispatch_readiness === 'LOCATION_REQUIRED'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {ag.dispatch_readiness === 'READY_FOR_DISPATCH'
                            ? 'Ready for Dispatch'
                            : ag.dispatch_readiness === 'AT_CAPACITY'
                            ? 'At Capacity'
                            : ag.dispatch_readiness === 'LOCATION_STALE'
                            ? 'Location Stale'
                            : ag.dispatch_readiness === 'LOCATION_REQUIRED'
                            ? 'Location Required'
                            : ag.dispatch_readiness || 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="text-gray-400">{ag.email || '—'}</div>
                    <div className="text-blue-400 font-mono">
                      Workload: {assignmentCount} / {ag.max_concurrent_deliveries} active
                    </div>

                    <div className="text-[10px]">
                      {ag.last_location_update ? (
                        <span className={ag.is_location_fresh === false ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                          Last GPS: {new Date(ag.last_location_update).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-red-400 font-semibold">GPS Missing</span>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedAgentId(isExpanded ? null : ag.id)}
                      className="w-full mt-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      {isExpanded ? 'Hide Assignments ▲' : `View Assignments (${assignmentCount}) ▼`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 bg-gray-950/80 p-4 space-y-3">
                      <div className="font-bold text-gray-300 text-xs border-b border-gray-800 pb-1.5">
                        Active Assigned Orders ({assignmentCount})
                      </div>

                      {assignmentCount === 0 ? (
                        <div className="text-gray-500 italic py-2 text-center text-[11px]">
                          No active orders currently assigned.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {ag.active_assignments.map((asgn) => (
                            <div key={asgn.assignment_id} className="p-2.5 bg-gray-900 rounded-lg border border-gray-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-white text-xs">Order #{asgn.order_id}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {asgn.order_status}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-300 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-500" /> {asgn.pickup_postal_code} → {asgn.drop_postal_code}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {asgn.order_type} • {asgn.payment_type}
                              </div>
                              {asgn.customer_name && (
                                <div className="text-[10px] text-gray-400">
                                  Customer: <span className="text-gray-200">{asgn.customer_name}</span> ({asgn.customer_email || '—'})
                                </div>
                              )}
                              <div className="text-[9px] text-gray-500 font-mono">
                                Assigned: {new Date(asgn.assigned_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
