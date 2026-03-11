'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import PartsSelector from './PartsSelector'

interface WorkOrderPart {
  id: string
  quantity: number
  serialNumberIds: string[]
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

interface WorkOrder {
  id: string
  description: string
  timeSpent: number | null
  createdAt: string
  createdBy: {
    id: string
    name: string
  }
  parts: WorkOrderPart[]
}

interface Technician {
  id: string
  name: string
  email: string
}

interface Intervention {
  id: string
  reference: string | null
  status: string
  breakdown: string
  scheduledDate: string | null
  scheduledTime: string | null
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
  } | null
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

  const [intervention, setIntervention] = useState<Intervention | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false)
  const [workOrderForm, setWorkOrderForm] = useState({ description: '', timeSpent: '' })
  const [workOrderLoading, setWorkOrderLoading] = useState(false)
  const [showPartsForWorkOrderId, setShowPartsForWorkOrderId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [showDateForm, setShowDateForm] = useState(false)
  const [dateFormData, setDateFormData] = useState({ scheduledDate: '', scheduledTime: '' })
  const [editData, setEditData] = useState({
    status: '',
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
      fetchWorkOrders()
      fetchTechnicians()
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

      const schedDate = data.scheduledDate ? new Date(data.scheduledDate).toISOString().split('T')[0] : ''
      setEditData({
        status: data.status,
        breakdown: data.breakdown || '',
        scheduledDate: schedDate,
        scheduledTime: data.scheduledTime || '',
      })
    } catch (error) {
      console.error('Error fetching intervention:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setWorkOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching work orders:', error)
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

  const createWorkOrder = async () => {
    if (!workOrderForm.description.trim()) return
    setWorkOrderLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/work-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: workOrderForm.description,
          timeSpent: workOrderForm.timeSpent ? parseFloat(workOrderForm.timeSpent) : null,
        }),
      })
      if (response.ok) {
        setShowWorkOrderForm(false)
        setWorkOrderForm({ description: '', timeSpent: '' })
        fetchWorkOrders()
      }
    } catch (error) {
      console.error('Error creating work order:', error)
    } finally {
      setWorkOrderLoading(false)
    }
  }

  const deleteWorkOrder = async (workOrderId: string) => {
    if (!confirm(t('workOrderDeleted') + '?')) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/interventions/${params.id}/work-orders/${workOrderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchWorkOrders()
    } catch (error) {
      console.error('Error deleting work order:', error)
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
          clientId: intervention?.client.id,
          assignedToId: intervention?.assignedTo?.id,
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

  const handleAssignTechnician = async () => {
    if (!assignTechId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignedToId: assignTechId,
          clientId: intervention?.client.id,
        }),
      })
      if (response.ok) {
        setShowAssignForm(false)
        setAssignTechId('')
        fetchIntervention()
      }
    } catch (error) {
      console.error('Error assigning technician:', error)
    }
  }

  const handleSetDate = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scheduledDate: dateFormData.scheduledDate || null,
          scheduledTime: dateFormData.scheduledTime || null,
          clientId: intervention?.client.id,
          assignedToId: intervention?.assignedTo?.id,
        }),
      })
      if (response.ok) {
        setShowDateForm(false)
        fetchIntervention()
      }
    } catch (error) {
      console.error('Error setting date:', error)
    }
  }

  const getMapsUrl = () => {
    const loc = intervention?.location
    const addressParts = loc
      ? [loc.name, loc.address, loc.city, loc.postalCode].filter(Boolean)
      : [intervention?.client.address, intervention?.client.city, intervention?.client.postalCode].filter(Boolean)
    const query = addressParts.join(', ')
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
  const mapsUrl = getMapsUrl()
  const totalHours = workOrders.reduce((s, wo) => s + (wo.timeSpent || 0), 0)
  const grandTotal = workOrders.flatMap(wo => wo.parts).reduce((s, p) => s + p.quantity * p.item.value, 0)

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
                  {intervention.scheduledDate && (
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      {t('scheduled')}: {new Date(intervention.scheduledDate).toLocaleDateString()} {intervention.scheduledTime}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
                    {t('details')}
                  </h1>
                  {intervention.reference && (
                    <span className="text-base font-mono text-gray-500">{intervention.reference}</span>
                  )}
                </div>
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
                    {(() => {
                      const canChangeTech = canEdit && (intervention.status === 'OPEN' || intervention.status === 'ASSIGNED')
                      return !showAssignForm ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          {intervention.assignedTo ? (
                            <span className="text-gray-900">{intervention.assignedTo.name}</span>
                          ) : (
                            <span className="text-gray-400 italic">{t('unassigned')}</span>
                          )}
                          {canChangeTech && (
                            <button
                              onClick={() => { setAssignTechId(intervention.assignedTo?.id || ''); setShowAssignForm(true) }}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {intervention.assignedTo ? tCommon('edit') : t('assignTechnician')}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            className="input text-gray-800 text-sm py-1"
                            value={assignTechId}
                            onChange={(e) => setAssignTechId(e.target.value)}
                          >
                            <option value="">{t('placeholdersSelectTechnician')}</option>
                            {technicians.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAssignTechnician}
                            disabled={!assignTechId}
                            className="btn btn-primary text-sm py-1 px-3"
                          >
                            {tCommon('save')}
                          </button>
                          <button
                            onClick={() => { setShowAssignForm(false); setAssignTechId('') }}
                            className="btn btn-secondary text-sm py-1 px-3"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">{t('fieldsScheduledDate')}:</span>
                    {!showDateForm ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        {intervention.scheduledDate ? (
                          <span className="text-gray-900">
                            {new Date(intervention.scheduledDate).toLocaleDateString()}{intervention.scheduledTime ? ` ${intervention.scheduledTime}` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">{t('notScheduled')}</span>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => {
                              const schedDate = intervention.scheduledDate ? new Date(intervention.scheduledDate).toISOString().split('T')[0] : ''
                              setDateFormData({ scheduledDate: schedDate, scheduledTime: intervention.scheduledTime || '' })
                              setShowDateForm(true)
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {intervention.scheduledDate ? tCommon('edit') : t('setDate')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="date"
                            className="input text-gray-800 text-sm py-1"
                            value={dateFormData.scheduledDate}
                            onChange={(e) => setDateFormData({ ...dateFormData, scheduledDate: e.target.value })}
                          />
                          <input
                            type="time"
                            className="input text-gray-800 text-sm py-1"
                            value={dateFormData.scheduledTime}
                            onChange={(e) => setDateFormData({ ...dateFormData, scheduledTime: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSetDate}
                            className="btn btn-primary text-sm py-1 px-3"
                          >
                            {tCommon('save')}
                          </button>
                          <button
                            onClick={() => setShowDateForm(false)}
                            className="btn btn-secondary text-sm py-1 px-3"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {intervention.createdBy && (
                    <div>
                      <span className="font-medium text-gray-600">{t('createdBy')}:</span>
                      <p className="text-gray-900">{intervention.createdBy.name}</p>
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
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-700 mb-2">{t('breakdownDescription')}</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{intervention.breakdown}</p>
            </div>
          </div>

          {/* Work Orders */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('workOrders')}</h2>
              {canEdit && (
                <button
                  onClick={() => setShowWorkOrderForm(true)}
                  className="btn btn-primary text-sm"
                >
                  {t('addWorkOrder')}
                </button>
              )}
            </div>

            {/* Inline create form */}
            {showWorkOrderForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                <h3 className="font-semibold text-gray-800">{t('newWorkOrder')}</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('workOrderDescription')}
                  </label>
                  <textarea
                    rows={4}
                    className="input text-gray-800"
                    value={workOrderForm.description}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, description: e.target.value })}
                    required
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
                    value={workOrderForm.timeSpent}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, timeSpent: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createWorkOrder}
                    disabled={workOrderLoading || !workOrderForm.description.trim()}
                    className="btn btn-primary text-sm"
                  >
                    {workOrderLoading ? tCommon('saving') : tCommon('save')}
                  </button>
                  <button
                    onClick={() => { setShowWorkOrderForm(false); setWorkOrderForm({ description: '', timeSpent: '' }) }}
                    className="btn btn-secondary text-sm"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            )}

            {workOrders.length === 0 && !showWorkOrderForm ? (
              <p className="text-gray-600">{t('noWorkOrders')}</p>
            ) : (
              <div className="space-y-4">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="border rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <div className="text-xs text-gray-500">
                        {new Date(wo.createdAt).toLocaleString()} — {wo.createdBy.name}
                        {wo.timeSpent ? <span> · {wo.timeSpent}h</span> : null}
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => deleteWorkOrder(wo.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          {tCommon('delete')}
                        </button>
                      )}
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap mb-3">{wo.description}</p>

                    {/* Parts for this work order */}
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('fieldsPartsUsed')}</span>
                        {canEdit && intervention.assignedTo && (
                          <button
                            onClick={() => setShowPartsForWorkOrderId(wo.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            {t('addParts')}
                          </button>
                        )}
                      </div>
                      {wo.parts.length === 0 ? (
                        <p className="text-xs text-gray-400">{t('noPartsInWorkOrder')}</p>
                      ) : (
                        <div className="space-y-2">
                          {wo.parts.map((part) => (
                            <div key={part.id} className="bg-gray-50 rounded px-3 py-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-900">{part.item.itemName}</span>
                                <span className="font-semibold text-green-900">€{(part.quantity * part.item.value).toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {t('unitValue')}: {part.quantity} · €{part.item.value.toFixed(2)}/unit
                              </div>
                              {part.item.tracksSerialNumbers && part.serialNumbers && part.serialNumbers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {part.serialNumbers.map((sn) => (
                                    <span key={sn.id} className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-xs font-mono">
                                      {sn.serialNumber}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="text-right text-sm font-semibold text-green-900">
                            {t('partTotal')}: €{wo.parts.reduce((s, p) => s + p.quantity * p.item.value, 0).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Grand total */}
                {workOrders.length > 0 && (
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">{t('totalHours')}: {totalHours}</span>
                    <span className="text-xl font-bold text-green-900">
                      {t('grandTotal')}: €{grandTotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
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

      {showPartsForWorkOrderId && intervention?.assignedTo && (
        <PartsSelector
          technicianId={intervention.assignedTo.id}
          interventionId={intervention.id}
          workOrderId={showPartsForWorkOrderId}
          onClose={() => setShowPartsForWorkOrderId(null)}
          onPartAdded={() => {
            fetchWorkOrders()
            setShowPartsForWorkOrderId(null)
          }}
        />
      )}
    </div>
  )
}
