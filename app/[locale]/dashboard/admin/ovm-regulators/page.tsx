'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface OvmRegulator { id: string; name: string; createdAt: string }

export default function AdminOvmRegulatorsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [items, setItems] = useState<OvmRegulator[]>([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<OvmRegulator | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    fetch('/api/admin/ovm-regulators', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setItems)
  }, [])

  const save = async () => {
    const name = editing ? editing.name : newName
    if (!name.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (editing) {
        const res = await fetch(`/api/admin/ovm-regulators/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name }),
        })
        if (res.ok) { const d = await res.json(); setItems(prev => prev.map(r => r.id === editing.id ? { ...r, name: d.name } : r)); setEditing(null) }
      } else {
        const res = await fetch('/api/admin/ovm-regulators', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name }),
        })
        if (res.ok) { const d = await res.json(); setItems(prev => [...prev, d]); setNewName('') }
      }
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const token = localStorage.getItem('token')
    await fetch(`/api/admin/ovm-regulators/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setItems(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('ovmRegulators')}</h1>
      </div>

      <div className="card max-w-lg">
        <div className="flex gap-2 mb-6">
          <input type="text" className="input text-gray-800 flex-1" placeholder={t('ovmRegulatorName')}
            value={editing ? editing.name : newName}
            onChange={e => editing ? setEditing({ ...editing, name: e.target.value }) : setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(null); setNewName('') } }} />
          <button className="btn btn-primary text-sm" disabled={saving || !(editing ? editing.name.trim() : newName.trim())} onClick={save}>
            {saving ? tCommon('saving') : editing ? tCommon('save') : t('addOvmRegulator')}
          </button>
          {editing && <button className="btn btn-secondary text-sm" onClick={() => setEditing(null)}>{tCommon('cancel')}</button>}
        </div>

        {items.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">{t('noOvmRegulators')}</p> : (
          <div className="space-y-2">
            {items.map(r => (
              <div key={r.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2.5">
                <span className="text-sm text-gray-900">{r.name}</span>
                <div className="flex gap-3">
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => { setEditing(r); setNewName('') }}>{tCommon('edit')}</button>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => del(r.id)}>{tCommon('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
