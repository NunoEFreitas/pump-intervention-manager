'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ClientSelector from './ClientSelector'

interface Client {
  id: string
  name: string
  city?: string | null
  clientType: 'PRIVATE' | 'COMPANY'
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
  const [clients, setClients] = useState<Client[]>([])
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
    workDone: '',
    timeSpent: '',
    description: '',
  })

  useEffect(() => {
    fetchClients()
    fetchTechnicians()
  }, [])

  // When clients are loaded and we have a preselected client, load that client's locations
  useEffect(() => {
    if (preSelectedClientId && clients.length > 0) {
      const client = clients.find((c) => c.id === preSelectedClientId)
      if (client) {
        setSelectedClient(client)
        if (client.clientType === 'COMPANY') {
          fetchLocations(client.id)
        }
      }
    }
  }, [clients, preSelectedClientId])

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

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

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId) || null
    setSelectedClient(client)
    setFormData({ ...formData, clientId, locationId: '' })
    setLocations([])
    if (client?.clientType === 'COMPANY') {
      fetchLocations(clientId)
    }
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
        body: JSON.stringify({
          ...formData,
          timeSpent: formData.timeSpent ? parseFloat(formData.timeSpent) : null,
        }),
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const isCompany = selectedClient?.clientType === 'COMPANY'

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
            {t('requiredFields')}
          </p>
        </div>

        <ClientSelector
          clients={clients}
          value={formData.clientId}
          onChange={handleClientChange}
          label={t('fieldsClient')}
          required
        />

        {/* Location dropdown — only for company clients */}
        {isCompany && (
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
            {t('fieldsAssignedTo')} *
          </label>
          <select
            name="assignedToId"
            className="input text-gray-800"
            value={formData.assignedToId}
            onChange={handleChange}
            required
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
              {t('fieldsScheduledDate')} *
            </label>
            <input
              type="date"
              name="scheduledDate"
              className="input text-gray-800"
              value={formData.scheduledDate}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsScheduledTime')} *
            </label>
            <input
              type="time"
              name="scheduledTime"
              className="input text-gray-800"
              value={formData.scheduledTime}
              onChange={handleChange}
              required
            />
          </div>
        </div>

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

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('optionalDetails')}</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fieldsWorkDone')}
              </label>
              <input
                type="text"
                name="workDone"
                className="input text-gray-800"
                placeholder={t('placeholdersWorkDone')}
                value={formData.workDone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fieldsTimeSpent')}
              </label>
              <input
                type="number"
                step="0.5"
                name="timeSpent"
                className="input text-gray-800"
                placeholder={t('placeholdersTimeSpent')}
                value={formData.timeSpent}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fieldsDescription')}
              </label>
              <textarea
                name="description"
                rows={4}
                className="input text-gray-800"
                placeholder={t('placeholdersDescription')}
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('partsTrackingNote')}
          </p>
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
