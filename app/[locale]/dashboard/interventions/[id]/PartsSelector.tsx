'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface StockItem {
  itemId: string
  itemName: string
  partNumber: string
  value: number
  quantity: number
  tracksSerialNumbers: boolean
  serialNumbers?: Array<{
    id: string
    serialNumber: string
  }>
}

interface PartsSelectorProps {
  technicianId: string
  onClose: () => void
  onPartAdded: () => void
  interventionId: string
}

export default function PartsSelector({ technicianId, onClose, onPartAdded, interventionId }: PartsSelectorProps) {
  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')
  const tWarehouse = useTranslations('warehouse')

  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState<StockItem[]>([])
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTechnicianStock()
  }, [technicianId])

  const fetchTechnicianStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/technicians/${technicianId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setStock(data.stocks || [])
    } catch (error) {
      console.error('Error fetching stock:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedItem) return

    if (selectedItem.tracksSerialNumbers && selectedSerialNumbers.length !== quantity) {
      alert(t('selectCorrectSnCount'))
      return
    }

    setSubmitting(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${interventionId}/parts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: selectedItem.itemId,
          quantity,
          serialNumberIds: selectedItem.tracksSerialNumbers ? selectedSerialNumbers : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('failedToAddPart'))
      }

      onPartAdded()
      onClose()
    } catch (error: any) {
      alert(error.message || t('failedToAddPart'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleItemSelect = (item: StockItem) => {
    setSelectedItem(item)
    setQuantity(1)
    setSelectedSerialNumbers([])
  }

  const toggleSerialNumber = (snId: string) => {
    setSelectedSerialNumbers(prev => {
      if (prev.includes(snId)) {
        return prev.filter(id => id !== snId)
      } else {
        if (prev.length < quantity) {
          return [...prev, snId]
        }
        return prev
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('addPartsUsed')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('selectPartsFromStock')}</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-600">{t('loadingStock')}</div>
        ) : stock.length === 0 ? (
          <div className="p-8 text-center text-gray-600">{t('noStockAvailable')}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!selectedItem ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-700 mb-3">{t('selectItem')}:</h3>
                  {stock.map((item) => (
                    <div
                      key={item.itemId}
                      className="p-4 border rounded-lg hover:bg-blue-50 active:bg-blue-100 cursor-pointer transition-colors"
                      onClick={() => handleItemSelect(item)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900">{item.itemName}</h4>
                          <p className="text-sm text-gray-600">{tWarehouse('partNumber')}: {item.partNumber}</p>
                          <p className="text-sm text-gray-600">
                            {tWarehouse('available')}: {item.tracksSerialNumbers ? `${item.serialNumbers?.length || 0} ${tWarehouse('units')}` : `${item.quantity} ${tWarehouse('units')}`}
                          </p>
                        </div>
                        <span className="text-base sm:text-lg font-bold text-blue-600 shrink-0">€{item.value.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">{selectedItem.itemName}</h4>
                        <p className="text-sm text-gray-600">{tWarehouse('partNumber')}: {selectedItem.partNumber}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="text-blue-600 hover:text-blue-800 text-sm shrink-0 py-1 px-2"
                      >
                        {t('changePart')}
                      </button>
                    </div>
                  </div>

                  {!selectedItem.tracksSerialNumbers ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tWarehouse('quantity')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedItem.quantity}
                        className="input text-gray-800"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {tWarehouse('available')}: {selectedItem.quantity} {tWarehouse('units')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tWarehouse('selectSerialNumbers')} ({quantity})
                      </label>
                      <div className="mb-3">
                        <input
                          type="number"
                          min="1"
                          max={selectedItem.serialNumbers?.length || 0}
                          className="input text-gray-800"
                          value={quantity}
                          onChange={(e) => {
                            setQuantity(parseInt(e.target.value) || 1)
                            setSelectedSerialNumbers([])
                          }}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t('howManyUnits')}
                        </p>
                      </div>
                      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                        {selectedItem.serialNumbers && selectedItem.serialNumbers.length > 0 ? (
                          <div className="space-y-2">
                            {selectedItem.serialNumbers.map((sn) => (
                              <label
                                key={sn.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                                  selectedSerialNumbers.includes(sn.id) ? 'bg-blue-100' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSerialNumbers.includes(sn.id)}
                                  onChange={() => toggleSerialNumber(sn.id)}
                                  disabled={!selectedSerialNumbers.includes(sn.id) && selectedSerialNumbers.length >= quantity}
                                  className="w-4 h-4"
                                />
                                <span className="font-mono text-sm">{sn.serialNumber}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{tWarehouse('noSerialNumbersAvailable')}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {t('selected')}: {selectedSerialNumbers.length} / {quantity}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t flex gap-3">
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={!selectedItem || submitting || (selectedItem.tracksSerialNumbers && selectedSerialNumbers.length !== quantity)}
              >
                {submitting ? tCommon('adding') : t('addPart')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={submitting}
              >
                {tCommon('cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
