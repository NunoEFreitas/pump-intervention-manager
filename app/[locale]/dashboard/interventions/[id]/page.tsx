'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import PartsSelector from './PartsSelector'

interface InterventionPart {
  id: string
  quantity: number
  item: {
    id: string
    itemName: string
    partNumber: string
    value: number
    tracksSerialNumbers: boolean
  }
  serialNumbers?: Array<{
    id: string
    serialNumber: string
  }>
}

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  breakdown: string
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    address: string | null
    city: string | null
    postalCode: string | null
    phone: string | null
  }
  location: {
    id: string
    name: string
    address: string | null
    city: string | null
    postalCode: string | null
    equipment: Array<{
      id: string
      model: string
      equipmentType: { name: string }
      brand: { name: string }
    }>
  } | null
  assignedTo: {
    id: string
    name: string
    email: string
  }
  createdBy: {
    id: string
    name: string
    email: string
  } | null
}

export default function InterventionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')
  const tClients = useTranslations('clients')
  const tWarehouse = useTranslations('warehouse')

  const [intervention, setIntervention] = useState<Intervention | null>(null)
  const [parts, setParts] = useState<InterventionPart[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showPartsSelector, setShowPartsSelector] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [editData, setEditData] = useState({
    status: '',
    workDone: '',
    timeSpent: '',
    description: '',
    breakdown: '',
    scheduledDate: '',
    scheduledTime: '',
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserRole(user.role)
    }

    if (params.id) {
      fetchIntervention()
      fetchParts()
    }
  }, [params.id])

  const fetchIntervention = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()

      if (response.status === 403) {
        router.push(`/${locale}/dashboard/interventions`)
        return
      }

      setIntervention(data)

      const schedDate = new Date(data.scheduledDate).toISOString().split('T')[0]
      setEditData({
        status: data.status,
        workDone: data.workDone || '',
        timeSpent: data.timeSpent?.toString() || '',
        description: data.description || '',
        breakdown: data.breakdown || '',
        scheduledDate: schedDate,
        scheduledTime: data.scheduledTime,
      })
    } catch (error) {
      console.error('Error fetching intervention:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchParts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/parts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setParts(data)
    } catch (error) {
      console.error('Error fetching parts:', error)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editData,
          timeSpent: editData.timeSpent ? parseFloat(editData.timeSpent) : null,
          clientId: intervention?.client.id,
          assignedToId: intervention?.assignedTo.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to update intervention')
        return
      }

      setIsEditing(false)
      fetchIntervention()
    } catch (error) {
      console.error('Error updating intervention:', error)
    }
  }

  // Build a Google Maps navigation URL from location or client address
  const getMapsUrl = () => {
    const loc = intervention?.location
    const parts = loc
      ? [loc.name, loc.address, loc.city, loc.postalCode].filter(Boolean)
      : [intervention?.client.address, intervention?.client.city, intervention?.client.postalCode].filter(Boolean)
    const query = parts.join(', ')
    if (!query) return null
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  if (!intervention) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">{t('noInterventions')}</p>
      </div>
    )
  }

  const canEdit = canEditIntervention(userRole as any, intervention.status as any)
  const availableStatuses = getAvailableStatuses(userRole as any, intervention.status as any)
  const totalPartsValue = parts.reduce((sum, part) => sum + (part.quantity * part.item.value), 0)
  const mapsUrl = getMapsUrl()

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/interventions`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          {tNav('backToInterventions')}
        </button>
      </div>

      {!isEditing ? (
        <>
          <div className="card mb-6">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-sm px-3 py-1 rounded-full whitespace-nowrap ${getStatusColor(intervention.status as any)}`}>
                    {getStatusLabel(intervention.status as any)}
                  </span>
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {t('scheduled')}: {new Date(intervention.scheduledDate).toLocaleDateString()} {intervention.scheduledTime}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
                  {intervention.workDone || t('details')}
                </h1>
              </div>
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-secondary shrink-0"
                >
                  {tCommon('edit')}
                </button>
              )}
            </div>

            {(intervention.status === 'COMPLETED' || intervention.status === 'CANCELED') && userRole !== 'ADMIN' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  {t('locked', { status: intervention.status.toLowerCase() })}
                </p>
              </div>
            )}

            {/* Client + Work details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Client info */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">{t('clientInfo')}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">{tCommon('name')}:</span>
                    <p className="text-gray-900">{intervention.client.name}</p>
                  </div>
                  {intervention.client.city && (
                    <div>
                      <span className="font-medium text-gray-600">{tClients('city')}:</span>
                      <p className="text-gray-900">{intervention.client.city}</p>
                    </div>
                  )}
                  {intervention.client.phone && (
                    <div>
                      <span className="font-medium text-gray-600">{tClients('phone')}:</span>
                      <p className="text-gray-900">
                        <a href={`tel:${intervention.client.phone}`} className="text-blue-600">
                          {intervention.client.phone}
                        </a>
                      </p>
                    </div>
                  )}
                  {intervention.location && (
                    <div>
                      <span className="font-medium text-gray-600">{t('fieldsLocation')}:</span>
                      <p className="text-purple-700 font-medium">
                        {intervention.location.name}{intervention.location.city ? ` — ${intervention.location.city}` : ''}
                      </p>
                    </div>
                  )}
                  {intervention.location && intervention.location.equipment.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-600">{tClients('equipment')}:</span>
                      <div className="mt-1 space-y-0.5">
                        {intervention.location.equipment.map((eq) => (
                          <p key={eq.id} className="text-gray-800 text-xs">
                            <span className="font-medium">{eq.equipmentType.name}</span>
                            {' — '}{eq.brand.name} {eq.model}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => router.push(`/${locale}/dashboard/clients/${intervention.client.id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {t('viewClientDetails')}
                    </button>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('navigateTo')}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Work details */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">{t('workDetails')}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">{t('assignedTechnician')}:</span>
                    <p className="text-gray-900">{intervention.assignedTo.name}</p>
                  </div>
                  {intervention.createdBy && (
                    <div>
                      <span className="font-medium text-gray-600">{t('createdBy')}:</span>
                      <p className="text-gray-900">{intervention.createdBy.name}</p>
                    </div>
                  )}
                  {intervention.timeSpent && (
                    <div>
                      <span className="font-medium text-gray-600">{t('fieldsTimeSpent')}:</span>
                      <p className="text-gray-900">{intervention.timeSpent} {tCommon('hours')}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-600">{t('created')}:</span>
                    <p className="text-gray-900">{new Date(intervention.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">{t('lastUpdated')}:</span>
                    <p className="text-gray-900">{new Date(intervention.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">{t('breakdownDescription')}</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{intervention.breakdown}</p>
            </div>

            {/* Additional notes */}
            {intervention.description && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-2">{t('additionalNotes')}</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{intervention.description}</p>
              </div>
            )}
          </div>

          {/* Parts Used */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('fieldsPartsUsed')}</h2>
              {canEdit && (
                <button
                  onClick={() => setShowPartsSelector(true)}
                  className="btn btn-primary text-sm"
                >
                  {t('addParts')}
                </button>
              )}
            </div>

            {parts.length === 0 ? (
              <p className="text-gray-600">{t('noPartsUsed')}</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {parts.map((part) => (
                    <div key={part.id} className="p-4 bg-gray-50 rounded-lg border">
                      <h4 className="font-semibold text-gray-900 mb-1">{part.item.itemName}</h4>
                      <p className="text-sm text-gray-600 mb-2">{tWarehouse('partNumber')}: {part.item.partNumber}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span>
                          {tWarehouse('quantity')}: <span className="font-semibold text-gray-900">{part.quantity}</span>
                        </span>
                        <span>
                          {t('unitValue')}: <span className="font-semibold text-gray-900">€{part.item.value.toFixed(2)}</span>
                        </span>
                        <span>
                          {t('partTotal')}: <span className="font-semibold text-green-900">€{(part.quantity * part.item.value).toFixed(2)}</span>
                        </span>
                      </div>
                      {part.item.tracksSerialNumbers && part.serialNumbers && part.serialNumbers.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">{t('serialNumbers')}:</p>
                          <div className="flex flex-wrap gap-1">
                            {part.serialNumbers.map((sn) => (
                              <span
                                key={sn.id}
                                className="px-2 py-1 bg-purple-100 text-purple-900 rounded text-xs font-mono"
                              >
                                {sn.serialNumber}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">{t('totalPartsValue')}:</span>
                    <span className="text-xl font-bold text-green-900">€{totalPartsValue.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleUpdate} className="card space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('editTitle')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsStatus')}
            </label>
            <select
              className="input text-gray-800"
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
            >
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
            {userRole === 'TECHNICIAN' && (
              <p className="text-xs text-gray-500 mt-1">{t('technicianNote')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fieldsScheduledDate')}
              </label>
              <input
                type="date"
                className="input text-gray-800"
                value={editData.scheduledDate}
                onChange={(e) => setEditData({ ...editData, scheduledDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fieldsScheduledTime')}
              </label>
              <input
                type="time"
                className="input text-gray-800"
                value={editData.scheduledTime}
                onChange={(e) => setEditData({ ...editData, scheduledTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsBreakdown')}
            </label>
            <textarea
              rows={3}
              className="input text-gray-800"
              value={editData.breakdown}
              onChange={(e) => setEditData({ ...editData, breakdown: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsWorkDone')}
            </label>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.workDone}
              onChange={(e) => setEditData({ ...editData, workDone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fieldsTimeSpent')}
            </label>
            <input
              type="number"
              step="0.5"
              className="input text-gray-800"
              value={editData.timeSpent}
              onChange={(e) => setEditData({ ...editData, timeSpent: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('additionalNotes')}
            </label>
            <textarea
              rows={4}
              className="input text-gray-800"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary flex-1">
              {t('saveButton')}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      )}

      {showPartsSelector && intervention && (
        <PartsSelector
          technicianId={intervention.assignedTo.id}
          interventionId={intervention.id}
          onClose={() => setShowPartsSelector(false)}
          onPartAdded={() => {
            fetchParts()
            setShowPartsSelector(false)
          }}
        />
      )}
    </div>
  )
}
