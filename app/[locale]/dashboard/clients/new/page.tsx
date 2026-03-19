'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocationSelector from '@/components/LocationSelector'
import { validateVAT } from '@/lib/vat-validation'

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
  const tNav = useTranslations('nav')

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/admin/ovm-regulators', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setOvmRegulators).catch(() => {})
  }, [])

  const vatError = validateVAT(formData.vatNumber, formData.country)

  const handleSubmit = async (e: React.FormEvent) => {
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

      router.push(`/${locale}/dashboard/clients/${client.id}`)
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          {tNav('back')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tClients('addClient')}</h1>
        <p className="text-gray-600">{tClients('createClient')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client fields */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('clientName')} *
            </label>
            <input
              type="text"
              name="name"
              className="input text-gray-800"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('vatNumber')}
            </label>
            <input
              type="text"
              name="vatNumber"
              className={`input text-gray-800 ${vatError && formData.vatNumber ? 'border-red-400 focus:ring-red-400' : ''}`}
              value={formData.vatNumber}
              onChange={handleChange}
            />
            {vatError && formData.vatNumber && (
              <p className="text-xs text-red-600 mt-1">{vatError}</p>
            )}
          </div>

          <LocationSelector
            country={formData.country}
            district={formData.district}
            city={formData.city}
            onCountryChange={(v) => setFormData({ ...formData, country: v, district: '', city: '' })}
            onDistrictChange={(v) => setFormData({ ...formData, district: v, city: '' })}
            onCityChange={(v) => setFormData({ ...formData, city: v })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('address')}
            </label>
            <input
              type="text"
              name="address"
              className="input text-gray-800"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('postalCode')}
            </label>
            <input
              type="text"
              name="postalCode"
              className="input text-gray-800"
              value={formData.postalCode}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tClients('phone')}
              </label>
              <input
                type="tel"
                name="phone"
                className="input text-gray-800"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAuth('email')}
              </label>
              <input
                type="email"
                name="email"
                className="input text-gray-800"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('contactPerson')}
            </label>
            <input
              type="text"
              name="contactPerson"
              className="input text-gray-800"
              value={formData.contactPerson}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('notes')}
            </label>
            <textarea
              name="notes"
              rows={3}
              className="input text-gray-800"
              value={formData.notes}
              onChange={handleChange}
            />
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

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading || !!vatError}
          >
            {loading ? tCommon('creating') : tClients('createButton')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            disabled={loading}
          >
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
