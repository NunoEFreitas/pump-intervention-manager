'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface TechnicianStock {
  id: string
  name: string
  email: string
  totalItems: number
  totalValue: number
  stockItems: Array<{
    itemName: string
    quantity: number
  }>
}

export default function TechniciansPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')

  const [technicians, setTechnicians] = useState<TechnicianStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse/technicians', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setTechnicians(data)
    } catch (error) {
      console.error('Error fetching technicians:', error)
    } finally {
      setLoading(false)
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('techniciansTitle')}</h1>
          <p className="text-gray-600">{t('techniciansSubtitle')}</p>
        </div>
      </div>

      {technicians.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">{t('noTechnicians')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/${locale}/dashboard/warehouse/technicians/${tech.id}`)}
            >
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {tech.name}
                </h3>
                <p className="text-sm text-gray-600">{tech.email}</p>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex-1 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Total Items</p>
                  <p className="text-2xl font-bold text-blue-900">{tech.totalItems}</p>
                </div>
                <div className="flex-1 p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Total Value</p>
                  <p className="text-xl font-bold text-green-900">€{tech.totalValue.toFixed(2)}</p>
                </div>
              </div>

              {tech.stockItems.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">Stock Items:</p>
                  <div className="space-y-1">
                    {tech.stockItems.slice(0, 3).map((item, idx) => (
                      <p key={idx} className="text-sm text-gray-700">
                        {item.itemName}: <span className="font-semibold">{item.quantity}</span>
                      </p>
                    ))}
                    {tech.stockItems.length > 3 && (
                      <p className="text-xs text-gray-500">+{tech.stockItems.length - 3} more...</p>
                    )}
                  </div>
                </div>
              )}

              <button
                className="mt-4 w-full btn btn-primary text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/${locale}/dashboard/warehouse/technicians/${tech.id}`)
                }}
              >
                {t('viewTechnicianStock')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
