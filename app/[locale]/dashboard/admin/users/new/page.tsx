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

  const tNav = useTranslations('nav')
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/admin`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          {tNav('backToAdmin')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tAdmin('newUser')}</h1>
        <p className="text-gray-600">{tAdmin('createUser')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tAdmin('fullName')} *
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
            {tAuth('email')} *
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
            {tAuth('password')} *
          </label>
          <input
            type="password"
            name="password"
            className="input text-gray-800"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
          />
          <p className="text-xs text-gray-500 mt-1">{tAdmin('passwordMinLength')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tAdmin('role')} *
          </label>
          <select
            name="role"
            className="input text-gray-800"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="TECHNICIAN">{tAdmin('rolesTechnician')}</option>
            <option value="SUPERVISOR">{tAdmin('rolesSupervisor')}</option>
            <option value="ADMIN">{tAdmin('rolesAdmin')}</option>
          </select>
          <div className="mt-2 text-sm text-gray-600">
            <p className="mb-1"><strong>{tAdmin('rolesTechnician')}:</strong> {tAdmin('rolesTechnicianDesc')}</p>
            <p className="mb-1"><strong>{tAdmin('rolesSupervisor')}:</strong> {tAdmin('rolesSupervisorDesc')}</p>
            <p><strong>{tAdmin('rolesAdmin')}:</strong> {tAdmin('rolesAdminDesc')}</p>
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
            {loading ? tAdmin('saving') : tAdmin('createButton')}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/dashboard/admin`)}
            className="btn btn-secondary"
            disabled={loading}
          >
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
