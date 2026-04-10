'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface EquipmentType { id: string; name: string }

export default function AdminEquipmentTypesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [items, setItems] = useState<EquipmentType[]>([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<EquipmentType | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    fetch('/api/admin/equipment-types', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setItems)
  }, [])

  const save = async () => {
    const name = editing ? editing.name : newName
    if (!name.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const url = editing ? `/api/admin/equipment-types/${editing.id}` : '/api/admin/equipment-types'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        if (editing) setItems(prev => prev.map(i => i.id === editing.id ? data : i))
        else setItems(prev => [...prev, data])
        setNewName(''); setEditing(null)
      } else { const d = await res.json(); alert(d.error || 'Failed to save') }
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/admin/equipment-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    else { const d = await res.json(); alert(d.error) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('equipmentTypes')}</h1>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('equipmentTypes')}</h2>
          <button onClick={() => setNewName(' ')} className="btn btn-primary text-sm">{t('addType')}</button>
        </div>

        {newName !== '' && !editing && (
          <div className="flex gap-2 mb-4">
            <input type="text" className="input text-gray-800 flex-1" placeholder={t('typeName')} value={newName.trim() === '' ? '' : newName} autoFocus
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setNewName('') }} />
            <button onClick={save} disabled={saving || !newName.trim()} className="btn btn-primary text-sm">{saving ? tCommon('saving') : tCommon('save')}</button>
            <button onClick={() => setNewName('')} className="btn btn-secondary text-sm">{tCommon('cancel')}</button>
          </div>
        )}

        {items.length === 0 ? <p className="text-gray-500 text-sm py-2">{t('noTypes')}</p> : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-3 border rounded-lg">
                {editing?.id === item.id ? (
                  <>
                    <input type="text" className="input text-gray-800 flex-1 py-1" value={editing.name} autoFocus
                      onChange={e => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(null) }} />
                    <button onClick={save} disabled={saving} className="btn btn-primary text-sm py-1">{saving ? tCommon('saving') : tCommon('save')}</button>
                    <button onClick={() => setEditing(null)} className="btn btn-secondary text-sm py-1">{tCommon('cancel')}</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                    <button onClick={() => { setEditing(item); setNewName('') }} className="text-blue-600 hover:text-blue-800 text-sm">{tCommon('edit')}</button>
                    <button onClick={() => del(item.id)} className="text-red-600 hover:text-red-800 text-sm">{tCommon('delete')}</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
