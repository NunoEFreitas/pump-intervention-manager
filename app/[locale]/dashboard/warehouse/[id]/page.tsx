// FILE: app/[locale]/dashboard/warehouse/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import StockOperationModal from './StockOperationModal'

interface Movement {
  id: string
  movementType: string
  quantity: number
  notes: string | null
  createdAt: string
  fromUser: { name: string } | null
  toUser: { name: string } | null
  createdBy: { name: string }
  serialNumbers?: Array<{
    serialNumber: {
      id: string
      serialNumber: string
    }
  }>
}

interface SerialNumber {
  id: string
  serialNumber: string
  location: string
  status: string
  technician?: { id: string; name: string } | null
}

interface Item {
  id: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  value: number
  mainWarehouse: number
  tracksSerialNumbers: boolean
  technicianStocks: Array<{
    technician: { id: string; name: string }
    quantity: number
  }>
  movements: Movement[]
}

export default function WarehouseItemDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  
  const [item, setItem] = useState<Item | null>(null)
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockOperation, setStockOperation] = useState<string>('')
  const [editData, setEditData] = useState({
    itemName: '',
    partNumber: '',
    serialNumber: '',
    value: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchItem()
    }
  }, [params.id])

  const fetchItem = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setItem(data)
      setEditData({
        itemName: data.itemName,
        partNumber: data.partNumber,
        serialNumber: data.serialNumber || '',
        value: data.value.toString(),
      })

      // Fetch serial numbers if item tracks them
      if (data.tracksSerialNumbers) {
        fetchSerialNumbers()
      }
    } catch (error) {
      console.error('Error fetching item:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSerialNumbers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/items/${params.id}/serial-numbers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setSerialNumbers(data)
    } catch (error) {
      console.error('Error fetching serial numbers:', error)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      })

      if (response.ok) {
        setIsEditing(false)
        fetchItem()
      }
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/warehouse/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        router.push(`/${locale}/dashboard/warehouse`)
      }
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const openStockOperation = (operation: string) => {
    setStockOperation(operation)
    setShowStockModal(true)
  }

  const getMovementTypeLabel = (type: string) => {
    const labels: any = {
      ADD_STOCK: t('addStock'),
      REMOVE_STOCK: t('removeStock'),
      TRANSFER_TO_TECH: t('transferToTech'),
      TRANSFER_FROM_TECH: t('transferFromTech'),
      USE: t('useStock'),
    }
    return labels[type] || type
  }

  const getMovementSign = (type: string) => {
    // + for items entering stock, - for items leaving stock
    // Transfers between warehouse/technician don't show signs (just location changes)
    switch (type) {
      case 'ADD_STOCK':
        return '+'
      case 'REMOVE_STOCK':
      case 'USE':
        return '-'
      case 'TRANSFER_TO_TECH':
      case 'TRANSFER_FROM_TECH':
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  if (!item) {
    return <div className="card">Item not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/warehouse`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← {tCommon('back')}
        </button>
      </div>

      {!isEditing ? (
        <>
          <div className="card mb-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {item.itemName}
                  </h1>
                  {item.tracksSerialNumbers && (
                    <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800 rounded">
                      SN Tracked
                    </span>
                  )}
                </div>
                <p className="text-gray-600">{t('subtitle')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-secondary"
                >
                  {tCommon('edit')}
                </button>
                <button
                  onClick={handleDelete}
                  className="btn btn-danger"
                >
                  {tCommon('delete')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-600">{t('partNumber')}</p>
                <p className="text-lg font-semibold text-gray-900">{item.partNumber}</p>
              </div>
              {item.serialNumber && (
                <div>
                  <p className="text-sm text-gray-600">{t('serialNumber')}</p>
                  <p className="text-lg font-semibold text-gray-900">{item.serialNumber}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">{t('value')}</p>
                <p className="text-lg font-semibold text-gray-900">€{item.value.toFixed(2)}</p>
              </div>
            </div>

            {!item.tracksSerialNumbers ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium mb-1">{t('mainWarehouse')}</p>
                    <p className="text-3xl font-bold text-blue-900">{item.mainWarehouse}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium mb-1">{t('totalStock')}</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {item.mainWarehouse + item.technicianStocks.reduce((sum, ts) => sum + ts.quantity, 0)}
                    </p>
                  </div>
                </div>

                {item.technicianStocks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3">{t('technicianStock')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {item.technicianStocks.map((ts, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <p className="text-sm text-green-600 font-medium">Technician</p>
                            <p className="text-gray-900 font-semibold">{ts.technician.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-green-600 font-medium">Quantity</p>
                            <p className="text-2xl font-bold text-green-900">{ts.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">{t('serialNumberTracking')}</h3>

                {/* Main Warehouse Serial Numbers */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-blue-600 mb-2">{t('mainWarehouse')}</h4>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {serialNumbers
                          .filter(sn => sn.location === 'MAIN_WAREHOUSE')
                          .map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-blue-100 text-blue-900 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-blue-600">No serial numbers in main warehouse</p>
                    )}
                  </div>
                </div>

                {/* Technician Serial Numbers */}
                {Array.from(new Set(serialNumbers.filter(sn => sn.location === 'TECHNICIAN').map(sn => sn.technician?.id))).map(techId => {
                  const techSerials = serialNumbers.filter(sn => sn.location === 'TECHNICIAN' && sn.technician?.id === techId)
                  if (techSerials.length === 0) return null
                  const techName = techSerials[0].technician?.name || 'Unknown'

                  return (
                    <div key={techId} className="mb-4">
                      <h4 className="text-sm font-medium text-green-600 mb-2">Technician: {techName}</h4>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex flex-wrap gap-2">
                          {techSerials.map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-green-100 text-green-900 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Used Serial Numbers */}
                {serialNumbers.filter(sn => sn.location === 'USED').length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Used</h4>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex flex-wrap gap-2">
                        {serialNumbers
                          .filter(sn => sn.location === 'USED')
                          .map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('stockOperations')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => openStockOperation('ADD_STOCK')}
                className="btn btn-primary"
              >
                {t('addStock')}
              </button>
              <button
                onClick={() => openStockOperation('REMOVE_STOCK')}
                className="btn btn-secondary"
              >
                {t('removeStock')}
              </button>
              <button
                onClick={() => openStockOperation('TRANSFER_TO_TECH')}
                className="btn btn-primary"
              >
                {t('transferToTech')}
              </button>
              <button
                onClick={() => openStockOperation('TRANSFER_FROM_TECH')}
                className="btn btn-secondary"
              >
                {t('transferFromTech')}
              </button>
              <button
                onClick={() => openStockOperation('USE')}
                className="btn btn-danger"
              >
                {t('useStock')}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('movements')}</h2>
            {item.movements.length === 0 ? (
              <p className="text-gray-600">No movements yet</p>
            ) : (
              <div className="space-y-3">
                {item.movements.map((movement) => (
                  <div key={movement.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {getMovementTypeLabel(movement.movementType)}
                        </span>
                        <span className={`ml-2 font-medium ${
                          getMovementSign(movement.movementType) === '+'
                            ? 'text-green-600'
                            : getMovementSign(movement.movementType) === '-'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {getMovementSign(movement.movementType)}{movement.quantity} units
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(movement.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {movement.fromUser && <span>From: {movement.fromUser.name} </span>}
                      {movement.toUser && <span>To: {movement.toUser.name} </span>}
                      <span>By: {movement.createdBy.name}</span>
                    </div>

                    {movement.serialNumbers && movement.serialNumbers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Serial Numbers:</p>
                        <div className="flex flex-wrap gap-1">
                          {movement.serialNumbers.map((msn) => (
                            <span
                              key={msn.serialNumber.id}
                              className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-mono"
                            >
                              {msn.serialNumber.serialNumber}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {movement.notes && (
                      <p className="text-sm text-gray-600 mt-2">{movement.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleUpdate} className="card space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('editItem')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('itemName')}
            </label>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.itemName}
              onChange={(e) => setEditData({ ...editData, itemName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('partNumber')}
            </label>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.partNumber}
              onChange={(e) => setEditData({ ...editData, partNumber: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('serialNumber')}
            </label>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.serialNumber}
              onChange={(e) => setEditData({ ...editData, serialNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('value')}
            </label>
            <input
              type="number"
              step="0.01"
              className="input text-gray-800"
              value={editData.value}
              onChange={(e) => setEditData({ ...editData, value: e.target.value })}
              required
            />
          </div>

          {item.tracksSerialNumbers && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-medium text-purple-900 mb-1">
                {t('serialNumberTracking')}
              </p>
              <p className="text-xs text-purple-700">
                This item uses serial number tracking. Stock is managed through individual serial numbers.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary flex-1">
              {tCommon('save')}
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

      {showStockModal && item && (
        <StockOperationModal
          itemId={item.id}
          itemName={item.itemName}
          tracksSerialNumbers={item.tracksSerialNumbers}
          operation={stockOperation}
          onClose={() => setShowStockModal(false)}
          onSuccess={() => {
            setShowStockModal(false)
            fetchItem()
            if (item.tracksSerialNumbers) {
              fetchSerialNumbers()
            }
          }}
        />
      )}
    </div>
  )
}

