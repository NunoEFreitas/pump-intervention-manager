'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

interface Stats {
  totalInterventions: number
  openInterventions: number
  inProgressInterventions: number
  qualityAssessmentInterventions: number
  completedInterventions: number
  canceledInterventions: number
}

export default function DashboardPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tStatus = useTranslations('interventions.status')
  const tCommon = useTranslations('common')
  
  const [stats, setStats] = useState<Stats>({
    totalInterventions: 0,
    openInterventions: 0,
    inProgressInterventions: 0,
    qualityAssessmentInterventions: 0,
    completedInterventions: 0,
    canceledInterventions: 0,
  })
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserRole(user.role)
    }
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const interventionsRes = await fetch('/api/interventions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const interventions = await interventionsRes.json()

      if (!Array.isArray(interventions)) {
        console.error('Invalid interventions data:', interventions)
        setStats({
          totalInterventions: 0,
          openInterventions: 0,
          inProgressInterventions: 0,
          qualityAssessmentInterventions: 0,
          completedInterventions: 0,
          canceledInterventions: 0,
        })
        return
      }

      setStats({
        totalInterventions: interventions.length,
        openInterventions: interventions.filter((i: any) => i.status === 'OPEN').length,
        inProgressInterventions: interventions.filter((i: any) => i.status === 'IN_PROGRESS').length,
        qualityAssessmentInterventions: interventions.filter((i: any) => i.status === 'QUALITY_ASSESSMENT').length,
        completedInterventions: interventions.filter((i: any) => i.status === 'COMPLETED').length,
        canceledInterventions: interventions.filter((i: any) => i.status === 'CANCELED').length,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: t('totalInterventions'),
      value: stats.totalInterventions,
      color: 'bg-blue-500',
      link: `/${locale}/dashboard/interventions`,
    },
    {
      title: tStatus('open'),
      value: stats.openInterventions,
      color: 'bg-yellow-500',
      link: `/${locale}/dashboard/interventions?status=OPEN`,
    },
    {
      title: tStatus('inProgress'),
      value: stats.inProgressInterventions,
      color: 'bg-blue-600',
      link: `/${locale}/dashboard/interventions?status=IN_PROGRESS`,
    },
    {
      title: tStatus('qualityAssessment'),
      value: stats.qualityAssessmentInterventions,
      color: 'bg-purple-500',
      link: `/${locale}/dashboard/interventions?status=QUALITY_ASSESSMENT`,
    },
    {
      title: tStatus('completed'),
      value: stats.completedInterventions,
      color: 'bg-green-500',
      link: `/${locale}/dashboard/interventions?status=COMPLETED`,
    },
    {
      title: tStatus('canceled'),
      value: stats.canceledInterventions,
      color: 'bg-red-500',
      link: `/${locale}/dashboard/interventions?status=CANCELED`,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-600 mb-8">
          {userRole === 'TECHNICIAN' ? t('overviewTechnician') : t('overview')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(stat.link)}
          >
            <div className="flex items-center">
              <div className={`${stat.color} rounded-full p-3 mr-4`}>
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {userRole !== 'TECHNICIAN' && (
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('quickActions')}</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/${locale}/dashboard/clients/new`)}
                className="btn btn-primary w-full"
              >
                {t('addClient')}
              </button>
              <button
                onClick={() => router.push(`/${locale}/dashboard/interventions/new`)}
                className="btn btn-primary w-full"
              >
                {t('createIntervention')}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('recentActivity')}</h2>
            <p className="text-gray-600 text-sm">{t('activityMessage')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
