'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  Settings as SettingsIcon, Save, Bell, Shield, Database, Check, Download, Upload,
  Building2, Image, FileText, Calendar, DollarSign, Phone, MapPin, Sparkles, X, CheckCircle
} from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const CLASS_LEVELS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']

  const [settings, setSettings] = useState({
    schoolName: '',
    schoolAddress: '',
    schoolMotto: '',
    schoolPhone: '',
    schoolLogo: '',
    nextTermBegins: '',
    nextTermFees: '',
    fees_JSS1: '',
    fees_JSS2: '',
    fees_JSS3: '',
    fees_SS1: '',
    fees_SS2: '',
    fees_SS3: '',
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

      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings) {
        setSettings({
          schoolName: data.settings.schoolName || '',
          schoolAddress: data.settings.schoolAddress || '',
          schoolMotto: data.settings.schoolMotto || '',
          schoolPhone: data.settings.schoolPhone || '',
          schoolLogo: data.settings.schoolLogo || '',
          nextTermBegins: data.settings.nextTermBegins || '',
          nextTermFees: data.settings.nextTermFees || '',
          fees_JSS1: data.settings.fees_JSS1 || '',
          fees_JSS2: data.settings.fees_JSS2 || '',
          fees_JSS3: data.settings.fees_JSS3 || '',
          fees_SS1: data.settings.fees_SS1 || '',
          fees_SS2: data.settings.fees_SS2 || '',
          fees_SS3: data.settings.fees_SS3 || '',
          emailNotifications: data.settings.emailNotifications !== 'false',
          autoEnrollment: data.settings.autoEnrollment === 'true',
          requireParentApproval: data.settings.requireParentApproval !== 'false',
        })
        if (data.settings.schoolLogo) setLogoPreview(data.settings.schoolLogo)
      }
    } catch {
      // failed to load
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return }
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return }

    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `school/logo_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl
      setSettings(s => ({ ...s, schoolLogo: publicUrl }))
      setLogoPreview(publicUrl)
      setSaved(false)
    } catch (e: any) {
      alert(e.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleRemoveLogo = () => {
    setSettings(s => ({ ...s, schoolLogo: '' }))
    setLogoPreview(null)
    setSaved(false)
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
            schoolAddress: settings.schoolAddress,
            schoolMotto: settings.schoolMotto,
            schoolPhone: settings.schoolPhone,
            schoolLogo: settings.schoolLogo,
            nextTermBegins: settings.nextTermBegins,
            nextTermFees: settings.nextTermFees,
            fees_JSS1: settings.fees_JSS1,
            fees_JSS2: settings.fees_JSS2,
            fees_JSS3: settings.fees_JSS3,
            fees_SS1: settings.fees_SS1,
            fees_SS2: settings.fees_SS2,
            fees_SS3: settings.fees_SS3,
            emailNotifications: String(settings.emailNotifications),
            autoEnrollment: String(settings.autoEnrollment),
            requireParentApproval: String(settings.requireParentApproval),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Failed to save settings'); return }
      // Cache logo in localStorage for loading screens
      try {
        if (settings.schoolLogo) localStorage.setItem('schoolLogo', settings.schoolLogo)
        else localStorage.removeItem('schoolLogo')
      } catch {}
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch {
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, value: any) => {
    setSettings(s => ({ ...s, [key]: value }))
    setSaved(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Manage your school profile and system preferences</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all shadow-md ${
            saved
              ? 'bg-emerald-600 text-white'
              : saving
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
          }`}
        >
          {saved ? <><CheckCircle className="w-5 h-5" /> Saved!</> : <><Save className="w-5 h-5" /> {saving ? 'Saving...' : 'Save All Settings'}</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Profile */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">School Profile</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">This information appears on report cards and across all modules</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">School Name *</label>
              <input
                type="text"
                value={settings.schoolName}
                onChange={(e) => update('schoolName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                placeholder="e.g. Greenfield International Academy"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />Address
              </label>
              <input
                type="text"
                value={settings.schoolAddress}
                onChange={(e) => update('schoolAddress', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="e.g. P.M.B. 001, Main Street, Lagos, Nigeria"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />Motto
                </label>
                <input
                  type="text"
                  value={settings.schoolMotto}
                  onChange={(e) => update('schoolMotto', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="e.g. Excellence in Education"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />Phone
                </label>
                <input
                  type="text"
                  value={settings.schoolPhone}
                  onChange={(e) => update('schoolPhone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="e.g. +234 800 000 0000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* School Logo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">School Logo</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">Displayed on report cards and module headers (max 2MB)</p>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {logoPreview ? (
                  <div className="relative group">
                    <img
                      src={logoPreview}
                      alt="School Logo"
                      className="w-28 h-28 rounded-xl object-contain border-2 border-gray-200 bg-gray-50 p-1"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                    <Image className="w-8 h-8 mb-1" />
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer transition-all font-medium text-sm ${
                  uploadingLogo ? 'bg-gray-200 text-gray-500' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}>
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Uploading...' : logoPreview ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleLogoUpload(f)
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-2">PNG, JPG, or SVG. Recommended: square, at least 200x200px</p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Card Defaults */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Report Card Defaults</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">Auto-filled on all student report cards</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />Next Term Begins
              </label>
              <input
                type="date"
                value={settings.nextTermBegins}
                onChange={(e) => update('nextTermBegins', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">This date will appear on all report cards as &quot;Next Term Begins&quot;</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 inline mr-1" />Default School Fees (Fallback)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">NGN</span>
                <input
                  type="text"
                  value={settings.nextTermFees}
                  onChange={(e) => update('nextTermFees', e.target.value)}
                  className="w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="e.g. 150,000"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Used when no class-level fee is set below</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-3.5 h-3.5 inline mr-1" />Fees by Class Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CLASS_LEVELS.map((level) => (
                  <div key={level} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 w-10">{level}</span>
                    <input
                      type="text"
                      value={(settings as any)[`fees_${level}`] || ''}
                      onChange={(e) => update(`fees_${level}`, e.target.value)}
                      className="w-full pl-14 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="e.g. 150,000"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Each student&apos;s report card will show the fee for their class level</p>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">System Preferences</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">Notification and enrollment settings</p>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => update('emailNotifications', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Email Notifications</span>
                <p className="text-xs text-gray-400">Send email alerts for important events</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={settings.autoEnrollment}
                onChange={(e) => update('autoEnrollment', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-enroll students</span>
                <p className="text-xs text-gray-400">Automatically enroll new students in default classes</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={settings.requireParentApproval}
                onChange={(e) => update('requireParentApproval', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Require parent approval</span>
                <p className="text-xs text-gray-400">Parents must approve before enrollment is finalized</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Backup & Restore</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">Download or restore school data (user accounts excluded)</p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/admin/backup/download"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Download Backup
            </a>
            <a
              href="/api/admin/backup/full-download"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Full Backup
            </a>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm font-medium transition-colors">
              <Upload className="w-4 h-4" />
              <span>Restore From File</span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    const text = await f.text()
                    const json = JSON.parse(text)
                    const endpoint = json?.users ? '/api/admin/backup/full-restore' : '/api/admin/backup/restore'
                    const res = await fetch(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(json),
                    })
                    const out = await res.json()
                    if (!res.ok) { alert(out.error || 'Restore failed'); return }
                    alert('Restore completed')
                  } catch (err: any) {
                    alert(err?.message || 'Invalid file')
                  } finally {
                    e.currentTarget.value = ''
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
