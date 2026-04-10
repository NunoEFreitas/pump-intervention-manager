'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocationSelector from '@/components/LocationSelector'
import { validateVAT } from '@/lib/vat-validation'
import { getDistrictByCity, getCities } from '@/lib/location-data'

interface LocationDraft {
  id: string
  name: string
  country: string
  district: string
  address: string
  city: string
  postalCode: string
  phone: string
  contactPerson: string
  notes: string
  ovmRegulatorId: string
}

interface OvmRegulator { id: string; name: string }

const emptyLocation = (): LocationDraft => ({
  id: crypto.randomUUID(),
  name: '',
  country: '',
  district: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  contactPerson: '',
  notes: '',
  ovmRegulatorId: '',
})

export default function NewClientPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viesLoading, setViesLoading] = useState(false)
  const [viesResult, setViesResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    vatNumber: '',
    country: '',
    district: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    contactPerson: '',
    notes: '',
  })

  const [locations, setLocations] = useState<LocationDraft[]>([emptyLocation()])
  const [expandedLocationId, setExpandedLocationId] = useState<string | null>(locations[0].id)
  const [ovmRegulators, setOvmRegulators] = useState<OvmRegulator[]>([])

  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tClients = useTranslations('clients')


  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/admin/ovm-regulators', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setOvmRegulators).catch(() => {})
  }, [])

  const vatError = validateVAT(formData.vatNumber, formData.country)

  const lookupVies = async () => {
    if (!formData.vatNumber.trim() || !formData.country) {
      setViesResult({ ok: false, msg: 'Preencha o país e o NIF antes de consultar.' })
      return
    }
    setViesLoading(true)
    setViesResult(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `/api/vies?country=${encodeURIComponent(formData.country)}&vat=${encodeURIComponent(formData.vatNumber.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) {
        setViesResult({ ok: false, msg: data.error ?? 'Erro ao consultar VIES' })
        return
      }
      if (!data.isValid || (!data.name && !data.address)) {
        setViesResult({ ok: false, msg: 'NIF não encontrado ou não registado no VIES para operações intracomunitárias.' })
        return
      }
      // Parse address into separate fields
      const updates: Partial<typeof formData> = {}
      if (data.name && !formData.name.trim()) updates.name = data.name
      if (data.address) {
        const lines = (data.address as string).split('\n').map((l: string) => l.trim()).filter(Boolean)
        if (lines[0]) updates.address = lines[0]
        // Find line with postal code pattern NNNN-NNN
        const postalRegex = /(\d{4}-\d{3})\s+(.+)/
        for (const line of lines.slice(1)) {
          const m = line.match(postalRegex)
          if (m) {
            updates.postalCode = m[1]
            updates.city = m[2].trim()
            break
          }
        }
        // Fallback: city from "Area - City" on line 2
        if (!updates.city && lines[1]) {
          const parts = lines[1].split(' - ')
          updates.city = parts[parts.length - 1].trim()
        }
        // Derive district from city and resolve exact city name casing from GEO_DATA
        if (updates.city && formData.country) {
          const district = getDistrictByCity(formData.country, updates.city)
          if (district) {
            updates.district = district
            // Replace city with the exact casing from GEO_DATA so the select matches
            const canonical = getCities(formData.country, district)
              .find(c => c.toLowerCase() === updates.city!.toLowerCase())
            if (canonical) updates.city = canonical
          }
        }
      }
      if (Object.keys(updates).length) setFormData(prev => ({ ...prev, ...updates }))
      setViesResult({ ok: true, msg: `NIF válido${data.name ? ` — ${data.name}` : ''}` })
    } catch {
      setViesResult({ ok: false, msg: 'Erro de ligação ao serviço VIES.' })
    } finally {
      setViesLoading(false)
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (vatError) return

    const validLocations = locations.filter(l => l.name.trim())

    setLoading(true)

    try {
      const token = localStorage.getItem('token')

      // Create client
      const clientRes = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (clientRes.status === 409) {
        const dup = await clientRes.json()
        setError(`duplicate_vat:${dup.existingId}:${dup.existingReference}:${dup.existingName}`)
        setLoading(false)
        return
      }
      if (!clientRes.ok) throw new Error('Failed to create client')
      const client = await clientRes.json()

      // Create each location
      for (const loc of validLocations) {
        await fetch(`/api/clients/${client.id}/locations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: loc.name.trim(),
            country: loc.country || null,
            district: loc.district || null,
            address: loc.address || null,
            city: loc.city || null,
            postalCode: loc.postalCode || null,
            phone: loc.phone || null,
            contactPerson: loc.contactPerson || null,
            notes: loc.notes || null,
            ovmRegulatorId: loc.ovmRegulatorId || null,
          }),
        })
      }

      router.push(`/${locale}/clients/${client.id}`)
    } catch {
      setError('Failed to create client. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleLocationChange = (id: string, field: keyof LocationDraft, value: string) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const addLocation = () => {
    const loc = emptyLocation()
    setLocations(prev => [...prev, loc])
    setExpandedLocationId(loc.id)
  }

  const removeLocation = (id: string) => {
    setLocations(prev => {
      const next = prev.filter(l => l.id !== id)
      if (expandedLocationId === id) setExpandedLocationId(next[next.length - 1]?.id ?? null)
      return next
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tClients('addClient')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tClients('createClient')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
        {/* Client fields */}
        <div className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('clientName')} *</label>
              <input type="text" name="name" className="input text-gray-800" value={formData.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('vatNumber')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="vatNumber"
                  className={`input text-gray-800 flex-1 ${vatError && formData.vatNumber ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={formData.vatNumber}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={lookupVies}
                  disabled={viesLoading || !formData.vatNumber.trim() || !formData.country}
                  title="Consultar VIES (base de dados EU de NIF empresariais)"
                  className="shrink-0 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {viesLoading ? '…' : 'VIES'}
                </button>
              </div>
              {vatError && formData.vatNumber && <p className="text-xs text-red-600 mt-1">{vatError}</p>}
              {error.startsWith('duplicate_vat:') && (() => {
                const [, id, ref, ...nameParts] = error.split(':')
                const name = nameParts.join(':')
                return (
                  <p className="text-xs text-amber-800 mt-1">
                    ⚠ Já existe um cliente com este NIF:{' '}
                    <a href={`/${locale}/clients/${id}`} className="font-semibold underline hover:text-amber-900">
                      {ref} — {name}
                    </a>
                  </p>
                )
              })()}
              {viesResult && (
                <p className={`text-xs mt-1 ${viesResult.ok ? 'text-green-700' : 'text-amber-700'}`}>
                  {viesResult.ok ? '✓' : '⚠'} {viesResult.msg}
                </p>
              )}
            </div>
          </div>

          <LocationSelector
            country={formData.country}
            district={formData.district}
            city={formData.city}
            onCountryChange={(v) => setFormData({ ...formData, country: v, district: '', city: '' })}
            onDistrictChange={(v) => setFormData({ ...formData, district: v, city: '' })}
            onCityChange={(v) => setFormData({ ...formData, city: v })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('address')}</label>
              <input type="text" name="address" className="input text-gray-800" value={formData.address} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('postalCode')}</label>
              <input type="text" name="postalCode" className="input text-gray-800" value={formData.postalCode} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('phone')}</label>
              <input type="tel" name="phone" className="input text-gray-800" value={formData.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAuth('email')}</label>
              <input type="email" name="email" className="input text-gray-800" value={formData.email} onChange={handleChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('contactPerson')}</label>
              <input type="text" name="contactPerson" className="input text-gray-800" value={formData.contactPerson} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tClients('notes')}</label>
              <textarea name="notes" rows={2} className="input text-gray-800" value={formData.notes} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Locations section */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {tClients('locations')}
            </h2>
            <button
              type="button"
              onClick={addLocation}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {tClients('addLocation')}
            </button>
          </div>

          {locations.map((loc, index) => (
            <div key={loc.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                onClick={() => setExpandedLocationId(expandedLocationId === loc.id ? null : loc.id)}
              >
                <span className="font-medium text-gray-800">
                  {loc.name.trim() || `${tClients('location')} ${index + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  {locations.length > 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeLocation(loc.id) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeLocation(loc.id) } }}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                    >
                      {tCommon('delete')}
                    </span>
                  )}
                  <span className="text-gray-400">{expandedLocationId === loc.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedLocationId === loc.id && (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tClients('locationName')} *
                    </label>
                    <input
                      type="text"
                      className="input text-gray-800"
                      value={loc.name}
                      onChange={e => handleLocationChange(loc.id, 'name', e.target.value)}
                      placeholder={tClients('locationName')}
                    />
                  </div>

                  <LocationSelector
                    country={loc.country}
                    district={loc.district}
                    city={loc.city}
                    labelSize="xs"
                    onCountryChange={(v) => {
                      handleLocationChange(loc.id, 'country', v)
                      handleLocationChange(loc.id, 'district', '')
                      handleLocationChange(loc.id, 'city', '')
                    }}
                    onDistrictChange={(v) => {
                      handleLocationChange(loc.id, 'district', v)
                      handleLocationChange(loc.id, 'city', '')
                    }}
                    onCityChange={(v) => handleLocationChange(loc.id, 'city', v)}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tClients('address')}
                    </label>
                    <input
                      type="text"
                      className="input text-gray-800"
                      value={loc.address}
                      onChange={e => handleLocationChange(loc.id, 'address', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tClients('postalCode')}
                    </label>
                    <input
                      type="text"
                      className="input text-gray-800"
                      value={loc.postalCode}
                      onChange={e => handleLocationChange(loc.id, 'postalCode', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tClients('phone')}
                      </label>
                      <input
                        type="tel"
                        className="input text-gray-800"
                        value={loc.phone}
                        onChange={e => handleLocationChange(loc.id, 'phone', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tClients('contactPerson')}
                      </label>
                      <input
                        type="text"
                        className="input text-gray-800"
                        value={loc.contactPerson}
                        onChange={e => handleLocationChange(loc.id, 'contactPerson', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tClients('notes')}
                    </label>
                    <textarea
                      rows={2}
                      className="input text-gray-800"
                      value={loc.notes}
                      onChange={e => handleLocationChange(loc.id, 'notes', e.target.value)}
                    />
                  </div>

                  {ovmRegulators.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        OVM Regulator
                      </label>
                      <select
                        className="input text-gray-800"
                        value={loc.ovmRegulatorId}
                        onChange={e => handleLocationChange(loc.id, 'ovmRegulatorId', e.target.value)}
                      >
                        <option value="">— none —</option>
                        {ovmRegulators.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {error && !error.startsWith('duplicate_vat:') && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>
          )}
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={loading || !!vatError}>
              {loading ? tCommon('creating') : tClients('createButton')}
            </button>
            <button type="button" onClick={() => router.back()} className="btn btn-secondary" disabled={loading}>
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
