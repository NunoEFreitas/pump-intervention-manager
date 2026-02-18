// FILE: components/Navigation.tsx (UPDATED - Replace existing file)
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')
  const [user, setUser] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setUser(JSON.parse(userStr))
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push(`/${locale}`)
  }

  const navItems = [
    { name: t('dashboard'), path: `/${locale}/dashboard` },
    { name: t('interventions'), path: `/${locale}/dashboard/interventions` },
  ]

  if (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') {
    navItems.splice(1, 0, { name: t('clients'), path: `/${locale}/dashboard/clients` })
    navItems.push({ name: t('warehouse'), path: `/${locale}/dashboard/warehouse` })
    navItems.push({ name: t('technicians'), path: `/${locale}/dashboard/warehouse/technicians` })
  }

  if (user?.role === 'ADMIN') {
    navItems.push({ name: t('admin'), path: `/${locale}/dashboard/admin` })
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">

          {/* Desktop nav links */}
          <div className="hidden sm:flex space-x-6">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  pathname === item.path
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Right side: language + user + logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <span className="hidden sm:block text-sm text-gray-700">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-sm"
            >
              {tCommon('logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t bg-white">
          <div className="py-2 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`block px-4 py-3 text-sm font-medium border-l-4 ${
                  pathname === item.path
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.name}
              </a>
            ))}
            <div className="px-4 py-2 text-sm text-gray-500 border-t">{user?.name}</div>
          </div>
        </div>
      )}
    </nav>
  )
}
