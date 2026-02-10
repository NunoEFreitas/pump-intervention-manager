'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getStatusColor, getStatusLabel } from '@/lib/permissions'

interface Client {
  id: string
  name: string
  address: string
  city: string
  postalCode: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  interventions: Intervention[]
}

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  assignedTo: {
    name: string
  }
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchClient()
    }
  }, [params.id])

  const fetchClient = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/clients/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClient(data)
    } catch (error) {
      console.error('Error fetching client:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS':
        return 'bg-orange-100 text-orange-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Open'
      case 'IN_PROGRESS':
        return 'In Progress'
      case 'COMPLETED':
        return 'Completed'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading client...</div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">Client not found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Clients
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
          <button
            onClick={() => router.push(`/dashboard/interventions/new?clientId=${client.id}`)}
            className="btn btn-primary"
          >
            + New Intervention
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {client.address && (
            <div>
              <span className="font-medium text-gray-700">Address:</span>
              <p className="text-gray-600">{client.address}</p>
            </div>
          )}
          {client.city && (
            <div>
              <span className="font-medium text-gray-700">City:</span>
              <p className="text-gray-600">{client.city}</p>
            </div>
          )}
          {client.postalCode && (
            <div>
              <span className="font-medium text-gray-700">Postal Code:</span>
              <p className="text-gray-600">{client.postalCode}</p>
            </div>
          )}
          {client.phone && (
            <div>
              <span className="font-medium text-gray-700">Phone:</span>
              <p className="text-gray-600">{client.phone}</p>
            </div>
          )}
          {client.email && (
            <div>
              <span className="font-medium text-gray-700">Email:</span>
              <p className="text-gray-600">{client.email}</p>
            </div>
          )}
          {client.contactPerson && (
            <div>
              <span className="font-medium text-gray-700">Contact Person:</span>
              <p className="text-gray-600">{client.contactPerson}</p>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mt-4 pt-4 border-t">
            <span className="font-medium text-gray-700">Notes:</span>
            <p className="text-gray-600 mt-1">{client.notes}</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Interventions ({client.interventions.length})
        </h2>

        {client.interventions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No interventions yet</p>
            <button
              onClick={() => router.push(`/dashboard/interventions/new?clientId=${client.id}`)}
              className="btn btn-primary"
            >
              + Create First Intervention
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {client.interventions.map((intervention) => (
              <div
                key={intervention.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/interventions/${intervention.id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(intervention.status)}`}>
                        {getStatusLabel(intervention.status)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(intervention.scheduledDate).toLocaleDateString()} at {intervention.scheduledTime}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {intervention.workDone || 'Intervention Scheduled'}
                    </h3>
                    {intervention.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {intervention.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Technician: {intervention.assignedTo.name}</span>
                      {intervention.timeSpent && <span>Time: {intervention.timeSpent}h</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
