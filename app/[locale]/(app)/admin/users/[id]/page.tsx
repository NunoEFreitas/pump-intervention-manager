'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface User {
  id: string
  reference: string | null
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
  const locale = params.locale as string
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

  const tAdmin = useTranslations('admin')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')



  useEffect(() => {
    // Check if user is admin
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const currentUser = JSON.parse(userStr)
      if (currentUser.role !== 'ADMIN') {
        router.push(`/${locale}/dashboard`)
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

      router.push(`/${locale}/admin`)
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
        <div className="text-gray-600">{tAdmin('loadingUser')}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">{tAdmin('userNotFound')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.push(`/${locale}/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tAdmin('editUser')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tAdmin('updateUser')}</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-500">{tAdmin('userId')}</span>
            {user.reference
              ? <p className="mt-0.5"><span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{user.reference}</span></p>
              : <p className="text-gray-400 text-xs italic">Sem referência</p>}
          </div>
          <div>
            <span className="text-xs text-gray-500">{tAdmin('assignedInterventions')}</span>
            <p className="font-medium text-gray-900 mt-0.5">{user._count?.assignedInterventions || 0}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">{tAdmin('joined')}</span>
            <p className="font-medium text-gray-900 mt-0.5">{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('fullName')} *</label>
            <input type="text" name="name" className="input text-gray-800" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAuth('email')} *</label>
            <input type="email" name="email" className="input text-gray-800" value={formData.email} onChange={handleChange} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('newPassword')}</label>
            <input type="password" name="password" className="input text-gray-800" value={formData.password} onChange={handleChange} placeholder={tAdmin('passwordPlaceholder')} minLength={6} />
            <p className="text-xs text-gray-500 mt-1">{tAdmin('passwordNote')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('role')} *</label>
            {user.role === 'CLIENT' ? (
              <div className="input text-gray-500 bg-gray-50 flex items-center gap-2 cursor-not-allowed">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Cliente</span>
                <span className="text-sm text-gray-400">— não pode ser alterado</span>
              </div>
            ) : (
              <select name="role" className="input text-gray-800" value={formData.role} onChange={handleChange} required>
                <option value="TECHNICIAN">{tAdmin('rolesTechnician')}</option>
                <option value="SUPERVISOR">{tAdmin('rolesSupervisor')}</option>
                <option value="ADMIN">{tAdmin('rolesAdmin')}</option>
              </select>
            )}
          </div>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? tCommon('saving') : tAdmin('saveButton')}
          </button>
          <button type="button" onClick={() => router.push(`/${locale}/admin`)} className="btn btn-secondary" disabled={saving}>
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
