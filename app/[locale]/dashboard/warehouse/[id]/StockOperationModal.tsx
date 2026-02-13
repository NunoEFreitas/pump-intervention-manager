'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

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
  tracksSerialNumbers: boolean
  operation: string
  onClose: () => void
  onSuccess: () => void
}

export default function StockOperationModal({
  itemId,
  itemName,
  tracksSerialNumbers,
  operation,
  onClose,
  onSuccess,
}: StockOperationModalProps) {
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [technicians, setTechnicians] = useState<any[]>([])
  const [availableSerialNumbers, setAvailableSerialNumbers] = useState<SerialNumber[]>([])
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([])
  const [serialNumbersInput, setSerialNumbersInput] = useState('')
  const [formData, setFormData] = useState({
    quantity: '',
    technicianId: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const needsTechnician = ['TRANSFER_TO_TECH', 'TRANSFER_FROM_TECH', 'USE'].includes(operation)
    if (needsTechnician) {
      fetchTechnicians()
    }

    // Fetch available serial numbers if this is a serialized item
    if (tracksSerialNumbers) {
      fetchAvailableSerialNumbers()
    }
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

      // For operations that need specific location
      if (operation === 'TRANSFER_TO_TECH' || operation === 'REMOVE_STOCK') {
        url += '&location=MAIN_WAREHOUSE'
      } else if (operation === 'TRANSFER_FROM_TECH' && formData.technicianId) {
        url += `&location=TECHNICIAN&technicianId=${formData.technicianId}`
      } else if (operation === 'USE' && formData.technicianId) {
        url += `&location=TECHNICIAN&technicianId=${formData.technicianId}`
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setAvailableSerialNumbers(data)
    } catch (error) {
      console.error('Error fetching serial numbers:', error)
    }
  }

  // Re-fetch when technician changes (for return/use operations)
  useEffect(() => {
    if (tracksSerialNumbers && formData.technicianId &&
        (operation === 'TRANSFER_FROM_TECH' || operation === 'USE')) {
      fetchAvailableSerialNumbers()
    }
  }, [formData.technicianId])

  const toggleSerialNumber = (snId: string) => {
    setSelectedSerialNumbers(prev =>
      prev.includes(snId)
        ? prev.filter(id => id !== snId)
        : [...prev, snId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')

      if (tracksSerialNumbers) {
        // Handle serialized items
        if (operation === 'ADD_STOCK') {
          // Add new serial numbers
          const serialNumbers = serialNumbersInput
            .split('\n')
            .map(sn => sn.trim())
            .filter(sn => sn.length > 0)

          if (serialNumbers.length === 0) {
            alert('Please enter at least one serial number')
            setLoading(false)
            return
          }

          const response = await fetch(`/api/warehouse/items/${itemId}/serial-numbers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              serialNumbers,
              location: 'MAIN_WAREHOUSE',
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            alert(data.error || 'Operation failed')
            setLoading(false)
            return
          }

          // Create movement record
          await fetch('/api/warehouse/movements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              itemId,
              movementType: 'ADD_STOCK',
              quantity: serialNumbers.length,
              serialNumberIds: [], // Will be linked separately
              notes: formData.notes || `Added ${serialNumbers.length} units with serial numbers`,
            }),
          })

          onSuccess()
        } else {
          // Transfer/Remove/Use with selected serial numbers
          if (selectedSerialNumbers.length === 0) {
            alert('Please select at least one serial number')
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

          if (operation === 'TRANSFER_TO_TECH') {
            payload.toUserId = formData.technicianId
          } else if (operation === 'TRANSFER_FROM_TECH' || operation === 'USE') {
            payload.fromUserId = formData.technicianId
          }

          const response = await fetch('/api/warehouse/movements/serial', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            const data = await response.json()
            alert(data.error || 'Operation failed')
            setLoading(false)
            return
          }

          onSuccess()
        }
      } else {
        // Handle non-serialized items (quantity-based)
        const payload: any = {
          itemId,
          movementType: operation,
          quantity: parseInt(formData.quantity),
          notes: formData.notes || null,
        }

        if (operation === 'TRANSFER_TO_TECH') {
          payload.toUserId = formData.technicianId
        } else if (operation === 'TRANSFER_FROM_TECH' || operation === 'USE') {
          payload.fromUserId = formData.technicianId
        }

        const response = await fetch('/api/warehouse/movements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          onSuccess()
        } else {
          const data = await response.json()
          alert(data.error || 'Operation failed')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const needsTechnician = ['TRANSFER_TO_TECH', 'TRANSFER_FROM_TECH', 'USE'].includes(operation)

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
              {t('serialNumberTracking')} enabled
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Serialized Items - Add Stock */}
          {tracksSerialNumbers && operation === 'ADD_STOCK' && (
            <div>
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
            </div>
          )}

          {/* Non-Serialized Items - Quantity Input */}
          {!tracksSerialNumbers && (
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
                required
              />
            </div>
          )}

          {/* Technician Selection */}
          {needsTechnician && (
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
                <option value="">Select technician</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Serialized Items - Serial Number Selection (for transfer/remove/use) */}
          {tracksSerialNumbers && operation !== 'ADD_STOCK' && formData.technicianId && (
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
                {selectedSerialNumbers.length} selected
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
