'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import Navigation from '@/components/Navigation'

// Refresh when less than 1h remains on the token
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000
// Debounce activity refresh so we don't hammer the server
const REFRESH_DEBOUNCE_MS = 60 * 1000

function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExp(token)
  return exp === null || exp < Date.now()
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const fetchPatched = useRef(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logout = (reason?: string) => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push(reason ? `/${locale}?reason=${reason}` : `/${locale}`)
  }

  const checkToken = () => {
    const token = localStorage.getItem('token')
    if (!token || isTokenExpired(token)) { logout('expired'); return false }
    return true
  }

  // Silently get a new token from the server
  const refreshToken = async () => {
    const token = localStorage.getItem('token')
    if (!token || isTokenExpired(token)) { logout('expired'); return }
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('token', data.token)
      } else {
        logout('expired')
      }
    } catch { /* network error — keep existing token, will expire naturally */ }
  }

  // Debounced refresh on activity: only fires if token has < 1h left
  const handleActivity = () => {
    if (refreshTimer.current) return // already scheduled
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      const token = localStorage.getItem('token')
      if (!token) return
      const exp = getTokenExp(token)
      if (exp === null) return
      const remaining = exp - Date.now()
      if (remaining > 0 && remaining < REFRESH_THRESHOLD_MS) {
        refreshToken()
      }
    }, REFRESH_DEBOUNCE_MS)
  }

  useEffect(() => {
    // Initial check
    const token = localStorage.getItem('token')
    if (!token) { router.push(`/${locale}`); return }
    if (isTokenExpired(token)) { logout('expired'); return }

    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const u = JSON.parse(userStr)
        if (u.role === 'CLIENT' && !pathname.endsWith('/portal')) {
          router.push(`/${locale}/portal`)
        }
      } catch { /* ignore */ }
    }

    // Re-check + refresh on tab focus (catches overnight idle)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!checkToken()) return
        // Also proactively refresh if close to expiry on return
        const t = localStorage.getItem('token')
        if (t) {
          const exp = getTokenExp(t)
          if (exp !== null && exp - Date.now() < REFRESH_THRESHOLD_MS) {
            refreshToken()
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Track user activity to refresh the token while they're working
    const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'pointerdown', 'scroll'] as const
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    // Patch window.fetch once to handle 401s globally
    if (!fetchPatched.current) {
      fetchPatched.current = true
      const original = window.fetch.bind(window)
      window.fetch = async (...args) => {
        const res = await original(...args)
        if (res.status === 401) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
          if (!url.includes('/api/auth/')) logout('expired')
        }
        return res
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [locale, pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
