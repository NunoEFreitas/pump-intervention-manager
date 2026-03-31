'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function NewUserPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [loading, setLoading] = useState(false)
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
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') {
        router.push(`/${locale}/dashboard`)
      }
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      router.push(`/${locale}/dashboard/admin`)
    } catch (err: any) {
      setError(err.message || 'Failed to create user. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tAdmin('newUser')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tAdmin('createUser')}</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAuth('password')} *</label>
            <input type="password" name="password" className="input text-gray-800" value={formData.password} onChange={handleChange} required minLength={6} />
            <p className="text-xs text-gray-500 mt-1">{tAdmin('passwordMinLength')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('role')} *</label>
            <select name="role" className="input text-gray-800" value={formData.role} onChange={handleChange} required>
              <option value="TECHNICIAN">{tAdmin('rolesTechnician')}</option>
              <option value="SUPERVISOR">{tAdmin('rolesSupervisor')}</option>
              <option value="ADMIN">{tAdmin('rolesAdmin')}</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
          <p><strong>{tAdmin('rolesTechnician')}:</strong> {tAdmin('rolesTechnicianDesc')}</p>
          <p><strong>{tAdmin('rolesSupervisor')}:</strong> {tAdmin('rolesSupervisorDesc')}</p>
          <p><strong>{tAdmin('rolesAdmin')}:</strong> {tAdmin('rolesAdminDesc')}</p>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? tCommon('saving') : tAdmin('createButton')}
          </button>
          <button type="button" onClick={() => router.push(`/${locale}/dashboard/admin`)} className="btn btn-secondary" disabled={loading}>
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
