'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function NewClientPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    contactPerson: '',
    notes: '',
  })

  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tClients = useTranslations('clients')
  const tNav = useTranslations('nav')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to create client')
      }

      router.push(`/${locale}/dashboard/clients`)
    } catch (err) {
      setError('Failed to create client. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
          {tNav('back')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tClients('addClient')}</h1>
        <p className="text-gray-600">{tClients('createClient')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tClients('clientName')} *
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
            {tClients('address')}
          </label>
          <input
            type="text"
            name="address"
            className="input text-gray-800"
            value={formData.address}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('city')}
            </label>
            <input
              type="text"
              name="city"
              className="input text-gray-800"
              value={formData.city}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('postalCode')}
            </label>
            <input
              type="text"
              name="postalCode"
              className="input text-gray-800"
              value={formData.postalCode}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tClients('phone')}
            </label>
            <input
              type="tel"
              name="phone"
              className="input text-gray-800"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth('email')}
            </label>
            <input
              type="email"
              name="email"
              className="input text-gray-800"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tClients('contactPerson')}
          </label>
          <input
            type="text"
            name="contactPerson"
            className="input text-gray-800"
            value={formData.contactPerson}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tClients('notes')}
          </label>
          <textarea
            name="notes"
            rows={4}
            className="input text-gray-800"
            value={formData.notes}
            onChange={handleChange}
          />
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
            {loading ? tCommon('creating') : tClients('createButton')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
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
