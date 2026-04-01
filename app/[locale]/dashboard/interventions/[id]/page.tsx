'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import WorkOrderModal, { type WorkOrder } from './WorkOrderModal'
import WorkOrderSignatureModal from './WorkOrderSignatureModal'
import OVMForm, { type OVMData, migrateOVMData } from './OVMForm'
import { printWorkOrderPDF } from '@/lib/workOrderPrint'
import { printOVMPDF } from '@/lib/ovmPrint'

interface ClientPart {
  id: string
  serialNumber: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  repairReference: string | null
  repairStatus: string | null
  itemId: string
  itemName: string
  partNumber: string
  createdAt: string
  receivedAtWarehouseAt: string | null
  receivedAtWarehouseByName: string | null
  sentOutAt: string | null
  sentOutByName: string | null
  sentOutTechnicianName: string | null
  returnedToClientAt: string | null
  returnedByName: string | null
  returnedRegisteredByName: string | null
  location: string
  pickedUpByName: string | null
  technicianName: string | null
}


interface Technician {
  id: string
  name: string
  email: string
}

interface CompanyVehicle {
  id: string
  plateNumber: string
  brand: string | null
  model: string | null
  description: string | null
}

interface Intervention {
  id: string
  reference: string | null
  status: string
  breakdown: string
  comments: string | null
  bill: boolean
  contract: boolean
  warranty: boolean
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
    contract: boolean
    contractDate: string | null
  }
  location: {
    id: string
    name: string
    country: string | null
    district: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    ovmRegulatorId: string | null
    equipment: Array<{
      id: string
      model: string
      serialNumber: string | null
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

// Lazy-loads and displays a photo thumbnail using auth token
function PhotoThumb({ interventionId, photo, onClick }: { interventionId: string; photo: { id: string; mimeType: string; filename: string }; onClick: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`/api/interventions/${interventionId}/photos/${photo.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => { if (d.data) setSrc(d.data) }).catch(() => {})
  }, [photo.id, interventionId])
  if (!src) return <div className="w-full h-full bg-gray-100 animate-pulse" />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={photo.filename} className="w-full h-full object-cover cursor-pointer" onClick={onClick} />
  )
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
  const [activeWOId, setActiveWOId] = useState<string | 'new' | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [statusChanging, setStatusChanging] = useState(false)
  const [showDateForm, setShowDateForm] = useState(false)
  const [dateFormData, setDateFormData] = useState({ scheduledDate: '', scheduledTime: '' })
  const [clientParts, setClientParts] = useState<ClientPart[]>([])
  const [showClientPartForm, setShowClientPartForm] = useState(false)
  const [clientPartItemId, setClientPartItemId] = useState('')
  const [clientPartSn, setClientPartSn] = useState('')
  const [clientPartFaultDesc, setClientPartFaultDesc] = useState('')
  const [clientPartTechId, setClientPartTechId] = useState('')
  const [clientPartLoading, setClientPartLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<{ id: string; itemName: string; partNumber: string; tracksSerialNumbers: boolean; ean13?: string | null; mainWarehouse: number }[]>([])
  const [itemSelectorOpen, setItemSelectorOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const itemSelectorRef = useRef<HTMLDivElement>(null)
  const [editData, setEditData] = useState({
    status: '',
    breakdown: '',
    comments: '',
    scheduledDate: '',
    scheduledTime: '',
    bill: false,
    contract: false,
    warranty: false,
  })
  const [printCompany, setPrintCompany] = useState<{ name: string; email: string; address: string; phones: string[]; faxes: string[]; logo: string } | null>(null)
  const [signatureModalWO, setSignatureModalWO] = useState<WorkOrder | null>(null)
  const [savedPdfs, setSavedPdfs] = useState<Record<string, { id: string; createdAt: string; clientSignature: string | null; techSignature: string | null }[]>>({})
  const [ovms, setOvms] = useState<{ id: string; data: OVMData; createdAt: string }[]>([])
  const [showOVMForm, setShowOVMForm] = useState(false)
  const [editingOVMId, setEditingOVMId] = useState<string | null>(null)
  const [ovmSaving, setOvmSaving] = useState(false)
  const [commentsEditing, setCommentsEditing] = useState(false)
  const [commentsDraft, setCommentsDraft] = useState('')
  const [commentsSaving, setCommentsSaving] = useState(false)

  // History
  type HistoryEntry = { id: string; eventType: string; description: string; performedById: string; performedByName: string | null; performedAt: string }
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Part Requests
  type PartRequest = { id: string; warehouseItemId: string; itemName: string; partNumber: string; quantity: number; notes: string | null; status: string; requesterName: string; createdAt: string }
  const [partRequests, setPartRequests] = useState<PartRequest[]>([])
  const [showPartRequestForm, setShowPartRequestForm] = useState(false)
  const [partRequestForm, setPartRequestForm] = useState({ warehouseItemId: '', quantity: 1, notes: '' })
  const [prItemSearch, setPrItemSearch] = useState('')
  const [prItemOpen, setPrItemOpen] = useState(false)
  const [partRequestSaving, setPartRequestSaving] = useState(false)

  // Photos
  type InterventionPhoto = { id: string; filename: string; mimeType: string; createdAt: string }
  const [photos, setPhotos] = useState<InterventionPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState<{ id: string; filename: string; mimeType: string; data: string } | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)

  const handlePrintWorkOrder = async (wo: WorkOrder) => {
    if (!intervention) return
    if (!printCompany) {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/admin/company', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setPrintCompany({ name: data.name || '', email: data.email || '', address: data.address || '', phones: Array.isArray(data.phones) ? data.phones : [], faxes: Array.isArray(data.faxes) ? data.faxes : [], logo: data.logo || '' })
      } catch {
        setPrintCompany({ name: '', email: '', address: '', phones: [], faxes: [], logo: '' })
      }
    }
    setSignatureModalWO(wo)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemSelectorRef.current && !itemSelectorRef.current.contains(e.target as Node)) {
        setItemSelectorOpen(false)
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
      fetchVehicles()
      fetchOVMs()
      fetchClientParts()
      fetchWarehouseItems()
      fetchPartRequests()
      fetchPhotos()
      fetchHistory()
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
        comments: data.comments || '',
        scheduledDate: schedDate,
        scheduledTime: data.scheduledTime || '',
        bill: data.bill ?? false,
        contract: data.contract ?? false,
        warranty: data.warranty ?? false,
      })
    } catch (error) {
      console.error('Error fetching intervention:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/history`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      setHistory(Array.isArray(d) ? d : [])
    } catch { /* non-blocking */ }
  }

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/work-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      const orders: WorkOrder[] = Array.isArray(data) ? data : []
      setWorkOrders(orders)
      // Load saved PDFs for each work order in parallel
      const pdfEntries = await Promise.all(
        orders.map(async (wo) => {
          try {
            const r = await fetch(`/api/interventions/${params.id}/work-orders/${wo.id}/pdf`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const pdfs = await r.json()
            return [wo.id, Array.isArray(pdfs) ? pdfs : []] as const
          } catch {
            return [wo.id, []] as const
          }
        })
      )
      setSavedPdfs(Object.fromEntries(pdfEntries))
    } catch (error) {
      console.error('Error fetching work orders:', error)
    }
  }

  const fetchOVMs = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/ovm`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setOvms(Array.isArray(data) ? data.map((o: { id: string; data: unknown; createdAt: string }) => ({ ...o, data: migrateOVMData(o.data) })) : [])
    } catch { /* non-blocking */ }
  }

  const fetchPartRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/part-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setPartRequests(Array.isArray(data) ? data : [])
    } catch { /* non-blocking */ }
  }

  const fetchPhotos = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setPhotos(Array.isArray(data) ? data : [])
    } catch { /* non-blocking */ }
  }

  const uploadPhotos = async (files: FileList) => {
    setPhotoError('')
    const token = localStorage.getItem('token')
    const toUpload = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (toUpload.length === 0) return
    if (toUpload.some(f => f.size > 6 * 1024 * 1024)) {
      setPhotoError('Cada foto deve ter no máximo 6MB.')
      return
    }
    setPhotoUploading(true)
    try {
      for (const file of toUpload) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const res = await fetch(`/api/interventions/${params.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, data: base64 }),
        })
        if (!res.ok) {
          const err = await res.json()
          setPhotoError(err.error || 'Erro ao enviar foto.')
          break
        }
      }
      fetchPhotos()
    } catch {
      setPhotoError('Erro ao enviar foto.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Eliminar esta foto?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/interventions/${params.id}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const openLightbox = async (photo: InterventionPhoto) => {
    setLightboxLoading(true)
    setLightboxPhoto({ ...photo, data: '' })
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/photos/${photo.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setLightboxPhoto(data)
    } catch {
      setLightboxPhoto(null)
    } finally {
      setLightboxLoading(false)
    }
  }

  const submitPartRequest = async () => {
    if (!partRequestForm.warehouseItemId) return
    setPartRequestSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/interventions/${params.id}/part-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          warehouseItemId: partRequestForm.warehouseItemId,
          quantity: partRequestForm.quantity,
          notes: partRequestForm.notes || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setPartRequests(prev => [created, ...prev])
        setPartRequestForm({ warehouseItemId: '', quantity: 1, notes: '' })
        setPrItemSearch('')
        setShowPartRequestForm(false)
      }
    } catch { /* non-blocking */ }
    finally { setPartRequestSaving(false) }
  }

  const deletePartRequest = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/warehouse/part-requests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setPartRequests(prev => prev.filter(r => r.id !== id))
    } catch { /* non-blocking */ }
  }

  const saveOVM = async (data: OVMData) => {
    setOvmSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (editingOVMId) {
        const res = await fetch(`/api/interventions/${params.id}/ovm/${editingOVMId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data }),
        })
        if (res.ok) {
          const updated = await res.json()
          setOvms(prev => prev.map(o => o.id === editingOVMId ? updated : o))
          setEditingOVMId(null)
        }
      } else {
        const res = await fetch(`/api/interventions/${params.id}/ovm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data }),
        })
        if (res.ok) {
          const created = await res.json()
          setOvms(prev => [created, ...prev])
          setShowOVMForm(false)
        }
      }
    } finally {
      setOvmSaving(false)
    }
  }

  const deleteOVM = async (id: string) => {
    if (!confirm('Eliminar este OVM?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/interventions/${params.id}/ovm/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setOvms(prev => prev.filter(o => o.id !== id))
    if (editingOVMId === id) setEditingOVMId(null)
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

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/vehicles', { headers: { Authorization: `Bearer ${token}` } })
      setVehicles(await res.json())
    } catch (error) {
      console.error('Error fetching vehicles:', error)
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
      const response = await fetch('/api/warehouse?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      const list = Array.isArray(data) ? data : (data.items ?? [])
      setWarehouseItems(list.map((i: any) => ({ id: i.id, itemName: i.itemName, partNumber: i.partNumber, tracksSerialNumbers: !!i.tracksSerialNumbers, ean13: i.ean13 ?? null, mainWarehouse: i.mainWarehouse ?? 0 })))
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
        body: JSON.stringify({
          warehouseItemId: clientPartItemId,
          serialNumber: clientPartSn.trim() || null,
          faultDescription: clientPartFaultDesc.trim() || null,
          technicianId: clientPartTechId || null,
        }),
      })
      if (response.ok) {
        setShowClientPartForm(false)
        setClientPartItemId('')
        setClientPartSn('')
        setClientPartFaultDesc('')
        setClientPartTechId('')
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

  const handleSendOut = async (partId: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/client-parts/${partId}/send-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) { fetchClientParts() }
    else { const d = await res.json(); alert(d.error || 'Erro ao dar saída') }
  }

  const handleReturnToClient = async (partId: string) => {
    if (!confirm('Confirmar entrega ao cliente?')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/client-parts/${partId}/return-to-client`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { fetchClientParts() }
      else { const d = await res.json(); alert(d.error || 'Erro ao confirmar entrega') }
    } catch (error) {
      console.error('Error returning part to client:', error)
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

  const saveComments = async (value: string) => {
    if (!intervention) return
    setCommentsSaving(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: intervention.client.id,
          assignedToId: intervention.assignedTo?.id,
          breakdown: intervention.breakdown,
          status: intervention.status,
          comments: value,
        }),
      })
      setIntervention(prev => prev ? { ...prev, comments: value || null } : prev)
      setCommentsEditing(false)
    } finally {
      setCommentsSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
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
      fetchHistory()
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
      if (response.ok) { fetchIntervention(); fetchHistory() }
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
        fetchHistory()
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
        fetchHistory()
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${intervention.client.contract ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                      {intervention.client.contract ? '✓' : '✗'} {tClients('contract')}
                    </span>
                    {intervention.client.contract && intervention.client.contractDate && (
                      <span className="text-xs text-gray-500">{new Date(intervention.client.contractDate).toLocaleDateString()}</span>
                    )}
                  </div>
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

            {/* Comments — inline editable */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700">Comentários</h3>
                {!commentsEditing && (
                  <button
                    onClick={() => { setCommentsDraft(intervention.comments || ''); setCommentsEditing(true) }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {intervention.comments ? 'Editar' : '+ Adicionar'}
                  </button>
                )}
              </div>
              {commentsEditing ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    rows={3}
                    className="input text-gray-800 w-full"
                    value={commentsDraft}
                    onChange={e => setCommentsDraft(e.target.value)}
                    placeholder="Notas ou comentários internos..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveComments(commentsDraft)}
                      disabled={commentsSaving}
                      className="btn btn-primary text-sm py-1 px-3"
                    >
                      {commentsSaving ? 'A guardar...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setCommentsEditing(false)}
                      disabled={commentsSaving}
                      className="btn btn-secondary text-sm py-1 px-3"
                    >
                      Cancelar
                    </button>
                    {intervention.comments && (
                      <button
                        onClick={() => saveComments('')}
                        disabled={commentsSaving}
                        className="text-red-500 hover:text-red-700 text-sm ml-auto"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ) : intervention.comments ? (
                <p
                  className="text-gray-900 whitespace-pre-wrap cursor-pointer hover:bg-gray-50 rounded p-1 -ml-1 transition-colors"
                  onClick={() => { setCommentsDraft(intervention.comments || ''); setCommentsEditing(true) }}
                  title="Clica para editar"
                >
                  {intervention.comments}
                </p>
              ) : (
                <p className="text-gray-400 text-sm italic">Sem comentários</p>
              )}
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
                        {clientPartItemId === '__GENERIC__'
                          ? <span className="text-amber-700 font-medium">Artigo não catalogado</span>
                          : clientPartItemId
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
                          {/* Generic / uncatalogued option */}
                          <li
                            onMouseDown={() => { setClientPartItemId('__GENERIC__'); setItemSelectorOpen(false); setItemSearch('') }}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 border-b border-gray-100 text-amber-700 font-medium ${clientPartItemId === '__GENERIC__' ? 'bg-amber-100' : ''}`}
                          >
                            Artigo não catalogado
                          </li>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de série <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SN-12345"
                    value={clientPartSn}
                    onChange={e => setClientPartSn(e.target.value)}
                    className="input text-gray-800 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição da avaria <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Não liga, sensor danificado..."
                    value={clientPartFaultDesc}
                    onChange={e => setClientPartFaultDesc(e.target.value)}
                    className="input text-gray-800 w-full"
                  />
                </div>
                {userRole !== 'TECHNICIAN' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Técnico que recebe a peça
                      {intervention.assignedTo && <span className="text-gray-400 font-normal"> (omitir = técnico atribuído)</span>}
                    </label>
                    <select
                      value={clientPartTechId}
                      onChange={e => setClientPartTechId(e.target.value)}
                      className="input text-gray-800"
                    >
                      {intervention.assignedTo
                        ? <option value="">{intervention.assignedTo.name}</option>
                        : <option value="">Selecionar técnico...</option>
                      }
                      {technicians
                        .filter(t => t.id !== intervention.assignedTo?.id)
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                      }
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={addClientPart}
                    disabled={clientPartLoading || !clientPartItemId}
                    className="btn btn-primary text-sm"
                  >
                    {clientPartLoading ? tCommon('saving') : tCommon('save')}
                  </button>
                  <button
                    onClick={() => { setShowClientPartForm(false); setClientPartItemId(''); setClientPartSn(''); setClientPartFaultDesc(''); setClientPartTechId('') }}
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
                    className={`border rounded-lg px-4 py-3 ${
                      part.clientPartStatus === 'RESOLVED'   ? 'bg-green-50 border-green-200' :
                      part.clientPartStatus === 'RETURNING'  ? 'bg-purple-50 border-purple-200' :
                      part.clientPartStatus === 'REPAIR'     ? 'bg-blue-50 border-blue-200' :
                      part.clientPartStatus === 'SWAP'       ? 'bg-purple-50 border-purple-200' :
                      part.clientPartStatus === 'IN_TRANSIT' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide shrink-0 ${
                        part.clientPartStatus === 'RESOLVED'   ? 'bg-green-200 text-green-900' :
                        part.clientPartStatus === 'RETURNING'  ? 'bg-purple-200 text-purple-900' :
                        part.clientPartStatus === 'REPAIR'     ? 'bg-blue-200 text-blue-900' :
                        part.clientPartStatus === 'SWAP'       ? 'bg-purple-200 text-purple-900' :
                        part.clientPartStatus === 'IN_TRANSIT' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-amber-300 text-amber-900'
                      }`}>
                        {part.clientPartStatus === 'RESOLVED' && part.repairReference ? 'Reparada' :
                         part.clientPartStatus === 'RESOLVED'   ? 'Trocada' :
                         part.clientPartStatus === 'RETURNING'  ? 'A Devolver' :
                         part.clientPartStatus === 'REPAIR'     ? 'Em Reparação' :
                         part.clientPartStatus === 'SWAP'       ? 'Troca' :
                         part.clientPartStatus === 'IN_TRANSIT' ? 'Em Trânsito' :
                         'Pendente'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                          {part.itemName}
                          {part.partNumber === '__GENERIC__' && (
                            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Genérico</span>
                          )}
                        </p>
                        {part.partNumber !== '__GENERIC__' && <p className="text-xs text-gray-500">{part.partNumber}</p>}
                        {part.faultDescription && (
                          <p className="text-xs text-amber-800 mt-0.5 italic">{part.faultDescription}</p>
                        )}
                        {part.repairReference && (
                          <p className="text-xs font-mono font-semibold mt-0.5 text-blue-700 flex items-center gap-1.5">
                            {part.repairReference}
                            {part.repairStatus && (
                              <span className={`font-sans font-medium px-1.5 py-0.5 rounded text-xs ${
                                part.repairStatus === 'REPAIRED'           ? 'bg-green-100 text-green-800' :
                                part.repairStatus === 'IN_REPAIR'         ? 'bg-blue-100 text-blue-800' :
                                part.repairStatus === 'RETURNED_TO_CLIENT'? 'bg-gray-100 text-gray-700' :
                                part.repairStatus === 'WRITTEN_OFF'       ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {part.repairStatus === 'PENDING'            ? 'Criada' :
                                 part.repairStatus === 'IN_REPAIR'          ? 'Em Progresso' :
                                 part.repairStatus === 'REPAIRED'           ? 'Devolvido ao Stock' :
                                 part.repairStatus === 'RETURNED_TO_CLIENT' ? 'Reparado' :
                                 part.repairStatus === 'NOT_REPAIRED'       ? 'Não Reparado' :
                                 part.repairStatus === 'WRITTEN_OFF'        ? 'Abatida' :
                                 part.repairStatus}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {part.serialNumber && (
                        <span className="font-mono text-sm text-gray-700 bg-white border border-gray-200 rounded px-2 py-0.5 shrink-0">
                          {part.serialNumber}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {t('clientPartPickedUp')}: {new Date(part.createdAt).toLocaleString()}
                        {part.technicianName && ` — ${part.technicianName}`}
                        {part.pickedUpByName && part.pickedUpByName !== part.technicianName && (
                          <span className="text-gray-400"> (reg. {part.pickedUpByName})</span>
                        )}
                        {part.receivedAtWarehouseAt && (
                          <span className="ml-2 text-blue-700 font-medium">
                            · Entrada armazém: {new Date(part.receivedAtWarehouseAt).toLocaleString()}{part.receivedAtWarehouseByName && ` — ${part.receivedAtWarehouseByName}`}
                          </span>
                        )}
                        {part.sentOutAt && (
                          <span className="ml-2 text-purple-700 font-medium">
                            · Saída armazém: {new Date(part.sentOutAt).toLocaleString()}
                            {part.sentOutTechnicianName && ` — ${part.sentOutTechnicianName}`}
                            {part.sentOutByName && part.sentOutByName !== part.sentOutTechnicianName && (
                              <span className="text-purple-500 font-normal"> (reg. {part.sentOutByName})</span>
                            )}
                          </span>
                        )}
                        {part.returnedToClientAt && (
                          <span className="ml-2 text-green-700 font-medium">
                            · Devolvida: {new Date(part.returnedToClientAt).toLocaleString()}
                            {part.returnedByName && ` — ${part.returnedByName}`}
                            {part.returnedRegisteredByName && part.returnedRegisteredByName !== part.returnedByName && (
                              <span className="text-green-500 font-normal"> (reg. {part.returnedRegisteredByName})</span>
                            )}
                          </span>
                        )}
                      </span>
                      {part.clientPartStatus === 'IN_TRANSIT' && (
                        <button
                          onClick={async () => {
                            if (!confirm('Cancelar recolha desta peça?')) return
                            const token = localStorage.getItem('token')
                            const res = await fetch(`/api/client-parts/${part.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
                            if (res.ok) fetchClientParts()
                            else { const d = await res.json(); alert(d.error || 'Erro ao cancelar') }
                          }}
                          className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 font-medium"
                        >
                          Cancelar
                        </button>
                      )}
                      {part.clientPartStatus === 'RETURNING' && (
                        <button onClick={() => handleReturnToClient(part.id)} className="px-2 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-800 font-medium">
                          Confirmar Entrega
                        </button>
                      )}
                    </div>
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
                <button onClick={() => setActiveWOId('new')} className="btn btn-primary text-sm">
                  {t('addWorkOrder')}
                </button>
              )}
            </div>

            {workOrders.length === 0 ? (
              <p className="text-gray-600">{t('noWorkOrders')}</p>
            ) : (
              <div className="space-y-2">
                {workOrders.map((wo) => {
                  return (
                    <button
                      key={wo.id}
                      onClick={() => setActiveWOId(wo.id)}
                      className="w-full text-left border rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {wo.reference && <span className="font-mono font-semibold text-gray-700 text-sm shrink-0">{wo.reference}</span>}
                          <span className={wo.internal ? 'shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700' : 'shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700'}>
                            {wo.internal ? t('internal') : t('external')}
                          </span>
                          <span className="text-gray-800 text-sm truncate">{wo.description}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                          {wo.timeSpent ? <span className="text-blue-700 font-medium">{wo.timeSpent}h</span> : null}
                          {wo.parts.length > 0 && <span>{wo.parts.length} pç</span>}
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
                <div className="border-t pt-3">
                  <span className="font-semibold text-gray-700">{t('totalHours')}: {totalHours}</span>
                </div>
              </div>
            )}
          </div>
        {/* Part Requests section */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Pedidos de Peças</h2>
            {!showPartRequestForm && (
              <button onClick={() => setShowPartRequestForm(true)} className="btn btn-primary text-sm px-3 py-1.5">
                + Novo Pedido
              </button>
            )}
          </div>

          {showPartRequestForm && (() => {
            const selectedItem = warehouseItems.find(i => i.id === partRequestForm.warehouseItemId)
            const filteredWHItems = warehouseItems.filter(i =>
              prItemSearch === '' ||
              i.itemName.toLowerCase().includes(prItemSearch.toLowerCase()) ||
              i.partNumber.toLowerCase().includes(prItemSearch.toLowerCase())
            )
            return (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                {/* Item search */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Peça *</label>
                  {selectedItem ? (
                    <div className="flex items-center justify-between border rounded px-3 py-2 bg-white">
                      <div>
                        <span className="font-medium text-gray-900 text-sm">{selectedItem.itemName}</span>
                        {selectedItem.partNumber && <span className="text-xs font-mono text-gray-500 ml-2">{selectedItem.partNumber}</span>}
                      </div>
                      <button type="button" onClick={() => { setPartRequestForm(p => ({ ...p, warehouseItemId: '' })); setPrItemSearch('') }} className="text-xs text-gray-400 hover:text-gray-700">✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        className="input text-gray-800"
                        placeholder="Pesquisar peça no armazém..."
                        value={prItemSearch}
                        onChange={e => { setPrItemSearch(e.target.value); setPrItemOpen(true) }}
                        onFocus={() => setPrItemOpen(true)}
                        autoFocus
                      />
                      {prItemOpen && filteredWHItems.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {filteredWHItems.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2"
                              onMouseDown={e => {
                                e.preventDefault()
                                setPartRequestForm(p => ({ ...p, warehouseItemId: item.id }))
                                setPrItemSearch('')
                                setPrItemOpen(false)
                              }}
                            >
                              <span className="text-sm text-gray-900">{item.itemName}</span>
                              {item.partNumber && <span className="text-xs font-mono text-gray-400 flex-shrink-0">{item.partNumber}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                      type="number" min={1}
                      className="input text-gray-800"
                      value={partRequestForm.quantity}
                      onChange={e => setPartRequestForm(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
                    <input
                      className="input text-gray-800"
                      placeholder="Observações..."
                      value={partRequestForm.notes}
                      onChange={e => setPartRequestForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={submitPartRequest} disabled={partRequestSaving || !partRequestForm.warehouseItemId} className="btn btn-primary text-sm">
                    {partRequestSaving ? 'A guardar...' : 'Guardar Pedido'}
                  </button>
                  <button onClick={() => { setShowPartRequestForm(false); setPartRequestForm({ warehouseItemId: '', quantity: 1, notes: '' }); setPrItemSearch('') }} className="btn btn-secondary text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )
          })()}

          {partRequests.length === 0 && !showPartRequestForm ? (
            <p className="text-sm text-gray-500">Nenhum pedido de peças.</p>
          ) : (
            <div className="space-y-2">
              {partRequests.map(req => (
                <div key={req.id} className="flex items-start justify-between gap-3 border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{req.itemName}</span>
                      {req.partNumber && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{req.partNumber}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'ORDERED' ? 'bg-blue-100 text-blue-800' :
                        req.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {req.status === 'PENDING' ? 'Pendente' : req.status === 'ORDERED' ? 'Encomendado' : req.status === 'RECEIVED' ? 'Recebido' : 'Cancelado'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Qtd: {req.quantity} · {req.requesterName} · {new Date(req.createdAt).toLocaleDateString()}
                      {req.notes && <span> · {req.notes}</span>}
                    </div>
                  </div>
                  {userRole !== 'TECHNICIAN' || req.status === 'PENDING' ? (
                    <button onClick={() => deletePartRequest(req.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">Eliminar</button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photos section */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-900">Fotos</h2>
            <label className={`btn btn-primary text-sm cursor-pointer ${photoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {photoUploading ? 'A enviar…' : '+ Adicionar Fotos'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files); e.target.value = '' }}
              />
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-4">Máximo 6MB por foto · JPG, PNG, WEBP</p>

          {photoError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{photoError}</p>
          )}

          {photos.length === 0 && !photoUploading ? (
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) uploadPhotos(e.dataTransfer.files) }}
              onClick={() => document.getElementById('photo-drop-input')?.click()}
            >
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-400">Arrastar fotos aqui ou clicar para selecionar</p>
              <p className="text-xs text-gray-300 mt-1">Máximo 6MB por foto · JPG, PNG, WEBP</p>
              <input id="photo-drop-input" type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files); e.target.value = '' }} />
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) uploadPhotos(e.dataTransfer.files) }}
            >
              {photos.map(photo => (
                <div key={photo.id} className="flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <div className="relative aspect-square">
                    <PhotoThumb interventionId={params.id as string} photo={photo} onClick={() => openLightbox(photo)} />
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-white border-t border-gray-100">
                    <span className="text-xs text-gray-500 truncate flex-1">{photo.filename}</span>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="flex-shrink-0 text-red-400 hover:text-red-600 text-xs font-medium"
                      title="Eliminar"
                    >Eliminar</button>
                  </div>
                </div>
              ))}
              {photoUploading && (
                <div className="aspect-square rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 flex items-center justify-center">
                  <span className="text-xs text-blue-400">A enviar…</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute -top-10 right-0 text-white text-2xl leading-none hover:text-gray-300"
              >✕</button>
              {lightboxLoading || !lightboxPhoto.data ? (
                <div className="w-64 h-64 flex items-center justify-center">
                  <span className="text-white text-sm">A carregar…</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxPhoto.data}
                  alt={lightboxPhoto.filename}
                  className="max-w-full max-h-[85vh] rounded-lg object-contain"
                />
              )}
              <p className="text-white text-xs text-center mt-2 opacity-60">{lightboxPhoto.filename}</p>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Histórico</h2>
            <ol className="relative border-l border-gray-200 space-y-4 ml-2">
              {history.map((entry) => {
                const dotColor =
                  entry.eventType === 'CREATED' ? 'bg-gray-400' :
                  entry.description.includes('Estado') ? 'bg-blue-500' :
                  entry.description.includes('Técnico') ? 'bg-indigo-500' :
                  entry.description.includes('Data') ? 'bg-amber-500' :
                  'bg-gray-400'
                return (
                  <li key={entry.id} className="ml-4">
                    <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${dotColor}`} />
                    <p className="text-sm text-gray-800">{entry.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.performedByName ?? 'Sistema'} · {new Date(entry.performedAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* OVM section */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">OVM</h2>
            {!showOVMForm && !editingOVMId && (
              <button
                onClick={() => setShowOVMForm(true)}
                className="btn btn-primary text-sm px-3 py-1.5"
              >
                + Novo OVM
              </button>
            )}
          </div>

          {/* New OVM form */}
          {showOVMForm && (
            <OVMForm
              saving={ovmSaving}
              onSave={saveOVM}
              onCancel={() => setShowOVMForm(false)}
              onPrint={(data) => intervention && printOVMPDF(data, intervention, printCompany ?? { name: '', email: '', address: '', phones: [], faxes: [], logo: '' })}
              equipment={intervention?.location?.equipment ?? []}
              locationOvmRegulatorId={intervention?.location?.ovmRegulatorId ?? null}
            />
          )}

          {/* OVM list */}
          {ovms.length === 0 && !showOVMForm && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum OVM criado.</p>
          )}

          {ovms.map((ovm, idx) => (
            <div key={ovm.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  OVM #{ovms.length - idx} — {new Date(ovm.createdAt).toLocaleString()}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => intervention && printOVMPDF(ovm.data, intervention, printCompany ?? { name: '', email: '', address: '', phones: [], faxes: [], logo: '' })}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setEditingOVMId(editingOVMId === ovm.id ? null : ovm.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {editingOVMId === ovm.id ? 'Fechar' : 'Editar'}
                  </button>
                  <button
                    onClick={() => deleteOVM(ovm.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {editingOVMId === ovm.id && (
                <OVMForm
                  initial={ovm.data}
                  saving={ovmSaving}
                  onSave={saveOVM}
                  onCancel={() => setEditingOVMId(null)}
                  onPrint={(data) => intervention && printOVMPDF(data, intervention, printCompany ?? { name: '', email: '', address: '', phones: [], faxes: [], logo: '' })}
                  equipment={intervention?.location?.equipment ?? []}
                  locationOvmRegulatorId={intervention?.location?.ovmRegulatorId ?? null}
                />
              )}
            </div>
          ))}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comentários
            </label>
            <textarea
              rows={3}
              className="input text-gray-800"
              placeholder="Notas ou comentários internos..."
              value={editData.comments}
              onChange={(e) => setEditData({ ...editData, comments: e.target.value })}
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

      {signatureModalWO && intervention && (
        <WorkOrderSignatureModal
          workOrder={signatureModalWO}
          intervention={intervention}
          onClose={() => setSignatureModalWO(null)}
          onGenerate={async (clientSig, techSig) => {
            const wo = signatureModalWO
            printWorkOrderPDF(wo, intervention, printCompany ?? { name: '', email: '', address: '', phones: [], faxes: [], logo: '' }, clientSig, techSig)
            setSignatureModalWO(null)
            try {
              const token = localStorage.getItem('token')
              const res = await fetch(`/api/interventions/${params.id}/work-orders/${wo.id}/pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ clientSignature: clientSig, techSignature: techSig }),
              })
              if (res.ok) {
                const saved = await res.json()
                setSavedPdfs(prev => ({ ...prev, [wo.id]: [saved, ...(prev[wo.id] ?? [])] }))
              }
            } catch { /* non-blocking */ }
          }}
        />
      )}

      {activeWOId !== null && (
        <WorkOrderModal
          wo={activeWOId === 'new' ? null : workOrders.find(w => w.id === activeWOId) ?? null}
          interventionId={intervention.id}
          assignedTechnicianId={intervention.assignedTo?.id ?? null}
          canEdit={canEdit}
          equipment={intervention.location?.equipment ?? []}
          technicians={technicians}
          vehicles={vehicles}
          warehouseItems={warehouseItems}
          savedPdfs={activeWOId !== 'new' ? (savedPdfs[activeWOId] ?? []) : []}
          printCompany={printCompany}
          onClose={() => setActiveWOId(null)}
          onRefresh={() => { fetchWorkOrders(); fetchIntervention() }}
          onDelete={() => {
            if (activeWOId !== 'new') deleteWorkOrder(activeWOId)
            setActiveWOId(null)
          }}
          onPrint={handlePrintWorkOrder}
        />
      )}

    </div>
  )
}
