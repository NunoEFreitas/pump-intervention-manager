'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import PartsSelector from './PartsSelector'

interface ClientPart {
  id: string
  serialNumber: string
  itemId: string
  itemName: string
  partNumber: string
  createdAt: string
  location: string
  pickedUpByName: string | null
  usedAt: string | null
  usedByName: string | null
}

interface WorkOrderPart {
  id: string
  quantity: number
  serialNumberIds: string[]
  createdAt: string
  usedByName: string | null
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
  reference: string | null
  description: string
  timeSpent: number | null
  km: number | null
  locationEquipmentId: string | null
  interventionType: string | null
  transportGuide: string | null
  startDate: string | null
  startTime: string | null
  endDate: string | null
  endTime: string | null
  fromAddress: string | null
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
  bill: boolean
  contract: boolean
  warranty: boolean
  internal: boolean
  scheduledDate: string | null
  scheduledTime: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    vatNumber: string | null
    country: string | null
    district: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    phone: string | null
  }
  location: {
    id: string
    name: string
    country: string | null
    district: string | null
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
    plateNumber: string | null
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
  const [workOrderForm, setWorkOrderForm] = useState({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '' })
  const [workOrderLoading, setWorkOrderLoading] = useState(false)
  const [showPartsForWorkOrderId, setShowPartsForWorkOrderId] = useState<string | null>(null)
  const [showWarehousePartsForWOId, setShowWarehousePartsForWOId] = useState<string | null>(null)
  const [warehousePartItemId, setWarehousePartItemId] = useState('')
  const [warehousePartQty, setWarehousePartQty] = useState('1')
  const [warehousePartLoading, setWarehousePartLoading] = useState(false)
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<string | null>(null)
  const [editWorkOrderForm, setEditWorkOrderForm] = useState({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '' })
  const [editWorkOrderLoading, setEditWorkOrderLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [statusChanging, setStatusChanging] = useState(false)
  const [showDateForm, setShowDateForm] = useState(false)
  const [dateFormData, setDateFormData] = useState({ scheduledDate: '', scheduledTime: '' })
  const [clientParts, setClientParts] = useState<ClientPart[]>([])
  const [showClientPartForm, setShowClientPartForm] = useState(false)
  const [clientPartItemId, setClientPartItemId] = useState('')
  const [clientPartLoading, setClientPartLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<{ id: string; itemName: string; partNumber: string }[]>([])
  const [itemSelectorOpen, setItemSelectorOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const itemSelectorRef = useRef<HTMLDivElement>(null)
  const [whItemSelectorOpen, setWhItemSelectorOpen] = useState(false)
  const [whItemSearch, setWhItemSearch] = useState('')
  const whItemSelectorRef = useRef<HTMLDivElement>(null)
  const [editData, setEditData] = useState({
    status: '',
    breakdown: '',
    scheduledDate: '',
    scheduledTime: '',
    bill: false,
    contract: false,
    warranty: false,
    internal: false,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemSelectorRef.current && !itemSelectorRef.current.contains(e.target as Node)) {
        setItemSelectorOpen(false)
      }
      if (whItemSelectorRef.current && !whItemSelectorRef.current.contains(e.target as Node)) {
        setWhItemSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
      fetchClientParts()
      fetchWarehouseItems()
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
        bill: data.bill ?? false,
        contract: data.contract ?? false,
        warranty: data.warranty ?? false,
        internal: data.internal ?? false,
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

  const fetchClientParts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/client-parts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClientParts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching client parts:', error)
    }
  }

  const fetchWarehouseItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setWarehouseItems(
        Array.isArray(data)
          ? data.map((i: any) => ({ id: i.id, itemName: i.itemName, partNumber: i.partNumber }))
          : []
      )
    } catch (error) {
      console.error('Error fetching warehouse items:', error)
    }
  }

  const addClientPart = async () => {
    if (!clientPartItemId) return
    setClientPartLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/client-parts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ warehouseItemId: clientPartItemId }),
      })
      if (response.ok) {
        setShowClientPartForm(false)
        setClientPartItemId('')
        fetchClientParts()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add client part')
      }
    } catch (error) {
      console.error('Error adding client part:', error)
    } finally {
      setClientPartLoading(false)
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
          km: workOrderForm.km ? parseFloat(workOrderForm.km) : null,
          fromAddress: workOrderForm.fromAddress || null,
          equipmentId: workOrderForm.equipmentId || null,
          interventionType: workOrderForm.interventionType || null,
          transportGuide: workOrderForm.transportGuide || null,
          startDate: workOrderForm.startDate || null,
          startTime: workOrderForm.startTime || null,
          endDate: workOrderForm.endDate || null,
          endTime: workOrderForm.endTime || null,
        }),
      })
      if (response.ok) {
        setShowWorkOrderForm(false)
        setWorkOrderForm({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '' })
        fetchWorkOrders()
      }
    } catch (error) {
      console.error('Error creating work order:', error)
    } finally {
      setWorkOrderLoading(false)
    }
  }

  const startEditWorkOrder = (wo: WorkOrder) => {
    setEditingWorkOrderId(wo.id)
    setEditWorkOrderForm({
      description: wo.description,
      timeSpent: wo.timeSpent != null ? String(wo.timeSpent) : '',
      km: wo.km != null ? String(wo.km) : '',
      fromAddress: wo.fromAddress || '',
      equipmentId: wo.locationEquipmentId || '',
      interventionType: wo.interventionType || '',
      transportGuide: wo.transportGuide || '',
      startDate: wo.startDate || '',
      startTime: wo.startTime || '',
      endDate: wo.endDate || '',
      endTime: wo.endTime || '',
    })
  }

  const updateWorkOrder = async (workOrderId: string) => {
    if (!editWorkOrderForm.description.trim()) return
    setEditWorkOrderLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/work-orders/${workOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          description: editWorkOrderForm.description,
          timeSpent: editWorkOrderForm.timeSpent ? parseFloat(editWorkOrderForm.timeSpent) : null,
          km: editWorkOrderForm.km ? parseFloat(editWorkOrderForm.km) : null,
          fromAddress: editWorkOrderForm.fromAddress || null,
          equipmentId: editWorkOrderForm.equipmentId || null,
          interventionType: editWorkOrderForm.interventionType || null,
          transportGuide: editWorkOrderForm.transportGuide || null,
          startDate: editWorkOrderForm.startDate || null,
          startTime: editWorkOrderForm.startTime || null,
          endDate: editWorkOrderForm.endDate || null,
          endTime: editWorkOrderForm.endTime || null,
        }),
      })
      if (response.ok) {
        setEditingWorkOrderId(null)
        fetchWorkOrders()
      }
    } catch (error) {
      console.error('Error updating work order:', error)
    } finally {
      setEditWorkOrderLoading(false)
    }
  }

  const addWarehousePart = async (workOrderId: string) => {
    if (!warehousePartItemId || !warehousePartQty) return
    setWarehousePartLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/work-orders/${workOrderId}/warehouse-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId: warehousePartItemId, quantity: parseInt(warehousePartQty) }),
      })
      if (response.ok) {
        setShowWarehousePartsForWOId(null)
        setWarehousePartItemId('')
        setWarehousePartQty('1')
        fetchWorkOrders()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add part')
      }
    } catch (error) {
      console.error('Error adding warehouse part:', error)
    } finally {
      setWarehousePartLoading(false)
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

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!intervention || newStatus === intervention.status) return
    setStatusChanging(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status: newStatus,
          clientId: intervention.client.id,
          assignedToId: intervention.assignedTo?.id,
          breakdown: intervention.breakdown,
          scheduledDate: intervention.scheduledDate,
          scheduledTime: intervention.scheduledTime,
        }),
      })
      if (response.ok) fetchIntervention()
      else {
        const data = await response.json()
        alert(data.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setStatusChanging(false)
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
  const availableStatuses = getAvailableStatuses(userRole as any, intervention.status as any, !!intervention.assignedTo)
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
                  {canEdit && availableStatuses.length > 1 ? (
                    <select
                      className={`text-sm px-3 py-1 rounded-full border-0 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 disabled:opacity-60 ${getStatusColor(intervention.status as any)}`}
                      value={intervention.status}
                      disabled={statusChanging}
                      onChange={(e) => handleQuickStatusChange(e.target.value)}
                    >
                      {availableStatuses.map(s => (
                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-sm px-3 py-1 rounded-full whitespace-nowrap ${getStatusColor(intervention.status as any)}`}>
                      {getStatusLabel(intervention.status as any)}
                    </span>
                  )}
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
                  {intervention.client.vatNumber && (
                    <div>
                      <span className="font-medium text-gray-600">{tClients('vatNumber')}:</span>
                      <p className="text-gray-900">{intervention.client.vatNumber}</p>
                    </div>
                  )}
                  {(intervention.client.country || intervention.client.district || intervention.client.city) && (
                    <div>
                      <span className="font-medium text-gray-600">{tClients('country')}:</span>
                      <p className="text-gray-900">
                        {[intervention.client.country, intervention.client.district, intervention.client.city].filter(Boolean).join(' › ')}
                      </p>
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
                      {(intervention.location.country || intervention.location.district) && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {[intervention.location.country, intervention.location.district].filter(Boolean).join(' › ')}
                        </p>
                      )}
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
                            <span className="text-gray-900">
                              {intervention.assignedTo.name}
                              {intervention.assignedTo.plateNumber && (
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                                  {intervention.assignedTo.plateNumber}
                                </span>
                              )}
                            </span>
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

            {/* Flags */}
            <div className="border-t pt-4 flex flex-wrap gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${intervention.bill ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {intervention.bill ? '✓' : '✗'} {t('bill')}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${intervention.contract ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {intervention.contract ? '✓' : '✗'} {t('contract')}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${intervention.warranty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {intervention.warranty ? '✓' : '✗'} {t('warranty')}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${intervention.internal ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                {intervention.internal ? t('internal') : t('external')}
              </span>
            </div>
          </div>

          {/* Client Parts */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('clientParts')}</h2>
              {canEdit && intervention.assignedTo && (
                <button
                  onClick={() => setShowClientPartForm(true)}
                  className="btn btn-primary text-sm"
                >
                  {t('addClientPart')}
                </button>
              )}
            </div>

            {showClientPartForm && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-3">
                <h3 className="font-semibold text-gray-800">{t('logClientPart')}</h3>
                <p className="text-sm text-amber-700">{t('logClientPartHint')}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('selectWarehouseItem')}
                  </label>
                  <div ref={itemSelectorRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setItemSelectorOpen((o) => !o)}
                      className="input text-gray-800 w-full text-left flex items-center justify-between"
                    >
                      <span className={clientPartItemId ? 'text-gray-800' : 'text-gray-400'}>
                        {clientPartItemId
                          ? (() => {
                              const found = warehouseItems.find((i) => i.id === clientPartItemId)
                              return found ? `${found.itemName} (${found.partNumber})` : t('selectWarehouseItemPlaceholder')
                            })()
                          : t('selectWarehouseItemPlaceholder')}
                      </span>
                      <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {itemSelectorOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                        <div className="p-2 border-b border-gray-200">
                          <input
                            type="text"
                            autoFocus
                            placeholder={tCommon('search')}
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <ul className="overflow-y-auto" style={{ maxHeight: '13rem' }}>
                          {warehouseItems
                            .filter((item) =>
                              `${item.itemName} ${item.partNumber}`.toLowerCase().includes(itemSearch.toLowerCase())
                            )
                            .map((item) => (
                              <li
                                key={item.id}
                                onMouseDown={() => {
                                  setClientPartItemId(item.id)
                                  setItemSelectorOpen(false)
                                  setItemSearch('')
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                                  clientPartItemId === item.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'
                                }`}
                              >
                                {item.itemName} ({item.partNumber})
                              </li>
                            ))}
                          {warehouseItems.filter((item) =>
                            `${item.itemName} ${item.partNumber}`.toLowerCase().includes(itemSearch.toLowerCase())
                          ).length === 0 && (
                            <li className="px-3 py-2 text-sm text-gray-400">{tCommon('noResults')}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addClientPart}
                    disabled={clientPartLoading || !clientPartItemId}
                    className="btn btn-primary text-sm"
                  >
                    {clientPartLoading ? tCommon('saving') : tCommon('save')}
                  </button>
                  <button
                    onClick={() => { setShowClientPartForm(false); setClientPartItemId('') }}
                    className="btn btn-secondary text-sm"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            )}

            {clientParts.length === 0 && !showClientPartForm ? (
              <p className="text-gray-600">{t('noClientParts')}</p>
            ) : (
              <div className="space-y-2">
                {clientParts.map((part) => (
                  <div
                    key={part.id}
                    className={`border rounded-lg px-4 py-3 ${part.location === 'USED' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide shrink-0 ${part.location === 'USED' ? 'bg-green-200 text-green-900' : 'bg-amber-300 text-amber-900'}`}>
                        {t('clientPartBadge')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{part.itemName}</p>
                        <p className="text-xs text-gray-500">{part.partNumber}</p>
                      </div>
                      <span className="font-mono text-sm text-gray-700 bg-white border border-gray-200 rounded px-2 py-0.5 shrink-0">
                        {part.serialNumber}
                      </span>
                    </div>
                    <div className={`mt-1.5 text-xs ${part.location === 'USED' ? 'text-green-700' : 'text-amber-700'}`}>
                      <span>{t('clientPartPickedUp')}: {new Date(part.createdAt).toLocaleString()}{part.pickedUpByName && ` — ${part.pickedUpByName}`}</span>
                    </div>
                    {part.location === 'USED' && part.usedAt && (
                      <div className="mt-0.5 text-xs text-green-700 font-medium">
                        {t('clientPartReturned')}: {new Date(part.usedAt).toLocaleString()}{part.usedByName && ` — ${part.usedByName}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')}</label>
                    <input type="date" className="input text-gray-800" value={workOrderForm.startDate} onChange={(e) => setWorkOrderForm({ ...workOrderForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('startTime')}</label>
                    <input type="time" className="input text-gray-800" value={workOrderForm.startTime} onChange={(e) => setWorkOrderForm({ ...workOrderForm, startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDate')}</label>
                    <input type="date" className="input text-gray-800" value={workOrderForm.endDate} onChange={(e) => setWorkOrderForm({ ...workOrderForm, endDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('endTime')}</label>
                    <input type="time" className="input text-gray-800" value={workOrderForm.endTime} onChange={(e) => setWorkOrderForm({ ...workOrderForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('fieldsKm')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="input text-gray-800"
                      placeholder="0"
                      value={workOrderForm.km}
                      onChange={(e) => setWorkOrderForm({ ...workOrderForm, km: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fieldsFromAddress')}
                  </label>
                  <input
                    type="text"
                    className="input text-gray-800"
                    placeholder={t('fieldsFromAddressPlaceholder')}
                    value={workOrderForm.fromAddress}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, fromAddress: e.target.value })}
                  />
                </div>
                {intervention.location && intervention.location.equipment.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('workOrderEquipment')}
                    </label>
                    <select
                      className="input text-gray-800"
                      value={workOrderForm.equipmentId}
                      onChange={(e) => setWorkOrderForm({ ...workOrderForm, equipmentId: e.target.value })}
                    >
                      <option value="">{t('workOrderEquipmentPlaceholder')}</option>
                      {intervention.location.equipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.equipmentType.name} — {eq.brand.name} {eq.model}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('workOrderInterventionType')}
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {(['ELECTRONIC', 'HYDRAULIC', 'OTHERS'] as const).map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workOrderForm.interventionType === type}
                          onChange={() => setWorkOrderForm({
                            ...workOrderForm,
                            interventionType: workOrderForm.interventionType === type ? '' : type,
                          })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{t(`type${type.charAt(0) + type.slice(1).toLowerCase()}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('transportGuide')}
                  </label>
                  <input
                    type="text"
                    className="input text-gray-800"
                    placeholder={t('transportGuidePlaceholder')}
                    value={workOrderForm.transportGuide}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, transportGuide: e.target.value })}
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
                    onClick={() => { setShowWorkOrderForm(false); setWorkOrderForm({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '' }) }}
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
                    {editingWorkOrderId === wo.id ? (
                      /* ── Inline Edit Form ── */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('workOrderDescription')}</label>
                          <textarea rows={3} className="input text-gray-800" value={editWorkOrderForm.description} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, description: e.target.value })} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')}</label>
                            <input type="date" className="input text-gray-800" value={editWorkOrderForm.startDate} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, startDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('startTime')}</label>
                            <input type="time" className="input text-gray-800" value={editWorkOrderForm.startTime} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, startTime: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDate')}</label>
                            <input type="date" className="input text-gray-800" value={editWorkOrderForm.endDate} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, endDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('endTime')}</label>
                            <input type="time" className="input text-gray-800" value={editWorkOrderForm.endTime} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, endTime: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsTimeSpent')}</label>
                            <input type="number" step="0.5" className="input text-gray-800" value={editWorkOrderForm.timeSpent} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, timeSpent: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsKm')}</label>
                            <input type="number" step="0.1" min="0" className="input text-gray-800" value={editWorkOrderForm.km} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, km: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsFromAddress')}</label>
                          <input type="text" className="input text-gray-800" placeholder={t('fieldsFromAddressPlaceholder')} value={editWorkOrderForm.fromAddress} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, fromAddress: e.target.value })} />
                        </div>
                        {intervention.location && intervention.location.equipment.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('workOrderEquipment')}</label>
                            <select className="input text-gray-800" value={editWorkOrderForm.equipmentId} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, equipmentId: e.target.value })}>
                              <option value="">{t('workOrderEquipmentPlaceholder')}</option>
                              {intervention.location.equipment.map((eq) => (
                                <option key={eq.id} value={eq.id}>{eq.equipmentType.name} — {eq.brand.name} {eq.model}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('workOrderInterventionType')}</label>
                          <div className="flex flex-wrap gap-4">
                            {(['ELECTRONIC', 'HYDRAULIC', 'OTHERS'] as const).map((type) => (
                              <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={editWorkOrderForm.interventionType === type} onChange={() => setEditWorkOrderForm({ ...editWorkOrderForm, interventionType: editWorkOrderForm.interventionType === type ? '' : type })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">{t(`type${type.charAt(0) + type.slice(1).toLowerCase()}`)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('transportGuide')}</label>
                          <input type="text" className="input text-gray-800" value={editWorkOrderForm.transportGuide} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, transportGuide: e.target.value })} />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => updateWorkOrder(wo.id)} disabled={editWorkOrderLoading || !editWorkOrderForm.description.trim()} className="btn btn-primary text-sm">
                            {editWorkOrderLoading ? tCommon('saving') : tCommon('save')}
                          </button>
                          <button onClick={() => setEditingWorkOrderId(null)} className="btn btn-secondary text-sm">{tCommon('cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read View ── */
                      <>
                        <div className="flex justify-between mb-2">
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {wo.reference && (
                              <div className="font-mono font-semibold text-gray-700 text-sm">{wo.reference}</div>
                            )}
                            <div>
                              {new Date(wo.createdAt).toLocaleString()} — {wo.createdBy.name}
                              {wo.timeSpent ? <span> · {wo.timeSpent}h</span> : null}
                              {wo.km ? <span> · {wo.km} km{wo.fromAddress ? ` (${wo.fromAddress})` : ''}</span> : (wo.fromAddress ? <span> · {wo.fromAddress}</span> : null)}
                            </div>
                            {(wo.startDate || wo.endDate) && (
                              <div className="flex gap-3">
                                {wo.startDate && <span>▶ {wo.startDate}{wo.startTime ? ` ${wo.startTime}` : ''}</span>}
                                {wo.endDate && <span>■ {wo.endDate}{wo.endTime ? ` ${wo.endTime}` : ''}</span>}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-3 shrink-0">
                              <button onClick={() => startEditWorkOrder(wo)} className="text-blue-600 hover:text-blue-800 text-xs">{tCommon('edit')}</button>
                              <button onClick={() => deleteWorkOrder(wo.id)} className="text-red-600 hover:text-red-800 text-xs">{tCommon('delete')}</button>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-900 whitespace-pre-wrap mb-3">{wo.description}</p>

                        {(wo.locationEquipmentId || wo.interventionType || wo.transportGuide) && (
                          <div className="flex flex-wrap gap-2 mb-3 text-xs">
                            {wo.locationEquipmentId && (() => {
                              const eq = intervention.location?.equipment.find((e) => e.id === wo.locationEquipmentId)
                              return eq ? (
                                <span className="px-2 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded">
                                  {eq.equipmentType.name} — {eq.brand.name} {eq.model}
                                </span>
                              ) : null
                            })()}
                            {wo.interventionType && (
                              <span className="px-2 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded font-medium">
                                {t(`type${wo.interventionType.charAt(0) + wo.interventionType.slice(1).toLowerCase()}`)}
                              </span>
                            )}
                            {wo.transportGuide && (
                              <span className="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded font-mono">
                                {t('transportGuide')}: {wo.transportGuide}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Parts */}
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('fieldsPartsUsed')}</span>
                            {canEdit && (
                              <div className="flex gap-3">
                                {intervention.assignedTo && showPartsForWorkOrderId !== wo.id && (
                                  <button onClick={() => setShowPartsForWorkOrderId(wo.id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                    {t('addParts')}
                                  </button>
                                )}
                                {showWarehousePartsForWOId !== wo.id && (
                                  <button onClick={() => { setShowWarehousePartsForWOId(wo.id); setWarehousePartItemId(''); setWarehousePartQty('1'); setWhItemSearch(''); setWhItemSelectorOpen(false) }} className="text-green-600 hover:text-green-800 text-xs font-medium">
                                    {t('addFromWarehouse')}
                                  </button>
                                )}
                              </div>
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
                                  {(part.createdAt || part.usedByName) && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {part.createdAt && new Date(part.createdAt).toLocaleString()}
                                      {part.usedByName && <span> — {part.usedByName}</span>}
                                    </div>
                                  )}
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
                          {/* Parts selector inline */}
                          {showPartsForWorkOrderId === wo.id && intervention.assignedTo && (
                            <div className="mt-3">
                              <PartsSelector
                                technicianId={intervention.assignedTo.id}
                                interventionId={intervention.id}
                                workOrderId={wo.id}
                                onClose={() => setShowPartsForWorkOrderId(null)}
                                onPartAdded={() => {
                                  fetchWorkOrders()
                                  setShowPartsForWorkOrderId(null)
                                }}
                              />
                            </div>
                          )}
                          {/* Warehouse parts inline */}
                          {showWarehousePartsForWOId === wo.id && (
                            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">{t('addFromWarehouse')}</p>
                              <div className="flex gap-2 flex-wrap items-start">
                                <div ref={whItemSelectorRef} className="relative flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setWhItemSelectorOpen((o) => !o)}
                                    className="input text-gray-800 text-sm w-full text-left flex items-center justify-between"
                                  >
                                    <span className={warehousePartItemId ? 'text-gray-800' : 'text-gray-400'}>
                                      {warehousePartItemId
                                        ? (() => {
                                            const found = warehouseItems.find((i) => i.id === warehousePartItemId)
                                            return found ? `${found.itemName} (${found.partNumber})` : t('workOrderEquipmentPlaceholder')
                                          })()
                                        : t('workOrderEquipmentPlaceholder')}
                                    </span>
                                    <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {whItemSelectorOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                                      <div className="p-2 border-b border-gray-200">
                                        <input
                                          type="text"
                                          autoFocus
                                          placeholder={tCommon('search')}
                                          value={whItemSearch}
                                          onChange={(e) => setWhItemSearch(e.target.value)}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                      <ul className="overflow-y-auto" style={{ maxHeight: '13rem' }}>
                                        {warehouseItems
                                          .filter((item) =>
                                            `${item.itemName} ${item.partNumber}`.toLowerCase().includes(whItemSearch.toLowerCase())
                                          )
                                          .map((item) => (
                                            <li
                                              key={item.id}
                                              onMouseDown={() => {
                                                setWarehousePartItemId(item.id)
                                                setWhItemSelectorOpen(false)
                                                setWhItemSearch('')
                                              }}
                                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                                                warehousePartItemId === item.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'
                                              }`}
                                            >
                                              {item.itemName} ({item.partNumber})
                                            </li>
                                          ))}
                                        {warehouseItems.filter((item) =>
                                          `${item.itemName} ${item.partNumber}`.toLowerCase().includes(whItemSearch.toLowerCase())
                                        ).length === 0 && (
                                          <li className="px-3 py-2 text-sm text-gray-400">{tCommon('noResults')}</li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  className="input text-gray-800 text-sm w-20 shrink-0"
                                  value={warehousePartQty}
                                  onChange={(e) => setWarehousePartQty(e.target.value)}
                                  placeholder={t('warehousePartQty')}
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => addWarehousePart(wo.id)}
                                  disabled={warehousePartLoading || !warehousePartItemId || !warehousePartQty}
                                  className="btn btn-primary text-xs py-1 px-3"
                                >
                                  {warehousePartLoading ? tCommon('saving') : t('addWarehousePart')}
                                </button>
                                <button
                                  onClick={() => setShowWarehousePartsForWOId(null)}
                                  className="btn btn-secondary text-xs py-1 px-3"
                                >
                                  {tCommon('cancel')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
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

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.bill} onChange={(e) => setEditData({ ...editData, bill: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{t('bill')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.contract} onChange={(e) => setEditData({ ...editData, contract: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{t('contract')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.warranty} onChange={(e) => setEditData({ ...editData, warranty: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{t('warranty')}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('internal')} / {t('external')}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditData({ ...editData, internal: true })}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editData.internal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {t('internal')}
              </button>
              <button
                type="button"
                onClick={() => setEditData({ ...editData, internal: false })}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!editData.internal ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {t('external')}
              </button>
            </div>
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

    </div>
  )
}
