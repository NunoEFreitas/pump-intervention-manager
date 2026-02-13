'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getAvailableStatuses, getStatusColor, getStatusLabel, canEditIntervention } from '@/lib/permissions'
import PartsSelector from './PartsSelector'

interface InterventionPart {
  id: string
  quantity: number
  item: {
    id: string
    itemName: string
    partNumber: string
    value: number
    tracksSerialNumbers: boolean
  }
  serialNumbers?: Array<{
    id: string
    serialNumber: string
  }>
}

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  breakdown: string
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
  const locale = params.locale as string
  const t = useTranslations('interventions')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const [intervention, setIntervention] = useState<Intervention | null>(null)
  const [parts, setParts] = useState<InterventionPart[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showPartsSelector, setShowPartsSelector] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [editData, setEditData] = useState({
    status: '',
    workDone: '',
    timeSpent: '',
    description: '',
    breakdown: '',
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
      fetchParts()
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
        router.push(`/${locale}/dashboard/interventions`)
        return
      }

      setIntervention(data)

      // Set edit data
      const schedDate = new Date(data.scheduledDate).toISOString().split('T')[0]
      setEditData({
        status: data.status,
        workDone: data.workDone || '',
        timeSpent: data.timeSpent?.toString() || '',
        description: data.description || '',
        breakdown: data.breakdown || '',
        scheduledDate: schedDate,
        scheduledTime: data.scheduledTime,
      })
    } catch (error) {
      console.error('Error fetching intervention:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchParts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/interventions/${params.id}/parts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setParts(data)
    } catch (error) {
      console.error('Error fetching parts:', error)
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
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  if (!intervention) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">{t('noInterventions')}</p>
      </div>
    )
  }

  const canEdit = canEditIntervention(userRole as any, intervention.status as any)
  const availableStatuses = getAvailableStatuses(userRole as any, intervention.status as any)
  const totalPartsValue = parts.reduce((sum, part) => sum + (part.quantity * part.item.value), 0)

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/interventions`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          {tNav('backToInterventions')}
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
                    onClick={() => router.push(`/${locale}/dashboard/clients/${intervention.client.id}`)}
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

            <div className="border-t pt-4 mb-4">
              <h3 className="font-semibold text-gray-700 mb-2">Breakdown Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{intervention.breakdown}</p>
            </div>

            {intervention.description && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-2">Additional Notes</h3>
                <p className="text-gray-900 whitespace-pre-wrap">{intervention.description}</p>
              </div>
            )}
          </div>

          {/* Parts Used Section */}
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Parts Used</h2>
              {canEdit && (
                <button
                  onClick={() => setShowPartsSelector(true)}
                  className="btn btn-primary"
                >
                  + Add Parts
                </button>
              )}
            </div>

            {parts.length === 0 ? (
              <p className="text-gray-600">No parts have been used yet.</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {parts.map((part) => (
                    <div key={part.id} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{part.item.itemName}</h4>
                          <p className="text-sm text-gray-600">Part #: {part.item.partNumber}</p>
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                              Quantity: <span className="font-semibold text-gray-900">{part.quantity}</span>
                            </span>
                            <span className="text-sm text-gray-600">
                              Unit Value: <span className="font-semibold text-gray-900">€{part.item.value.toFixed(2)}</span>
                            </span>
                            <span className="text-sm text-gray-600">
                              Total: <span className="font-semibold text-green-900">€{(part.quantity * part.item.value).toFixed(2)}</span>
                            </span>
                          </div>
                          {part.item.tracksSerialNumbers && part.serialNumbers && part.serialNumbers.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-1">Serial Numbers:</p>
                              <div className="flex flex-wrap gap-1">
                                {part.serialNumbers.map((sn) => (
                                  <span
                                    key={sn.id}
                                    className="px-2 py-1 bg-purple-100 text-purple-900 rounded text-xs font-mono"
                                  >
                                    {sn.serialNumber}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Total Parts Value:</span>
                    <span className="text-xl font-bold text-green-900">€{totalPartsValue.toFixed(2)}</span>
                  </div>
                </div>
              </>
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
              Breakdown Description
            </label>
            <textarea
              rows={3}
              className="input text-gray-800"
              value={editData.breakdown}
              onChange={(e) => setEditData({ ...editData, breakdown: e.target.value })}
              required
            />
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
              Additional Notes
            </label>
            <textarea
              rows={4}
              className="input text-gray-800"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
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

      {showPartsSelector && intervention && (
        <PartsSelector
          technicianId={intervention.assignedTo.id}
          interventionId={intervention.id}
          onClose={() => setShowPartsSelector(false)}
          onPartAdded={() => {
            fetchParts()
            setShowPartsSelector(false)
          }}
        />
      )}
    </div>
  )
}
