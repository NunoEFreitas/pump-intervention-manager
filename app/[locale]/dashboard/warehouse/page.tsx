'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  value: number
  mainWarehouse: number
  repairStock: number
  destructionStock: number
  clientPartsCount: number
  tracksSerialNumbers: boolean
  totalTechnicianStock: number
  totalStock: number
  equipmentTypeName: string | null
  brandName: string | null
  technicianStocks: Array<{
    technician: { id: string; name: string }
    quantity: number
  }>
}

interface WarehousePage {
  items: WarehouseItem[]
  total: number
  page: number
  pages: number
  limit: number
}

interface PartRequest {
  id: string
  interventionId: string
  interventionReference: string | null
  clientName: string
  warehouseItemId: string
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  mainWarehouse: number
  requestedById: string
  requesterName: string
  quantity: number
  notes: string | null
  status: string
  createdAt: string
}

interface SerialNumberOption {
  id: string
  serialNumber: string
}

interface ClientPart {
  id: string
  itemId: string
  serialNumber: string
  clientPartStatus: string | null
  clientRepairJobId: string | null
  interventionId: string | null
  pickedUpByName: string | null
  technicianId: string | null
  technicianName: string | null
  interventionReference: string | null
  clientName: string | null
  itemName: string
  partNumber: string
  repairReference: string | null
  repairStatus: string | null
  tracksSerialNumbers: boolean
  mainWarehouse: number
  snExample: string | null
}

const REPAIR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Criada',
  IN_REPAIR: 'Em Progresso',
  QUOTE: 'Orçamento',
  REPAIRED: 'Reparada',
  NOT_REPAIRED: 'Não Reparada',
  WRITTEN_OFF: 'Destruição',
  RETURNED_TO_CLIENT: 'Devolvida ao Cliente',
}

const REPAIR_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_REPAIR: 'bg-blue-100 text-blue-800',
  QUOTE: 'bg-orange-100 text-orange-800',
  REPAIRED: 'bg-green-100 text-green-800',
  NOT_REPAIRED: 'bg-gray-100 text-gray-700',
  WRITTEN_OFF: 'bg-red-100 text-red-800',
  RETURNED_TO_CLIENT: 'bg-purple-100 text-purple-800',
}

const TERMINAL_REPAIR_STATUSES = ['RETURNED_TO_CLIENT', 'NOT_REPAIRED', 'REPAIRED', 'WRITTEN_OFF']

const PR_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  ORDERED: 'Encomendado',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Concluído',
}

const PR_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ORDERED: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
  COMPLETED: 'bg-purple-100 text-purple-800',
}

type ModalType = 'swap' | 'repair' | null

