'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count?: {
    assignedInterventions: number
  }
}

interface EquipmentType {
  id: string
  name: string
}

interface EquipmentBrand {
  id: string
  name: string
}

export default function AdminPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')

  // Equipment types state
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [newTypeName, setNewTypeName] = useState('')
  const [editingType, setEditingType] = useState<EquipmentType | null>(null)
  const [typeLoading, setTypeLoading] = useState(false)

  // Equipment brands state
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [newBrandName, setNewBrandName] = useState('')
  const [editingBrand, setEditingBrand] = useState<EquipmentBrand | null>(null)
  const [brandLoading, setBrandLoading] = useState(false)

  const tAdmin = useTranslations('admin')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      setCurrentUserRole(user.role)
      if (user.role !== 'ADMIN') {
        router.push(`/${locale}/dashboard`)
        return
      }
    }
    fetchUsers()
    fetchEquipmentTypes()
    fetchEquipmentBrands()
  }, [router])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 403) {
        router.push(`/${locale}/dashboard`)
        return
      }
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipmentTypes = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/equipment-types', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setEquipmentTypes(data)
    } catch (error) {
      console.error('Error fetching equipment types:', error)
    }
  }

  const fetchEquipmentBrands = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/equipment-brands', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setEquipmentBrands(data)
    } catch (error) {
      console.error('Error fetching equipment brands:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(tAdmin('deleteConfirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Failed to delete user')
        return
      }
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  // Equipment type CRUD
  const saveType = async () => {
    const name = editingType ? editingType.name : newTypeName
    if (!name.trim()) return
    setTypeLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingType
        ? `/api/admin/equipment-types/${editingType.id}`
        : '/api/admin/equipment-types'
      const method = editingType ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (response.ok) {
        setNewTypeName('')
        setEditingType(null)
        fetchEquipmentTypes()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving equipment type:', error)
    } finally {
      setTypeLoading(false)
    }
  }

  const deleteType = async (id: string) => {
    if (!confirm(tAdmin('deleteConfirm') + '?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/equipment-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        fetchEquipmentTypes()
      } else {
        const data = await response.json()
        alert(data.error)
      }
    } catch (error) {
      console.error('Error deleting equipment type:', error)
    }
  }

  // Equipment brand CRUD
  const saveBrand = async () => {
    const name = editingBrand ? editingBrand.name : newBrandName
    if (!name.trim()) return
    setBrandLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingBrand
        ? `/api/admin/equipment-brands/${editingBrand.id}`
        : '/api/admin/equipment-brands'
      const method = editingBrand ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (response.ok) {
        setNewBrandName('')
        setEditingBrand(null)
        fetchEquipmentBrands()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving equipment brand:', error)
    } finally {
      setBrandLoading(false)
    }
  }

  const deleteBrand = async (id: string) => {
    if (!confirm(tAdmin('deleteConfirm') + '?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/equipment-brands/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        fetchEquipmentBrands()
      } else {
        const data = await response.json()
        alert(data.error)
      }
    } catch (error) {
      console.error('Error deleting equipment brand:', error)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800'
      case 'SUPERVISOR': return 'bg-blue-100 text-blue-800'
      case 'TECHNICIAN': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return tAdmin('rolesAdmin')
      case 'SUPERVISOR': return tAdmin('rolesSupervisor')
      case 'TECHNICIAN': return tAdmin('rolesTechnician')
      default: return role
    }
  }

  if (currentUserRole !== 'ADMIN') return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{tAdmin('title')}</h1>
          <p className="text-gray-600">{tAdmin('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push(`/${locale}/dashboard/admin/users/new`)}
          className="btn btn-primary w-full sm:w-auto"
        >
          {tAdmin('addUser')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 mb-8">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">{tAdmin('totalUsers')}</p>
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">{tAdmin('admins')}</p>
          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'ADMIN').length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">{tAdmin('supervisors')}</p>
          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'SUPERVISOR').length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">{tAdmin('technicians')}</p>
          <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'TECHNICIAN').length}</p>
        </div>
      </div>

      {/* User Management */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{tAdmin('userManagement')}</h2>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tAuth('name')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">{tAuth('email')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tAdmin('role')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">{tNav('interventions')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">{tAdmin('joined')}</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500 sm:hidden">{user.email}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="text-sm text-gray-600">{user._count?.assignedInterventions || 0}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <div className="text-sm text-gray-600">{new Date(user.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => router.push(`/${locale}/dashboard/admin/users/${user.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      {tCommon('edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      {tCommon('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment Types */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{tAdmin('equipmentTypes')}</h2>
          <button
            onClick={() => setNewTypeName(' ')}
            className="btn btn-primary text-sm"
          >
            {tAdmin('addType')}
          </button>
        </div>

        {/* Add form */}
        {newTypeName !== '' && !editingType && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="input text-gray-800 flex-1"
              placeholder={tAdmin('typeName')}
              value={newTypeName.trim() === '' ? '' : newTypeName}
              autoFocus
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveType(); if (e.key === 'Escape') setNewTypeName('') }}
            />
            <button onClick={saveType} disabled={typeLoading || !newTypeName.trim()} className="btn btn-primary text-sm">
              {typeLoading ? tCommon('saving') : tCommon('save')}
            </button>
            <button onClick={() => setNewTypeName('')} className="btn btn-secondary text-sm">
              {tCommon('cancel')}
            </button>
          </div>
        )}

        {equipmentTypes.length === 0 ? (
          <p className="text-gray-500 text-sm py-2">{tAdmin('noTypes')}</p>
        ) : (
          <div className="space-y-2">
            {equipmentTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-2 p-2 border rounded-lg">
                {editingType?.id === type.id ? (
                  <>
                    <input
                      type="text"
                      className="input text-gray-800 flex-1 py-1"
                      value={editingType.name}
                      autoFocus
                      onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveType(); if (e.key === 'Escape') setEditingType(null) }}
                    />
                    <button onClick={saveType} disabled={typeLoading} className="btn btn-primary text-sm py-1">
                      {typeLoading ? tCommon('saving') : tCommon('save')}
                    </button>
                    <button onClick={() => setEditingType(null)} className="btn btn-secondary text-sm py-1">
                      {tCommon('cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{type.name}</span>
                    <button onClick={() => { setEditingType(type); setNewTypeName('') }} className="text-blue-600 hover:text-blue-800 text-sm">{tCommon('edit')}</button>
                    <button onClick={() => deleteType(type.id)} className="text-red-600 hover:text-red-800 text-sm">{tCommon('delete')}</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment Brands */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{tAdmin('equipmentBrands')}</h2>
          <button
            onClick={() => setNewBrandName(' ')}
            className="btn btn-primary text-sm"
          >
            {tAdmin('addBrand')}
          </button>
        </div>

        {/* Add form */}
        {newBrandName !== '' && !editingBrand && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="input text-gray-800 flex-1"
              placeholder={tAdmin('brandName')}
              value={newBrandName.trim() === '' ? '' : newBrandName}
              autoFocus
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveBrand(); if (e.key === 'Escape') setNewBrandName('') }}
            />
            <button onClick={saveBrand} disabled={brandLoading || !newBrandName.trim()} className="btn btn-primary text-sm">
              {brandLoading ? tCommon('saving') : tCommon('save')}
            </button>
            <button onClick={() => setNewBrandName('')} className="btn btn-secondary text-sm">
              {tCommon('cancel')}
            </button>
          </div>
        )}

        {equipmentBrands.length === 0 ? (
          <p className="text-gray-500 text-sm py-2">{tAdmin('noBrands')}</p>
        ) : (
          <div className="space-y-2">
            {equipmentBrands.map((brand) => (
              <div key={brand.id} className="flex items-center gap-2 p-2 border rounded-lg">
                {editingBrand?.id === brand.id ? (
                  <>
                    <input
                      type="text"
                      className="input text-gray-800 flex-1 py-1"
                      value={editingBrand.name}
                      autoFocus
                      onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveBrand(); if (e.key === 'Escape') setEditingBrand(null) }}
                    />
                    <button onClick={saveBrand} disabled={brandLoading} className="btn btn-primary text-sm py-1">
                      {brandLoading ? tCommon('saving') : tCommon('save')}
                    </button>
                    <button onClick={() => setEditingBrand(null)} className="btn btn-secondary text-sm py-1">
                      {tCommon('cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{brand.name}</span>
                    <button onClick={() => { setEditingBrand(brand); setNewBrandName('') }} className="text-blue-600 hover:text-blue-800 text-sm">{tCommon('edit')}</button>
                    <button onClick={() => deleteBrand(brand.id)} className="text-red-600 hover:text-red-800 text-sm">{tCommon('delete')}</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
