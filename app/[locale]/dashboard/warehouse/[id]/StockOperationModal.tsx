'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import LabelPrintModal from '@/components/LabelPrintModal'

interface SerialNumber {
  id: string
  serialNumber: string
  location: string
  status: string
  technicianId?: string
  technician?: {
    id: string
    name: string
  }
}

interface StockOperationModalProps {
  itemId: string
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  autoSn: boolean
  snExample: string | null
  operation: string
  mainWarehouse: number
  technicianStocks: Array<{ technician: { id: string; name: string }; quantity: number }>
  onClose: () => void
  onSuccess: () => void
}

export default function StockOperationModal({
  itemId,
  itemName,
  partNumber,
  tracksSerialNumbers,
  autoSn,
  snExample,
  operation,
  mainWarehouse,
  technicianStocks,
  onClose,
  onSuccess,
}: StockOperationModalProps) {
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [technicians, setTechnicians] = useState<any[]>([])
  const [availableSerialNumbers, setAvailableSerialNumbers] = useState<SerialNumber[]>([])
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([])
  const [serialNumbersInput, setSerialNumbersInput] = useState('')
  const [formData, setFormData] = useState({ quantity: '', technicianId: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [autoSnQuantity, setAutoSnQuantity] = useState('')

  // Print step — set after a successful ADD_STOCK with serial numbers
  const [printSerialNumbers, setPrintSerialNumbers] = useState<string[] | null>(null)

  useEffect(() => {
    // Only TRANSFER_TO_TECH needs the full technicians list; TRANSFER_FROM_TECH uses technicianStocks
    if (operation === 'TRANSFER_TO_TECH') fetchTechnicians()
    if (tracksSerialNumbers) fetchAvailableSerialNumbers()
  }, [operation, tracksSerialNumbers])

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

  const fetchAvailableSerialNumbers = async () => {
    try {
      const token = localStorage.getItem('token')
      let url = `/api/warehouse/items/${itemId}/serial-numbers?status=AVAILABLE`
      if (operation === 'TRANSFER_TO_TECH' || operation === 'REMOVE_STOCK') {
        url += '&location=MAIN_WAREHOUSE'
      } else if (operation === 'TRANSFER_FROM_TECH' && formData.technicianId) {
        url += `&location=TECHNICIAN&technicianId=${formData.technicianId}`
      }
      // For USE: no location filter — any available serial number can be consumed
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      setAvailableSerialNumbers(await response.json())
    } catch (error) {
      console.error('Error fetching serial numbers:', error)
    }
  }

  useEffect(() => {
    if (tracksSerialNumbers && formData.technicianId && operation === 'TRANSFER_FROM_TECH') {
      fetchAvailableSerialNumbers()
    }
  }, [formData.technicianId])

  const toggleSerialNumber = (snId: string) => {
    setSelectedSerialNumbers(prev =>
      prev.includes(snId) ? prev.filter(id => id !== snId) : [...prev, snId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')

      if (tracksSerialNumbers) {
        if (operation === 'ADD_STOCK') {
          let addedSNs: string[] = []

          if (autoSn) {
            // Auto-generate serial numbers
            const qty = parseInt(autoSnQuantity)
            if (!qty || qty < 1) {
              alert(t('enterValidQuantity'))
              setLoading(false)
              return
            }

            const response = await fetch(`/api/warehouse/items/${itemId}/serial-numbers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ quantity: qty, autoGenerate: true, location: 'MAIN_WAREHOUSE' }),
            })

            if (!response.ok) {
              const data = await response.json()
              alert(data.error || t('operationFailed'))
              setLoading(false)
              return
            }

            const snData = await response.json()
            addedSNs = snData.serialNumbers as string[]

            await fetch('/api/warehouse/movements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                itemId,
                movementType: 'ADD_STOCK',
                quantity: qty,
                serialNumberIds: [],
                notes: formData.notes || null,
              }),
            })
          } else {
            // Manual serial numbers
            const serialNumbers = serialNumbersInput
              .split('\n')
              .map(sn => sn.trim())
              .filter(sn => sn.length > 0)

            if (serialNumbers.length === 0) {
              alert(t('enterAtLeastOneSn'))
              setLoading(false)
              return
            }

            const response = await fetch(`/api/warehouse/items/${itemId}/serial-numbers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ serialNumbers, location: 'MAIN_WAREHOUSE' }),
            })

            if (!response.ok) {
              const data = await response.json()
              alert(data.error || t('operationFailed'))
              setLoading(false)
              return
            }

            await fetch('/api/warehouse/movements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                itemId,
                movementType: 'ADD_STOCK',
                quantity: serialNumbers.length,
                serialNumberIds: [],
                notes: formData.notes || null,
              }),
            })

            addedSNs = serialNumbers
          }

          // Show label print modal — onSuccess called when label modal closes
          setPrintSerialNumbers(addedSNs)
        } else {
          if (selectedSerialNumbers.length === 0) {
            alert(t('selectAtLeastOneSn'))
            setLoading(false)
            return
          }

          const payload: any = {
            itemId,
            movementType: operation,
            serialNumberIds: selectedSerialNumbers,
            quantity: selectedSerialNumbers.length,
            notes: formData.notes || null,
          }
          if (operation === 'TRANSFER_TO_TECH') payload.toUserId = formData.technicianId
          if (operation === 'TRANSFER_FROM_TECH') payload.fromUserId = formData.technicianId
          // For USE: server records createdById from JWT — no fromUserId needed

          const response = await fetch('/api/warehouse/movements/serial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            const data = await response.json()
            alert(data.error || t('operationFailed'))
            setLoading(false)
            return
          }

          onSuccess()
        }
      } else {
        const qty = parseInt(formData.quantity)

        // Enforce max quantity client-side
        if (operation === 'TRANSFER_TO_TECH' && qty > mainWarehouse) {
          alert(t('maxAvailable', { max: mainWarehouse }))
          setLoading(false)
          return
        }
        if (operation === 'TRANSFER_FROM_TECH') {
          const techMax = technicianStocks.find(ts => ts.technician.id === formData.technicianId)?.quantity ?? 0
          if (qty > techMax) {
            alert(t('maxAvailable', { max: techMax }))
            setLoading(false)
            return
          }
        }

        const payload: any = {
          itemId,
          movementType: operation,
          quantity: qty,
          notes: formData.notes || null,
        }
        if (operation === 'TRANSFER_TO_TECH') payload.toUserId = formData.technicianId
        if (operation === 'TRANSFER_FROM_TECH') payload.fromUserId = formData.technicianId
        // For USE: server deducts from main warehouse and records createdById from JWT

        const response = await fetch('/api/warehouse/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          onSuccess()
        } else {
          const data = await response.json()
          alert(data.error || t('operationFailed'))
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert(t('operationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Show label print modal after successful ADD_STOCK
  if (printSerialNumbers) {
    return (
      <LabelPrintModal
        itemName={itemName}
        partNumber={partNumber}
        serialNumbers={printSerialNumbers}
        onClose={onSuccess}
      />
    )
  }

  // For USE: show the serial picker immediately (all available SNs fetched on mount)
  // For other ops: wait until a technician is selected
  const showSerialPicker = tracksSerialNumbers && operation !== 'ADD_STOCK' && (
    operation === 'USE' || !!formData.technicianId
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-2">
          {operation === 'ADD_STOCK' && t('addStock')}
          {operation === 'REMOVE_STOCK' && t('removeStock')}
          {operation === 'TRANSFER_TO_TECH' && t('transferToTech')}
          {operation === 'TRANSFER_FROM_TECH' && t('transferFromTech')}
          {operation === 'USE' && t('useStock')}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{itemName}</p>

        {tracksSerialNumbers && (
          <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded">
            <p className="text-xs text-purple-800">
              {t('serialNumberTrackingEnabled')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Serialized Items - Add Stock */}
          {tracksSerialNumbers && operation === 'ADD_STOCK' && (
            <div>
              {autoSn ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('quantity')} *
                  </label>
                  <input
                    type="number"
                    className="input text-gray-800"
                    value={autoSnQuantity}
                    onChange={(e) => setAutoSnQuantity(e.target.value)}
                    min="1"
                    required
                  />
                  {snExample && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('snExampleHelp', { example: snExample })}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('enterSerialNumbers')} *
                  </label>
                  <textarea
                    className="input text-gray-800 font-mono text-sm"
                    rows={8}
                    value={serialNumbersInput}
                    onChange={(e) => setSerialNumbersInput(e.target.value)}
                    placeholder="SN001&#10;SN002&#10;SN003&#10;..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('serialNumbersHelp')}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Non-Serialized Items - Quantity Input */}
          {!tracksSerialNumbers && (() => {
            const selectedTechStock = operation === 'TRANSFER_FROM_TECH'
              ? (technicianStocks.find(ts => ts.technician.id === formData.technicianId)?.quantity ?? undefined)
              : undefined
            const quantityMax = operation === 'TRANSFER_TO_TECH' ? mainWarehouse
              : operation === 'TRANSFER_FROM_TECH' ? selectedTechStock
              : undefined
            return (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('quantity')} *
                </label>
                <input
                  type="number"
                  className="input text-gray-800"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  min="1"
                  max={quantityMax}
                  required
                />
                {quantityMax !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">{t('available')}: {quantityMax}</p>
                )}
              </div>
            )
          })()}

          {/* Technician Selection — TRANSFER_TO_TECH: all technicians */}
          {operation === 'TRANSFER_TO_TECH' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('technician')} *
              </label>
              <select
                className="input text-gray-800"
                value={formData.technicianId}
                onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
                required
              >
                <option value="">{t('selectTechnician')}</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Technician Selection — TRANSFER_FROM_TECH: only techs with stock */}
          {operation === 'TRANSFER_FROM_TECH' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('technician')} *
              </label>
              <select
                className="input text-gray-800"
                value={formData.technicianId}
                onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
                required
              >
                <option value="">{t('selectTechnician')}</option>
                {technicianStocks.map((ts) => (
                  <option key={ts.technician.id} value={ts.technician.id}>
                    {ts.technician.name} ({ts.quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Serialized Items - Serial Number Selection */}
          {showSerialPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('selectSerialNumbers')} *
              </label>
              {availableSerialNumbers.length === 0 ? (
                <p className="text-sm text-gray-600 py-4 text-center bg-gray-50 rounded">
                  {t('noSerialNumbersAvailable')}
                </p>
              ) : (
                <div className="border rounded max-h-60 overflow-y-auto p-3 space-y-2">
                  {availableSerialNumbers.map((sn) => (
                    <label
                      key={sn.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSerialNumbers.includes(sn.id)}
                        onChange={() => toggleSerialNumber(sn.id)}
                      />
                      <span className="text-sm font-mono">{sn.serialNumber}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {t('nSelected', { count: selectedSerialNumbers.length })}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('notes')}
            </label>
            <textarea
              className="input text-gray-800"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? tCommon('loading') : tCommon('save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
