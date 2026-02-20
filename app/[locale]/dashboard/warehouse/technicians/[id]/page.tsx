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
  serialNumbers?: Array<{
    id: string
    serialNumber: string
  }>
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

  useEffect(() => {
    if (params.id) {
      fetchTechnicianStock()
    }
  }, [params.id])

  const fetchTechnicianStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/technicians/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setTechnician(data)
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        alert(data.error || 'Operation failed')
      }
    } catch (error) {
      console.error('Error performing stock operation:', error)
      alert('Failed to perform operation')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  if (!technician) {
    return <div className="card">Technician not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/warehouse/technicians`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← {tCommon('back')}
        </button>
      </div>

      <div className="card mb-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {technician.name}
          </h1>
          <p className="text-gray-600">{technician.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 font-medium mb-1">Total Items in Stock</p>
            <p className="text-3xl font-bold text-blue-900">{technician.totalItems}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600 font-medium mb-1">Total Stock Value</p>
            <p className="text-3xl font-bold text-green-900">€{technician.totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('technicianStockDetails')}</h2>

        {technician.stocks.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No stock items assigned to this technician.</p>
        ) : (
          <div className="space-y-4">
            {technician.stocks.map((stock) => (
              <div key={stock.itemId} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {stock.itemName}
                      </h3>
                      {stock.tracksSerialNumbers && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          SN Tracked
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">{t('partNumber')}:</span>
                        <p className="font-medium text-gray-900">{stock.partNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('value')}:</span>
                        <p className="font-medium text-gray-900">€{stock.value.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Main Warehouse:</span>
                        <p className="font-medium text-gray-900">{stock.mainWarehouseStock}</p>
                      </div>
                    </div>

                    {!stock.tracksSerialNumbers ? (
                      <div className="flex items-center gap-4">
                        <div className="px-4 py-2 bg-purple-50 rounded">
                          <p className="text-xs text-purple-600 font-medium">Quantity</p>
                          <p className="text-2xl font-bold text-purple-900">{stock.quantity}</p>
                        </div>
                        <div className="px-4 py-2 bg-green-50 rounded">
                          <p className="text-xs text-green-600 font-medium">Total Value</p>
                          <p className="text-xl font-bold text-green-900">€{stock.totalValue.toFixed(2)}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-purple-600 font-medium mb-2">Serial Numbers ({stock.serialNumbers?.length || 0})</p>
                        {stock.serialNumbers && stock.serialNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {stock.serialNumbers.map(sn => (
                              <span key={sn.id} className="px-3 py-1 bg-purple-100 text-purple-900 rounded text-sm font-mono">
                                {sn.serialNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No serial numbers</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => openModal('add', stock)}
                      className="btn btn-primary text-sm whitespace-nowrap"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => openModal('remove', stock)}
                      className="btn btn-secondary text-sm whitespace-nowrap"
                      disabled={stock.quantity === 0}
                    >
                      - Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Operation Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {modalAction === 'add' ? t('addStock') : t('removeStock')} - {selectedItem.itemName}
            </h3>

            <form onSubmit={handleStockOperation}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('quantity')} *
                </label>
                <input
                  type="number"
                  min="1"
                  max={modalAction === 'remove' ? selectedItem.quantity : selectedItem.mainWarehouseStock}
                  className="input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {modalAction === 'add'
                    ? `Available in main warehouse: ${selectedItem.mainWarehouseStock}`
                    : `Current technician stock: ${selectedItem.quantity}`
                  }
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('notes')}
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this operation..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                >
                  {tCommon('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  {tCommon('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
