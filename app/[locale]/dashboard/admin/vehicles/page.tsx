'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface CompanyVehicle { id: string; plateNumber: string; brand: string | null; model: string | null; description: string | null }

export default function AdminVehiclesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [newPlate, setNewPlate] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editing, setEditing] = useState<CompanyVehicle | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    fetch('/api/admin/vehicles', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setVehicles)
  }, [])

  const save = async () => {
    const plate = editing ? editing.plateNumber : newPlate
    if (!plate.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const url = editing ? `/api/admin/vehicles/${editing.id}` : '/api/admin/vehicles'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plateNumber: editing ? editing.plateNumber : newPlate, brand: editing ? editing.brand : newBrand, model: editing ? editing.model : newModel, description: editing ? editing.description : newDesc }),
      })
      if (res.ok) {
        setNewPlate(''); setNewBrand(''); setNewModel(''); setNewDesc(''); setEditing(null)
        const data = await fetch('/api/admin/vehicles', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        setVehicles(data)
      } else { const d = await res.json(); alert(d.error || 'Failed to save') }
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/admin/vehicles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setVehicles(prev => prev.filter(v => v.id !== id))
    else { const d = await res.json(); alert(d.error) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('vehicles')}</h1>
      </div>

      <div className="card">
        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
          <h3 className="font-medium text-gray-700">{editing ? tCommon('edit') : t('addVehicle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" className="input text-gray-800 font-mono uppercase" placeholder={t('vehiclePlatePlaceholder')}
              value={editing ? editing.plateNumber : newPlate}
              onChange={e => editing ? setEditing({ ...editing, plateNumber: e.target.value.toUpperCase() }) : setNewPlate(e.target.value.toUpperCase())} />
            <input type="text" className="input text-gray-800" placeholder={t('vehicleBrandPlaceholder')}
              value={editing ? (editing.brand || '') : newBrand}
              onChange={e => editing ? setEditing({ ...editing, brand: e.target.value }) : setNewBrand(e.target.value)} />
            <input type="text" className="input text-gray-800" placeholder={t('vehicleModelPlaceholder')}
              value={editing ? (editing.model || '') : newModel}
              onChange={e => editing ? setEditing({ ...editing, model: e.target.value }) : setNewModel(e.target.value)} />
            <input type="text" className="input text-gray-800" placeholder={t('vehicleDescPlaceholder')}
              value={editing ? (editing.description || '') : newDesc}
              onChange={e => editing ? setEditing({ ...editing, description: e.target.value }) : setNewDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn btn-primary text-sm">
              {saving ? tCommon('saving') : editing ? tCommon('save') : t('addVehicle')}
            </button>
            {editing && <button onClick={() => setEditing(null)} className="btn btn-secondary text-sm">{tCommon('cancel')}</button>}
          </div>
        </div>

        {vehicles.length === 0 ? <p className="text-gray-500 text-sm">{t('noVehicles')}</p> : (
          <div className="space-y-2">
            {vehicles.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-mono font-semibold text-gray-900">{v.plateNumber}</span>
                  {(v.brand || v.model) && <span className="ml-3 text-sm text-gray-700">{[v.brand, v.model].filter(Boolean).join(' ')}</span>}
                  {v.description && <span className="ml-3 text-sm text-gray-500">{v.description}</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(v)} className="text-blue-600 hover:text-blue-800 text-sm">{tCommon('edit')}</button>
                  <button onClick={() => del(v.id)} className="text-red-600 hover:text-red-800 text-sm">{tCommon('delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
