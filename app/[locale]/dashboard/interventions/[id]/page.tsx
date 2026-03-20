'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import PartsSelector from './PartsSelector'
import WorkOrderSignatureModal from './WorkOrderSignatureModal'
import OVMForm, { type OVMData, migrateOVMData } from './OVMForm'
import { printWorkOrderPDF } from '@/lib/workOrderPrint'
import { printOVMPDF } from '@/lib/ovmPrint'

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
  internal: boolean
  vehicles: { workOrderId: string; vehicleId: string; plateNumber: string; brand: string | null; model: string | null }[]
  helpers: { workOrderId: string; userId: string; name: string }[]
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
  const [workOrderForm, setWorkOrderForm] = useState({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '', internal: false, vehicleIds: [] as string[], helperIds: [] as string[] })
  const [workOrderLoading, setWorkOrderLoading] = useState(false)
  const [showPartsForWorkOrderId, setShowPartsForWorkOrderId] = useState<string | null>(null)
  const [showWarehousePartsForWOId, setShowWarehousePartsForWOId] = useState<string | null>(null)
  const [warehouseCart, setWarehouseCart] = useState<{ tempId: string; itemId: string; itemName: string; partNumber: string; tracksSerialNumbers: boolean; qty: number; serialNumberIds: string[] }[]>([])
  const [warehousePickerItemId, setWarehousePickerItemId] = useState('')
  const [warehousePickerQty, setWarehousePickerQty] = useState('1')
  const [warehouseSnPicker, setWarehouseSnPicker] = useState<{ itemId: string; itemName: string; partNumber: string; sns: { id: string; serialNumber: string }[]; selected: string[]; qty: number } | null>(null)
  const [warehouseSnLoading, setWarehouseSnLoading] = useState(false)
  const [warehousePartLoading, setWarehousePartLoading] = useState(false)
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<string | null>(null)
  const [editWorkOrderForm, setEditWorkOrderForm] = useState({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '', internal: false, vehicleIds: [] as string[], helperIds: [] as string[] })
  const [editWorkOrderLoading, setEditWorkOrderLoading] = useState(false)
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
  const [clientPartLoading, setClientPartLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<{ id: string; itemName: string; partNumber: string; tracksSerialNumbers: boolean }[]>([])
  const [itemSelectorOpen, setItemSelectorOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const itemSelectorRef = useRef<HTMLDivElement>(null)
  const [whItemSelectorOpen, setWhItemSelectorOpen] = useState(false)
  const [whItemSearch, setWhItemSearch] = useState('')
  const whItemSelectorRef = useRef<HTMLDivElement>(null)
  const [woVehicleOpen, setWoVehicleOpen] = useState(false)
  const [woHelperOpen, setWoHelperOpen] = useState(false)
  const [editWoVehicleOpen, setEditWoVehicleOpen] = useState(false)
  const [editWoHelperOpen, setEditWoHelperOpen] = useState(false)
  const woVehicleRef = useRef<HTMLDivElement>(null)
  const woHelperRef = useRef<HTMLDivElement>(null)
  const editWoVehicleRef = useRef<HTMLDivElement>(null)
  const editWoHelperRef = useRef<HTMLDivElement>(null)
  const [editData, setEditData] = useState({
    status: '',
    breakdown: '',
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

  // Part Requests
  type PartRequest = { id: string; warehouseItemId: string; itemName: string; partNumber: string; quantity: number; notes: string | null; status: string; requesterName: string; createdAt: string }
  const [partRequests, setPartRequests] = useState<PartRequest[]>([])
  const [showPartRequestForm, setShowPartRequestForm] = useState(false)
  const [partRequestForm, setPartRequestForm] = useState({ warehouseItemId: '', quantity: 1, notes: '' })
  const [prItemSearch, setPrItemSearch] = useState('')
  const [prItemOpen, setPrItemOpen] = useState(false)
  const [partRequestSaving, setPartRequestSaving] = useState(false)

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
      if (whItemSelectorRef.current && !whItemSelectorRef.current.contains(e.target as Node)) {
        setWhItemSelectorOpen(false)
      }
      if (woVehicleRef.current && !woVehicleRef.current.contains(e.target as Node)) setWoVehicleOpen(false)
      if (woHelperRef.current && !woHelperRef.current.contains(e.target as Node)) setWoHelperOpen(false)
      if (editWoVehicleRef.current && !editWoVehicleRef.current.contains(e.target as Node)) setEditWoVehicleOpen(false)
      if (editWoHelperRef.current && !editWoHelperRef.current.contains(e.target as Node)) setEditWoHelperOpen(false)
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
      const response = await fetch('/api/warehouse', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setWarehouseItems(
        Array.isArray(data)
          ? data.map((i: any) => ({ id: i.id, itemName: i.itemName, partNumber: i.partNumber, tracksSerialNumbers: !!i.tracksSerialNumbers }))
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
          internal: workOrderForm.internal,
          vehicleIds: workOrderForm.vehicleIds,
          helperIds: workOrderForm.helperIds,
        }),
      })
      if (response.ok) {
        setShowWorkOrderForm(false)
        setWorkOrderForm({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '', internal: false, vehicleIds: [], helperIds: [] })
        fetchWorkOrders()
        fetchIntervention()
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
      internal: wo.internal ?? false,
      vehicleIds: wo.vehicles?.map(v => v.vehicleId) ?? [],
      helperIds: wo.helpers?.map(h => h.userId) ?? [],
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
          internal: editWorkOrderForm.internal,
          vehicleIds: editWorkOrderForm.vehicleIds,
          helperIds: editWorkOrderForm.helperIds,
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

  const addToWarehouseCart = async () => {
    if (!warehousePickerItemId) return
    const found = warehouseItems.find((i) => i.id === warehousePickerItemId)
    if (!found) return
    const qty = parseInt(warehousePickerQty) || 1
    if (found.tracksSerialNumbers) {
      // Load available SNs from warehouse and open SN picker
      setWarehouseSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/warehouse/items/${found.id}/serial-numbers?location=MAIN_WAREHOUSE&status=AVAILABLE`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setWarehouseSnPicker({
          itemId: found.id,
          itemName: found.itemName,
          partNumber: found.partNumber,
          sns: Array.isArray(data) ? data.map((s: any) => ({ id: s.id, serialNumber: s.serialNumber })) : [],
          selected: [],
          qty,
        })
      } catch {
        alert('Failed to load serial numbers')
      } finally {
        setWarehouseSnLoading(false)
      }
    } else {
      setWarehouseCart(prev => [...prev, {
        tempId: crypto.randomUUID(),
        itemId: found.id,
        itemName: found.itemName,
        partNumber: found.partNumber,
        tracksSerialNumbers: false,
        qty,
        serialNumberIds: [],
      }])
      setWarehousePickerItemId('')
      setWarehousePickerQty('1')
      setWhItemSearch('')
    }
  }

  const confirmWarehouseSnSelection = () => {
    if (!warehouseSnPicker || warehouseSnPicker.selected.length !== warehouseSnPicker.qty) return
    setWarehouseCart(prev => [...prev, {
      tempId: crypto.randomUUID(),
      itemId: warehouseSnPicker.itemId,
      itemName: warehouseSnPicker.itemName,
      partNumber: warehouseSnPicker.partNumber,
      tracksSerialNumbers: true,
      qty: warehouseSnPicker.qty,
      serialNumberIds: warehouseSnPicker.selected,
    }])
    setWarehouseSnPicker(null)
    setWarehousePickerItemId('')
    setWarehousePickerQty('1')
    setWhItemSearch('')
  }

  const submitWarehouseCart = async (workOrderId: string) => {
    if (warehouseCart.length === 0) return
    setWarehousePartLoading(true)
    const token = localStorage.getItem('token')
    const errors: string[] = []
    for (const entry of warehouseCart) {
      try {
        const response = await fetch(`/api/interventions/${params.id}/work-orders/${workOrderId}/warehouse-parts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: entry.itemId,
            quantity: entry.qty,
            serialNumberIds: entry.tracksSerialNumbers ? entry.serialNumberIds : undefined,
          }),
        })
        if (!response.ok) {
          const data = await response.json()
          errors.push(`${entry.itemName}: ${data.error || 'Failed'}`)
        }
      } catch {
        errors.push(`${entry.itemName}: Network error`)
      }
    }
    setWarehousePartLoading(false)
    if (errors.length === 0) {
      setShowWarehousePartsForWOId(null)
      setWarehouseCart([])
      setWarehousePickerItemId('')
      setWarehousePickerQty('1')
      fetchWorkOrders()
    } else {
      alert(errors.join('\n'))
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
                <div className="flex gap-3">
                  <button type="button" onClick={() => setWorkOrderForm({ ...workOrderForm, internal: false })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!workOrderForm.internal ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {t('external')}
                  </button>
                  <button type="button" onClick={() => setWorkOrderForm({ ...workOrderForm, internal: true })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${workOrderForm.internal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {t('internal')}
                  </button>
                </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsTimeSpent')}</label>
                  <input type="number" step="0.5" className="input text-gray-800" value={workOrderForm.timeSpent} onChange={(e) => setWorkOrderForm({ ...workOrderForm, timeSpent: e.target.value })} />
                </div>
                {!workOrderForm.internal && (
                  <>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsKm')}</label>
                        <input type="number" step="0.1" min="0" className="input text-gray-800" placeholder="0" value={workOrderForm.km} onChange={(e) => setWorkOrderForm({ ...workOrderForm, km: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsFromAddress')}</label>
                      <input type="text" className="input text-gray-800" placeholder={t('fieldsFromAddressPlaceholder')} value={workOrderForm.fromAddress} onChange={(e) => setWorkOrderForm({ ...workOrderForm, fromAddress: e.target.value })} />
                    </div>
                    {vehicles.length > 0 && (
                      <div ref={woVehicleRef} className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicle')}</label>
                        <button type="button" onClick={() => setWoVehicleOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                          <span className={workOrderForm.vehicleIds.length ? 'text-gray-800' : 'text-gray-400'}>
                            {workOrderForm.vehicleIds.length ? vehicles.filter(v => workOrderForm.vehicleIds.includes(v.id)).map(v => v.plateNumber).join(', ') : t('vehiclePlaceholder')}
                          </span>
                          <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {woVehicleOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                            {vehicles.map((v) => (
                              <div key={v.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setWorkOrderForm(f => ({ ...f, vehicleIds: f.vehicleIds.includes(v.id) ? f.vehicleIds.filter(id => id !== v.id) : [...f.vehicleIds, v.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${workOrderForm.vehicleIds.includes(v.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                                <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{workOrderForm.vehicleIds.includes(v.id) ? '✓' : ''}</span>
                                <span className="text-sm">{v.plateNumber}{(v.brand || v.model) ? ` — ${[v.brand, v.model].filter(Boolean).join(' ')}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {technicians.filter(tech => tech.id !== intervention.assignedTo?.id).length > 0 && (
                  <div ref={woHelperRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('helpers')}</label>
                    <button type="button" onClick={() => setWoHelperOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                      <span className={workOrderForm.helperIds.length ? 'text-gray-800' : 'text-gray-400'}>
                        {workOrderForm.helperIds.length ? technicians.filter(tech => workOrderForm.helperIds.includes(tech.id)).map(tech => tech.name).join(', ') : '—'}
                      </span>
                      <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {woHelperOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                        {technicians.filter(tech => tech.id !== intervention.assignedTo?.id).map((tech) => (
                          <div key={tech.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setWorkOrderForm(f => ({ ...f, helperIds: f.helperIds.includes(tech.id) ? f.helperIds.filter(id => id !== tech.id) : [...f.helperIds, tech.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${workOrderForm.helperIds.includes(tech.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                            <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{workOrderForm.helperIds.includes(tech.id) ? '✓' : ''}</span>
                            <span className="text-sm">{tech.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                    {(['ELECTRONIC', 'HYDRAULIC', 'COMPUTING', 'OTHERS'] as const).map((type) => (
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
                    onClick={() => { setShowWorkOrderForm(false); setWorkOrderForm({ description: '', timeSpent: '', km: '', fromAddress: '', equipmentId: '', interventionType: '', transportGuide: '', startDate: '', startTime: '', endDate: '', endTime: '', internal: false, vehicleIds: [], helperIds: [] }) }}
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
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setEditWorkOrderForm({ ...editWorkOrderForm, internal: false })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!editWorkOrderForm.internal ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                            {t('external')}
                          </button>
                          <button type="button" onClick={() => setEditWorkOrderForm({ ...editWorkOrderForm, internal: true })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${editWorkOrderForm.internal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                            {t('internal')}
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('workOrderDescription')}</label>
                          <textarea rows={3} className="input text-gray-800" value={editWorkOrderForm.description} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, description: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsTimeSpent')}</label>
                          <input type="number" step="0.5" className="input text-gray-800" value={editWorkOrderForm.timeSpent} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, timeSpent: e.target.value })} />
                        </div>
                        {!editWorkOrderForm.internal && (
                          <>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsKm')}</label>
                                <input type="number" step="0.1" min="0" className="input text-gray-800" value={editWorkOrderForm.km} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, km: e.target.value })} />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t('fieldsFromAddress')}</label>
                              <input type="text" className="input text-gray-800" placeholder={t('fieldsFromAddressPlaceholder')} value={editWorkOrderForm.fromAddress} onChange={(e) => setEditWorkOrderForm({ ...editWorkOrderForm, fromAddress: e.target.value })} />
                            </div>
                            {vehicles.length > 0 && (
                              <div ref={editWoVehicleRef} className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicle')}</label>
                                <button type="button" onClick={() => setEditWoVehicleOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                                  <span className={editWorkOrderForm.vehicleIds.length ? 'text-gray-800' : 'text-gray-400'}>
                                    {editWorkOrderForm.vehicleIds.length ? vehicles.filter(v => editWorkOrderForm.vehicleIds.includes(v.id)).map(v => v.plateNumber).join(', ') : t('vehiclePlaceholder')}
                                  </span>
                                  <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {editWoVehicleOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                                    {vehicles.map((v) => (
                                      <div key={v.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditWorkOrderForm(f => ({ ...f, vehicleIds: f.vehicleIds.includes(v.id) ? f.vehicleIds.filter(id => id !== v.id) : [...f.vehicleIds, v.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${editWorkOrderForm.vehicleIds.includes(v.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                                        <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{editWorkOrderForm.vehicleIds.includes(v.id) ? '✓' : ''}</span>
                                        <span className="text-sm">{v.plateNumber}{(v.brand || v.model) ? ` — ${[v.brand, v.model].filter(Boolean).join(' ')}` : ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        {technicians.filter(tech => tech.id !== intervention.assignedTo?.id).length > 0 && (
                          <div ref={editWoHelperRef} className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('helpers')}</label>
                            <button type="button" onClick={() => setEditWoHelperOpen(o => !o)} className="input text-gray-800 text-sm w-full text-left flex items-center justify-between">
                              <span className={editWorkOrderForm.helperIds.length ? 'text-gray-800' : 'text-gray-400'}>
                                {editWorkOrderForm.helperIds.length ? technicians.filter(tech => editWorkOrderForm.helperIds.includes(tech.id)).map(tech => tech.name).join(', ') : '—'}
                              </span>
                              <svg className="w-4 h-4 text-gray-500 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {editWoHelperOpen && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                                {technicians.filter(tech => tech.id !== intervention.assignedTo?.id).map((tech) => (
                                  <div key={tech.id} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditWorkOrderForm(f => ({ ...f, helperIds: f.helperIds.includes(tech.id) ? f.helperIds.filter(id => id !== tech.id) : [...f.helperIds, tech.id] })) }} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 select-none ${editWorkOrderForm.helperIds.includes(tech.id) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'}`}>
                                    <span className="w-4 h-4 border rounded flex items-center justify-center shrink-0 text-xs">{editWorkOrderForm.helperIds.includes(tech.id) ? '✓' : ''}</span>
                                    <span className="text-sm">{tech.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
                            {(['ELECTRONIC', 'HYDRAULIC', 'COMPUTING', 'OTHERS'] as const).map((type) => (
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
                            <div className="flex items-center gap-2">
                              {wo.reference && (
                                <span className="font-mono font-semibold text-gray-700 text-sm">{wo.reference}</span>
                              )}
                              {wo.internal && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{t('internal')}</span>
                              )}
                            </div>
                            <div>
                              {new Date(wo.createdAt).toLocaleString()} — {wo.createdBy.name}
                              {wo.timeSpent ? <span> · {wo.timeSpent}h</span> : null}
                              {!wo.internal && wo.km ? <span> · {wo.km} km{wo.fromAddress ? ` (${wo.fromAddress})` : ''}</span> : (!wo.internal && wo.fromAddress ? <span> · {wo.fromAddress}</span> : null)}
                              {!wo.internal && wo.vehicles?.length > 0 && wo.vehicles.map(v => (
                                <span key={v.vehicleId} className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-mono text-xs">
                                  {v.plateNumber}{(v.brand || v.model) ? ` · ${[v.brand, v.model].filter(Boolean).join(' ')}` : ''}
                                </span>
                              ))}
                            </div>
                            {wo.helpers?.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-gray-400">{t('helpers')}:</span>
                                {wo.helpers.map(h => (
                                  <span key={h.userId} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{h.name}</span>
                                ))}
                              </div>
                            )}
                            {!wo.internal && (wo.startDate || wo.endDate) && (
                              <div className="flex gap-3">
                                {wo.startDate && <span>▶ {wo.startDate}{wo.startTime ? ` ${wo.startTime}` : ''}</span>}
                                {wo.endDate && <span>■ {wo.endDate}{wo.endTime ? ` ${wo.endTime}` : ''}</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3 shrink-0 items-start">
                            <button onClick={() => handlePrintWorkOrder(wo)} className="text-gray-500 hover:text-gray-700 text-xs font-medium">PDF</button>
                            {canEdit && (
                              <>
                                <button onClick={() => startEditWorkOrder(wo)} className="text-blue-600 hover:text-blue-800 text-xs">{tCommon('edit')}</button>
                                <button onClick={() => deleteWorkOrder(wo.id)} className="text-red-600 hover:text-red-800 text-xs">{tCommon('delete')}</button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-900 whitespace-pre-wrap mb-3">{wo.description}</p>

                        {(wo.locationEquipmentId || wo.interventionType || wo.transportGuide) && (
                          <div className="flex flex-wrap gap-2 mb-3 text-xs">
                            {wo.locationEquipmentId && (() => {
                              const eq = intervention.location?.equipment.find((e) => e.id === wo.locationEquipmentId)
                              return eq ? (
                                <span className="px-2 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded">
                                  {eq.equipmentType.name} — {eq.brand.name} {eq.model}{eq.serialNumber ? ` · ${eq.serialNumber}` : ''}
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
                                  <button onClick={() => { setShowWarehousePartsForWOId(wo.id); setWarehouseCart([]); setWarehousePickerItemId(''); setWarehousePickerQty('1'); setWarehouseSnPicker(null); setWhItemSearch(''); setWhItemSelectorOpen(false) }} className="text-green-600 hover:text-green-800 text-xs font-medium">
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
                          {/* Saved PDFs */}
                          {(savedPdfs[wo.id]?.length ?? 0) > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">PDFs Guardados</p>
                              <div className="flex flex-col gap-1">
                                {savedPdfs[wo.id].map((pdf, idx) => (
                                  <div key={pdf.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                                    <span className="text-xs text-gray-600">
                                      #{savedPdfs[wo.id].length - idx} — {new Date(pdf.createdAt).toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() => {
                                        if (!intervention) return
                                        printWorkOrderPDF(wo, intervention, printCompany ?? { name: '', email: '', address: '', phones: [], faxes: [], logo: '' }, pdf.clientSignature, pdf.techSignature)
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Re-imprimir
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Warehouse parts inline */}
                          {showWarehousePartsForWOId === wo.id && (
                            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 space-y-3">
                              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">{t('addFromWarehouse')}</p>

                              {/* SN picker for a serialized item */}
                              {warehouseSnPicker ? (
                                <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{warehouseSnPicker.itemName}</p>
                                      <p className="text-xs text-gray-500">{warehouseSnPicker.partNumber}</p>
                                    </div>
                                    <button type="button" onClick={() => setWarehouseSnPicker(null)} className="text-gray-400 hover:text-gray-600 text-xs px-2">✕</button>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      {t('warehousePartQty')}
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={warehouseSnPicker.sns.length}
                                      value={warehouseSnPicker.qty}
                                      onChange={(e) => setWarehouseSnPicker(p => p ? { ...p, qty: parseInt(e.target.value) || 1, selected: [] } : p)}
                                      className="input text-gray-800 text-sm w-24"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{warehouseSnPicker.sns.length} available</p>
                                  </div>
                                  <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                                    {warehouseSnPicker.sns.length === 0 ? (
                                      <p className="text-xs text-gray-400 p-1">No serial numbers available</p>
                                    ) : warehouseSnPicker.sns.map((sn) => (
                                      <label key={sn.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm ${warehouseSnPicker.selected.includes(sn.id) ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
                                        <input
                                          type="checkbox"
                                          checked={warehouseSnPicker.selected.includes(sn.id)}
                                          onChange={() => setWarehouseSnPicker(p => {
                                            if (!p) return p
                                            const sel = p.selected.includes(sn.id)
                                              ? p.selected.filter(id => id !== sn.id)
                                              : p.selected.length < p.qty ? [...p.selected, sn.id] : p.selected
                                            return { ...p, selected: sel }
                                          })}
                                          disabled={!warehouseSnPicker.selected.includes(sn.id) && warehouseSnPicker.selected.length >= warehouseSnPicker.qty}
                                          className="w-3.5 h-3.5"
                                        />
                                        <span className="font-mono text-xs">{sn.serialNumber}</span>
                                      </label>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500">{warehouseSnPicker.selected.length} / {warehouseSnPicker.qty} selected</p>
                                  <button
                                    type="button"
                                    onClick={confirmWarehouseSnSelection}
                                    disabled={warehouseSnPicker.selected.length !== warehouseSnPicker.qty}
                                    className="btn btn-primary text-xs py-1 px-3 w-full"
                                  >
                                    {t('addToList')}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Cart list */}
                                  {warehouseCart.length > 0 && (
                                    <div className="space-y-1">
                                      {warehouseCart.map((entry) => (
                                        <div key={entry.tempId} className="flex items-center gap-2 bg-white border border-green-200 rounded px-2 py-1">
                                          <div className="flex-1 min-w-0">
                                            <span className="text-sm text-gray-800 truncate block">{entry.itemName}</span>
                                            <span className="text-xs text-gray-500">{entry.partNumber}</span>
                                            {entry.tracksSerialNumbers && (
                                              <span className="text-xs text-blue-600">{entry.serialNumberIds.length} SN(s)</span>
                                            )}
                                          </div>
                                          {!entry.tracksSerialNumbers && (
                                            <input
                                              type="number"
                                              min="1"
                                              value={entry.qty}
                                              onChange={(e) => setWarehouseCart(prev => prev.map(c => c.tempId === entry.tempId ? { ...c, qty: parseInt(e.target.value) || 1 } : c))}
                                              className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => setWarehouseCart(prev => prev.filter(c => c.tempId !== entry.tempId))}
                                            className="text-red-400 hover:text-red-600 text-xs px-1"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Picker row */}
                                  <div className="flex gap-2 flex-wrap items-start">
                                    <div ref={whItemSelectorRef} className="relative flex-1 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => setWhItemSelectorOpen((o) => !o)}
                                        className="input text-gray-800 text-sm w-full text-left flex items-center justify-between"
                                      >
                                        <span className={warehousePickerItemId ? 'text-gray-800' : 'text-gray-400'}>
                                          {warehousePickerItemId
                                            ? (() => {
                                                const found = warehouseItems.find((i) => i.id === warehousePickerItemId)
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
                                                    setWarehousePickerItemId(item.id)
                                                    setWhItemSelectorOpen(false)
                                                    setWhItemSearch('')
                                                  }}
                                                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                                                    warehousePickerItemId === item.id ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-800'
                                                  }`}
                                                >
                                                  {item.itemName} ({item.partNumber}){item.tracksSerialNumbers ? ' 🔢' : ''}
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
                                    {/* Only show qty input for non-serialized; for serialized, qty is set in the SN picker */}
                                    {(() => {
                                      const sel = warehouseItems.find(i => i.id === warehousePickerItemId)
                                      return !sel?.tracksSerialNumbers ? (
                                        <input
                                          type="number"
                                          min="1"
                                          className="input text-gray-800 text-sm w-20 shrink-0"
                                          value={warehousePickerQty}
                                          onChange={(e) => setWarehousePickerQty(e.target.value)}
                                          placeholder={t('warehousePartQty')}
                                        />
                                      ) : null
                                    })()}
                                    <button
                                      type="button"
                                      onClick={addToWarehouseCart}
                                      disabled={!warehousePickerItemId || warehouseSnLoading}
                                      className="btn btn-secondary text-xs py-1 px-3 shrink-0"
                                    >
                                      {warehouseSnLoading ? '…' : '+'}
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => submitWarehouseCart(wo.id)}
                                      disabled={warehousePartLoading || warehouseCart.length === 0}
                                      className="btn btn-primary text-xs py-1 px-3"
                                    >
                                      {warehousePartLoading ? tCommon('saving') : `${t('addWarehousePart')}${warehouseCart.length > 0 ? ` (${warehouseCart.length})` : ''}`}
                                    </button>
                                    <button
                                      onClick={() => { setShowWarehousePartsForWOId(null); setWarehouseCart([]); setWarehouseSnPicker(null) }}
                                      className="btn btn-secondary text-xs py-1 px-3"
                                    >
                                      {tCommon('cancel')}
                                    </button>
                                  </div>
                                </>
                              )}
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
        {/* Part Requests section */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
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

        {/* OVM section */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
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

    </div>
  )
}
