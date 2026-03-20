'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import Navigation from '@/components/Navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push(`/${locale}`)
      return
    }
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const u = JSON.parse(userStr)
        if (u.role === 'CLIENT' && !pathname.endsWith('/portal')) {
          router.push(`/${locale}/dashboard/portal`)
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [router, locale, pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
