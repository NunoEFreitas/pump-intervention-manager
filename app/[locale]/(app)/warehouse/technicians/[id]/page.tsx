'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface ClientPartEntry {
  id: string
  serialNumber: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  interventionReference: string | null
}

interface PreSwappedItem {
  id: string
  itemId: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  interventionReference: string | null
  workOrderId: string | null
}

interface StockItem {
  itemId: string
  itemName: string
  partNumber: string
  value: number
  quantity: number
  totalValue: number
  mainWarehouseStock: number
  tracksSerialNumbers: boolean
  serialNumbers?: Array<{ id: string; serialNumber: string }>
  clientParts: ClientPartEntry[]
}

interface Movement {
  id: string
  movementType: string
  quantity: number
  notes: string | null
  createdAt: string
  itemId: string
  itemName: string
  partNumber: string
  fromUserName: string | null
  toUserName: string | null
  createdByName: string
  serialNumbers: string[]
}

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  mainWarehouse: number
  tracksSerialNumbers: boolean
}

interface InTransitItem {
  id: string
  itemId: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  faultDescription: string | null
  interventionReference: string | null
  workOrderId: string | null
}

interface ReturningItem {
  id: string
  itemId: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  clientItemSn: string | null
  faultDescription: string | null
  interventionReference: string | null
}

interface TechnicianDetails {
  id: string
  name: string
  email: string
  totalItems: number
  totalValue: number
  stocks: StockItem[]
  preSwappedItems: PreSwappedItem[]
  inTransitItems: InTransitItem[]
  returningItems: ReturningItem[]
}

const MOVEMENT_LABELS: Record<string, string> = {
  TRANSFER_TO_TECH: 'Entrada do Armazém',
  TRANSFER_FROM_TECH: 'Recolha de Cliente',
  USE: 'Entregue ao Cliente',
  REPAIR_IN: 'Enviado para Reparação',
  REPAIR_OUT: 'Retorno de Reparação',
  ADD_STOCK: 'Entregue no Armazém',
  REMOVE_STOCK: 'Remoção de Stock',
  DESTRUCTION: 'Abate',
  INVENTORY_ADJUSTMENT: 'Ajuste de Inventário',
}

const MOVEMENT_COLORS: Record<string, string> = {
  TRANSFER_TO_TECH: 'bg-green-100 text-green-800',
  TRANSFER_FROM_TECH: 'bg-blue-100 text-blue-800',
  USE: 'bg-purple-100 text-purple-800',
  REPAIR_IN: 'bg-orange-100 text-orange-800',
  REPAIR_OUT: 'bg-teal-100 text-teal-800',
  ADD_STOCK: 'bg-teal-100 text-teal-800',
  REMOVE_STOCK: 'bg-red-100 text-red-800',
  DESTRUCTION: 'bg-gray-100 text-gray-700',
  INVENTORY_ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
}

