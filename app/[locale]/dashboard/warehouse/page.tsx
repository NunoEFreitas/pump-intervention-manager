'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  value: number
  mainWarehouse: number
  tracksSerialNumbers: boolean
  totalTechnicianStock: number
  totalStock: number
  technicianStocks: Array<{
    technician: { id: string; name: string }
    quantity: number
  }>
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

export default function WarehousePage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [tab, setTab] = useState<'stock' | 'requests'>('stock')

  // Stock
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [stockLoading, setStockLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Part Requests
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

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    if (tab === 'requests') fetchPartRequests()
  }, [tab])

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error('Error fetching warehouse items:', error)
    } finally {
      setStockLoading(false)
    }
  }

  const fetchPartRequests = async () => {
    setPrLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/warehouse/part-requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setPartRequests(Array.isArray(data) ? data : [])
    } catch { /* non-blocking */ }
    finally { setPrLoading(false) }
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
      if (res.ok) {
        setPartRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      }
    } catch { /* non-blocking */ }
    finally { setUpdatingId(null) }
  }

  const openTransferModal = async (req: PartRequest) => {
    setTransferModal(req)
    setSelectedSns([])
    if (req.tracksSerialNumbers) {
      setSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(
          `/api/warehouse/items/${req.warehouseItemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        setSnOptions(Array.isArray(data) ? data : [])
      } catch { setSnOptions([]) }
      finally { setSnLoading(false) }
    }
  }

  const executeTransfer = async () => {
    if (!transferModal) return
    const req = transferModal
    setTransferring(true)
    try {
      const token = localStorage.getItem('token')

      // Create stock movement
      if (req.tracksSerialNumbers) {
        if (selectedSns.length === 0) return
        const moveRes = await fetch('/api/warehouse/movements/serial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: req.warehouseItemId,
            movementType: 'TRANSFER_TO_TECH',
            serialNumberIds: selectedSns,
            quantity: selectedSns.length,
            toUserId: req.requestedById,
          }),
        })
        if (!moveRes.ok) {
          const err = await moveRes.json()
          alert(err.error || 'Erro ao transferir stock')
          return
        }
      } else {
        const moveRes = await fetch('/api/warehouse/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: req.warehouseItemId,
            movementType: 'TRANSFER_TO_TECH',
            quantity: req.quantity,
            toUserId: req.requestedById,
          }),
        })
        if (!moveRes.ok) {
          const err = await moveRes.json()
          alert(err.error || 'Erro ao transferir stock')
          return
        }
      }

      // Mark request as COMPLETED
      await fetch(`/api/warehouse/part-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })

      setPartRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'COMPLETED' } : r))
      setTransferModal(null)
    } catch { alert('Erro inesperado') }
    finally { setTransferring(false) }
  }

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRequests = partRequests
    .filter(r => prStatusFilter === 'ALL' || r.status === prStatusFilter)
    .filter(r =>
      prSearch === '' ||
      r.itemName.toLowerCase().includes(prSearch.toLowerCase()) ||
      r.clientName.toLowerCase().includes(prSearch.toLowerCase()) ||
      r.requesterName.toLowerCase().includes(prSearch.toLowerCase()) ||
      (r.partNumber ?? '').toLowerCase().includes(prSearch.toLowerCase())
    )

  // Count pending requests for badge
  const pendingCount = partRequests.filter(r => r.status === 'PENDING' || r.status === 'RECEIVED').length

  if (stockLoading && tab === 'stock') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

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
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stock tab */}
      {tab === 'stock' && (
        <>
          <div className="card mb-6">
            <input
              type="text"
              className="input"
              placeholder={`${tCommon('search')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">{t('noItems')}</p>
              <button onClick={() => router.push(`/${locale}/dashboard/warehouse/new`)} className="btn btn-primary">
                {t('addItem')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="card hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/${locale}/dashboard/warehouse/${item.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{item.itemName}</h3>
                        {item.tracksSerialNumbers && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">SN Tracked</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="font-medium text-gray-600">{t('partNumber')}:</span>
                          <p className="text-gray-900">{item.partNumber}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">{t('value')}:</span>
                          <p className="text-gray-900">€{item.value.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex gap-4 mb-4">
                        <div className="px-4 py-2 bg-blue-50 rounded">
                          <p className="text-xs text-blue-600 font-medium">{t('mainWarehouse')}</p>
                          <p className="text-2xl font-bold text-blue-900">{item.mainWarehouse}</p>
                        </div>
                        <div className="px-4 py-2 bg-purple-50 rounded">
                          <p className="text-xs text-purple-600 font-medium">{t('totalStock')}</p>
                          <p className="text-2xl font-bold text-purple-900">{item.totalStock}</p>
                        </div>
                      </div>

                      {item.technicianStocks.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-gray-600 mb-2">{t('technicianStock')}:</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {item.technicianStocks.map((ts, idx) => (
                              <div key={idx} className="flex justify-between items-center px-3 py-2 bg-green-50 rounded">
                                <span className="text-sm text-green-800">{ts.technician.name}</span>
                                <span className="text-sm font-bold text-green-900">{ts.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Part Requests tab */}
      {tab === 'requests' && (
        <>
          <div className="card mb-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Pesquisar peça, cliente, técnico..."
              value={prSearch}
              onChange={e => setPrSearch(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {(['ALL', 'PENDING', 'ORDERED', 'RECEIVED', 'COMPLETED', 'CANCELLED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setPrStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${prStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {s === 'ALL' ? 'Todos' : PR_STATUS_LABEL[s]}
                  {' '}({s === 'ALL' ? partRequests.length : partRequests.filter(r => r.status === s).length})
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
                      {/* Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{req.itemName}</span>
                        {req.partNumber && (
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{req.partNumber}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PR_STATUS_COLOR[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {PR_STATUS_LABEL[req.status] ?? req.status}
                        </span>
                      </div>
                      {/* Meta */}
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                        <span className="font-medium text-gray-700">{req.clientName}</span>
                        {req.interventionReference && <span>#{req.interventionReference}</span>}
                        <span>Técnico: {req.requesterName}</span>
                        <span>Qtd: {req.quantity}</span>
                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      {req.notes && <p className="text-xs text-gray-500 mt-1 italic">{req.notes}</p>}
                    </div>

                    {/* Status actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {req.status === 'PENDING' && (
                        <button
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, 'ORDERED')}
                          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Marcar Encomendado
                        </button>
                      )}
                      {req.status === 'ORDERED' && (
                        <button
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, 'RECEIVED')}
                          className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Marcar Recebido
                        </button>
                      )}
                      {req.status === 'RECEIVED' && (
                        <button
                          onClick={() => openTransferModal(req)}
                          className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          Transferir para Técnico
                        </button>
                      )}
                      {(req.status === 'PENDING' || req.status === 'ORDERED') && (
                        <button
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, 'CANCELLED')}
                          className="text-xs px-2.5 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/${locale}/dashboard/interventions/${req.interventionId}`)}
                        className="text-xs px-2.5 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                      >
                        Ver Intervenção
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    {/* Transfer to Tech modal */}
    {transferModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Transferir para Técnico</h3>
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-medium">{transferModal.itemName}</span>
            {transferModal.partNumber && <span className="text-gray-400 ml-1 font-mono text-xs">{transferModal.partNumber}</span>}
            <br />
            Técnico: <span className="font-medium">{transferModal.requesterName}</span>
            {' · '}Qtd pedida: <span className="font-medium">{transferModal.quantity}</span>
          </p>

          {transferModal.tracksSerialNumbers ? (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Selecionar números de série a transferir *
              </p>
              {snLoading ? (
                <p className="text-sm text-gray-500">A carregar...</p>
              ) : snOptions.length === 0 ? (
                <p className="text-sm text-red-600 bg-red-50 rounded p-3">
                  Sem stock disponível no armazém principal.
                </p>
              ) : (
                <div className="border rounded max-h-48 overflow-y-auto p-2 space-y-1">
                  {snOptions.map(sn => (
                    <label key={sn.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSns.includes(sn.id)}
                        onChange={() => setSelectedSns(prev =>
                          prev.includes(sn.id) ? prev.filter(x => x !== sn.id) : [...prev, sn.id]
                        )}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-mono">{sn.serialNumber}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedSns.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{selectedSns.length} selecionado(s)</p>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
              Serão transferidas <strong>{transferModal.quantity}</strong> unidade(s) do armazém principal para o técnico.
              {transferModal.mainWarehouse < transferModal.quantity && (
                <p className="text-red-700 font-medium mt-1">
                  ⚠ Stock disponível ({transferModal.mainWarehouse}) inferior à quantidade pedida.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={executeTransfer}
              disabled={
                transferring ||
                (transferModal.tracksSerialNumbers ? selectedSns.length === 0 : transferModal.mainWarehouse < 1)
              }
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {transferring ? 'A transferir...' : 'Confirmar Transferência'}
            </button>
            <button
              onClick={() => setTransferModal(null)}
              disabled={transferring}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
