// FILE: app/[locale]/dashboard/warehouse/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }
interface ItemCategory { id: string; name: string }

export default function NewWarehouseItemPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [loading, setLoading] = useState(false)
  const [generatingEan, setGeneratingEan] = useState(false)
  const [error, setError] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([])
  const [itemNameEdited, setItemNameEdited] = useState(false)
  const [formData, setFormData] = useState({
    equipmentTypeId: '',
    brandId: '',
    categoryId: '',
    partNumber: '',
    ean13: '',
    itemName: '',
    value: '',
    mainWarehouse: '0',
    tracksSerialNumbers: false,
    autoSn: false,
    snExample: '',
  })

  useEffect(() => {
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
  }, [])

  const typeName = equipmentTypes.find(t => t.id === formData.equipmentTypeId)?.name || ''
  const brandName = equipmentBrands.find(b => b.id === formData.brandId)?.name || ''
  const computedItemName = [typeName, brandName, formData.partNumber].filter(Boolean).join(' ')

  const updateSourceField = (patch: Partial<typeof formData>) => {
    setFormData(prev => {
      const next = { ...prev, ...patch }
      if (!itemNameEdited) {
        const t = equipmentTypes.find(x => x.id === next.equipmentTypeId)?.name || ''
        const b = equipmentBrands.find(x => x.id === next.brandId)?.name || ''
        next.itemName = [t, b, next.partNumber].filter(Boolean).join(' ')
      }
      return next
    })
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
      if (res.ok) setFormData(f => ({ ...f, ean13: data.ean13 }))
    } finally {
      setGeneratingEan(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || tErrors('failedToCreate'))
      }

      router.push(`/${locale}/dashboard/warehouse`)
    } catch (err: any) {
      setError(err.message || tErrors('failedToCreate'))
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800 mb-4">
          ← {tCommon('back')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('newItem')}</h1>
        <p className="text-gray-600">{t('newItemSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('equipmentType')} *
          </label>
          <select
            className="input text-gray-800"
            value={formData.equipmentTypeId}
            onChange={(e) => updateSourceField({ equipmentTypeId: e.target.value })}
            required
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
            value={formData.categoryId}
            onChange={(e) => setFormData(f => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">— Sem categoria —</option>
            {itemCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('equipmentBrand')} *
          </label>
          <select
            className="input text-gray-800"
            value={formData.brandId}
            onChange={(e) => updateSourceField({ brandId: e.target.value })}
            required
          >
            <option value="">{t('selectBrand')}</option>
            {equipmentBrands.map(brand => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('partNumber')} *
          </label>
          <input
            type="text"
            className="input text-gray-800"
            value={formData.partNumber}
            onChange={(e) => updateSourceField({ partNumber: e.target.value })}
            placeholder="e.g., PS-2024-001"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">EAN-13</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input text-gray-800 font-mono flex-1"
              value={formData.ean13}
              onChange={(e) => setFormData({ ...formData, ean13: e.target.value })}
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
            {itemNameEdited && computedItemName && (
              <button type="button" onClick={() => { setFormData(f => ({ ...f, itemName: computedItemName })); setItemNameEdited(false) }}
                className="text-xs text-blue-600 hover:text-blue-800">↺ Repor automático</button>
            )}
          </div>
          <input
            type="text"
            className="input text-gray-800"
            value={formData.itemName}
            onChange={e => { setFormData(f => ({ ...f, itemName: e.target.value })); setItemNameEdited(true) }}
            placeholder={computedItemName || 'Nome do artigo'}
          />
          {!itemNameEdited && computedItemName && (
            <p className="text-xs text-gray-400 mt-1">Gerado automaticamente a partir do tipo, marca e referência</p>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="tracksSerialNumbers"
              checked={formData.tracksSerialNumbers}
              onChange={(e) => setFormData({ ...formData, tracksSerialNumbers: e.target.checked, autoSn: false })}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="tracksSerialNumbers" className="text-sm font-medium text-gray-700 cursor-pointer">
                {t('tracksSerialNumbers')}
              </label>
              <p className="text-xs text-gray-500 mt-1">{t('tracksSnHelp')}</p>
            </div>
          </div>

          {formData.tracksSerialNumbers && (
            <div className="ml-6 flex items-start gap-3">
              <input
                type="checkbox"
                id="autoSn"
                checked={formData.autoSn}
                onChange={(e) => setFormData({ ...formData, autoSn: e.target.checked })}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="autoSn" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {t('autoSnGeneration')}
                </label>
                <p className="text-xs text-gray-500 mt-1">{t('autoSnGenerationHelp')}</p>
                {formData.autoSn && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      className="input text-gray-800"
                      value={formData.snExample}
                      onChange={(e) => setFormData({ ...formData, snExample: e.target.value })}
                      placeholder="e.g., PUMP-GF-PS001"
                    />
                    {formData.snExample && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs text-blue-800">
                          {t('snFormatPreview')}: <span className="font-mono font-semibold">{formData.snExample}-1</span>, <span className="font-mono font-semibold">{formData.snExample}-2</span>…
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!formData.autoSn && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-800">{t('manualSnNote')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('value')} (€)
          </label>
          <input
            type="number"
            step="0.01"
            className="input text-gray-800"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="0.00"
          />
        </div>

        {!formData.tracksSerialNumbers && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mainWarehouse')}
            </label>
            <input
              type="number"
              className="input text-gray-800"
              value={formData.mainWarehouse}
              onChange={(e) => setFormData({ ...formData, mainWarehouse: e.target.value })}
              placeholder="0"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">{t('initialStockHelp')}</p>
          </div>
        )}

        {formData.tracksSerialNumbers && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">{t('snInitialStockNote')}</p>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
            {loading ? tCommon('loading') : t('createButton')}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary" disabled={loading}>
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
