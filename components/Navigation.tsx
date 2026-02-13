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

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setUser(JSON.parse(userStr))
    }
  }, [])

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
    // Add Warehouse and Technicians links
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
          <div className="flex space-x-8">
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

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="text-sm text-gray-700">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-sm"
            >
              {tCommon('logout')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
