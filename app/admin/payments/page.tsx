"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { CreditCard, Plus, X } from "lucide-react"

export default function AdminPaymentsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ student_id: "", amount: "", status: "paid", description: "" })
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)

  useEffect(() => {
    const sid = searchParams.get("student_id")
    setActiveStudentId(sid || null)
  }, [searchParams])

  useEffect(() => {
    ;(async () => {
      await loadPayments(activeStudentId)
      setLoading(false)
    })()
  }, [activeStudentId])

  const loadPayments = async (studentId?: string | null) => {
    try {
      let query = supabase.from("payments").select("*").order("created_at", { ascending: false })
      if (studentId) {
        query = query.eq("student_id", studentId)
      }
      const { data, error } = await query
      if (error) throw error
      setPayments(data || [])
    } catch (e) {
      console.error(e)
      setPayments([])
    }
  }

  const handleCreate = async () => {
    try {
      const amount = parseFloat(form.amount)
      if (isNaN(amount)) throw new Error("Invalid amount")
      const { error } = await supabase.from("payments").insert({
        student_id: form.student_id || null,
        amount,
        status: form.status || null,
        description: form.description || null
      })
      if (error) throw error
      setShowModal(false)
      setForm({ student_id: "", amount: "", status: "paid", description: "" })
      await loadPayments(activeStudentId)
    } catch (e: any) {
      alert(e.message || "Failed to create payment")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payment?")) return
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id)
      if (error) throw error
      await loadPayments(activeStudentId)
    } catch (e: any) {
      alert(e.message || "Failed to delete")
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <CreditCard className="w-10 h-10 text-indigo-600" />
          <h2 className="text-3xl font-bold">Payments</h2>
        </div>
        <div className="flex items-center gap-2">
          {activeStudentId ? (
            <div className="text-xs text-gray-600 px-2 py-1 border rounded">
              Filtering by student: <span className="font-mono">{activeStudentId}</span>
              <button
                onClick={() => router.push("/admin/payments")}
                className="ml-2 text-indigo-600 hover:underline"
                title="Clear filter"
              >
                Clear
              </button>
            </div>
          ) : null}
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg">
            <Plus className="w-5 h-5" />
            Add Payment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.student_id || '—'}</td>
                <td className="px-3 py-2">{p.amount}</td>
                <td className="px-3 py-2">
                  {p.status ? (
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      /paid|success|completed/i.test(p.status) ? 'bg-green-100 text-green-700' :
                      /pending|processing/i.test(p.status) ? 'bg-yellow-100 text-yellow-700' :
                      /failed|unpaid|overdue/i.test(p.status) ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{p.status}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">{p.description || '—'}</td>
                <td className="px-3 py-2">{new Date(p.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => handleDelete(p.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add Payment</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID (optional)</label>
                <input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="paid">paid</option>
                  <option value="pending">pending</option>
                  <option value="unpaid">unpaid</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
