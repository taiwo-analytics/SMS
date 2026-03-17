'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Package, Plus, Trash2, X, AlertTriangle, Search,
  UserCheck, History, Info, MapPin, ClipboardList,
  Pencil, Filter, Download, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import { InventoryItem, InventoryAssignment } from '@/types/database'
import SchoolLoader from '@/components/SchoolLoader'

type Tab = 'inventory' | 'assignments' | 'history'

const STAT_COLOR_STYLES = {
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
} as const

type StatColor = keyof typeof STAT_COLOR_STYLES

export default function AdminInventoryPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [assignments, setAssignments] = useState<InventoryAssignment[]>([])
  const [tab, setTab] = useState<Tab>('inventory')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState({
    name: '',
    category: '',
    quantity: 0,
    min_stock: 0,
    location: '',
    condition: 'Good',
    notes: ''
  })

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningItemId, setAssigningItemId] = useState('')
  const [assignForm, setAssignForm] = useState({
    assigned_to_name: '',
    quantity: 1,
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const showNotice = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 4000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [
        { data: itemsData },
        { data: assignmentsData }
      ] = await Promise.all([
        supabase.from('inventory_items').select('*').order('name'),
        supabase.from('inventory_assignments').select('*, inventory_items(id, name)').order('assigned_at', { ascending: false })
      ])

      setItems(itemsData || [])
      setAssignments(assignmentsData || [])
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to load data')
    }
  }, [showNotice])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await loadData()
      setLoading(false)
    })()
  }, [loadData])

  // Stats
  const stats = useMemo(() => {
    const total = items.length
    const lowStock = items.filter(i => i.quantity <= i.min_stock).length
    const assignedCount = assignments.filter(a => !a.returned_at).length
    const totalValue = items.reduce((acc, i) => acc + i.quantity, 0)
    return { total, lowStock, assignedCount, totalValue }
  }, [items, assignments])

  // Filters
  const norm = (s: string) => (s || '').toLowerCase()
  const filteredItems = useMemo(() => {
    if (!search) return items
    const q = norm(search)
    return items.filter(i =>
      norm(i.name).includes(q) || norm(i.category || '').includes(q) || norm(i.location || '').includes(q)
    )
  }, [items, search])

  const activeAssignments = useMemo(() =>
    assignments.filter(a => !a.returned_at), [assignments])

  const historyAssignments = useMemo(() =>
    assignments.filter(a => a.returned_at), [assignments])

  // Item CRUD
  const openAddItem = () => {
    setEditingItem(null)
    setItemForm({ name: '', category: '', quantity: 0, min_stock: 0, location: '', condition: 'Good', notes: '' })
    setShowItemModal(true)
  }

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      category: item.category || '',
      quantity: item.quantity,
      min_stock: item.min_stock,
      location: item.location || '',
      condition: item.condition || 'Good',
      notes: item.notes || ''
    })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: itemForm.name,
        category: itemForm.category || null,
        quantity: itemForm.quantity,
        min_stock: itemForm.min_stock,
        location: itemForm.location || null,
        condition: itemForm.condition,
        notes: itemForm.notes || null
      }

      if (editingItem) {
        const { error } = await supabase.from('inventory_items').update(data).eq('id', editingItem.id)
        if (error) throw error
        showNotice('success', 'Item updated')
      } else {
        const { error } = await supabase.from('inventory_items').insert(data)
        if (error) throw error
        showNotice('success', 'Item added to inventory')
      }
      setShowItemModal(false)
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item? This will also remove all assignment records.')) return
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (error) throw error
      showNotice('success', 'Item deleted')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to delete')
    }
  }

  // Assignment Actions
  const openAssignModal = (itemId: string) => {
    setAssigningItemId(itemId)
    setAssignForm({ assigned_to_name: '', quantity: 1, notes: '' })
    setShowAssignModal(true)
  }

  const handleAssignItem = async () => {
    if (!assignForm.assigned_to_name.trim() || !assigningItemId) return
    const item = items.find(i => i.id === assigningItemId)
    if (!item || item.quantity < assignForm.quantity) {
      showNotice('error', 'Insufficient quantity in stock')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('inventory_assignments').insert({
        item_id: assigningItemId,
        assigned_to_name: assignForm.assigned_to_name,
        quantity: assignForm.quantity,
        notes: assignForm.notes || null
      })

      if (error) throw error

      // Update inventory quantity
      await supabase.from('inventory_items')
        .update({ quantity: item.quantity - assignForm.quantity })
        .eq('id', assigningItemId)

      setShowAssignModal(false)
      showNotice('success', `Assigned to ${assignForm.assigned_to_name}`)
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to assign item')
    } finally {
      setSaving(false)
    }
  }

  const handleReturnItem = async (assignment: InventoryAssignment) => {
    if (!confirm('Confirm return of this item to inventory?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('inventory_assignments')
        .update({ returned_at: new Date().toISOString() })
        .eq('id', assignment.id)

      if (error) throw error

      // Add back to inventory
      const item = items.find(i => i.id === assignment.item_id)
      if (item) {
        await supabase.from('inventory_items')
          .update({ quantity: item.quantity + assignment.quantity })
          .eq('id', item.id)
      }

      showNotice('success', 'Item returned to inventory')
      await loadData()
    } catch (e: any) {
      showNotice('error', e.message || 'Failed to process return')
    } finally {
      setSaving(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Quantity', 'Min Stock', 'Location', 'Condition', 'Notes']
    const rows = items.map(i => [
      i.name,
      i.category || '',
      i.quantity,
      i.min_stock,
      i.location || '',
      i.condition || 'Good',
      i.notes || ''
    ])
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `inventory_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <SchoolLoader />

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shadow-sm">
            <Package className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-sm text-gray-500">Track assets, stock levels, and assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={openAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-all shadow-md shadow-orange-100"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { label: 'Total Items', value: stats.total, icon: Package, color: 'orange' },
          { label: 'Total Units', value: stats.totalValue, icon: ClipboardList, color: 'blue' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: stats.lowStock > 0 ? 'red' : 'green' },
          { label: 'Active Assignments', value: stats.assignedCount, icon: UserCheck, color: 'purple' },
        ] as Array<{ label: string; value: number; icon: any; color: StatColor }>).map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${STAT_COLOR_STYLES[stat.color].bg} flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${STAT_COLOR_STYLES[stat.color].text}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'inventory', label: 'In Stock', icon: Package },
          { key: 'assignments', label: `Active Assignments (${stats.assignedCount})`, icon: UserCheck },
          { key: 'history', label: 'Log History', icon: History },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Notice */}
      {notice && (
        <div className={`mb-6 px-4 py-3 rounded-xl border flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 ${
          notice.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {notice.type === 'success' ? <UserCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {notice.message}
          </div>
          <button onClick={() => setNotice(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search Bar */}
        {(tab === 'inventory') && (
          <div className="p-4 border-b border-gray-50 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
              />
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ===== INVENTORY TABLE ===== */}
        {tab === 'inventory' && (
          <div className="overflow-x-auto">
            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No items found in inventory</p>
                <button onClick={openAddItem} className="mt-2 text-orange-600 hover:underline text-sm font-medium">Add your first item</button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category & Location</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map((item) => {
                    const isLow = item.quantity <= item.min_stock
                    return (
                      <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Info className="w-3 h-3" />
                            ID: {item.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                              {item.category || 'Uncategorized'}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="w-3 h-3" />
                              {item.location || 'Not set'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                                {item.quantity} Units
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Min: {item.min_stock}</span>
                            </div>
                            {isLow && (
                              <div className="bg-red-50 p-1 rounded-full" title="Low Stock Warning">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.condition === 'Excellent' ? 'bg-green-100 text-green-700' :
                            item.condition === 'Good' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {item.condition || 'Good'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openAssignModal(item.id)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Assign Item"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== ACTIVE ASSIGNMENTS TAB ===== */}
        {tab === 'assignments' && (
          <div className="overflow-x-auto">
            {activeAssignments.length === 0 ? (
              <div className="text-center py-20">
                <UserCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No active assignments</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Assigned</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{a.assigned_to_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-700">{a.inventory_items?.name}</div>
                        {a.notes && <div className="text-xs text-gray-400 italic">&quot;{a.notes}&quot;</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold">{a.quantity}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(a.assigned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleReturnItem(a)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-all border border-green-100 flex items-center gap-1.5 ml-auto"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          Confirm Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== HISTORY TAB ===== */}
        {tab === 'history' && (
          <div className="overflow-x-auto">
            {historyAssignments.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No history log yet</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Returned</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">{a.assigned_to_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{a.inventory_items?.name}</td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-500">{a.quantity}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(a.assigned_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {a.returned_at ? new Date(a.returned_at).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase tracking-wider">
                          Returned
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ===== ADD/EDIT ITEM MODAL ===== */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{editingItem ? 'Edit Asset' : 'Register New Asset'}</h3>
                <p className="text-xs text-gray-500">Enter details to track this item in inventory</p>
              </div>
              <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name *</label>
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  placeholder="e.g. Projector HD-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                <input
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  placeholder="e.g. Electronics"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                <input
                  value={itemForm.location}
                  onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  placeholder="e.g. Store Room A"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Level</label>
                <input
                  type="number"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Min Threshold</label>
                <input
                  type="number"
                  value={itemForm.min_stock}
                  onChange={(e) => setItemForm({ ...itemForm, min_stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Condition</label>
                <select
                  value={itemForm.condition}
                  onChange={(e) => setItemForm({ ...itemForm, condition: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                >
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Needs Repair</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Internal Notes</label>
                <textarea
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  rows={2}
                  placeholder="Serial numbers, purchase info, etc..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={saving || !itemForm.name.trim()}
                className="px-6 py-2 text-sm font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-md shadow-orange-100"
              >
                {saving ? 'Saving...' : editingItem ? 'Update Asset' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ASSIGN ITEM MODAL ===== */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Assign Asset</h3>
                <p className="text-xs text-gray-500">Enter the name of the person in charge of this item</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-orange-50 p-4 rounded-xl flex items-center gap-3 border border-orange-100">
                <Package className="w-8 h-8 text-orange-600" />
                <div>
                  <div className="text-xs text-orange-500 font-bold uppercase">Assigning Item</div>
                  <div className="text-sm font-bold text-orange-900">{items.find(i => i.id === assigningItemId)?.name}</div>
                  <div className="text-[10px] text-orange-600">Stock Available: {items.find(i => i.id === assigningItemId)?.quantity}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Assign To (Name) *</label>
                <input
                  value={assignForm.assigned_to_name}
                  onChange={(e) => setAssignForm({ ...assignForm, assigned_to_name: e.target.value })}
                  placeholder="Type name of staff or student..."
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Quantity to Assign</label>
                <input
                  type="number"
                  min={1}
                  value={assignForm.quantity}
                  onChange={(e) => setAssignForm({ ...assignForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Assignment Notes</label>
                <textarea
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  rows={2}
                  placeholder="e.g. For Use in Lab 3..."
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50/50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignItem}
                disabled={saving || !assignForm.assigned_to_name.trim()}
                className="px-6 py-2 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md shadow-purple-100 flex items-center gap-2"
              >
                {saving ? 'Assigning...' : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    Confirm Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
