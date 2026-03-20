'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface User {
  id: string
  name: string
  email: string
  role: string
  blocked: boolean
  createdAt: string
  _count?: { assignedInterventions: number }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    }
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 403) { router.push(`/${locale}/dashboard`); return }
      setUsers(await res.json())
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Failed to delete user'); return }
    fetchUsers()
  }

  const handleToggleBlock = async (userId: string, blocked: boolean) => {
    const token = localStorage.getItem('token')
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ blocked }),
    })
    fetchUsers()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800'
      case 'SUPERVISOR': return 'bg-blue-100 text-blue-800'
      case 'TECHNICIAN': return 'bg-green-100 text-green-800'
      case 'CLIENT': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return t('rolesAdmin')
      case 'SUPERVISOR': return t('rolesSupervisor')
      case 'TECHNICIAN': return t('rolesTechnician')
      case 'CLIENT': return 'Cliente'
      default: return role
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-600">{tCommon('loading')}</div></div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('userManagement')}</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5 mb-6">
        <div className="card"><p className="text-sm font-medium text-gray-600">{t('totalUsers')}</p><p className="text-2xl font-bold text-gray-900">{users.length}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-600">{t('admins')}</p><p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'ADMIN').length}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-600">{t('supervisors')}</p><p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'SUPERVISOR').length}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-600">{t('technicians')}</p><p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'TECHNICIAN').length}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-600">Clientes</p><p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'CLIENT').length}</p></div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('userManagement')}</h2>
          <button onClick={() => router.push(`/${locale}/dashboard/admin/users/new`)} className="btn btn-primary w-full sm:w-auto text-sm">{t('addUser')}</button>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tAuth('name')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">{tAuth('email')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('role')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">{tNav('interventions')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('joined')}</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${user.blocked ? 'opacity-60' : ''}`}>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      {user.blocked && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">{t('blocked')}</span>}
                    </div>
                    <div className="text-xs text-gray-500 sm:hidden">{user.email}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell"><div className="text-sm text-gray-600">{user.email}</div></td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell"><div className="text-sm text-gray-600">{user._count?.assignedInterventions || 0}</div></td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell"><div className="text-sm text-gray-600">{new Date(user.createdAt).toLocaleDateString()}</div></td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => router.push(`/${locale}/dashboard/admin/users/${user.id}`)} className="text-blue-600 hover:text-blue-900 mr-3">{tCommon('edit')}</button>
                    <button onClick={() => handleToggleBlock(user.id, !user.blocked)} className={`mr-3 ${user.blocked ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'}`}>
                      {user.blocked ? t('unblock') : t('block')}
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">{tCommon('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
