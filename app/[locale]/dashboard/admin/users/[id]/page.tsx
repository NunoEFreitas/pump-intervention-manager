'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count?: {
    assignedInterventions: number
  }
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'TECHNICIAN',
  })

  useEffect(() => {
    // Check if user is admin
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const currentUser = JSON.parse(userStr)
      if (currentUser.role !== 'ADMIN') {
        router.push('/dashboard')
        return
      }
    }

    if (params.id) {
      fetchUser()
    }
  }, [params.id, router])

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/users/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setUser(data)
      setFormData({
        name: data.name,
        email: data.email,
        password: '',
        role: data.role,
      })
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const token = localStorage.getItem('token')
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      }

      // Only include password if it's been changed
      if (formData.password) {
        updateData.password = formData.password
      }

      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      router.push('/dashboard/admin')
    } catch (err: any) {
      setError(err.message || 'Failed to update user. Please try again.')
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading user...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">User not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/admin')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Admin Panel
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit User</h1>
        <p className="text-gray-600">Update user account details</p>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">User ID:</span>
            <p className="text-gray-600">{user.id}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Assigned Interventions:</span>
            <p className="text-gray-600">{user._count?.assignedInterventions || 0}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Joined:</span>
            <p className="text-gray-600">{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            name="name"
            className="input text-gray-800"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            name="email"
            className="input text-gray-800"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            name="password"
            className="input text-gray-800"
            value={formData.password}
            onChange={handleChange}
            placeholder="Leave blank to keep current password"
            minLength={6}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to keep current password. Minimum 6 characters if changing.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role *
          </label>
          <select
            name="role"
            className="input text-gray-800"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </select>
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
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/admin')}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
