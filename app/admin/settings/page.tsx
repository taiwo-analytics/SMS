'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Settings, Save, Bell, Shield, Database, Check } from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    schoolName: 'School Management System',
    emailNotifications: true,
    autoEnrollment: false,
    requireParentApproval: true,
  })

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') { setLoading(false); return }

      // Load settings from API
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings) {
        setSettings({
          schoolName: data.settings.schoolName || 'School Management System',
          emailNotifications: data.settings.emailNotifications !== 'false',
          autoEnrollment: data.settings.autoEnrollment === 'true',
          requireParentApproval: data.settings.requireParentApproval !== 'false',
        })
      }
    } catch {
      // failed to load
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            schoolName: settings.schoolName,
            emailNotifications: String(settings.emailNotifications),
            autoEnrollment: String(settings.autoEnrollment),
            requireParentApproval: String(settings.requireParentApproval),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to save settings')
        return
      }

      setSaved(true)
    } catch {
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Settings className="w-10 h-10 text-gray-600" />
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
      </div>

      <div className="space-y-6">
        {/* School Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold">School Information</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Name
              </label>
              <input
                type="text"
                value={settings.schoolName}
                onChange={(e) => { setSettings({ ...settings, schoolName: e.target.value }); setSaved(false) }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-6 h-6 text-yellow-600" />
            <h3 className="text-xl font-semibold">Notification Settings</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => { setSettings({ ...settings, emailNotifications: e.target.checked }); setSaved(false) }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Enable Email Notifications</span>
            </label>
          </div>
        </div>

        {/* Enrollment Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-semibold">Enrollment Settings</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoEnrollment}
                onChange={(e) => { setSettings({ ...settings, autoEnrollment: e.target.checked }); setSaved(false) }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Auto-enroll students in default classes</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireParentApproval}
                onChange={(e) => { setSettings({ ...settings, requireParentApproval: e.target.checked }); setSaved(false) }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Require parent approval for enrollment</span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4 justify-end">
          {saved && (
            <span className="text-green-600 font-medium flex items-center gap-1">
              <Check className="w-5 h-5" />
              Settings saved successfully
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
