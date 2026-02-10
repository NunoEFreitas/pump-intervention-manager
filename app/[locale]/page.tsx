'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

export default function LoginPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/status')
      const data = await response.json()
      setNeedsSetup(data.needsSetup)
      setIsLogin(!data.needsSetup)
    } catch (error) {
      console.error('Error checking setup status:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || tErrors('serverError'))
        setLoading(false)
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push(`/${locale}/dashboard`)
    } catch (err) {
      setError(tErrors('networkError'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Pump Intervention Manager
        </h1>

        {needsSetup && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{t('welcomeMessage')}</p>
          </div>
        )}
        
        {needsSetup ? (
          <>
            <h2 className="text-xl font-semibold mb-6 text-gray-700">{t('createAdminAccount')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                <input
                  type="text"
                  className="input text-gray-800"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                <input
                  type="email"
                  className="input text-gray-800"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                <input
                  type="password"
                  className="input text-gray-800"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? t('pleaseWait') : t('registerButton')}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-6 text-gray-700">{t('login')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                <input
                  type="email"
                  className="input text-gray-800"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                <input
                  type="password"
                  className="input text-gray-800"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? t('pleaseWait') : t('loginButton')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>{t('contactAdmin')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
