'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Package, Plus, Trash2, X, AlertTriangle, Search } from 'lucide-react'
import { InventoryItem } from '@/types/database'

export default function AdminInventoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    min_stock: 0,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!loading) loadItems()
  }, [loading])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') { setLoading(false); return }
    } catch {
      // auth check failed
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name')

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error loading inventory:', error)
    }
  }

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        alert('Item name is required')
        return
      }

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            name: formData.name,
            category: formData.category || null,
            quantity: formData.quantity,
            min_stock: formData.min_stock,
          })
          .eq('id', editingItem.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('inventory_items').insert({
          name: formData.name,
          category: formData.category || null,
          quantity: formData.quantity,
          min_stock: formData.min_stock,
        })

        if (error) throw error
      }

      setShowModal(false)
      setEditingItem(null)
      setFormData({ name: '', category: '', quantity: 0, min_stock: 0 })
      loadItems()
    } catch (error: any) {
      alert(error.message || 'Error saving item')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (error) throw error
      loadItems()
    } catch (error: any) {
      alert(error.message || 'Error deleting item')
    }
  }

  const handleUpdateQuantity = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta)
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty })
        .eq('id', item.id)

      if (error) throw error
      loadItems()
    } catch (error: any) {
      alert(error.message || 'Error updating quantity')
    }
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category || '',
      quantity: item.quantity,
      min_stock: item.min_stock,
    })
    setShowModal(true)
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStockCount = items.filter((i) => i.quantity <= i.min_stock).length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Package className="w-10 h-10 text-orange-600" />
          <h2 className="text-3xl font-bold text-gray-900">Inventory</h2>
        </div>
        <button
          onClick={() => {
            setEditingItem(null)
            setFormData({ name: '', category: '', quantity: 0, min_stock: 0 })
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Set(items.map((i) => i.category).filter(Boolean)).size}
          </p>
        </div>
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${lowStockCount > 0 ? 'border-red-500' : 'border-green-500'}`}>
          <p className="text-sm text-gray-600">Low Stock Items</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {search ? 'No items match your search.' : 'No inventory items. Click "Add Item" to get started.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_stock
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{item.category || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium text-gray-900 w-10 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{item.min_stock}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-green-600">In Stock</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-blue-600 hover:text-blue-800 mr-3 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{editingItem ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Item name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Furniture, Stationery, Electronics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                {editingItem ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
