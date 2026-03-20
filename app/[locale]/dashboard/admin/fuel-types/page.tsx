'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface FuelType { id: string; translations: { en: string; pt: string; es: string }; createdAt: string }

export default function AdminFuelTypesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [items, setItems] = useState<FuelType[]>([])
  const [form, setForm] = useState({ en: '', pt: '', es: '' })
  const [editing, setEditing] = useState<FuelType | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    fetch('/api/admin/fuel-types', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setItems)
  }, [])

  const save = async () => {
    if (!form.en.trim() && !form.pt.trim() && !form.es.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const translations = { en: form.en.trim(), pt: form.pt.trim(), es: form.es.trim() }
      if (editing) {
        const res = await fetch(`/api/admin/fuel-types/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ translations }),
        })
        if (res.ok) { const d = await res.json(); setItems(prev => prev.map(f => f.id === editing.id ? d : f)); setEditing(null); setForm({ en: '', pt: '', es: '' }) }
      } else {
        const res = await fetch('/api/admin/fuel-types', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ translations }),
        })
        if (res.ok) { const d = await res.json(); setItems(prev => [...prev, d]); setForm({ en: '', pt: '', es: '' }) }
      }
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this fuel type?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/admin/fuel-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setItems(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('fuelTypes')}</h1>
      </div>

      <div className="card max-w-2xl">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? t('editFuelType') : t('addFuelType')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('fuelTypeNameEn')}</label>
              <input className="input text-gray-800" placeholder="e.g. Diesel" value={form.en} onChange={e => setForm(f => ({ ...f, en: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('fuelTypeNamePt')}</label>
              <input className="input text-gray-800" placeholder="ex. Gasóleo" value={form.pt} onChange={e => setForm(f => ({ ...f, pt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('fuelTypeNameEs')}</label>
              <input className="input text-gray-800" placeholder="ej. Diésel" value={form.es} onChange={e => setForm(f => ({ ...f, es: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary text-sm" disabled={saving || (!form.en.trim() && !form.pt.trim() && !form.es.trim())} onClick={save}>
              {saving ? tCommon('saving') : editing ? tCommon('save') : t('addFuelType')}
            </button>
            {editing && <button className="btn btn-secondary text-sm" onClick={() => { setEditing(null); setForm({ en: '', pt: '', es: '' }) }}>{tCommon('cancel')}</button>}
          </div>
        </div>

        {items.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">{t('noFuelTypes')}</p> : (
          <div className="space-y-2">
            {items.map(ft => (
              <div key={ft.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2.5">
                <div className="flex gap-4 text-sm">
                  <span><span className="text-xs text-gray-400 mr-1">EN</span>{ft.translations.en || '—'}</span>
                  <span><span className="text-xs text-gray-400 mr-1">PT</span>{ft.translations.pt || '—'}</span>
                  <span><span className="text-xs text-gray-400 mr-1">ES</span>{ft.translations.es || '—'}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => { setEditing(ft); setForm({ en: ft.translations.en, pt: ft.translations.pt, es: ft.translations.es }) }}>{tCommon('edit')}</button>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => del(ft.id)}>{tCommon('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
