'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Client {
  id: string
  name: string
}

interface Technician {
  id: string
  name: string
  email: string
}

export default function NewInterventionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedClientId = searchParams.get('clientId')
  
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    clientId: preSelectedClientId || '',
    assignedToId: '',
    scheduledDate: '',
    scheduledTime: '',
    workDone: '',
    timeSpent: '',
    description: '',
    partsUsed: '',
  })

  useEffect(() => {
    fetchClients()
    fetchTechnicians()
  }, [])

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/clients', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/technicians', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setTechnicians(data)
    } catch (error) {
      console.error('Error fetching technicians:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          timeSpent: formData.timeSpent ? parseFloat(formData.timeSpent) : null,
          partsUsed: formData.partsUsed ? formData.partsUsed.split('\n').filter(p => p.trim()) : [],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create intervention')
      }

      router.push('/dashboard/interventions')
    } catch (err: any) {
      setError(err.message || 'Failed to create intervention. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">New Intervention</h1>
        <p className="text-gray-600">Schedule a new pump station intervention</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Required fields:</strong> Client, Assigned Technician, Date, and Time
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client *
          </label>
          <select
            name="clientId"
            className="input text-gray-800"
            value={formData.clientId}
            onChange={handleChange}
            required
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign to Technician *
          </label>
          <select
            name="assignedToId"
            className="input text-gray-800"
            value={formData.assignedToId}
            onChange={handleChange}
            required
          >
            <option value="">Select a technician</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name} ({tech.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date *
            </label>
            <input
              type="date"
              name="scheduledDate"
              className="input text-gray-800"
              value={formData.scheduledDate}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Time *
            </label>
            <input
              type="time"
              name="scheduledTime"
              className="input text-gray-800"
              value={formData.scheduledTime}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Optional Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Done
              </label>
              <input
                type="text"
                name="workDone"
                className="input text-gray-800"
                placeholder="e.g., Pump maintenance, Valve replacement"
                value={formData.workDone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Spent (hours)
              </label>
              <input
                type="number"
                step="0.5"
                name="timeSpent"
                className="input text-gray-800"
                placeholder="e.g., 2.5"
                value={formData.timeSpent}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                className="input text-gray-800"
                placeholder="Detailed description of the work to be performed..."
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parts Used
              </label>
              <textarea
                name="partsUsed"
                rows={4}
                className="input text-gray-800"
                placeholder="List parts used (one per line)&#10;e.g.,&#10;Pump seal - Model XYZ&#10;O-ring 50mm&#10;Valve actuator"
                value={formData.partsUsed}
                onChange={handleChange}
              />
              <p className="text-xs text-gray-500 mt-1">Enter one part per line</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Intervention'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