export default function WarehousePage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  const [tab, setTab] = useState<'stock' | 'requests' | 'client-parts' | 'inventory'>('stock')

  // ── Inventory ──────────────────────────────────────────────────────────────
  const [inventorySessions, setInventorySessions] = useState<Array<{
    id: string; type: string; technicianName: string | null; status: string
    createdByName: string; createdAt: string; totalItems: number; countedItems: number; discrepancies: number
  }>>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)

  const fetchInventorySessions = async () => {
    setInventoryLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/inventory', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setInventorySessions(Array.isArray(data) ? data : [])
    } finally {
      setInventoryLoading(false)
    }
  }

  // ── Stock ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [stockLoading, setStockLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Part Requests ──────────────────────────────────────────────────────────
  const [partRequests, setPartRequests] = useState<PartRequest[]>([])
  const [prLoading, setPrLoading] = useState(false)
  const [prStatusFilter, setPrStatusFilter] = useState('ALL')
  const [prSearch, setPrSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [transferModal, setTransferModal] = useState<PartRequest | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [snOptions, setSnOptions] = useState<SerialNumberOption[]>([])
  const [selectedSns, setSelectedSns] = useState<string[]>([])
  const [snLoading, setSnLoading] = useState(false)

  // ── Client Parts ───────────────────────────────────────────────────────────
  const [clientParts, setClientParts] = useState<ClientPart[]>([])
  const [cpLoading, setCpLoading] = useState(false)
  const [cpModal, setCpModal] = useState<ModalType>(null)
  // Return-to-tech modal
  const [returnModal, setReturnModal] = useState<ClientPart | null>(null)
  const [returnTechId, setReturnTechId] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([])
  const [cpSelected, setCpSelected] = useState<ClientPart | null>(null)
  const [cpNotes, setCpNotes] = useState('')
  const [cpProblem, setCpProblem] = useState('')
  const [cpSubmitting, setCpSubmitting] = useState(false)
  const [cpError, setCpError] = useState('')
  // SN swap state
  const [cpSnOptions, setCpSnOptions] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [cpSnLoading, setCpSnLoading] = useState(false)
  const [cpReplacementSnId, setCpReplacementSnId] = useState<string>('')
  const [cpClientSnMode, setCpClientSnMode] = useState<'auto' | 'manual'>('auto')
  const [cpClientSnValue, setCpClientSnValue] = useState('')

  useEffect(() => {
    fetchItems(1, searchTerm)
    fetchPartRequests()
    fetchClientParts()
  }, [])

  useEffect(() => {
    if (tab === 'requests') fetchPartRequests()
    if (tab === 'inventory') fetchInventorySessions()
    if (tab === 'client-parts') {
      fetchClientParts()
      if (technicians.length === 0) {
        const token = localStorage.getItem('token')
        fetch('/api/technicians', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => { if (Array.isArray(data)) setTechnicians(data) })
          .catch(() => {})
      }
    }
  }, [tab])

  // ── Stock fns ──────────────────────────────────────────────────────────────
  const fetchItems = async (page: number, search: string) => {
    setStockLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ page: String(page), search })
      const data: WarehousePage = await fetch(`/api/warehouse?${params}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setItems(data.items ?? []); setTotalPages(data.pages ?? 1); setTotalItems(data.total ?? 0); setCurrentPage(data.page ?? 1)
    } catch { /* ignore */ } finally { setStockLoading(false) }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => fetchItems(1, value), 350)
  }

  const goToPage = (page: number) => fetchItems(page, searchTerm)

  // ── Part Request fns ───────────────────────────────────────────────────────
  const fetchPartRequests = async () => {
    setPrLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch('/api/warehouse/part-requests', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setPartRequests(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally { setPrLoading(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/warehouse/part-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setPartRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } catch { /* ignore */ } finally { setUpdatingId(null) }
  }

  const openTransferModal = async (req: PartRequest) => {
    setTransferModal(req); setSelectedSns([])
    if (req.tracksSerialNumbers) {
      setSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const data = await fetch(`/api/warehouse/items/${req.warehouseItemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        setSnOptions(Array.isArray(data) ? data : [])
      } catch { setSnOptions([]) } finally { setSnLoading(false) }
    }
  }

  const executeTransfer = async () => {
    if (!transferModal) return
    const req = transferModal
    setTransferring(true)
    try {
      const token = localStorage.getItem('token')
      if (req.tracksSerialNumbers) {
        if (selectedSns.length === 0) return
        const res = await fetch('/api/warehouse/movements/serial', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ itemId: req.warehouseItemId, movementType: 'TRANSFER_TO_TECH', serialNumberIds: selectedSns, quantity: selectedSns.length, toUserId: req.requestedById }) })
        if (!res.ok) { alert((await res.json()).error || 'Erro ao transferir'); return }
      } else {
        const res = await fetch('/api/warehouse/movements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ itemId: req.warehouseItemId, movementType: 'TRANSFER_TO_TECH', quantity: req.quantity, toUserId: req.requestedById }) })
        if (!res.ok) { alert((await res.json()).error || 'Erro ao transferir'); return }
      }
      await fetch(`/api/warehouse/part-requests/${req.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'COMPLETED' }) })
      setPartRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'COMPLETED' } : r))
      setTransferModal(null)
    } catch { alert('Erro inesperado') } finally { setTransferring(false) }
  }

  const filteredRequests = partRequests
    .filter(r => prStatusFilter === 'ALL' || r.status === prStatusFilter)
    .filter(r => prSearch === '' || r.itemName.toLowerCase().includes(prSearch.toLowerCase()) || r.clientName.toLowerCase().includes(prSearch.toLowerCase()) || r.requesterName.toLowerCase().includes(prSearch.toLowerCase()) || (r.partNumber ?? '').toLowerCase().includes(prSearch.toLowerCase()))

  const pendingCount = partRequests.filter(r => r.status === 'PENDING' || r.status === 'RECEIVED').length

  // ── Client Parts fns ───────────────────────────────────────────────────────
  const fetchClientParts = useCallback(async () => {
    setCpLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch('/api/client-parts', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setClientParts(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally { setCpLoading(false) }
  }, [])

  const openCpModal = async (type: ModalType, part: ClientPart) => {
    setCpSelected(part); setCpModal(type); setCpNotes(''); setCpProblem(''); setCpError('')
    setCpReplacementSnId(''); setCpClientSnMode('auto'); setCpClientSnValue(''); setCpSnOptions([])
    if (type === 'swap' && part.tracksSerialNumbers) {
      setCpSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const data = await fetch(
          `/api/warehouse/items/${part.itemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json())
        setCpSnOptions(Array.isArray(data) ? data.filter((s: any) => !s.isClientPart) : [])
      } catch { setCpSnOptions([]) } finally { setCpSnLoading(false) }
    }
  }
  const closeCpModal = () => { setCpModal(null); setCpSelected(null); setCpError(''); setCpSnOptions([]) }

  const handleSwap = async () => {
    if (!cpSelected) return
    setCpSubmitting(true); setCpError('')
    try {
      const token = localStorage.getItem('token')
      const body: Record<string, any> = { notes: cpNotes }
      if (cpSelected.tracksSerialNumbers) {
        body.replacementSnId = cpReplacementSnId
        body.clientSnMode = cpClientSnMode
        if (cpClientSnMode === 'manual') body.clientSnValue = cpClientSnValue
      }
      const res = await fetch(`/api/client-parts/${cpSelected.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setCpError(data.error || 'Erro ao processar troca'); return }
      closeCpModal()
      router.push(`/${locale}/dashboard/repairs/${data.repairJobId}`)
    } finally { setCpSubmitting(false) }
  }

  const handleClientRepair = async () => {
    if (!cpSelected) return
    setCpSubmitting(true); setCpError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/client-parts/${cpSelected.id}/repair`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ problem: cpProblem }) })
      const data = await res.json()
      if (!res.ok) { setCpError(data.error || 'Erro ao abrir reparação'); return }
      closeCpModal()
      router.push(`/${locale}/dashboard/repairs/${data.repairJobId}`)
    } finally { setCpSubmitting(false) }
  }

  const handleReturnToTech = (part: ClientPart) => {
    setReturnModal(part)
    setReturnTechId(part.technicianId || '')
  }

  const submitReturnToTech = async () => {
    if (!returnModal || !returnTechId) return
    setReturnSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/client-parts/${returnModal.id}/return-to-tech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTechnicianId: returnTechId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Erro ao devolver peça'); return }
      setReturnModal(null)
      fetchClientParts()
    } catch { alert('Erro inesperado') }
    finally { setReturnSubmitting(false) }
  }

  const cpPendingCount = clientParts.filter(p => !p.clientPartStatus || p.clientPartStatus === 'PENDING').length

  return (
    <>
      <div className="px-4 sm:px-0 flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>
        {tab === 'stock' && (
          <button onClick={() => router.push(`/${locale}/dashboard/warehouse/new`)} className="btn btn-primary">
            {t('addItem')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('stock')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('title')}
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Pedidos de Peças
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('client-parts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === 'client-parts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Peças de Cliente
          {cpPendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-orange-400 text-white rounded-full">{cpPendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('inventory')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Inventário
        </button>
      </div>

      {/* ── Stock tab ───────────────────────────────────────────────────────── */}
      {tab === 'stock' && (
        <>
          <div className="card mb-6">
            <input type="text" className="input" placeholder={`${tCommon('search')}...`} value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          {stockLoading ? (
            <div className="flex items-center justify-center h-32"><div className="text-gray-600">{tCommon('loading')}</div></div>
          ) : items.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">{t('noItems')}</p>
              <button onClick={() => router.push(`/${locale}/dashboard/warehouse/new`)} className="btn btn-primary">{t('addItem')}</button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="card hover:shadow-lg transition-shadow cursor-pointer w-full" onClick={() => router.push(`/${locale}/dashboard/warehouse/${item.id}`)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{item.itemName}</h3>
                      {item.tracksSerialNumbers && <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">SN</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded text-sm font-medium">{item.mainWarehouse} <span className="font-normal text-blue-600">Armazém</span></span>
                      <span className="px-3 py-1.5 bg-green-50 text-green-800 rounded text-sm font-medium">{item.totalTechnicianStock} <span className="font-normal text-green-600">Técnicos</span></span>
                      {item.repairStock > 0 && <span className="px-3 py-1.5 bg-yellow-50 text-yellow-800 rounded text-sm font-medium">{item.repairStock} <span className="font-normal text-yellow-600">Reparação</span></span>}
                      {item.clientPartsCount > 0 && <span className="px-3 py-1.5 bg-orange-50 text-orange-800 rounded text-sm font-medium">{item.clientPartsCount} <span className="font-normal text-orange-600">Cliente</span></span>}
                      {item.destructionStock > 0 && <span className="px-3 py-1.5 bg-red-50 text-red-800 rounded text-sm font-medium">{item.destructionStock} <span className="font-normal text-red-600">Destruição</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {item.equipmentTypeName && <span><span className="text-gray-400">Tipo:</span> {item.equipmentTypeName}</span>}
                    {item.brandName && <span><span className="text-gray-400">Marca:</span> {item.brandName}</span>}
                    {item.partNumber && <span><span className="text-gray-400">{t('partNumber')}:</span> {item.partNumber}</span>}
                    <span className="ml-auto">€{item.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              <p className="text-sm text-gray-500">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || stockLoading} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
                <span className="text-sm text-gray-700">{currentPage} / {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages || stockLoading} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Próximo →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Part Requests tab ────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <>
          <div className="card mb-4 flex flex-col sm:flex-row gap-3">
            <input type="text" className="input flex-1" placeholder="Pesquisar peça, cliente, técnico..." value={prSearch} onChange={e => setPrSearch(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {(['ALL', 'PENDING', 'ORDERED', 'RECEIVED', 'COMPLETED', 'CANCELLED'] as const).map(s => (
                <button key={s} onClick={() => setPrStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${prStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {s === 'ALL' ? 'Todos' : PR_STATUS_LABEL[s]}{' '}({s === 'ALL' ? partRequests.length : partRequests.filter(r => r.status === s).length})
                </button>
              ))}
            </div>
          </div>

          {prLoading ? (
            <div className="text-center py-12 text-gray-500">{tCommon('loading')}</div>
          ) : filteredRequests.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">Nenhum pedido encontrado.</div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => (
                <div key={req.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{req.itemName}</span>
                        {req.partNumber && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{req.partNumber}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PR_STATUS_COLOR[req.status] ?? 'bg-gray-100 text-gray-600'}`}>{PR_STATUS_LABEL[req.status] ?? req.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                        <span className="font-medium text-gray-700">{req.clientName}</span>
                        {req.interventionReference && <span>#{req.interventionReference}</span>}
                        <span>Técnico: {req.requesterName}</span>
                        <span>Qtd: {req.quantity}</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      {req.notes && <p className="text-xs text-gray-500 mt-1 italic">{req.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {req.status === 'PENDING' && <button disabled={updatingId === req.id} onClick={() => updateStatus(req.id, 'ORDERED')} className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Marcar Encomendado</button>}
                      {req.status === 'ORDERED' && <button disabled={updatingId === req.id} onClick={() => updateStatus(req.id, 'RECEIVED')} className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Marcar Recebido</button>}
                      {req.status === 'RECEIVED' && <button onClick={() => openTransferModal(req)} className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Transferir para Técnico</button>}
                      {(req.status === 'PENDING' || req.status === 'ORDERED') && <button disabled={updatingId === req.id} onClick={() => updateStatus(req.id, 'CANCELLED')} className="text-xs px-2.5 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">Cancelar</button>}
                      <button onClick={() => router.push(`/${locale}/dashboard/interventions/${req.interventionId}`)} className="text-xs px-2.5 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">Ver Intervenção</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Client Parts tab ─────────────────────────────────────────────────── */}
      {tab === 'client-parts' && (
        <>
          {cpLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : clientParts.length === 0 ? (
            <div className="card text-center py-16 text-gray-500">Nenhuma peça pendente de decisão.</div>
          ) : (
            <div className="space-y-3">
              {clientParts.map(part => (
                <div key={part.id} className="card p-4">
                  {/* Top row: item info + status badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{part.itemName}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{part.partNumber}</p>
                    </div>
                    {part.clientPartStatus === 'REPAIR' && part.repairStatus && (
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${REPAIR_STATUS_COLORS[part.repairStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {REPAIR_STATUS_LABELS[part.repairStatus] ?? part.repairStatus}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                    <span className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{part.serialNumber}</span>
                    {part.clientName && <span><span className="text-gray-400">Cliente:</span> {part.clientName}</span>}
                    {part.interventionReference && (
                      <button
                        onClick={() => router.push(`/${locale}/dashboard/interventions/${part.interventionId}`)}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        {part.interventionReference}
                      </button>
                    )}
                    {(part.technicianName || part.pickedUpByName) && (
                      <span><span className="text-gray-400">Técnico:</span> {part.technicianName || part.pickedUpByName}</span>
                    )}
                    {part.repairReference && (
                      <span className="font-mono bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded">{part.repairReference}</span>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex flex-wrap gap-2">
                    {(!part.clientPartStatus || part.clientPartStatus === 'PENDING') && (
                      <>
                        <button
                          onClick={() => openCpModal('swap', part)}
                          disabled={part.mainWarehouse < 1}
                          title={part.mainWarehouse < 1 ? 'Sem stock disponível para substituição' : undefined}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Trocar{part.mainWarehouse < 1 ? ' (sem stock)' : ''}
                        </button>
                        <button onClick={() => openCpModal('repair', part)} className="px-3 py-1.5 text-xs font-medium rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                          Reparar
                        </button>
                      </>
                    )}
                    {part.clientPartStatus === 'REPAIR' && (
                      <>
                        {part.clientRepairJobId && (
                          <button onClick={() => router.push(`/${locale}/dashboard/repairs/${part.clientRepairJobId}`)} className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                            Ver reparação
                          </button>
                        )}
                        {part.repairStatus && TERMINAL_REPAIR_STATUSES.includes(part.repairStatus) && (
                          <button onClick={() => handleReturnToTech(part)} className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors">
                            Devolver ao Técnico
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Transfer to Tech modal ───────────────────────────────────────────── */}
      {transferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Transferir para Técnico</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{transferModal.itemName}</span>
              {transferModal.partNumber && <span className="text-gray-400 ml-1 font-mono text-xs">{transferModal.partNumber}</span>}
              <br />Técnico: <span className="font-medium">{transferModal.requesterName}</span>{' · '}Qtd pedida: <span className="font-medium">{transferModal.quantity}</span>
            </p>
            {transferModal.tracksSerialNumbers ? (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Selecionar números de série a transferir *</p>
                {snLoading ? <p className="text-sm text-gray-500">A carregar...</p> : snOptions.length === 0 ? (
                  <p className="text-sm text-red-600 bg-red-50 rounded p-3">Sem stock disponível no armazém principal.</p>
                ) : (
                  <div className="border rounded max-h-48 overflow-y-auto p-2 space-y-1">
                    {snOptions.map(sn => (
                      <label key={sn.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedSns.includes(sn.id)} onChange={() => setSelectedSns(prev => prev.includes(sn.id) ? prev.filter(x => x !== sn.id) : [...prev, sn.id])} className="w-4 h-4" />
                        <span className="text-sm font-mono">{sn.serialNumber}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedSns.length > 0 && <p className="text-xs text-gray-500 mt-1">{selectedSns.length} selecionado(s)</p>}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
                Serão transferidas <strong>{transferModal.quantity}</strong> unidade(s) do armazém principal para o técnico.
                {transferModal.mainWarehouse < transferModal.quantity && <p className="text-red-700 font-medium mt-1">⚠ Stock disponível ({transferModal.mainWarehouse}) inferior à quantidade pedida.</p>}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={executeTransfer} disabled={transferring || (transferModal.tracksSerialNumbers ? selectedSns.length === 0 : transferModal.mainWarehouse < 1)} className="btn btn-primary flex-1 disabled:opacity-50">{transferring ? 'A transferir...' : 'Confirmar Transferência'}</button>
              <button onClick={() => setTransferModal(null)} disabled={transferring} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return to tech modal ────────────────────────────────────────────── */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Devolver ao Técnico</h2>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{returnModal.itemName}</span>
                {returnModal.serialNumber && <span className="ml-1 font-mono text-xs text-gray-400">({returnModal.serialNumber})</span>}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Técnico que recebe a peça</label>
                <select
                  className="input text-gray-800"
                  value={returnTechId}
                  onChange={e => setReturnTechId(e.target.value)}
                >
                  <option value="">— Selecionar técnico —</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.id === returnModal.technicianId ? ' (original)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={submitReturnToTech}
                  disabled={returnSubmitting || !returnTechId}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {returnSubmitting ? 'A devolver...' : 'Confirmar'}
                </button>
                <button onClick={() => setReturnModal(null)} disabled={returnSubmitting} className="btn btn-secondary">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Swap modal ──────────────────────────────────────────────────────── */}
      {cpModal === 'swap' && cpSelected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Trocar Peça ao Cliente</h2>
              <p className="text-sm text-gray-500 mb-4">
                Uma unidade de <strong>{cpSelected.itemName}</strong> será retirada do stock normal e transferida para o técnico <strong>{cpSelected.technicianName || '—'}</strong>. A peça do cliente entra no nosso stock para reparação.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800 space-y-1">
                <div>— 1 unidade do stock normal ({cpSelected.mainWarehouse} disponível)</div>
                <div>+ 1 unidade no stock do técnico</div>
                <div>Peça do cliente abre reparação de stock (REP-xxx)</div>
              </div>

              {cpSelected.tracksSerialNumbers && (
                <>
                  {/* Replacement SN selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Peça de substituição <span className="text-red-500">*</span>
                      <span className="text-xs font-normal text-gray-400 ml-1">— selecionar SN a entregar ao técnico</span>
                    </label>
                    {cpSnLoading ? (
                      <p className="text-sm text-gray-500 py-2">A carregar...</p>
                    ) : cpSnOptions.length === 0 ? (
                      <p className="text-sm text-red-600 bg-red-50 rounded p-3">Sem números de série disponíveis no armazém principal.</p>
                    ) : (
                      <div className="border rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100">
                        {cpSnOptions.map(sn => (
                          <label key={sn.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              name="replacementSn"
                              value={sn.id}
                              checked={cpReplacementSnId === sn.id}
                              onChange={() => setCpReplacementSnId(sn.id)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-mono">{sn.serialNumber}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Client part SN */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nº série da peça recebida
                      <span className="text-xs font-normal text-gray-400 ml-1">— como registar no nosso stock</span>
                    </label>
                    <div className="flex gap-3 mb-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="clientSnMode" value="auto" checked={cpClientSnMode === 'auto'} onChange={() => setCpClientSnMode('auto')} className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Auto-gerar{cpSelected.snExample ? ` (${cpSelected.snExample}-N)` : ''}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="clientSnMode" value="manual" checked={cpClientSnMode === 'manual'} onChange={() => setCpClientSnMode('manual')} className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Especificar</span>
                      </label>
                    </div>
                    {cpClientSnMode === 'auto' && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                        Será gerado automaticamente com o prefixo <strong>{cpSelected.snExample || '?'}</strong>.
                        O SN do cliente (<span className="font-mono">{cpSelected.serialNumber}</span>) será substituído.
                      </p>
                    )}
                    {cpClientSnMode === 'manual' && (
                      <input
                        type="text"
                        className="input w-full text-sm font-mono"
                        placeholder={`ex: ${cpSelected.snExample ? cpSelected.snExample + '-X' : 'SN-001'}`}
                        value={cpClientSnValue}
                        onChange={e => setCpClientSnValue(e.target.value)}
                      />
                    )}
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea className="input w-full text-gray-800 resize-none" rows={2} placeholder="Observações..." value={cpNotes} onChange={e => setCpNotes(e.target.value)} />
              </div>
              {cpError && <p className="text-sm text-red-600 mb-3">{cpError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={closeCpModal} className="btn btn-secondary" disabled={cpSubmitting}>Cancelar</button>
              <button
                onClick={handleSwap}
                className="btn btn-primary"
                disabled={
                  cpSubmitting ||
                  (cpSelected.tracksSerialNumbers && (!cpReplacementSnId || cpSnOptions.length === 0)) ||
                  (cpSelected.tracksSerialNumbers && cpClientSnMode === 'manual' && !cpClientSnValue.trim())
                }
              >
                {cpSubmitting ? 'A processar...' : 'Confirmar Troca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory tab ───────────────────────────────────────────────────── */}
      {tab === 'inventory' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Contagens de stock realizadas</p>
            <button onClick={() => router.push(`/${locale}/dashboard/warehouse/inventory/new`)} className="btn btn-primary text-sm">
              + Nova Contagem
            </button>
          </div>
          {inventoryLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          ) : inventorySessions.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-gray-500">Nenhuma contagem realizada ainda.</p>
              <button onClick={() => router.push(`/${locale}/dashboard/warehouse/inventory/new`)} className="btn btn-primary mt-4">
                Iniciar primeira contagem
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Artigos</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Contados</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Divergências</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Criado por</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventorySessions.map(s => {
                    const statusLabel: Record<string, string> = { OPEN: 'Em contagem', PENDING_APPROVAL: 'Aguarda aprovação', CLOSED: 'Fechada', CANCELLED: 'Cancelada' }
                    const statusColor: Record<string, string> = { OPEN: 'bg-blue-100 text-blue-800', PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800', CLOSED: 'bg-green-100 text-green-800', CANCELLED: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/${locale}/dashboard/warehouse/inventory/${s.id}`)}>
                        <td className="px-4 py-3 text-gray-800">
                          {new Date(s.createdAt).toLocaleDateString('pt-PT')}
                          <div className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3">
                          {s.type === 'WAREHOUSE' ? <span className="font-medium text-gray-800">Armazém</span> : (
                            <div><span className="font-medium text-gray-800">Técnico</span><div className="text-xs text-gray-500">{s.technicianName}</div></div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[s.status] ?? 'bg-gray-100 text-gray-600'}`}>{statusLabel[s.status] ?? s.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{s.totalItems}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={s.countedItems === s.totalItems ? 'text-green-700 font-medium' : 'text-gray-700'}>{s.countedItems} / {s.totalItems}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.discrepancies > 0 ? <span className="text-red-600 font-semibold">{s.discrepancies}</span> : s.countedItems > 0 ? <span className="text-green-600">0</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.createdByName}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={e => { e.stopPropagation(); router.push(`/${locale}/dashboard/warehouse/inventory/${s.id}`) }} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Abrir →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Repair modal ────────────────────────────────────────────────────── */}
      {cpModal === 'repair' && cpSelected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Abrir Reparação de Cliente</h2>
              <p className="text-sm text-gray-500 mb-4">
                Será aberta uma reparação <strong>REC-xxx</strong> para <strong>{cpSelected.itemName}</strong> — série <strong>{cpSelected.serialNumber}</strong>. Após conclusão a peça volta ao técnico para entrega ao cliente.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Problema / Descrição</label>
                <textarea className="input w-full text-gray-800 resize-none" rows={3} placeholder="Descreva o problema..." value={cpProblem} onChange={e => setCpProblem(e.target.value)} />
              </div>
              {cpError && <p className="text-sm text-red-600 mb-3">{cpError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={closeCpModal} className="btn btn-secondary" disabled={cpSubmitting}>Cancelar</button>
              <button onClick={handleClientRepair} className="btn btn-primary" disabled={cpSubmitting}>{cpSubmitting ? 'A criar...' : 'Abrir Reparação'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