export default function TechnicianStockPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [technician, setTechnician] = useState<TechnicianDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock')

  // Movements
  const [movements, setMovements] = useState<Movement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movPage, setMovPage] = useState(1)
  const [movPages, setMovPages] = useState(1)
  const [movTotal, setMovTotal] = useState(0)

  // Add new item modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<WarehouseItem | null>(null)
  const [addQty, setAddQty] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  const [snOptions, setSnOptions] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [snLoading, setSnLoading] = useState(false)
  const [selectedSnIds, setSelectedSnIds] = useState<string[]>([])

  // Return modal
  const [returnModal, setReturnModal] = useState<StockItem | null>(null)
  const [returnSnIds, setReturnSnIds] = useState<string[]>([])
  const [returnSnOptions, setReturnSnOptions] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [returnSnLoading, setReturnSnLoading] = useState(false)
  const [returnQty, setReturnQty] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)

  useEffect(() => {
    if (params.id) fetchTechnicianStock()
  }, [params.id])

  const fetchTechnicianStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/technicians/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTechnician(await response.json())
    } catch (error) {
      console.error('Error fetching technician stock:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMovements = useCallback(async (page: number) => {
    setMovementsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(
        `/api/warehouse/technicians/${params.id}/movements?page=${page}&limit=25`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json())
      setMovements(Array.isArray(data.movements) ? data.movements : [])
      setMovTotal(data.total ?? 0)
      setMovPages(data.pages ?? 1)
      setMovPage(page)
    } catch { /* ignore */ } finally { setMovementsLoading(false) }
  }, [params.id])

  useEffect(() => {
    if (activeTab === 'history' && params.id) fetchMovements(1)
  }, [activeTab])

  const fetchSnOptions = async (itemId: string, location: 'MAIN_WAREHOUSE' | 'TECHNICIAN', setter: typeof setSnOptions) => {
    const loadingSetter = setter === setSnOptions ? setSnLoading : setReturnSnLoading
    loadingSetter(true)
    setter([])
    try {
      const token = localStorage.getItem('token')
      const url = location === 'TECHNICIAN'
        ? `/api/warehouse/items/${itemId}/serial-numbers?location=TECHNICIAN&technicianId=${params.id}`
        : `/api/warehouse/items/${itemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`
      const data = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setter(Array.isArray(data) ? data.filter((s: any) => !s.isClientPart) : [])
    } catch { setter([]) } finally { loadingSetter(false) }
  }

  const openAddModal = async () => {
    setItemSearch(''); setSelectedWarehouseItem(null); setAddQty('1'); setAddNotes(''); setAddError('')
    setSnOptions([]); setSelectedSnIds([])
    setShowAddModal(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch('/api/warehouse?limit=200', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      const list = Array.isArray(data) ? data : (data.items ?? [])
      setWarehouseItems(list.filter((i: any) => i.mainWarehouse > 0).map((i: any) => ({
        id: i.id, itemName: i.itemName, partNumber: i.partNumber, mainWarehouse: i.mainWarehouse, tracksSerialNumbers: i.tracksSerialNumbers,
      })))
    } catch { setWarehouseItems([]) }
  }

  const selectWarehouseItem = async (item: WarehouseItem) => {
    setSelectedWarehouseItem(item); setItemSearch(item.itemName); setAddQty('1')
    if (item.tracksSerialNumbers) await fetchSnOptions(item.id, 'MAIN_WAREHOUSE', setSnOptions)
    else { setSnOptions([]); setSelectedSnIds([]) }
  }

  const handleAddNewItem = async () => {
    if (!selectedWarehouseItem) return
    setAddSubmitting(true); setAddError('')
    try {
      const token = localStorage.getItem('token')
      const isSn = selectedWarehouseItem.tracksSerialNumbers
      const url = isSn ? '/api/warehouse/movements/serial' : '/api/warehouse/movements'
      const body = isSn
        ? { itemId: selectedWarehouseItem.id, movementType: 'TRANSFER_TO_TECH', serialNumberIds: selectedSnIds, toUserId: params.id, notes: addNotes || undefined }
        : { itemId: selectedWarehouseItem.id, movementType: 'TRANSFER_TO_TECH', quantity: parseInt(addQty), toUserId: params.id, notes: addNotes || undefined }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Erro ao transferir'); return }
      setShowAddModal(false)
      fetchTechnicianStock()
    } catch { setAddError('Erro inesperado') }
    finally { setAddSubmitting(false) }
  }

  const openReturnModal = async (stock: StockItem) => {
    setReturnModal(stock); setReturnQty(''); setReturnNotes(''); setReturnSnIds([])
    if (stock.tracksSerialNumbers) {
      await fetchSnOptions(stock.itemId, 'TECHNICIAN', setReturnSnOptions)
    }
  }

  const handleReturn = async () => {
    if (!returnModal) return
    const isSn = returnModal.tracksSerialNumbers
    if (isSn && returnSnIds.length === 0) return
    if (!isSn && !returnQty) return
    setReturnSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const url = isSn ? '/api/warehouse/movements/serial' : '/api/warehouse/movements'
      const body = isSn
        ? { itemId: returnModal.itemId, movementType: 'TRANSFER_FROM_TECH', serialNumberIds: returnSnIds, fromUserId: params.id, notes: returnNotes || undefined }
        : { itemId: returnModal.itemId, movementType: 'TRANSFER_FROM_TECH', quantity: parseInt(returnQty), fromUserId: params.id, notes: returnNotes || undefined }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Erro ao devolver'); return }
      setReturnModal(null)
      fetchTechnicianStock()
    } catch { alert('Erro inesperado') }
    finally { setReturnSubmitting(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><span className="text-gray-600">{tCommon('loading')}</span></div>
  }

  if (!technician) {
    return <div className="card text-center py-8 text-gray-600">Técnico não encontrado.</div>
  }

  const preSwappedItems = technician.preSwappedItems ?? []
  const inTransitItems = technician.inTransitItems ?? []
  const returningItems = technician.returningItems ?? []

  return (
    <div>
      <button onClick={() => router.push(`/${locale}/warehouse/technicians`)} className="text-blue-600 hover:text-blue-800 mb-6 block text-sm">
        ← {tCommon('back')}
      </button>

      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{technician.name}</h1>
            <p className="text-sm text-gray-500">{technician.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {preSwappedItems.length > 0 && (
              <span className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded text-sm font-medium">
                {preSwappedItems.length} <span className="font-normal text-amber-600">para devolver</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['stock', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'stock' ? 'Stock Atual' : 'Histórico de Movimentos'}
          </button>
        ))}
      </div>

      {/* Stock tab */}
      {activeTab === 'stock' && (
        <div className="space-y-3">
          {/* PreSwapped items — parts collected from client pending warehouse return */}
          {preSwappedItems.map(item => (
            <div key={item.id} className="card border-amber-300 bg-amber-50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-300 text-amber-900 rounded uppercase tracking-wide shrink-0">Devolver ao Armazém</span>
                <span className="text-base font-semibold text-gray-900">{item.itemName}</span>
                {item.partNumber !== '__GENERIC__' && <span className="text-xs font-mono text-gray-400">{item.partNumber}</span>}
                {item.serialNumber && (
                  <span className="font-mono text-xs bg-white border border-amber-200 text-gray-700 px-1.5 py-0.5 rounded">{item.serialNumber}</span>
                )}
                {item.interventionReference && (
                  <span className="text-xs text-gray-500 ml-auto shrink-0">Int. #{item.interventionReference}</span>
                )}
              </div>
            </div>
          ))}

          {/* RETURNING items — repaired/swapped, assigned to this tech for client delivery */}
          {returningItems.map(item => (
            <div key={item.id} className="card border-green-200 bg-green-50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-bold bg-green-200 text-green-900 rounded uppercase tracking-wide shrink-0">A Entregar ao Cliente</span>
                <span className="text-base font-semibold text-gray-900">{item.itemName}</span>
                {item.partNumber !== '__GENERIC__' && <span className="text-xs font-mono text-gray-400">{item.partNumber}</span>}
                {item.serialNumber && (
                  <span className="font-mono text-xs bg-white border border-green-200 text-gray-700 px-1.5 py-0.5 rounded">{item.serialNumber}</span>
                )}
                {item.clientItemSn && (
                  <span className="font-mono text-xs bg-white border border-green-200 text-gray-700 px-1.5 py-0.5 rounded">{item.clientItemSn}</span>
                )}
                {item.interventionReference && (
                  <span className="text-xs text-gray-500 ml-auto shrink-0">Int. #{item.interventionReference}</span>
                )}
              </div>
              {item.faultDescription && (
                <p className="text-xs text-gray-500 italic mt-1">{item.faultDescription}</p>
              )}
            </div>
          ))}

          {/* IN_TRANSIT items — collected from client, not yet at warehouse */}
          {inTransitItems.map(item => (
            <div key={item.id} className="card border-blue-200 bg-blue-50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-200 text-blue-900 rounded uppercase tracking-wide shrink-0">Recolhida</span>
                <span className="text-base font-semibold text-gray-900">{item.itemName}</span>
                {item.partNumber !== '__GENERIC__' && <span className="text-xs font-mono text-gray-400">{item.partNumber}</span>}
                {item.serialNumber && (
                  <span className="font-mono text-xs bg-white border border-blue-200 text-gray-700 px-1.5 py-0.5 rounded">{item.serialNumber}</span>
                )}
                {item.interventionReference && (
                  <span className="text-xs text-gray-500 ml-auto shrink-0">Int. #{item.interventionReference}</span>
                )}
              </div>
              {item.faultDescription && (
                <p className="text-xs text-gray-500 italic mt-1">{item.faultDescription}</p>
              )}
            </div>
          ))}

          {technician.stocks.length === 0 && preSwappedItems.length === 0 && inTransitItems.length === 0 && returningItems.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">Nenhum artigo atribuído a este técnico.</div>
          ) : technician.stocks.length === 0 ? null : (
            technician.stocks.map(stock => {
              const qty = stock.tracksSerialNumbers ? (stock.serialNumbers?.length ?? 0) : stock.quantity
              return (
                <div key={stock.itemId} className="card">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      className="text-base font-semibold text-blue-700 hover:underline text-left"
                      onClick={() => router.push(`/${locale}/warehouse/${stock.itemId}`)}
                    >
                      {stock.itemName}
                    </button>
                    {stock.tracksSerialNumbers && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">SN</span>
                    )}
                    {stock.partNumber && <span className="text-xs font-mono text-gray-400">{stock.partNumber}</span>}
                    <div className="ml-auto">
                      <span className="px-3 py-1 bg-purple-50 text-purple-800 rounded text-sm font-semibold">
                        {qty} <span className="font-normal text-purple-600">un.</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mt-0.5">
                    Armazém principal: {stock.mainWarehouseStock} un.
                  </div>

                  {/* Serial numbers */}
                  {stock.tracksSerialNumbers && stock.serialNumbers && stock.serialNumbers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stock.serialNumbers.map(sn => (
                        <span key={sn.id} className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded text-xs font-mono">
                          {sn.serialNumber}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Client parts */}
                  {stock.clientParts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      <p className="text-xs font-medium text-gray-500 mb-1">Peças de cliente ({stock.clientParts.length})</p>
                      {stock.clientParts.map(cp => (
                        <div key={cp.id} className="flex items-center gap-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs">
                          <span className="text-orange-700 font-medium shrink-0">Cliente</span>
                          {cp.serialNumber && <span className="font-mono text-gray-700">{cp.serialNumber}</span>}
                          {cp.faultDescription && <span className="text-gray-500 truncate max-w-[200px] italic">{cp.faultDescription}</span>}
                          {cp.interventionReference && <span className="text-gray-400 font-mono ml-auto shrink-0">#{cp.interventionReference}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* History tab */}

      {activeTab === 'history' && (
        <div>
          {movementsLoading ? (
            <div className="card text-center py-10 text-gray-500">{tCommon('loading')}</div>
          ) : movements.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">Sem movimentos registados.</div>
          ) : (
            <>
              <div className="space-y-2">
                {movements.map(mov => (
                  <div key={mov.id} className="card">
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded shrink-0 mt-0.5 ${MOVEMENT_COLORS[mov.movementType] ?? 'bg-gray-100 text-gray-600'}`}>
                        {MOVEMENT_LABELS[mov.movementType] ?? mov.movementType}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          className="text-sm font-semibold text-blue-700 hover:underline"
                          onClick={() => router.push(`/${locale}/warehouse/${mov.itemId}`)}
                        >
                          {mov.itemName}
                        </button>
                        {mov.partNumber && <span className="text-xs font-mono text-gray-400 ml-2">{mov.partNumber}</span>}
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {mov.quantity > 0 && <span>Qtd: <span className="font-medium text-gray-700">{mov.quantity}</span></span>}
                          {mov.fromUserName && <span>De: <span className="font-medium text-gray-700">{mov.fromUserName}</span></span>}
                          {mov.toUserName && <span>Para: <span className="font-medium text-gray-700">{mov.toUserName}</span></span>}
                          {mov.createdByName && <span>Reg. por: {mov.createdByName}</span>}
                          {mov.notes && <span className="italic text-gray-400">{mov.notes}</span>}
                        </div>
                        {mov.serialNumbers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {mov.serialNumbers.map(sn => (
                              <span key={sn} className="px-1.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-xs font-mono">{sn}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(mov.createdAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {movPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                  <span>{movTotal} movimentos · página {movPage} de {movPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => fetchMovements(movPage - 1)} disabled={movPage <= 1} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
                    <button onClick={() => fetchMovements(movPage + 1)} disabled={movPage >= movPages} className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Seguinte →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add item modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Adicionar Artigo ao Técnico</h3>
              <div className="mb-4">
                <input type="text" className="input w-full mb-2" placeholder="Pesquisar artigo..." value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setSelectedWarehouseItem(null); setSnOptions([]); setSelectedSnIds([]) }} autoFocus />
                {(() => {
                  const filtered = warehouseItems.filter(i =>
                    i.itemName.toLowerCase().includes(itemSearch.toLowerCase()) ||
                    i.partNumber.toLowerCase().includes(itemSearch.toLowerCase())
                  )
                  return !selectedWarehouseItem && filtered.length > 0 ? (
                    <div className="border rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {filtered.map(i => (
                        <button key={i.id} type="button" onClick={() => selectWarehouseItem(i)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{i.itemName}</span>
                            {i.partNumber && <span className="text-xs text-gray-400 ml-2 font-mono">{i.partNumber}</span>}
                            {i.tracksSerialNumbers && <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1 rounded">SN</span>}
                          </div>
                          <span className="text-xs text-blue-700 font-medium shrink-0 ml-2">{i.mainWarehouse} disp.</span>
                        </button>
                      ))}
                    </div>
                  ) : !selectedWarehouseItem && itemSearch ? (
                    <p className="text-sm text-gray-400 px-1">Nenhum artigo com stock disponível.</p>
                  ) : null
                })()}
              </div>

              {selectedWarehouseItem && (
                selectedWarehouseItem.tracksSerialNumbers ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar números de série *</label>
                    {snLoading ? <p className="text-sm text-gray-400">A carregar...</p> : snOptions.length === 0 ? (
                      <p className="text-sm text-red-600 bg-red-50 rounded p-2">Sem SNs disponíveis no armazém.</p>
                    ) : (
                      <div className="border rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                        {snOptions.map(sn => (
                          <label key={sn.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={selectedSnIds.includes(sn.id)}
                              onChange={() => setSelectedSnIds(prev => prev.includes(sn.id) ? prev.filter(x => x !== sn.id) : [...prev, sn.id])}
                              className="w-4 h-4" />
                            <span className="text-sm font-mono">{sn.serialNumber}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedSnIds.length > 0 && <p className="text-xs text-gray-500 mt-1">{selectedSnIds.length} selecionado(s)</p>}
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
                    <input type="number" min="1" max={selectedWarehouseItem.mainWarehouse} className="input w-full"
                      value={addQty} onChange={e => setAddQty(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">Disponível no armazém: {selectedWarehouseItem.mainWarehouse}</p>
                  </div>
                )
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea className="input w-full resize-none" rows={2} value={addNotes} onChange={e => setAddNotes(e.target.value)} />
              </div>

              {addError && <p className="text-sm text-red-600 mb-3">{addError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary" disabled={addSubmitting}>Cancelar</button>
              <button onClick={handleAddNewItem} className="btn btn-primary" disabled={
                addSubmitting || !selectedWarehouseItem ||
                (selectedWarehouseItem.tracksSerialNumbers ? selectedSnIds.length === 0 : !addQty || parseInt(addQty) < 1)
              }>
                {addSubmitting ? 'A transferir...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to warehouse modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Devolver ao Armazém</h3>
            <p className="text-sm text-gray-500 mb-4">{returnModal.itemName}</p>

            {returnModal.tracksSerialNumbers ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar números de série *</label>
                {returnSnLoading ? <p className="text-sm text-gray-400">A carregar...</p> : returnSnOptions.length === 0 ? (
                  <p className="text-sm text-red-600 bg-red-50 rounded p-2">Sem SNs com o técnico.</p>
                ) : (
                  <div className="border rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {returnSnOptions.map(sn => (
                      <label key={sn.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={returnSnIds.includes(sn.id)}
                          onChange={() => setReturnSnIds(prev => prev.includes(sn.id) ? prev.filter(x => x !== sn.id) : [...prev, sn.id])}
                          className="w-4 h-4" />
                        <span className="text-sm font-mono">{sn.serialNumber}</span>
                      </label>
                    ))}
                  </div>
                )}
                {returnSnIds.length > 0 && <p className="text-xs text-gray-500 mt-1">{returnSnIds.length} selecionado(s)</p>}
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
                <input type="number" min="1" max={returnModal.quantity} className="input w-full"
                  value={returnQty} onChange={e => setReturnQty(e.target.value)} autoFocus />
                <p className="text-xs text-gray-400 mt-1">Com o técnico: {returnModal.quantity} un.</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea className="input w-full resize-none" rows={2} value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReturn}
                disabled={returnSubmitting || (returnModal.tracksSerialNumbers ? returnSnIds.length === 0 : !returnQty)}
                className="btn btn-primary flex-1"
              >
                {returnSubmitting ? 'A devolver...' : 'Confirmar Devolução'}
              </button>
              <button onClick={() => setReturnModal(null)} className="btn btn-secondary">{tCommon('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
