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
    const fetchTechnicians = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/warehouse/technicians', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setTechnicians(await response.json())
      } catch (error) {
        console.error('Error fetching technicians:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTechnicians()
  }, [])

  return (
    <div>
      <div className="px-4 sm:px-0 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{t('techniciansTitle')}</h1>
        <p className="text-gray-600">{t('techniciansSubtitle')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <span className="text-gray-600">{tCommon('loading')}</span>
        </div>
      ) : technicians.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">{t('noTechnicians')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer w-full"
              onClick={() => router.push(`/${locale}/dashboard/warehouse/technicians/${tech.id}`)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-lg font-semibold text-gray-900">{tech.name}</span>
                  <span className="ml-2 text-sm text-gray-400">{tech.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded text-sm font-medium">
                    {tech.totalItems} <span className="font-normal text-blue-600">{t('totalItems')}</span>
                  </span>
                  <span className="px-3 py-1.5 bg-green-50 text-green-800 rounded text-sm font-medium">
                    €{tech.totalValue.toFixed(2)}
                  </span>
                </div>
              </div>

              {tech.stockItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
                  {tech.stockItems.slice(0, 5).map((item, idx) => (
                    <span key={idx}>{item.itemName} <span className="font-semibold text-gray-700">{item.quantity}</span></span>
                  ))}
                  {tech.stockItems.length > 5 && (
                    <span className="text-gray-400">+{tech.stockItems.length - 5} {t('moreItems', { count: tech.stockItems.length - 5 })}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
