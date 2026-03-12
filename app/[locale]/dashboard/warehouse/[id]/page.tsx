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

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }

interface Item {
  id: string
  itemName: string
  partNumber: string
  equipmentTypeId: string | null
  brandId: string | null
  typeName: string | null
  brandName: string | null
  value: number
  mainWarehouse: number
  repairStock: number
  tracksSerialNumbers: boolean
  autoSn: boolean
  snExample: string | null
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
  const [snExpanded, setSnExpanded] = useState<Record<string, boolean>>({})
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [editData, setEditData] = useState({
    equipmentTypeId: '',
    brandId: '',
    partNumber: '',
    value: '',
    autoSn: false,
    snExample: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchItem()
    }
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch('/api/admin/equipment-types', { headers }).then(r => r.json()),
      fetch('/api/admin/equipment-brands', { headers }).then(r => r.json()),
    ]).then(([types, brands]) => {
      setEquipmentTypes(types)
      setEquipmentBrands(brands)
    })
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
        equipmentTypeId: data.equipmentTypeId || '',
        brandId: data.brandId || '',
        partNumber: data.partNumber,
        value: data.value.toString(),
        autoSn: data.autoSn ?? false,
        snExample: data.snExample || '',
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
    if (!confirm(t('deleteItemConfirm'))) return

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
      REPAIR_IN: t('repairIn'),
      REPAIR_OUT: t('repairOut'),
    }
    return labels[type] || type
  }

  const getMovementSign = (type: string) => {
    switch (type) {
      case 'ADD_STOCK':
      case 'REPAIR_OUT':
        return '+'
      case 'REMOVE_STOCK':
      case 'USE':
      case 'REPAIR_IN':
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
    return <div className="card">{t('itemNotFound')}</div>
  }

  const editTypeName = equipmentTypes.find(x => x.id === editData.equipmentTypeId)?.name || ''
  const editBrandName = equipmentBrands.find(x => x.id === editData.brandId)?.name || ''
  const editComputedName = [editTypeName, editBrandName, editData.partNumber].filter(Boolean).join(' ')

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
                      {t('snTracked')}
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
              {item.typeName && (
                <div>
                  <p className="text-sm text-gray-600">{t('equipmentType')}</p>
                  <p className="text-lg font-semibold text-gray-900">{item.typeName}</p>
                </div>
              )}
              {item.brandName && (
                <div>
                  <p className="text-sm text-gray-600">{t('equipmentBrand')}</p>
                  <p className="text-lg font-semibold text-gray-900">{item.brandName}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">{t('partNumber')}</p>
                <p className="text-lg font-semibold text-gray-900">{item.partNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('value')}</p>
                <p className="text-lg font-semibold text-gray-900">€{item.value.toFixed(2)}</p>
              </div>
            </div>

            {!item.tracksSerialNumbers ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium mb-1">{t('mainWarehouse')}</p>
                    <p className="text-3xl font-bold text-blue-900">{item.mainWarehouse}</p>
                  </div>
                  {item.repairStock > 0 && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600 font-medium mb-1">{t('inRepair')}</p>
                      <p className="text-3xl font-bold text-orange-900">{item.repairStock}</p>
                    </div>
                  )}
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
                            <p className="text-sm text-green-600 font-medium">{t('technician')}</p>
                            <p className="text-gray-900 font-semibold">{ts.technician.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-green-600 font-medium">{t('quantity')}</p>
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
                {(() => {
                  const sns = serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE')
                  const key = 'main'
                  const expanded = snExpanded[key]
                  const visible = expanded ? sns : sns.slice(0, 8)
                  return (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-blue-600 mb-2">{t('mainWarehouse')}</h4>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        {sns.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {visible.map(sn => (
                                <span key={sn.id} className="px-3 py-1 bg-blue-100 text-blue-900 rounded text-sm font-mono">
                                  {sn.serialNumber}
                                </span>
                              ))}
                            </div>
                            {sns.length > 8 && (
                              <button
                                onClick={() => setSnExpanded(e => ({ ...e, [key]: !e[key] }))}
                                className="mt-2 text-xs text-blue-600 hover:underline"
                              >
                                {expanded ? '▲ Show less' : `▼ Show ${sns.length - 8} more`}
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-blue-600">{t('noSnInMainWarehouse')}</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Technician Serial Numbers */}
                {Array.from(new Set(serialNumbers.filter(sn => sn.location === 'TECHNICIAN').map(sn => sn.technician?.id))).map(techId => {
                  const techSerials = serialNumbers.filter(sn => sn.location === 'TECHNICIAN' && sn.technician?.id === techId)
                  if (techSerials.length === 0) return null
                  const techName = techSerials[0].technician?.name || 'Unknown'
                  const key = `tech-${techId}`
                  const expanded = snExpanded[key]
                  const visible = expanded ? techSerials : techSerials.slice(0, 8)

                  return (
                    <div key={techId} className="mb-4">
                      <h4 className="text-sm font-medium text-green-600 mb-2">{t('technicianColon', { name: techName })}</h4>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex flex-wrap gap-2">
                          {visible.map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-green-100 text-green-900 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                        </div>
                        {techSerials.length > 8 && (
                          <button
                            onClick={() => setSnExpanded(e => ({ ...e, [key]: !e[key] }))}
                            className="mt-2 text-xs text-green-600 hover:underline"
                          >
                            {expanded ? '▲ Show less' : `▼ Show ${techSerials.length - 8} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* In Repair Serial Numbers */}
                {(() => {
                  const sns = serialNumbers.filter(sn => sn.location === 'REPAIR')
                  if (sns.length === 0) return null
                  const key = 'repair'
                  const expanded = snExpanded[key]
                  const visible = expanded ? sns : sns.slice(0, 8)
                  return (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-orange-600 mb-2">{t('inRepair')}</h4>
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex flex-wrap gap-2">
                          {visible.map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-orange-100 text-orange-900 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                        </div>
                        {sns.length > 8 && (
                          <button
                            onClick={() => setSnExpanded(e => ({ ...e, [key]: !e[key] }))}
                            className="mt-2 text-xs text-orange-600 hover:underline"
                          >
                            {expanded ? '▲ Show less' : `▼ Show ${sns.length - 8} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Used Serial Numbers */}
                {(() => {
                  const sns = serialNumbers.filter(sn => sn.location === 'USED')
                  if (sns.length === 0) return null
                  const key = 'used'
                  const expanded = snExpanded[key]
                  const visible = expanded ? sns : sns.slice(0, 8)
                  return (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-2">{t('used')}</h4>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          {visible.map(sn => (
                            <span key={sn.id} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm font-mono">
                              {sn.serialNumber}
                            </span>
                          ))}
                        </div>
                        {sns.length > 8 && (
                          <button
                            onClick={() => setSnExpanded(e => ({ ...e, [key]: !e[key] }))}
                            className="mt-2 text-xs text-gray-500 hover:underline"
                          >
                            {expanded ? '▲ Show less' : `▼ Show ${sns.length - 8} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('stockOperations')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <button
                onClick={() => openStockOperation('ADD_STOCK')}
                className="btn btn-primary"
              >
                {t('addStock')}
              </button>
              <button
                onClick={() => openStockOperation('REMOVE_STOCK')}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length === 0
                    : item.mainWarehouse === 0
                }
              >
                {t('removeStock')}
              </button>
              <button
                onClick={() => openStockOperation('TRANSFER_TO_TECH')}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length === 0
                    : item.mainWarehouse === 0
                }
              >
                {t('transferToTech')}
              </button>
              <button
                onClick={() => openStockOperation('TRANSFER_FROM_TECH')}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'TECHNICIAN').length === 0
                    : item.technicianStocks.length === 0
                }
              >
                {t('transferFromTech')}
              </button>
              <button
                onClick={() => openStockOperation('USE')}
                className="btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length === 0
                    : item.mainWarehouse === 0
                }
              >
                {t('useStock')}
              </button>
              <button
                onClick={() => openStockOperation('REPAIR_IN')}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length === 0
                    : item.mainWarehouse === 0
                }
              >
                {t('repairIn')}
              </button>
              <button
                onClick={() => openStockOperation('REPAIR_OUT')}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  item.tracksSerialNumbers
                    ? serialNumbers.filter(sn => sn.location === 'REPAIR').length === 0
                    : item.repairStock === 0
                }
              >
                {t('repairOut')}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('movements')}</h2>
            {item.movements.length === 0 ? (
              <p className="text-gray-600">{t('noMovements')}</p>
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
                          {getMovementSign(movement.movementType)}{movement.quantity} {t('units')}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(movement.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {movement.fromUser && <span>{t('movementFrom', { name: movement.fromUser.name })} </span>}
                      {movement.toUser && <span>{t('movementTo', { name: movement.toUser.name })} </span>}
                      <span>{t('movementBy', { name: movement.createdBy.name })}</span>
                    </div>

                    {movement.serialNumbers && movement.serialNumbers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">{t('movementSerialNumbers')}</p>
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
              {t('equipmentType')}
            </label>
            <select
              className="input text-gray-800"
              value={editData.equipmentTypeId}
              onChange={(e) => setEditData({ ...editData, equipmentTypeId: e.target.value })}
            >
              <option value="">{t('selectType')}</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('equipmentBrand')}
            </label>
            <select
              className="input text-gray-800"
              value={editData.brandId}
              onChange={(e) => setEditData({ ...editData, brandId: e.target.value })}
            >
              <option value="">{t('selectBrand')}</option>
              {equipmentBrands.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
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

          {editComputedName && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('itemNamePreview')}</p>
              <p className="font-semibold text-gray-900">{editComputedName}</p>
            </div>
          )}

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
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-purple-900">{t('serialNumberTracking')}</p>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="editAutoSn"
                  checked={editData.autoSn}
                  onChange={(e) => setEditData({ ...editData, autoSn: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="editAutoSn" className="text-sm font-medium text-purple-900 cursor-pointer">
                    {t('autoSnGeneration')}
                  </label>
                  {editData.autoSn && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        className="input text-gray-800"
                        value={editData.snExample}
                        onChange={(e) => setEditData({ ...editData, snExample: e.target.value })}
                        placeholder="e.g., PUMP-GF-PS001"
                      />
                      {editData.snExample && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-800">
                            {t('snFormatPreview')}: <span className="font-mono font-semibold">{editData.snExample}-1</span>, <span className="font-mono font-semibold">{editData.snExample}-2</span>…
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
          partNumber={item.partNumber}
          tracksSerialNumbers={item.tracksSerialNumbers}
          autoSn={item.autoSn}
          snExample={item.snExample}
          operation={stockOperation}
          mainWarehouse={item.mainWarehouse}
          repairStock={item.repairStock}
          technicianStocks={item.technicianStocks}
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

