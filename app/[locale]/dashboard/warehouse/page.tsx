// FILE: app/[locale]/dashboard/warehouse/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface WarehouseItem {
  id: string
  itemName: string
  partNumber: string
  serialNumber: string | null
  value: number
  mainWarehouse: number
  tracksSerialNumbers: boolean
  totalTechnicianStock: number
  totalStock: number
  technicianStocks: Array<{
    technician: {
      id: string
      name: string
    }
    quantity: number
  }>
}

export default function WarehousePage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

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
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-0 flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push(`/${locale}/dashboard/warehouse/new`)}
          className="btn btn-primary"
        >
          {t('addItem')}
        </button>
      </div>

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
          <button
            onClick={() => router.push(`/${locale}/dashboard/warehouse/new`)}
            className="btn btn-primary"
          >
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
                    <h3 className="text-xl font-semibold text-gray-900">
                      {item.itemName}
                    </h3>
                    {item.tracksSerialNumbers && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        SN Tracked
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium text-gray-600">{t('partNumber')}:</span>
                      <p className="text-gray-900">{item.partNumber}</p>
                    </div>
                    {item.serialNumber && (
                      <div>
                        <span className="font-medium text-gray-600">{t('serialNumber')}:</span>
                        <p className="text-gray-900">{item.serialNumber}</p>
                      </div>
                    )}
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
    </div>
  )
}
