'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getStatusColor, getStatusLabel } from '@/lib/permissions'

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

export default function InterventionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL')

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
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setInterventions(data)
      } else {
        console.error('Invalid data format:', data)
        setInterventions([])
        setError('Invalid data format received')
      }
    } catch (error) {
      console.error('Error fetching interventions:', error)
      setInterventions([])
      setError('Failed to load interventions')
    } finally {
      setLoading(false)
    }
  }

  const filteredInterventions = statusFilter === 'ALL'
    ? interventions
    : interventions.filter(i => i.status === statusFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading interventions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => {
            setError('')
            setLoading(true)
            fetchInterventions()
          }}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-0 flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interventions</h1>
          <p className="text-gray-600">Manage pump station interventions</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/interventions/new')}
          className="btn btn-primary"
        >
          + New Intervention
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({interventions?.length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'OPEN'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            }`}
          >
            Open ({interventions?.filter(i => i.status === 'OPEN').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-blue-700 text-white'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
          >
            In Progress ({interventions?.filter(i => i.status === 'IN_PROGRESS').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('QUALITY_ASSESSMENT')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'QUALITY_ASSESSMENT'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
            }`}
          >
            Quality Assessment ({interventions?.filter(i => i.status === 'QUALITY_ASSESSMENT').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'COMPLETED'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            Completed ({interventions?.filter(i => i.status === 'COMPLETED').length || 0})
          </button>
          <button
            onClick={() => setStatusFilter('CANCELED')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'CANCELED'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            Canceled ({interventions?.filter(i => i.status === 'CANCELED').length || 0})
          </button>
        </div>
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">
            No interventions found.
          </p>
          <button
            onClick={() => router.push('/dashboard/interventions/new')}
            className="btn btn-primary"
          >
            + Create First Intervention
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInterventions.map((intervention) => (
            <div
              key={intervention.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/interventions/${intervention.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(intervention.status as any)}`}>
                      {getStatusLabel(intervention.status as any)}
                    </span>
                    <span className="text-sm text-gray-600">
                      Scheduled: {new Date(intervention.scheduledDate).toLocaleDateString()} at {intervention.scheduledTime}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {intervention.workDone || 'Intervention Scheduled'}
                  </h3>
                  
                  {intervention.description && (
                    <p className="text-gray-600 mb-3">
                      {intervention.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Client: {intervention.client.name}
                    </div>
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Technician: {intervention.assignedTo.name}
                    </div>
                    {intervention.timeSpent && (
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Time: {intervention.timeSpent}h
                      </div>
                    )}
                    {intervention.client.city && (
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {intervention.client.city}
                      </div>
                    )}
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
