'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Tab = 'users' | 'types' | 'brands' | 'vehicles' | 'settings' | 'company'

interface CompanyVehicle { id: string; plateNumber: string; brand: string | null; model: string | null; description: string | null }

interface User {
  id: string
  name: string
  email: string
  role: string
  blocked: boolean
  createdAt: string
  _count?: { assignedInterventions: number }
}

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }

export default function AdminPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Users state
  const [users, setUsers] = useState<User[]>([])

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

  // Vehicles state
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newVehicleBrand, setNewVehicleBrand] = useState('')
  const [newVehicleModel, setNewVehicleModel] = useState('')
  const [newVehicleDesc, setNewVehicleDesc] = useState('')
  const [editingVehicle, setEditingVehicle] = useState<CompanyVehicle | null>(null)
  const [vehicleLoading, setVehicleLoading] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({ clientPrefix: '', projectPrefix: '', workOrderPrefix: '' })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Company state
  const [company, setCompany] = useState<{ name: string; email: string; address: string; phones: string[]; faxes: string[]; logo: string }>({ name: '', email: '', address: '', phones: [], faxes: [], logo: '' })
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companySaved, setCompanySaved] = useState(false)

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
    fetchVehicles()
    fetchSettings()
    fetchCompany()
  }, [router])

  // Fetch lazy: only reload when switching to that tab if not yet loaded
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 403) { router.push(`/${locale}/dashboard`); return }
      setUsers(await response.json())
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipmentTypes = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/equipment-types', { headers: { Authorization: `Bearer ${token}` } })
      setEquipmentTypes(await res.json())
    } catch (error) {
      console.error('Error fetching equipment types:', error)
    }
  }

  const fetchCompany = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/company', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setCompany({
        name: data.name || '',
        email: data.email || '',
        address: data.address || '',
        phones: Array.isArray(data.phones) ? data.phones : [],
        faxes: Array.isArray(data.faxes) ? data.faxes : [],
        logo: data.logo || '',
      })
    } catch (error) {
      console.error('Error fetching company:', error)
    }
  }

  const saveCompany = async () => {
    setCompanyLoading(true)
    setCompanySaved(false)
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/admin/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(company),
      })
      setCompanySaved(true)
      setTimeout(() => setCompanySaved(false), 2000)
    } catch (error) {
      console.error('Error saving company:', error)
    } finally {
      setCompanyLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSettings({ clientPrefix: data.clientPrefix || '', projectPrefix: data.projectPrefix || '', workOrderPrefix: data.workOrderPrefix || '' })
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const saveSettings = async () => {
    setSettingsLoading(true)
    setSettingsSaved(false)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      setSettings({ clientPrefix: data.clientPrefix || '', projectPrefix: data.projectPrefix || '', workOrderPrefix: data.workOrderPrefix || '' })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSettingsLoading(false)
    }
  }

  const fetchEquipmentBrands = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/equipment-brands', { headers: { Authorization: `Bearer ${token}` } })
      setEquipmentBrands(await res.json())
    } catch (error) {
      console.error('Error fetching equipment brands:', error)
    }
  }

  // User actions
  const handleDeleteUser = async (userId: string) => {
    if (!confirm(tAdmin('deleteConfirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) { alert(data.error || 'Failed to delete user'); return }
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const handleToggleBlock = async (userId: string, blocked: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blocked }),
      })
      fetchUsers()
    } catch (error) {
      console.error('Error toggling block:', error)
    }
  }

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/vehicles', { headers: { Authorization: `Bearer ${token}` } })
      setVehicles(await res.json())
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const saveVehicle = async () => {
    const plate = editingVehicle ? editingVehicle.plateNumber : newVehiclePlate
    const brand = editingVehicle ? editingVehicle.brand : newVehicleBrand
    const model = editingVehicle ? editingVehicle.model : newVehicleModel
    const desc = editingVehicle ? editingVehicle.description : newVehicleDesc
    if (!plate.trim()) return
    setVehicleLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingVehicle ? `/api/admin/vehicles/${editingVehicle.id}` : '/api/admin/vehicles'
      const response = await fetch(url, {
        method: editingVehicle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plateNumber: plate, brand, model, description: desc }),
      })
      if (response.ok) { setNewVehiclePlate(''); setNewVehicleBrand(''); setNewVehicleModel(''); setNewVehicleDesc(''); setEditingVehicle(null); fetchVehicles() }
      else { const d = await response.json(); alert(d.error || 'Failed to save') }
    } catch (error) {
      console.error('Error saving vehicle:', error)
    } finally {
      setVehicleLoading(false)
    }
  }

  const deleteVehicle = async (id: string) => {
    if (!confirm(tAdmin('deleteConfirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/vehicles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) fetchVehicles()
      else { const d = await response.json(); alert(d.error) }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
    }
  }

  // Equipment type CRUD
  const saveType = async () => {
    const name = editingType ? editingType.name : newTypeName
    if (!name.trim()) return
    setTypeLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingType ? `/api/admin/equipment-types/${editingType.id}` : '/api/admin/equipment-types'
      const response = await fetch(url, {
        method: editingType ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (response.ok) { setNewTypeName(''); setEditingType(null); fetchEquipmentTypes() }
      else { const d = await response.json(); alert(d.error || 'Failed to save') }
    } catch (error) {
      console.error('Error saving equipment type:', error)
    } finally {
      setTypeLoading(false)
    }
  }

  const deleteType = async (id: string) => {
    if (!confirm(tAdmin('deleteConfirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/equipment-types/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) fetchEquipmentTypes()
      else { const d = await response.json(); alert(d.error) }
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
      const url = editingBrand ? `/api/admin/equipment-brands/${editingBrand.id}` : '/api/admin/equipment-brands'
      const response = await fetch(url, {
        method: editingBrand ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      })
      if (response.ok) { setNewBrandName(''); setEditingBrand(null); fetchEquipmentBrands() }
      else { const d = await response.json(); alert(d.error || 'Failed to save') }
    } catch (error) {
      console.error('Error saving equipment brand:', error)
    } finally {
      setBrandLoading(false)
    }
  }

  const deleteBrand = async (id: string) => {
    if (!confirm(tAdmin('deleteConfirm'))) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/equipment-brands/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) fetchEquipmentBrands()
      else { const d = await response.json(); alert(d.error) }
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

  const tabClass = (tab: Tab) =>
    `px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`

  return (
    <div>
      {/* Page header */}
      <div className="px-4 sm:px-0 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{tAdmin('title')}</h1>
        <p className="text-gray-600">{tAdmin('subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex -mb-px min-w-max">
          <button className={tabClass('users')} onClick={() => setActiveTab('users')}>
            {tAdmin('userManagement')}
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {users.length}
            </span>
          </button>
          <button className={tabClass('types')} onClick={() => setActiveTab('types')}>
            {tAdmin('equipmentTypes')}
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {equipmentTypes.length}
            </span>
          </button>
          <button className={tabClass('brands')} onClick={() => setActiveTab('brands')}>
            {tAdmin('equipmentBrands')}
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {equipmentBrands.length}
            </span>
          </button>
          <button className={tabClass('vehicles')} onClick={() => setActiveTab('vehicles')}>
            {tAdmin('vehicles')}
            <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {vehicles.length}
            </span>
          </button>
          <button className={tabClass('settings')} onClick={() => setActiveTab('settings')}>
            {tAdmin('settings')}
          </button>
          <button className={tabClass('company')} onClick={() => setActiveTab('company')}>
            {tAdmin('companySettings')}
          </button>
        </nav>
      </div>

      {/* ── Users tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 mb-6">
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

          <div className="card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{tAdmin('userManagement')}</h2>
              <button
                onClick={() => router.push(`/${locale}/dashboard/admin/users/new`)}
                className="btn btn-primary w-full sm:w-auto text-sm"
              >
                {tAdmin('addUser')}
              </button>
            </div>

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
                    <tr key={user.id} className={`hover:bg-gray-50 ${user.blocked ? 'opacity-60' : ''}`}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          {user.blocked && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">{tAdmin('blocked')}</span>
                          )}
                        </div>
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
                          onClick={() => handleToggleBlock(user.id, !user.blocked)}
                          className={`mr-3 ${user.blocked ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'}`}
                        >
                          {user.blocked ? tAdmin('unblock') : tAdmin('block')}
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
        </div>
      )}

      {/* ── Equipment Types tab ─────────────────────────────────────────────── */}
      {activeTab === 'types' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{tAdmin('equipmentTypes')}</h2>
            <button onClick={() => setNewTypeName(' ')} className="btn btn-primary text-sm">
              {tAdmin('addType')}
            </button>
          </div>

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
                <div key={type.id} className="flex items-center gap-2 p-3 border rounded-lg">
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
      )}

      {/* ── Equipment Brands tab ────────────────────────────────────────────── */}
      {activeTab === 'brands' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{tAdmin('equipmentBrands')}</h2>
            <button onClick={() => setNewBrandName(' ')} className="btn btn-primary text-sm">
              {tAdmin('addBrand')}
            </button>
          </div>

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
                <div key={brand.id} className="flex items-center gap-2 p-3 border rounded-lg">
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
      )}

      {/* ── Vehicles tab ─────────────────────────────────────────────────── */}
      {activeTab === 'vehicles' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{tAdmin('vehicles')}</h2>
          </div>

          {/* Add / Edit form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">{editingVehicle ? tCommon('edit') : tAdmin('addVehicle')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                className="input text-gray-800 font-mono uppercase"
                placeholder={tAdmin('vehiclePlatePlaceholder')}
                value={editingVehicle ? editingVehicle.plateNumber : newVehiclePlate}
                onChange={(e) => editingVehicle
                  ? setEditingVehicle({ ...editingVehicle, plateNumber: e.target.value.toUpperCase() })
                  : setNewVehiclePlate(e.target.value.toUpperCase())}
              />
              <input
                type="text"
                className="input text-gray-800"
                placeholder={tAdmin('vehicleBrandPlaceholder')}
                value={editingVehicle ? (editingVehicle.brand || '') : newVehicleBrand}
                onChange={(e) => editingVehicle
                  ? setEditingVehicle({ ...editingVehicle, brand: e.target.value })
                  : setNewVehicleBrand(e.target.value)}
              />
              <input
                type="text"
                className="input text-gray-800"
                placeholder={tAdmin('vehicleModelPlaceholder')}
                value={editingVehicle ? (editingVehicle.model || '') : newVehicleModel}
                onChange={(e) => editingVehicle
                  ? setEditingVehicle({ ...editingVehicle, model: e.target.value })
                  : setNewVehicleModel(e.target.value)}
              />
              <input
                type="text"
                className="input text-gray-800"
                placeholder={tAdmin('vehicleDescPlaceholder')}
                value={editingVehicle ? (editingVehicle.description || '') : newVehicleDesc}
                onChange={(e) => editingVehicle
                  ? setEditingVehicle({ ...editingVehicle, description: e.target.value })
                  : setNewVehicleDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveVehicle} disabled={vehicleLoading} className="btn btn-primary text-sm">
                {vehicleLoading ? tCommon('saving') : editingVehicle ? tCommon('save') : tAdmin('addVehicle')}
              </button>
              {editingVehicle && (
                <button onClick={() => setEditingVehicle(null)} className="btn btn-secondary text-sm">{tCommon('cancel')}</button>
              )}
            </div>
          </div>

          {/* Vehicles list */}
          {vehicles.length === 0 ? (
            <p className="text-gray-500 text-sm">{tAdmin('noVehicles')}</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-mono font-semibold text-gray-900">{v.plateNumber}</span>
                    {(v.brand || v.model) && (
                      <span className="ml-3 text-sm text-gray-700">{[v.brand, v.model].filter(Boolean).join(' ')}</span>
                    )}
                    {v.description && <span className="ml-3 text-sm text-gray-500">{v.description}</span>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingVehicle(v)} className="text-blue-600 hover:text-blue-800 text-sm">{tCommon('edit')}</button>
                    <button onClick={() => deleteVehicle(v.id)} className="text-red-600 hover:text-red-800 text-sm">{tCommon('delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Company tab ──────────────────────────────────────────────────── */}
      {activeTab === 'company' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{tAdmin('companySettings')}</h2>
          <div className="space-y-5">
            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyLogo')}</label>
              {company.logo && (
                <div className="mb-2">
                  <img src={company.logo} alt="Company logo" className="h-16 object-contain border rounded p-1" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="text-sm text-gray-600"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setCompany({ ...company, logo: reader.result as string })
                  reader.readAsDataURL(file)
                }}
              />
              {company.logo && (
                <button onClick={() => setCompany({ ...company, logo: '' })} className="ml-3 text-xs text-red-600 hover:text-red-800">{tAdmin('removeLogo')}</button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyName')}</label>
              <input type="text" className="input text-gray-800" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyEmail')}</label>
              <input type="email" className="input text-gray-800" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyAddress')}</label>
              <textarea className="input text-gray-800 resize-none" rows={2} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </div>

            {/* Phones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyPhones')}</label>
              <div className="space-y-2">
                {company.phones.map((phone, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      className="input text-gray-800 flex-1"
                      value={phone}
                      onChange={(e) => {
                        const phones = [...company.phones]
                        phones[i] = e.target.value
                        setCompany({ ...company, phones })
                      }}
                    />
                    <button onClick={() => setCompany({ ...company, phones: company.phones.filter((_, j) => j !== i) })} className="text-red-600 hover:text-red-800 text-sm px-2">&times;</button>
                  </div>
                ))}
                <button onClick={() => setCompany({ ...company, phones: [...company.phones, ''] })} className="text-blue-600 hover:text-blue-800 text-sm">{tAdmin('addPhone')}</button>
              </div>
            </div>

            {/* Faxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin('companyFaxes')}</label>
              <div className="space-y-2">
                {company.faxes.map((fax, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      className="input text-gray-800 flex-1"
                      value={fax}
                      onChange={(e) => {
                        const faxes = [...company.faxes]
                        faxes[i] = e.target.value
                        setCompany({ ...company, faxes })
                      }}
                    />
                    <button onClick={() => setCompany({ ...company, faxes: company.faxes.filter((_, j) => j !== i) })} className="text-red-600 hover:text-red-800 text-sm px-2">&times;</button>
                  </div>
                ))}
                <button onClick={() => setCompany({ ...company, faxes: [...company.faxes, ''] })} className="text-blue-600 hover:text-blue-800 text-sm">{tAdmin('addFax')}</button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveCompany} disabled={companyLoading} className="btn btn-primary">
                {companyLoading ? tCommon('saving') : tCommon('save')}
              </button>
              {companySaved && <span className="text-sm text-green-600 font-medium">{tCommon('saved')}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings tab ─────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="card max-w-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{tAdmin('settings')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAdmin('clientPrefix')}
              </label>
              <input
                type="text"
                className="input text-gray-800"
                placeholder="e.g. CLI"
                value={settings.clientPrefix}
                onChange={(e) => setSettings({ ...settings, clientPrefix: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">{tAdmin('clientPrefixHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAdmin('projectPrefix')}
              </label>
              <input
                type="text"
                className="input text-gray-800"
                placeholder="e.g. INT"
                value={settings.projectPrefix}
                onChange={(e) => setSettings({ ...settings, projectPrefix: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">{tAdmin('projectPrefixHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAdmin('workOrderPrefix')}
              </label>
              <input
                type="text"
                className="input text-gray-800"
                placeholder="e.g. WO"
                value={settings.workOrderPrefix}
                onChange={(e) => setSettings({ ...settings, workOrderPrefix: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">{tAdmin('workOrderPrefixHint')}</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveSettings}
                disabled={settingsLoading}
                className="btn btn-primary"
              >
                {settingsLoading ? tCommon('saving') : tCommon('save')}
              </button>
              {settingsSaved && (
                <span className="text-sm text-green-600 font-medium">{tCommon('saved')}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
