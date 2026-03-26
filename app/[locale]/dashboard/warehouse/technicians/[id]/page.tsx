'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

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

  const openModal = (action: 'add' | 'remove', item: StockItem) => {
    setModalAction(action)
    setSelectedItem(item)
    setQuantity('')
    setNotes('')
    setShowModal(true)
  }

  const handleStockOperation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !quantity) return
    const movementType = modalAction === 'add' ? 'TRANSFER_TO_TECH' : 'TRANSFER_FROM_TECH'
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemId: selectedItem.itemId,
          movementType,
          quantity: parseInt(quantity),
          toUserId: modalAction === 'add' ? params.id : undefined,
          fromUserId: modalAction === 'remove' ? params.id : undefined,
          notes: notes || undefined,
        }),
      })
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
            <span className="px-3 py-1.5 bg-green-50 text-green-800 rounded text-sm font-medium">
              €{technician.totalValue.toFixed(2)}
            </span>
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
                    <span className="text-sm text-gray-500">€{stock.totalValue.toFixed(2)}</span>
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
                  <span><span className="text-gray-400">{t('value')}:</span> €{stock.value.toFixed(2)}</span>
                </div>

                {/* Serial numbers — collapsible */}
                {stock.tracksSerialNumbers && stock.serialNumbers && stock.serialNumbers.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setSnExpanded(e => ({ ...e, [stock.itemId]: !e[stock.itemId] }))}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      {snExpanded[stock.itemId] ? '▲' : '▼'} {stock.serialNumbers.length} número(s) de série
                    </button>
                    {snExpanded[stock.itemId] && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {stock.serialNumbers.map(sn => (
                          <span key={sn.id} className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded text-xs font-mono">
                            {sn.serialNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock operation modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {modalAction === 'add' ? t('transferToTech') : t('transferFromTech')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{selectedItem.itemName}</p>

            <form onSubmit={handleStockOperation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('quantity')} *
                </label>
                <input
                  type="number"
                  min="1"
                  max={modalAction === 'add' ? selectedItem.mainWarehouseStock : selectedItem.quantity}
                  className="input text-gray-800"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  {modalAction === 'add'
                    ? `${t('available')}: ${selectedItem.mainWarehouseStock} (${t('mainWarehouse')})`
                    : `${t('available')}: ${selectedItem.quantity} (técnico)`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
                <textarea
                  className="input text-gray-800"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary flex-1">{tCommon('save')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{tCommon('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
