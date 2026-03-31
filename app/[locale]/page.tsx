'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const [needsSetup, setNeedsSetup] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { checkSetupStatus() }, [])

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
        headers: { 'Content-Type': 'application/json' },
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
      if (data.user.role === 'CLIENT') {
        router.push(`/${locale}/dashboard/portal`)
      } else {
        router.push(`/${locale}/dashboard`)
      }
    } catch {
      setError(tErrors('networkError'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header band */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-8 pt-10 pb-8 flex flex-col items-center">
            <div className="bg-white rounded-2xl p-3 shadow-lg mb-4">
              <Image src="/login.jpeg" alt="G-Pim" width={72} height={72} className="rounded-xl" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">G-Pim</h1>
            <p className="text-blue-200 text-sm mt-1">Gestão de Intervenções e Manutenção</p>
          </div>

          {/* Form area */}
          <div className="px-8 py-8">
            {needsSetup && (
              <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">{t('welcomeMessage')}</p>
              </div>
            )}

            <h2 className="text-lg font-semibold text-gray-700 mb-6">
              {needsSetup ? t('createAdminAccount') : t('login')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSetup && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('name')}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('email')}</label>
                <input
                  type="email"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('password')}</label>
                <input
                  type="password"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-lg">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg shadow transition-colors mt-2"
              >
                {loading ? t('pleaseWait') : needsSetup ? t('registerButton') : t('loginButton')}
              </button>
            </form>

            {!needsSetup && (
              <p className="mt-6 text-center text-xs text-gray-400">{t('contactAdmin')}</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">© {new Date().getFullYear()} G-Pim</p>
      </div>
    </div>
  )
}
