'use client'

import { useEffect, useState, Suspense } from 'react'
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

function InterventionsContent() {
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

  const filteredInterventions = statusFilter === 'ALL'
    ? interventions
    : interventions.filter(i => i.status === statusFilter)

  if (loading) return <div className="text-center py-12 text-gray-600">Loading interventions...</div>

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => { setError(''); setLoading(true); fetchInterventions(); }} className="btn btn-primary">Retry</button>
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
        <button onClick={() => router.push('/dashboard/interventions/new')} className="btn btn-primary">+ New Intervention</button>
      </div>

      <div className="card mb-6">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'QUALITY_ASSESSMENT', 'COMPLETED', 'CANCELED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg ${
                statusFilter === status 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status.replace('_', ' ')} ({status === 'ALL' ? interventions.length : interventions.filter(i => i.status === status).length})
            </button>
          ))}
        </div>
      </div>

      {filteredInterventions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">No interventions found.</p>
          <button onClick={() => router.push('/dashboard/interventions/new')} className="btn btn-primary">+ Create First Intervention</button>
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
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{intervention.workDone || 'Intervention Scheduled'}</h3>
                  {intervention.description && <p className="text-gray-600 mb-3">{intervention.description}</p>}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center">Client: {intervention.client.name}</span>
                    <span className="flex items-center">Technician: {intervention.assignedTo.name}</span>
                    {intervention.timeSpent && <span>Time: {intervention.timeSpent}h</span>}
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
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-600">Loading interventions...</div>}>
      <InterventionsContent />
    </Suspense>
  )
}