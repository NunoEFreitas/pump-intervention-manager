'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getStatusColor } from '@/lib/permissions'
import type { InterventionStatus } from '@/lib/permissions'

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  client: {
    id: string
    name: string
    city: string | null
  }
  assignedTo: {
    name: string
  }
}

function InterventionsContent() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const searchParams = useSearchParams()
  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL')
  const [clientSearch, setClientSearch] = useState('')

  // Helper function to get translated status labels
  const getTranslatedStatusLabel = (status: string): string => {
    switch (status) {
      case 'ALL':
        return tCommon('all')
      case 'OPEN':
        return t('statusOpen')
      case 'IN_PROGRESS':
        return t('statusInProgress')
      case 'QUALITY_ASSESSMENT':
        return t('statusQualityAssessment')
      case 'COMPLETED':
        return t('statusCompleted')
      case 'CANCELED':
        return t('statusCanceled')
      default:
        return status
    }
  }

  useEffect(() => {
    fetchInterventions()
  }, [])

  const fetchInterventions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/interventions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch interventions')
      }
      
      if (Array.isArray(data)) {
        setInterventions(data)
      } else {
        setInterventions([])
        setError('Invalid data format received')
      }
    } catch (error) {
      setError('Failed to load interventions')
    } finally {
      setLoading(false)
    }
  }

  const filteredInterventions = interventions
    .filter(i => statusFilter === 'ALL' || i.status === statusFilter)
    .filter(i => clientSearch === '' || i.client.name.toLowerCase().includes(clientSearch.toLowerCase()))

  if (loading) return <div className="text-center py-12 text-gray-600">{tCommon('loading')}</div>

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => { setError(''); setLoading(true); fetchInterventions(); }} className="btn btn-primary">{tCommon('retry')}</button>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>
        <button onClick={() => router.push(`/${locale}/dashboard/interventions/new`)} className="btn btn-primary w-full sm:w-auto">{t('newIntervention')}</button>
      </div>

      <div className="card mb-6">
        <div className="mb-4">
          <input
            type="text"
            className="input"
            placeholder={`${tCommon('search')} ${t('fieldsClient').toLowerCase()}...`}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'QUALITY_ASSESSMENT', 'COMPLETED', 'CANCELED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getTranslatedStatusLabel(status)} ({status === 'ALL' ? interventions.length : interventions.filter(i => i.status === status).length})
            </button>
          ))}
        </div>
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">{t('noInterventions')}</p>
          <button onClick={() => router.push(`/${locale}/dashboard/interventions/new`)} className="btn btn-primary">{t('createFirst')}</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInterventions.map((intervention) => (
            <div
              key={intervention.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/${locale}/dashboard/interventions/${intervention.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(intervention.status as any)}`}>
                      {getTranslatedStatusLabel(intervention.status)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {t('scheduled')}: {new Date(intervention.scheduledDate).toLocaleDateString()} {intervention.scheduledTime}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{intervention.workDone || t('scheduledIntervention')}</h3>
                  {intervention.description && <p className="text-gray-600 mb-3">{intervention.description}</p>}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center">{t('fieldsClient')}: {intervention.client.name}</span>
                    <span className="flex items-center">{t('technician')}: {intervention.assignedTo.name}</span>
                    {intervention.timeSpent && <span>{t('time')}: {intervention.timeSpent}h</span>}
                    {intervention.client.city && <span>{intervention.client.city}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InterventionsPage() {
  const tCommon = useTranslations('common')

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-600">{tCommon('loading')}</div>}>
      <InterventionsContent />
    </Suspense>
  )
}