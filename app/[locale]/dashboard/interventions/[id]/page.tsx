'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  partsUsed: string | null
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    city: string | null
    phone: string | null
  }
  assignedTo: {
    id: string
    name: string
    email: string
  }
  createdBy: {
    id: string
    name: string
    email: string
  } | null
}

export default function InterventionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [intervention, setIntervention] = useState<Intervention | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [editData, setEditData] = useState({
    status: '',
    workDone: '',
    timeSpent: '',
    description: '',
    partsUsed: '',
    scheduledDate: '',
    scheduledTime: '',
  })

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserRole(user.role)
    }
    
    if (params.id) {
      fetchIntervention()
    }
  }, [params.id])

  const fetchIntervention = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      
      if (response.status === 403) {
        alert('You do not have permission to view this intervention')
        router.push('/dashboard/interventions')
        return
      }
      
      setIntervention(data)
      
      // Set edit data
      const parts = data.partsUsed ? JSON.parse(data.partsUsed) : []
      const schedDate = new Date(data.scheduledDate).toISOString().split('T')[0]
      setEditData({
        status: data.status,
        workDone: data.workDone || '',
        timeSpent: data.timeSpent?.toString() || '',
        description: data.description || '',
        partsUsed: Array.isArray(parts) ? parts.join('\n') : '',
        scheduledDate: schedDate,
        scheduledTime: data.scheduledTime,
      })
    } catch (error) {
      console.error('Error fetching intervention:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editData,
          timeSpent: editData.timeSpent ? parseFloat(editData.timeSpent) : null,
          partsUsed: editData.partsUsed ? editData.partsUsed.split('\n').filter(p => p.trim()) : [],
          clientId: intervention?.client.id,
          assignedToId: intervention?.assignedTo.id,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to update intervention')
        return
      }

      setIsEditing(false)
      fetchIntervention()
    } catch (error) {
      console.error('Error updating intervention:', error)
      alert('Failed to update intervention')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading intervention...</div>
      </div>
    )
  }

  if (!intervention) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">Intervention not found</p>
      </div>
    )
  }

  const parts = intervention.partsUsed ? JSON.parse(intervention.partsUsed) : []
  const canEdit = canEditIntervention(userRole as any, intervention.status as any)
  const availableStatuses = getAvailableStatuses(userRole as any, intervention.status as any)

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/interventions')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Interventions
        </button>
      </div>

      {!isEditing ? (
        <>
          <div className="card mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm px-3 py-1 rounded-full ${getStatusColor(intervention.status as any)}`}>
                    {getStatusLabel(intervention.status as any)}
                  </span>
                  <span className="text-sm text-gray-600">
                    Scheduled: {new Date(intervention.scheduledDate).toLocaleDateString()} at {intervention.scheduledTime}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {intervention.workDone || 'Intervention Details'}
                </h1>
              </div>
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-secondary"
                >
                  Edit
                </button>
              )}
            </div>

            {(intervention.status === 'COMPLETED' || intervention.status === 'CANCELED') && userRole !== 'ADMIN' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  ℹ️ This intervention is {intervention.status.toLowerCase()} and cannot be edited.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Client Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <p className="text-gray-900">{intervention.client.name}</p>
                  </div>
                  {intervention.client.city && (
                    <div>
                      <span className="font-medium text-gray-600">City:</span>
                      <p className="text-gray-900">{intervention.client.city}</p>
                    </div>
                  )}
                  {intervention.client.phone && (
                    <div>
                      <span className="font-medium text-gray-600">Phone:</span>
                      <p className="text-gray-900">{intervention.client.phone}</p>
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/clients/${intervention.client.id}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View Client Details →
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Work Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Assigned Technician:</span>
                    <p className="text-gray-900">{intervention.assignedTo.name}</p>
                  </div>
                  {intervention.createdBy && (
                    <div>
                      <span className="font-medium text-gray-600">Created By:</span>
                      <p className="text-gray-900">{intervention.createdBy.name}</p>
                    </div>
                  )}
                  {intervention.timeSpent && (
                    <div>
                      <span className="font-medium text-gray-600">Time Spent:</span>
                      <p className="text-gray-900">{intervention.timeSpent} hours</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-600">Created:</span>
                    <p className="text-gray-900">{new Date(intervention.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Last Updated:</span>
                    <p className="text-gray-900">{new Date(intervention.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {intervention.description && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{intervention.description}</p>
              </div>
            )}

            {parts.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-gray-700 mb-2">Parts Used</h3>
                <ul className="list-disc list-inside space-y-1">
                  {parts.map((part: string, index: number) => (
                    <li key={index} className="text-gray-900">{part}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleUpdate} className="card space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Intervention</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="input text-gray-800"
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
            >
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
            {userRole === 'TECHNICIAN' && (
              <p className="text-xs text-gray-500 mt-1">
                Technicians can only move interventions to In Progress or Quality Assessment
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                className="input text-gray-800"
                value={editData.scheduledDate}
                onChange={(e) => setEditData({ ...editData, scheduledDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time
              </label>
              <input
                type="time"
                className="input text-gray-800"
                value={editData.scheduledTime}
                onChange={(e) => setEditData({ ...editData, scheduledTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Work Done
            </label>
            <input
              type="text"
              className="input text-gray-800"
              value={editData.workDone}
              onChange={(e) => setEditData({ ...editData, workDone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Spent (hours)
            </label>
            <input
              type="number"
              step="0.5"
              className="input text-gray-800"
              value={editData.timeSpent}
              onChange={(e) => setEditData({ ...editData, timeSpent: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={4}
              className="input text-gray-800"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parts Used (one per line)
            </label>
            <textarea
              rows={4}
              className="input text-gray-800"
              value={editData.partsUsed}
              onChange={(e) => setEditData({ ...editData, partsUsed: e.target.value })}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary flex-1">
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
