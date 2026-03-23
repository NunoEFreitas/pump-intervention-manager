'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ClientSelector from './ClientSelector'

interface Client {
  id: string
  name: string
  city?: string | null
}

interface CompanyLocation {
  id: string
  name: string
  city: string | null
}

interface Technician {
  id: string
  name: string
  email: string
}

// 1. Logic moved to a sub-component
function NewInterventionContent() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const searchParams = useSearchParams()
  const preSelectedClientId = searchParams.get('clientId')

  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locations, setLocations] = useState<CompanyLocation[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    clientId: preSelectedClientId || '',
    locationId: '',
    assignedToId: '',
    scheduledDate: '',
    scheduledTime: '',
    breakdown: '',
    bill: false,
    contract: false,
    warranty: false,
  })

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/technicians', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setTechnicians(data)
    } catch (error) {
      console.error('Error fetching technicians:', error)
    }
  }

  const fetchLocations = async (clientId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/clients/${clientId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setLocations(data)
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleClientChange = (clientId: string, client: Client | null) => {
    setSelectedClient(client)
    setFormData({ ...formData, clientId, locationId: '' })
    setLocations([])
    if (clientId) fetchLocations(clientId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create intervention')
      }

      router.push(`/${locale}/dashboard/interventions`)
    } catch (err: any) {
      setError(err.message || 'Failed to create intervention. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('createTitle')}</h1>
        <p className="text-gray-600">{t('createSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            {t('requiredFieldsNew')}
          </p>
        </div>

        <ClientSelector
          value={formData.clientId}
          onChange={handleClientChange}
          label={t('fieldsClient')}
          required
        />

        {/* Location dropdown */}
        {selectedClient && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsLocation')} *
            </label>
            <select
              name="locationId"
              className="input text-gray-800"
              value={formData.locationId}
              onChange={handleChange}
              required
            >
              <option value="">{t('placeholdersSelectLocation')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                </option>
              ))}
            </select>
            {locations.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {t('noLocationsWarning')}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('fieldsBreakdown')} *
          </label>
          <textarea
            name="breakdown"
            rows={3}
            className="input text-gray-800"
            placeholder={t('placeholdersBreakdown')}
            value={formData.breakdown}
            onChange={handleChange}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{t('breakdownHint')}</p>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="bill" checked={formData.bill} onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{t('bill')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="contract" checked={formData.contract} onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{t('contract')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="warranty" checked={formData.warranty} onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{t('warranty')}</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('fieldsAssignedTo')}
          </label>
          <select
            name="assignedToId"
            className="input text-gray-800"
            value={formData.assignedToId}
            onChange={handleChange}
          >
            <option value="">{t('placeholdersSelectTechnician')}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name} ({tech.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsScheduledDate')}
            </label>
            <input
              type="date"
              name="scheduledDate"
              className="input text-gray-800"
              value={formData.scheduledDate}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsScheduledTime')}
            </label>
            <input
              type="time"
              name="scheduledTime"
              className="input text-gray-800"
              value={formData.scheduledTime}
              onChange={handleChange}
            />
          </div>
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
            disabled={loading}
          >
            {loading ? tCommon('creating') : t('createButton')}
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

// 2. Exported page with Suspense wrapper
export default function NewInterventionPage() {
  const tCommon = useTranslations('common')

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-600">{tCommon('loading')}</div>}>
      <NewInterventionContent />
    </Suspense>
  )
}
