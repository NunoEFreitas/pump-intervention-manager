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
  serialNumber: string | null
  location: string
  status: string
  isClientPart: boolean
  clientPartStatus: string | null
  faultDescription: string | null
  interventionId: string | null
  createdAt: string
  technicianId: string | null
  technician?: { id: string; name: string; email: string } | null
}

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }
interface ItemCategory { id: string; name: string }

interface Item {
  id: string
  itemName: string
  partNumber: string
  ean13: string | null
  equipmentTypeId: string | null
  brandId: string | null
  categoryId: string | null
  typeName: string | null
  brandName: string | null
  categoryName: string | null
  value: number
  mainWarehouse: number
  repairStock: number
  stockRepairCount: number
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
  const [generatingEan, setGeneratingEan] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockOperation, setStockOperation] = useState<string>('')
  const [snExpanded, setSnExpanded] = useState<Record<string, boolean>>({})
  const [movements, setMovements] = useState<Movement[]>([])
  const [movTotal, setMovTotal] = useState(0)
  const [movPages, setMovPages] = useState(1)
  const [movPage, setMovPage] = useState(1)
  const [movSnFilter, setMovSnFilter] = useState<string | null>(null)
  const [movLoading, setMovLoading] = useState(false)
  const [showSnMigration, setShowSnMigration] = useState(false)
  const [snMigrationInput, setSnMigrationInput] = useState('')
  const [snMigrating, setSnMigrating] = useState(false)
  const [pendingEditData, setPendingEditData] = useState<typeof editData | null>(null)
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([])
  const [itemNameEdited, setItemNameEdited] = useState(false)
  const [editData, setEditData] = useState({
    equipmentTypeId: '',
    brandId: '',
    categoryId: '',
    partNumber: '',
    ean13: '',
    itemName: '',
    value: '',
    tracksSerialNumbers: false,
    autoSn: false,
    snExample: '',
  })

  useEffect(() => {
    if (params.id) {
      fetchItem()
      fetchMovements(1, null)
    }
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch('/api/admin/equipment-types', { headers }).then(r => r.json()),
      fetch('/api/admin/equipment-brands', { headers }).then(r => r.json()),
      fetch('/api/admin/item-categories', { headers }).then(r => r.json()),
    ]).then(([types, brands, cats]) => {
      setEquipmentTypes(types)
      setEquipmentBrands(brands)
      setItemCategories(Array.isArray(cats) ? cats : [])
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
        categoryId: data.categoryId || '',
        partNumber: data.partNumber,
        ean13: data.ean13 || '',
        itemName: data.itemName || '',
        value: data.value != null ? data.value.toString() : '',
        tracksSerialNumbers: data.tracksSerialNumbers ?? false,
        autoSn: data.autoSn ?? false,
        snExample: data.snExample || '',
      })
      setItemNameEdited(false)

      // Always fetch SNs — needed for client parts even on non-SN items
      fetchSerialNumbers()
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

  const fetchMovements = async (page: number, snFilter: string | null) => {
    if (!params.id) return
    setMovLoading(true)
    try {
      const token = localStorage.getItem('token')
      const qs = new URLSearchParams({ page: String(page), limit: '25' })
      if (snFilter) qs.set('sn', snFilter)
      const res = await fetch(`/api/warehouse/${params.id}/movements?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMovements(data.movements)
      setMovTotal(data.total)
      setMovPages(data.pages)
    } finally {
      setMovLoading(false)
    }
  }

  const generateEan13 = async () => {
    setGeneratingEan(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/warehouse/generate-ean13', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setEditData(d => ({ ...d, ean13: data.ean13 }))
    } finally {
      setGeneratingEan(false)
    }
  }

  const saveItem = async (data: typeof editData) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/warehouse/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to update item')
    return token
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return

    const wasTracking = item.tracksSerialNumbers
    const willTrack = editData.tracksSerialNumbers
    const hasStock = item.mainWarehouse > 0
    const migrating = !wasTracking && willTrack && hasStock

    try {
      if (migrating && !editData.autoSn) {
        // Manual SN: show modal to collect SNs before saving
        setPendingEditData(editData)
        setShowSnMigration(true)
        return
      }

      const token = await saveItem(editData)

      if (migrating && editData.autoSn) {
        // Auto SN: create SN records for existing stock — stock count stays the same
        await fetch(`/api/warehouse/items/${params.id}/serial-numbers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity: item.mainWarehouse, autoGenerate: true, location: 'MAIN_WAREHOUSE' }),
        })
      }

      setIsEditing(false)
      fetchItem()
      if (willTrack) fetchSerialNumbers()
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  const confirmSnMigration = async () => {
    if (!pendingEditData || !item) return
    const serialNumbers = snMigrationInput.split('\n').map(s => s.trim()).filter(Boolean)
    if (serialNumbers.length === 0) { alert('Insere pelo menos um número de série.'); return }
    if (serialNumbers.length !== item.mainWarehouse) {
      if (!confirm(`O stock actual é ${item.mainWarehouse} unidade(s) mas introduziste ${serialNumbers.length} número(s) de série. Continuar?`)) return
    }
    setSnMigrating(true)
    try {
      const token = await saveItem(pendingEditData)
      // Create SN records for existing stock — stock count stays the same, no movement recorded
      await fetch(`/api/warehouse/items/${params.id}/serial-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serialNumbers, location: 'MAIN_WAREHOUSE' }),
      })
      setShowSnMigration(false)
      setSnMigrationInput('')
      setPendingEditData(null)
      setIsEditing(false)
      fetchItem()
      fetchSerialNumbers()
    } catch (error) {
      console.error('Error during SN migration:', error)
      alert('Erro ao migrar números de série.')
    } finally {
      setSnMigrating(false)
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

  const updateEditSourceField = (patch: Partial<typeof editData>) => {
    setEditData(prev => {
      const next = { ...prev, ...patch }
      if (!itemNameEdited) {
        const tn = equipmentTypes.find(x => x.id === next.equipmentTypeId)?.name || ''
        const bn = equipmentBrands.find(x => x.id === next.brandId)?.name || ''
        next.itemName = [tn, bn, next.partNumber].filter(Boolean).join(' ')
      }
      return next
    })
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
              {item.categoryName && (
                <div>
                  <p className="text-sm text-gray-600">Categoria</p>
                  <p className="text-lg font-semibold text-gray-900">{item.categoryName}</p>
                </div>
              )}
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
              {item.ean13 && (
                <div>
                  <p className="text-sm text-gray-600">EAN-13</p>
                  <p className="text-lg font-semibold font-mono text-gray-900">{item.ean13}</p>
                </div>
              )}
            </div>

            {/* Stock summary — always shown */}
            {(() => {
              const mainCount = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE' && !(sn.isClientPart && sn.clientPartStatus === 'RESOLVED')).length
                : item.mainWarehouse
              const techCount = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'TECHNICIAN' && !sn.isClientPart).length
                : (item.technicianStocks ?? []).reduce((s: number, ts: { quantity: number }) => s + ts.quantity, 0)
              const repairCount = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'REPAIR' && !sn.isClientPart).length
                : item.repairStock
              const destructionCount = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'DESTRUCTION').length
                : (item as any).destructionStock ?? 0
              const clientPartsCount = serialNumbers.filter(sn => sn.isClientPart && sn.clientPartStatus !== 'RESOLVED').length
              return (
                <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
                  {/* Left: own stock */}
                  <div className="flex flex-wrap gap-3">
                    <div className="px-4 py-2 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium">{t('mainWarehouse')}</p>
                      <p className="text-2xl font-bold text-blue-900">{mainCount}</p>
                    </div>
                    <div className="px-4 py-2 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 font-medium">{t('technicianStock')}</p>
                      <p className="text-2xl font-bold text-green-900">{techCount}</p>
                    </div>
                    {repairCount > 0 && (
                      <div className="px-4 py-2 bg-orange-50 rounded-lg">
                        <p className="text-xs text-orange-600 font-medium">{t('inRepair')}</p>
                        <p className="text-2xl font-bold text-orange-900">{repairCount}</p>
                      </div>
                    )}
                    {destructionCount > 0 && (
                      <div className="px-4 py-2 bg-red-50 rounded-lg">
                        <p className="text-xs text-red-600 font-medium">Destruição</p>
                        <p className="text-2xl font-bold text-red-900">{destructionCount}</p>
                      </div>
                    )}
                    <div className="px-4 py-2 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium">{t('totalStock')}</p>
                      <p className="text-2xl font-bold text-purple-900">{mainCount + techCount + repairCount}</p>
                    </div>
                  </div>
                  {/* Right: client-related */}
                  {(clientPartsCount > 0 || item.stockRepairCount > 0) && (
                    <div className="flex flex-wrap gap-3">
                      {clientPartsCount > 0 && (
                        <div className="px-4 py-2 bg-yellow-50 rounded-lg text-right">
                          <p className="text-xs text-yellow-600 font-medium">Rep. de Cliente</p>
                          <p className="text-2xl font-bold text-yellow-900">{clientPartsCount}</p>
                        </div>
                      )}
                      {item.stockRepairCount > 0 && (
                        <div className="px-4 py-2 bg-amber-50 rounded-lg text-right">
                          <p className="text-xs text-amber-600 font-medium">Rep. de Stock</p>
                          <p className="text-2xl font-bold text-amber-900">{item.stockRepairCount}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Technician breakdown — non-SN */}
            {!item.tracksSerialNumbers && (item.technicianStocks ?? []).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2 text-sm">{t('technicianStock')}</h3>
                <div className="flex flex-wrap gap-2">
                  {item.technicianStocks.map((ts, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded border border-green-200 text-sm">
                      <span className="text-gray-800 font-medium">{ts.technician.name}</span>
                      <span className="font-bold text-green-900">{ts.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SN section — compact collapsible groups */}
            {item.tracksSerialNumbers && (
              <div className="mb-6 space-y-2">
                {[
                  { key: 'main', label: t('mainWarehouse'), loc: 'MAIN_WAREHOUSE', color: 'blue' },
                  ...Array.from(new Set(serialNumbers.filter(sn => sn.location === 'TECHNICIAN' && !sn.isClientPart).map(sn => sn.technician?.id ?? ''))).map(techId => {
                    const name = serialNumbers.find(sn => sn.location === 'TECHNICIAN' && !sn.isClientPart && sn.technician?.id === techId)?.technician?.name ?? techId
                    return { key: `tech-${techId}`, label: name, loc: 'TECHNICIAN', techId, color: 'green' }
                  }),
                  { key: 'repair', label: t('inRepair'), loc: 'REPAIR', color: 'orange', excludeClientParts: true },
                  { key: 'destruction', label: 'Destruição', loc: 'DESTRUCTION', color: 'red' },
                  { key: 'used', label: t('used'), loc: 'USED', color: 'gray' },
                ].map(({ key, label, loc, techId, color, excludeClientParts }: { key: string; label: string; loc: string; techId?: string; color: string; excludeClientParts?: boolean }) => {
                  const sns = serialNumbers.filter(sn =>
                    sn.location === loc &&
                    (loc !== 'TECHNICIAN' || (!sn.isClientPart && sn.technician?.id === techId)) &&
                    (!excludeClientParts || !sn.isClientPart) &&
                    !(sn.isClientPart && sn.clientPartStatus === 'RESOLVED')
                  )
                  if (sns.length === 0) return null
                  const expanded = snExpanded[key]
                  const visible = expanded ? sns : sns.slice(0, 10)
                  const colorMap: Record<string, string> = {
                    blue: 'text-blue-700 bg-blue-50 border-blue-200',
                    green: 'text-green-700 bg-green-50 border-green-200',
                    orange: 'text-orange-700 bg-orange-50 border-orange-200',
                    red: 'text-red-700 bg-red-50 border-red-200',
                    gray: 'text-gray-600 bg-gray-50 border-gray-200',
                  }
                  const pillMap: Record<string, string> = {
                    blue: 'bg-blue-100 text-blue-900',
                    green: 'bg-green-100 text-green-900',
                    orange: 'bg-orange-100 text-orange-900',
                    red: 'bg-red-100 text-red-900',
                    gray: 'bg-gray-200 text-gray-700',
                  }
                  return (
                    <div key={key} className={`border rounded-lg p-3 ${colorMap[color]}`}>
                      <button
                        type="button"
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => setSnExpanded(e => ({ ...e, [key]: !e[key] }))}
                      >
                        <span className="text-sm font-medium">{label} <span className="font-bold">({sns.length})</span></span>
                        <span className="text-xs opacity-60">{expanded ? '▲' : '▼'}</span>
                      </button>
                      {expanded && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {visible.map(sn => (
                            <button
                              key={sn.id}
                              type="button"
                              onClick={() => {
                                const next = movSnFilter === sn.serialNumber ? null : sn.serialNumber
                                setMovSnFilter(next)
                                setMovPage(1)
                                fetchMovements(1, next)
                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                              }}
                              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                                movSnFilter === sn.serialNumber
                                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                  : `${pillMap[color]} hover:opacity-75`
                              }`}
                            >
                              {sn.serialNumber}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>


          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('stockOperations')}</h2>
            {(() => {
              const noMainStock = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length === 0
                : item.mainWarehouse === 0
              const noTechStock = item.tracksSerialNumbers
                ? serialNumbers.filter(sn => sn.location === 'TECHNICIAN').length === 0
                : (item.technicianStocks ?? []).length === 0
              return (
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => openStockOperation('ADD_STOCK')} className="btn btn-primary">
                    {t('addStock')}
                  </button>
                  <button
                    onClick={() => openStockOperation('TRANSFER_TO_TECH')}
                    className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={noMainStock}
                  >
                    {t('transferToTech')}
                  </button>
                  <button
                    onClick={() => openStockOperation('TRANSFER_FROM_TECH')}
                    className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={noTechStock}
                  >
                    {t('transferFromTech')}
                  </button>
                  <button
                    onClick={() => openStockOperation('MOVE_TO_DESTRUCTION')}
                    className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={noMainStock}
                  >
                    Enviar para Destruição
                  </button>
                  <button
                    onClick={() => openStockOperation('REMOVE_STOCK')}
                    className="btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={noMainStock}
                  >
                    Remover Definitivamente
                  </button>
                </div>
              )
            })()}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {t('movements')}
                {movSnFilter && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    — SN: <span className="font-mono font-semibold">{movSnFilter}</span>
                    <button
                      onClick={() => { setMovSnFilter(null); setMovPage(1); fetchMovements(1, null) }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >✕</button>
                  </span>
                )}
              </h2>
              <span className="text-sm text-gray-400">{movTotal} movimento(s)</span>
            </div>

            {movLoading ? (
              <p className="text-gray-500 text-sm py-4 text-center">{tCommon('loading')}</p>
            ) : movements.length === 0 ? (
              <p className="text-gray-600">{t('noMovements')}</p>
            ) : (
              <div className="space-y-3">
                {movements.map((movement) => (
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
                            <button
                              key={msn.serialNumber.id}
                              onClick={() => {
                                const sn = msn.serialNumber.serialNumber
                                const next = movSnFilter === sn ? null : sn
                                setMovSnFilter(next)
                                setMovPage(1)
                                fetchMovements(1, next)
                              }}
                              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                                movSnFilter === msn.serialNumber.serialNumber
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-800 hover:bg-blue-100 hover:text-blue-800'
                              }`}
                            >
                              {msn.serialNumber.serialNumber}
                            </button>
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

            {movPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <button
                  onClick={() => { const p = movPage - 1; setMovPage(p); fetchMovements(p, movSnFilter) }}
                  disabled={movPage === 1 || movLoading}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >← Anterior</button>
                <span className="text-sm text-gray-600">{movPage} / {movPages}</span>
                <button
                  onClick={() => { const p = movPage + 1; setMovPage(p); fetchMovements(p, movSnFilter) }}
                  disabled={movPage === movPages || movLoading}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Próximo →</button>
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
              onChange={(e) => updateEditSourceField({ equipmentTypeId: e.target.value })}
            >
              <option value="">{t('selectType')}</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              className="input text-gray-800"
              value={editData.categoryId}
              onChange={(e) => setEditData(f => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">— Sem categoria —</option>
              {itemCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
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
              onChange={(e) => updateEditSourceField({ brandId: e.target.value })}
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
              onChange={(e) => updateEditSourceField({ partNumber: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EAN-13</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-gray-800 font-mono flex-1"
                value={editData.ean13}
                onChange={(e) => setEditData({ ...editData, ean13: e.target.value })}
                placeholder="0000000000000"
                maxLength={13}
              />
              <button
                type="button"
                onClick={generateEan13}
                disabled={generatingEan}
                className="btn btn-secondary shrink-0"
              >
                {generatingEan ? '...' : 'Gerar'}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">{t('itemNamePreview')}</label>
              {itemNameEdited && editComputedName && (
                <button type="button" onClick={() => { setEditData(d => ({ ...d, itemName: editComputedName })); setItemNameEdited(false) }}
                  className="text-xs text-blue-600 hover:text-blue-800">↺ Repor automático</button>
              )}
            </div>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.itemName}
              onChange={e => { setEditData(d => ({ ...d, itemName: e.target.value })); setItemNameEdited(true) }}
              placeholder={editComputedName || 'Nome do artigo'}
            />
            {!itemNameEdited && editComputedName && (
              <p className="text-xs text-gray-400 mt-1">Gerado automaticamente a partir do tipo, marca e referência</p>
            )}
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
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="editTracksSerialNumbers"
                checked={editData.tracksSerialNumbers}
                onChange={(e) => setEditData({ ...editData, tracksSerialNumbers: e.target.checked, autoSn: false })}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="editTracksSerialNumbers" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {t('tracksSerialNumbers')}
                </label>
                <p className="text-xs text-gray-500 mt-1">{t('tracksSnHelp')}</p>
              </div>
            </div>

            {editData.tracksSerialNumbers && (
              <div className="ml-6 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="editAutoSn"
                  checked={editData.autoSn}
                  onChange={(e) => setEditData({ ...editData, autoSn: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="editAutoSn" className="text-sm font-medium text-gray-700 cursor-pointer">
                    {t('autoSnGeneration')}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{t('autoSnGenerationHelp')}</p>
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
            )}
          </div>

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

      {showSnMigration && item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Introduzir Números de Série</h3>
            <p className="text-sm text-gray-600 mb-4">
              Este artigo tem <span className="font-semibold">{item.mainWarehouse}</span> unidade(s) em stock.
              Introduz os números de série existentes (um por linha).
            </p>
            <textarea
              className="input text-gray-800 font-mono text-sm w-full"
              rows={8}
              value={snMigrationInput}
              onChange={e => setSnMigrationInput(e.target.value)}
              placeholder={'SN001\nSN002\nSN003\n...'}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {snMigrationInput.split('\n').filter(s => s.trim()).length} número(s) introduzido(s)
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmSnMigration}
                disabled={snMigrating}
                className="btn btn-primary flex-1"
              >
                {snMigrating ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setShowSnMigration(false); setPendingEditData(null) }}
                disabled={snMigrating}
                className="btn btn-secondary"
              >
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        </div>
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
            fetchMovements(1, movSnFilter)
            if (item.tracksSerialNumbers) {
              fetchSerialNumbers()
            }
          }}
        />
      )}
    </div>
  )
}

