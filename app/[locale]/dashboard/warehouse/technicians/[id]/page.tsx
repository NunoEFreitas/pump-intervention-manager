'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface ClientPartEntry {
  id: string
  serialNumber: string | null
  faultDescription: string | null
  clientPartStatus: string | null
  interventionReference: string | null
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

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  mainWarehouse: number
  tracksSerialNumbers: boolean
}

interface TechnicianDetails {
  id: string
  name: string
  email: string
  totalItems: number
  totalValue: number
  stocks: StockItem[]
}

export default function TechnicianStockPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [technician, setTechnician] = useState<TechnicianDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalAction, setModalAction] = useState<'add' | 'remove'>('add')
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [snExpanded, setSnExpanded] = useState<Record<string, boolean>>({})

  // Add new item modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<WarehouseItem | null>(null)
  const [addQty, setAddQty] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  // SN selection (shared between add-new and add-existing modals)
  const [snOptions, setSnOptions] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [snLoading, setSnLoading] = useState(false)
  const [selectedSnIds, setSelectedSnIds] = useState<string[]>([])

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

  const handleCancelClientPart = async (cpId: string) => {
    if (!confirm('Cancelar a recolha desta peça de cliente? Esta ação é irreversível.')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/client-parts/${cpId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Erro ao cancelar'); return }
      fetchTechnicianStock()
    } catch { alert('Erro inesperado') }
  }

  const fetchSnOptions = async (itemId: string, location: 'MAIN_WAREHOUSE' | 'TECHNICIAN') => {
    setSnLoading(true); setSnOptions([]); setSelectedSnIds([])
    try {
      const token = localStorage.getItem('token')
      const url = location === 'TECHNICIAN'
        ? `/api/warehouse/items/${itemId}/serial-numbers?location=TECHNICIAN&technicianId=${params.id}`
        : `/api/warehouse/items/${itemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`
      const data = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setSnOptions(Array.isArray(data) ? data.filter((s: any) => !s.isClientPart) : [])
    } catch { setSnOptions([]) } finally { setSnLoading(false) }
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
    if (item.tracksSerialNumbers) await fetchSnOptions(item.id, 'MAIN_WAREHOUSE')
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

  const openModal = async (action: 'add' | 'remove', item: StockItem) => {
    setModalAction(action); setSelectedItem(item); setQuantity(''); setNotes('')
    setSnOptions([]); setSelectedSnIds([])
    setShowModal(true)
    if (item.tracksSerialNumbers) {
      await fetchSnOptions(item.itemId, action === 'add' ? 'MAIN_WAREHOUSE' : 'TECHNICIAN')
    }
  }

  const handleStockOperation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    const movementType = modalAction === 'add' ? 'TRANSFER_TO_TECH' : 'TRANSFER_FROM_TECH'
    const isSn = selectedItem.tracksSerialNumbers
    if (isSn && selectedSnIds.length === 0) return
    if (!isSn && !quantity) return
    try {
      const token = localStorage.getItem('token')
      const url = isSn ? '/api/warehouse/movements/serial' : '/api/warehouse/movements'
      const body = isSn
        ? { itemId: selectedItem.itemId, movementType, serialNumberIds: selectedSnIds, toUserId: modalAction === 'add' ? params.id : undefined, fromUserId: modalAction === 'remove' ? params.id : undefined, notes: notes || undefined }
        : { itemId: selectedItem.itemId, movementType, quantity: parseInt(quantity), toUserId: modalAction === 'add' ? params.id : undefined, fromUserId: modalAction === 'remove' ? params.id : undefined, notes: notes || undefined }
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      if (response.ok) {
        setShowModal(false)
        fetchTechnicianStock()
      } else {
        const data = await response.json()
        alert(data.error || t('operationFailed'))
      }
    } catch (error) {
      console.error('Error performing stock operation:', error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><span className="text-gray-600">{tCommon('loading')}</span></div>
  }

  if (!technician) {
    return <div className="card text-center py-8 text-gray-600">Técnico não encontrado.</div>
  }

  return (
    <div>
      <button onClick={() => router.push(`/${locale}/dashboard/warehouse/technicians`)} className="text-blue-600 hover:text-blue-800 mb-6 block">
        ← {tCommon('back')}
      </button>

      {/* Summary */}
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{technician.name}</h1>
            <p className="text-sm text-gray-500">{technician.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded text-sm font-medium">
              {technician.totalItems} <span className="font-normal text-blue-600">{t('totalItems')}</span>
            </span>
            <button onClick={openAddModal} className="btn btn-primary text-sm">+ Adicionar Artigo</button>
          </div>
        </div>
      </div>

      {/* Stock items */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('technicianStockDetails')}</h2>

        {technician.stocks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum artigo atribuído a este técnico.</p>
        ) : (
          <div className="space-y-3">
            {technician.stocks.map((stock) => (
              <div key={stock.itemId} className="border rounded-lg p-3">
                {/* Main row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="text-base font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                      onClick={() => router.push(`/${locale}/dashboard/warehouse/${stock.itemId}`)}
                    >
                      {stock.itemName}
                    </span>
                    {stock.tracksSerialNumbers && (
                      <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">SN</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 bg-purple-50 text-purple-800 rounded text-sm font-medium">
                      {stock.tracksSerialNumbers ? (stock.serialNumbers?.length ?? 0) : stock.quantity} <span className="font-normal text-purple-600">un.</span>
                    </span>
                    <button
                      onClick={() => openModal('add', stock)}
                      className="btn btn-primary text-sm py-1 px-3"
                      disabled={stock.mainWarehouseStock === 0}
                    >
                      + Adicionar
                    </button>
                    <button
                      onClick={() => openModal('remove', stock)}
                      className="btn btn-secondary text-sm py-1 px-3"
                      disabled={(stock.tracksSerialNumbers ? stock.serialNumbers?.length ?? 0 : stock.quantity) === 0}
                    >
                      − Devolver
                    </button>
                  </div>
                </div>

                {/* Secondary info */}
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  {stock.partNumber && <span><span className="text-gray-400">{t('partNumber')}:</span> {stock.partNumber}</span>}
                  <span><span className="text-gray-400">{t('mainWarehouse')}:</span> {stock.mainWarehouseStock}</span>
                </div>

                {/* Serial numbers — collapsible */}
                {stock.tracksSerialNumbers && stock.serialNumbers && stock.serialNumbers.length > 0 && (
                  <div className="mt-2">
                    <button type="button" onClick={() => setSnExpanded(e => ({ ...e, [stock.itemId]: !e[stock.itemId] }))} className="text-xs text-purple-600 hover:underline">
                      {snExpanded[stock.itemId] ? '▲' : '▼'} {stock.serialNumbers.length} número(s) de série
                    </button>
                    {snExpanded[stock.itemId] && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {stock.serialNumbers.map(sn => (
                          <span key={sn.id} className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-xs font-mono">{sn.serialNumber}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Client parts — read-only section */}
                {stock.clientParts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-1.5">Peças de Cliente ({stock.clientParts.length})</p>
                    <div className="space-y-1">
                      {stock.clientParts.map(cp => (
                        <div key={cp.id} className="flex items-center gap-2 px-2 py-1 bg-orange-50 rounded border border-orange-200 text-xs">
                          <span className="text-orange-700 font-medium shrink-0">Cliente</span>
                          {cp.serialNumber && <span className="font-mono text-gray-700">{cp.serialNumber}</span>}
                          {cp.faultDescription && <span className="text-gray-500 truncate max-w-[160px]">{cp.faultDescription}</span>}
                          {cp.interventionReference && <span className="text-gray-400 font-mono">{cp.interventionReference}</span>}
                          <button
                            onClick={() => handleCancelClientPart(cp.id)}
                            className="ml-auto shrink-0 px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Cancelar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new item modal */}
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
                    <p className="text-sm text-gray-400 px-1">Nenhum artigo encontrado com stock disponível.</p>
                  ) : null
                })()}
              </div>

              {selectedWarehouseItem && (
                selectedWarehouseItem.tracksSerialNumbers ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar números de série <span className="text-red-500">*</span></label>
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
                {addSubmitting ? 'A transferir...' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock operation modal (add/return for existing items) */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {modalAction === 'add' ? t('transferToTech') : t('transferFromTech')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{selectedItem.itemName}</p>

            <form onSubmit={handleStockOperation} className="space-y-4">
              {selectedItem.tracksSerialNumbers ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar números de série *</label>
                  {snLoading ? <p className="text-sm text-gray-400">A carregar...</p> : snOptions.length === 0 ? (
                    <p className="text-sm text-red-600 bg-red-50 rounded p-2">
                      {modalAction === 'add' ? 'Sem SNs disponíveis no armazém.' : 'Sem SNs com o técnico.'}
                    </p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity')} *</label>
                  <input type="number" min="1" max={modalAction === 'add' ? selectedItem.mainWarehouseStock : selectedItem.quantity}
                    className="input text-gray-800" value={quantity} onChange={e => setQuantity(e.target.value)} required autoFocus />
                  <p className="text-xs text-gray-400 mt-1">
                    {modalAction === 'add' ? `${t('available')}: ${selectedItem.mainWarehouseStock} (armazém)` : `${t('available')}: ${selectedItem.quantity} (técnico)`}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
                <textarea className="input text-gray-800" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary flex-1"
                  disabled={selectedItem.tracksSerialNumbers ? selectedSnIds.length === 0 : !quantity}>
                  {tCommon('save')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{tCommon('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
