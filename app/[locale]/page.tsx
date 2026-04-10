'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'

function LoginPageInner() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const searchParams = useSearchParams()

  const [needsSetup, setNeedsSetup] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (searchParams.get('reason') === 'expired') setSessionExpired(true)
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/status')
      const data = await response.json()
      setNeedsSetup(data.needsSetup)
    } catch (error) {
      console.error('Error checking setup status:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = needsSetup ? '/api/auth/register' : '/api/auth/login'
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
        router.push(`/${locale}/portal`)
      } else {
        router.push(`/${locale}/dashboard`)
      }
    } catch {
      setError(tErrors('networkError'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — background image ── */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Full-bleed background image */}
        <Image
          src="/login.jpeg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        {/* Blue gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700/80 to-blue-900/60" />

        {/* Content on top of image */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <h1 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">G-Pim</h1>
            <p className="text-blue-100 text-lg mt-2 font-light">Gestão de Intervenções e Manutenção</p>
          </div>

          <div className="space-y-5">
            {[
              { icon: '⚙️', text: 'Gestão completa de intervenções' },
              { icon: '🔧', text: 'Controlo de stock e armazém' },
              { icon: '📋', text: 'Reparações e peças de cliente' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-white/90 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-blue-200/70 text-xs">© {new Date().getFullYear()} G-Pim</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 lg:max-w-md xl:max-w-lg flex flex-col justify-center px-8 sm:px-12 py-12 bg-white relative">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="bg-blue-50 rounded-xl p-2">
            <Image src="/login.jpeg" alt="G-Pim" width={40} height={40} className="rounded-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">G-Pim</h1>
            <p className="text-xs text-gray-400">Gestão de Intervenções</p>
          </div>
        </div>

        <div className="max-w-sm w-full mx-auto">
          {sessionExpired && (
            <div className="mb-5 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-sm text-amber-800">A tua sessão expirou. Por favor inicia sessão novamente.</p>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {needsSetup ? 'Configuração inicial' : 'Bem-vindo'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {needsSetup ? 'Cria a conta de administrador para começar.' : 'Introduz as tuas credenciais para entrar.'}
            </p>
          </div>

          {needsSetup && (
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{t('welcomeMessage')}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {needsSetup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('name')}</label>
                <input
                  type="text"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('email')}</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="exemplo@empresa.pt"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('password')}</label>
              <input
                type="password"
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm transition-colors"
            >
              {loading ? t('pleaseWait') : needsSetup ? t('registerButton') : t('loginButton')}
            </button>
          </form>

          {!needsSetup && (
            <p className="mt-8 text-center text-xs text-gray-400">{t('contactAdmin')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
